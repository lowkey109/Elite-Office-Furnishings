export {
  scorePartnerFit,
  routeOpportunityToPartners,
  autoRouteHighScoreSignals,
  autoRouteRadarSignals,
  createReferralRecord,
  getNetworkSummary,
  runNexoraPartnerRoutingStep,
} from "./intelligence/partnerNetwork";

export async function routeRelocationSignalToPartners(signal: any): Promise<{ routed: boolean; partnerCount: number }> {
  const { routeOpportunityToPartners } = await import("./intelligence/partnerNetwork");
  try {
    const companyName = signal.companyName ?? signal.company ?? "Unknown";
    const result = await routeOpportunityToPartners(
      {
        opportunityTitle: `Office Move Signal — ${companyName}`,
        companyName,
        city: signal.city ?? undefined,
        industry: signal.industry ?? undefined,
        projectType: signal.signalType ?? "office_move",
        estimatedProjectValue: signal.estimatedProjectValue ?? signal.value ?? undefined,
        relocationScore: signal.radarScore ?? signal.opportunityScore ?? 50,
        sourceType: "radar_signal",
        sourceId: signal.id ?? undefined,
      },
      ["commercial_interiors", "office_fitout"],
    );
    return { routed: (result?.routed ?? 0) > 0, partnerCount: result?.routed ?? 0 };
  } catch {
    return { routed: false, partnerCount: 0 };
  }
}
