import OpenAI from "openai";
import { db } from "../db";
import { productDrafts, uploadQueue, productCategories } from "../../shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface AiProductData {
  sku?: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  tags: string[];
  imageAltText: string;
  seoTitle: string;
  seoDescription: string;
  categoryName: string;
  subcategoryName: string;
  style: string;
  commercialUseCase: string;
  productType: string;
  aiConfidenceScore: number;
  marketAppealScore: number;
  commercialRelevanceScore: number;
  visualQualityScore: number;
  brandFitScore: number;
  overallAiScore: number;
  publishReadiness: "ready" | "publish" | "review" | "hold_back";
  notes?: string;
}

function scoreToReadiness(score: number): "ready" | "publish" | "review" | "hold_back" {
  if (score >= 85) return "ready";
  if (score >= 70) return "publish";
  if (score >= 50) return "review";
  return "hold_back";
}

export async function generateProductWithAI(params: {
  filename: string;
  productHint?: string;
  imageUrl?: string;
  rawText?: string;
}): Promise<AiProductData> {
  const systemPrompt = `You are an expert product copywriter and merchandise analyst for The Corporate Desk — a premium commercial office furniture company in Australia.

Your task is to analyse uploaded product information and generate complete, premium product content in Australian English.

Rules:
- Write in premium, commercial, clear Australian English
- Do not invent specifications you cannot confirm
- Mark uncertain fields with [unconfirmed]
- Focus on commercial office environments (law firms, tech companies, corporates)
- Output valid JSON only`;

  const userPrompt = `Analyse this office furniture product and generate complete product content.

Filename: ${params.filename}
${params.productHint ? `Hint: ${params.productHint}` : ""}
${params.rawText ? `Text content: ${params.rawText}` : ""}

Return this exact JSON structure:
{
  "sku": "auto-generated SKU or null if unknown",
  "title": "premium product title",
  "shortDescription": "1–2 sentence commercial description",
  "fullDescription": "3–4 paragraph premium description",
  "features": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "tags": ["tag1", "tag2", "tag3"],
  "imageAltText": "descriptive alt text",
  "seoTitle": "SEO-optimised title (max 60 chars)",
  "seoDescription": "SEO meta description (max 155 chars)",
  "categoryName": "primary category (e.g. Executive Desks, Task Chairs, Reception)",
  "subcategoryName": "subcategory",
  "style": "style label (e.g. Contemporary, Executive, Industrial)",
  "commercialUseCase": "primary use case",
  "productType": "product type",
  "aiConfidenceScore": 0.85,
  "marketAppealScore": 0.8,
  "commercialRelevanceScore": 0.85,
  "visualQualityScore": 0.7,
  "brandFitScore": 0.9,
  "notes": "any quality notes or uncertainty flags"
}`;

  let aiRaw: any = null;
  try {
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: params.imageUrl ? [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: params.imageUrl } },
      ] : userPrompt },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    aiRaw = JSON.parse(content);
  } catch (e: any) {
    console.error("[ProductAI] OpenAI error:", e.message);
    // Return fallback data
    aiRaw = {
      title: params.productHint ?? params.filename.replace(/\.[^.]+$/, ""),
      shortDescription: "Premium commercial office furniture suitable for modern workplaces.",
      fullDescription: "This high-quality office furniture piece is designed for commercial environments. Built to withstand the demands of busy workplaces while maintaining a professional aesthetic.",
      features: ["Commercial grade construction", "Contemporary design", "Suitable for open-plan offices", "Easy assembly"],
      tags: ["office furniture", "commercial", "workspace"],
      imageAltText: "Office furniture product",
      seoTitle: params.productHint ?? "Office Furniture | The Corporate Desk",
      seoDescription: "Premium office furniture for Australian commercial workplaces.",
      categoryName: "Office Furniture",
      subcategoryName: "General",
      style: "Contemporary",
      commercialUseCase: "General office use",
      productType: "Furniture",
      aiConfidenceScore: 0.4,
      marketAppealScore: 0.5,
      commercialRelevanceScore: 0.5,
      visualQualityScore: 0.4,
      brandFitScore: 0.5,
      notes: "AI processing failed — manual review required",
    };
  }

  const scores = {
    aiConfidenceScore: Number(aiRaw.aiConfidenceScore ?? 0.5),
    marketAppealScore: Number(aiRaw.marketAppealScore ?? 0.5),
    commercialRelevanceScore: Number(aiRaw.commercialRelevanceScore ?? 0.5),
    visualQualityScore: Number(aiRaw.visualQualityScore ?? 0.4),
    brandFitScore: Number(aiRaw.brandFitScore ?? 0.5),
  };

  const overallAiScore = Math.round(
    (scores.aiConfidenceScore * 0.2 +
      scores.marketAppealScore * 0.25 +
      scores.commercialRelevanceScore * 0.25 +
      scores.visualQualityScore * 0.15 +
      scores.brandFitScore * 0.15) * 100
  );

  return {
    sku: aiRaw.sku ?? null,
    title: aiRaw.title ?? "Untitled Product",
    shortDescription: aiRaw.shortDescription ?? "",
    fullDescription: aiRaw.fullDescription ?? "",
    features: Array.isArray(aiRaw.features) ? aiRaw.features : [],
    tags: Array.isArray(aiRaw.tags) ? aiRaw.tags : [],
    imageAltText: aiRaw.imageAltText ?? "",
    seoTitle: aiRaw.seoTitle ?? "",
    seoDescription: aiRaw.seoDescription ?? "",
    categoryName: aiRaw.categoryName ?? "Office Furniture",
    subcategoryName: aiRaw.subcategoryName ?? "General",
    style: aiRaw.style ?? "Contemporary",
    commercialUseCase: aiRaw.commercialUseCase ?? "",
    productType: aiRaw.productType ?? "Furniture",
    ...scores,
    overallAiScore,
    publishReadiness: scoreToReadiness(overallAiScore),
    notes: aiRaw.notes,
  };
}

export async function processUploadQueueItem(uploadId: string): Promise<void> {
  const [upload] = await db.select().from(uploadQueue).where(eq(uploadQueue.id, uploadId));
  if (!upload) throw new Error("Upload not found: " + uploadId);

  await db.update(uploadQueue).set({ aiStatus: "running", uploadStatus: "processing" }).where(eq(uploadQueue.id, uploadId));

  try {
    const data = await generateProductWithAI({
      filename: upload.originalName,
      imageUrl: upload.fileUrl ?? undefined,
    });

    const [draft] = await db.insert(productDrafts).values({
      uploadQueueId: upload.id,
      sku: data.sku,
      title: data.title,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      features: data.features,
      tags: data.tags,
      imageAltText: data.imageAltText,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      categoryName: data.categoryName,
      subcategoryName: data.subcategoryName,
      style: data.style,
      commercialUseCase: data.commercialUseCase,
      productType: data.productType,
      imageUrl: upload.fileUrl,
      aiConfidenceScore: data.aiConfidenceScore,
      marketAppealScore: data.marketAppealScore,
      commercialRelevanceScore: data.commercialRelevanceScore,
      visualQualityScore: data.visualQualityScore,
      brandFitScore: data.brandFitScore,
      overallAiScore: data.overallAiScore,
      publishReadiness: data.publishReadiness,
      status: data.overallAiScore >= 70 ? "ready" : data.overallAiScore >= 50 ? "review" : "needs_data",
      reviewNotes: data.notes,
      aiRaw: data as any,
    }).returning({ id: productDrafts.id });

    await db.update(uploadQueue).set({
      aiStatus: "done",
      uploadStatus: "done",
      detectedSku: data.sku ?? null,
      processingResult: { draftId: draft.id, title: data.title, score: data.overallAiScore } as any,
    }).where(eq(uploadQueue.id, uploadId));

    console.log(`[ProductAI] Processed upload ${uploadId} → draft ${draft.id} | score: ${data.overallAiScore}`);
  } catch (e: any) {
    await db.update(uploadQueue).set({ aiStatus: "error", uploadStatus: "error", errorMessage: e.message }).where(eq(uploadQueue.id, uploadId));
    throw e;
  }
}

export async function regenerateProductContent(draftId: string): Promise<void> {
  const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, draftId));
  if (!draft) throw new Error("Draft not found: " + draftId);

  await db.update(productDrafts).set({ status: "processing" }).where(eq(productDrafts.id, draftId));

  const data = await generateProductWithAI({
    filename: draft.title,
    productHint: draft.title,
    imageUrl: draft.imageUrl ?? undefined,
  });

  await db.update(productDrafts).set({
    title: data.title,
    shortDescription: data.shortDescription,
    fullDescription: data.fullDescription,
    features: data.features,
    tags: data.tags,
    imageAltText: data.imageAltText,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    aiConfidenceScore: data.aiConfidenceScore,
    marketAppealScore: data.marketAppealScore,
    commercialRelevanceScore: data.commercialRelevanceScore,
    visualQualityScore: data.visualQualityScore,
    brandFitScore: data.brandFitScore,
    overallAiScore: data.overallAiScore,
    publishReadiness: data.publishReadiness,
    reviewNotes: data.notes,
    status: data.overallAiScore >= 70 ? "ready" : "review",
    aiRaw: data as any,
    updatedAt: new Date(),
  }).where(eq(productDrafts.id, draftId));
}

export async function getProductStats() {
  const all = await db.select({
    status: productDrafts.status,
    publishReadiness: productDrafts.publishReadiness,
    isLive: productDrafts.isLive,
    overallAiScore: productDrafts.overallAiScore,
  }).from(productDrafts);

  const stats = {
    total: all.length,
    live: all.filter(p => p.isLive).length,
    ready: all.filter(p => p.publishReadiness === "ready" || p.publishReadiness === "publish").length,
    review: all.filter(p => p.status === "review").length,
    needsData: all.filter(p => p.status === "needs_data").length,
    holdBack: all.filter(p => p.publishReadiness === "hold_back").length,
    processing: all.filter(p => p.status === "processing" || p.status === "new").length,
    avgScore: all.length > 0 ? Math.round(all.reduce((s, p) => s + (p.overallAiScore ?? 0), 0) / all.length) : 0,
  };

  const uploads = await db.select({ aiStatus: uploadQueue.aiStatus }).from(uploadQueue);
  const uploadStats = { total: uploads.length, processing: uploads.filter(u => u.aiStatus === "running").length, done: uploads.filter(u => u.aiStatus === "done").length };

  return { ...stats, uploads: uploadStats };
}

export async function ensureDefaultCategories(): Promise<void> {
  const defaults = [
    { name: "Executive Desks", slug: "executive-desks", sortOrder: 1 },
    { name: "Task Chairs", slug: "task-chairs", sortOrder: 2 },
    { name: "Reception", slug: "reception", sortOrder: 3 },
    { name: "Collaborative Furniture", slug: "collaborative-furniture", sortOrder: 4 },
    { name: "Storage Solutions", slug: "storage-solutions", sortOrder: 5 },
    { name: "Meeting Tables", slug: "meeting-tables", sortOrder: 6 },
    { name: "Workstations", slug: "workstations", sortOrder: 7 },
    { name: "Lounge & Breakout", slug: "lounge-breakout", sortOrder: 8 },
    { name: "Accessories", slug: "accessories", sortOrder: 9 },
  ];
  for (const cat of defaults) {
    await db.insert(productCategories).values({ ...cat, isActive: true }).onConflictDoNothing();
  }
}
