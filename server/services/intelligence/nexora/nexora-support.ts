/* filepath: server/services/intelligence/nexora/nexora-support.ts */

import { promises as fs } from "node:fs";
import path from "node:path";
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

type AuditStatus = "success" | "failed";
type DuplicateCheckResult = {
  isDuplicate: boolean;
  ambiguous: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};

type RetryStats = Record<string, number>;

const DATA_DIR = path.join(process.cwd(), ".nexora-data");
const KNOWLEDGE_FILE = path.join(DATA_DIR, "knowledge-map.json");
const THRESHOLDS_FILE = path.join(DATA_DIR, "thresholds.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit-log.jsonl");
const REVIEW_QUEUE_FILE = path.join(DATA_DIR, "review-queue.jsonl");
const DECISIONS_FILE = path.join(DATA_DIR, "decisions.jsonl");
const IDEMPOTENCY_FILE = path.join(DATA_DIR, "idempotency.json");
const LOCK_FILE = path.join(DATA_DIR, "run-lock.json");
const VECTOR_FILE = path.join(DATA_DIR, "vector-cache.jsonl");

const retryStats: RetryStats = {};
const memoryLocks = new Set<string>();

const DEFAULT_THRESHOLDS: AdaptiveThresholds = {
  strongMove: 72,
  criticalValue: 150000,
  highValue: 60000,
  bothMinValue: 120000,
  strongPipeline: 0.72,
  highIntentMin: 0.68,
  learningRate: 0.15,
};

function nowIso(): string {
  return new Date().toISOString();
}

function sha(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

async function appendJsonLine(file: string, value: unknown): Promise<void> {
  await ensureDataDir();
  await fs.appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
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

export function cosineSimilarity(a: number[], [], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;

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
          body: JSON.stringify({
            model,
            input: text,
          }),
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

  export async function initNexoraDataSource(): Promise<void> {
    await ensureDataDir();
    await Promise.all([
      writeJsonFile(THRESHOLDS_FILE, await loadThresholds()),
      writeJsonFile(
        KNOWLEDGE_FILE,
        Object.fromEntries((await loadKnowledgeMap()).entries()),
      ),
    ]).catch(() => undefined);
  }

  export async function loadThresholds(): Promise<AdaptiveThresholds> {
    const stored = await readJsonFile<Partial<AdaptiveThresholds>>(
      THRESHOLDS_FILE,
      {},
    );
    return { ...DEFAULT_THRESHOLDS, ...stored };
  }

  export async function saveThresholds(
    thresholds: AdaptiveThresholds,
    reason = "",
  ): Promise<void> {
    await writeJsonFile(THRESHOLDS_FILE, {
      ...thresholds,
      _meta: {
        savedAt: nowIso(),
        reason,
      },
    });
  }

  export async function loadKnowledgeMap(): Promise<Map<string, KnowledgeEntry>> {
    const raw = await readJsonFile<Record<string, KnowledgeEntry>>(
      KNOWLEDGE_FILE,
      {},
    );
    return new Map(Object.entries(raw));
  }

  export async function saveKnowledgeMap(
    map: Map<string, KnowledgeEntry>,
  ): Promise<void> {
    await writeJsonFile(KNOWLEDGE_FILE, Object.fromEntries(map.entries()));
  }

  export async function logAudit(
    runId: string,
    event: string,
    payload: Record<string, unknown>,
    status: AuditStatus = "success",
  ): Promise<void> {
    await appendJsonLine(AUDIT_FILE, {
      ts: nowIso(),
      runId,
      event,
      status,
      ...payload,
    });
  }

  export async function pushReviewQueue(
    runId: string,
    queueType: string,
    signalId: string,
    companyName: string,
    payload: unknown,
  ): Promise<void> {
    await appendJsonLine(REVIEW_QUEUE_FILE, {
      ts: nowIso(),
      runId,
      queueType,
      signalId,
      companyName,
      payload,
    });
  }

  export async function recordDecisionRecord(record: {
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
  }): Promise<void> {
    await appendJsonLine(DECISIONS_FILE, {
      ts: nowIso(),
      ...record,
    });
  }

  export function getIdempotencyKey(
    signal: DealHunterSignalLike,
    action: string,
  ): string {
    const company = normalizeCompany(signal.companyName);
    const url = canonicalizeUrl(signal.sourceUrl);
    const type = cleanText(signal.signalType).toLowerCase();
    return sha(`${action}::${company}::${url}::${type}`);
  }

  export async function claimIdempotencyKey(
    key: string,
    action: string,
    signalId: string,
    companyName: string,
  ): Promise<boolean> {
    const store = await readJsonFile<
      Record<
        string,
        {
          status: "claimed" | "completed" | "failed";
          action: string;
          signalId: string;
          companyName: string;
          updatedAt: string;
        }
      >
    >(IDEMPOTENCY_FILE, {});

    const existing = store[key];
    if (existing?.status === "claimed" || existing?.status === "completed") {
      return false;
    }

    store[key] = {
      status: "claimed",
      action,
      signalId,
      companyName,
      updatedAt: nowIso(),
    };

    await writeJsonFile(IDEMPOTENCY_FILE, store);
    return true;
  }

  export async function completeIdempotencyKey(
    key: string,
    status: "completed" | "failed",
  ): Promise<void> {
    const store = await readJsonFile<
      Record<
        string,
        {
          status: "claimed" | "completed" | "failed";
          action: string;
          signalId: string;
          companyName: string;
          updatedAt: string;
        }
      >
    >(IDEMPOTENCY_FILE, {});

    if (store[key]) {
      store[key].status = status;
      store[key].updatedAt = nowIso();
      await writeJsonFile(IDEMPOTENCY_FILE, store);
    }
  }

  export async function acquireRunLock(runId: string): Promise<boolean> {
    await ensureDataDir();

    if (memoryLocks.has("nexora")) return false;

    const current = await readJsonFile<{
      runId?: string;
      createdAt?: string;
    } | null>(LOCK_FILE, null);

    const staleMs = 15 * 60_000;
    const createdAt = current?.createdAt ? Date.parse(current.createdAt) : 0;
    const isFresh = createdAt && Date.now() - createdAt < staleMs;

    if (current?.runId && isFresh) return false;

    memoryLocks.add("nexora");
    await writeJsonFile(LOCK_FILE, {
      runId,
      createdAt: nowIso(),
    });

    return true;
  }

  export async function releaseRunLock(runId: string): Promise<void> {
    memoryLocks.delete("nexora");

    const current = await readJsonFile<{
      runId?: string;
      createdAt?: string;
    } | null>(LOCK_FILE, null);

    if (!current?.runId || current.runId === runId) {
      try {
        await fs.unlink(LOCK_FILE);
      } catch {
        // ignore
      }
    }
  }

  export async function runHealthChecks(
    _config: NexoraConfig,
  ): Promise<HealthCheckResult> {
    await ensureDataDir();

    const checks: HealthCheckResult["checks"] = {
      data_dir: { ok: true, reason: "ready" },
      filesystem: { ok: true, reason: "writable" },
    };

    return {
      ok: Object.values(checks).every((c) => c.ok),
      checks,
    };
  }

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

  export async function upsertToVectorDB(
    key: string,
    vector: number[],
    metadata: Record<string, unknown>,
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

    await appendJsonLine(VECTOR_FILE, {
      ts: nowIso(),
      key,
      vectorLength: vector.length,
      metadata,
    });

    return {
      attempted: true,
      pineconeAttempted: false,
      pineconeSucceeded: false,
      weaviateAttempted: false,
      weaviateSucceeded: false,
      errors: [],
    };
  }

  export async function getOutcomeSuccessRate(companyName: string): Promise<number> {
    const map = await loadKnowledgeMap();
    const companyKey = normalizeCompany(companyName);

    let hits = 0;
    let count = 0;

    for (const [, entry] of map) {
      const e = entry as any;
      if ((e.companyKey ?? "") === companyKey) {
        hits += clamp01(safeNumber(e.winRate, 0.5));
        count += 1;
      }
    }

    return count ? hits / count : 0.5;
  }