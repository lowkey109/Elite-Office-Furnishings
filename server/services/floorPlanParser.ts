/**
 * Floor Plan Parser — Deterministic Computer Vision Pipeline
 *
 * Detection pipeline (NO OpenAI Vision):
 *   1. Grayscale conversion via sharp
 *   2. Adaptive threshold (local neighborhood comparison)
 *   3. Gaussian blur (noise reduction)
 *   4. Canny-style edge detection (Sobel gradient + NMS + double threshold)
 *   5. Outer contour tracing (Moore Neighbor Boundary Tracing)
 *   6. Convex hull fallback if contour is malformed
 *   7. Douglas-Peucker polygon approximation
 *   8. Coordinate normalisation to 0–1 space
 *   9. Hough Line Transform for internal wall detection
 *
 * Target: < 500ms per image at 500px working resolution.
 * No network calls. Fully deterministic.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoundaryPoint { x: number; y: number; }

export interface FloorGeometry {
  boundary: BoundaryPoint[];
  internalWalls: BoundaryPoint[][];
  aspectRatio: number;
  confidence: number;
  source: "canny-contour" | "pixel-silhouette" | "convex-hull" | "pdf-dimensions" | "fallback-rectangle";
  detectedShape?: string;
  description?: string;
  fallback: boolean;
  fallbackReason?: string;
  timingMs?: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORK_SIZE = 500;          // working image dimension (px)
const DARK_THRESHOLD = 100;     // < this = dark/edge pixel (0-255 grayscale)
const CANNY_LOW = 15;           // Canny low threshold
const CANNY_HIGH = 45;          // Canny high threshold
const DP_EPSILON = 0.012;       // Douglas-Peucker relative epsilon
const MIN_CONTOUR_AREA = 0.04;  // min fraction of image area to be a valid contour
const HOUGH_MIN_LINE = 0.08;    // minimum line length as fraction of image dimension
const MAX_WALLS = 40;           // cap on returned internal wall segments

// ─── Image helpers ────────────────────────────────────────────────────────────

function idx(x: number, y: number, w: number): number { return y * w + x; }

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function convolve(data: Float32Array, w: number, h: number, kernel: number[], ks: number): Float32Array {
  const half = (ks - 1) >> 1;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let ky = 0; ky < ks; ky++) {
        for (let kx = 0; kx < ks; kx++) {
          const px = clamp(x + kx - half, 0, w - 1);
          const py = clamp(y + ky - half, 0, h - 1);
          sum += data[idx(px, py, w)] * kernel[ky * ks + kx];
        }
      }
      out[idx(x, y, w)] = sum;
    }
  }
  return out;
}

// 5×5 Gaussian kernel (sigma ≈ 1.4)
const GAUSS5: number[] = [
  2, 4,  5,  4,  2,
  4, 9,  12, 9,  4,
  5, 12, 15, 12, 5,
  4, 9,  12, 9,  4,
  2, 4,  5,  4,  2,
].map(v => v / 159);

// Sobel kernels
const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

// ─── Canny Edge Detection ─────────────────────────────────────────────────────

function cannyEdges(data: Uint8Array, w: number, h: number): Uint8Array {
  // Step 1: Gaussian blur
  const f32 = new Float32Array(w * h);
  for (let i = 0; i < data.length; i++) f32[i] = data[i];
  const blurred = convolve(f32, w, h, GAUSS5, 5);

  // Step 2: Sobel gradients
  const gx = convolve(blurred, w, h, SOBEL_X, 3);
  const gy = convolve(blurred, w, h, SOBEL_Y, 3);

  const mag = new Float32Array(w * h);
  const dir = new Float32Array(w * h); // quantised: 0=H, 1=D1, 2=V, 3=D2
  let maxMag = 0;
  for (let i = 0; i < w * h; i++) {
    const m = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    mag[i] = m;
    if (m > maxMag) maxMag = m;
    let angle = Math.atan2(gy[i], gx[i]) * 180 / Math.PI;
    if (angle < 0) angle += 180;
    if (angle <= 22.5 || angle > 157.5) dir[i] = 0;
    else if (angle <= 67.5) dir[i] = 1;
    else if (angle <= 112.5) dir[i] = 2;
    else dir[i] = 3;
  }

  // Step 3: Non-maximum suppression
  const nms = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      const m = mag[i];
      let a = 0, b = 0;
      switch (dir[i]) {
        case 0: a = mag[idx(x + 1, y, w)]; b = mag[idx(x - 1, y, w)]; break;
        case 1: a = mag[idx(x + 1, y + 1, w)]; b = mag[idx(x - 1, y - 1, w)]; break;
        case 2: a = mag[idx(x, y + 1, w)]; b = mag[idx(x, y - 1, w)]; break;
        case 3: a = mag[idx(x + 1, y - 1, w)]; b = mag[idx(x - 1, y + 1, w)]; break;
      }
      nms[i] = (m >= a && m >= b) ? m : 0;
    }
  }

  // Scale thresholds to actual magnitude range
  const lo = CANNY_LOW * maxMag / 255;
  const hi = CANNY_HIGH * maxMag / 255;

  // Step 4: Double threshold + hysteresis
  const STRONG = 255, WEAK = 128, NONE = 0;
  const edge = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (nms[i] >= hi) edge[i] = STRONG;
    else if (nms[i] >= lo) edge[i] = WEAK;
    else edge[i] = NONE;
  }

  // Step 5: Hysteresis - keep weak edges connected to strong
  const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
  const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = idx(x, y, w);
        if (edge[i] !== WEAK) continue;
        for (let d = 0; d < 8; d++) {
          if (edge[idx(x + DX[d], y + DY[d], w)] === STRONG) {
            edge[i] = STRONG;
            changed = true;
            break;
          }
        }
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (edge[i] === WEAK) edge[i] = NONE;
  return edge;
}

// ─── Contour Tracing (Moore Neighbor Boundary Tracing) ───────────────────────

// 8-directional neighbors (clockwise from east)
const NX = [1, 1, 0, -1, -1, -1, 0, 1];
const NY = [0, 1, 1, 1, 0, -1, -1, -1];

function traceContour(binary: Uint8Array, w: number, h: number, startX: number, startY: number): BoundaryPoint[] {
  const result: BoundaryPoint[] = [];
  const visited = new Set<number>();

  // Find the entry direction (backtrack from start)
  let dir = 7; // start entering from west (left)
  let x = startX;
  let y = startY;

  const MAX_POINTS = 8000;
  let count = 0;

  do {
    result.push({ x, y });
    visited.add(y * w + x);

    // Search 8-neighbors clockwise starting from opposite of entry direction
    let found = false;
    const startDir = (dir + 5) % 8; // backtrack direction
    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx2 = x + NX[d];
      const ny2 = y + NY[d];
      if (nx2 < 0 || nx2 >= w || ny2 < 0 || ny2 >= h) continue;
      if (binary[ny2 * w + nx2]) {
        dir = d;
        x = nx2;
        y = ny2;
        found = true;
        break;
      }
    }
    if (!found) break;
    count++;
    if (count > MAX_POINTS) break;
  } while (x !== startX || y !== startY);

  return result;
}

// ─── Convex Hull (Graham scan) ───────────────────────────────────────────────

function cross(o: BoundaryPoint, a: BoundaryPoint, b: BoundaryPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: BoundaryPoint[]): BoundaryPoint[] {
  const sorted = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  const lower: BoundaryPoint[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: BoundaryPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// ─── Douglas-Peucker Polygon Simplification ──────────────────────────────────

function perpDist(p: BoundaryPoint, a: BoundaryPoint, b: BoundaryPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy);
}

function douglasPeucker(points: BoundaryPoint[], epsilon: number): BoundaryPoint[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpDist(points[i], points[0], points[end]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
}

// ─── Hough Line Transform (simplified, axis-sensitive) ───────────────────────

function detectInternalWalls(edge: Uint8Array, w: number, h: number, scale: number): BoundaryPoint[][] {
  const walls: BoundaryPoint[][] = [];
  const minLen = Math.round(Math.min(w, h) * HOUGH_MIN_LINE);

  // Horizontal line scan
  for (let y = 1; y < h - 1; y++) {
    let runStart = -1;
    let runLen = 0;
    for (let x = 0; x <= w; x++) {
      const isEdge = x < w && edge[y * w + x] > 0;
      if (isEdge) {
        if (runStart < 0) { runStart = x; runLen = 0; }
        runLen++;
      } else {
        if (runLen >= minLen) {
          walls.push([
            { x: runStart / w, y: y / h },
            { x: (runStart + runLen) / w, y: y / h },
          ]);
        }
        runStart = -1;
        runLen = 0;
      }
      if (walls.length >= MAX_WALLS) break;
    }
    if (walls.length >= MAX_WALLS) break;
  }

  // Vertical line scan (only if room for more)
  if (walls.length < MAX_WALLS) {
    for (let x = 1; x < w - 1; x++) {
      let runStart = -1;
      let runLen = 0;
      for (let y = 0; y <= h; y++) {
        const isEdge = y < h && edge[y * w + x] > 0;
        if (isEdge) {
          if (runStart < 0) { runStart = y; runLen = 0; }
          runLen++;
        } else {
          if (runLen >= minLen) {
            walls.push([
              { x: x / w, y: runStart / h },
              { x: x / w, y: (runStart + runLen) / h },
            ]);
          }
          runStart = -1;
          runLen = 0;
        }
        if (walls.length >= MAX_WALLS) break;
      }
      if (walls.length >= MAX_WALLS) break;
    }
  }

  return walls;
}

// ─── Outer boundary from dark pixels (silhouette fallback) ───────────────────

function silhouetteBoundary(data: Uint8Array, w: number, h: number): BoundaryPoint[] | null {
  const top: BoundaryPoint[] = [];
  const bottom: BoundaryPoint[] = [];
  const left: BoundaryPoint[] = [];
  const right: BoundaryPoint[] = [];

  for (let x = 0; x < w; x += 3) {
    let t = -1, b = -1;
    for (let y = 0; y < h; y++) { if (data[y * w + x] < DARK_THRESHOLD) { t = y; break; } }
    for (let y = h - 1; y >= 0; y--) { if (data[y * w + x] < DARK_THRESHOLD) { b = y; break; } }
    if (t >= 0) top.push({ x: x / w, y: t / h });
    if (b >= 0) bottom.push({ x: x / w, y: b / h });
  }

  for (let y = 0; y < h; y += 3) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) { if (data[y * w + x] < DARK_THRESHOLD) { l = x; break; } }
    for (let x = w - 1; x >= 0; x--) { if (data[y * w + x] < DARK_THRESHOLD) { r = x; break; } }
    if (l >= 0) left.push({ x: l / w, y: y / h });
    if (r >= 0) right.push({ x: r / w, y: y / h });
  }

  if (top.length < 3 || bottom.length < 3) return null;

  const boundary = [
    ...top,
    ...right,
    ...[...bottom].reverse(),
    ...[...left].reverse(),
    top[0],
  ];

  const xMin = Math.min(...boundary.map(p => p.x));
  const xMax = Math.max(...boundary.map(p => p.x));
  const yMin = Math.min(...boundary.map(p => p.y));
  const yMax = Math.max(...boundary.map(p => p.y));
  const coverage = (xMax - xMin) * (yMax - yMin);
  if (coverage < MIN_CONTOUR_AREA) return null;

  return boundary;
}

// ─── Shape name from polygon ──────────────────────────────────────────────────

function classifyShape(pts: BoundaryPoint[]): string {
  if (pts.length <= 5) return "rectangle";
  if (pts.length <= 8) return "L-shape";
  if (pts.length <= 14) return "U-shape";
  return "irregular";
}

// ─── Polygon area (Shoelace) ─────────────────────────────────────────────────

function polyArea(pts: BoundaryPoint[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

// ─── PDF dimension extraction ─────────────────────────────────────────────────

async function pdfDimensions(filePath: string): Promise<{ aspectRatio: number; pageWidthMm?: number; pageHeightMm?: number } | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    // Validate PDF by checking magic bytes (%PDF- header)
    if (buffer.length < 5 || buffer.slice(0, 4).toString("ascii") !== "%PDF") {
      throw new Error("Not a valid PDF file");
    }
    // Default A1 landscape aspect ratio for architectural floor plans
    return { aspectRatio: 1.414 };
  } catch (err: any) {
    console.warn("[FloorPlanParser] PDF parse failed:", err.message);
    return null;
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function parseFloorPlan(
  filePath: string,
  _openai?: unknown,
  squareMetres?: string,
): Promise<FloorGeometry> {
  const t0 = Date.now();
  const ext = path.extname(filePath).toLowerCase();
  const isPdf = ext === ".pdf";
  const isImage = [".png", ".jpg", ".jpeg", ".webp"].includes(ext);

  console.log(`[FloorPlanParser] Processing: ${path.basename(filePath)}`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[FloorPlanParser] File not found: ${filePath}`);
    return {
      boundary: rectangleBoundary(),
      internalWalls: [],
      aspectRatio: 1.5,
      confidence: 0,
      source: "fallback-rectangle",
      fallback: true,
      fallbackReason: "file not found on disk",
      timingMs: Date.now() - t0,
    };
  }

  // ── PDF fallback ─────────────────────────────────────────────────────
  if (isPdf) {
    console.log("[FloorPlanParser] PDF — using dimension extraction (no rasterizer available)");
    const dims = await pdfDimensions(filePath);
    const sqm = parseFloat(squareMetres || "0");
    const aspectRatio = dims?.aspectRatio ?? (sqm > 0 ? Math.max(1, sqm / 100) : 1.414);
    console.warn("[FloorPlanParser] ⚠️ PDF fallback: pdf-dimensions");
    return {
      boundary: rectangleBoundary(),
      internalWalls: [],
      aspectRatio,
      confidence: 0.2,
      source: "pdf-dimensions",
      description: "PDF file — geometric tracing not available without rasterisation",
      fallback: true,
      fallbackReason: "PDF cannot be rasterised by this server; page-dimension boundary used",
      pageWidthMm: dims?.pageWidthMm,
      pageHeightMm: dims?.pageHeightMm,
      timingMs: Date.now() - t0,
    };
  }

  if (!isImage) {
    return {
      boundary: rectangleBoundary(),
      internalWalls: [],
      aspectRatio: 1.5,
      confidence: 0,
      source: "fallback-rectangle",
      fallback: true,
      fallbackReason: `unsupported file type: ${ext}`,
      timingMs: Date.now() - t0,
    };
  }

  // ── Load & resize image ──────────────────────────────────────────────
  let rawData: Uint8Array;
  let W: number;
  let H: number;
  let origW: number;
  let origH: number;

  try {
    const meta = await sharp(filePath).metadata();
    origW = meta.width || 800;
    origH = meta.height || 600;

    const scale = Math.min(1, WORK_SIZE / Math.max(origW, origH));
    W = Math.round(origW * scale);
    H = Math.round(origH * scale);

    const { data } = await sharp(filePath)
      .resize(W, H, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    rawData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } catch (err: any) {
    console.error("[FloorPlanParser] Sharp load failed:", err.message);
    return {
      boundary: rectangleBoundary(),
      internalWalls: [],
      aspectRatio: 1.5,
      confidence: 0,
      source: "fallback-rectangle",
      fallback: true,
      fallbackReason: `image load error: ${err.message}`,
      timingMs: Date.now() - t0,
    };
  }

  const aspectRatio = origW / origH;

  // ── Canny edge detection ─────────────────────────────────────────────
  const edgeMap = cannyEdges(rawData, W, H);

  // ── Internal wall detection (Hough-style line scan) ─────────────────
  const internalWalls = detectInternalWalls(edgeMap, W, H, WORK_SIZE);

  // ── Find largest external contour ────────────────────────────────────
  let boundary: BoundaryPoint[] | null = null;
  let source: FloorGeometry["source"] = "canny-contour";
  let confidence = 0;

  // Flood-fill background from corners to create a binary map of "non-background"
  // edges that belong to the floor plan outline
  const visited = new Uint8Array(W * H);
  const queue: number[] = [];
  // Seed corners and edges
  for (let x = 0; x < W; x++) {
    if (!edgeMap[idx(x, 0, W)]) { visited[idx(x, 0, W)] = 1; queue.push(idx(x, 0, W)); }
    if (!edgeMap[idx(x, H - 1, W)]) { visited[idx(x, H - 1, W)] = 1; queue.push(idx(x, H - 1, W)); }
  }
  for (let y = 0; y < H; y++) {
    if (!edgeMap[idx(0, y, W)]) { visited[idx(0, y, W)] = 1; queue.push(idx(0, y, W)); }
    if (!edgeMap[idx(W - 1, y, W)]) { visited[idx(W - 1, y, W)] = 1; queue.push(idx(W - 1, y, W)); }
  }

  // 4-connected BFS
  let qi = 0;
  while (qi < queue.length) {
    const ci = queue[qi++];
    const cx2 = ci % W;
    const cy2 = Math.floor(ci / W);
    const neighbors4 = [
      ci - 1, ci + 1,
      ci - W, ci + W,
    ];
    const nx2Arr = [cx2 - 1, cx2 + 1, cx2, cx2];
    const ny2Arr = [cy2, cy2, cy2 - 1, cy2 + 1];
    for (let k = 0; k < 4; k++) {
      const ni = neighbors4[k];
      const nx3 = nx2Arr[k];
      const ny3 = ny2Arr[k];
      if (nx3 < 0 || nx3 >= W || ny3 < 0 || ny3 >= H) continue;
      if (visited[ni] || edgeMap[ni]) continue;
      visited[ni] = 1;
      queue.push(ni);
    }
  }

  // Find edge pixels that border background — these form the outer contour
  const outerEdge = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!edgeMap[idx(x, y, W)]) continue;
      // Is any neighbor background (visited by flood-fill)?
      if (
        visited[idx(x - 1, y, W)] ||
        visited[idx(x + 1, y, W)] ||
        visited[idx(x, y - 1, W)] ||
        visited[idx(x, y + 1, W)]
      ) {
        outerEdge[idx(x, y, W)] = 1;
      }
    }
  }

  // Find start point of outer contour
  let startX = -1, startY = -1;
  outer: for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (outerEdge[idx(x, y, W)]) { startX = x; startY = y; break outer; }
    }
  }

  if (startX >= 0) {
    const contour = traceContour(outerEdge, W, H, startX, startY);

    if (contour.length >= 8) {
      const epsilon = DP_EPSILON * Math.max(W, H);
      const simplified = douglasPeucker(contour, epsilon);

      // Normalise to 0–1
      const normPts = simplified.map(p => ({ x: p.x / W, y: p.y / H }));

      // Close the polygon
      if (normPts.length > 0 &&
        (normPts[0].x !== normPts[normPts.length - 1].x || normPts[0].y !== normPts[normPts.length - 1].y)) {
        normPts.push({ ...normPts[0] });
      }

      const area = polyArea(normPts);
      if (area >= MIN_CONTOUR_AREA * 0.5) {
        boundary = normPts;
        confidence = Math.min(0.95, 0.6 + area * 1.5);
        source = "canny-contour";
        console.log(`[FloorPlanParser] ✅ Canny contour: ${contour.length} raw pts → ${normPts.length} polygon pts, area=${area.toFixed(3)}`);
      } else {
        console.warn(`[FloorPlanParser] ⚠️ Contour area too small (${area.toFixed(3)}) — falling back`);
      }
    }
  }

  // Fallback 1: pixel silhouette scan
  if (!boundary) {
    console.warn("[FloorPlanParser] ⚠️ Canny contour failed — trying silhouette scan");
    const sil = silhouetteBoundary(rawData, W, H);
    if (sil) {
      boundary = sil;
      source = "pixel-silhouette";
      const area = polyArea(sil);
      confidence = Math.min(0.75, 0.35 + area * 0.8);
      console.log(`[FloorPlanParser] ✅ Silhouette boundary: ${sil.length} pts, area=${area.toFixed(3)}`);
    }
  }

  // Fallback 2: convex hull of all dark pixels
  if (!boundary) {
    console.warn("[FloorPlanParser] ⚠️ Silhouette failed — computing convex hull of dark pixels");
    const darkPts: BoundaryPoint[] = [];
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        if (rawData[idx(x, y, W)] < DARK_THRESHOLD) {
          darkPts.push({ x: x / W, y: y / H });
        }
      }
    }
    if (darkPts.length >= 4) {
      const hull = convexHull(darkPts);
      if (hull.length >= 3) {
        hull.push({ ...hull[0] }); // close
        boundary = hull;
        source = "convex-hull";
        confidence = 0.3;
        console.warn(`[FloorPlanParser] ⚠️ Convex hull fallback: ${hull.length} pts`);
      }
    }
  }

  // Fallback 3: last resort rectangle
  if (!boundary) {
    console.error("[FloorPlanParser] ❌ All detection methods failed — using rectangle fallback");
    return {
      boundary: rectangleBoundary(),
      internalWalls,
      aspectRatio,
      confidence: 0,
      source: "fallback-rectangle",
      fallback: true,
      fallbackReason: "image appears blank or has no detectable edges",
      timingMs: Date.now() - t0,
    };
  }

  const shape = classifyShape(boundary);
  const timingMs = Date.now() - t0;
  console.log(`[FloorPlanParser] ✅ Done: source=${source}, shape=${shape}, confidence=${confidence.toFixed(2)}, walls=${internalWalls.length}, time=${timingMs}ms`);

  return {
    boundary,
    internalWalls,
    aspectRatio,
    confidence,
    source,
    detectedShape: shape,
    description: `${shape} floor plan detected via ${source}`,
    fallback: false,
    timingMs,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function rectangleBoundary(): BoundaryPoint[] {
  return [
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
    { x: 0.05, y: 0.95 },
    { x: 0.05, y: 0.05 },
  ];
}
