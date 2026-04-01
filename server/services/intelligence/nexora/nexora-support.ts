/* filepath: server/services/intelligence/nexora/nexora-support.ts
 * =====================================================================================
 * Nexora Support — DB-backed memory layer (Layer 9 upgrade)
 * All persistent state now lives in PostgreSQL, not flat files.
 * File paths kept as dev-mode backup only (never primary source of truth).
 * ===================================================================================== */

import crypto from "node:crypto";

import type {
  AdaptiveThresholds,
  ApprovalDecision,
  DealHunterSignalLike,
  HealthCheckResult,
  KnowledgeEntry,
  NexoraConfig,
  NormalizedAIDecision,
  RadarSignalLike,
  RetryCounter,
  ValidationResult,
  VectorUpsertResult,
} from "./nexora-types";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const DEFAULT_THRESHOLDS: AdaptiveThresholds = {
  strongMove: 72,
  criticalValue: 150000,
  highValue: 60000,
  bothMinValue: 120000,
  strongPipeline: 0.72,
  highIntentMin: 0.68,
  learningRate: 0.15,
};

const LOCK_KEY = "nexora_main";
const LOCK_TTL_MS = 15 * 60_000; // 15 minutes

type AuditStatus = "success" | "failed";
type RetryStats = Record<string, number>;
type DuplicateCheckResult = {
  isDuplicate: boolean;
  ambiguous: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};

const retryStats: RetryStats = {};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function nowIso(): string {
  return new Date().toISOString();
}

function sha(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function allowedAction(
  value: unknown,
): "pipeline" | "radar" | "both" | "hold" {
  const v = String(value ?? "").toLowerCase();
  if (v === "pipeline" || v === "radar" || v === "both" || v === "hold") {
    return v;
  }
  return "hold";
}

function allowedPriority(value: unknown): "critical" | "high" | "medium" | "low" {
  const v = String(value ?? "").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low") {
    return v;
  }
  return "low";
}

/* ─── Exported utilities ─────────────────────────────────────────────────── */

export function safeNumber(input: unknown, fallback = 0): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export function cleanText(input: unknown): string {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

export function canonicalizeUrl(input: unknown): string {
  const raw = cleanText(input);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    if (url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return "";
  }
}

export function normalizeCompany(input: unknown): string {
  return cleanText(input)
    .toLowerCase()
    .replace(/\b(pty ltd|pty|ltd|limited|inc|llc|co|company|corp|corporation)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function heuristicEmbedding(input: string, dims = 64): number[] {
  const vec = new Array(dims).fill(0);
  const text = cleanText(input).toLowerCase();
  if (!text) return vec;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    vec[i % dims] += ((code % 31) - 15) / 15;
  }
  const mag = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0));
  if (!mag) return vec;
  return vec.map((n) => n / mag);
}

export async function getSemanticEmbedding(
  input: string,
): Promise<{ vector: number[]; mode: "remote" | "heuristic" }> {
  const text = cleanText(input);
  if (!text) return { vector: heuristicEmbedding("empty"), mode: "heuristic" };

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  if (apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          data?: Array<{ embedding?: number[] }>;
        };
        const vector = json?.data?.[0]?.embedding;
        if (Array.isArray(vector) && vector.length) {
          return { vector, mode: "remote" };
        }
      }
    } catch {
      // fall through to heuristic
    }
  }

  return { vector: heuristicEmbedding(text), mode: "heuristic" };
}

export function getNexoraConfig(dryRun = false): NexoraConfig {
  return {
    env: (process.env.NODE_ENV === "production"
      ? "production"
      : process.env.NODE_ENV === "test"
        ? "staging"
        : "local") as NexoraConfig["env"],
    dryRun,
    approvalOnly: envBool("NEXORA_APPROVAL_ONLY", false),
    autoApproveCritical: envBool("NEXORA_AUTO_APPROVE_CRITICAL", true),
    autoPushDisabled: envBool("NEXORA_AUTO_PUSH_DISABLED", false),
    vectorSyncDisabled: envBool("NEXORA_VECTOR_SYNC_DISABLED", false),
    webhookDisabled: envBool("NEXORA_WEBHOOK_DISABLED", false),
    maxConcurrency: Math.max(1, Number(process.env.NEXORA_MAX_CONCURRENCY || 4)),
    maxRetriesPerOperation: Math.max(
      0,
      Number(process.env.NEXORA_MAX_RETRIES || 2),
    ),
    timeoutMs: {
      radarScan: Math.max(5_000, Number(process.env.NEXORA_TIMEOUT_RADAR || 45_000)),
      dealScan: Math.max(5_000, Number(process.env.NEXORA_TIMEOUT_DEAL || 45_000)),
      aiAnalysis: Math.max(5_000, Number(process.env.NEXORA_TIMEOUT_AI || 30_000)),
      vectorSync: Math.max(5_000, Number(process.env.NEXORA_TIMEOUT_VECTOR || 20_000)),
      webhook: Math.max(5_000, Number(process.env.NEXORA_TIMEOUT_WEBHOOK || 15_000)),
      pushAction: Math.max(5_000, Number(process.env.NEXORA_TIMEOUT_PUSH || 20_000)),
    },
  };
}

/* ─── DB helper ──────────────────────────────────────────────────────────── */

async function getDb() {
  const { db } = await import("../../../db");
  return db;
}

/* ─── ensureNexoraReady ──────────────────────────────────────────────────── */

export async function ensureNexoraReady(): Promise<void> {
  try {
    const db = await getDb();
    await db.execute("SELECT 1" as any);
  } catch (err) {
    console.error("[Nexora] DB connectivity check failed:", err);
    throw err;
  }
}

/* ─── Adaptive Thresholds (DB-backed) ───────────────────────────────────── */

export async function loadAdaptiveThresholds(): Promise<AdaptiveThresholds> {
  try {
    const db = await getDb();
    const { nexoraThresholds } = await import("../../../../shared/schema");
    const { eq, desc } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(nexoraThresholds)
      .where(eq(nexoraThresholds.isActive, true))
      .orderBy(desc(nexoraThresholds.version))
      .limit(1);

    if (rows.length === 0) return { ...DEFAULT_THRESHOLDS };

    const row = rows[0];
    return {
      strongMove: row.strongMove ?? DEFAULT_THRESHOLDS.strongMove,
      criticalValue: row.criticalValue ?? DEFAULT_THRESHOLDS.criticalValue,
      highValue: row.highValue ?? DEFAULT_THRESHOLDS.highValue,
      bothMinValue: row.bothMinValue ?? DEFAULT_THRESHOLDS.bothMinValue,
      strongPipeline: row.strongPipeline ?? DEFAULT_THRESHOLDS.strongPipeline,
      highIntentMin: row.highIntentMin ?? DEFAULT_THRESHOLDS.highIntentMin,
      learningRate: row.learningRate ?? DEFAULT_THRESHOLDS.learningRate,
    };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

/** @deprecated use loadAdaptiveThresholds */
export const loadThresholds = loadAdaptiveThresholds;

export async function saveAdaptiveThresholds(
  thresholds: AdaptiveThresholds,
  reason = "",
  winRate?: number,
  triggeredByOutcomes?: number,
): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraThresholds } = await import("../../../../shared/schema");
    const { eq, desc } = await import("drizzle-orm");

    // Get current max version
    const rows = await db
      .select({ version: nexoraThresholds.version })
      .from(nexoraThresholds)
      .orderBy(desc(nexoraThresholds.version))
      .limit(1);

    const nextVersion = (rows[0]?.version ?? 0) + 1;

    // Deactivate all existing active thresholds
    await db
      .update(nexoraThresholds)
      .set({ isActive: false })
      .where(eq(nexoraThresholds.isActive, true));

    // Insert new active version
    await db.insert(nexoraThresholds).values({
      version: nextVersion,
      ...thresholds,
      changeReason: reason,
      isActive: true,
      winRate: winRate ?? null,
      triggeredByOutcomes: triggeredByOutcomes ?? 0,
    });
  } catch (err) {
    console.error("[Nexora] Failed to save adaptive thresholds:", err);
  }
}

/** @deprecated use saveAdaptiveThresholds */
export const saveThresholds = (t: AdaptiveThresholds, r = "") =>
  saveAdaptiveThresholds(t, r);

/* ─── Knowledge Map (DB-backed) ──────────────────────────────────────────── */

export async function loadKnowledgeMap(): Promise<Map<string, KnowledgeEntry>> {
  try {
    const db = await getDb();
    const { nexoraKnowledge } = await import("../../../../shared/schema");

    const rows = await db.select().from(nexoraKnowledge);
    const map = new Map<string, KnowledgeEntry>();

    for (const row of rows) {
      map.set(row.entryKey, {
        companyKey: normalizeCompany(row.companyName ?? ""),
        signalType: row.signalType ?? "",
        city: row.city ?? "",
        industry: row.industry ?? "",
        action: (row.action as any) ?? "hold",
        priority: (row.priority as any) ?? "low",
        confidence: row.confidence ?? 0.5,
        winRate: row.winRate ?? 0.5,
        successCount: row.successCount ?? 0,
        failCount: row.failCount ?? 0,
        totalCount: row.totalCount ?? 0,
        lastUpdatedAt: row.lastUpdatedAt?.toISOString() ?? nowIso(),
      } as any);
    }

    return map;
  } catch {
    return new Map();
  }
}

export async function saveKnowledgeMap(
  map: Map<string, KnowledgeEntry>,
): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraKnowledge } = await import("../../../../shared/schema");
    const { sql: drizzleSql } = await import("drizzle-orm");

    for (const [entryKey, entry] of map.entries()) {
      const e = entry as any;
      await db
        .insert(nexoraKnowledge)
        .values({
          entryKey,
          companyName: e.companyKey ?? "",
          signalType: e.signalType ?? "",
          city: e.city ?? "",
          industry: e.industry ?? "",
          action: e.action ?? "hold",
          priority: e.priority ?? "low",
          confidence: e.confidence ?? 0.5,
          winRate: e.winRate ?? 0.5,
          successCount: e.successCount ?? 0,
          failCount: e.failCount ?? 0,
          totalCount: e.totalCount ?? 0,
          lastUpdatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: nexoraKnowledge.entryKey,
          set: {
            companyName: e.companyKey ?? "",
            signalType: e.signalType ?? "",
            city: e.city ?? "",
            industry: e.industry ?? "",
            action: e.action ?? "hold",
            priority: e.priority ?? "low",
            confidence: e.confidence ?? 0.5,
            winRate: e.winRate ?? 0.5,
            successCount: e.successCount ?? 0,
            failCount: e.failCount ?? 0,
            totalCount: e.totalCount ?? 0,
            lastUpdatedAt: drizzleSql`now()`,
          },
        });
    }
  } catch (err) {
    console.error("[Nexora] Failed to save knowledge map:", err);
  }
}

export async function upsertKnowledgeEntry(
  entryKey: string,
  updates: Partial<KnowledgeEntry>,
): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraKnowledge } = await import("../../../../shared/schema");
    const { sql: drizzleSql } = await import("drizzle-orm");

    const e = updates as any;
    await db
      .insert(nexoraKnowledge)
      .values({
        entryKey,
        companyName: e.companyKey ?? "",
        signalType: e.signalType ?? "",
        city: e.city ?? "",
        industry: e.industry ?? "",
        action: e.action ?? "hold",
        priority: e.priority ?? "low",
        confidence: e.confidence ?? 0.5,
        winRate: e.winRate ?? 0.5,
        successCount: e.successCount ?? 0,
        failCount: e.failCount ?? 0,
        totalCount: e.totalCount ?? 0,
        lastUpdatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: nexoraKnowledge.entryKey,
        set: {
          ...(e.companyKey != null ? { companyName: e.companyKey } : {}),
          ...(e.signalType != null ? { signalType: e.signalType } : {}),
          ...(e.action != null ? { action: e.action } : {}),
          ...(e.priority != null ? { priority: e.priority } : {}),
          ...(e.confidence != null ? { confidence: e.confidence } : {}),
          ...(e.winRate != null ? { winRate: e.winRate } : {}),
          ...(e.successCount != null ? { successCount: e.successCount } : {}),
          ...(e.failCount != null ? { failCount: e.failCount } : {}),
          ...(e.totalCount != null ? { totalCount: e.totalCount } : {}),
          lastUpdatedAt: drizzleSql`now()`,
        },
      });
  } catch (err) {
    console.error("[Nexora] Failed to upsert knowledge entry:", err);
  }
}

/* ─── Audit log (DB-backed) ─────────────────────────────────────────────── */

export async function createAuditLog(
  runId: string,
  event: string,
  payload: Record<string, unknown>,
  status: AuditStatus = "success",
): Promise<void> {
  try {
    const db = await getDb();
    const { auditLogs } = await import("../../../../shared/schema");

    await db.insert(auditLogs).values({
      actorType: "system",
      actorId: runId,
      action: event,
      entityType: "nexora_run",
      entityId: runId,
      metadataJson: { status, ...payload },
    });
  } catch {
    // Non-fatal — log to console as fallback
    console.log(`[NexoraAudit] ${event}`, { runId, status, ...payload });
  }
}

/** @deprecated use createAuditLog */
export const logAudit = createAuditLog;

/* ─── Review queue (DB-backed via outreachMessages) ─────────────────────── */

export async function pushReviewQueue(
  runId: string,
  queueType: string,
  signalId: string,
  companyName: string,
  payload: unknown,
): Promise<void> {
  try {
    const db = await getDb();
    const { outreachMessages } = await import("../../../../shared/schema");

    await db.insert(outreachMessages).values({
      threadId: `nexora_review_${runId}_${signalId}`,
      direction: "outbound",
      channel: "email",
      subject: `[Review Required] ${queueType}: ${companyName}`,
      body: JSON.stringify(payload),
      stage: 0,
      messageType: "intro",
      deliveryStatus: "draft",
      companyName,
      campaignKey: `nexora_review_${signalId}`,
      identityHash: sha(`review::${runId}::${signalId}`),
    } as any);
  } catch {
    // Non-fatal
  }
}

/* ─── Decision records (DB-backed) ──────────────────────────────────────── */

export async function upsertDecisionRecord(record: {
  runId: string;
  signalId: string;
  companyName: string;
  idempotencyKey: string;
  ruleDecision: unknown;
  ensembleDecision: unknown;
  finalDecision: unknown;
  pushedPipeline: boolean;
  pushedRadar: boolean;
  webhookSent: boolean;
  action?: string;
  priority?: string;
  confidence?: number;
  reasoning?: string;
  autoApproved?: boolean;
  outreachQueued?: boolean;
  anomalyFlagged?: boolean;
}): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraDecisions } = await import("../../../../shared/schema");

    const finalDec = (record.finalDecision as any) ?? {};

    await db.insert(nexoraDecisions).values({
      runId: record.runId,
      signalId: record.signalId,
      companyName: record.companyName,
      idempotencyKey: record.idempotencyKey,
      ruleDecision: record.ruleDecision as any,
      aiDecision: record.ensembleDecision as any,
      finalDecision: record.finalDecision as any,
      action: record.action ?? finalDec.action ?? "hold",
      priority: record.priority ?? finalDec.priority ?? "low",
      confidence: record.confidence ?? finalDec.confidence ?? 0,
      reasoning: record.reasoning ?? finalDec.reason ?? null,
      pushedPipeline: record.pushedPipeline,
      pushedRadar: record.pushedRadar,
      webhookSent: record.webhookSent,
      autoApproved: record.autoApproved ?? false,
      outreachQueued: record.outreachQueued ?? false,
      anomalyFlagged: record.anomalyFlagged ?? false,
    });
  } catch (err) {
    console.error("[Nexora] Failed to upsert decision record:", err);
  }
}

/** @deprecated use upsertDecisionRecord */
export const recordDecisionRecord = upsertDecisionRecord;

/* ─── Outcome learning update ────────────────────────────────────────────── */

export function computeOutcomeLearningUpdate(
  currentThresholds: AdaptiveThresholds,
  outcomes: Array<{ outcome: string; confidence?: number; dealValue?: number }>,
): { updated: AdaptiveThresholds; winRate: number; delta: number } {
  const wins = outcomes.filter((o) =>
    ["won", "meeting_booked", "replied"].includes(o.outcome),
  ).length;
  const total = outcomes.length;
  const winRate = total > 0 ? wins / total : 0.5;

  const lr = currentThresholds.learningRate;
  const delta = winRate - 0.5; // positive = performing well, negative = under-performing

  const updated: AdaptiveThresholds = {
    ...currentThresholds,
    strongMove: Math.max(
      50,
      Math.min(95, currentThresholds.strongMove - delta * lr * 10),
    ),
    strongPipeline: Math.max(
      0.5,
      Math.min(0.95, currentThresholds.strongPipeline - delta * lr * 0.1),
    ),
    highIntentMin: Math.max(
      0.4,
      Math.min(0.9, currentThresholds.highIntentMin - delta * lr * 0.1),
    ),
  };

  return { updated, winRate, delta };
}

/* ─── Signal fingerprinting ─────────────────────────────────────────────── */

export function computeSignalFingerprint(
  signal: DealHunterSignalLike,
  action: string,
): string {
  const company = normalizeCompany(signal.companyName);
  const url = canonicalizeUrl(signal.sourceUrl);
  const type = cleanText(signal.signalType).toLowerCase();
  return sha(`${action}::${company}::${url}::${type}`);
}

/** @deprecated use computeSignalFingerprint */
export const getIdempotencyKey = computeSignalFingerprint;

/* ─── Idempotency keys (DB-backed) ──────────────────────────────────────── */

export async function claimIdempotencyKey(
  key: string,
  action: string,
  signalId: string,
  companyName: string,
): Promise<boolean> {
  try {
    const db = await getDb();
    const { nexoraIdempotencyKeys } = await import("../../../../shared/schema");

    // Expire stale claimed keys older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { lt, eq: deq, and: dand } = await import("drizzle-orm");
    await db
      .delete(nexoraIdempotencyKeys)
      .where(
        dand(
          deq(nexoraIdempotencyKeys.status, "claimed"),
          lt(nexoraIdempotencyKeys.claimedAt, twoHoursAgo),
        ),
      );

    // Try to insert — unique constraint on idem_key prevents duplicates
    await db.insert(nexoraIdempotencyKeys).values({
      idemKey: key,
      action,
      signalId,
      companyName,
      status: "claimed",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return true;
  } catch {
    // Unique constraint violation = already claimed
    return false;
  }
}

export async function completeIdempotencyKey(
  key: string,
  status: "completed" | "failed",
): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraIdempotencyKeys } = await import("../../../../shared/schema");
    const { eq } = await import("drizzle-orm");

    await db
      .update(nexoraIdempotencyKeys)
      .set({ status, completedAt: new Date() })
      .where(eq(nexoraIdempotencyKeys.idemKey, key));
  } catch {
    // Non-fatal
  }
}

/* ─── Run locks (DB-backed) ─────────────────────────────────────────────── */

export async function acquireRunLock(runId: string): Promise<boolean> {
  try {
    const db = await getDb();
    const { nexoraRunLocks } = await import("../../../../shared/schema");
    const { eq, lt } = await import("drizzle-orm");

    // Clean up expired locks first
    await db
      .delete(nexoraRunLocks)
      .where(lt(nexoraRunLocks.expiresAt, new Date()));

    // Also release any stale active locks
    await db
      .delete(nexoraRunLocks)
      .where(eq(nexoraRunLocks.lockKey, LOCK_KEY));

    // Check if a fresh lock exists (re-check after cleanup)
    const existing = await db
      .select()
      .from(nexoraRunLocks)
      .where(eq(nexoraRunLocks.lockKey, LOCK_KEY))
      .limit(1);

    if (existing.length > 0) return false;

    // Insert new lock
    const expiresAt = new Date(Date.now() + LOCK_TTL_MS);
    await db.insert(nexoraRunLocks).values({
      lockKey: LOCK_KEY,
      runId,
      expiresAt,
      status: "active",
    });

    return true;
  } catch {
    return false;
  }
}

export async function releaseRunLock(runId: string): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraRunLocks } = await import("../../../../shared/schema");
    const { eq, and } = await import("drizzle-orm");

    await db
      .delete(nexoraRunLocks)
      .where(
        and(
          eq(nexoraRunLocks.lockKey, LOCK_KEY),
          eq(nexoraRunLocks.runId, runId),
        ),
      );
  } catch {
    // Non-fatal
  }
}

/* ─── Webhook (Layer 2 — durable outbound action) ───────────────────────── */

export async function fireWebhook(
  url: string,
  payload: Record<string, unknown>,
  config: NexoraConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (config.webhookDisabled || !url) return { sent: false };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs.webhook);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nexora-Agent": "1" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    return { sent: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err: any) {
    return { sent: false, error: err?.message ?? "webhook_failed" };
  }
}

/* ─── Vector sync ───────────────────────────────────────────────────────── */

export async function syncVectorKnowledge(
  key: string,
  vector: number[],
  metadata: Record<string, unknown>,
  config: NexoraConfig,
): Promise<VectorUpsertResult> {
  return upsertToVectorDB(key, vector, metadata, config);
}

export async function upsertToVectorDB(
  _key: string,
  _vector: number[],
  _metadata: Record<string, unknown>,
  config: NexoraConfig,
): Promise<VectorUpsertResult> {
  if (config.vectorSyncDisabled) {
    return {
      attempted: false,
      pineconeAttempted: false,
      pineconeSucceeded: false,
      weaviateAttempted: false,
      weaviateSucceeded: false,
      errors: [],
    };
  }

  return {
    attempted: true,
    pineconeAttempted: false,
    pineconeSucceeded: false,
    weaviateAttempted: false,
    weaviateSucceeded: false,
    errors: [],
  };
}

/* ─── Health check ──────────────────────────────────────────────────────── */

export async function runHealthChecks(
  _config: NexoraConfig,
): Promise<HealthCheckResult> {
  let dbOk = false;
  let dbReason = "not checked";

  try {
    const db = await getDb();
    await db.execute("SELECT 1" as any);
    dbOk = true;
    dbReason = "connected";
  } catch (err: any) {
    dbReason = err?.message ?? "failed";
  }

  const checks: HealthCheckResult["checks"] = {
    database: { ok: dbOk, reason: dbReason },
    data_dir: { ok: true, reason: "db-backed (no filesystem dependency)" },
  };

  return {
    ok: Object.values(checks).every((c) => c.ok),
    checks,
  };
}

/* ─── Retry infrastructure ───────────────────────────────────────────────── */

export function resetRetryStats(): void {
  for (const key of Object.keys(retryStats)) delete retryStats[key];
}

export function getRetryStatsSnapshot(): Record<string, number> {
  return { ...retryStats };
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "operation",
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function withIntelligentRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  maxRetries: number,
  retryCounter: RetryCounter,
  timeoutMs?: number,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const p = fn();
      return timeoutMs
        ? await withTimeout(p, timeoutMs, operation)
        : await p;
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries) break;
      retryCounter.value += 1;
      retryStats[operation] = (retryStats[operation] ?? 0) + 1;
      await sleep(Math.min(2500, 250 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${operation} failed`);
}

/* ─── Signal validation ─────────────────────────────────────────────────── */

function daysSince(input: unknown): number | null {
  const raw = cleanText(input);
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

function computeDuplicateKey(
  companyKey: string,
  signalType: string,
  sourceUrl: string,
): string {
  return sha(`${companyKey}::${signalType}::${sourceUrl}`);
}

export async function validateSignal(
  signal: DealHunterSignalLike,
): Promise<ValidationResult> {
  const companyKey = normalizeCompany(signal.companyName);
  const sourceUrl = canonicalizeUrl(signal.sourceUrl);
  const signalType = cleanText(signal.signalType).toLowerCase();
  const freshnessDays = daysSince((signal as any).sourcePublishedAt);

  const results = {
    company: { passed: Boolean(companyKey) },
    sourceUrl: { passed: Boolean(sourceUrl) },
    signalType: { passed: Boolean(signalType) },
    freshness: {
      passed: freshnessDays == null || freshnessDays <= 365,
      value: freshnessDays,
    },
  };

  const overallValid =
    results.company.passed &&
    results.sourceUrl.passed &&
    results.signalType.passed &&
    results.freshness.passed;

  return {
    overallValid,
    results,
    canonicalCompanyKey: companyKey,
    duplicateKey: computeDuplicateKey(companyKey, signalType, sourceUrl),
    freshnessDays,
    sourceDomain: (() => {
      try {
        return new URL(sourceUrl).hostname.toLowerCase();
      } catch {
        return "";
      }
    })(),
    signalTypeNormalized: signalType,
  };
}

export function checkDuplicateAgainstKnowledge(
  signal: DealHunterSignalLike,
  knowledgeMap: Map<string, KnowledgeEntry>,
): DuplicateCheckResult {
  const companyKey = normalizeCompany(signal.companyName);
  const sourceUrl = canonicalizeUrl(signal.sourceUrl);
  const signalType = cleanText(signal.signalType).toLowerCase();
  const duplicateKey = computeDuplicateKey(companyKey, signalType, sourceUrl);

  if (knowledgeMap.has(duplicateKey)) {
    return {
      isDuplicate: true,
      ambiguous: false,
      reason: "exact_duplicate",
      evidence: { duplicateKey },
    };
  }

  const fingerprint = sha(
    `${companyKey}::${signalType}::${sourceUrl}::${cleanText(
      (signal as any).sourceTitle,
    )}`,
  );

  for (const [, entry] of knowledgeMap) {
    const e = entry as any;
    if (Array.isArray(e?.seenFingerprints) && e.seenFingerprints.includes(fingerprint)) {
      return {
        isDuplicate: true,
        ambiguous: false,
        reason: "fingerprint_duplicate",
        evidence: { fingerprint },
      };
    }
  }

  return { isDuplicate: false, ambiguous: false };
}

/* ─── Rule-based decision engine ────────────────────────────────────────── */

export function buildRuleDecision(
  signal: DealHunterSignalLike,
  radarMatch: RadarSignalLike | null,
  thresholds: AdaptiveThresholds,
  knowledgeMatch: KnowledgeEntry | null,
): NormalizedAIDecision {
  const estimatedValue = safeNumber((signal as any).estimatedProjectValue);
  const strength = clamp01(safeNumber((signal as any).signalStrengthScore) / 100);
  const radarScore = clamp01(safeNumber((radarMatch as any)?.radarScore) / 100);
  const winRate = clamp01(safeNumber((knowledgeMatch as any)?.winRate, 0.5));

  const composite =
    strength * 0.45 +
    radarScore * 0.25 +
    winRate * 0.15 +
    (estimatedValue >= thresholds.highValue ? 0.15 : 0);

  let action: NormalizedAIDecision["action"] = "hold";
  let priority: NormalizedAIDecision["priority"] = "low";

  if (estimatedValue >= thresholds.criticalValue || composite >= 0.88) {
    action = "both";
    priority = "critical";
  } else if (
    estimatedValue >= thresholds.bothMinValue &&
    composite >= thresholds.strongPipeline
  ) {
    action = "both";
    priority = "high";
  } else if (
    estimatedValue >= thresholds.highValue ||
    composite >= thresholds.strongPipeline
  ) {
    action = "pipeline";
    priority = "high";
  } else if (
    radarMatch ||
    composite >= thresholds.highIntentMin ||
    radarScore >= 0.6
  ) {
    action = "radar";
    priority = "medium";
  }

  return {
    action,
    priority,
    confidence: clamp01(composite),
    reason: `rule_decision(value=${estimatedValue},strength=${strength.toFixed(
      2,
    )},radar=${radarScore.toFixed(2)},winRate=${winRate.toFixed(2)})`,
  };
}

export function normalizeAIDecision(
  aiOutput: unknown,
  fallback: NormalizedAIDecision,
): NormalizedAIDecision {
  const obj = (aiOutput ?? {}) as Record<string, unknown>;
  return {
    action: allowedAction(obj.action ?? fallback.action),
    priority: allowedPriority(obj.priority ?? fallback.priority),
    reason: cleanText(obj.reason || fallback.reason),
    confidence: clamp01(safeNumber(obj.confidence, fallback.confidence)),
  };
}

export function finalizeDecision(
  ruleDecision: NormalizedAIDecision,
  candidate: NormalizedAIDecision,
): NormalizedAIDecision {
  if ((candidate?.confidence ?? 0) >= (ruleDecision?.confidence ?? 0)) {
    return candidate;
  }
  return ruleDecision;
}

export function detectAnomaly(
  signal: DealHunterSignalLike,
  winRate: number,
): boolean {
  const estimatedValue = safeNumber((signal as any).estimatedProjectValue);
  const strength = safeNumber((signal as any).signalStrengthScore);
  return estimatedValue >= 250000 && strength < 35 && winRate < 0.35;
}

export async function requireApproval(
  _runId: string,
  signal: DealHunterSignalLike,
  action: string,
  decision: NormalizedAIDecision,
  config: NexoraConfig,
): Promise<ApprovalDecision> {
  if (config.dryRun) {
    return { allowed: false, reason: "dry_run", requiresHuman: false };
  }

  if (config.approvalOnly) {
    return { allowed: false, reason: "approval_only", requiresHuman: true };
  }

  if (
    config.autoApproveCritical &&
    decision.priority === "critical" &&
    action !== "webhook"
  ) {
    return { allowed: true, reason: "auto_approved_critical", requiresHuman: false };
  }

  const estimatedValue = safeNumber((signal as any).estimatedProjectValue);
  if (estimatedValue >= 300000) {
    return { allowed: false, reason: "high_value_human_gate", requiresHuman: true };
  }

  return { allowed: true, reason: "approved", requiresHuman: false };
}

/* ─── Outcome success rate (DB-backed) ──────────────────────────────────── */

export async function getOutcomeSuccessRate(companyName: string): Promise<number> {
  try {
    const db = await getDb();
    const { nexoraKnowledge } = await import("../../../../shared/schema");
    const { sql: drizzleSql } = await import("drizzle-orm");

    const companyKey = normalizeCompany(companyName);

    const rows = await db
      .select({
        winRate: nexoraKnowledge.winRate,
        totalCount: nexoraKnowledge.totalCount,
      })
      .from(nexoraKnowledge)
      .where(
        drizzleSql`lower(trim(${nexoraKnowledge.companyName})) = ${companyKey}`,
      );

    if (rows.length === 0) return 0.5;

    const totalHits = rows.reduce(
      (acc, r) => acc + clamp01(r.winRate ?? 0.5),
      0,
    );
    return totalHits / rows.length;
  } catch {
    return 0.5;
  }
}

/* ─── Startup: expire stale locks ────────────────────────────────────────── */

export async function cleanupExpiredLocks(): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraRunLocks, nexoraIdempotencyKeys } = await import("../../../../shared/schema");
    const { lt } = await import("drizzle-orm");

    await Promise.all([
      db.delete(nexoraRunLocks).where(lt(nexoraRunLocks.expiresAt, new Date())),
      db
        .delete(nexoraIdempotencyKeys)
        .where(lt(nexoraIdempotencyKeys.expiresAt, new Date())),
    ]);
  } catch {
    // Non-fatal on startup
  }
}

/* ─── Legacy aliases (backward compat) ──────────────────────────────────── */

/** @deprecated */
export async function initNexoraDataSource(): Promise<void> {
  await cleanupExpiredLocks();
}
