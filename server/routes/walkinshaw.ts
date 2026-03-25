import { Router } from "express";
import { db } from "../db";
import { sql, eq, desc } from "drizzle-orm";
import {
  walkinshawCampaigns,
  walkinshawDeals,
  walkinshawEntries,
  walkinshawLeads,
} from "../../shared/walkinshawSchema";
import {
  WALKINSHAW_CONFIG,
  ENTRY_RULES,
  isEligibleState,
  normaliseState,
} from "../walkinshawConfig";

const router = Router();

async function ensureCampaign() {
  const existing = await db
    .select()
    .from(walkinshawCampaigns)
    .where(eq(walkinshawCampaigns.slug, WALKINSHAW_CONFIG.slug))
    .limit(1);

  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(walkinshawCampaigns)
    .values({
      slug: WALKINSHAW_CONFIG.slug,
      title: WALKINSHAW_CONFIG.title,
      prizeName: WALKINSHAW_CONFIG.prizeName,
      prizeValueAud: String(WALKINSHAW_CONFIG.prizeValueAud),
      fundingTargetAud: String(WALKINSHAW_CONFIG.fundingTargetAud),
      qldOnly: WALKINSHAW_CONFIG.qldOnly,
      status: WALKINSHAW_CONFIG.status,
      startsAt: new Date(WALKINSHAW_CONFIG.startsAt),
      closesAt: new Date(WALKINSHAW_CONFIG.closesAt),
      drawAt: new Date(WALKINSHAW_CONFIG.drawAt),
      termsVersion: WALKINSHAW_CONFIG.termsVersion,
      metadata: {
        note: "QLD-only by default until national permits/legal review are complete",
      },
    })
    .returning();

  return inserted[0];
}

router.get("/api/promo/walkinshaw/config", async (_req, res) => {
  const campaign = await ensureCampaign();
  res.json({ ok: true, campaign });
});

router.get("/api/promo/walkinshaw/dashboard", async (_req, res) => {
  const campaign = await ensureCampaign();

  const totals = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(contract_value_aud AS numeric)), 0) AS contract_total,
      COALESCE(SUM(CAST(gross_margin_aud AS numeric)), 0) AS gross_margin_total,
      COALESCE(SUM(entries_awarded), 0) AS total_entries
    FROM walkinshaw_deals
    WHERE campaign_id = ${campaign.id}
      AND deal_stage IN ('qualified', 'quoted', 'deposit_paid', 'won')
  `);

  const recentDeals = await db
    .select()
    .from(walkinshawDeals)
    .where(eq(walkinshawDeals.campaignId, campaign.id))
    .orderBy(desc(walkinshawDeals.createdAt))
    .limit(20);

  const leadCount = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM walkinshaw_leads
    WHERE campaign_id = ${campaign.id}
  `);

  const contractTotal = Number(totals.rows[0]?.contract_total || 0);
  const grossMarginTotal = Number(totals.rows[0]?.gross_margin_total || 0);
  const totalEntries = Number(totals.rows[0]?.total_entries || 0);
  const leadTotal = Number(leadCount.rows[0]?.count || 0);
  const fundingTarget = Number(campaign.fundingTargetAud || 0);
  const fundingProgressPct = fundingTarget > 0 ? Math.min(100, (contractTotal / fundingTarget) * 100) : 0;

  res.json({
    ok: true,
    campaign,
    metrics: {
      leadTotal,
      contractTotal,
      grossMarginTotal,
      totalEntries,
      fundingTarget,
      fundingProgressPct,
      canAwardPrize: contractTotal >= fundingTarget,
    },
    recentDeals,
  });
});

router.post("/api/promo/walkinshaw/enter", async (req, res) => {
  try {
    const campaign = await ensureCampaign();

    const {
      companyName,
      contactName,
      email,
      phone,
      state,
      teamSize,
      projectType,
      budgetBand,
      timeline,
      message,
      acceptedTerms,
      acceptedMarketing,
    } = req.body ?? {};

    if (!companyName || !contactName || !email || !state || !acceptedTerms) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields",
      });
    }

    const stateCode = normaliseState(state);
    const eligible = isEligibleState(stateCode);

    const leadInserted = await db
      .insert(walkinshawLeads)
      .values({
        campaignId: campaign.id,
        companyName,
        contactName,
        email,
        phone,
        state: stateCode,
        teamSize,
        projectType,
        budgetBand,
        timeline,
        message,
        acceptedTerms: Boolean(acceptedTerms),
        acceptedMarketing: Boolean(acceptedMarketing),
      })
      .returning();

    const lead = leadInserted[0];

    const entryCount = eligible ? ENTRY_RULES.enquiry : 0;

    await db.insert(walkinshawEntries).values({
      campaignId: campaign.id,
      leadId: lead.id,
      companyName,
      contactName,
      email,
      sourceType: "enquiry",
      entryCount,
      eligible,
      reason: eligible
        ? "QLD enquiry entry awarded"
        : "Stored as lead only. State not currently eligible for entry.",
    });

    return res.json({
      ok: true,
      message: eligible
        ? "Entry received. You are currently in the draw."
        : "Lead received. Entry is pending because this campaign is currently limited to Queensland.",
      eligible,
      entriesAwarded: entryCount,
      leadId: lead.id,
    });
  } catch (error) {
    console.error("walkinshaw enter failed", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

router.post("/api/promo/walkinshaw/admin/deal", async (req, res) => {
  try {
    const campaign = await ensureCampaign();
    const {
      leadId,
      companyName,
      dealStage,
      contractValueAud,
      grossMarginAud,
      notes,
    } = req.body ?? {};

    if (!companyName || !dealStage || contractValueAud == null) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const entriesAwarded =
      dealStage === "qualified"
        ? ENTRY_RULES.qualified
        : dealStage === "quoted"
        ? ENTRY_RULES.quote
        : dealStage === "deposit_paid"
        ? ENTRY_RULES.deposit_paid
        : dealStage === "won"
        ? ENTRY_RULES.won
        : 0;

    const dealInserted = await db
      .insert(walkinshawDeals)
      .values({
        campaignId: campaign.id,
        leadId: leadId ?? null,
        companyName,
        dealStage,
        contractValueAud: String(contractValueAud),
        grossMarginAud: String(grossMarginAud ?? 0),
        entriesAwarded,
        notes,
      })
      .returning();

    const deal = dealInserted[0];

    await db.insert(walkinshawEntries).values({
      campaignId: campaign.id,
      leadId: leadId ?? null,
      dealId: deal.id,
      companyName,
      sourceType: dealStage,
      entryCount: entriesAwarded,
      eligible: true,
      reason: `Entries awarded for stage ${dealStage}`,
    });

    return res.json({ ok: true, deal });
  } catch (error) {
    console.error("walkinshaw deal failed", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

router.get("/api/promo/walkinshaw/terms", async (_req, res) => {
  const campaign = await ensureCampaign();

  res.json({
    ok: true,
    terms: {
      campaignTitle: campaign.title,
      version: campaign.termsVersion,
      prizeName: campaign.prizeName,
      prizeValueAud: campaign.prizeValueAud,
      qldOnly: campaign.qldOnly,
      startsAt: campaign.startsAt,
      closesAt: campaign.closesAt,
      drawAt: campaign.drawAt,
    },
  });
});

export default router;