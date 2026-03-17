import { db } from "../../db";
import { proposals, quotes, planningRequests } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";

export interface ProposalContent {
  clientName: string;
  companyName?: string;
  email?: string;
  quoteNumber?: string;
  projectSummary?: string;
  officeSizeSqm?: number;
  staffCount?: number;
  quoteItems?: any[];
  subtotal?: number;
  freightCost?: number;
  installationCost?: number;
  otherCosts?: number;
  discount?: number;
  gst?: number;
  totalIncGst?: number;
  timeline?: string;
  terms?: string;
  preparedBy?: string;
  validityDays?: number;
  floorPlanUrl?: string;
}

const PIPELINE_STAGES = ["lead", "qualified", "meeting_booked", "proposal_sent", "negotiation", "approved", "won", "lost"];

function generateHtmlProposal(content: ProposalContent): string {
  const items = content.quoteItems ? JSON.parse(typeof content.quoteItems === "string" ? content.quoteItems : JSON.stringify(content.quoteItems)) : [];
  const formatCurrency = (cents: number) => `$${((cents || 0) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proposal – ${content.companyName || content.clientName}</title>
<style>
  body { font-family: 'Georgia', serif; color: #1a1a1a; background: #fff; margin: 0; padding: 40px; }
  .header { border-bottom: 3px solid #c9a84c; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand { font-size: 22px; font-weight: bold; color: #1a1a1a; letter-spacing: 1px; }
  .brand span { color: #c9a84c; }
  .meta { text-align: right; font-size: 13px; color: #666; }
  h1 { font-size: 28px; color: #1a1a1a; margin: 0 0 8px; }
  h2 { font-size: 16px; color: #c9a84c; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 32px; }
  .client-block { background: #f9f7f2; border-left: 4px solid #c9a84c; padding: 16px 20px; margin: 24px 0; }
  .client-block p { margin: 4px 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #1a1a1a; color: #c9a84c; text-align: left; padding: 10px 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .totals { margin-top: 16px; margin-left: auto; width: 320px; }
  .totals td { padding: 6px 12px; font-size: 14px; }
  .totals .total-row td { font-size: 16px; font-weight: bold; background: #1a1a1a; color: #c9a84c; }
  .timeline, .terms { background: #f9f7f2; padding: 16px 20px; border-radius: 4px; font-size: 14px; line-height: 1.7; }
  .floor-plan img { max-width: 100%; border: 1px solid #eee; border-radius: 4px; }
  .footer { margin-top: 48px; border-top: 1px solid #eee; padding-top: 16px; font-size: 12px; color: #999; text-align: center; }
  .valid { background: #c9a84c; color: #fff; padding: 8px 16px; border-radius: 4px; display: inline-block; font-size: 13px; font-weight: bold; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">The Corporate <span>Desk</span></div>
    <div style="font-size:12px;color:#999;margin-top:4px;">thecorporatedesk.com.au</div>
  </div>
  <div class="meta">
    <div style="font-size:18px;font-weight:bold;color:#1a1a1a;">PROPOSAL</div>
    ${content.quoteNumber ? `<div>Ref: ${content.quoteNumber}</div>` : ""}
    <div>${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</div>
    ${content.validityDays ? `<div class="valid">Valid ${content.validityDays} Days</div>` : ""}
  </div>
</div>

<h1>Workspace Proposal</h1>
<p style="font-size:15px;color:#555;">Prepared exclusively for</p>

<div class="client-block">
  <p><strong style="font-size:18px;">${content.companyName || content.clientName}</strong></p>
  <p>Attention: ${content.clientName}</p>
  ${content.email ? `<p>Email: ${content.email}</p>` : ""}
  ${content.officeSizeSqm ? `<p>Workspace: ${content.officeSizeSqm} sqm · ${content.staffCount || "?"} staff</p>` : ""}
</div>

${content.projectSummary ? `<h2>Project Overview</h2><p style="font-size:14px;line-height:1.8;">${content.projectSummary}</p>` : ""}

${content.floorPlanUrl ? `<h2>Floor Plan</h2><div class="floor-plan"><img src="${content.floorPlanUrl}" alt="Floor Plan"/></div>` : ""}

${items.length > 0 ? `
<h2>Furniture Selections</h2>
<table>
  <thead>
    <tr><th>Item</th><th>SKU</th><th>Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Line Total</th></tr>
  </thead>
  <tbody>
    ${items.map((item: any) => `
    <tr>
      <td>${item.name || item.productName || "Item"}</td>
      <td style="color:#999;font-size:12px;">${item.sku || "—"}</td>
      <td>${item.quantity || 1}</td>
      <td style="text-align:right;">${formatCurrency((item.unitPrice || item.price || 0))}</td>
      <td style="text-align:right;">${formatCurrency((item.unitPrice || item.price || 0) * (item.quantity || 1))}</td>
    </tr>`).join("")}
  </tbody>
</table>` : ""}

<h2>Pricing Summary</h2>
<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right;">${formatCurrency(content.subtotal || 0)}</td></tr>
  ${content.freightCost ? `<tr><td>Freight</td><td style="text-align:right;">${formatCurrency(content.freightCost)}</td></tr>` : ""}
  ${content.installationCost ? `<tr><td>Installation</td><td style="text-align:right;">${formatCurrency(content.installationCost)}</td></tr>` : ""}
  ${content.otherCosts ? `<tr><td>Other Costs</td><td style="text-align:right;">${formatCurrency(content.otherCosts)}</td></tr>` : ""}
  ${content.discount ? `<tr><td style="color:#c00;">Discount</td><td style="text-align:right;color:#c00;">-${formatCurrency(content.discount)}</td></tr>` : ""}
  ${content.gst ? `<tr><td>GST (10%)</td><td style="text-align:right;">${formatCurrency(content.gst)}</td></tr>` : ""}
  <tr class="total-row"><td>TOTAL (inc. GST)</td><td style="text-align:right;">${formatCurrency(content.totalIncGst || 0)}</td></tr>
</table>

${content.timeline ? `<h2>Project Timeline</h2><div class="timeline">${content.timeline}</div>` : `
<h2>Project Timeline</h2>
<div class="timeline">
  <strong>Week 1–2:</strong> Space planning &amp; order confirmation<br/>
  <strong>Week 3–6:</strong> Manufacturing &amp; procurement<br/>
  <strong>Week 7–8:</strong> Delivery &amp; installation<br/>
  <strong>Week 8:</strong> Handover &amp; sign-off
</div>`}

<h2>Terms &amp; Conditions</h2>
<div class="terms">${content.terms || `
  <strong>Payment:</strong> 30% deposit required to commence order. Balance due prior to delivery.<br/>
  <strong>Warranty:</strong> All furniture carries a minimum 2-year commercial warranty.<br/>
  <strong>Delivery:</strong> White-glove delivery and installation included in quoted price.<br/>
  <strong>Cancellations:</strong> Orders cancelled after manufacturing commencement may incur a restocking fee.<br/>
  <strong>Validity:</strong> This proposal is valid for ${content.validityDays || 30} days from the date of issue.
`}</div>

<div class="footer">
  <p>Prepared by ${content.preparedBy || "The Corporate Desk"} · thecorporatedesk.com.au · ABN 00 000 000 000</p>
  <p>This document is confidential and intended solely for the named recipient.</p>
</div>
</body>
</html>`;
}

export class ProposalService {
  async generateFromQuote(quoteId: string, options?: { opportunityId?: string; title?: string }): Promise<typeof proposals.$inferSelect> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!quote) throw new Error(`Quote ${quoteId} not found`);

    const existingVersions = await db.select().from(proposals)
      .where(eq(proposals.quoteId, quoteId))
      .orderBy(desc(proposals.version))
      .limit(1);
    const nextVersion = existingVersions.length > 0 ? (existingVersions[0].version + 1) : 1;

    const content: ProposalContent = {
      clientName: quote.clientName,
      companyName: quote.companyName || undefined,
      email: quote.email,
      quoteNumber: quote.quoteNumber,
      projectSummary: quote.projectSummary || undefined,
      officeSizeSqm: quote.officeSizeSqm || undefined,
      staffCount: quote.staffCount || undefined,
      subtotal: quote.subtotal || 0,
      freightCost: quote.freightCost || 0,
      installationCost: quote.installationCost || 0,
      otherCosts: quote.otherCosts || 0,
      discount: quote.discount || 0,
      gst: quote.gst || 0,
      totalIncGst: quote.totalIncGst || 0,
      validityDays: quote.validityDays || 30,
      preparedBy: quote.preparedBy || "The Corporate Desk",
      quoteItems: quote.quoteItems || undefined,
    };

    const htmlContent = generateHtmlProposal(content);

    const [newProposal] = await db.insert(proposals).values({
      opportunityId: options?.opportunityId || quote.opportunityId || undefined,
      quoteId,
      version: nextVersion,
      title: options?.title || `Workspace Proposal – ${content.companyName || content.clientName}`,
      clientName: content.clientName,
      companyName: content.companyName || undefined,
      email: content.email || undefined,
      htmlContent,
      contentJson: JSON.stringify(content),
      status: "draft",
      validUntil: new Date(Date.now() + (content.validityDays || 30) * 24 * 60 * 60 * 1000),
    }).returning();

    await db.update(quotes).set({ pipelineStage: "proposal_sent", updatedAt: new Date() }).where(eq(quotes.id, quoteId));

    return newProposal;
  }

  async listProposals(filters?: { status?: string; quoteId?: string }) {
    let query = db.select().from(proposals).orderBy(desc(proposals.createdAt));
    const results = await query;
    return results.filter(p => {
      if (filters?.status && p.status !== filters.status) return false;
      if (filters?.quoteId && p.quoteId !== filters.quoteId) return false;
      return true;
    });
  }

  async updateStatus(proposalId: string, status: string, meta?: { rejectionReason?: string }) {
    const updates: any = { status, updatedAt: new Date() };
    if (status === "sent") updates.sentAt = new Date();
    if (status === "viewed") updates.viewedAt = new Date();
    if (status === "approved") updates.approvedAt = new Date();
    if (status === "rejected") {
      updates.rejectedAt = new Date();
      if (meta?.rejectionReason) updates.rejectionReason = meta.rejectionReason;
    }
    const [updated] = await db.update(proposals).set(updates).where(eq(proposals.id, proposalId)).returning();
    return updated;
  }

  async getProposalStats() {
    const all = await db.select().from(proposals);
    return {
      total: all.length,
      draft: all.filter(p => p.status === "draft").length,
      sent: all.filter(p => p.status === "sent").length,
      viewed: all.filter(p => p.status === "viewed").length,
      approved: all.filter(p => p.status === "approved").length,
      rejected: all.filter(p => p.status === "rejected").length,
    };
  }

  getPipelineStages() {
    return PIPELINE_STAGES;
  }
}

export const proposalService = new ProposalService();
