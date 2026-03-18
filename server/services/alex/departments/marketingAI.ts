import { db } from "../../../db";
import { generatedBlogArticles, leads, visitorSessions } from "../../../../shared/schema";
import { desc } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runMarketingAI(): Promise<DepartmentResult> {
  const actions: string[] = [];
  const blockers: string[] = [];

  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [articles, allLeads, sessions] = await Promise.all([
      db.select().from(generatedBlogArticles).orderBy(desc(generatedBlogArticles.generatedAt)).limit(200),
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(500),
      db.select().from(visitorSessions).orderBy(desc(visitorSessions.createdAt)).limit(1000),
    ]);

    const publishedArticles = articles.filter(a => a.status === "published");
    const draftArticles = articles.filter(a => a.status === "draft" || a.status === "pending");
    const recentArticles = articles.filter(a => new Date(a.generatedAt ?? 0) >= since30d);

    const recentLeads = allLeads.filter(l => new Date(l.createdAt ?? 0) >= since7d);
    const recentSessions = sessions.filter(s => new Date(s.createdAt ?? 0) >= since7d);
    const uniqueCompanies = [...new Set(sessions.slice(0, 200).map(s => s.companyName).filter(Boolean))].length;

    const formSources: Record<string, number> = {};
    allLeads.forEach(l => {
      const src = l.formType ?? "unknown";
      formSources[src] = (formSources[src] ?? 0) + 1;
    });
    const topSource = Object.entries(formSources).sort((a, b) => b[1] - a[1])[0];

    if (publishedArticles.length > 0) actions.push(`${publishedArticles.length} blog articles published`);
    if (recentArticles.length > 0) actions.push(`${recentArticles.length} articles generated in last 30 days`);
    if (recentLeads.length > 0) actions.push(`${recentLeads.length} new form leads in last 7 days`);
    if (recentSessions.length > 0) actions.push(`${recentSessions.length} website sessions tracked in last 7 days`);
    if (uniqueCompanies > 0) actions.push(`${uniqueCompanies} unique companies identified visiting the site`);
    if (topSource) actions.push(`Top lead source: ${topSource[0]} (${topSource[1]} leads)`);

    if (publishedArticles.length < 5) blockers.push("Low published article count — content pipeline needs attention");
    if (draftArticles.length > 10) blockers.push(`${draftArticles.length} draft articles not yet published`);
    if (recentLeads.length === 0) blockers.push("No new leads in 7 days — check form conversion and traffic");

    return {
      department: "Marketing",
      status: actions.length > 0 ? "completed" : "partial",
      actionsTaken: actions,
      blockers,
      metrics: {
        totalArticles: articles.length,
        publishedArticles: publishedArticles.length,
        draftArticles: draftArticles.length,
        recentArticles30d: recentArticles.length,
        totalLeads: allLeads.length,
        newLeads7d: recentLeads.length,
        sessions7d: recentSessions.length,
        uniqueCompanies: uniqueCompanies,
        topLeadSource: topSource?.[0] ?? "unknown",
      },
      recommendations: [
        draftArticles.length > 0 ? `Publish ${draftArticles.length} draft articles to boost SEO` : "Content pipeline is clear",
        recentLeads.length < 3 ? "Low lead volume — consider running ads or promotional content" : "Lead flow is healthy",
        uniqueCompanies > 5 ? `${uniqueCompanies} companies visiting — sales team should review site intelligence` : "Increase site traffic to identify more prospects",
      ],
    };
  } catch (err: any) {
    return {
      department: "Marketing",
      status: "failed",
      actionsTaken: [],
      blockers: [`Marketing AI error: ${err.message}`],
      metrics: {},
      recommendations: [],
    };
  }
}
