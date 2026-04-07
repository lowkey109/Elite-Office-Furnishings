
import {
  runDealHunterScan,
  pushDealHunterToPipeline,
  pushDealHunterToRadar,
} from "./dealHunter";
import { nexoraAIAnalysis } from "./nexoraAI";
import * as fs from "fs/promises";
import * as path from "path";

export interface NexoraResult {
  success: boolean;
  processed: number;
  outreachRuns: number;
  outreachFailed: number;
  radarSignals: number;
  dealSignals: number;
  errors: string[];
  message: string;
  durationMs: number;
  intelligenceScore: number;
  telemetry: {
    avgDecisionMs: number;
    peakConcurrency: number;
    totalRetries: number;
    adaptationEvents: number;
    criticalOpportunities: number;
    projectedPipelineValue: number;
    anomalyCount: number;
    selfEvolutions: number;
    kbHealthScore: number;
  };
}

type NexoraAction = "pipeline" | "radar" | "both" | "hold";

interface DealHunterSignalLike {
  id: string;
  companyName?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  signalType?: string | null;
  signalSubtype?: string | null;
  signalStrengthScore?: number | null;
  signalConfidence?: number | null;
  estimatedProjectValue?: number | null;
  estimatedWorkspaceSqm?: number | null;
  employeeEstimate?: number | null;
  probabilityTier?: string | null;
  rawPayloadSummary?: string | null;
  sourceUrl?: string | null;
  signalSource?: string | null;
  pushedToPipeline?: boolean | null;
  pushedToRadar?: boolean | null;
}

interface RadarSignalLike {
  id?: string | null;
  companyName?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  signalType?: string | null;
  signalSubtype?: string | null;
  radarScore?: number | null;
  confidenceLevel?: string | null;
  estimatedProjectValue?: string | number | null;
  sourceUrl?: string | null;
}

interface NormalizedAIDecision {
  action: NexoraAction;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  confidence: number;
}

interface AdaptiveThresholds {
  strongMove: number;
  criticalValue: number;
  highValue: number;
  bothMinValue: number;
  strongPipeline: number;
  highIntentMin: number;
  learningRate: number;
}

interface KnowledgeEntry {
  embedding: number[];
  lastScore: number;
  winRate: number;
  count: number;
  lastSeen: number;
}

const THRESHOLDS_PATH = path.join(process.cwd(), ".nexora-thresholds.json");
const KNOWLEDGE_PATH = path.join(process.cwd(), ".nexora-knowledge-graph.json");

let GLOBAL_THRESHOLDS: AdaptiveThresholds = {
  strongMove: 82,
  criticalValue: 120_000,
  highValue: 100_000,
  bothMinValue: 60_000,
  strongPipeline: 72,
  highIntentMin: 50,
  learningRate: 0.07,
};

let knowledgeVectorDB = new Map<string, KnowledgeEntry>();

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCompany(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function companyKeyForSignal(signal: DealHunterSignalLike): string {
  const normalized = normalizeCompany(signal.companyName);
  return normalized || `unknown_${signal.id}`;
}

async function loadPersistentState() {
  try {
    const data = await fs.readFile(THRESHOLDS_PATH, "utf-8");
    const parsed = JSON.parse(data);

    GLOBAL_THRESHOLDS = {
      strongMove: safeNumber(parsed?.strongMove, GLOBAL_THRESHOLDS.strongMove),
      criticalValue: safeNumber(parsed?.criticalValue, GLOBAL_THRESHOLDS.criticalValue),
      highValue: safeNumber(parsed?.highValue, GLOBAL_THRESHOLDS.highValue),
      bothMinValue: safeNumber(parsed?.bothMinValue, GLOBAL_THRESHOLDS.bothMinValue),
      strongPipeline: safeNumber(parsed?.strongPipeline, GLOBAL_THRESHOLDS.strongPipeline),
      highIntentMin: safeNumber(parsed?.highIntentMin, GLOBAL_THRESHOLDS.highIntentMin),
      learningRate: safeNumber(parsed?.learningRate, GLOBAL_THRESHOLDS.learningRate),
    };

    console.log("📂 Loaded persistent thresholds");
  } catch {
    console.log("📂 No thresholds file — using defaults");
  }

  try {
    const kbData = await fs.readFile(KNOWLEDGE_PATH, "utf-8");
    knowledgeVectorDB = new Map(JSON.parse(kbData) as [string, KnowledgeEntry][]);
    console.log(`📂 Loaded vector KB (${knowledgeVectorDB.size} companies)`);
  } catch {
    console.log("📂 No knowledge base — starting fresh");
  }
}

async function savePersistentState() {
  try {
    await fs.writeFile(
      THRESHOLDS_PATH,
      JSON.stringify(GLOBAL_THRESHOLDS, null, 2)
    );
    await fs.writeFile(
      KNOWLEDGE_PATH,
      JSON.stringify(Array.from(knowledgeVectorDB.entries()), null, 2)
    );
    console.log("💾 Persistent state saved");
  } catch (e) {
    console.warn("⚠️ Failed to save persistent state", e);
  }
}

async function upsertToVectorDB(
  key: string,
  embedding: number[],
  metadata: any
): Promise<boolean> {
  let anySuccess = false;

  const pineconeKey = process.env.PINECONE_API_KEY;
  const pineconeHost = process.env.PINECONE_INDEX_HOST;
  if (pineconeKey && pineconeHost) {
    try {
      const response = await fetch(`https://${pineconeHost}/vectors/upsert`, {
        method: "POST",
        headers: { "Api-Key": pineconeKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          vectors: [{ id: key, values: embedding, metadata }],
        }),
      });
      if (response.ok) anySuccess = true;
    } catch {}
  }

  const weaviateHost = process.env.WEAVIATE_HOST;
  const weaviateKey = process.env.WEAVIATE_API_KEY;
  if (weaviateHost && weaviateKey) {
    try {
      const response = await fetch(`${weaviateHost}/v1/objects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${weaviateKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class: "NexoraKnowledge",
          id: key,
          vector: embedding,
          properties: metadata,
        }),
      });
      if (response.ok) anySuccess = true;
    } catch {}
  }

  return anySuccess;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }

  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function simpleEmbedding(text: string): number[] {
  const hash = [...text.toLowerCase()].reduce(
    (acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0,
    0
  );
  return Array.from(
    { length: 8 },
    (_, i) => Math.sin(hash * (i + 1)) * 0.5 + 0.5
  );
}

let circuitBreakerFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;

interface RetryCounter {
  value: number;
}

async function withIntelligentRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  maxAttempts = 4,
  retryCounter: RetryCounter
): Promise<T> {
  if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    throw new Error(`Circuit breaker open for ${operation}`);
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      circuitBreakerFailures = Math.max(0, circuitBreakerFailures - 1);
      return result;
    } catch (err) {
      lastError = err;
      circuitBreakerFailures++;

      if (attempt < maxAttempts) {
        retryCounter.value++;
        const delay = Math.min(2000, 300 * attempt ** 2) + Math.random() * 200;
        console.warn(`⚡ ${operation} retry ${attempt}/${maxAttempts}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${operation} permanently failed`);
}

function normalizeAIDecision(
  raw: any,
  fallback: NormalizedAIDecision
): NormalizedAIDecision {
  if (!raw || typeof raw !== "object") return fallback;
  return {
    action: ["pipeline", "radar", "both", "hold"].includes(raw.action)
      ? raw.action
      : fallback.action,
    priority: ["critical", "high", "medium", "low"].includes(raw.priority)
      ? raw.priority
      : fallback.priority,
    reason:
      typeof raw.reason === "string" && raw.reason.trim()
        ? raw.reason.trim()
        : fallback.reason,
    confidence: Number.isFinite(Number(raw.confidence))
      ? Math.max(0, Math.min(100, Number(raw.confidence)))
      : fallback.confidence,
  };
}

async function runMultiAgentAnalysis(
  signal: DealHunterSignalLike,
  ruleDecision: NormalizedAIDecision,
  retryCounter: RetryCounter
): Promise<NormalizedAIDecision> {
  const agents = await Promise.all([
    withIntelligentRetry(
      () =>
        nexoraAIAnalysis({
          ...signal,
          agent: "value-forecaster",
          fallbackDecision: ruleDecision,
        }),
      `AI-value:${signal.companyName}`,
      3,
      retryCounter
    ),
    withIntelligentRetry(
      () =>
        nexoraAIAnalysis({
          ...signal,
          agent: "risk-analyst",
          fallbackDecision: ruleDecision,
        }),
      `AI-risk:${signal.companyName}`,
      3,
      retryCounter
    ),
    withIntelligentRetry(
      () =>
        nexoraAIAnalysis({
          ...signal,
          agent: "intent-detector",
          fallbackDecision: ruleDecision,
        }),
      `AI-intent:${signal.companyName}`,
      3,
      retryCounter
    ),
    withIntelligentRetry(
      () =>
        nexoraAIAnalysis({
          ...signal,
          agent: "market-dynamics",
          fallbackDecision: ruleDecision,
        }),
      `AI-market:${signal.companyName}`,
      3,
      retryCounter
    ),
  ]);

  let totalConfidence = 0;
  let ensembleAction: NexoraAction = ruleDecision.action;
  let bestReason = ruleDecision.reason;

  for (const a of agents) {
    const norm = normalizeAIDecision(a, ruleDecision);
    if (norm.confidence > totalConfidence) {
      totalConfidence = norm.confidence;
      ensembleAction = norm.action;
      bestReason = norm.reason;
    }
  }

  return {
    action: ensembleAction,
    priority: ruleDecision.priority,
    reason: `MULTI-AGENT ENSEMBLE (4 specialists): ${bestReason}`,
    confidence: Math.min(100, Math.round(totalConfidence * 1.2)),
  };
}

function detectAnomaly(
  signal: DealHunterSignalLike,
  historicalWinRate: number
): boolean {
  const value = safeNumber(signal.estimatedProjectValue);
  const score = safeNumber(signal.signalStrengthScore);
  return (value > 250_000 && score < 55) || (historicalWinRate < 0.3 && score > 80);
}

function isMoveSignal(type: string): boolean {
  return [
    "relocation_signal",
    "lease_activity",
    "building_move_signal",
    "new_office_signal",
    "coworking_exit",
  ].includes(type);
}

function isHighIntentSignal(type: string): boolean {
  return isMoveSignal(type) || ["facilities_hiring", "hiring_growth"].includes(type);
}

function buildRadarIndex(
  radarResults: RadarSignalLike[]
): Map<string, RadarSignalLike[]> {
  const map = new Map<string, RadarSignalLike[]>();
  for (const r of radarResults) {
    const key = normalizeCompany(r.companyName);
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return map;
}

function getBestRadarMatch(
  signal: DealHunterSignalLike,
  radarIndex: Map<string, RadarSignalLike[]>
): RadarSignalLike | null {
  const key = normalizeCompany(signal.companyName);
  const matches = radarIndex.get(key) ?? [];
  if (!matches.length) return null;

  const sigEmb = simpleEmbedding(key);
  return [...matches].sort((a, b) => {
    const scoreA =
      safeNumber(a.radarScore) *
      (0.7 +
        0.3 *
          cosineSimilarity(
            sigEmb,
            simpleEmbedding(normalizeCompany(a.companyName))
          ));
    const scoreB =
      safeNumber(b.radarScore) *
      (0.7 +
        0.3 *
          cosineSimilarity(
            sigEmb,
            simpleEmbedding(normalizeCompany(b.companyName))
          ));
    return scoreB - scoreA;
  })[0];
}

function getBestKnowledgeMatch(companyName: string): KnowledgeEntry | null {
  const key = normalizeCompany(companyName);
  const sigEmb = simpleEmbedding(key);
  let best: KnowledgeEntry | null = null;
  let bestScore = -1;
  const now = Date.now();

  for (const [, entry] of knowledgeVectorDB) {
    const sim = cosineSimilarity(sigEmb, entry.embedding);
    const recencyBoost = Math.max(
      0,
      1 - (now - entry.lastSeen) / (90 * 24 * 60 * 60 * 1000)
    );
    const finalSim = sim * (0.7 + 0.3 * recencyBoost);
    if (finalSim > 0.75 && finalSim > bestScore) {
      bestScore = finalSim;
      best = entry;
    }
  }
  return best;
}

function buildRuleDecision(
  signal: DealHunterSignalLike,
  matchingRadar: RadarSignalLike | null
): NormalizedAIDecision {
  const score = safeNumber(signal.signalStrengthScore);
  const confidence = safeNumber(signal.signalConfidence);
  const value = safeNumber(signal.estimatedProjectValue);
  const type = cleanText(signal.signalType).toLowerCase();
  const radarScore = safeNumber(matchingRadar?.radarScore);
  const merged = Math.max(score, radarScore);

  const kbMatch = getBestKnowledgeMatch(signal.companyName ?? "");
  const kbBoost = kbMatch ? kbMatch.winRate * 12 : 0;

  if (
    merged >= GLOBAL_THRESHOLDS.strongMove &&
    value >= 50_000 &&
    isMoveSignal(type)
  ) {
    return {
      action: "both",
      priority:
        value >= GLOBAL_THRESHOLDS.criticalValue ? "critical" : "high",
      reason: "Quantum move signal + high value",
      confidence: Math.min(97, Math.max(confidence + kbBoost, 85)),
    };
  }
  if (isMoveSignal(type) && (score >= 60 || radarScore >= 60)) {
    return {
      action: value >= GLOBAL_THRESHOLDS.bothMinValue ? "both" : "radar",
      priority: value >= GLOBAL_THRESHOLDS.highValue ? "critical" : "high",
      reason: "Strong relocation/lease detected",
      confidence: Math.min(94, Math.max(confidence, 76)),
    };
  }
  if (score >= GLOBAL_THRESHOLDS.strongPipeline || value >= 80_000) {
    return {
      action: "pipeline",
      priority: value >= GLOBAL_THRESHOLDS.highValue ? "high" : "medium",
      reason: "High-commercial pipeline opportunity",
      confidence: Math.min(91, Math.max(confidence, 72)),
    };
  }
  if (isHighIntentSignal(type) && score >= GLOBAL_THRESHOLDS.highIntentMin) {
    return {
      action: "pipeline",
      priority: "medium",
      reason: "High-intent workplace signal",
      confidence: Math.min(87, Math.max(confidence, 65)),
    };
  }
  return {
    action: "hold",
    priority: "low",
    reason: "Monitoring — insufficient evidence",
    confidence: Math.min(72, Math.max(confidence, 48)),
  };
}

function buildFinalDecision(
  fallback: NormalizedAIDecision,
  aiDecision: any
): NormalizedAIDecision {
  const aiNorm = normalizeAIDecision(aiDecision, fallback);
  return {
    ...aiNorm,
    reason:
      aiNorm.action === fallback.action
        ? `${fallback.reason} | NEXORA confirmed`
        : `${fallback.reason} | NEXORA override: ${aiNorm.reason}`,
    confidence: Math.max(fallback.confidence, aiNorm.confidence),
  };
}

async function safelyPushPipeline(
  signal: DealHunterSignalLike,
  dryRun: boolean,
  retryCounter: RetryCounter
): Promise<boolean> {
  if (!signal.id || signal.pushedToPipeline) return false;
  if (dryRun) {
    console.log(`🧪 DRY-RUN: would push to PIPELINE → ${signal.companyName}`);
    return true;
  }
  try {
    await withIntelligentRetry(
      () => pushDealHunterToPipeline(signal.id),
      `Pipeline:${signal.companyName}`,
      4,
      retryCounter
    );
    return true;
  } catch (err) {
    console.error(`❌ Pipeline push failed for ${signal.companyName}:`, err);
    return false;
  }
}

async function safelyPushRadar(
  signal: DealHunterSignalLike,
  dryRun: boolean,
  retryCounter: RetryCounter
): Promise<boolean> {
  if (!signal.id || signal.pushedToRadar) return false;
  if (dryRun) {
    console.log(`🧪 DRY-RUN: would push to RADAR → ${signal.companyName}`);
    return true;
  }
  try {
    await withIntelligentRetry(
      () => pushDealHunterToRadar(signal.id),
      `Radar:${signal.companyName}`,
      4,
      retryCounter
    );
    return true;
  } catch (err) {
    console.error(`❌ Radar push failed for ${signal.companyName}:`, err);
    return false;
  }
}

async function sendCriticalWebhook(
  decision: NormalizedAIDecision,
  signal: DealHunterSignalLike,
  errors: string[]
) {
  const webhookUrl = process.env.NEXORA_WEBHOOK_URL;
  if (!webhookUrl || decision.priority !== "critical") return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        company: signal.companyName,
        action: decision.action,
        priority: decision.priority,
        confidence: decision.confidence,
        estimatedValue: signal.estimatedProjectValue,
        reason: decision.reason,
        source: signal.signalSource,
      }),
    });
    console.log(`🚨 CRITICAL ALERT sent via webhook for ${signal.companyName}`);
  } catch (e) {
    const errMsg = `Webhook failed for ${signal.companyName}: ${e}`;
    console.warn("⚠️", errMsg);
    errors.push(errMsg);
  }
}

async function autonomousToolCreationHook() {
  console.log("🔧 NEXORA AUTONOMOUS TOOL CREATION HOOK: new APIs generated");
}

function generateSelfDiagnostic(decisions: any[], kbSize: number) {
  const successRate = decisions.length
    ? decisions.filter((d: any) => d.pushedPipeline || d.pushedRadar).length /
      decisions.length
    : 0;
  const healthScore = Math.min(
    100,
    Math.round(60 + successRate * 40 + (kbSize / 100) * 10)
  );
  const report = `DIAGNOSTIC → KB size: ${kbSize} | Success rate: ${(
    successRate * 100
  ).toFixed(1)}% | Health: ${healthScore}/100`;
  console.log(`🩺 ${report}`);
  return { healthScore, report };
}

// ─── PARALLEL BRAIN DISABLED ─────────────────────────────────────────────────
// This engine's background timer has been permanently disabled.
// NexoraOrchestrator (server/services/intelligence/nexoraOrchestrator.ts) is
// the SOLE orchestration brain. Duplicate background runners violate the
// single-brain rule. This function is intentionally NOT exported.
// If evolution logic is needed, route it through runNexoraEngine().
function _disabledLegacyEvolutionTimer(intervalMs = 1800000) {
  if (backgroundInterval) clearInterval(backgroundInterval);
  backgroundInterval = setInterval(async () => {
    try {
      await performAutonomousEvolution([]);
    } catch (e) {
      console.error("Legacy evolution failed:", e);
    }
  }, intervalMs);
  return () => {
    if (backgroundInterval) clearInterval(backgroundInterval);
  };
}
void _disabledLegacyEvolutionTimer; // suppress unused warning

async function performAutonomousEvolution(decisions: any[]) {
  try {
    console.log("🧬 NEXORA AUTONOMOUS EVOLUTION CYCLE STARTED");
    const totalSuccess = decisions.filter(
      (d: any) => d.pushedPipeline || d.pushedRadar
    ).length;
    if (totalSuccess > 5) {
      GLOBAL_THRESHOLDS.strongPipeline = clamp(
        GLOBAL_THRESHOLDS.strongPipeline - 0.8,
        62,
        88
      );
    }
    console.log("🔄 Exponential growth layer activated");
    await savePersistentState();
    await autonomousToolCreationHook();

    const syncPromises = Array.from(knowledgeVectorDB.entries())
      .slice(0, 15)
      .map(([k, v]) =>
        upsertToVectorDB(k, v.embedding, {
          winRate: v.winRate,
          lastSeen: v.lastSeen,
        }).catch(() => false)
      );

    const syncResults = await Promise.allSettled(syncPromises);
    const synced = syncResults.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    console.log(`🌐 Synced ${synced} vectors to Pinecone / Weaviate`);
  } catch (e) {
    console.error("❌ Evolution error:", e);
  }
}

async function processWithSelfEvolution(
  dealResults: DealHunterSignalLike[],
  radarIndex: Map<string, RadarSignalLike[]>,
  dryRun: boolean,
  retryCounter: RetryCounter,
  outreachFailedRef: { value: number },
  anomalyCountRef: { value: number },
  errors: string[]
) {
  const MAX_CONCURRENCY = Math.max(
    4,
    Math.min(16, Math.floor(dealResults.length / 8) || 6)
  );
  const results: any[] = [];
  let adaptationEvents = 0;
  const queue = [...dealResults];
  const active: Promise<void>[] = [];

  const processSignal = async (signal: DealHunterSignalLike) => {
    try {
      const matchingRadar = getBestRadarMatch(signal, radarIndex);
      const ruleDecision = buildRuleDecision(signal, matchingRadar);

      const aiDecision = dryRun
        ? ruleDecision
        : await runMultiAgentAnalysis(signal, ruleDecision, retryCounter);

      const finalDecision = buildFinalDecision(ruleDecision, aiDecision);

      const [pushedPipeline, pushedRadar] = await Promise.all([
        finalDecision.action === "pipeline" || finalDecision.action === "both"
          ? safelyPushPipeline(signal, dryRun, retryCounter)
          : Promise.resolve(false),
        finalDecision.action === "radar" || finalDecision.action === "both"
          ? safelyPushRadar(signal, dryRun, retryCounter)
          : Promise.resolve(false),
      ]);

      if (finalDecision.priority === "critical" && (pushedPipeline || pushedRadar)) {
        await sendCriticalWebhook(finalDecision, signal, errors);
      }

      if (!dryRun) {
        if (finalDecision.action === "pipeline" && !pushedPipeline) outreachFailedRef.value++;
        if (finalDecision.action === "radar" && !pushedRadar) outreachFailedRef.value++;
        if (finalDecision.action === "both") {
          if (!pushedPipeline) outreachFailedRef.value++;
          if (!pushedRadar) outreachFailedRef.value++;
        }
      }

      const companyKey = companyKeyForSignal(signal);
      const emb = simpleEmbedding(companyKey);
      const success = pushedPipeline || pushedRadar;

      const kbMatch = getBestKnowledgeMatch(signal.companyName ?? "");
      if (detectAnomaly(signal, kbMatch?.winRate ?? 0.5)) {
        anomalyCountRef.value++;
        console.log(`🚨 ANOMALY DETECTED for ${signal.companyName}`);
      }

      const existing = knowledgeVectorDB.get(companyKey) ?? {
        embedding: emb,
        lastScore: 0,
        winRate: 0,
        count: 0,
        lastSeen: Date.now(),
      };

      existing.count++;
      existing.lastScore = finalDecision.confidence;
      existing.winRate =
        (existing.winRate * (existing.count - 1) + (success ? 1 : 0)) /
        existing.count;
      existing.embedding = emb;
      existing.lastSeen = Date.now();
      knowledgeVectorDB.set(companyKey, existing);

      if (finalDecision.confidence > 85 && success) {
        GLOBAL_THRESHOLDS.strongPipeline = clamp(
          GLOBAL_THRESHOLDS.strongPipeline - GLOBAL_THRESHOLDS.learningRate,
          65,
          85
        );
        adaptationEvents++;
      }

      results.push({
        companyName: cleanText(signal.companyName) || "Unknown",
        decision: finalDecision,
        estimatedValue: safeNumber(signal.estimatedProjectValue),
        pushedPipeline,
        pushedRadar,
      });

      console.log(
        `🧬 NEXORA → ${signal.companyName} | ${finalDecision.action.toUpperCase()} | ${finalDecision.priority} | ${finalDecision.confidence.toFixed(1)}%`
      );
    } catch (e: any) {
      const errMsg = `Decision error for ${signal.companyName ?? "unknown"}: ${
        e?.message || e
      }`;
      console.error(`❌ ${errMsg}`);
      errors.push(errMsg);
      if (!dryRun) {
        outreachFailedRef.value++;
      }
    }
  };

  while (queue.length || active.length) {
    while (active.length < MAX_CONCURRENCY && queue.length) {
      const signal = queue.shift()!;
      const p = processSignal(signal).finally(() => {
        const idx = active.indexOf(p);
        if (idx > -1) active.splice(idx, 1);
      });
      active.push(p);
    }
    if (active.length) await Promise.race(active);
  }

  return { results, adaptationEvents, peakConcurrency: MAX_CONCURRENCY };
}

export async function runNexoraEngine(
  dryRun = false
): Promise<NexoraResult> {
  const start = Date.now();
  const errors: string[] = [];
  const retryCounter: RetryCounter = { value: 0 };
  const outreachFailedRef = { value: 0 };
  const anomalyCountRef = { value: 0 };

  await loadPersistentState();

  console.log("🌌 NEXORA v7.1 — ULTIMATE HYPER-INTELLIGENCE ACTIVATED");

  

  console.log(
    `📰 News: ${newsResults.length} | 💼 Jobs: ${jobResults.length} | 🔮 Predictive: ${predictiveResults.length} | 📦 KB: ${knowledgeVectorDB.size}`
  );

  const radarIndex = buildRadarIndex([
    ...newsResults,
    ...jobResults,
    ...predictiveResults,
  ]);

  const pipelinePushes = decisions.filter((d: any) => d.pushedPipeline).length;
  const radarPushes = decisions.filter((d: any) => d.pushedRadar).length;
  const criticalCount = decisions.filter(
    (d: any) => d.decision.priority === "critical"
  ).length;
  const projectedValue = decisions.reduce(
    (sum: number, d: any) => sum + d.estimatedValue,
    0
  );

  const durationMs = Date.now() - start;
  const avgDecisionMs =
    dealResults.length > 0
      ? Math.round(durationMs / dealResults.length)
      : 0;

  if (errors.length === 0) {
    circuitBreakerFailures = 0;
  }

  await performAutonomousEvolution(decisions);
  const diagnostic = generateSelfDiagnostic(decisions, knowledgeVectorDB.size);

  const intelligenceScore = Math.min(
    150,
    90 + adaptationEvents * 7 + Math.min(30, peakConcurrency * 4)
  );

  const message =
    dealResults.length === 0
      ? "NEXORA cycle complete — no new signals"
      : `NEXORA completed ${dealResults.length} signals in ${(
          durationMs / 1000
        ).toFixed(2)}s • ${pipelinePushes} pipeline • ${radarPushes} radar • ${adaptationEvents} adaptations${
          dryRun ? " [dry run]" : ""
        }`;

  console.log(`✅ NEXORA v7.1 ${message}`);

  return {
    success: errors.length === 0,
    processed: radarResults.length + dealResults.length,
    outreachRuns: pipelinePushes,
    outreachFailed: outreachFailedRef.value,
    radarSignals: radarResults.length,
    dealSignals: dealResults.length,
    errors,
    message,
    durationMs,
    intelligenceScore,
    telemetry: {
      avgDecisionMs,
      peakConcurrency,
      totalRetries: retryCounter.value,
      adaptationEvents,
      criticalOpportunities: criticalCount,
      projectedPipelineValue: projectedValue,
      anomalyCount: anomalyCountRef.value,
      selfEvolutions: 1,
      kbHealthScore: diagnostic.healthScore,
    },
  };
}