// ─── Autonomous Business Intelligence Engine ──────────────────────────────────
// Generates spending trend insights, SEO blog articles, website issue audits,
// system health checks, and weekly business reports using real AI.

import OpenAI from "openai";
import { storage } from "../storage";

function getOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

// ─── Week helper ──────────────────────────────────────────────────────────────

function currentPeriodWeek(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ─── Spending Trend Analysis ──────────────────────────────────────────────────

export async function analyzeSpendingTrends(): Promise<void> {
  console.log("[Intelligence] Running spending trend analysis...");

  const openai = getOpenAI();

  const prompt = `You are a senior commercial intelligence analyst for The Corporate Desk, an Australian premium office furniture company selling to corporates in Sydney, Melbourne, Brisbane, and Perth.

Analyse current Australian B2B office furniture market conditions and spending trends for early 2026. Consider:
- Australian office market recovery and return-to-office mandates
- Key industry sectors investing in office fitouts (legal, finance, tech, government)
- Ergonomics, biophilic design, and sit-stand desk trends
- Premium vs value-engineered fitouts — where is demand shifting?
- Supplier lead times from China and supply chain normalisation
- Sustainability and NABERS rating requirements driving fitout decisions

Return a JSON array of 6 spending trend insights in this exact format:
[
  {
    "category": "category name",
    "trend": "growing|declining|stable",
    "insight": "2-3 sentence insight",
    "confidenceLevel": "high|medium|low",
    "sourceNotes": "brief methodology note"
  }
]

Categories to cover: Executive Seating, Sit-Stand Workstations, Meeting Rooms, Acoustic Solutions, Reception & Lounge, Storage & Filing`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  let trends: any[] = [];
  try {
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    trends = Array.isArray(parsed) ? parsed : (parsed.trends || parsed.data || []);
  } catch {
    console.error("[Intelligence] Failed to parse spending trends JSON");
    return;
  }

  const week = currentPeriodWeek();

  for (const trend of trends) {
    await storage.createSpendingTrend({
      category: trend.category || "General",
      trend: trend.trend || "stable",
      insight: trend.insight || "",
      confidenceLevel: trend.confidenceLevel || "medium",
      sourceNotes: trend.sourceNotes || "AI market analysis",
      periodWeek: week,
    });
  }

  console.log(`[Intelligence] Created ${trends.length} spending trend records for ${week}`);
}

// ─── SEO Blog Article Generation ─────────────────────────────────────────────

const SEO_TOPICS = [
  "office fitout costs Australia 2026",
  "ergonomic office chairs for executives Sydney",
  "open plan office design Melbourne",
  "sit stand desks benefits productivity",
  "office furniture trends Australia 2026",
  "reception area design ideas corporate",
  "sustainable office furniture Australia",
  "office move checklist furniture planning",
  "executive office setup ideas premium",
  "acoustic office solutions open plan noise",
];

export async function generateSEOBlogArticle(customTopic?: string): Promise<void> {
  console.log("[Intelligence] Generating SEO blog article...");

  const openai = getOpenAI();
  const topic = customTopic || SEO_TOPICS[Math.floor(Math.random() * SEO_TOPICS.length)];

  const prompt = `You are a senior content strategist for The Corporate Desk (thecorporatedesk.com.au), a premium Australian office furniture company. Write a comprehensive, SEO-optimised blog article for the topic: "${topic}"

The article must:
- Be 800–1200 words, written in a professional Australian tone
- Include practical advice, specific examples, and actionable insights
- Be formatted in Markdown with H2/H3 headings
- Naturally reference "The Corporate Desk" as a resource without being promotional
- Include an internal linking opportunity to the AI Office Planner (/office-planner)
- Be genuinely helpful to facility managers, office managers, and business owners in Australia

Return JSON in this exact format:
{
  "title": "SEO-optimised article title",
  "slug": "url-slug-no-spaces",
  "metaDescription": "155-character meta description",
  "category": "Design Tips|Buying Guides|Trends|Planning",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "content": "full markdown content",
  "internalLinkingSuggestions": "suggested internal links in plain text",
  "imagePrompts": ["image 1 description", "image 2 description"],
  "qualityScore": 85
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  let article: any = {};
  try {
    article = JSON.parse(response.choices[0].message.content || "{}");
  } catch {
    console.error("[Intelligence] Failed to parse blog article JSON");
    return;
  }

  if (!article.title || !article.content) {
    console.error("[Intelligence] Blog article missing required fields");
    return;
  }

  await storage.createGeneratedBlogArticle({
    title: article.title,
    slug: article.slug || article.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    metaDescription: article.metaDescription || "",
    content: article.content,
    category: article.category || "Design Tips",
    tags: Array.isArray(article.tags) ? article.tags : [],
    internalLinkingSuggestions: article.internalLinkingSuggestions || "",
    imagePrompts: Array.isArray(article.imagePrompts) ? article.imagePrompts : [],
    qualityScore: article.qualityScore || 75,
    status: "draft",
    publishedAt: null,
  });

  console.log(`[Intelligence] Blog article generated: "${article.title}"`);
}

// ─── Website Issue Detection ──────────────────────────────────────────────────

export async function detectWebsiteIssues(): Promise<void> {
  console.log("[Intelligence] Running website issue detection audit...");

  const openai = getOpenAI();

  // Gather data to audit
  const [leads, planningRequests, supplierQuotes] = await Promise.all([
    storage.getLeads(),
    storage.getPlanningRequests(),
    storage.getSupplierQuotes(),
  ]);

  const recentLeads = leads.slice(0, 20);
  const recentRequests = planningRequests.slice(0, 10);

  const prompt = `You are a digital conversion optimisation analyst for The Corporate Desk (thecorporatedesk.com.au), a premium Australian office furniture company.

Based on the following business data, identify potential website issues, conversion gaps, and UX problems that should be investigated:

Recent leads (last 20): ${recentLeads.length} leads
- Lead types: ${[...new Set(recentLeads.map((l) => l.type))].join(", ")}
- Missing phone numbers: ${recentLeads.filter((l) => !l.phone).length}
- Missing office size: ${recentLeads.filter((l) => !l.officeSize).length}
- Missing budget: ${recentLeads.filter((l) => !l.budgetRange).length}

Planning requests: ${recentRequests.length} requests
- Paid conversions: ${recentRequests.filter((r) => r.isPaid).length}
- Unpaid: ${recentRequests.filter((r) => !r.isPaid).length}
- Missing AI summary: ${recentRequests.filter((r) => !r.aiSummary).length}

Supplier quotes: ${supplierQuotes.length} total

Based on this data, generate 4-6 actionable website/conversion issues to investigate. Return JSON array:
[
  {
    "issueType": "conversion_drop|missing_data|form_failure|seo_gap|ux_friction|data_quality",
    "severity": "critical|warning|info",
    "description": "Clear description of the issue",
    "affectedUrl": "/relevant-page or null",
    "affectedItem": "specific element or null",
    "suggestion": "Specific recommended fix"
  }
]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  let issues: any[] = [];
  try {
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    issues = Array.isArray(parsed) ? parsed : (parsed.issues || parsed.data || []);
  } catch {
    console.error("[Intelligence] Failed to parse website issues JSON");
    return;
  }

  for (const issue of issues) {
    await storage.createWebsiteIssue({
      issueType: issue.issueType || "ux_friction",
      severity: issue.severity || "warning",
      description: issue.description || "",
      affectedUrl: issue.affectedUrl || null,
      affectedItem: issue.affectedItem || null,
      suggestion: issue.suggestion || "",
      status: "open",
      resolvedAt: null,
    });
  }

  console.log(`[Intelligence] Detected ${issues.length} website issues`);
}

// ─── System Health Check ──────────────────────────────────────────────────────

export interface SystemHealthReport {
  timestamp: string;
  overall: "healthy" | "degraded" | "critical";
  checks: Array<{
    name: string;
    status: "pass" | "warn" | "fail";
    latencyMs?: number;
    detail: string;
  }>;
  summary: string;
}

export async function runSystemHealthCheck(): Promise<SystemHealthReport> {
  console.log("[Intelligence] Running system health check...");

  const checks: SystemHealthReport["checks"] = [];
  const start = Date.now();

  // DB connectivity check
  try {
    const dbStart = Date.now();
    await storage.getLeads();
    checks.push({
      name: "Database Connectivity",
      status: "pass",
      latencyMs: Date.now() - dbStart,
      detail: "PostgreSQL responding within acceptable latency",
    });
  } catch (err: any) {
    checks.push({
      name: "Database Connectivity",
      status: "fail",
      detail: `DB error: ${err.message}`,
    });
  }

  // OpenAI API check
  try {
    const aiStart = Date.now();
    const openai = getOpenAI();
    await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5,
    });
    checks.push({
      name: "OpenAI API",
      status: "pass",
      latencyMs: Date.now() - aiStart,
      detail: "GPT-4o responding normally",
    });
  } catch (err: any) {
    checks.push({
      name: "OpenAI API",
      status: "fail",
      detail: `OpenAI error: ${err.message}`,
    });
  }

  // Stripe environment check
  checks.push({
    name: "Stripe Configuration",
    status: process.env.STRIPE_SECRET_KEY ? "pass" : "warn",
    detail: process.env.STRIPE_SECRET_KEY
      ? "Stripe secret key configured"
      : "STRIPE_SECRET_KEY not set — payments disabled",
  });

  // Email (Resend) check
  checks.push({
    name: "Email Service (Resend)",
    status: process.env.RESEND_API_KEY ? "pass" : "warn",
    detail: process.env.RESEND_API_KEY
      ? "Resend API key configured"
      : "RESEND_API_KEY not set — emails disabled",
  });

  // Follow-up sequences health
  try {
    const sequences = await storage.getFollowUpSequences();
    const active = sequences.filter((s) => s.status === "active").length;
    checks.push({
      name: "Follow-Up Email Sequences",
      status: "pass",
      detail: `${active} active sequences, ${sequences.length} total`,
    });
  } catch {
    checks.push({ name: "Follow-Up Email Sequences", status: "warn", detail: "Could not fetch sequences" });
  }

  // Planning requests health
  try {
    const requests = await storage.getPlanningRequests();
    const pending = requests.filter((r) => r.status === "New").length;
    checks.push({
      name: "Planning Requests Queue",
      status: pending > 20 ? "warn" : "pass",
      detail: `${pending} new requests awaiting review (${requests.length} total)`,
    });
  } catch {
    checks.push({ name: "Planning Requests Queue", status: "warn", detail: "Could not fetch planning requests" });
  }

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const overall: SystemHealthReport["overall"] =
    failCount > 0 ? "critical" : warnCount > 1 ? "degraded" : "healthy";

  const report: SystemHealthReport = {
    timestamp: new Date().toISOString(),
    overall,
    checks,
    summary: `System is ${overall}. ${checks.filter((c) => c.status === "pass").length}/${checks.length} checks passing. Duration: ${Date.now() - start}ms`,
  };

  console.log(`[Intelligence] Health check complete: ${overall} (${Date.now() - start}ms)`);
  return report;
}

// ─── Weekly Business Intelligence Report ─────────────────────────────────────

export async function generateWeeklyBusinessReport(): Promise<void> {
  console.log("[Intelligence] Generating weekly business report...");

  const openai = getOpenAI();

  const [leads, planningRequests, sequences, workspaceLearning, prospectedLeads] = await Promise.all([
    storage.getLeads(),
    storage.getPlanningRequests(),
    storage.getFollowUpSequences(),
    storage.getWorkspaceLearningRecords(),
    storage.getProspectedLeads(),
  ]);

  // Calculate this week's metrics
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekLeads = leads.filter((l) => l.createdAt && new Date(l.createdAt) > weekAgo);
  const weekRequests = planningRequests.filter((r) => r.createdAt && new Date(r.createdAt) > weekAgo);
  const paidThisWeek = weekRequests.filter((r) => r.isPaid);
  const activeSequences = sequences.filter((s) => s.status === "active");

  const totalPipelineValue = leads
    .filter((l) => l.opportunityScore && l.opportunityScore > 60)
    .length * 95000;

  const prompt = `You are the Chief Intelligence Officer for The Corporate Desk, a premium Australian office furniture company.

Generate a professional weekly business intelligence report based on the following data:

WEEKLY PERFORMANCE:
- New leads this week: ${weekLeads.length}
- New planning requests: ${weekRequests.length}
- Paid AI Planner conversions: ${paidThisWeek.length} (@ $399 each = $${paidThisWeek.length * 399} revenue)
- Active follow-up sequences: ${activeSequences.length}

PIPELINE OVERVIEW:
- Total leads in system: ${leads.length}
- High-priority leads (score > 60): ${leads.filter((l) => (l.opportunityScore || 0) > 60).length}
- Estimated pipeline value: $${totalPipelineValue.toLocaleString()}
- Total prospected companies: ${prospectedLeads.length}

WORKSPACE INTELLIGENCE:
- Total workspace learning records: ${workspaceLearning.length}
- Won projects: ${workspaceLearning.filter((w) => w.conversionResult === "won").length}

Generate a structured weekly business report in Markdown format with sections:
1. Executive Summary (3-4 key bullets)
2. Lead Performance This Week
3. Revenue & Pipeline Health
4. Conversion Funnel Analysis
5. Top 3 Actions for Next Week
6. Market Intelligence Note (brief insight about Australian office furniture market)

Keep it concise, commercial, and action-oriented. Use real numbers provided.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  const content = response.choices[0].message.content || "Report generation failed";
  const week = currentPeriodWeek();
  const now = new Date();

  await storage.createIntelligenceReport({
    reportType: "weekly_business",
    title: `Weekly Business Intelligence Report — ${week}`,
    content,
    period: week,
    status: "draft",
    publishedAt: null,
  });

  console.log(`[Intelligence] Weekly report generated for ${week}`);
}
