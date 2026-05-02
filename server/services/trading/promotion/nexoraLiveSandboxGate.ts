import { getNexoraPromotionGate } from "./nexoraPromotionGate";

export async function getNexoraLiveSandboxGate(input: { symbol?: string; strategy?: string; direction?: string }) {
  const promotion = await getNexoraPromotionGate(input);

  const maxLivePositionUsd = Number(process.env.TCD_MAX_LIVE_POSITION_USD || 10);
  const maxDailyLossUsd = Number(process.env.TCD_MAX_LIVE_DAILY_LOSS_USD || 25);
  const liveSandboxEnabled = process.env.TCD_LIVE_SANDBOX_ENABLED === "true";

  const eligible =
    liveSandboxEnabled &&
    promotion.stage === "tiny_live_sandbox_eligible" &&
    maxLivePositionUsd > 0 &&
    maxLivePositionUsd <= 25 &&
    maxDailyLossUsd > 0 &&
    maxDailyLossUsd <= 100;

  return {
    ok: true,
    service: "nexora_live_sandbox_gate",
    liveSandboxEnabled,
    eligible,
    mode: eligible ? "tiny_live_sandbox" : "locked",
    maxLivePositionUsd,
    maxDailyLossUsd,
    promotion,
    requirements: {
      TCD_LIVE_SANDBOX_ENABLED: "true",
      maxLivePositionUsd: "<= 25",
      maxDailyLossUsd: "<= 100",
      promotionStage: "tiny_live_sandbox_eligible",
    },
    reason: eligible
      ? "Tiny live sandbox is eligible under strict caps."
      : "Live sandbox is locked or proof requirements are not met.",
    updatedAt: new Date().toISOString(),
  };
}
