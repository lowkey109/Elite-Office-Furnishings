export type NexoraEnvironment = "local" | "staging" | "production";
export type NexoraPriority = "critical" | "high" | "medium" | "low";

export type NexoraReviewQueueType =
  | "approval_needed"
  | "validation_failed"
  | "weak_evidence"
  | "duplicate_candidate"
  | "failed_push"
  | "anomaly"
  | "run_timeout"
  | "retry_storm";

export interface NexoraConfig {
  env: NexoraEnvironment;
  dryRun: boolean;
  approvalOnly: boolean;
  autoApproveCritical: boolean;
  autoPushDisabled: boolean;
  vectorSyncDisabled: boolean;
  webhookDisabled: boolean;
  maxConcurrency: number;
  maxRetriesPerOperation: number;
  timeoutMs: {
    radarScan: number;
    dealScan: number;
    aiAnalysis: number;
    vectorSync: number;
    webhook: number;
    pushAction: number;
  };
}

export interface RetryCounter {
  value: number;
}

export interface AdaptiveThresholds {
  strongMove: number;
  criticalValue: number;
  highValue: number;
  bothMinValue: number;
  strongPipeline: number;
  highIntentMin: number;
  learningRate: number;
}

export interface NormalizedAIDecision {
  action: "pipeline" | "radar" | "both" | "hold";
  priority: NexoraPriority;
  reason: string;
  confidence: number;
}

export interface ApprovalDecision {
  allowed: boolean;
  reason: string;
  requiresHuman: boolean;
}

export interface ValidationResult {
  overallValid: boolean;
  results: unknown;
  canonicalCompanyKey: string;
  duplicateKey: string;
  freshnessDays: number | null;
  sourceDomain?: string;
  signalTypeNormalized?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  checks: Record<string, { ok: boolean; reason: string }>;
}

export interface VectorUpsertResult {
  attempted: boolean;
  pineconeAttempted: boolean;
  pineconeSucceeded: boolean;
  weaviateAttempted: boolean;
  weaviateSucceeded: boolean;
  errors: string[];
}

export interface KnowledgeEntry {
  embedding: number[];
  lastScore: number;
  winRate: number;
  count: number;
  lastSeen: number;

  companyKey?: string;
  companyName?: string;
  latestSourceUrl?: string | null;
  latestSignalType?: string | null;

  embeddingMode?: "remote" | "heuristic";
  embeddingInput?: string;

  latestFingerprint?: string;
  seenFingerprints?: string[];

  latestSourceTitle?: string | null;
  latestProvenance?: string | null;
}

export interface DealHunterSignalLike {
  id: string;
  companyName?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;

  signalType?: string | null;
  signalSubtype?: string | null;

  signalStrengthScore?: number | null;
  signalConfidence?: number | null;

  estimatedProjectValue?: number | string | null;
  estimatedWorkspaceSqm?: number | null;
  employeeEstimate?: number | null;

  probabilityTier?: string | null;

  rawPayloadSummary?: string | null;
  sourceTitle?: string | null;
  sourcePublishedAt?: string | null;

  sourceUrl?: string | null;
  signalSource?: string | null;

  pushedToPipeline?: boolean | null;
  pushedToRadar?: boolean | null;
}

export interface RadarSignalLike {
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
  sourcePublishedAt?: string | null;
  sourceTitle?: string | null;
  rawPayloadSummary?: string | null;
  signalSource?: string | null;
}

export type RadarPoolStats = {
  count: number;
  avg: number;
  p50: number;
  p90: number;
  max: number;
};

export type RadarMatchTypeStats = {
  attempted: number;
  hits: number;
  misses: number;
  hitRate: number;
  pool: RadarPoolStats;
};

export interface NexoraResult {
  runId: string;
  success: boolean;
  processed: number;
  outreachRuns: number;
  outreachFailed: number;
  radarSignals: number; // usable radar candidates for matching
  dealSignals: number; // raw post-scan deal count
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

    radarMatchAttempted: number;
    radarMatchHits: number;
    radarMatchMisses: number;
    radarMatchHitRate: number;

    radarMatchCandidatePoolAvg: number;
    radarMatchCandidatePoolP50: number;
    radarMatchCandidatePoolP90: number;
    radarMatchCandidatePoolMax: number;

    radarMatchCandidatePoolBySignalType: Record<string, RadarPoolStats>;
    radarMatchBySignalType: Record<string, RadarMatchTypeStats>;

    radarMatchHitsByOrigin: Record<string, number>;
    decisionCountsByAction: Record<string, number>;
    decisionCountsByPriority: Record<string, number>;
    ruleVsAiDisagreementRate: number;

    webhookAttempted: number;
    webhookSucceeded: number;
    webhookFailed: number;

    ai: {
      attemptedCalls: number;
      skippedBudget: number;
      skippedStorm: number;
      concurrencyLimit: number;
      budgetCeiling: number;
      errorsByClass: Record<string, number>;
    };

    retriesByOperation: Record<string, number>;
    timeoutsByOperation: Record<string, number>;
    errorCountsByClass: Record<string, number>;
  };
}