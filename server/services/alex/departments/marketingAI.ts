/**
 * Marketing AI — ACTIVE EXECUTION
 *
 * Real work:
 *  1. Publish draft articles that have title + body (update status draft → published)
 *  2. Score/tag leads that have no formType (unknown source)
 *  3. Identify company visitor sessions from last 7 days worth actioning
 *
 * Returns before/after article publish counts.
 */

import { db } from "../../../db";
import { generatedBlogArticles, leads, visitorSessions } from "../../../../shared/schema";
import { desc, eq, isNull, count, and, sql } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runMarketingAI(): Promise<DepartmentResult> {
  const start = Date.now();
  const actions: string[] = [];
  const blockers: string[] = [];
  const recordsUpdated: string[] = [];

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // ── Before state ──────────────────────────────────────────────────────────────
  const allArticles = await db.select().from(generatedBlogArticles)
    .orderBy(desc(generatedBlogArticles.generatedAt)).limit(200);
  const draftArticles = allArticles.filter(a => a.status === "draft" || a.status === "pending");
  const publishedBefore = allArticles.filter(a => a.status === "published").length;

  const before = {
    publishedArticles: publishedBefore,
    draftArticles: draftArticles.length,
  };

  // ── Action 1: Publish draft articles that have title + content ────────────────
  // Only publish if article has both title and body content
  const readyToPublish = draftArticles.filter(a =>
    a.title &&
    a.title.length > 5 &&
    a.content &&
    (a.content as string).length > 200
  );

  let published = 0;
  for (const article of readyToPublish.slice(0, 10)) {
    try {
      await db.update(generatedBlogArticles).set({
        status: "published",
        publishedAt: new Date(),
      }).where(eq(generatedBlogArticles.id, article.id));
      recordsUpdated.push(`generated_blog_articles#${article.id} ("${article.title?.slice(0, 50)}"): status draft → published`);
      published++;
    } catch (err: any) {
      blockers.push(`Could not publish article ${article.id}: ${err.message}`);
    }
  }
  if (published > 0) actions.push(`${published} blog articles published (had title + content)`);

  const unpublishableCount = draftArticles.length - readyToPublish.length;
  if (unpublishableCount > 0) {
    blockers.push(`${unpublishableCount} draft articles missing content body — cannot publish yet`);
  }

  // ── Action 2: Tag untagged leads with source ──────────────────────────────────
  const untaggedLeads = await db.select().from(leads)
    .where(sql`${leads.source} IS NULL OR ${leads.source} = ''`)
    .limit(50);

  let tagged = 0;
  for (const lead of untaggedLeads) {
    try {
      await db.update(leads).set({
        source: "organic_web",
      }).where(eq(leads.id, lead.id));
      tagged++;
    } catch {}
  }
  if (tagged > 0) {
    actions.push(`${tagged} leads tagged with source 'organic_web' (previously untagged)`);
    recordsUpdated.push(`leads: ${tagged} rows updated, source → organic_web`);
  }

  // ── Read: Sessions + company intelligence ─────────────────────────────────────
  const sessions7d = await db.select().from(visitorSessions)
    .where(sql`${visitorSessions.createdAt} >= ${since7d.toISOString()}`)
    .limit(500);
  const uniqueCompanies = [...new Set(sessions7d.map(s => s.companyName).filter(Boolean))];
  const newLeads7d = await db.select({ n: count() }).from(leads)
    .where(sql`${leads.createdAt} >= ${since7d.toISOString()}`);
  const recentArticles = allArticles.filter(a =>
    a.generatedAt && new Date(a.generatedAt) >= since30d
  ).length;

  if (sessions7d.length > 0) {
    actions.push(`${sessions7d.length} website sessions tracked (${uniqueCompanies.length} unique companies) in last 7 days`);
  }
  if (uniqueCompanies.length > 0) {
    actions.push(`${uniqueCompanies.length} companies identified visiting site: ${uniqueCompanies.slice(0, 3).join(", ")}${uniqueCompanies.length > 3 ? " ..." : ""}`);
  }

  const afterPublished = publishedBefore + published;
  const after = {
    publishedArticles: afterPublished,
    draftArticles: draftArticles.length - published,
    articlesPublishedThisCycle: published,
    leadsTagged: tagged,
  };

  const status = published > 0 || tagged > 0 ? "completed"
    : blockers.length > 0 ? "partial"
    : "completed";

  return {
    department: "Marketing",
    status,
    actionsTaken: actions.length > 0 ? actions : ["No publishable articles or untagged leads found"],
    blockers,
    recordsUpdated,
    before,
    after,
    executionMs: Date.now() - start,
    metrics: {
      published,
      tagged,
      totalArticles: allArticles.length,
      publishedArticles: afterPublished,
      draftArticles: draftArticles.length - published,
      newLeads7d: newLeads7d[0].n,
      sessions7d: sessions7d.length,
      uniqueCompanies: uniqueCompanies.length,
      recentArticles30d: recentArticles,
    },
    recommendations: [
      published > 0 ? `${published} articles now live — submit sitemap to Google Search Console` : "No articles ready to publish",
      unpublishableCount > 0 ? `${unpublishableCount} articles need content completion before publishing` : "All articles are current",
      uniqueCompanies.length > 5 ? `${uniqueCompanies.length} companies visiting — SalesAI should cross-reference with pipeline` : "Low company identification — check visitor tracking script",
    ],
  };
}
