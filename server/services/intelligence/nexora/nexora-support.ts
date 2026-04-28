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
  NexoraDecisionAction,
  NexoraDecisionRecordLike,
  NexoraPriority,
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
  map: Map<string, KnowledgeEntry> | Record<string, KnowledgeEntry>,
): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraKnowledge } = await import("../../../../shared/schema");
    const { sql: drizzleSql } = await import("drizzle-orm");

    // Accept both Map instances and plain objects (the orchestrator normalises
    // the loaded Map to a plain Record before passing it back here).
    const entries: [string, KnowledgeEntry][] =
      map instanceof Map
        ? Array.from(map.entries())
        : Object.entries(map as Record<string, KnowledgeEntry>);

    for (const [entryKey, entry] of entries) {
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
  entry: KnowledgeEntry,
): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraKnowledge } = await import("../../../../shared/schema");
    const { sql: drizzleSql } = await import("drizzle-orm");

    const e = entry as any;
    const entryKey: string =
      e.id ?? e.fingerprint ?? sha(JSON.stringify(entry));

    await db
      .insert(nexoraKnowledge)
      .values({
        entryKey,
        companyName: e.companyName ?? e.companyKey ?? "",
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
          ...(e.companyName != null ? { companyName: e.companyName } : e.companyKey != null ? { companyName: e.companyKey } : {}),
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
  params: { runId: string; level?: string; event: string; message: string; meta?: Record<string, unknown> },
): Promise<void> {
  const { runId, event, message, meta = {} } = params;
  try {
    const db = await getDb();
    const { auditLogs } = await import("../../../../shared/schema");

    await db.insert(auditLogs).values({
      actorType: "system",
      actorId: runId,
      action: event,
      entityType: "nexora_run",
      entityId: runId,
      metadataJson: { message, ...meta },
    });
  } catch {
    console.log(`[NexoraAudit] ${event}`, { runId, message, ...meta });
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

export async function upsertDecisionRecord(
  record: NexoraDecisionRecordLike & Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getDb();
    const { nexoraDecisions } = await import("../../../../shared/schema");

    const r = record as any;
    const action = r.action ?? "hold";
    const priority = r.priority ?? "low";
    const confidence = typeof r.confidence === "number" ? r.confidence : 0;

    await db.insert(nexoraDecisions).values({
      runId: r.runId ?? "unknown",
      signalId: r.signalId ?? r.fingerprint ?? "unknown",
      companyName: r.companyName ?? "unknown",
      idempotencyKey: r.fingerprint ?? r.idempotencyKey ?? r.signalId ?? "unknown",
      ruleDecision: r.ruleDecision ?? null,
      aiDecision: r.aiDecision ?? r.ensembleDecision ?? null,
      finalDecision: { action, priority, confidence, reasons: r.reasons ?? [] },
      action,
      priority,
      confidence,
      reasoning:
        r.reasoning ??
        (Array.isArray(r.reasons) ? r.reasons.join("; ") : null),
      pushedPipeline: r.pushedPipeline ?? false,
      pushedRadar: r.pushedRadar ?? false,
      webhookSent: r.webhookSent ?? false,
      autoApproved: r.autoApproved ?? false,
      outreachQueued: r.outreachQueued ?? false,
      anomalyFlagged: Boolean(r.anomaly) || r.anomalyFlagged || false,
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
  signal: DealHunterSignalLike | Record<string, unknown>,
  action = "signal",
): string {
  const s = signal as any;
  const company = normalizeCompany(s.companyName);
  const url = canonicalizeUrl(s.sourceUrl);
  const type = cleanText(s.signalType).toLowerCase();
  return sha(`${action}::${company}::${url}::${type}`);
}

/** @deprecated use computeSignalFingerprint */
export const getIdempotencyKey = computeSignalFingerprint;

/* ─── Idempotency keys (DB-backed) ──────────────────────────────────────── */

export async function claimIdempotencyKey(
  params: { key: string; ttlSeconds?: number; meta?: Record<string, unknown> },
): Promise<{ claimed: boolean }> {
  const { key, ttlSeconds = 3600, meta = {} } = params;
  try {
    const db = await getDb();
    const { nexoraIdempotencyKeys } = await import("../../../../shared/schema");

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const now = new Date();
    const { lt, eq: deq, and: dand, or: dor } = await import("drizzle-orm");
    // Purge stale claimed keys AND expired completed keys so signals can be reprocessed
    await db
      .delete(nexoraIdempotencyKeys)
      .where(
        dor(
          dand(
            deq(nexoraIdempotencyKeys.status, "claimed"),
            lt(nexoraIdempotencyKeys.claimedAt, twoHoursAgo),
          ),
          dand(
            deq(nexoraIdempotencyKeys.status, "completed"),
            lt(nexoraIdempotencyKeys.expiresAt, now),
          ),
        ),
      );

    await db.insert(nexoraIdempotencyKeys).values({
      idemKey: key,
      action: (meta.action as string) ?? "nexora",
      signalId: (meta.signalId as string) ?? null,
      companyName: (meta.companyName as string) ?? null,
      status: "claimed",
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });

    return { claimed: true };
  } catch {
    return { claimed: false };
  }
}

export async function completeIdempotencyKey(
  params: { key: string; meta?: Record<string, unknown> },
): Promise<void> {
  const { key } = params;
  try {
    const db = await getDb();
    const { nexoraIdempotencyKeys } = await import("../../../../shared/schema");
    const { eq } = await import("drizzle-orm");

    await db
      .update(nexoraIdempotencyKeys)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(nexoraIdempotencyKeys.idemKey, key));
  } catch {
    // Non-fatal
  }
}

/* ─── Run locks (DB-backed) ─────────────────────────────────────────────── */

export async function acquireRunLock(
  params: { key?: string; runId: string; ttlSeconds?: number },
): Promise<{ acquired: boolean }> {
  const { runId, ttlSeconds } = params;
  const lockKey = params.key ?? LOCK_KEY;
  const ttlMs = (ttlSeconds ?? 900) * 1000;

  try {
    const db = await getDb();
    const { nexoraRunLocks } = await import("../../../../shared/schema");
    const { eq, lt, or } = await import("drizzle-orm");

    // Clean up expired locks AND released locks (safety net for manual updates)
    await db
      .delete(nexoraRunLocks)
      .where(
        or(
          lt(nexoraRunLocks.expiresAt, new Date()),
          eq(nexoraRunLocks.status, "released"),
        ),
      );

    const existing = await db
      .select()
      .from(nexoraRunLocks)
      .where(eq(nexoraRunLocks.lockKey, lockKey))
      .limit(1);

    if (existing.length > 0) return { acquired: false };

    const expiresAt = new Date(Date.now() + ttlMs);
    await db.insert(nexoraRunLocks).values({
      lockKey,
      runId,
      expiresAt,
      status: "active",
    });

    return { acquired: true };
  } catch {
    return { acquired: false };
  }
}

export async function releaseRunLock(
  params: { key?: string; runId: string },
): Promise<void> {
  const { runId } = params;
  const lockKey = params.key ?? LOCK_KEY;

  try {
    const db = await getDb();
    const { nexoraRunLocks } = await import("../../../../shared/schema");
    const { eq, and } = await import("drizzle-orm");

    await db
      .delete(nexoraRunLocks)
      .where(
        and(
          eq(nexoraRunLocks.lockKey, lockKey),
          eq(nexoraRunLocks.runId, runId),
        ),
      );
  } catch {
    // Non-fatal
  }
}

/* ─── Webhook (Layer 2 — durable outbound action) ───────────────────────── */

export async function fireWebhook(
  params: { runId: string; signal: any; action: string; priority: string; estimatedValue: number },
): Promise<boolean> {
  const webhookUrl = process.env.NEXORA_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nexora-Agent": "1" },
      body: JSON.stringify({
        runId: params.runId,
        action: params.action,
        priority: params.priority,
        estimatedValue: params.estimatedValue,
        companyName: (params.signal as any)?.companyName ?? null,
        signalType: (params.signal as any)?.signalType ?? null,
        sourceUrl: (params.signal as any)?.sourceUrl ?? null,
        ts: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/* ─── Vector sync ───────────────────────────────────────────────────────── */

export async function syncVectorKnowledge(
  params: { signal: any; action: string; priority: string },
): Promise<boolean> {
  if (process.env.NEXORA_VECTOR_SYNC_DISABLED === "true") return false;
  return true;
}

export async function upsertToVectorDB(
  _key: string,
  _vector: number[],
  _metadata: Record<string, unknown>,
  _config?: NexoraConfig,
): Promise<VectorUpsertResult> {
  return {
    attempted: false,
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
  signal: DealHunterSignalLike | Record<string, unknown>,
): Promise<ValidationResult & { valid: boolean }> {
  const s = signal as any;
  const companyKey = normalizeCompany(s.companyName);
  const sourceUrl = canonicalizeUrl(s.sourceUrl);
  const signalType = cleanText(s.signalType).toLowerCase();
  const freshnessDays = daysSince(s.sourcePublishedAt);

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
    valid: overallValid,
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

export async function checkDuplicateAgainstKnowledge(
  params: { signal: any; fingerprint: string; knowledgeMap: Record<string, KnowledgeEntry> },
): Promise<boolean> {
  const { signal, fingerprint, knowledgeMap } = params;
  const s = signal as any;

  if (fingerprint in knowledgeMap) return true;

  const companyKey = normalizeCompany(s.companyName);
  const sourceUrl = canonicalizeUrl(s.sourceUrl);
  const signalType = cleanText(s.signalType).toLowerCase();
  const duplicateKey = computeDuplicateKey(companyKey, signalType, sourceUrl);

  if (duplicateKey in knowledgeMap) return true;

  for (const entry of Object.values(knowledgeMap)) {
    const e = entry as any;
    if (Array.isArray(e?.seenFingerprints) && e.seenFingerprints.includes(fingerprint)) {
      return true;
    }
  }

  return false;
}

/* ─── Rule-based decision engine ────────────────────────────────────────── */

export function buildRuleDecision(
  params: {
    signal: any;
    thresholds: AdaptiveThresholds;
    validation: any;
    duplicate: boolean;
    anomaly: boolean | null;
    estimatedValue: number;
  },
): NexoraDecisionRecordLike {
  const { signal, thresholds, validation, duplicate, anomaly, estimatedValue } = params;

  const strength = clamp01(safeNumber(signal?.signalStrengthScore) / 100);
  const radarScore = clamp01(safeNumber(signal?.radarScore) / 100);
  const winRate = 0.5;

  const composite =
    strength * 0.45 +
    radarScore * 0.25 +
    winRate * 0.15 +
    (estimatedValue >= thresholds.highValue ? 0.15 : 0);

  let action: NexoraDecisionAction = "hold";
  let priority: NexoraPriority = "low";
  const reasons: string[] = [];

  if (!validation?.valid) {
    action = "ignore";
    reasons.push("validation_failed");
  } else if (duplicate) {
    action = "ignore";
    reasons.push("duplicate_signal");
  } else if (anomaly) {
    action = "review";
    priority = "medium";
    reasons.push("anomaly_detected");
  } else if (estimatedValue >= thresholds.criticalValue || composite >= 0.88) {
    action = "both";
    priority = "critical";
    reasons.push("critical_value_or_composite");
  } else if (
    estimatedValue >= thresholds.bothMinValue &&
    composite >= thresholds.strongPipeline
  ) {
    action = "both";
    priority = "high";
    reasons.push("both_criteria_met");
  } else if (
    estimatedValue >= thresholds.highValue ||
    composite >= thresholds.strongPipeline
  ) {
    action = "push_pipeline";
    priority = "high";
    reasons.push("high_value_or_strong_pipeline");
  } else if (
    composite >= thresholds.highIntentMin ||
    radarScore >= 0.6
  ) {
    action = "push_radar";
    priority = "medium";
    reasons.push("high_intent_or_radar_score");
  }

  return {
    action,
    priority,
    confidence: Math.round(clamp01(composite) * 100),
    reasons,
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
  params: {
    signal: any;
    ruleDecision: NexoraDecisionRecordLike;
    aiDecision: NormalizedAIDecision | null;
    thresholds: AdaptiveThresholds;
    validation: any;
    duplicate: boolean;
    anomaly: boolean | null;
    estimatedValue: number;
  },
): NexoraDecisionRecordLike {
  const { ruleDecision, aiDecision } = params;

  if (!aiDecision) return ruleDecision;

  const aiConfidence = clamp01(aiDecision.confidence) * 100;
  if (aiConfidence >= ruleDecision.confidence) {
    const aiActionMap: Record<string, NexoraDecisionAction> = {
      pipeline: "push_pipeline",
      radar: "push_radar",
      both: "both",
      hold: "hold",
      ignore: "ignore",
      review: "review",
      push_pipeline: "push_pipeline",
      push_radar: "push_radar",
    };

    return {
      ...ruleDecision,
      action: aiActionMap[aiDecision.action] ?? ruleDecision.action,
      priority: aiDecision.priority ?? ruleDecision.priority,
      confidence: Math.round(aiConfidence),
      reasons: [
        ...(ruleDecision.reasons ?? []),
        `ai_override(${aiDecision.reason ?? "ai_decision"})`,
      ],
    };
  }

  return ruleDecision;
}

export function detectAnomaly(
  signal: any,
  knowledgeMap: Record<string, KnowledgeEntry>,
): boolean {
  const estimatedValue = safeNumber(signal?.estimatedProjectValue);
  const strength = safeNumber(signal?.signalStrengthScore);
  const entries = Object.values(knowledgeMap);
  const winRate =
    entries.length > 0
      ? entries.reduce((acc, e: any) => acc + clamp01(e?.winRate ?? 0.5), 0) /
        entries.length
      : 0.5;
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


/* ─── NEXORA_EXISTING_RECOVERY_POLICY ────────────────────────────────────── */

export type NexoraOperationalProblemCategory =
  | "missing_configuration"
  | "provider_failure"
  | "safety_lock"
  | "rate_limit_or_flood_risk"
  | "bad_or_incomplete_data"
  | "duplicate_or_idempotency"
  | "external_party_not_ready"
  | "workflow_waiting"
  | "build_or_typecheck"
  | "unknown";

export type NexoraRecoveryAction = {
  type:
    | "continue"
    | "retry_once"
    | "fallback_channel"
    | "hold"
    | "request_missing_data"
    | "use_alternative_supplier"
    | "queue_follow_up"
    | "manual_review"
    | "block";
  safeToAutoRun: boolean;
  summary: string;
};

function nexoraProblemText(input: unknown): string {
  try {
    return JSON.stringify(input || {}).toLowerCase();
  } catch {
    return String(input || "").toLowerCase();
  }
}

function nexoraHasAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

export function classifyNexoraOperationalProblem(input: {
  module?: string;
  operation?: string;
  error?: unknown;
  context?: unknown;
}): {
  category: NexoraOperationalProblemCategory;
  severity: "info" | "low" | "medium" | "high" | "critical";
  reason: string;
} {
  const haystack = nexoraProblemText(input);

  if (nexoraHasAny(haystack, ["daily cap", "cooldown", "flood", "too many", "rate limit", "bulk"])) {
    return {
      category: "rate_limit_or_flood_risk",
      severity: "medium",
      reason: "The action risks contacting too many people or repeating contact too quickly."
    };
  }

  if (nexoraHasAny(haystack, ["locked", "autonomy_outreach_lock", "override", "safety lock", "draft_hold"])) {
    return {
      category: "safety_lock",
      severity: "medium",
      reason: "A safety lock or draft hold blocked the action. This is normally expected."
    };
  }

  if (nexoraHasAny(haystack, ["missing", "not configured", "env", "api key", "secret", "undefined"])) {
    return {
      category: "missing_configuration",
      severity: "high",
      reason: "A required environment variable, credential, API key, or provider setting appears to be missing."
    };
  }

  if (nexoraHasAny(haystack, ["403", "domain is not verified", "unauthorized", "twilio", "resend", "stripe", "provider"])) {
    return {
      category: "provider_failure",
      severity: "high",
      reason: "An external provider rejected the request or returned a provider failure."
    };
  }

  if (nexoraHasAny(haystack, ["tbc", "missing recipient", "invalid email", "unknown", "confidence_below", "not verified"])) {
    return {
      category: "bad_or_incomplete_data",
      severity: "medium",
      reason: "The data is incomplete, invalid, weak, or not trusted enough for automation."
    };
  }

  if (nexoraHasAny(haystack, ["duplicate", "idempotency", "already sent", "same quote"])) {
    return {
      category: "duplicate_or_idempotency",
      severity: "medium",
      reason: "The system detected a duplicate or repeated action risk."
    };
  }

  if (nexoraHasAny(haystack, ["sandbox", "recipient", "not joined", "not ready", "no reply", "unresponsive"])) {
    return {
      category: "external_party_not_ready",
      severity: "medium",
      reason: "The external party or provider is not ready, unavailable, or has not responded."
    };
  }

  if (nexoraHasAny(haystack, ["waiting", "queued", "pending", "awaiting"])) {
    return {
      category: "workflow_waiting",
      severity: "low",
      reason: "The workflow is waiting for a reply, release, approval, or next input."
    };
  }

  if (nexoraHasAny(haystack, ["tsc", "typescript", "build", "vite", "cannot find module", "error ts"])) {
    return {
      category: "build_or_typecheck",
      severity: "high",
      reason: "A build or TypeScript problem is blocking safe deployment."
    };
  }

  return {
    category: "unknown",
    severity: "medium",
    reason: "The problem did not match a known recovery pattern and needs review."
  };
}

export function proposeNexoraRecoveryActions(category: NexoraOperationalProblemCategory): NexoraRecoveryAction[] {
  switch (category) {
    case "rate_limit_or_flood_risk":
      return [
        { type: "block", safeToAutoRun: true, summary: "Block bulk sending and keep one-at-a-time release only." },
        { type: "queue_follow_up", safeToAutoRun: true, summary: "Hold remaining messages until daily cap/cooldown allows release." }
      ];

    case "safety_lock":
      return [
        { type: "hold", safeToAutoRun: true, summary: "Keep the item held. Safety lock is working as intended." },
        { type: "manual_review", safeToAutoRun: false, summary: "Only release with override after readiness and review." }
      ];

    case "missing_configuration":
      return [
        { type: "hold", safeToAutoRun: true, summary: "Hold the affected workflow to avoid repeated failure." },
        { type: "request_missing_data", safeToAutoRun: false, summary: "Ask for the exact missing key, credential, DNS record, or provider setting." }
      ];

    case "provider_failure":
      return [
        { type: "retry_once", safeToAutoRun: true, summary: "Retry once only if the failure may be temporary." },
        { type: "fallback_channel", safeToAutoRun: true, summary: "Use an approved alternate channel where available." },
        { type: "manual_review", safeToAutoRun: false, summary: "Stop if authentication, domain verification, or provider approval is the problem." }
      ];

    case "bad_or_incomplete_data":
      return [
        { type: "hold", safeToAutoRun: true, summary: "Hold item in review instead of sending or mutating pipeline." },
        { type: "request_missing_data", safeToAutoRun: false, summary: "Ask for missing recipient, quote input, supplier price, lead time, or evidence." }
      ];

    case "duplicate_or_idempotency":
      return [
        { type: "block", safeToAutoRun: true, summary: "Block duplicate action and link to existing quote/message/pipeline item." }
      ];

    case "external_party_not_ready":
      return [
        { type: "fallback_channel", safeToAutoRun: true, summary: "Try approved alternate channel, such as email instead of WhatsApp." },
        { type: "queue_follow_up", safeToAutoRun: true, summary: "Queue a polite follow-up after the waiting period." },
        { type: "use_alternative_supplier", safeToAutoRun: true, summary: "Ask the next approved supplier if the first supplier is unavailable." }
      ];

    case "workflow_waiting":
      return [
        { type: "continue", safeToAutoRun: true, summary: "Do nothing risky. Keep waiting until the required reply/release/data arrives." }
      ];

    case "build_or_typecheck":
      return [
        { type: "manual_review", safeToAutoRun: false, summary: "Do not deploy. Fix check/build first, then rerun npm run check and npm run build." }
      ];

    default:
      return [
        { type: "manual_review", safeToAutoRun: false, summary: "Unknown problem. Log it, stop risky action, and ask for review." }
      ];
  }
}

export function analyzeNexoraOperationalProblem(input: {
  module?: string;
  operation?: string;
  error?: unknown;
  context?: unknown;
}) {
  const classification = classifyNexoraOperationalProblem(input);
  const recoveryActions = proposeNexoraRecoveryActions(classification.category);

  return {
    ok: true,
    createdAt: new Date().toISOString(),
    module: input.module || "unknown",
    operation: input.operation || "unknown",
    classification,
    recoveryActions,
    autoRunnableActions: recoveryActions.filter((action) => action.safeToAutoRun),
    blockedActions: recoveryActions.filter((action) => !action.safeToAutoRun),
    rule: "Nexora can auto-run safe recovery actions only. Risky actions stay held or require review."
  };
}

export function getNexoraRecoveryPolicy() {
  return {
    ok: true,
    policy: {
      globalRule: "Detect, classify, recover safely, log/observe through existing Nexora systems, and never repeat risky actions blindly.",
      usesExistingSystems: [
        "withIntelligentRetry",
        "retryStats",
        "runHealthChecks",
        "idempotency keys",
        "duplicate checks",
        "rule decision hold",
        "autonomy safety locks",
        "WhatsApp guards/outbox",
        "procurement draft_hold"
      ],
      safeAutoActions: [
        "hold unsafe item",
        "retry once",
        "fallback to approved alternate channel",
        "queue follow-up",
        "use another approved supplier",
        "block duplicate",
        "stop bulk sends"
      ],
      blockedWithoutReview: [
        "bulk supplier messaging",
        "sending to unknown recipients",
        "pipeline mutation for unqualified leads",
        "customer quote send without valid pricing",
        "pretending a deal is closed without acceptance/payment evidence",
        "deploying while check/build fails"
      ],
      procurementRules: [
        "Manufacturers use Chinese-first WhatsApp drafts.",
        "Manufacturers and shipping agents stay draft_hold by default.",
        "Only one manufacturer/shipping message can be released at a time.",
        "Daily cap and recipient cooldown prevent flooding.",
        "Installer uses email/phone, not WhatsApp.",
        "Customer quote never exposes supplier cost or margin."
      ]
    }
  };
}
