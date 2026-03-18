import { db } from "../../../db";
import { ingestedLeads, officeMovRadar, companyIntelligence, dealHunterSignals, dealIntelligenceRecords } from "../../../../shared/schema";
import { desc, gte, sql } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runIntelligenceAI(): Promise<DepartmentResult> {
  const actions: string[] = [];
  const blockers: string[] = [];

  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [leads, radarSignals, enrichedCompanies, dealSignals, dealIntel] = await Promise.all([
      db.select().from(ingestedLeads).orderBy(desc(ingestedLeads.createdAt)).limit(500),
      db.select().from(officeMovRadar).limit(500),
      db.select().from(companyIntelligence).limit(500),
      db.select().from(dealHunterSignals).limit(500),
      db.select().from(dealIntelligenceRecords).limit(200),
    ]);

    const newLeads = leads.filter(l => new Date(l.createdAt ?? 0) >= since30d);
    const highScoreLeads = leads.filter(l => (l.score ?? 0) >= 75);
    const activeRadar = radarSignals.filter(r => r.status === "active" || r.status === "new");
    const highConfIntel = enrichedCompanies.filter(c => (c.confidenceScore ?? 0) >= 70);
    const activeDealSignals = dealSignals.filter(d => d.status === "active" || d.status === "new");
    const highProbDeals = dealIntel.filter(d => d.probabilityTier === "high" || d.probabilityTier === "medium_high");

    if (newLeads.length > 0) actions.push(`${newLeads.length} new leads ingested in last 30 days`);
    if (highScoreLeads.length > 0) actions.push(`${highScoreLeads.length} high-score leads (75+) identified`);
    if (activeRadar.length > 0) actions.push(`${activeRadar.length} active office move signals tracked`);
    if (highConfIntel.length > 0) actions.push(`${highConfIntel.length} companies enriched with high-confidence intelligence`);
    if (activeDealSignals.length > 0) actions.push(`${activeDealSignals.length} active deal hunter signals`);
    if (highProbDeals.length > 0) actions.push(`${highProbDeals.length} high-probability deal intelligence records`);

    if (leads.length === 0) blockers.push("No ingested leads in database — lead scraper may need to run");
    if (activeRadar.length === 0) blockers.push("No active office move radar signals");
    if (enrichedCompanies.length === 0) blockers.push("No company intelligence records — enrichment not running");

    const topCities = [...new Set(leads.slice(0, 50).map(l => l.city).filter(Boolean))].slice(0, 5);
    const topIndustries = [...new Set(leads.slice(0, 50).map(l => (l as any).industry).filter(Boolean))].slice(0, 3);

    return {
      department: "Intelligence",
      status: actions.length > 0 ? "completed" : "partial",
      actionsTaken: actions,
      blockers,
      metrics: {
        totalLeads: leads.length,
        newLeads30d: newLeads.length,
        highScoreLeads: highScoreLeads.length,
        activeRadarSignals: activeRadar.length,
        enrichedCompanies: enrichedCompanies.length,
        highConfidenceCompanies: highConfIntel.length,
        activeDealSignals: activeDealSignals.length,
        highProbabilityDeals: highProbDeals.length,
        topCities: topCities.join(", ") || "none",
        topIndustries: topIndustries.join(", ") || "none",
      },
      recommendations: [
        highScoreLeads.length > 0 ? `${highScoreLeads.length} high-score leads ready for Sales AI outreach` : "Increase lead scoring threshold data",
        activeRadar.length > 5 ? "Strong signal volume — consider increasing outreach frequency" : "Low radar signal count — check scanner schedule",
        highConfIntel.length > 10 ? "Good company intelligence coverage" : "Run company intelligence enrichment for more prospects",
      ],
    };
  } catch (err: any) {
    return {
      department: "Intelligence",
      status: "failed",
      actionsTaken: [],
      blockers: [`Intelligence AI error: ${err.message}`],
      metrics: {},
      recommendations: [],
    };
  }
}
