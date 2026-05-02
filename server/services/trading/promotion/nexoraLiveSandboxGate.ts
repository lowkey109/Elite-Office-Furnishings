export function getNexoraLiveSandboxGate(input: {
  winRate: number;
  profitFactor: number;
  trades: number;
  pnl: number;
  maxDrawdown: number;
  killSwitchActive?: boolean;
}) {
  const maxLivePositionUsd = Number(process.env.TCD_MAX_LIVE_POSITION_USD || 10);
  const maxDailyLossUsd = Number(process.env.TCD_MAX_LIVE_DAILY_LOSS_USD || 25);
  const liveSandboxEnabled = process.env.TCD_LIVE_SANDBOX_ENABLED === "true";

  const eligible =
    liveSandboxEnabled &&
    !input.killSwitchActive &&
    input.winRate >= 80 &&
    input.profitFactor >= 1.8 &&
    input.trades >= 100 &&
    input.pnl > 0 &&
    input.maxDrawdown > -maxDailyLossUsd;

  return {
    ok: true,
    service: "nexora_live_sandbox_gate",
    liveSandboxEnabled,
    eligible,
    mode: eligible ? "tiny_live_sandbox" : "locked",
    maxLivePositionUsd,
    maxDailyLossUsd,
    requirements: {
      winRate: ">= 80",
      profitFactor: ">= 1.8",
      trades: ">= 100",
      pnl: "> 0",
      maxDrawdown: `> -${maxDailyLossUsd}`,
      killSwitchActive: false,
      TCD_LIVE_SANDBOX_ENABLED: "true",
    },
    input,
    reason: eligible
      ? "Nexora is eligible for tiny capped live sandbox trading."
      : "Nexora is not eligible for live sandbox trading yet.",
    updatedAt: new Date().toISOString(),
  };
}
