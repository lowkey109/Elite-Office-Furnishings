/**
 * Floor Plan Parser — Stage 2 / Stage 3
 *
 * Attempts to extract the real outer boundary of an uploaded floor plan using:
 *   1. Sharp pixel-level outline scanning (images: PNG/JPG/WEBP)
 *   2. OpenAI Vision API for semantic boundary detection (images + PDFs)
 *   3. PDF page-dimension extraction (PDFs without rasterization)
 *   4. Honest fallback to input dimensions when all else fails
 *
 * Returns a FloorGeometry object suitable for SVG rendering and 3D extrusion.
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import sharp from "sharp";
import OpenAI from "openai";

const _require = createRequire(import.meta.url);
const pdfParse: (buffer: Buffer, options?: any) => Promise<{ text: string; metadata: any }> = _require("pdf-parse");

export interface BoundaryPoint {
  x: number;
  y: number;
}

export interface FloorGeometry {
  boundary: BoundaryPoint[];
  internalWalls: BoundaryPoint[][];
  aspectRatio: number;
  confidence: number;
  source: "pixel-scan" | "vision-ai" | "pdf-dimensions" | "fallback-rectangle";
  detectedShape?: string;
  description?: string;
  fallback: boolean;
  fallbackReason?: string;
  pageWidthMm?: number;
  pageHeightMm?: number;
}

const SAMPLE_STEP = 8;
const DARK_THRESHOLD = 100;
const MAX_VISION_DIM = 1024;
const MIN_CONFIDENCE_FOR_PIXEL = 0.35;

function normalise(val: number, max: number): number {
  return Math.max(0, Math.min(1, val / max));
}

function simplifyPolygon(points: BoundaryPoint[], tolerance: number): BoundaryPoint[] {
  if (points.length <= 4) return points;
  const result: BoundaryPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    if (dx > tolerance || dy > tolerance) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function buildRectBoundary(): BoundaryPoint[] {
  return [
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
    { x: 0.05, y: 0.95 },
    { x: 0.05, y: 0.05 },
  ];
}

/**
 * Pixel-level silhouette scan using sharp.
 * Scans the image from each of the 4 edges inward to find the outermost dark pixels,
 * producing a silhouette polygon that traces the real floor plan boundary.
 */
async function pixelScan(filePath: string): Promise<{ boundary: BoundaryPoint[]; confidence: number; aspectRatio: number } | null> {
  try {
    const image = sharp(filePath);
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return null;

    const targetW = Math.min(meta.width, 600);
    const scale = targetW / meta.width;
    const targetH = Math.round(meta.height * scale);

    const { data, info } = await sharp(filePath)
      .resize(targetW, targetH, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const W = info.width;
    const H = info.height;
    const px = (x: number, y: number): number => data[y * W + x];
    const isDark = (x: number, y: number): boolean => px(x, y) < DARK_THRESHOLD;

    const topBoundary: BoundaryPoint[] = [];
    const bottomBoundary: BoundaryPoint[] = [];
    const leftBoundary: BoundaryPoint[] = [];
    const rightBoundary: BoundaryPoint[] = [];

    for (let x = 0; x < W; x += SAMPLE_STEP) {
      let topY = -1;
      let botY = -1;
      for (let y = 0; y < H; y++) {
        if (isDark(x, y)) { topY = y; break; }
      }
      for (let y = H - 1; y >= 0; y--) {
        if (isDark(x, y)) { botY = y; break; }
      }
      if (topY >= 0) topBoundary.push({ x: normalise(x, W), y: normalise(topY, H) });
      if (botY >= 0) bottomBoundary.push({ x: normalise(x, W), y: normalise(botY, H) });
    }

    for (let y = 0; y < H; y += SAMPLE_STEP) {
      let leftX = -1;
      let rightX = -1;
      for (let x = 0; x < W; x++) {
        if (isDark(x, y)) { leftX = x; break; }
      }
      for (let x = W - 1; x >= 0; x--) {
        if (isDark(x, y)) { rightX = x; break; }
      }
      if (leftX >= 0) leftBoundary.push({ x: normalise(leftX, W), y: normalise(y, H) });
      if (rightX >= 0) rightBoundary.push({ x: normalise(rightX, W), y: normalise(y, H) });
    }

    if (topBoundary.length < 3 || bottomBoundary.length < 3) {
      return null;
    }

    const boundary: BoundaryPoint[] = [
      ...topBoundary,
      ...rightBoundary,
      ...[...bottomBoundary].reverse(),
      ...[...leftBoundary].reverse(),
      topBoundary[0],
    ];

    const simplified = simplifyPolygon(boundary, 0.015);

    const xMin = Math.min(...boundary.map(p => p.x));
    const xMax = Math.max(...boundary.map(p => p.x));
    const yMin = Math.min(...boundary.map(p => p.y));
    const yMax = Math.max(...boundary.map(p => p.y));
    const coverage = (xMax - xMin) * (yMax - yMin);

    const darkPixelCount = Array.from(data).filter(v => v < DARK_THRESHOLD).length;
    const darkRatio = darkPixelCount / (W * H);

    let confidence = 0;
    if (topBoundary.length > 5 && coverage > 0.2 && darkRatio > 0.02 && darkRatio < 0.85) {
      confidence = Math.min(0.82, 0.4 + coverage * 0.6 + darkRatio * 0.2);
    }

    return {
      boundary: simplified,
      confidence,
      aspectRatio: W / H,
    };
  } catch (err: any) {
    console.warn("[FloorPlanParser] Pixel scan failed:", err.message);
    return null;
  }
}

/**
 * OpenAI Vision API boundary extraction.
 * Sends the image to gpt-4o-mini with a structured prompt requesting
 * normalised polygon coordinates of the floor plan outer boundary.
 */
async function visionDetect(
  filePath: string,
  openai: OpenAI,
): Promise<{ boundary: BoundaryPoint[]; confidence: number; aspectRatio: number; description?: string; detectedShape?: string } | null> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let imageBuffer: Buffer;
    let mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";

    if (ext === ".pdf") {
      console.log("[FloorPlanParser] PDF detected — vision analysis skipped (no rasterizer). Using PDF dimensions fallback.");
      return null;
    }

    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";

    const meta = await sharp(filePath).metadata();
    const origW = meta.width || 800;
    const origH = meta.height || 600;
    const aspectRatio = origW / origH;

    const resizeW = Math.min(origW, MAX_VISION_DIM);
    const resizeH = Math.round(resizeW / aspectRatio);

    imageBuffer = await sharp(filePath)
      .resize(resizeW, resizeH, { fit: "inside" })
      .jpeg({ quality: 82 })
      .toBuffer();

    const base64 = imageBuffer.toString("base64");

    const prompt = `You are an architectural drawing analyzer specializing in floor plans.

Analyze this floor plan image and extract the outer boundary polygon of the floor space.

Return ONLY valid JSON in this exact format — no other text:
{
  "boundary": [
    {"x": 0.1, "y": 0.1},
    {"x": 0.9, "y": 0.1},
    {"x": 0.9, "y": 0.9},
    {"x": 0.1, "y": 0.9},
    {"x": 0.1, "y": 0.1}
  ],
  "aspectRatio": 1.5,
  "confidence": 0.85,
  "description": "Rectangular floor plan approximately 20m x 12m",
  "detectedShape": "rectangle"
}

Rules:
- x and y must be between 0 and 1 (0,0 = top-left, 1,1 = bottom-right)
- The boundary must close: first and last point should be identical
- Include 4-24 boundary points — more for L-shaped, U-shaped, or irregular plans
- confidence: 0.0 if not a floor plan, up to 1.0 for clear plans
- detectedShape: one of "rectangle", "L-shape", "U-shape", "irregular", "unknown"
- If image is not a floor plan, use confidence 0.05 and the full image boundary

Focus ONLY on the outer perimeter of the usable floor space, not internal walls.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
          ],
        },
      ],
    } as any);

    const raw = completion.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[FloorPlanParser] Vision response had no JSON:", raw.slice(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.boundary) || parsed.boundary.length < 3) {
      console.warn("[FloorPlanParser] Vision returned invalid boundary");
      return null;
    }

    const validPoints = (parsed.boundary as any[]).filter(
      (p: any) => typeof p.x === "number" && typeof p.y === "number" &&
        p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
    ) as BoundaryPoint[];

    if (validPoints.length < 3) return null;

    if (validPoints[validPoints.length - 1].x !== validPoints[0].x ||
      validPoints[validPoints.length - 1].y !== validPoints[0].y) {
      validPoints.push({ ...validPoints[0] });
    }

    return {
      boundary: validPoints,
      confidence: Math.min(1, Math.max(0, typeof parsed.confidence === "number" ? parsed.confidence : 0.7)),
      aspectRatio: typeof parsed.aspectRatio === "number" ? parsed.aspectRatio : (origW / origH),
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      detectedShape: typeof parsed.detectedShape === "string" ? parsed.detectedShape : undefined,
    };
  } catch (err: any) {
    console.error("[FloorPlanParser] Vision detection failed:", err.message);
    return null;
  }
}

/**
 * PDF dimension extraction using pdf-parse.
 * Gets page size to derive aspect ratio and returns an approximate boundary.
 */
async function pdfDimensions(filePath: string): Promise<{ boundary: BoundaryPoint[]; aspectRatio: number; pageWidthMm?: number; pageHeightMm?: number } | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer, { max: 1 });

    let aspectRatio = 1.41;
    let pageWidthMm: number | undefined;
    let pageHeightMm: number | undefined;

    if (data.metadata && (data.metadata as any).get) {
      const meta = data.metadata as any;
      const w = meta.get("pdf:PageSizeWidth");
      const h = meta.get("pdf:PageSizeHeight");
      if (w && h) {
        pageWidthMm = parseFloat(w);
        pageHeightMm = parseFloat(h);
        aspectRatio = pageWidthMm / pageHeightMm;
      }
    }

    const boundary: BoundaryPoint[] = [
      { x: 0.04, y: 0.04 },
      { x: 0.96, y: 0.04 },
      { x: 0.96, y: 0.96 },
      { x: 0.04, y: 0.96 },
      { x: 0.04, y: 0.04 },
    ];

    return { boundary, aspectRatio, pageWidthMm, pageHeightMm };
  } catch (err: any) {
    console.warn("[FloorPlanParser] PDF dimension extraction failed:", err.message);
    return null;
  }
}

/**
 * Main entry point.
 * Tries each method in priority order and returns the best result.
 */
export async function parseFloorPlan(
  filePath: string,
  openaiClient?: OpenAI,
  squareMetres?: string,
): Promise<FloorGeometry> {
  const ext = path.extname(filePath).toLowerCase();
  const isPdf = ext === ".pdf";
  const isImage = [".png", ".jpg", ".jpeg", ".webp"].includes(ext);

  console.log(`[FloorPlanParser] Processing: ${path.basename(filePath)} (${isPdf ? "PDF" : "image"})`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[FloorPlanParser] File not found: ${filePath}`);
    return {
      boundary: buildRectBoundary(),
      internalWalls: [],
      aspectRatio: 1.5,
      confidence: 0,
      source: "fallback-rectangle",
      fallback: true,
      fallbackReason: "uploaded file not found on disk",
    };
  }

  let pixelResult: Awaited<ReturnType<typeof pixelScan>> = null;
  let visionResult: Awaited<ReturnType<typeof visionDetect>> = null;
  let pdfResult: Awaited<ReturnType<typeof pdfDimensions>> = null;

  if (isImage) {
    [pixelResult, visionResult] = await Promise.all([
      pixelScan(filePath),
      openaiClient ? visionDetect(filePath, openaiClient) : Promise.resolve(null),
    ]);
  } else if (isPdf) {
    [pdfResult, visionResult] = await Promise.all([
      pdfDimensions(filePath),
      Promise.resolve(null),
    ]);
  }

  const hasGoodVision = visionResult && visionResult.confidence >= 0.55;
  const hasGoodPixel = pixelResult && pixelResult.confidence >= MIN_CONFIDENCE_FOR_PIXEL;

  if (hasGoodVision) {
    console.log(`[FloorPlanParser] ✅ Vision AI boundary — confidence: ${visionResult!.confidence.toFixed(2)}, shape: ${visionResult!.detectedShape || "unknown"}`);
    return {
      boundary: visionResult!.boundary,
      internalWalls: [],
      aspectRatio: visionResult!.aspectRatio,
      confidence: visionResult!.confidence,
      source: "vision-ai",
      detectedShape: visionResult!.detectedShape,
      description: visionResult!.description,
      fallback: false,
    };
  }

  if (hasGoodPixel) {
    console.log(`[FloorPlanParser] ✅ Pixel scan boundary — confidence: ${pixelResult!.confidence.toFixed(2)}`);
    return {
      boundary: pixelResult!.boundary,
      internalWalls: [],
      aspectRatio: pixelResult!.aspectRatio,
      confidence: pixelResult!.confidence,
      source: "pixel-scan",
      fallback: false,
    };
  }

  if (pixelResult && pixelResult.confidence > 0) {
    console.log(`[FloorPlanParser] ⚠️ Low-confidence pixel scan (${pixelResult.confidence.toFixed(2)}) — using outer boundary only`);
    return {
      boundary: pixelResult.boundary,
      internalWalls: [],
      aspectRatio: pixelResult.aspectRatio,
      confidence: pixelResult.confidence,
      source: "pixel-scan",
      fallback: false,
    };
  }

  if (isPdf && pdfResult) {
    const sqm = parseFloat(squareMetres || "0");
    const computedAspect = sqm > 0
      ? (pdfResult.aspectRatio > 0 ? pdfResult.aspectRatio : Math.sqrt(sqm / 200) * 1.5)
      : pdfResult.aspectRatio;
    console.log(`[FloorPlanParser] ⚠️ PDF — using page boundary (aspect ${computedAspect.toFixed(2)})`);
    return {
      boundary: pdfResult.boundary,
      internalWalls: [],
      aspectRatio: computedAspect,
      confidence: 0.25,
      source: "pdf-dimensions",
      pageWidthMm: pdfResult.pageWidthMm,
      pageHeightMm: pdfResult.pageHeightMm,
      fallback: true,
      fallbackReason: "PDF cannot be rasterized — using page dimensions as boundary",
    };
  }

  const sqm = parseFloat(squareMetres || "0");
  const aspectRatio = sqm > 0 ? Math.max(1, Math.sqrt(sqm / 50) * 0.8) : 1.5;
  console.warn(`[FloorPlanParser] ❌ All methods failed — generating fallback rectangle (sqm=${sqm})`);
  return {
    boundary: buildRectBoundary(),
    internalWalls: [],
    aspectRatio,
    confidence: 0,
    source: "fallback-rectangle",
    fallback: true,
    fallbackReason: "image could not be processed — check file quality and format",
  };
}
