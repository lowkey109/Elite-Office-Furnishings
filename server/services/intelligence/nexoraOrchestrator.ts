import { runOfficeMovRadarScan } from "./officeMovRadarService";
import {
  runNewsFeedScan,
  runJobSignalScan,
  runPredictiveScan,
} from "./newsFeedScanner";
import {
  pushDealHunterToPipeline,
  pushDealHunterToRadar,
  runDealHunterScan,
} from "./dealHunter";
import { nexoraAIAnalysis } from "./nexoraAI";

// WhatsApp / AI messaging
import { sendAIWhatsAppMessage } from "./communications/aiWhatsAppService";

// Nexora support utilities
import {
  acquireRunLock,
  buildRuleDecision,
  canonicalizeUrl,
  checkDuplicateAgainstKnowledge,
  claimIdempotencyKey,
  cleanText,
  completeIdempotencyKey,
  cosineSimilarity,
  detectAnomaly,
  finalizeDecision,
  getIdempotencyKey,
  getNexoraConfig,
  getOutcomeSuccessRate,
  getRetryStatsSnapshot,
  resetRetryStats,
  getSemanticEmbedding,
  initNexoraDataSource,
  loadKnowledgeMap,
  loadThresholds,
  logAudit,
  normalizeAIDecision,
  normalizeCompany,
  pushReviewQueue,
  recordDecisionRecord,
  releaseRunLock,
  requireApproval,
  runHealthChecks,
  safeNumber,
  saveKnowledgeMap,
  saveThresholds,
  upsertToVectorDB,
  validateSignal,
  withIntelligentRetry,
  withTimeout,
} from "./nexora/nexora-support";

// Types (single clean import — FIXED)
import type {
  AdaptiveThresholds,
  DealHunterSignalLike,
  KnowledgeEntry,
  NexoraConfig,
  NexoraResult,
  NormalizedAIDecision,
  RadarSignalLike,
  RadarPoolStats,
  RadarMatchTypeStats,
  RetryCounter,
} from "./nexora/nexora-types";

type RadarOrigin = "officeMov" | "news" | "jobs" | "predictive";
type RadarCandidate = RadarSignalLike & { __origin?: RadarOrigin };

type CounterMap = Record<string, number>;
const bump = (map: CounterMap, key: string, inc = 1) => {
  map[key] = (map[key] ?? 0) + inc;
};

class AsyncSemaphore {
  private current = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.current < this.limit) {
      this.current += 1;
      return () => this.release();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.current += 1;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.current -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

type EmbeddingCache = Map<string, { vector: number[]; mode: "remote" | "heuristic" }>;
async function getCachedEmbedding(cache: EmbeddingCache, text: string) {
  const key = cleanText(text).toLowerCase();
  const existing = cache.get(key);
  if (existing) return existing;
  const res = await getSemanticEmbedding(key);
  cache.set(key, res);
  return res;
}

function classifyError(err: unknown): "timeout" | "network" | "http" | "unknown" {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (msg.includes("timed out") || msg.includes("timeout")) return "timeout";
  if (msg.includes("fetch") || msg.includes("econn") || msg.includes("enotfound") || msg.includes("socket")) return "network";
  if (msg.includes("status") || msg.includes("http")) return "http";
  return "unknown";
}

function extractSourceDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeEstimatedValue(input: unknown): number | null {
  if (input == null) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (n > 5_000_000) return null;
  return n;
}

function parseDealResults(raw: unknown): DealHunterSignalLike[] {
  if (Array.isArray(raw)) return raw as DealHunterSignalLike[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { signals?: unknown[] }).signals)) {
    return (raw as { signals: DealHunterSignalLike[] }).signals;
  }
  return [];
}

function parseRadarArray(raw: unknown): RadarSignalLike[] {
  return Array.isArray(raw) ? (raw as RadarSignalLike[]) : [];
}

function isSyntheticMarker(input: string): boolean {
  return /demo|test|mock|synthetic|placeholder|sample|fake/i.test(input);
}

function isUsableRadarSignal(r: RadarSignalLike): boolean {
  const company = cleanText(r.companyName);
  const url = canonicalizeUrl((r as any).sourceUrl);
  const type = cleanText((r as any).signalType);
  if (!company) return false;
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (!type) return false;

  const marker = `${cleanText((r as any).signalSource)} ${type} ${cleanText((r as any).signalSubtype)} ${cleanText(
    (r as any).rawPayloadSummary,
  )}`.toLowerCase();
  if (isSyntheticMarker(marker)) return false;

  return true;
}

function buildRadarIndex(radarResults: RadarCandidate[]): Map<string, RadarCandidate[]> {
  const map = new Map<string, RadarCandidate[]>();
  for (const r of radarResults) {
    const key = normalizeCompany(r.companyName);
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return map;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const clamped = Math.max(0, Math.min(1, q));
  const idx = (sorted.length - 1) * clamped;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function calcPoolStats(samples: number[]): RadarPoolStats {
  if (!samples.length) return { count: 0, avg: 0, p50: 0, p90: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    count: samples.length,
    avg,
    p50: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    max: sorted[sorted.length - 1],
  };
}

async function getBestRadarMatch(
  signal: DealHunterSignalLike,
  radarIndex: Map<string, RadarCandidate[]>,
  runId: string,
  embeddingCache: EmbeddingCache,
): Promise<RadarCandidate | null> {
  const key = normalizeCompany(signal.companyName);
  if (!key) return null;

  const candidates = radarIndex.get(key) ?? [];
  if (!candidates.length) return null;

  const sigEmb = await getCachedEmbedding(embeddingCache, key);
  if (sigEmb.mode === "heuristic") {
    await logAudit(runId, "embedding_fallback_used", {
      companyName: cleanText(signal.companyName) || "unknown",
      payload: { mode: "heuristic", input: key, scope: "radar_match" },
    });
  }

  let best: RadarCandidate | null = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    const cKey = normalizeCompany(c.companyName) || key;
    const cEmb = await getCachedEmbedding(embeddingCache, cKey);
    const sim = cosineSimilarity(sigEmb.vector, cEmb.vector);
    const modePenalty = sigEmb.mode === cEmb.mode ? 1 : 0.5;

    const radarScore = Number.isFinite(Number((c as any).radarScore))
      ? Math.max(0, Math.min(100, Number((c as any).radarScore)))
      : 0;

    const blended = radarScore * (0.7 + 0.3 * sim * modePenalty);
    if (blended > bestScore) {
      bestScore = blended;
      best = c;
    }
  }

  return best;
}

async function getBestKnowledgeMatch(
  knowledgeMap: Map<string, KnowledgeEntry>,
  companyName: string,
  runId: string,
  embeddingCache: EmbeddingCache,
): Promise<KnowledgeEntry | null> {
  const key = normalizeCompany(companyName);
  if (!key) return null;

  const queryEmbedding = await getCachedEmbedding(embeddingCache, key);
  if (queryEmbedding.mode === "heuristic") {
    await logAudit(runId, "embedding_fallback_used", {
      companyName: cleanText(companyName) || "unknown",
      payload: { mode: "heuristic", input: key, scope: "kb_match" },
    });
  }

  let best: KnowledgeEntry | null = null;
  let bestScore = -1;
  const now = Date.now();

  for (const [, entry] of knowledgeMap) {
    const e = entry as any;
    const entryEmb = Array.isArray(e.embedding) ? e.embedding : [];
    const sim = cosineSimilarity(queryEmbedding.vector, entryEmb);
    const recencyBoost = Math.max(0, 1 - (now - (e.lastSeen ?? now)) / (90 * 24 * 60 * 60 * 1000));
    const finalSim = sim * (0.75 + 0.25 * recencyBoost);
    if (finalSim > bestScore) {
      bestScore = finalSim;
      best = entry;
    }
  }

  return bestScore >= 0.78 ? best : null;
}

function sortDealsForPriority(deals: DealHunterSignalLike[]): DealHunterSignalLike[] {
  return [...deals].sort((a, b) => {
    const av = normalizeEstimatedValue((a as any).estimatedProjectValue) ?? 0;
    const bv = normalizeEstimatedValue((b as any).estimatedProjectValue) ?? 0;
    if (bv !== av) return bv - av;
    const as = safeNumber((a as any).signalStrengthScore);
    const bs = safeNumber((b as any).signalStrengthScore);
    return bs - as;
  });
}

type WebhookSignalTelemetry = {
  webhookAttempted: boolean;
  webhookSucceeded: boolean;
  webhookFailed: boolean;
  webhookStatus?: number;
  webhookErrorClass?: string;
};

type BackgroundState = {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt?: string;
  lastResult?: Pick<NexoraResult, "runId" | "success" | "message" | "durationMs">;
  lastError?: string;
};

let backgroundTimer: NodeJS.Timeout | null = null;
const backgroundState: BackgroundState = {
  enabled: false,
  running: false,
  intervalMs: 0,
};

/* ===== Minimal integration shim exports (legacy surface) ===== */

export type NexoraCycleResult = NexoraResult & {
  source: string;
};

export function isNexoraCycleRunning(): boolean {
  return backgroundState.running;
}

export async function runNexoraCycle(source = "manual"): Promise<NexoraCycleResult> {
  const res = await runNexoraEngine();
  return { ...res, source };
}

/* ===== Background helpers ===== */

export function getNexoraBackgroundState(): BackgroundState {
  return { ...backgroundState };
}

export function stopNexoraBackground(): void {
  if (backgroundTimer) clearInterval(backgroundTimer);
  backgroundTimer = null;
  backgroundState.enabled = false;
  backgroundState.running = false;
}

export function startNexoraBackground(intervalMs = 30 * 60_000): () => void {
  stopNexoraBackground();

  backgroundState.enabled = true;
  backgroundState.intervalMs = intervalMs;

  // ── On boot: trigger first intelligence scan run immediately (after 30s delay) ──
  // This ensures deal signals are populated before the first full Nexora cycle runs.
  setTimeout(async () => {
    try {
      const { runIntelligenceSubTasks } = await import("../intelligenceScheduler");
      await runIntelligenceSubTasks({ dealHunterMinIntervalMs: 0, radarMinIntervalMs: 0 });
    } catch (e) {
      console.error("[Nexora] Boot-time sub-task trigger failed:", e);
    }
  }, 30_000);

  backgroundTimer = setInterval(async () => {
    try {
      // Step 1: Trigger intelligence sub-tasks (deal discovery, radar scans).
      // runIntelligenceSubTasks() uses its own interval tracking — it only
      // executes a job if sufficient time has passed since the last run.
      // This keeps Nexora as the sole coordinator without duplicating work.
      const { runIntelligenceSubTasks } = await import("../intelligenceScheduler");
      await runIntelligenceSubTasks();

      // Step 2: Process discovered signals with the full Nexora decision engine.
      const result = await runNexoraCycle("background");
      backgroundState.lastRunAt = new Date().toISOString();
      backgroundState.lastResult = {
        runId: result?.runId ?? "unknown",
        success: Boolean(result?.success),
        message: String(result?.message ?? ""),
        durationMs: Number(result?.durationMs ?? 0),
      };
      backgroundState.lastError = undefined;
    } catch (e) {
      backgroundState.lastRunAt = new Date().toISOString();
      backgroundState.lastError = String(e);
    }
  }, intervalMs);

  return () => stopNexoraBackground();
}

/* ===== Single live brain ===== */

export async function runNexoraEngine(): Promise<NexoraResult> {
  const start = Date.now();
  const runId = `run_${Date.now()}`;

  const errors: string[] = [];
  const retryCounter: RetryCounter = { value: 0 };

  const config: NexoraConfig = getNexoraConfig(false);
  await initNexoraDataSource();

  const health = await runHealthChecks(config);
  if (!health.ok) {
    return {
      runId,
      success: false,
      processed: 0,
      outreachRuns: 0,
      outreachFailed: 0,
      radarSignals: 0,
      dealSignals: 0,
      errors: Object.entries(health.checks)
        .filter(([, v]) => !v.ok)
        .map(([k, v]) => `${k}: ${v.reason}`),
      message: "Nexora health checks failed",
      durationMs: Date.now() - start,
      intelligenceScore: 0,
      telemetry: {
        avgDecisionMs: 0,
        peakConcurrency: 0,
        totalRetries: 0,
        adaptationEvents: 0,
        criticalOpportunities: 0,
        projectedPipelineValue: 0,
        anomalyCount: 0,
        selfEvolutions: 0,
        kbHealthScore: 0,

        radarMatchAttempted: 0,
        radarMatchHits: 0,
        radarMatchMisses: 0,
        radarMatchHitRate: 0,

        radarMatchCandidatePoolAvg: 0,
        radarMatchCandidatePoolP50: 0,
        radarMatchCandidatePoolP90: 0,
        radarMatchCandidatePoolMax: 0,

        radarMatchCandidatePoolBySignalType: {},
        radarMatchBySignalType: {},

        radarMatchHitsByOrigin: {},
        decisionCountsByAction: {},
        decisionCountsByPriority: {},
        ruleVsAiDisagreementRate: 0,

        webhookAttempted: 0,
        webhookSucceeded: 0,
        webhookFailed: 0,

        ai: { attemptedCalls: 0, skippedBudget: 0, skippedStorm: 0, concurrencyLimit: 0, budgetCeiling: 0, errorsByClass: {} },

        retriesByOperation: {},
        timeoutsByOperation: {},
        errorCountsByClass: {},
      } as any,
    };
  }

  const lockAcquired = await acquireRunLock(runId);
  if (!lockAcquired) {
    return {
      runId,
      success: false,
      processed: 0,
      outreachRuns: 0,
      outreachFailed: 0,
      radarSignals: 0,
      dealSignals: 0,
      errors: ["another Nexora run is already active"],
      message: "Nexora run lock unavailable",
      durationMs: Date.now() - start,
      intelligenceScore: 0,
      telemetry: {
        avgDecisionMs: 0,
        peakConcurrency: config.maxConcurrency,
        totalRetries: 0,
        adaptationEvents: 0,
        criticalOpportunities: 0,
        projectedPipelineValue: 0,
        anomalyCount: 0,
        selfEvolutions: 0,
        kbHealthScore: 0,

        radarMatchAttempted: 0,
        radarMatchHits: 0,
        radarMatchMisses: 0,
        radarMatchHitRate: 0,

        radarMatchCandidatePoolAvg: 0,
        radarMatchCandidatePoolP50: 0,
        radarMatchCandidatePoolP90: 0,
        radarMatchCandidatePoolMax: 0,

        radarMatchCandidatePoolBySignalType: {},
        radarMatchBySignalType: {},

        radarMatchHitsByOrigin: {},
        decisionCountsByAction: {},
        decisionCountsByPriority: {},
        ruleVsAiDisagreementRate: 0,

        webhookAttempted: 0,
        webhookSucceeded: 0,
        webhookFailed: 0,

        ai: { attemptedCalls: 0, skippedBudget: 0, skippedStorm: 0, concurrencyLimit: 0, budgetCeiling: 0, errorsByClass: {} },

        retriesByOperation: {},
        timeoutsByOperation: {},
        errorCountsByClass: {},
      } as any,
    };
  }

  const RUN_TIMEOUT_MS = Math.max(60_000, Number(process.env.NEXORA_RUN_TIMEOUT_MS || 10 * 60_000));
  const embeddingCache: EmbeddingCache = new Map();

  const AI_CONCURRENCY_LIMIT = Math.max(1, Math.min(4, Number(process.env.NEXORA_AI_CONCURRENCY || 2)));
  const AI_BUDGET_CEILING = Math.max(0, Number(process.env.NEXORA_AI_BUDGET || 250));
  const aiSemaphore = new AsyncSemaphore(AI_CONCURRENCY_LIMIT);
  const vectorSemaphore = new AsyncSemaphore(Math.max(1, Math.min(4, Number(process.env.NEXORA_VECTOR_CONCURRENCY || 2))));

  const RETRY_STORM_THRESHOLD = Math.max(20, Number(process.env.NEXORA_RETRY_STORM_THRESHOLD || 80));
  let stormMode = false;

  const queuedDedup = new Set<string>();
  const errorCountsByClass: CounterMap = {};
  const timeoutsByOperation: CounterMap = {};
  const opCallCounts: CounterMap = {};

  const decisionCountsByAction: CounterMap = {};
  const decisionCountsByPriority: CounterMap = {};
  const radarMatchHitsByOrigin: CounterMap = {};
  const aiErrorsByClass: CounterMap = {};

  let radarMatchAttempted = 0;
  let radarMatchHits = 0;

  const radarPoolSizes: number[] = [];
  const radarPoolSizesByType = new Map<string, number[]>();
  const radarAttemptedByType: CounterMap = {};
  const radarHitsByType: CounterMap = {};

  let aiAttemptedCalls = 0;
  let aiSkippedBudget = 0;
  let aiSkippedStorm = 0;

  let disagreementCount = 0;
  let decisionedCount = 0;

  let scannedDeals = 0;
  let dealsAfterFilter = 0;
  let outreachFailed = 0;
  let anomalyCount = 0;

  let webhookAttempted = 0;
  let webhookSucceeded = 0;
  let webhookFailed = 0;

  const seenIdentityThisRun = new Set<string>();

  const safeQueue = async (queueType: any, signalId: string, companyName: string, payload: unknown) => {
    const key = `${queueType}:${signalId}:${JSON.stringify(payload ?? {}).slice(0, 600)}`;
    if (queuedDedup.has(key)) return;
    queuedDedup.add(key);
    await pushReviewQueue(runId, queueType, signalId, companyName, payload);
  };

  const markError = (err: unknown, op: string) => {
    const cls = classifyError(err);
    bump(errorCountsByClass, cls);
    if (cls === "timeout") bump(timeoutsByOperation, op);
  };

  const op = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    bump(opCallCounts, name);
    try {
      return await fn();
    } catch (e) {
      markError(e, name);
      throw e;
    }
  };

  const runAiCall = async (opName: string, fn: () => Promise<any>) => {
    if (stormMode) {
      aiSkippedStorm += 1;
      return null;
    }
    if (aiAttemptedCalls >= AI_BUDGET_CEILING) {
      aiSkippedBudget += 1;
      return null;
    }

    aiAttemptedCalls += 1;
    const release = await aiSemaphore.acquire();
    try {
      return await op(opName, () =>
        withIntelligentRetry(fn, opName, config.maxRetriesPerOperation, retryCounter, config.timeoutMs.aiAnalysis),
      );
    } catch (e) {
      bump(aiErrorsByClass, classifyError(e));
      throw e;
    } finally {
      release();
    }
  };

  const sendCriticalWebhook = async (
    signal: DealHunterSignalLike,
    decision: NormalizedAIDecision,
  ): Promise<WebhookSignalTelemetry> => {
    const base: WebhookSignalTelemetry = { webhookAttempted: false, webhookSucceeded: false, webhookFailed: false };

    const webhookUrl = process.env.NEXORA_WEBHOOK_URL;
    if (!webhookUrl || config.webhookDisabled) return base;
    if (decision.priority !== "critical") return base;
    if (stormMode) return base;

    const companyName = cleanText(signal.companyName) || "unknown";
    const approval = await requireApproval(runId, signal, "webhook", decision, config);
    if (!approval.allowed) return base;

    const idemKey = getIdempotencyKey(signal, "webhook");
    const claimed = await claimIdempotencyKey(idemKey, "webhook", signal.id, companyName);
    if (!claimed) return base;

    webhookAttempted += 1;
    base.webhookAttempted = true;

    try {
      const res = await op("webhook", () =>
        withTimeout(
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              company: signal.companyName,
              action: decision.action,
              priority: decision.priority,
              confidence: decision.confidence,
              estimatedValue: (signal as any).estimatedProjectValue ?? null,
              reason: decision.reason,
              source: (signal as any).signalSource ?? null,
              sourceUrl: canonicalizeUrl(signal.sourceUrl),
            }),
          }),
          config.timeoutMs.webhook,
          "webhook",
        ),
      );

      base.webhookStatus = res.status;
      await completeIdempotencyKey(idemKey, res.ok ? "completed" : "failed");

      if (res.ok) {
        webhookSucceeded += 1;
        base.webhookSucceeded = true;
        return base;
      }

      webhookFailed += 1;
      base.webhookFailed = true;

      await safeQueue("failed_push", signal.id, companyName, { actionType: "webhook", status: res.status });
      return base;
    } catch (err) {
      await completeIdempotencyKey(idemKey, "failed");

      webhookFailed += 1;
      base.webhookFailed = true;
      base.webhookErrorClass = classifyError(err);

      await safeQueue("failed_push", signal.id, companyName, { actionType: "webhook", errorClass: base.webhookErrorClass });
      return base;
    }
  };

  const runCore = async (): Promise<NexoraResult> => {
    await logAudit(runId, "engine_start", {
      payload: {
        env: config.env,
        aiConcurrencyLimit: AI_CONCURRENCY_LIMIT,
        aiBudgetCeiling: AI_BUDGET_CEILING,
        runTimeoutMs: RUN_TIMEOUT_MS,
      },
    });

    let thresholds: AdaptiveThresholds = await loadThresholds();
    const knowledgeMap = await loadKnowledgeMap();

    const [officeRaw, newsRaw, jobsRaw, predictiveRaw, dealRaw] = await Promise.allSettled([
      op("radar_officemov", () =>
        withIntelligentRetry(() => Promise.resolve(runOfficeMovRadarScan()), "radar_officemov", config.maxRetriesPerOperation, retryCounter, config.timeoutMs.radarScan),
      ),
      op("radar_news", () =>
        withIntelligentRetry(() => Promise.resolve(runNewsFeedScan()), "radar_news", config.maxRetriesPerOperation, retryCounter, config.timeoutMs.radarScan),
      ),
      op("radar_jobs", () =>
        withIntelligentRetry(() => Promise.resolve(runJobSignalScan()), "radar_jobs", config.maxRetriesPerOperation, retryCounter, config.timeoutMs.radarScan),
      ),
      op("radar_predictive", () =>
        withIntelligentRetry(() => Promise.resolve(runPredictiveScan()), "radar_predictive", config.maxRetriesPerOperation, retryCounter, config.timeoutMs.radarScan),
      ),
      op("deal_scan", () =>
        withIntelligentRetry(() => Promise.resolve(runDealHunterScan()), "deal_scan", config.maxRetriesPerOperation, retryCounter, config.timeoutMs.dealScan),
      ),
    ]);

    for (const [label, raw] of [
      ["office", officeRaw],
      ["news", newsRaw],
      ["jobs", jobsRaw],
      ["predictive", predictiveRaw],
      ["deal", dealRaw],
    ] as const) {
      if (raw.status === "rejected") {
        errors.push(`${label} scan failed: ${String(raw.reason)}`);
        markError(raw.reason, `scan_${label}`);
      }
    }

    const officeRadar: RadarCandidate[] =
      officeRaw.status === "fulfilled"
        ? parseRadarArray(officeRaw.value).map((r) => ({ ...(r as any), __origin: "officeMov" as const }))
        : [];

    const newsResult = newsRaw.status === "fulfilled" ? (newsRaw.value as any) : { signals: [] };
    const jobsResult = jobsRaw.status === "fulfilled" ? (jobsRaw.value as any) : { signals: [] };
    const predictiveResult = predictiveRaw.status === "fulfilled" ? (predictiveRaw.value as any) : { signals: [] };

    const feedRadarSignals: RadarCandidate[] = [
      ...(Array.isArray(newsResult.signals) ? (newsResult.signals as RadarSignalLike[]).map((r) => ({ ...(r as any), __origin: "news" as const })) : []),
      ...(Array.isArray(jobsResult.signals) ? (jobsResult.signals as RadarSignalLike[]).map((r) => ({ ...(r as any), __origin: "jobs" as const })) : []),
      ...(Array.isArray(predictiveResult.signals) ? (predictiveResult.signals as RadarSignalLike[]).map((r) => ({ ...(r as any), __origin: "predictive" as const })) : []),
    ];

    const mergedRadarResults: RadarCandidate[] = [...officeRadar, ...feedRadarSignals]
      .map((r) => ({ ...r, sourceUrl: canonicalizeUrl((r as any).sourceUrl) }))
      .filter(isUsableRadarSignal);

    const radarSeen = new Set<string>();
    const mergedRadarUnique: RadarCandidate[] = [];
    for (const r of mergedRadarResults) {
      const k = `${normalizeCompany(r.companyName)}:${canonicalizeUrl((r as any).sourceUrl)}:${cleanText((r as any).signalType).toLowerCase()}`;
      if (!k || radarSeen.has(k)) continue;
      radarSeen.add(k);
      mergedRadarUnique.push(r);
    }

    const radarIndex = buildRadarIndex(mergedRadarUnique);

    const rawDeals = dealRaw.status === "fulfilled" ? parseDealResults(dealRaw.value) : [];
    scannedDeals = rawDeals.length;

    let dealResults = rawDeals
      .filter((d) => Boolean(normalizeCompany(d.companyName) && canonicalizeUrl(d.sourceUrl)))
      .filter((d) => !isSyntheticMarker(`${cleanText((d as any).signalSource)} ${cleanText((d as any).signalType)} ${cleanText((d as any).rawPayloadSummary)} ${cleanText((d as any).sourceTitle)}`.toLowerCase()));

    dealResults = sortDealsForPriority(dealResults);
    dealsAfterFilter = dealResults.length;

    const semaphore = new AsyncSemaphore(config.maxConcurrency);

    const decisions: Array<{
      companyName: string;
      success: boolean;
      decision: NormalizedAIDecision;
      estimatedValue: number;
      pushedPipeline: boolean;
      pushedRadar: boolean;
      webhookSent: boolean;
    }> = [];

    await Promise.all(
      dealResults.map(async (signal) => {
        const release = await semaphore.acquire();

        const companyName = cleanText(signal.companyName) || "unknown";
        const sourceUrl = canonicalizeUrl(signal.sourceUrl);
        const sourceDomain = extractSourceDomain(sourceUrl);
        const signalType = cleanText(signal.signalType).toLowerCase() || "unknown";

        try {
          if (!stormMode && retryCounter.value >= RETRY_STORM_THRESHOLD) {
            stormMode = true;
            await logAudit(runId, "retry_storm_guard_enabled", { payload: { retries: retryCounter.value, threshold: RETRY_STORM_THRESHOLD } }, "failed");
            await safeQueue("retry_storm", signal.id, companyName, { retries: retryCounter.value, threshold: RETRY_STORM_THRESHOLD });
          }

          const identityKey = `${normalizeCompany(companyName)}:${sourceUrl}:${signalType}`;
          if (seenIdentityThisRun.has(identityKey)) {
            await logAudit(runId, "duplicate_cooldown_skip", { signalId: signal.id, companyName, payload: { identityKey, sourceDomain } });
            await safeQueue("duplicate_candidate", signal.id, companyName, { reason: "duplicate_cooldown_same_run", sourceUrl, sourceDomain, signalType });
            return;
          }
          seenIdentityThisRun.add(identityKey);

          const validation = await op("validate_signal", () => validateSignal(signal));
          if (!validation.overallValid) {
            outreachFailed += 1;
            await logAudit(runId, "signal_validation_failed", { signalId: signal.id, companyName, payload: { validation: (validation as any).results, sourceDomain, signalType } }, "failed");
            await safeQueue("validation_failed", signal.id, companyName, {
              sourceUrl,
              sourceDomain,
              signalType,
              failedKeys: Object.keys((validation as any).results || {}).filter((k) => (validation as any).results?.[k]?.passed === false),
            });
            return;
          }

          const dup = checkDuplicateAgainstKnowledge(signal, knowledgeMap);
          if ((dup as any).ambiguous || (dup as any).isDuplicate) {
            await logAudit(runId, (dup as any).ambiguous ? "duplicate_ambiguous" : "duplicate_skipped", { signalId: signal.id, companyName, payload: { dup, sourceUrl, sourceDomain, signalType } });
            await safeQueue("duplicate_candidate", signal.id, companyName, { reason: (dup as any).reason, evidence: (dup as any).evidence, sourceUrl, sourceDomain, signalType });
            return;
          }

          radarMatchAttempted += 1;
          bump(radarAttemptedByType, signalType);

          const companyKey = normalizeCompany(companyName);
          const poolSize = companyKey ? (radarIndex.get(companyKey)?.length ?? 0) : 0;

          radarPoolSizes.push(poolSize);
          const poolArr = radarPoolSizesByType.get(signalType) ?? [];
          poolArr.push(poolSize);
          radarPoolSizesByType.set(signalType, poolArr);

          const radarMatch = await getBestRadarMatch(signal, radarIndex, runId, embeddingCache);
          if (radarMatch) {
            radarMatchHits += 1;
            bump(radarHitsByType, signalType);
            bump(radarMatchHitsByOrigin, String(radarMatch.__origin ?? "unknown"));
          }

          const knowledgeMatch = await getBestKnowledgeMatch(knowledgeMap, companyName, runId, embeddingCache);
          const ruleDecision = buildRuleDecision(signal, radarMatch, thresholds, knowledgeMatch);

          let best = ruleDecision;

          if (stormMode) {
            aiSkippedStorm += 1;
          } else if (aiAttemptedCalls >= AI_BUDGET_CEILING) {
            aiSkippedBudget += 1;
          } else {
            const agents = await Promise.all([
              runAiCall("ai_value", () => nexoraAIAnalysis({ ...signal, agent: "value-forecaster", fallbackDecision: ruleDecision })),
              runAiCall("ai_risk", () => nexoraAIAnalysis({ ...signal, agent: "risk-analyst", fallbackDecision: ruleDecision })),
              runAiCall("ai_intent", () => nexoraAIAnalysis({ ...signal, agent: "intent-detector", fallbackDecision: ruleDecision })),
              runAiCall("ai_market", () => nexoraAIAnalysis({ ...signal, agent: "market-dynamics", fallbackDecision: ruleDecision })),
            ]);

            for (const a of agents) {
              if (!a) continue;
              const normalized = normalizeAIDecision(a, ruleDecision);
              if (normalized.confidence > best.confidence) best = normalized;
            }
          }

          const finalDecision = finalizeDecision(ruleDecision, best);

          decisionedCount += 1;
          if (finalDecision.action !== ruleDecision.action || finalDecision.priority !== ruleDecision.priority) {
            disagreementCount += 1;
          }

          bump(decisionCountsByAction, finalDecision.action);
          bump(decisionCountsByPriority, finalDecision.priority);

          const winRate = (knowledgeMatch as any)?.winRate ?? 0.5;
          if (detectAnomaly(signal, winRate)) {
            anomalyCount += 1;
            await safeQueue("anomaly", signal.id, companyName, { sourceUrl, sourceDomain, signalType, finalDecision });
          }

          const safelyPush = async (action: "pipeline" | "radar"): Promise<boolean> => {
            if (stormMode || config.autoPushDisabled) return false;

            const approval = await requireApproval(runId, signal, action, finalDecision, config);
            if (!approval.allowed) return false;

            const key = getIdempotencyKey(signal, action);
            const claimed = await claimIdempotencyKey(key, action, signal.id, companyName);
            if (!claimed) return false;

            try {
              if (action === "pipeline") {
                await op("push_pipeline", () =>
                  withIntelligentRetry(() => pushDealHunterToPipeline(signal.id), "push_pipeline", config.maxRetriesPerOperation, retryCounter, config.timeoutMs.pushAction),
                );
              } else {
                await op("push_radar", () =>
                  withIntelligentRetry(() => pushDealHunterToRadar(signal.id), "push_radar", config.maxRetriesPerOperation, retryCounter, config.timeoutMs.pushAction),
                );
              }
              if (
                finalDecision.priority === "critical" ||
                finalDecision.priority === "high"
              ) {
                const leadPhone =
                  (signal as any).contactPhone ||
                  (signal as any).phone ||
                  (signal as any).whatsappNumber ||
                  null;

                if (leadPhone) {
                  const whatsappResult = await sendAIWhatsAppMessage({
                    toE164: leadPhone,
                    audience: "customer",
                    recipientName:
                      (signal as any).contactName ||
                      (signal as any).decisionMaker ||
                      undefined,
                    recipientCompany: companyName,
                    city: (signal as any).city || undefined,
                    contextType: "office_move_signal",
                    contextSummary: `We picked up a strong workspace change signal for ${companyName}${
                      (signal as any).city ? ` in ${(signal as any).city}` : ""
                    }. We help teams plan and furnish new offices, expansions, and relocations quickly.`,
                    callToAction:
                      "Would it help if I sent through a quick layout-plan option for the space?",
                  });

                  await logAudit(runId, "ai_whatsapp_attempt", {
                    signalId: signal.id,
                    companyName,
                    payload: {
                      sent: whatsappResult.sent,
                      success: whatsappResult.success,
                      reason: whatsappResult.reason ?? null,
                    },
                  });
                }
              }
              return true;
            } catch (err) {
              await completeIdempotencyKey(key, "failed");
              return false;
            }
          };

          const shouldPushPipeline =
            finalDecision.action === "pipeline" || finalDecision.action === "both";
          const shouldPushRadar =
            finalDecision.action === "radar" || finalDecision.action === "both";

          const [pushedPipeline, pushedRadar] = await Promise.all([
            shouldPushPipeline ? safelyPush("pipeline") : Promise.resolve(false),
            shouldPushRadar ? safelyPush("radar") : Promise.resolve(false),
          ]);

          const webhookTelemetry: WebhookSignalTelemetry =
            finalDecision.priority === "critical" && (pushedPipeline || pushedRadar)
              ? await sendCriticalWebhook(signal, finalDecision)
              : { webhookAttempted: false, webhookSucceeded: false, webhookFailed: false };

          const webhookSent = webhookTelemetry.webhookSucceeded === true;

          if (shouldPushPipeline && !pushedPipeline) outreachFailed += 1;
          if (shouldPushRadar && !pushedRadar) outreachFailed += 1;

          if (!config.vectorSyncDisabled && !stormMode) {
            const release = await vectorSemaphore.acquire();
            try {
              const canonicalKey =
                (validation as any).canonicalCompanyKey || companyKey;

              const emb = await getCachedEmbedding(embeddingCache, canonicalKey);

              const vectorResult = await op("vector_upsert", () =>
                upsertToVectorDB(
                  (validation as any).duplicateKey,
                  emb.vector,
                  { companyName, companyKey, sourceUrl, sourceDomain, signalType },
                  config
                )
              );

              if (vectorResult.errors?.length) {
                await logAudit(
                  runId,
                  "vector_sync_warning",
                  { signalId: signal.id, companyName, payload: { vectorResult } },
                  "failed"
                );
              }
            } finally {
              release();
            }
          }
          const kbKey = (validation as any).duplicateKey;
          const embeddingResult = await getCachedEmbedding(embeddingCache, (validation as any).canonicalCompanyKey || companyKey);

          const existing: any =
            knowledgeMap.get(kbKey) ??
            ({
              embedding: embeddingResult.vector,
              lastScore: 0,
              winRate: 0.5,
              count: 0,
              lastSeen: Date.now(),
              companyKey: (validation as any).canonicalCompanyKey,
              companyName,
              latestSourceUrl: sourceUrl,
              latestSignalType: signalType || null,
              embeddingMode: embeddingResult.mode,
              embeddingInput: (validation as any).canonicalCompanyKey,
              seenFingerprints: [],
            } as any);

          const success = pushedPipeline || pushedRadar;
          existing.count += 1;
          existing.lastScore = finalDecision.confidence;
          existing.winRate = (existing.winRate * (existing.count - 1) + (success ? 1 : 0)) / existing.count;
          existing.embedding = embeddingResult.vector;
          existing.lastSeen = Date.now();
          existing.companyKey = (validation as any).canonicalCompanyKey;
          existing.companyName = companyName;
          existing.latestSourceUrl = sourceUrl;
          existing.latestSignalType = signalType || null;
          existing.embeddingMode = embeddingResult.mode;
          existing.embeddingInput = (validation as any).canonicalCompanyKey;

          knowledgeMap.set(kbKey, existing);

          await recordDecisionRecord({
            runId,
            signalId: signal.id,
            companyName,
            idempotencyKey: getIdempotencyKey(signal, `decision:${finalDecision.action}`),
            ruleDecision,
            ensembleDecision: best,
            finalDecision,
            pushedPipeline,
            pushedRadar,
            webhookSent,
          });

          await logAudit(runId, "decision_made", {
            signalId: signal.id,
            companyName,
            payload: {
              sourceUrl,
              sourceDomain,
              signalType,
              radarMatch: radarMatch
                ? { companyName: radarMatch.companyName, radarScore: (radarMatch as any).radarScore ?? null, origin: radarMatch.__origin ?? null }
                : null,
              ruleDecision,
              ensembleDecision: best,
              finalDecision,
              pushedPipeline,
              pushedRadar,
              webhookSent,
              webhook: {
                webhookAttempted: webhookTelemetry.webhookAttempted,
                webhookSucceeded: webhookTelemetry.webhookSucceeded,
                webhookFailed: webhookTelemetry.webhookFailed,
                webhookStatus: webhookTelemetry.webhookStatus,
                webhookErrorClass: webhookTelemetry.webhookErrorClass,
              },
            },
          });

            // ─────────────────────────────────────────────────────────────────────────────
            // Per-signal processing (inside your Promise.all(map(async (signal) => { ... })))
            // ─────────────────────────────────────────────────────────────────────────────

            try {
              // whatever logic was above (your signal processing block)
              // must define: companyName, success, finalDecision, pushedPipeline, pushedRadar, webhookSent

              const estimatedValue = safeNumber((signal as any).estimatedProjectValue);

              decisions.push({
                companyName,
                success,
                decision: finalDecision,
                estimatedValue,
                pushedPipeline,
                pushedRadar,
                webhookSent,
              });

              results.push({
                decision: finalDecision,
                estimatedValue,
                pushedPipeline,
                pushedRadar,
                webhookSent,
              });
            } catch (err: any) {
              outreachFailed += 1;
              errors.push(`signal processing failed: ${err?.message ?? String(err)}`);
              markError(err, "signal_processing");
            } finally {
              release();
            }
        } catch (err: any) {
          outreachFailed += 1;
          errors.push(`signal processing failed: ${(err as any)?.message ?? String(err)}`);
          markError(err, "signal_processing");
          release();
        }
      }),
    );

    await saveKnowledgeMap(knowledgeMap);

                const pipelinePushes = decisions.filter((d) => d.pushedPipeline).length;
                const radarPushes = decisions.filter((d) => d.pushedRadar).length;
                const criticalCount = decisions.filter(
                  (d) => d.decision.priority === "critical",
                ).length;
                const projectedValue = decisions.reduce(
                  (sum, d) => sum + d.estimatedValue,
                  0,
                );

                const durationMs = Date.now() - start;
                const avgDecisionMs = decisions.length
                  ? Math.round(durationMs / decisions.length)
                  : 0;

                const radarMatchMisses = Math.max(
                  0,
                  radarMatchAttempted - radarMatchHits,
                );
                const radarMatchHitRate = radarMatchAttempted
                  ? radarMatchHits / radarMatchAttempted
                  : 0;

                const overallPool = calcPoolStats(radarPoolSizes);

                const radarMatchCandidatePoolBySignalType: Record<
                  string,
                  RadarPoolStats
                > = {};

                for (const [t, samples] of radarPoolSizesByType.entries()) {
                  radarMatchCandidatePoolBySignalType[t] = calcPoolStats(samples);
                }

                const radarMatchBySignalType: Record<
                  string,
                  RadarMatchTypeStats
                > = {};

                for (const [t, pool] of Object.entries(
                  radarMatchCandidatePoolBySignalType,
                )) {
                  const attempted = radarAttemptedByType[t] ?? 0;
                  const hits = radarHitsByType[t] ?? 0;
                  const misses = Math.max(0, attempted - hits);
                  const hitRate = attempted ? hits / attempted : 0;

                  radarMatchBySignalType[t] = {
                    attempted,
                    hits,
                    misses,
                    hitRate,
                    pool,
                  };
                }

                const retriesByOperation: CounterMap = {
                  ...opCallCounts,
                  _totalRetries: retryCounter.value,
                };

                const ruleVsAiDisagreementRate = decisionedCount
                  ? disagreementCount / decisionedCount
                  : 0;

                await logAudit(runId, "run_summaries", {
                  payload: {
                    radar: {
                      usableCandidates: mergedRadarUnique.length,
                      matchAttempted: radarMatchAttempted,
                      hits: radarMatchHits,
                      misses: radarMatchMisses,
                      hitRate: radarMatchHitRate,
                      pool: overallPool,
                      poolBySignalType: radarMatchCandidatePoolBySignalType,
                      matchBySignalType: radarMatchBySignalType,
                      hitsByOrigin: radarMatchHitsByOrigin,
                    },
                    deals: {
                      raw: scannedDeals,
                      afterFilter: dealsAfterFilter,
                    },
                    decisions: {
                      countsByAction: decisionCountsByAction,
                      countsByPriority: decisionCountsByPriority,
                      ruleVsAiDisagreementRate,
                    },
                    webhook: {
                      attempted: webhookAttempted,
                      succeeded: webhookSucceeded,
                      failed: webhookFailed,
                    },
                    ai: {
                      attemptedCalls: aiAttemptedCalls,
                      skippedBudget: aiSkippedBudget,
                      skippedStorm: aiSkippedStorm,
                      concurrencyLimit: AI_CONCURRENCY_LIMIT,
                      budgetCeiling: AI_BUDGET_CEILING,
                      errorsByClass: aiErrorsByClass,
                    },
                    failures: {
                      errorsByClass: errorCountsByClass,
                      timeoutsByOperation,
                      retriesByOperation,
                      totalRetries: retryCounter.value,
                    },
                    learning: {
                      sampleSize,
                      avgWinRate,
                      appliedDeltaStrongPipeline: appliedDelta,
                      maxDriftPerRun: MAX_DRIFT_PER_RUN,
                    },
                    pushes: {
                      pipeline: pipelinePushes,
                      radar: radarPushes,
                    },
                    stormMode,
                  },
                });

                return {
                  runId,
                  success: errors.length === 0,
                  processed: mergedRadarUnique.length + dealsAfterFilter,
                  outreachRuns: pipelinePushes,
                  outreachFailed,
                  radarSignals: mergedRadarUnique.length,
                  dealSignals: scannedDeals,
                  errors,
                  message:
                    errors.length > 0
                      ? `Nexora completed with ${errors.length} errors. radarUsable=${mergedRadarUnique.length} matchHitRate=${radarMatchHitRate.toFixed(
                          3,
                        )} webhookOk=${webhookSucceeded}/${webhookAttempted}`
                      : `Nexora completed. radarUsable=${mergedRadarUnique.length} matchHitRate=${radarMatchHitRate.toFixed(
                          3,
                        )} webhookOk=${webhookSucceeded}/${webhookAttempted}`,
                  durationMs,
                  intelligenceScore: 0,
                  telemetry: {
                    avgDecisionMs,
                    peakConcurrency: config.maxConcurrency,
                    totalRetries: retryCounter.value,
                    adaptationEvents: Math.max(
                      0,
                      Math.round(Math.abs(appliedDelta) * 10),
                    ),
                    criticalOpportunities: criticalCount,
                    projectedPipelineValue: projectedValue,
                    anomalyCount,
                    selfEvolutions: 0,
                    kbHealthScore: 0,

                    radarMatchAttempted,
                    radarMatchHits,
                    radarMatchMisses,
                    radarMatchHitRate,

                    radarMatchCandidatePoolAvg: overallPool.avg,
                    radarMatchCandidatePoolP50: overallPool.p50,
                    radarMatchCandidatePoolP90: overallPool.p90,
                    radarMatchCandidatePoolMax: overallPool.max,

                    radarMatchCandidatePoolBySignalType,
                    radarMatchBySignalType,

                    radarMatchHitsByOrigin: radarMatchHitsByOrigin,
                    decisionCountsByAction,
                    decisionCountsByPriority,
                    ruleVsAiDisagreementRate,

          webhookAttempted,
          webhookSucceeded,
          webhookFailed,

          ai: {
            attemptedCalls: aiAttemptedCalls,
            skippedBudget: aiSkippedBudget,
            skippedStorm: aiSkippedStorm,
            concurrencyLimit: AI_CONCURRENCY_LIMIT,
            budgetCeiling: AI_BUDGET_CEILING,
            errorsByClass: aiErrorsByClass,
          },

          retriesByOperation,
          timeoutsByOperation,
          errorCountsByClass,
          } as any,
        };
  };
  try {
    return await withTimeout(runCore(), RUN_TIMEOUT_MS, "nexora_run");
  } catch (err) {
          const cls = classifyError(err);
          errors.push(`run failed: ${String(err)}`);

          await logAudit(runId, "run_failed", {
          payload: {
          errorClass: cls,
          error: String(err),
          },
          });

          return {
          runId,
          success: false,
          processed: 0,
          outreachRuns: 0,
          outreachFailed: 0,
          radarSignals: 0,
          dealSignals: 0,
          errors,
          message: `Nexora run failed (${cls})`,
          durationMs: Date.now() - start,
          intelligenceScore: 0,
          telemetry: {
          avgDecisionMs: 0,
          peakConcurrency: config.maxConcurrency,
          totalRetries: retryCounter.value,
          adaptationEvents: 0,
          criticalOpportunities: 0,
          projectedPipelineValue: 0,
          anomalyCount: 0,
          selfEvolutions: 0,
          kbHealthScore: 0,

          radarMatchAttempted: 0,
          radarMatchHits: 0,
          radarMatchMisses: 0,
          radarMatchHitRate: 0,

          radarMatchCandidatePoolAvg: 0,
          radarMatchCandidatePoolP50: 0,
          radarMatchCandidatePoolP90: 0,
          radarMatchCandidatePoolMax: 0,

          radarMatchCandidatePoolBySignalType: {},
          radarMatchBySignalType: {},
          radarMatchHitsByOrigin: {},

          decisionCountsByAction: {},
          decisionCountsByPriority: {},
          ruleVsAiDisagreementRate: 0,

          webhookAttempted: 0,
          webhookSucceeded: 0,
          webhookFailed: 0,

          ai: {
            attemptedCalls: 0,
            skippedBudget: 0,
            skippedStorm: 0,
            concurrencyLimit: AI_CONCURRENCY_LIMIT,
            budgetCeiling: AI_BUDGET_CEILING,
            errorsByClass: {},
          },

          retriesByOperation: getRetryStatsSnapshot(),
          timeoutsByOperation: {},
          errorCountsByClass: { [cls]: 1 },
          },
          };

          } finally {
          backgroundState.running = false;

          try {
          await releaseRunLock(runId);
          } catch (e) {
          console.warn("[Nexora] Failed to release run lock:", e);
          }
          }
          }