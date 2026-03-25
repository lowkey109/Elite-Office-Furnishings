import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

export const walkinshawCampaigns = pgTable("walkinshaw_campaigns", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  prizeName: text("prize_name").notNull(),
  prizeValueAud: numeric("prize_value_aud", { precision: 12, scale: 2 }).notNull(),
  fundingTargetAud: numeric("funding_target_aud", { precision: 12, scale: 2 }).notNull(),
  qldOnly: boolean("qld_only").notNull().default(true),
  status: text("status").notNull().default("draft"), // draft | live | closed | drawn
  startsAt: timestamp("starts_at"),
  closesAt: timestamp("closes_at"),
  drawAt: timestamp("draw_at"),
  termsVersion: text("terms_version").notNull().default("v1"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walkinshawLeads = pgTable("walkinshaw_leads", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  state: text("state").notNull(),
  teamSize: text("team_size"),
  projectType: text("project_type"),
  budgetBand: text("budget_band"),
  timeline: text("timeline"),
  message: text("message"),
  acceptedTerms: boolean("accepted_terms").notNull().default(false),
  acceptedMarketing: boolean("accepted_marketing").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walkinshawDeals = pgTable("walkinshaw_deals", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  leadId: integer("lead_id"),
  companyName: text("company_name").notNull(),
  dealStage: text("deal_stage").notNull(), // lead | qualified | quoted | deposit_paid | won | lost
  contractValueAud: numeric("contract_value_aud", { precision: 12, scale: 2 }).notNull(),
  grossMarginAud: numeric("gross_margin_aud", { precision: 12, scale: 2 }).notNull().default("0"),
  entriesAwarded: integer("entries_awarded").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walkinshawEntries = pgTable("walkinshaw_entries", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  leadId: integer("lead_id"),
  dealId: integer("deal_id"),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  sourceType: text("source_type").notNull(), // enquiry | qualified | quote | deposit_paid | won
  entryCount: integer("entry_count").notNull(),
  eligible: boolean("eligible").notNull().default(true),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});