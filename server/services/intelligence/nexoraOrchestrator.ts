import {
  runNewsFeedScan,
  runJobSignalScan,
  runPredictiveScan,
} from "../newsFeedScanner";
import { runOfficeMovRadarScan } from "../officeMovRadarService";
import {
  pushDealHunterToPipeline,
  pushDealHunterToRadar,
  runDealHunterScan,
} from "../dealHunter";
import { storage } from "../../storage";
import { scheduleJob, QUEUES } from "../jobOrchestrator";
import { nexoraAIAnalysis } from "../nexoraAI";
import {
  acquireRunLock,
  buildRuleDecision,
  checkDuplicateAgainstKnowledge,
  claimIdempotencyKey,
  completeIdempotencyKey,
  computeSignalFingerprint,
  createAuditLog,
  detectAnomaly,
  ensureNexoraReady,
  finalizeDecision,
  fireWebhook,
  loadAdaptiveThresholds,
  loadKnowledgeMap,
  releaseRunLock,
  saveAdaptiveThresholds,
  saveKnowledgeMap,
  syncVectorKnowledge,
  upsertDecisionRecord,
  upsertKnowledgeEntry,
  validateSignal,
} from "./nexora/nexora-support";
import type {
  AdaptiveThresholds,
  DealHunterSignalLike,
  KnowledgeEntry,
  NexoraConfig,
  NexoraDecisionAction,
  NexoraDecisionRecordLike,
  NexoraEngineLearningSummary,
  NexoraEngineResult,
  NexoraPriority,
  NexoraResult,
  NexoraRunContext,
  NexoraSignalLike,
  NormalizedAIDecision,
  RadarSignalLike,
  RetryCounter,
  ValidationResult,
} from "./nexora/nexora-types";

/* =====================================================================================
 * Nexora Orchestrator
 * -------------------------------------------------------------------------------------
 * Purpose:
 * - single trustworthy runtime entrypoint
 * - fixes broken backgroundState handling
 * - fixes undefined results / learning vars
 * - isolates scanning from processing
 * - keeps legacy cycle wrapper compatibility
 * ===================================================================================== */

const DEFAULT_CONFIG: NexoraConfig = {
  enabled: true,
  maxSignalsPerRun: 50,
  maxAiAnalysesPerRun: 20,
  aiEnsembleMinPriority: "high",
  maxConcurrentSignalTasks: 4,
  backgroundIntervalMs: 5 * 60 * 1000,
  reviewQueueEnabled: true,
  pipelinePushEnabled: true,
  radarPushEnabled: true,
  webhookEnabled: true,
  whatsappEnabled: true,
  vectorSyncEnabled: true,
  anomalyDetectionEnabled: true,
  learningEnabled: true,
};

const MAX_DRIFT_PER_RUN = 3;

type BackgroundState = {
  enabled: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastRunId: string | null;
  lastError: string | null;
};

type ProcessedSignalResult = {
  signalId: string;
  companyName: string;
  sourceType: "radar" | "deal";
  fingerprint: string;
  estimatedValue: number;
  pushedPipeline: boolean;
  pushedRadar: boolean;
  webhookSent: boolean;
  whatsappSent: boolean;
  vectorSynced: boolean;
  duplicate: boolean;
  reviewed: boolean;
  finalDecision: NexoraDecisionRecordLike;
  aiUsed: boolean;
  validation: ValidationResult;
};

type ScanBatch = {
  radarSignals: RadarSignalLike[];
  dealSignals: DealHunterSignalLike[];
};

const backgroundState: BackgroundState = {
  enabled: false,
  running: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastRunId: null,
  lastError: null,
};

let backgroundTimer: NodeJS.Timeout | null = null;

/* =====================================================================================
 * Public status
 * ===================================================================================== */

export function isNexoraCycleRunning(): boolean {
  return backgroundState.running;
}

export function getNexoraBackgroundState(): BackgroundState {
  return { ...backgroundState };
}

/* =====================================================================================
 * Background runner
 * ===================================================================================== */

export function startNexoraBackground(
  config: Partial<NexoraConfig> = {},
): { started: boolean; intervalMs: number } {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const intervalMs = Math.max(30_000, merged.backgroundIntervalMs ?? DEFAULT_CONFIG.backgroundIntervalMs);

  if (backgroundTimer) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }

  backgroundState.enabled = true;
  backgroundState.lastError = null;

  backgroundTimer = setInterval(async () => {
    if (!backgroundState.enabled) return;
    if (backgroundState.running) return;

    try {
      await runNexoraCycle("background", merged);
    } catch (error) {
      backgroundState.lastError =
        error instanceof Error ? error.message : "Unknown background run error";
    }
  }, intervalMs);

  return {
    started: true,
    intervalMs,
  };
}

export function stopNexoraBackground(): { stopped: boolean } {
  backgroundState.enabled = false;

  if (backgroundTimer) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }

  return { stopped: true };
}

/* =====================================================================================
 * Legacy compatibility
 * ===================================================================================== */

export async function runNexoraCycle(
  trigger: NexoraRunContext["trigger"] = "manual",
  config: Partial<NexoraConfig> = {},
): Promise<NexoraEngineResult> {
  return runNexoraEngine({
    trigger,
    config,
  });
}

/* =====================================================================================
 * Main engine
 * ===================================================================================== */

export async function runNexoraEngine(input?: {
  trigger?: NexoraRunContext["trigger"];
  config?: Partial<NexoraConfig>;
}): Promise<NexoraEngineResult> {
  const config: NexoraConfig = {
    ...DEFAULT_CONFIG,
    ...(input?.config ?? {}),
  };

  if (!config.enabled) {
    return {
      ok: false,
      runId: null,
      trigger: input?.trigger ?? "manual",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totals: emptyTotals(),
      learning: emptyLearning(),
      results: [],
      errors: ["Nexora is disabled"],
    };
  }

  if (backgroundState.running) {
    return {
      ok: false,
      runId: null,
      trigger: input?.trigger ?? "manual",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totals: emptyTotals(),
      learning: emptyLearning(),
      results: [],
      errors: ["Nexora run already in progress"],
    };
  }

  const startedAt = new Date();
  const trigger = input?.trigger ?? "manual";
  const runId = `nexora_${startedAt.getTime()}`;

  backgroundState.running = true;
  backgroundState.lastStartedAt = startedAt.toISOString();
  backgroundState.lastRunId = runId;
  backgroundState.lastError = null;

  let runLock: Awaited<ReturnType<typeof acquireRunLock>> | null = null;

  try {
    await ensureNexoraReady();

    runLock = await acquireRunLock({
      key: "nexora-engine",
      runId,
      ttlSeconds: 15 * 60,
    });

    if (!runLock?.acquired) {
      return {
        ok: false,
        runId,
        trigger,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        totals: emptyTotals(),
        learning: emptyLearning(),
        results: [],
        errors: ["Could not acquire Nexora run lock"],
      };
    }

    await createAuditLog({
      runId,
      level: "info",
      event: "nexora_run_started",
      message: `Nexora run started via ${trigger}`,
      meta: { trigger },
    });

    const knowledgeMap = await loadKnowledgeMap();
    const thresholds = await loadAdaptiveThresholds();

    const scanBatch = await collectSignals(config, runId);
    const normalizedSignals = normalizeSignals(scanBatch)
      .slice(0, Math.max(1, config.maxSignalsPerRun));

    const retryCounter: RetryCounter = {};
    const results: ProcessedSignalResult[] = [];

    let aiCallsUsed = 0;

    for (const signal of normalizedSignals) {
      const aiAllowedForSignal =
        aiCallsUsed < config.maxAiAnalysesPerRun &&
        shouldUseAI(signal, config);

      const processed = await processSignal({
        runId,
        signal,
        thresholds,
        knowledgeMap,
        config,
        retryCounter,
        aiAllowed: aiAllowedForSignal,
      });

      if (processed.aiUsed) {
        aiCallsUsed += processed.finalDecision.aiAnalysesUsed ?? 1;
      }

      results.push(processed);
    }

    const learning = config.learningEnabled
      ? await applyLearningFromRun({
          thresholds,
          results,
          runId,
        })
      : emptyLearning();

    if (config.learningEnabled && learning.sampleSize > 0) {
      const reason = learning.appliedDeltaStrongPipeline !== 0
        ? `winRate=${(learning.avgWinRate * 100).toFixed(0)}% → strongPipeline adjusted by ${learning.appliedDeltaStrongPipeline > 0 ? '+' : ''}${learning.appliedDeltaStrongPipeline}`
        : `winRate=${(learning.avgWinRate * 100).toFixed(0)}% — no adjustment needed`;
      await saveAdaptiveThresholds(
        thresholds,
        reason,
        learning.avgWinRate,
        learning.sampleSize,
      );
    }

    await saveKnowledgeMap(knowledgeMap);

    const finishedAt = new Date();

    await createAuditLog({
      runId,
      level: "info",
      event: "nexora_run_finished",
      message: "Nexora run completed",
      meta: {
        totals: buildTotals(results, normalizedSignals.length, aiCallsUsed),
        learning,
      },
    });

    return {
      ok: true,
      runId,
      trigger,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totals: buildTotals(results, normalizedSignals.length, aiCallsUsed),
      learning,
      results: results.map(toPublicResult),
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Nexora error";
    backgroundState.lastError = message;

    await createAuditLog({
      runId,
      level: "error",
      event: "nexora_run_failed",
      message,
      meta: {
        trigger,
      },
    }).catch(() => undefined);

    return {
      ok: false,
      runId,
      trigger,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      totals: emptyTotals(),
      learning: emptyLearning(),
      results: [],
      errors: [message],
    };
  } finally {
    if (runLock?.acquired) {
      await releaseRunLock({
        key: "nexora-engine",
        runId,
      }).catch(() => undefined);
    }

    backgroundState.running = false;
    backgroundState.lastFinishedAt = new Date().toISOString();
  }
}

/* =====================================================================================
 * Scanning
 * ===================================================================================== */

async function collectSignals(
  config: NexoraConfig,
  runId: string,
): Promise<ScanBatch> {
  // Run all scanners in parallel.
  // NOTE: news/job/predictive scanners save to DB and return {saved, processed}.
  //       DealHunter saves to DB and returns {signals: DealHunterSignal[], ...}.
  //       OfficeMovRadar is synthetic and returns an array directly.
  // We run the scanners first to ensure fresh data is in DB, then query.
  const allowSynthetic = process.env.ALLOW_SYNTHETIC_INTELLIGENCE === "true";
  const [officeRadarResult, , , , dealHunterResult] = await Promise.all([
    allowSynthetic
      ? runOfficeMovRadarScan?.().catch((err: unknown) => {
          console.warn(`[Nexora] runOfficeMovRadarScan failed: ${(err as Error)?.message}`);
          return [] as RadarSignalLike[];
        })
      : Promise.resolve([] as RadarSignalLike[]),
    runNewsFeedScan?.().catch((err: unknown) => {
      console.warn(`[Nexora] runNewsFeedScan failed: ${(err as Error)?.message}`);
    }),
    runJobSignalScan?.().catch((err: unknown) => {
      console.warn(`[Nexora] runJobSignalScan failed: ${(err as Error)?.message}`);
    }),
    runPredictiveScan?.().catch((err: unknown) => {
      console.warn(`[Nexora] runPredictiveScan failed: ${(err as Error)?.message}`);
    }),
    runDealHunterScan?.().catch((err: unknown) => {
      console.warn(`[Nexora] runDealHunterScan failed: ${(err as Error)?.message}`);
      return { signals: [] as DealHunterSignalLike[], created: 0, deduplicated: 0 };
    }),
  ]);

  // OfficeMovRadar returns an array of OfficeMovRadar[] (synthetic AI data)
  const syntheticRadar: RadarSignalLike[] = Array.isArray(officeRadarResult)
    ? (officeRadarResult as RadarSignalLike[])
    : [];

  // DealHunter returns { signals: DealHunterSignal[] }
  const dealSignalsFromRun: DealHunterSignalLike[] =
    Array.isArray((dealHunterResult as any)?.signals)
      ? (dealHunterResult as any).signals
      : [];

  // Query DB for unpushed deal hunter signals (not yet pushed to pipeline OR radar)
  let dbDealSignals: DealHunterSignalLike[] = [];
  try {
    const allDealSignals = await storage.getDealHunterSignals({
      status: "new",
      pushedToPipeline: false,
    });
    // Only include signals not yet pushed to radar either
    const unpushed = allDealSignals.filter((s) => !(s as any).pushedToRadar);
    // Limit to most recent 30 to avoid overwhelming the run
    dbDealSignals = unpushed.slice(0, 30);
  } catch (err: unknown) {
    console.warn(`[Nexora] DB deal signal query failed: ${(err as Error)?.message}`);
  }

  // Merge deal signals — prefer DB ones, dedupe by id
  const seenDealIds = new Set<string>();
  const dealSignals: DealHunterSignalLike[] = [];
  for (const s of [...dealSignalsFromRun, ...dbDealSignals]) {
    const id = (s as any).id ?? (s as any).signalId;
    if (id && seenDealIds.has(String(id))) continue;
    if (id) seenDealIds.add(String(id));
    dealSignals.push(s);
  }

  // Also query recent office move radar records from DB (non-synthetic if any)
  let dbRadarSignals: RadarSignalLike[] = [];
  try {
    // DB stores status as "New" (capital N), not "new"
    const allRadar = await storage.getOfficeMovRadarRecords({ status: "New" });
    dbRadarSignals = allRadar
      .filter((r) => (r as any).verificationStatus !== "synthetic")
      .slice(0, 30) as unknown as RadarSignalLike[];
  } catch (err: unknown) {
    console.warn(`[Nexora] DB radar signal query failed: ${(err as Error)?.message}`);
  }

  const radarSignals: RadarSignalLike[] = [...syntheticRadar, ...dbRadarSignals];

  console.log(`[Nexora] collectSignals complete: ${radarSignals.length} radar + ${dealSignals.length} deal signals`);

  return {
    radarSignals,
    dealSignals,
  };
}

function normalizeSignals(batch: ScanBatch): NexoraSignalLike[] {
  const radar: NexoraSignalLike[] = batch.radarSignals.map((signal) => ({
    ...signal,
    __sourceType: "radar" as const,
  }));

  const deals: NexoraSignalLike[] = batch.dealSignals.map((signal) => ({
    ...signal,
    __sourceType: "deal" as const,
  }));

  return [...radar, ...deals].sort((a, b) => {
    const aPriority = priorityRank(inferPriority(a));
    const bPriority = priorityRank(inferPriority(b));
    return bPriority - aPriority;
  });
}

/* =====================================================================================
 * Per-signal processing
 * ===================================================================================== */

async function processSignal(params: {
  runId: string;
  signal: NexoraSignalLike;
  thresholds: AdaptiveThresholds;
  knowledgeMap: Record<string, KnowledgeEntry>;
  config: NexoraConfig;
  retryCounter: RetryCounter;
  aiAllowed: boolean;
}): Promise<ProcessedSignalResult> {
  const { runId, signal, thresholds, knowledgeMap, config, retryCounter, aiAllowed } = params;

  const companyName = getCompanyName(signal);
  const sourceType = signal.__sourceType;
  const signalId = getSignalId(signal);
  const fingerprint = computeSignalFingerprint(signal);
  const estimatedValue = estimateSignalValue(signal);
  const validation = await validateSignal(signal);
  const duplicate = await checkDuplicateAgainstKnowledge({
    signal,
    fingerprint,
    knowledgeMap,
  });

  const idempotencyKey = `nexora:${sourceType}:${fingerprint}`;
  const idempotencyClaim = await claimIdempotencyKey({
    key: idempotencyKey,
    ttlSeconds: 60 * 60,
    meta: {
      runId,
      signalId,
      companyName,
    },
  });

  const anomaly = config.anomalyDetectionEnabled
    ? await detectAnomaly(signal, knowledgeMap)
    : null;

  const ruleDecision = buildRuleDecision({
    signal,
    thresholds,
    validation,
    duplicate,
    anomaly,
    estimatedValue,
  });

  let aiDecision: NormalizedAIDecision | null = null;
  let aiUsed = false;

  if (aiAllowed && shouldEscalateToAI(signal, ruleDecision, estimatedValue)) {
    aiDecision = await safeAIAnalysis({
      signal,
      estimatedValue,
      retryCounter,
      runId,
    });
    aiUsed = !!aiDecision;
  }

  const finalDecision = finalizeDecision({
    signal,
    ruleDecision,
    aiDecision,
    thresholds,
    validation,
    duplicate,
    anomaly,
    estimatedValue,
  });

  let pushedPipeline = false;
  let pushedRadar = false;
  let webhookSent = false;
  let whatsappSent = false;
  let vectorSynced = false;
  let reviewed = false;

  if (validation.valid && !duplicate && idempotencyClaim?.claimed) {
    if (config.pipelinePushEnabled && shouldPushPipeline(finalDecision)) {
      pushedPipeline = await pushToPipeline(signal, sourceType);
    }

    if (config.radarPushEnabled && shouldPushRadar(finalDecision)) {
      pushedRadar = await pushToRadar(signal, sourceType);
    }

    if (config.webhookEnabled && shouldFireWebhook(finalDecision)) {
      webhookSent = await safeWebhook({
        runId,
        signal,
        finalDecision,
        estimatedValue,
      });
    }

    if (config.whatsappEnabled && shouldSendWhatsapp(finalDecision)) {
      whatsappSent = await safeWhatsapp({
        runId,
        signal,
        finalDecision,
      });
    }

    if (config.vectorSyncEnabled && shouldSyncVector(finalDecision)) {
      vectorSynced = await safeVectorSync({
        signal,
        finalDecision,
      });
    }

    reviewed = finalDecision.action === "review";
  }

  const decisionRecord: NexoraDecisionRecordLike = {
    runId,
    signalId,
    sourceType,
    companyName,
    fingerprint,
    estimatedValue,
    validation,
    duplicate,
    aiAnalysesUsed: aiUsed ? 1 : 0,
    priority: finalDecision.priority,
    action: finalDecision.action,
    confidence: finalDecision.confidence,
    reasons: finalDecision.reasons ?? [],
    pushedPipeline,
    pushedRadar,
    webhookSent,
    whatsappSent,
    vectorSynced,
    createdAt: new Date().toISOString(),
  };

  await upsertDecisionRecord(decisionRecord);

  if (!duplicate && validation.valid) {
    await upsertKnowledgeEntry(
      buildKnowledgeEntry({
        signal,
        fingerprint,
        finalDecision,
        estimatedValue,
      }),
    );

    knowledgeMap[fingerprint] = buildKnowledgeEntry({
      signal,
      fingerprint,
      finalDecision,
      estimatedValue,
    });
  }

  // Only mark idempotency completed if an action was taken — 
  // "hold" signals should remain claimable so threshold recalibrations can act on them
  if (pushedPipeline || pushedRadar || reviewed) {
    await completeIdempotencyKey({
      key: idempotencyKey,
      meta: {
        runId,
        action: finalDecision.action,
        fingerprint,
      },
    }).catch(() => undefined);
  }

  return {
    signalId,
    companyName,
    sourceType,
    fingerprint,
    estimatedValue,
    pushedPipeline,
    pushedRadar,
    webhookSent,
    whatsappSent,
    vectorSynced,
    duplicate,
    reviewed,
    finalDecision: decisionRecord,
    aiUsed,
    validation,
  };
}

/* =====================================================================================
 * Learning
 * ===================================================================================== */

async function applyLearningFromRun(params: {
  thresholds: AdaptiveThresholds;
  results: ProcessedSignalResult[];
  runId: string;
}): Promise<NexoraEngineLearningSummary> {
  const { thresholds, results, runId } = params;

  const eligible = results.filter(
    (r) =>
      !r.duplicate &&
      r.validation.valid &&
      (r.pushedPipeline || r.pushedRadar || r.reviewed),
  );

  const runSampleSize = eligible.length;

  // Global outcome-driven learning: query nexora_outcomes directly.
  // This runs regardless of how many new signals were processed in the current run,
  // ensuring that accumulated real outcomes drive threshold adaptation even when
  // most signals are deduplicated.
  let avgWinRate = 0;
  let appliedDelta = 0;
  let contributing = 0;

  try {
    const { db: ddb } = await import("../../db");
    const { nexoraOutcomes } = await import("../../../shared/schema");
    const { gte } = await import("drizzle-orm");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOutcomes = await ddb
      .select({ outcome: nexoraOutcomes.outcome })
      .from(nexoraOutcomes)
      .where(gte(nexoraOutcomes.recordedAt, thirtyDaysAgo));

    contributing = recentOutcomes.length;

    if (contributing >= 3) {
      const WIN_OUTCOMES = ["won", "win", "meeting_booked", "replied", "interested"];
      const wins = recentOutcomes.filter(
        (o) => WIN_OUTCOMES.includes((o.outcome ?? "").toLowerCase()),
      ).length;
      avgWinRate = wins / contributing;

      if (avgWinRate >= 0.65) {
        appliedDelta = Math.min(MAX_DRIFT_PER_RUN, 1);
        thresholds.strongPipeline = Math.max(30, thresholds.strongPipeline - appliedDelta);
      } else if (avgWinRate <= 0.25) {
        appliedDelta = Math.min(MAX_DRIFT_PER_RUN, 1);
        thresholds.strongPipeline = Math.min(95, thresholds.strongPipeline + appliedDelta);
      }

      console.log(
        `[Nexora] Learning applied — ${contributing} outcomes | winRate=${(avgWinRate * 100).toFixed(0)}% | delta=${appliedDelta} | strongPipeline=${thresholds.strongPipeline}`,
      );
    } else {
      console.log(
        `[Nexora] Learning deferred — only ${contributing} outcome(s) in nexora_outcomes (need ≥3). Run had ${runSampleSize} eligible signal(s).`,
      );
    }
  } catch (err: any) {
    console.warn("[Nexora] Global outcome learning query failed (non-critical):", err?.message);
  }

  await createAuditLog({
    runId,
    level: "info",
    event: "nexora_learning_applied",
    message: "Learning update computed",
    meta: {
      runSampleSize,
      outcomeCount: contributing,
      avgWinRate,
      appliedDelta,
      maxDriftPerRun: MAX_DRIFT_PER_RUN,
    },
  });

  return {
    sampleSize: contributing,
    avgWinRate,
    appliedDeltaStrongPipeline: appliedDelta,
    maxDriftPerRun: MAX_DRIFT_PER_RUN,
  };
}

/* =====================================================================================
 * Actions
 * ===================================================================================== */

async function autoCreateOpportunity(
  signal: NexoraSignalLike,
  sourceType: "radar" | "deal",
): Promise<string | null> {
  try {
    const sig = signal as any;
    const { db: ddb } = await import("../../db");
    const { opportunities } = await import("../../../shared/schema");
    const { eq, and } = await import("drizzle-orm");

    const companyName = sig.companyName ?? sig.company ?? "Unknown";
    const normalizedName = String(companyName).toLowerCase().replace(/[^a-z0-9]/g, "");
    const sourceId = String(signal.id ?? "");

    // Idempotency: skip if opportunity already exists for this signal
    const existing = await ddb
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(eq(opportunities.sourceType, "nexora"), eq(opportunities.sourceId, sourceId)))
      .limit(1);
    if (existing.length > 0) return existing[0].id;

    const rawValue = sig.estimatedProjectValue ?? sig.value ?? 0;
    const estimatedValue = typeof rawValue === "number"
      ? rawValue
      : parseInt(String(rawValue ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
    const confidenceLevel = sig.confidenceLevel ?? "medium";
    const confidenceScore = confidenceLevel === "high" ? 80 : confidenceLevel === "low" ? 30 : 55;
    const opportunityScore = sig.radarScore ?? sig.opportunityScore ?? 60;

    const [created] = await ddb.insert(opportunities).values({
      sourceType: "nexora",
      sourceId,
      companyName,
      normalizedCompanyName: normalizedName,
      city: sig.city ?? null,
      state: sig.state ?? null,
      industry: sig.industry ?? null,
      projectType: sig.signalSubtype ?? sig.signalType ?? null,
      stage: "new",
      status: "open",
      opportunityScore,
      confidenceScore,
      urgencyScore: sig.urgencyScore ?? 0,
      estimatedValue: estimatedValue > 0 ? estimatedValue : null,
      reasoningSummary: sig.summaryReasoning ?? sig.aiSummary ?? `Nexora ${sourceType} push — ${sig.signalType ?? "signal"}`,
      lastActivityAt: new Date(),
    } as any).returning({ id: opportunities.id });

    console.log(`[Nexora] Auto-created opportunity for ${companyName} (signal ${sourceId})`);
    return created?.id ?? null;
  } catch (err: any) {
    console.warn(`[Nexora] autoCreateOpportunity failed (non-critical):`, err?.message);
    return null;
  }
}

/**
 * Public wrapper — creates a Nexora opportunity from an inbound lead or visitor session.
 * Safe to call from routes (non-blocking, never throws).
 */
export async function createOpportunityFromLead(opts: {
  companyName: string;
  city?: string | null;
  industry?: string | null;
  estimatedValue?: number | null;
  opportunityScore?: number | null;
  sourceType?: string;
  sourceId?: string;
  notes?: string | null;
}): Promise<string | null> {
  try {
    const { db: ddb } = await import("../../db");
    const { opportunities } = await import("../../../shared/schema");
    const { eq, and } = await import("drizzle-orm");

    const sourceType = opts.sourceType ?? "inbound_lead";
    const sourceId = opts.sourceId ?? `lead-${Date.now()}`;
    const normalizedName = String(opts.companyName).toLowerCase().replace(/[^a-z0-9]/g, "");

    const existing = await ddb
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(eq(opportunities.sourceType, sourceType), eq(opportunities.sourceId, sourceId)))
      .limit(1);
    if (existing.length > 0) return existing[0].id;

    const [created] = await ddb.insert(opportunities).values({
      sourceType,
      sourceId,
      companyName: opts.companyName,
      normalizedCompanyName: normalizedName,
      city: opts.city ?? null,
      industry: opts.industry ?? null,
      stage: "new",
      status: "open",
      opportunityScore: opts.opportunityScore ?? 50,
      confidenceScore: 60,
      urgencyScore: 0,
      estimatedValue: opts.estimatedValue ?? null,
      reasoningSummary: opts.notes ?? `${sourceType} — ${opts.companyName}`,
      lastActivityAt: new Date(),
    } as any).returning({ id: opportunities.id });

    console.log(`[Nexora] Opportunity created from ${sourceType} for ${opts.companyName}`);
    return created?.id ?? null;
  } catch (err: any) {
    console.warn(`[Nexora] createOpportunityFromLead failed (non-critical):`, err?.message);
    return null;
  }
}

const AUTO_QUOTE_CONFIDENCE_THRESHOLD = 80;

async function autoTriggerQuote(opportunityId: string, companyName: string, confidence: number): Promise<void> {
  try {
    const { storage } = await import("../../storage");
    const opp = await storage.getOpportunity(opportunityId);
    if (!opp || opp.stage === "quoted") return;

    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const existing = await storage.getQuotes();
    const seq = String(existing.length + 1).padStart(4, "0");
    const quoteNumber = `TCD-${ym}-${seq}`;
    const estimatedValue = opp.estimatedValue ? Number(opp.estimatedValue) : 0;
    const subtotal = estimatedValue;
    const gst = Math.round(subtotal * 0.1);

    await storage.createQuote({
      quoteNumber,
      status: "Draft",
      clientName: opp.contactName ?? opp.companyName,
      companyName: opp.companyName,
      email: opp.contactEmail ?? "tbc@placeholder.com",
      phone: opp.contactPhone ?? null,
      opportunityId: opp.id,
      projectSummary: opp.reasoningSummary ?? `Auto-drafted from Nexora opportunity — ${opp.projectType ?? opp.industry ?? "fitout"}`,
      subtotal,
      gst,
      total: subtotal,
      totalIncGst: subtotal + gst,
      pipelineStage: "lead",
      validityDays: 30,
      preparedBy: "The Corporate Desk (Nexora Auto-Draft)",
      notes: `Auto-generated at confidence ${confidence}. Company: ${opp.companyName}. Review and update line items before sending.`,
    });

    await storage.updateOpportunity(opp.id, { stage: "quoted" } as any).catch(() => undefined);
    console.log(`[AutoQuote] ✓ Quote generated for ${companyName} (opportunity ${opportunityId}) at confidence ${confidence}`);
  } catch (err: any) {
    console.warn(`[AutoQuote] Failed for opportunity ${opportunityId}: ${err.message}`);
  }
}

const AUTO_OUTREACH_CONFIDENCE_THRESHOLD = 50;

async function autoDiscoverAndOutreach(
  opportunityId: string,
  companyName: string,
  confidence: number,
): Promise<void> {
  try {
    const { discoverContactForOpportunity } = await import("../outreach/contactDiscoveryService");
    const discovery = await discoverContactForOpportunity(opportunityId);

    if (!discovery.contactId || !discovery.email) {
      console.log(`[AutoOutreach] No contact discovered for ${companyName} — skipping outreach`);
      return;
    }

    if (confidence < AUTO_OUTREACH_CONFIDENCE_THRESHOLD) {
      console.log(`[AutoOutreach] Confidence ${confidence} < ${AUTO_OUTREACH_CONFIDENCE_THRESHOLD} for ${companyName} — skipping outreach`);
      return;
    }

    const { createOutreachThread } = await import("../outreach/outreachEngine");
    const { db: ddb } = await import("../../db");
    const { opportunities: oppsTable } = await import("../../../shared/schema");
    const { eq } = await import("drizzle-orm");

    const [opp] = await ddb.select().from(oppsTable).where(eq(oppsTable.id, opportunityId)).limit(1);
    if (!opp) return;

    const threadId = await createOutreachThread({
      companyId: discovery.companyIntelligenceId ?? opp.companyId ?? opportunityId,
      companyName,
      city: opp.city,
      industry: opp.industry,
      contactId: discovery.contactId,
      opportunityId,
      opportunityScore: confidence,
      relocationProbability: opp.relocationProbability ?? undefined,
      signals: [],
    });

    console.log(`[AutoOutreach] ✓ Thread ${threadId.slice(0, 8)} created for ${companyName} (contact: ${discovery.email}, confidence: ${confidence})`);
  } catch (err: any) {
    console.warn(`[AutoOutreach] Failed for ${companyName}: ${err.message}`);
  }
}

async function pushToPipeline(
  signal: NexoraSignalLike,
  sourceType: "radar" | "deal",
): Promise<boolean> {
  try {
    const sig = signal as any;
    const sigConfidence = sig.confidenceScore ?? (sig.confidenceLevel === "high" ? 80 : sig.confidenceLevel === "low" ? 30 : 55);
    const companyNameForQuote = sig.companyName ?? sig.company ?? "Unknown";

    if (sourceType === "deal") {
      await pushDealHunterToPipeline(signal.id);
      const oppId = await autoCreateOpportunity(signal, sourceType);
      if (oppId) {
        autoDiscoverAndOutreach(oppId, companyNameForQuote, sigConfidence).catch(() => undefined);
        if (sigConfidence >= AUTO_QUOTE_CONFIDENCE_THRESHOLD) {
          autoTriggerQuote(oppId, companyNameForQuote, sigConfidence).catch(() => undefined);
        }
      }
      return true;
    }
    if (sourceType === "radar") {
      const radarSig = signal as any;
      const rawValue = radarSig.estimatedProjectValue;
      const parsedValue = typeof rawValue === "number"
        ? rawValue
        : parseInt(String(rawValue ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
      await storage.createProspectedLead({
        company: radarSig.companyName ?? "Unknown",
        domain: null,
        website: null,
        location: [radarSig.city, radarSig.state].filter(Boolean).join(", ") || "Australia",
        industry: radarSig.industry ?? "Unknown",
        estimatedTeamSize: "Unknown",
        likelyOfficeNeed: radarSig.signalSubtype ?? radarSig.signalType ?? "Unknown",
        signalsDetected: [radarSig.signalType ?? "radar"],
        estimatedProjectValue: parsedValue > 0 ? `$${parsedValue.toLocaleString()}` : "$0",
        score: radarSig.radarScore ?? 50,
        priority: radarSig.confidenceLevel === "high" ? "High" : radarSig.confidenceLevel === "low" ? "Low" : "Medium",
        nexoraSignalId: signal.id ?? null,
      } as any);
      const oppId = await autoCreateOpportunity(signal, sourceType);
      if (oppId) {
        autoDiscoverAndOutreach(oppId, companyNameForQuote, sigConfidence).catch(() => undefined);
        if (sigConfidence >= AUTO_QUOTE_CONFIDENCE_THRESHOLD) {
          autoTriggerQuote(oppId, companyNameForQuote, sigConfidence).catch(() => undefined);
        }
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[Nexora] pushToPipeline failed for signal ${signal.id}:`, err);
    scheduleJob(QUEUES.NEXORA_PUSH_PIPELINE_RETRY, {
      signalId: signal.id,
      companyName: (signal as any).companyName ?? null,
      sourceType,
      failedAt: new Date().toISOString(),
    }, { startAfter: 120 }).catch(() => undefined);
    return false;
  }
}

async function pushToRadar(
  signal: NexoraSignalLike,
  sourceType: "radar" | "deal",
): Promise<boolean> {
  try {
    if (sourceType === "deal") {
      await pushDealHunterToRadar(signal.id);
      return true;
    }
    // Radar signal → escalate status to "Qualified" in office_move_radar
    if (sourceType === "radar" && signal.id) {
      const { db: ddb } = await import("../../db");
      const { officeMovRadar } = await import("../../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const existing = await ddb
        .select({ id: officeMovRadar.id, status: officeMovRadar.status })
        .from(officeMovRadar)
        .where(eq(officeMovRadar.id, signal.id))
        .limit(1);
      if (existing.length > 0) {
        if (existing[0].status !== "Qualified") {
          await ddb
            .update(officeMovRadar)
            .set({ status: "Qualified" } as any)
            .where(eq(officeMovRadar.id, signal.id));
        }
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error(`[Nexora] pushToRadar failed for signal ${signal.id}:`, err);
    scheduleJob(QUEUES.NEXORA_PUSH_RADAR_RETRY, {
      signalId: signal.id,
      companyName: (signal as any).companyName ?? null,
      sourceType,
      failedAt: new Date().toISOString(),
    }, { startAfter: 120 }).catch(() => undefined);
    return false;
  }
}

async function safeWebhook(params: {
  runId: string;
  signal: NexoraSignalLike;
  finalDecision: { action: NexoraDecisionAction; priority: NexoraPriority };
  estimatedValue: number;
}): Promise<boolean> {
  try {
    await fireWebhook({
      runId: params.runId,
      signal: params.signal,
      action: params.finalDecision.action,
      priority: params.finalDecision.priority,
      estimatedValue: params.estimatedValue,
    });
    return true;
  } catch {
    return false;
  }
}

async function safeWhatsapp(params: {
  runId: string;
  signal: NexoraSignalLike;
  finalDecision: { action: NexoraDecisionAction; priority: NexoraPriority };
}): Promise<boolean> {
  try {
    if (typeof (globalThis as any).sendWhatsAppFromNexora !== "function") {
      return false;
    }

    await (globalThis as any).sendWhatsAppFromNexora({
      runId: params.runId,
      signal: params.signal,
      action: params.finalDecision.action,
      priority: params.finalDecision.priority,
    });

    return true;
  } catch {
    return false;
  }
}

async function safeVectorSync(params: {
  signal: NexoraSignalLike;
  finalDecision: { action: NexoraDecisionAction; priority: NexoraPriority };
}): Promise<boolean> {
  try {
    await syncVectorKnowledge({
      signal: params.signal,
      action: params.finalDecision.action,
      priority: params.finalDecision.priority,
    });
    return true;
  } catch {
    return false;
  }
}

/* =====================================================================================
 * AI
 * ===================================================================================== */

async function safeAIAnalysis(params: {
  signal: NexoraSignalLike;
  estimatedValue: number;
  retryCounter: RetryCounter;
  runId: string;
}): Promise<NormalizedAIDecision | null> {
  try {
    const ai = await nexoraAIAnalysis({
      signal: params.signal,
      estimatedValue: params.estimatedValue,
      runId: params.runId,
      retryCounter: params.retryCounter,
    });

    return ai ?? null;
  } catch {
    return null;
  }
}

/* =====================================================================================
 * Heuristics
 * ===================================================================================== */

function shouldUseAI(signal: NexoraSignalLike, config: NexoraConfig): boolean {
  const priority = inferPriority(signal);

  if (config.aiEnsembleMinPriority === "critical") return priority === "critical";
  if (config.aiEnsembleMinPriority === "high") {
    return priority === "critical" || priority === "high";
  }
  if (config.aiEnsembleMinPriority === "medium") {
    return priority !== "low";
  }

  return true;
}

function shouldEscalateToAI(
  signal: NexoraSignalLike,
  ruleDecision: { action: NexoraDecisionAction; confidence: number },
  estimatedValue: number,
): boolean {
  if (estimatedValue >= 100_000) return true;
  if (ruleDecision.action === "review") return true;
  if (ruleDecision.confidence < 75) return true;
  if (inferPriority(signal) === "critical") return true;
  return false;
}

// Pipeline threshold: 50+ confidence on a 0-100 scale (medium-confidence and above)
const PIPELINE_CONFIDENCE_MIN = 50;

function shouldPushPipeline(finalDecision: NexoraDecisionRecordLike): boolean {
  return (
    finalDecision.action === "push_pipeline" ||
    (finalDecision.action === "both" && finalDecision.confidence >= PIPELINE_CONFIDENCE_MIN)
  );
}

function shouldPushRadar(finalDecision: NexoraDecisionRecordLike): boolean {
  return (
    finalDecision.action === "push_radar" ||
    finalDecision.action === "both"
  );
}

function shouldFireWebhook(finalDecision: NexoraDecisionRecordLike): boolean {
  return (
    finalDecision.action !== "ignore" &&
    finalDecision.priority !== "low"
  );
}

function shouldSendWhatsapp(finalDecision: NexoraDecisionRecordLike): boolean {
  return finalDecision.priority === "critical";
}

function shouldSyncVector(finalDecision: NexoraDecisionRecordLike): boolean {
  return finalDecision.action !== "ignore";
}

/* =====================================================================================
 * Builders
 * ===================================================================================== */

function buildKnowledgeEntry(params: {
  signal: NexoraSignalLike;
  fingerprint: string;
  finalDecision: NexoraDecisionRecordLike;
  estimatedValue: number;
}): KnowledgeEntry {
  return {
    id: params.fingerprint,
    fingerprint: params.fingerprint,
    companyName: getCompanyName(params.signal),
    signalType: getSignalType(params.signal),
    sourceUrl: getSourceUrl(params.signal),
    estimatedValue: params.estimatedValue,
    priority: params.finalDecision.priority,
    action: params.finalDecision.action,
    confidence: params.finalDecision.confidence,
    evidence: getEvidence(params.signal),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildTotals(
  results: ProcessedSignalResult[],
  scanned: number,
  aiCallsUsed: number,
) {
  const totals = emptyTotals();

  totals.scanned = scanned;
  totals.valid = results.filter((r) => r.validation.valid).length;
  totals.invalid = results.filter((r) => !r.validation.valid).length;
  totals.duplicates = results.filter((r) => r.duplicate).length;
  totals.aiCallsUsed = aiCallsUsed;
  totals.pushedPipeline = results.filter((r) => r.pushedPipeline).length;
  totals.pushedRadar = results.filter((r) => r.pushedRadar).length;
  totals.webhooksSent = results.filter((r) => r.webhookSent).length;
  totals.whatsappSent = results.filter((r) => r.whatsappSent).length;
  totals.vectorsSynced = results.filter((r) => r.vectorSynced).length;
  totals.reviewed = results.filter((r) => r.reviewed).length;

  return totals;
}

function toPublicResult(result: ProcessedSignalResult): NexoraResult {
  return {
    signalId: result.signalId,
    companyName: result.companyName,
    sourceType: result.sourceType,
    estimatedValue: result.estimatedValue,
    pushedPipeline: result.pushedPipeline,
    pushedRadar: result.pushedRadar,
    webhookSent: result.webhookSent,
    whatsappSent: result.whatsappSent,
    vectorSynced: result.vectorSynced,
    duplicate: result.duplicate,
    reviewed: result.reviewed,
    decision: result.finalDecision,
  };
}

/* =====================================================================================
 * Utility
 * ===================================================================================== */

async function safeArray<T>(
  promise: Promise<T[] | undefined> | undefined,
  name: string,
  runId: string,
): Promise<T[]> {
  try {
    const value = await promise;
    return Array.isArray(value) ? value : [];
  } catch (error) {
    await createAuditLog({
      runId,
      level: "warn",
      event: "scanner_failed",
      message: `${name} failed`,
      meta: {
        scanner: name,
        error: error instanceof Error ? error.message : "Unknown scanner error",
      },
    }).catch(() => undefined);

    return [];
  }
}

function emptyTotals() {
  return {
    scanned: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    aiCallsUsed: 0,
    pushedPipeline: 0,
    pushedRadar: 0,
    webhooksSent: 0,
    whatsappSent: 0,
    vectorsSynced: 0,
    reviewed: 0,
  };
}

function emptyLearning(): NexoraEngineLearningSummary {
  return {
    sampleSize: 0,
    avgWinRate: 0,
    appliedDeltaStrongPipeline: 0,
    maxDriftPerRun: MAX_DRIFT_PER_RUN,
  };
}

function inferPriority(signal: NexoraSignalLike): NexoraPriority {
  const score =
    Number((signal as any).score ?? (signal as any).priorityScore ?? 0) || 0;

  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function priorityRank(priority: NexoraPriority): number {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function getSignalId(signal: NexoraSignalLike): string {
  return String(
    (signal as any).id ??
      (signal as any).signalId ??
      (signal as any).uuid ??
      computeSignalFingerprint(signal),
  );
}

function getCompanyName(signal: NexoraSignalLike): string {
  return String(
    (signal as any).companyName ??
      (signal as any).company ??
      (signal as any).organisation ??
      "Unknown Company",
  );
}

function getSignalType(signal: NexoraSignalLike): string {
  return String(
    (signal as any).signalType ??
      (signal as any).type ??
      (signal as any).eventType ??
      signal.__sourceType,
  );
}

function getSourceUrl(signal: NexoraSignalLike): string {
  return String(
    (signal as any).sourceUrl ??
      (signal as any).url ??
      (signal as any).link ??
      "",
  );
}

function getEvidence(signal: NexoraSignalLike): string {
  return String(
    (signal as any).evidence ??
      (signal as any).summary ??
      (signal as any).description ??
      "",
  );
}

function parseCurrencyValue(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  // Handle formatted strings like "$970,000" or "970,000" or "$1.2M"
  const str = String(raw).trim();
  if (!str || str === "0") return 0;
  // Strip currency symbols, commas, spaces — keep digits and decimal point
  const cleaned = str.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

function estimateSignalValue(signal: NexoraSignalLike): number {
  const rawExplicit =
    (signal as any).estimatedValue ??
    (signal as any).projectValue ??
    (signal as any).estimatedProjectValue ??
    0;
  const explicit = parseCurrencyValue(rawExplicit);

  if (explicit > 0) return explicit;

  const staffCount = Number((signal as any).staffCount ?? 0) || 0;
  const sqm = Number((signal as any).sqm ?? (signal as any).spaceSqm ?? 0) || 0;

  if (sqm > 0) return Math.round(sqm * 650);
  if (staffCount > 0) return Math.round(staffCount * 2500);

  return 25_000;
}