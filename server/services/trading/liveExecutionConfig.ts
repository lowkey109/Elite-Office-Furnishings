export interface LiveExecutionConfig {
  liveEnabled: boolean;
  executionMode: "paper_only" | "dry_run" | "tiny_live";
  approvedVenue: string | null;
  approvedSymbols: string[];
  accountMode: "testnet" | "live";
  maxLiveRiskPerTrade: number;
  maxDailyLiveRisk: number;
  maxLiveOpenPositions: number;
  requiresConfigApproval: boolean;
  credentialsPresent: boolean;
}

const DEFAULT_LIVE_CONFIG: LiveExecutionConfig = {
  liveEnabled: false,
  executionMode: "paper_only",
  approvedVenue: null,
  approvedSymbols: [],
  accountMode: "testnet",
  maxLiveRiskPerTrade: 100,
  maxDailyLiveRisk: 500,
  maxLiveOpenPositions: 2,
  requiresConfigApproval: true,
  credentialsPresent: false,
};

export function getLiveExecutionConfig(): LiveExecutionConfig {
  return { ...DEFAULT_LIVE_CONFIG };
}

export function isLiveEnabled(): boolean {
  return DEFAULT_LIVE_CONFIG.liveEnabled;
}

export function getExecutionMode(): LiveExecutionConfig["executionMode"] {
  return DEFAULT_LIVE_CONFIG.executionMode;
}
