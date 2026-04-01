import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  real,
  index,
  uniqueIndex,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ============================================================================
   SHARED HELPERS
   ========================================================================== */

const timestamps = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
};

const audCurrency = text("currency").notNull().default("aud");

/* ============================================================================
   USERS / AUTH
   ========================================================================== */

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  ...timestamps,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/* ============================================================================
   CORE CRM / LEADS
   ========================================================================== */

export const leads = pgTable(
  "leads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    type: text("type").notNull(),
    name: text("name").notNull(),
    company: text("company").notNull().default(""),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    message: text("message"),

    officeSizeSqm: integer("office_size_sqm"),
    staffCount: integer("staff_count"),
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    timeline: text("timeline"),
    officeLocation: text("office_location"),
    moveDate: text("move_date"),

    opportunityScore: integer("opportunity_score"),
    opportunityTier: text("opportunity_tier"),

    signalsJson: jsonb("signals_json").$type<Record<string, unknown> | null>().default(null),
    nextAction: text("next_action"),
    estimatedValueMin: integer("estimated_value_min"),
    estimatedValueMax: integer("estimated_value_max"),
    estimateJson: jsonb("estimate_json").$type<Record<string, unknown> | null>().default(null),

    sourcePage: text("source_page"),

    nexoraIntent: text("nexora_intent"),
    nexoraJourney: text("nexora_journey"),
    nexoraUrgency: text("nexora_urgency"),
    nexoraConfidence: integer("nexora_confidence"),
    nexoraAdminSummary: text("nexora_admin_summary"),
    nexoraNextAction: text("nexora_next_action"),
    nexoraDealBand: text("nexora_deal_band"),
    nexoraEscalation: text("nexora_escalation"),

    leadStatus: text("lead_status").default("new"), // new|contacted|qualified|proposal|negotiating|won|lost
    nextActionDate: timestamp("next_action_date"),
    hasFloorplan: boolean("has_floorplan").default(false),
    budgetRange: text("budget_range"),

    ...timestamps,
  },
  (t) => ({
    idxLeadsEmail: index("idx_leads_email").on(t.email),
    idxLeadsCompany: index("idx_leads_company").on(t.company),
    idxLeadsStatus: index("idx_leads_status").on(t.leadStatus),
    idxLeadsScore: index("idx_leads_score").on(t.opportunityScore),
  }),
);

export const insertLeadSchema = createInsertSchema(leads)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial({
    company: true,
    phone: true,
    officeSizeSqm: true,
    staffCount: true,
    budgetMin: true,
    budgetMax: true,
    estimatedValueMin: true,
    estimatedValueMax: true,
  });

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

/* ============================================================================
   OPPORTUNITY SPINE (NEW CORE ENTITY)
   ========================================================================== */

export const opportunities = pgTable(
  "opportunities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    leadId: varchar("lead_id"),
    companyId: varchar("company_id"),
    contactId: varchar("contact_id"),

    sourceType: text("source_type").notNull(), // lead|deal_hunter|radar|planning_request|manual|visitor_session|partner_referral
    sourceId: varchar("source_id"),

    companyName: text("company_name").notNull(),
    normalizedCompanyName: text("normalized_company_name"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    city: text("city"),
    state: text("state"),
    country: text("country").notNull().default("Australia"),
    industry: text("industry"),

    projectType: text("project_type"), // relocation|expansion|fitout|new_office|strategy|quote_replacement
    stage: text("stage").notNull().default("new"), // new|qualified|contacted|proposal|negotiating|won|lost|stalled
    status: text("status").notNull().default("open"), // open|closed|archived

    opportunityScore: integer("opportunity_score").notNull().default(0),
    confidenceScore: integer("confidence_score").notNull().default(0),
    urgencyScore: integer("urgency_score").notNull().default(0),
    relocationProbability: integer("relocation_probability").default(0),
    winProbability: integer("win_probability").default(0),

    estimatedValue: integer("estimated_value"),
    weightedValue: integer("weighted_value"),
    expectedProfit: integer("expected_profit"),
    expectedMarginPercent: real("expected_margin_percent"),

    nextBestAction: text("next_best_action"),
    reasoningSummary: text("reasoning_summary"),
    tagsJson: jsonb("tags_json").$type<string[]>().default([]),
    signalsJson: jsonb("signals_json").$type<Record<string, unknown>[]>().default([]),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>().default(null),

    lastActivityAt: timestamp("last_activity_at"),
    wonAt: timestamp("won_at"),
    lostAt: timestamp("lost_at"),
    lostReason: text("lost_reason"),

    ...timestamps,
  },
  (t) => ({
    idxOppCompany: index("idx_opportunities_company").on(t.companyName),
    idxOppNormCompany: index("idx_opportunities_norm_company").on(t.normalizedCompanyName),
    idxOppStage: index("idx_opportunities_stage").on(t.stage),
    idxOppStatus: index("idx_opportunities_status").on(t.status),
    idxOppScore: index("idx_opportunities_score").on(t.opportunityScore),
    idxOppSource: index("idx_opportunities_source").on(t.sourceType, t.sourceId),
  }),
);

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;

/* ============================================================================
   PROSPECTS / EARLY LEADS
   ========================================================================== */

export const prospectedLeads = pgTable(
  "prospected_leads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    company: text("company").notNull(),
    domain: text("domain"),
    website: text("website"),
    location: text("location").notNull(),
    industry: text("industry").notNull(),
    estimatedTeamSize: integer("estimated_team_size"),
    likelyOfficeNeed: text("likely_office_need"),
    signalsDetected: text("signals_detected").array().notNull().default(sql`'{}'`),
    estimatedProjectValue: integer("estimated_project_value"),
    score: integer("score").notNull().default(5),
    priority: text("priority").notNull().default("Medium"),
    decisionMakers: text("decision_makers").notNull(),
    outreachMessage: text("outreach_message").notNull(),
    reasoning: text("reasoning").notNull(),
    rawInput: text("raw_input").notNull(),
    status: text("status").notNull().default("New"),
    sourceType: text("source_type").default("manual"),
    sourceUrl: text("source_url"),
    sourceText: text("source_text"),

    signalType: text("signal_type"),
    city: text("city"),
    contactEmail: text("contact_email"),
    contactRole: text("contact_role"),
    dealProbability: integer("deal_probability"),
    estimatedOfficeSqm: integer("estimated_office_sqm"),
    estimatedHeadcount: integer("estimated_headcount"),
    recommendedNextAction: text("recommended_next_action"),
    outreachSubject: text("outreach_subject"),
    scanBatchId: text("scan_batch_id"),

    ...timestamps,
  },
  (t) => ({
    idxProspectedCompany: index("idx_prospected_company").on(t.company),
    idxProspectedStatus: index("idx_prospected_status").on(t.status),
    idxProspectedScore: index("idx_prospected_score").on(t.score),
  }),
);

export type ProspectedLead = typeof prospectedLeads.$inferSelect;
export type InsertProspectedLead = typeof prospectedLeads.$inferInsert;

/* ============================================================================
   TERRITORIES / BUILDINGS
   ========================================================================== */

export const territories = pgTable("territories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buildingName: text("building_name").notNull(),
  address: text("address"),
  suburb: text("suburb"),
  city: text("city").notNull(),
  state: text("state"),
  propertyType: text("property_type").default("office_tower"),
  notes: text("notes"),
  tenantCount: integer("tenant_count"),
  activeStatus: boolean("active_status").default(true),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  ...timestamps,
});

export const insertTerritorySchema = createInsertSchema(territories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTerritory = z.infer<typeof insertTerritorySchema>;
export type Territory = typeof territories.$inferSelect;

export const buildings = pgTable(
  "buildings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city").notNull(),
    suburb: text("suburb"),
    state: text("state"),
    postcode: text("postcode"),
    lat: real("lat"),
    lng: real("lng"),
    totalAreaSqm: integer("total_area_sqm"),
    floors: integer("floors"),
    buildingGrade: text("building_grade"),
    propertyType: text("property_type").default("commercial_office"),
    yearBuilt: integer("year_built"),
    nabers: real("nabers"),
    currentVacancyPct: real("current_vacancy_pct").default(0),
    currentVacancySqm: integer("current_vacancy_sqm").default(0),
    averageRentPerSqm: integer("average_rent_per_sqm"),
    sourceType: text("source_type").default("manual"),
    sourceUrl: text("source_url"),
    dataQuality: text("data_quality").default("estimated"),
    lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),
    ...timestamps,
  },
  (t) => ({
    idxBuildingCity: index("idx_building_city").on(t.city),
    idxBuildingSuburb: index("idx_building_suburb").on(t.suburb),
  }),
);

export const insertBuildingSchema = createInsertSchema(buildings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildings.$inferSelect;

export const tenants = pgTable(
  "tenants",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyId: varchar("company_id"),
    buildingId: varchar("building_id").notNull(),
    companyName: text("company_name").notNull(),
    floor: text("floor"),
    spaceSizeSqm: integer("space_size_sqm"),
    industry: text("industry"),
    estimatedHeadcount: integer("estimated_headcount"),
    tenantStatus: text("tenant_status").notNull().default("active"),
    sourceType: text("source_type").default("manual"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    idxTenantBuilding: index("idx_tenant_building_id").on(t.buildingId),
    idxTenantCompany: index("idx_tenant_company_id").on(t.companyId),
  }),
);

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

export const leases = pgTable(
  "leases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id").notNull(),
    buildingId: varchar("building_id").notNull(),
    companyName: text("company_name"),
    startDate: timestamp("start_date"),
    expiryDate: timestamp("expiry_date"),
    leaseTermYears: real("lease_term_years"),
    rentPerSqm: integer("rent_per_sqm"),
    spaceSizeSqm: integer("space_size_sqm"),
    totalAnnualRent: integer("total_annual_rent"),
    renewalOptionYears: real("renewal_option_years"),
    breakClauseDate: timestamp("break_clause_date"),
    status: text("status").notNull().default("active"),
    confidenceScore: integer("confidence_score").default(60),
    sourceType: text("source_type").default("manual"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    idxNewLeaseTenant: index("idx_new_lease_tenant_id").on(t.tenantId),
    idxNewLeaseBuilding: index("idx_new_lease_building_id").on(t.buildingId),
    idxNewLeaseExpiry: index("idx_new_lease_expiry_date").on(t.expiryDate),
  }),
);

export const insertLeaseSchema = createInsertSchema(leases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLease = z.infer<typeof insertLeaseSchema>;
export type Lease = typeof leases.$inferSelect;

export const buildingSuburbEdges = pgTable("building_suburb_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buildingId: varchar("building_id").notNull(),
  suburb: text("suburb").notNull(),
  city: text("city").notNull(),
  demandScore: integer("demand_score").default(50),
  vacancyRisk: real("vacancy_risk").default(0.3),
  relocationSignals: integer("relocation_signals").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBuildingSuburbEdgeSchema = createInsertSchema(buildingSuburbEdges).omit({
  id: true,
});
export type InsertBuildingSuburbEdge = z.infer<typeof insertBuildingSuburbEdgeSchema>;
export type BuildingSuburbEdge = typeof buildingSuburbEdges.$inferSelect;

/* ============================================================================
   SUPPLIER / QUOTES / RFQ
   ========================================================================== */

export const supplierQuotes = pgTable("supplier_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierName: text("supplier_name").notNull(),
  supplierPhone: text("supplier_phone"),
  supplierEmail: text("supplier_email"),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull().default(1),
  colourFinish: text("colour_finish"),
  unitPrice: integer("unit_price").notNull(),
  freightCost: integer("freight_cost"),
  leadTime: text("lead_time"),
  quoteDate: text("quote_date").notNull(),
  projectReference: text("project_reference"),
  status: text("status").notNull().default("Requested"),
  notes: text("notes"),
  ...timestamps,
});

export type SupplierQuote = typeof supplierQuotes.$inferSelect;
export type InsertSupplierQuote = typeof supplierQuotes.$inferInsert;

export const quotes = pgTable(
  "quotes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quoteNumber: text("quote_number").notNull(),
    status: text("status").notNull().default("Draft"),
    clientName: text("client_name").notNull(),
    companyName: text("company_name"),
    email: text("email").notNull(),
    phone: text("phone"),
    planningRequestId: text("planning_request_id"),
    opportunityId: varchar("opportunity_id"),
    companyId: varchar("company_id"),

    officeSizeSqm: integer("office_size_sqm"),
    staffCount: integer("staff_count"),
    projectSummary: text("project_summary"),
    quoteItems: jsonb("quote_items").$type<Record<string, unknown>[] | null>().default(null),

    subtotal: integer("subtotal").default(0),
    freightCost: integer("freight_cost").default(0),
    installationCost: integer("installation_cost").default(0),
    otherCosts: integer("other_costs").default(0),
    discount: integer("discount").default(0),
    gst: integer("gst").default(0),
    total: integer("total").default(0),
    totalIncGst: integer("total_inc_gst").default(0),

    costPrice: integer("cost_price").default(0),
    marginPercent: real("margin_percent").default(0),
    discountPercent: real("discount_percent").default(0),
    pipelineStage: text("pipeline_stage").default("lead"),

    financeMonthlyEstimate: integer("finance_monthly_estimate"),
    notes: text("notes"),
    validityDays: integer("validity_days").default(30),
    preparedBy: text("prepared_by").default("The Corporate Desk"),

    sentAt: timestamp("sent_at"),
    financialStatus: text("financial_status").default("draft"),
    depositRequired: boolean("deposit_required").default(false),
    depositAmount: integer("deposit_amount").default(0),
    depositPercent: integer("deposit_percent").default(30),
    amountPaid: integer("amount_paid").default(0),
    amountDue: integer("amount_due").default(0),
    lastPaymentAt: timestamp("last_payment_at"),
    paymentLinkUrl: text("payment_link_url"),
    paymentLinkStatus: text("payment_link_status").default("none"),
    stripePaymentLinkId: text("stripe_payment_link_id"),
    stripeCustomerId: text("stripe_customer_id"),

    ...timestamps,
  },
  (t) => ({
    idxQuotesNumber: uniqueIndex("idx_quotes_number").on(t.quoteNumber),
    idxQuotesCompany: index("idx_quotes_company").on(t.companyName),
    idxQuotesStatus: index("idx_quotes_status").on(t.status),
    idxQuotesOpportunity: index("idx_quotes_opportunity").on(t.opportunityId),
  }),
);

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export const rfqProjects = pgTable("rfq_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectName: text("project_name").notNull(),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  clientEmail: text("client_email"),
  city: text("city"),
  headcount: integer("headcount"),
  officeSizeSqm: integer("office_size_sqm"),
  budget: integer("budget"),
  timeline: text("timeline"),
  status: text("status").notNull().default("draft"),
  furnitureJson: jsonb("furniture_json").$type<Record<string, unknown>[] | null>().default(null),
  recommendationsJson: jsonb("recommendations_json").$type<Record<string, unknown>[] | null>().default(null),
  linkedLeadId: varchar("linked_lead_id"),
  notes: text("notes"),
  ...timestamps,
});

export const insertRfqProjectSchema = createInsertSchema(rfqProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRfqProject = z.infer<typeof insertRfqProjectSchema>;
export type RfqProject = typeof rfqProjects.$inferSelect;

export const rfqResponses = pgTable("rfq_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfqProjectId: varchar("rfq_project_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  category: text("category").notNull(),
  quotedUnitPrice: integer("quoted_unit_price"),
  quotedTotalPrice: integer("quoted_total_price"),
  deliveryWeeks: text("delivery_weeks"),
  availability: text("availability"),
  alternatives: text("alternatives"),
  notes: text("notes"),
  status: text("status").notNull().default("received"),
  ...timestamps,
});

export const insertRfqResponseSchema = createInsertSchema(rfqResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRfqResponse = z.infer<typeof insertRfqResponseSchema>;
export type RfqResponse = typeof rfqResponses.$inferSelect;

/* ============================================================================
   NEXORA / INTELLIGENCE RUNS
   ========================================================================== */

export const nexoraRuns = pgTable("nexora_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  success: boolean("success").notNull().default(false),
  processed: integer("processed").notNull().default(0),
  outreachRuns: integer("outreach_runs").notNull().default(0),
  outreachFailed: integer("outreach_failed").notNull().default(0),
  radarSignals: integer("radar_signals").notNull().default(0),
  dealSignals: integer("deal_signals").notNull().default(0),
  errorsJson: jsonb("errors_json").$type<string[]>().notNull().default([]),
  message: text("message").notNull().default(""),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type NexoraRun = typeof nexoraRuns.$inferSelect;
export type InsertNexoraRun = typeof nexoraRuns.$inferInsert;

/* ============================================================================
   RAW SIGNALS / NORMALISED SIGNALS / EVIDENCE
   ========================================================================== */

export const intelligenceSources = pgTable(
  "intelligence_sources",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    type: text("type").notNull(),
    url: text("url"),
    region: text("region").notNull().default("Australia"),
    isActive: boolean("is_active").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at"),
    fetchIntervalMinutes: integer("fetch_interval_minutes").notNull().default(720),
    totalSignalsIngested: integer("total_signals_ingested").notNull().default(0),
    lastErrorAt: timestamp("last_error_at"),
    lastErrorMessage: text("last_error_message"),
    config: jsonb("config").$type<Record<string, unknown> | null>().default(null),
    ...timestamps,
  },
  (t) => ({
    idxSourceType: index("idx_source_type").on(t.type),
    idxSourceActive: index("idx_source_active").on(t.isActive),
  }),
);

export const insertIntelligenceSourceSchema = createInsertSchema(intelligenceSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntelligenceSource = z.infer<typeof insertIntelligenceSourceSchema>;
export type IntelligenceSource = typeof intelligenceSources.$inferSelect;

export const rawSignals = pgTable(
  "raw_signals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sourceId: varchar("source_id"),
    sourceType: text("source_type").notNull(),
    rawContent: text("raw_content").notNull(),
    url: text("url"),
    publishedAt: timestamp("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow(),
    isProcessed: boolean("is_processed").notNull().default(false),
    processedAt: timestamp("processed_at"),
    processingError: text("processing_error"),
    contentHash: text("content_hash"),
    ...timestamps,
  },
  (t) => ({
    idxRawSignalHash: uniqueIndex("idx_raw_signal_hash").on(t.contentHash),
    idxRawSignalProcessed: index("idx_raw_signal_processed").on(t.isProcessed),
    idxRawSignalFetched: index("idx_raw_signal_fetched").on(t.fetchedAt),
  }),
);

export const insertRawSignalSchema = createInsertSchema(rawSignals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRawSignal = z.infer<typeof insertRawSignalSchema>;
export type RawSignal = typeof rawSignals.$inferSelect;

export const intelligenceSignals = pgTable(
  "intelligence_signals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    rawSignalId: varchar("raw_signal_id"),
    companyName: text("company_name").notNull(),
    normalizedCompanyName: text("normalized_company_name").notNull(),
    city: text("city").notNull(),
    normalizedCity: text("normalized_city").notNull(),
    state: text("state"),
    country: text("country").notNull().default("Australia"),
    signalType: text("signal_type").notNull(),
    signalWindowBucket: text("signal_window_bucket").notNull(),
    signalStrength: real("signal_strength").notNull().default(0),
    confidenceScore: real("confidence_score").notNull().default(0),
    relocationProbability: real("relocation_probability").notNull().default(0),
    tenantMovementScore: real("tenant_movement_score").notNull().default(0),
    vacancyRiskScore: real("vacancy_risk_score").notNull().default(0),
    suburbDemandScore: real("suburb_demand_score").notNull().default(0),
    opportunityScore: real("opportunity_score").notNull().default(0),
    zoneScore: real("zone_score").notNull().default(0),
    commercialTier: text("commercial_tier").default("mid"),
    classification: text("classification"),
    evidenceSummary: text("evidence_summary"),
    linkedRadarId: varchar("linked_radar_id"),
    linkedDealHunterId: varchar("linked_deal_hunter_id"),
    linkedOpportunityId: varchar("linked_opportunity_id"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => ({
    idxIntelSigCompany: index("idx_intel_sig_company").on(t.normalizedCompanyName),
    idxIntelSigCity: index("idx_intel_sig_city").on(t.normalizedCity),
    idxIntelSigType: index("idx_intel_sig_type").on(t.signalType),
    idxIntelSigStatus: index("idx_intel_sig_status").on(t.status),
    idxIntelSigDedupe: uniqueIndex("idx_intel_sig_dedupe").on(
      t.normalizedCompanyName,
      t.normalizedCity,
      t.signalType,
      t.signalWindowBucket,
    ),
  }),
);

export const insertIntelligenceSignalSchema = createInsertSchema(intelligenceSignals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntelligenceSignal = z.infer<typeof insertIntelligenceSignalSchema>;
export type IntelligenceSignal = typeof intelligenceSignals.$inferSelect;

export const signalEvidence = pgTable(
  "signal_evidence",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    intelligenceSignalId: varchar("intelligence_signal_id").notNull(),
    evidenceType: text("evidence_type").notNull(),
    title: text("title"),
    url: text("url"),
    excerpt: text("excerpt"),
    publishedAt: timestamp("published_at"),
    confidenceContribution: real("confidence_contribution").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxEvidenceSignal: index("idx_evidence_signal").on(t.intelligenceSignalId),
  }),
);

export const insertSignalEvidenceSchema = createInsertSchema(signalEvidence).omit({
  id: true,
  createdAt: true,
});
export type InsertSignalEvidence = z.infer<typeof insertSignalEvidenceSchema>;
export type SignalEvidence = typeof signalEvidence.$inferSelect;

/* ============================================================================
   DEAL HUNTER / RADAR / RELOCATION
   ========================================================================== */

export const dealHunterSignals = pgTable(
  "deal_hunter_signals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    companyName: text("company_name").notNull(),
    companyDomain: text("company_domain"),
    city: text("city").notNull(),
    state: text("state"),
    country: text("country").default("Australia"),
    industry: text("industry").notNull(),

    employeeEstimate: integer("employee_estimate"),
    growthRateEstimate: integer("growth_rate_estimate"),
    signalType: text("signal_type").notNull(),
    signalSubtype: text("signal_subtype"),
    signalSource: text("signal_source").notNull(),
    sourceUrl: text("source_url"),
    signalDate: timestamp("signal_date").defaultNow(),
    rawPayloadSummary: text("raw_payload_summary"),

    signalStrengthScore: integer("signal_strength_score").notNull().default(0),
    signalConfidence: integer("signal_confidence").notNull().default(50),
    reasoningSummary: text("reasoning_summary"),

    estimatedWorkspaceSqm: integer("estimated_workspace_sqm"),
    estimatedProjectValue: integer("estimated_project_value"),
    relocationProbability: integer("relocation_probability").default(0),
    officeChangeProbability: integer("office_change_probability").default(0),
    probabilityTier: text("probability_tier").notNull().default("low"),
    projectType: text("project_type"),
    estimatedTimeline: text("estimated_timeline"),
    recommendedAction: text("recommended_action"),
    recommendedOutreachAngle: text("recommended_outreach_angle"),
    recommendedContactRolesJson: jsonb("recommended_contact_roles_json")
      .$type<string[] | null>()
      .default(null),
    outreachDraft: text("outreach_draft"),
    sourceSignalCount: integer("source_signal_count").default(1),

    isReviewed: boolean("is_reviewed").default(false),
    pushedToPipeline: boolean("pushed_to_pipeline").default(false),
    pushedToRadar: boolean("pushed_to_radar").default(false),
    linkedRadarId: varchar("linked_radar_id"),
    linkedProspectId: varchar("linked_prospect_id"),
    linkedOpportunityId: varchar("linked_opportunity_id"),
    isDuplicate: boolean("is_duplicate").default(false),
    mergedFromIds: text("merged_from_ids").array().default(sql`'{}'`),
    status: text("status").notNull().default("new"),
    normalizedCompanyName: text("normalized_company_name"),
    normalizedCity: text("normalized_city"),
    signalWindowBucket: text("signal_window_bucket"),

    ...timestamps,
  },
  (t) => ({
    idxDealHunterCompanyCity: index("idx_deal_hunter_company_city").on(t.companyName, t.city),
    idxDealHunterStatus: index("idx_deal_hunter_status").on(t.status),
    idxDealHunterSignalType: index("idx_deal_hunter_signal_type").on(t.signalType),
    idxDealHunterCreatedAt: index("idx_deal_hunter_created_at").on(t.createdAt),
    idxDealHunterDedupe: uniqueIndex("idx_deal_hunter_dedupe").on(
      t.normalizedCompanyName,
      t.normalizedCity,
      t.signalType,
      t.signalWindowBucket,
    ),
  }),
);

export const insertDealHunterSignalSchema = createInsertSchema(dealHunterSignals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDealHunterSignal = z.infer<typeof insertDealHunterSignalSchema>;
export type DealHunterSignal = typeof dealHunterSignals.$inferSelect;

export const officeMoveRadar = pgTable(
  "office_move_radar",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyName: text("company_name").notNull(),
    industry: text("industry"),
    city: text("city").notNull(),
    state: text("state"),
    country: text("country").default("Australia"),
    signalType: text("signal_type").notNull(),
    signalSubtype: text("signal_subtype"),
    signalSource: text("signal_source"),
    sourceUrl: text("source_url"),
    dateDetected: timestamp("date_detected").defaultNow(),
    confidenceLevel: text("confidence_level").notNull().default("medium"),
    estimatedHeadcount: integer("estimated_headcount"),
    estimatedOfficeSizeSqm: integer("estimated_office_size_sqm"),
    estimatedProjectValue: integer("estimated_project_value"),
    radarScore: integer("radar_score").notNull().default(0),
    priority: text("priority").notNull().default("Medium"),
    recommendedOutreachAngle: text("recommended_outreach_angle"),
    recommendedOffer: text("recommended_offer"),
    recommendedNextAction: text("recommended_next_action"),
    outreachSubject: text("outreach_subject"),
    outreachEmailDraft: text("outreach_email_draft"),
    outreachFollowUp: text("outreach_follow_up"),
    outreachCta: text("outreach_cta"),
    linkedBuildingId: text("linked_building_id"),
    linkedProspectId: text("linked_prospect_id"),
    linkedOpportunityId: varchar("linked_opportunity_id"),
    status: text("status").notNull().default("New"),
    notes: text("notes"),
    sourceType: text("source_type").default("manual"),
    verificationStatus: text("verification_status").default("unverified"),
    evidenceExcerpt: text("evidence_excerpt"),
    normalizedCompanyName: text("normalized_company_name"),
    normalizedCity: text("normalized_city"),
    signalWindowBucket: text("signal_window_bucket"),
    ...timestamps,
  },
  (t) => ({
    idxRadarCompanyCity: index("idx_radar_company_city").on(t.companyName, t.city),
    idxRadarStatus: index("idx_radar_status").on(t.status),
    idxRadarSignalType: index("idx_radar_signal_type").on(t.signalType),
    idxRadarCreatedAt: index("idx_radar_created_at").on(t.createdAt),
    idxRadarDedupe: uniqueIndex("idx_radar_dedupe").on(
      t.normalizedCompanyName,
      t.normalizedCity,
      t.signalType,
      t.signalWindowBucket,
    ),
  }),
);

export const insertOfficeMoveRadarSchema = createInsertSchema(officeMoveRadar).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOfficeMoveRadar = z.infer<typeof insertOfficeMoveRadarSchema>;
export type OfficeMoveRadar = typeof officeMoveRadar.$inferSelect;

// Backward-compatible alias so old imports do not explode immediately.
export const officeMovRadar = officeMoveRadar;
export const insertOfficeMovRadarSchema = insertOfficeMoveRadarSchema;
export type InsertOfficeMovRadar = InsertOfficeMoveRadar;
export type OfficeMovRadar = OfficeMoveRadar;

export const relocationSignals = pgTable("relocation_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  industry: text("industry"),
  city: text("city").notNull(),
  state: text("state"),
  signalType: text("signal_type").notNull(),
  signalSource: text("signal_source"),
  signalDetail: text("signal_detail"),
  sourceUrl: text("source_url"),
  jobPostingsCount: integer("job_postings_count"),
  estimatedHeadcount: integer("estimated_headcount"),
  headcountGrowthPct: integer("headcount_growth_pct"),
  leaseExpiryDate: text("lease_expiry_date"),
  officeSizeSqm: integer("office_size_sqm"),
  relocationProbability: integer("relocation_probability").notNull().default(0),
  probabilityTier: text("probability_tier").notNull().default("low"),
  estimatedProjectValue: integer("estimated_project_value"),
  estimatedTimeline: text("estimated_timeline"),
  recommendedAction: text("recommended_action"),
  linkedRadarId: varchar("linked_radar_id"),
  linkedProspectId: varchar("linked_prospect_id"),
  linkedOpportunityId: varchar("linked_opportunity_id"),
  pushedToPipeline: boolean("pushed_to_pipeline").default(false),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const insertRelocationSignalSchema = createInsertSchema(relocationSignals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRelocationSignal = z.infer<typeof insertRelocationSignalSchema>;
export type RelocationSignal = typeof relocationSignals.$inferSelect;

/* ============================================================================
   COMPANY INTELLIGENCE / CONTACTS / GRAPH
   ========================================================================== */

export const companyIntelligence = pgTable("company_intelligence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  domain: text("domain"),
  country: text("country").notNull().default("Australia"),
  city: text("city").notNull(),
  state: text("state"),
  industry: text("industry"),
  employeeEstimate: integer("employee_estimate"),
  estimatedOfficeSizeSqm: integer("estimated_office_size_sqm"),
  estimatedProjectValue: integer("estimated_project_value"),
  growthRateEstimate: integer("growth_rate_estimate"),
  radarSignalCount: integer("radar_signal_count").notNull().default(0),
  visitorSessions: integer("visitor_sessions").notNull().default(0),
  engagementScore: integer("engagement_score").notNull().default(0),
  moveProbability: integer("move_probability").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  priorityLevel: text("priority_level").notNull().default("low"),
  signalTypesJson: jsonb("signal_types_json").$type<string[] | null>().default(null),
  signalTimelineJson: jsonb("signal_timeline_json")
    .$type<Record<string, unknown>[] | null>()
    .default(null),
  latestSignalDate: timestamp("latest_signal_date"),
  reasoningSummary: text("reasoning_summary"),
  notes: text("notes"),
  linkedRadarIds: jsonb("linked_radar_ids").$type<string[] | null>().default(null),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const insertCompanyIntelligenceSchema = createInsertSchema(companyIntelligence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanyIntelligence = z.infer<typeof insertCompanyIntelligenceSchema>;
export type CompanyIntelligence = typeof companyIntelligence.$inferSelect;

export const companyContacts = pgTable(
  "company_contacts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyIntelligenceId: varchar("company_intelligence_id").notNull(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: text("role").notNull(),
    department: text("department"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    confidenceScore: integer("confidence_score").notNull().default(50),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    isPrimary: boolean("is_primary").notNull().default(false),
    contactSource: text("contact_source").notNull().default("inferred"),
    contactType: text("contact_type").notNull().default("direct"),
    isBlocked: boolean("is_blocked").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    idxContactCompany: index("idx_contact_company_intel").on(t.companyIntelligenceId),
    idxContactEmail: index("idx_contact_email").on(t.email),
    idxContactVerification: index("idx_contact_verification").on(t.verificationStatus),
  }),
);

export const insertCompanyContactSchema = createInsertSchema(companyContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanyContact = z.infer<typeof insertCompanyContactSchema>;
export type CompanyContact = typeof companyContacts.$inferSelect;

export const companyBuildingEdges = pgTable(
  "company_building_edges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyName: text("company_name").notNull(),
    normalizedCompanyName: text("normalized_company_name").notNull(),
    buildingName: text("building_name"),
    buildingAddress: text("building_address"),
    suburb: text("suburb"),
    city: text("city").notNull(),
    state: text("state"),
    relationshipType: text("relationship_type").notNull(),
    confidenceScore: real("confidence_score").notNull().default(50),
    evidenceSource: text("evidence_source"),
    detectedAt: timestamp("detected_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxEdgeCompany: index("idx_edge_company").on(t.normalizedCompanyName),
    idxEdgeCity: index("idx_edge_city").on(t.city),
  }),
);

export const insertCompanyBuildingEdgeSchema = createInsertSchema(companyBuildingEdges).omit({
  id: true,
  createdAt: true,
});
export type InsertCompanyBuildingEdge = z.infer<typeof insertCompanyBuildingEdgeSchema>;
export type CompanyBuildingEdge = typeof companyBuildingEdges.$inferSelect;

export const companyZoneScores = pgTable(
  "company_zone_scores",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyName: text("company_name").notNull(),
    normalizedCompanyName: text("normalized_company_name").notNull(),
    suburb: text("suburb").notNull(),
    city: text("city").notNull(),
    state: text("state"),
    zoneScore: real("zone_score").notNull().default(0),
    demandSignals: integer("demand_signals").notNull().default(0),
    competitorPresence: integer("competitor_presence").notNull().default(0),
    amenityScore: real("amenity_score").notNull().default(0),
    transitScore: real("transit_score").notNull().default(0),
    computedAt: timestamp("computed_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxZoneCompany: index("idx_zone_company").on(t.normalizedCompanyName),
    idxZoneSuburb: index("idx_zone_suburb").on(t.suburb, t.city),
  }),
);

export const insertCompanyZoneScoreSchema = createInsertSchema(companyZoneScores).omit({
  id: true,
  createdAt: true,
});
export type InsertCompanyZoneScore = z.infer<typeof insertCompanyZoneScoreSchema>;
export type CompanyZoneScore = typeof companyZoneScores.$inferSelect;

export const buildingRiskSnapshots = pgTable(
  "building_risk_snapshots",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    buildingName: text("building_name").notNull(),
    buildingAddress: text("building_address"),
    suburb: text("suburb"),
    city: text("city").notNull(),
    state: text("state"),
    lat: real("lat"),
    lng: real("lng"),
    vacancyRiskScore: real("vacancy_risk_score").notNull().default(0),
    tenantTurnoverRate: real("tenant_turnover_rate").notNull().default(0),
    activeSignalCount: integer("active_signal_count").notNull().default(0),
    tenantCount: integer("tenant_count").notNull().default(0),
    riskTier: text("risk_tier").notNull().default("low"),
    snapshotDate: text("snapshot_date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxBuildingRiskCity: index("idx_building_risk_city").on(t.city),
    idxBuildingRiskDate: index("idx_building_risk_date").on(t.snapshotDate),
    idxBuildingRiskTier: index("idx_building_risk_tier").on(t.riskTier),
  }),
);

export const insertBuildingRiskSnapshotSchema = createInsertSchema(buildingRiskSnapshots).omit({
  id: true,
  createdAt: true,
});
export type InsertBuildingRiskSnapshot = z.infer<typeof insertBuildingRiskSnapshotSchema>;
export type BuildingRiskSnapshot = typeof buildingRiskSnapshots.$inferSelect;

export const suburbDemandSnapshots = pgTable(
  "suburb_demand_snapshots",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    suburb: text("suburb").notNull(),
    city: text("city").notNull(),
    state: text("state"),
    lat: real("lat"),
    lng: real("lng"),
    demandScore: real("demand_score").notNull().default(0),
    activeCompanies: integer("active_companies").notNull().default(0),
    recentSignals: integer("recent_signals").notNull().default(0),
    relocationInflow: integer("relocation_inflow").notNull().default(0),
    relocationOutflow: integer("relocation_outflow").notNull().default(0),
    averageProjectValue: real("average_project_value").notNull().default(0),
    demandTier: text("demand_tier").notNull().default("low"),
    snapshotDate: text("snapshot_date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxSuburbDemandCity: index("idx_suburb_demand_city").on(t.city),
    idxSuburbDemandDate: index("idx_suburb_demand_date").on(t.snapshotDate),
    idxSuburbDemandTier: index("idx_suburb_demand_tier").on(t.demandTier),
  }),
);

export const insertSuburbDemandSnapshotSchema = createInsertSchema(suburbDemandSnapshots).omit({
  id: true,
  createdAt: true,
});
export type InsertSuburbDemandSnapshot = z.infer<typeof insertSuburbDemandSnapshotSchema>;
export type SuburbDemandSnapshot = typeof suburbDemandSnapshots.$inferSelect;

/* ============================================================================
   LEASE EXPIRY / HIERARCHY / GRAPH
   ========================================================================== */

export const leaseRecords = pgTable(
  "lease_records",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyName: text("company_name").notNull(),
    companyIntelligenceId: varchar("company_intelligence_id"),
    buildingName: text("building_name"),
    buildingAddress: text("building_address"),
    suburb: text("suburb"),
    city: text("city").notNull(),
    state: text("state"),
    leaseStartDate: text("lease_start_date"),
    leaseExpiryDate: text("lease_expiry_date"),
    leaseTermYears: integer("lease_term_years"),
    estimatedSqm: integer("estimated_sqm"),
    estimatedHeadcount: integer("estimated_headcount"),
    leaseStatus: text("lease_status").notNull().default("active"),
    dataSource: text("data_source").notNull().default("inferred"),
    confidenceScore: integer("confidence_score").notNull().default(50),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    idxLeaseCompany: index("idx_lease_company_name").on(t.companyName),
    idxLeaseCity: index("idx_lease_city").on(t.city),
    idxLeaseExpiry: index("idx_lease_expiry_date").on(t.leaseExpiryDate),
    idxLeaseStatus: index("idx_lease_status").on(t.leaseStatus),
  }),
);

export const insertLeaseRecordSchema = createInsertSchema(leaseRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLeaseRecord = z.infer<typeof insertLeaseRecordSchema>;
export type LeaseRecord = typeof leaseRecords.$inferSelect;

export const leaseExpiryPredictions = pgTable(
  "lease_expiry_predictions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    leaseRecordId: varchar("lease_record_id"),
    companyName: text("company_name").notNull(),
    city: text("city").notNull(),
    predictedExpiryYear: integer("predicted_expiry_year"),
    predictedExpiryQuarter: text("predicted_expiry_quarter"),
    relocationProbability: integer("relocation_probability").notNull().default(50),
    opportunityScore: integer("opportunity_score").notNull().default(50),
    urgencyTier: text("urgency_tier").notNull().default("medium"),
    estimatedProjectValue: integer("estimated_project_value"),
    signalCount: integer("signal_count").notNull().default(0),
    reasoningSummary: text("reasoning_summary"),
    linkedRadarId: varchar("linked_radar_id"),
    linkedOpportunityId: varchar("linked_opportunity_id"),
    status: text("status").notNull().default("open"),
    ...timestamps,
  },
  (t) => ({
    idxLeaseExpiryCompany: index("idx_lease_expiry_company").on(t.companyName),
    idxLeaseExpiryCity: index("idx_lease_expiry_city").on(t.city),
    idxLeaseExpiryUrgency: index("idx_lease_expiry_urgency").on(t.urgencyTier),
  }),
);

export const insertLeaseExpiryPredictionSchema = createInsertSchema(leaseExpiryPredictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLeaseExpiryPrediction = z.infer<typeof insertLeaseExpiryPredictionSchema>;
export type LeaseExpiryPrediction = typeof leaseExpiryPredictions.$inferSelect;

export const companyHierarchyNodes = pgTable(
  "company_hierarchy_nodes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyName: text("company_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    companyIntelligenceId: varchar("company_intelligence_id"),
    parentId: varchar("parent_id"),
    nodeType: text("node_type").notNull().default("standalone"),
    industry: text("industry"),
    city: text("city"),
    state: text("state"),
    country: text("country").notNull().default("Australia"),
    employeeEstimate: integer("employee_estimate"),
    aggregatedSignalCount: integer("aggregated_signal_count").notNull().default(0),
    aggregatedConfidenceScore: integer("aggregated_confidence_score").notNull().default(0),
    aggregatedOpportunityValue: integer("aggregated_opportunity_value").notNull().default(0),
    dataSource: text("data_source").notNull().default("inferred"),
    ...timestamps,
  },
  (t) => ({
    idxHierarchyNormalized: uniqueIndex("idx_hierarchy_normalized_name").on(t.normalizedName),
    idxHierarchyParent: index("idx_hierarchy_parent_id").on(t.parentId),
    idxHierarchyType: index("idx_hierarchy_node_type").on(t.nodeType),
  }),
);

export const insertCompanyHierarchyNodeSchema = createInsertSchema(companyHierarchyNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanyHierarchyNode = z.infer<typeof insertCompanyHierarchyNodeSchema>;
export type CompanyHierarchyNode = typeof companyHierarchyNodes.$inferSelect;

export const companyRelationships = pgTable(
  "company_relationships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fromEntityType: text("from_entity_type").notNull(),
    fromEntityId: varchar("from_entity_id").notNull(),
    fromEntityName: text("from_entity_name").notNull(),
    toEntityType: text("to_entity_type").notNull(),
    toEntityId: varchar("to_entity_id").notNull(),
    toEntityName: text("to_entity_name").notNull(),
    relationshipType: text("relationship_type").notNull(),
    strength: integer("strength").notNull().default(50),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxRelFrom: index("idx_rel_from_entity").on(t.fromEntityId),
    idxRelTo: index("idx_rel_to_entity").on(t.toEntityId),
    idxRelType: index("idx_rel_type").on(t.relationshipType),
  }),
);

export const insertCompanyRelationshipSchema = createInsertSchema(companyRelationships).omit({
  id: true,
  createdAt: true,
});
export type InsertCompanyRelationship = z.infer<typeof insertCompanyRelationshipSchema>;
export type CompanyRelationship = typeof companyRelationships.$inferSelect;

export const intelligenceGraphEdges = pgTable(
  "intelligence_graph_edges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sourceType: text("source_type").notNull(),
    sourceId: varchar("source_id").notNull(),
    sourceName: text("source_name").notNull(),
    targetType: text("target_type").notNull(),
    targetId: varchar("target_id").notNull(),
    targetName: text("target_name").notNull(),
    edgeType: text("edge_type").notNull(),
    weight: real("weight").notNull().default(1.0),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>().default(null),
    ...timestamps,
  },
  (t) => ({
    idxGraphSource: index("idx_graph_source").on(t.sourceId, t.sourceType),
    idxGraphTarget: index("idx_graph_target").on(t.targetId, t.targetType),
    idxGraphEdgeType: index("idx_graph_edge_type").on(t.edgeType),
  }),
);

export const insertIntelligenceGraphEdgeSchema = createInsertSchema(intelligenceGraphEdges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntelligenceGraphEdge = z.infer<typeof insertIntelligenceGraphEdgeSchema>;
export type IntelligenceGraphEdge = typeof intelligenceGraphEdges.$inferSelect;

/* ============================================================================
   VISITOR / SITE INTELLIGENCE
   ========================================================================== */

export const siteVisits = pgTable("site_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"),
  pagePath: text("page_path").notNull(),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  ipHash: varchar("ip_hash"),
  userAgentHash: varchar("user_agent_hash"),
  isBot: boolean("is_bot").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSiteVisitSchema = createInsertSchema(siteVisits).omit({
  id: true,
  createdAt: true,
});
export type InsertSiteVisit = z.infer<typeof insertSiteVisitSchema>;
export type SiteVisit = typeof siteVisits.$inferSelect;

export const visitorSessions = pgTable("visitor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: text("visitor_id").notNull(),
  ipAddress: text("ip_address"),
  country: text("country"),
  city: text("city"),
  region: text("region"),
  companyName: text("company_name"),
  companyDomain: text("company_domain"),
  isp: text("isp"),
  industry: text("industry"),
  deviceType: text("device_type"),
  browser: text("browser"),
  pagesViewed: text("pages_viewed").array().notNull().default(sql`'{}'`),
  sessionDurationSeconds: integer("session_duration_seconds").default(0),
  engagementScore: integer("engagement_score").notNull().default(0),
  intent: text("intent"),
  estimatedProjectValue: integer("estimated_project_value"),
  confidenceScore: integer("confidence_score").default(0),
  pushedToPipeline: boolean("pushed_to_pipeline").default(false),
  isBot: boolean("is_bot").default(false),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  ...timestamps,
});

export const insertVisitorSessionSchema = createInsertSchema(visitorSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVisitorSession = z.infer<typeof insertVisitorSessionSchema>;
export type VisitorSession = typeof visitorSessions.$inferSelect;

/* ============================================================================
   PLANNING / WORKSPACE STRATEGY / LEARNING
   ========================================================================== */

export const planningRequests = pgTable("planning_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city"),
  projectType: text("project_type"),
  squareMetres: integer("square_metres"),
  staffCount: integer("staff_count"),
  meetingRooms: integer("meeting_rooms"),
  receptionRequired: boolean("reception_required").default(false),
  breakoutRequired: boolean("breakout_required").default(false),
  executiveOfficeRequired: boolean("executive_office_required").default(false),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  stylePreference: text("style_preference"),
  specialRequirements: text("special_requirements"),
  uploadedFilesJson: jsonb("uploaded_files_json").$type<string[]>().default([]),
  aiSummary: text("ai_summary"),
  aiRecommendations: text("ai_recommendations"),
  leadScore: integer("lead_score"),
  estimatedValue: integer("estimated_value"),
  implementationTimeline: text("implementation_timeline"),
  status: text("status").notNull().default("New"),
  source: text("source").default("upload-floor-plan"),
  adminNotes: text("admin_notes"),
  isPaid: boolean("is_paid").default(false),
  stripeSessionId: text("stripe_session_id"),
  paymentStatus: text("payment_status").default("unpaid"),
  paymentTier: text("payment_tier"),
  packageJson: jsonb("package_json").$type<Record<string, unknown> | null>().default(null),
  quoteJson: jsonb("quote_json").$type<Record<string, unknown> | null>().default(null),
  quoteStatus: text("quote_status").default("draft"),
  floorGeometryJson: jsonb("floor_geometry_json")
    .$type<Record<string, unknown> | null>()
    .default(null),
  geometrySource: text("geometry_source"),
  ...timestamps,
});

export type PlanningRequest = typeof planningRequests.$inferSelect;
export type InsertPlanningRequest = typeof planningRequests.$inferInsert;

export const workspaceLearningRecords = pgTable("workspace_learning_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planningRequestId: text("planning_request_id"),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  city: text("city"),
  projectType: text("project_type"),
  officeSqm: integer("office_sqm"),
  staffCount: integer("staff_count"),
  meetingRoomCount: integer("meeting_room_count"),
  receptionIncluded: boolean("reception_included").default(false),
  breakoutIncluded: boolean("breakout_included").default(false),
  executiveOfficeIncluded: boolean("executive_office_included").default(false),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  stylePreference: text("style_preference"),
  officeType: text("office_type"),
  packageTier: text("package_tier"),
  estimatedCost: integer("estimated_cost"),
  leadScore: integer("lead_score"),
  workspaceZonesJson: jsonb("workspace_zones_json").$type<Record<string, unknown>[] | null>().default(null),
  productRecsJson: jsonb("product_recs_json").$type<Record<string, unknown>[] | null>().default(null),
  supplierMix: text("supplier_mix"),
  keyInsight: text("key_insight"),
  conversionResult: text("conversion_result").default("pending"),
  geometrySource: text("geometry_source"),
  geometryConfidence: text("geometry_confidence"),
  designEngineUsed: boolean("design_engine_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkspaceLearningSchema = createInsertSchema(workspaceLearningRecords).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkspaceLearning = z.infer<typeof insertWorkspaceLearningSchema>;
export type WorkspaceLearning = typeof workspaceLearningRecords.$inferSelect;

export const workspaceStrategyRecommendations = pgTable("workspace_strategy_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planningRequestId: varchar("planning_request_id"),
  officeSqm: integer("office_sqm"),
  staffCount: integer("staff_count"),
  projectType: text("project_type"),
  industryContext: text("industry_context"),
  recommendedLayoutType: text("recommended_layout_type"),
  recommendedDeskDensity: text("recommended_desk_density"),
  recommendedZonesJson: jsonb("recommended_zones_json").$type<Record<string, unknown>[] | null>().default(null),
  recommendedPackageTier: text("recommended_package_tier"),
  recommendedFurnitureJson: jsonb("recommended_furniture_json")
    .$type<Record<string, unknown>[] | null>()
    .default(null),
  predictedProjectValue: integer("predicted_project_value"),
  predictedGrossProfit: integer("predicted_gross_profit"),
  predictedMarginPct: integer("predicted_margin_pct"),
  supplierMixJson: jsonb("supplier_mix_json").$type<Record<string, unknown> | null>().default(null),
  workspaceConcept: text("workspace_concept"),
  budgetEstimateLow: integer("budget_estimate_low"),
  budgetEstimateHigh: integer("budget_estimate_high"),
  proposalSummary: text("proposal_summary"),
  keyInsights: text("key_insights").array(),
  confidenceScore: integer("confidence_score").default(50),
  dataSourcesUsed: integer("data_sources_used").default(0),
  outcomeTracked: boolean("outcome_tracked").default(false),
  actualProjectValue: integer("actual_project_value"),
  ...timestamps,
});

export const insertWorkspaceStrategySchema = createInsertSchema(workspaceStrategyRecommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkspaceStrategy = z.infer<typeof insertWorkspaceStrategySchema>;
export type WorkspaceStrategyRecommendation = typeof workspaceStrategyRecommendations.$inferSelect;

/* ============================================================================
   PRODUCT REVIEWS / MANUFACTURER / SUPPLIERS
   ========================================================================== */

export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productSku: text("product_sku").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  reviewerCompany: text("reviewer_company"),
  reviewerRole: text("reviewer_role"),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductReviewSchema = createInsertSchema(productReviews).omit({
  id: true,
  status: true,
  adminNote: true,
  createdAt: true,
});

export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = typeof productReviews.$inferSelect;

export const manufacturerMessages = pgTable("manufacturer_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manufacturerId: text("manufacturer_id").notNull(),
  manufacturerName: text("manufacturer_name").notNull(),
  contactName: text("contact_name"),
  whatsappNumber: text("whatsapp_number"),
  messageType: text("message_type").notNull().default("text"),
  messageContent: text("message_content").notNull(),
  relatedSku: text("related_sku"),
  relatedProject: text("related_project"),
  requestType: text("request_type"),
  status: text("status").notNull().default("sent"),
  wapiMessageId: text("wapi_message_id"),
  adminUser: text("admin_user"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertManufacturerMessageSchema = createInsertSchema(manufacturerMessages).omit({
  id: true,
  sentAt: true,
});

export type InsertManufacturerMessage = z.infer<typeof insertManufacturerMessageSchema>;
export type ManufacturerMessage = typeof manufacturerMessages.$inferSelect;

export const supplierProfiles = pgTable("supplier_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: text("supplier_id").notNull().unique(),
  supplierName: text("supplier_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  country: text("country"),
  specializations: jsonb("specializations").$type<string[] | null>().default(null),
  pricingScore: integer("pricing_score").default(3),
  deliveryScore: integer("delivery_score").default(3),
  reliabilityScore: integer("reliability_score").default(3),
  qualityScore: integer("quality_score").default(3),
  installationScore: integer("installation_score").default(3),
  responsivenessScore: integer("responsiveness_score").default(3),
  overallScore: integer("overall_score"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  ...timestamps,
});

export const insertSupplierProfileSchema = createInsertSchema(supplierProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupplierProfile = z.infer<typeof insertSupplierProfileSchema>;
export type SupplierProfile = typeof supplierProfiles.$inferSelect;

/* ============================================================================
   FOLLOW-UP / SCHEDULED JOBS / REPORTS
   ========================================================================== */

export const followUpSequences = pgTable("follow_up_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  leadName: text("lead_name").notNull(),
  leadEmail: text("lead_email").notNull(),
  leadCompany: text("lead_company").notNull(),
  leadType: text("lead_type").notNull(),
  officeSizeSqm: integer("office_size_sqm"),
  staffCount: integer("staff_count"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  stage: integer("stage").notNull().default(0),
  status: text("status").notNull().default("active"),
  nextSendAt: timestamp("next_send_at"),
  lastSentAt: timestamp("last_sent_at"),
  stagesCompleted: text("stages_completed").array().notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFollowUpSequenceSchema = createInsertSchema(followUpSequences).omit({
  id: true,
  createdAt: true,
});
export type InsertFollowUpSequence = z.infer<typeof insertFollowUpSequenceSchema>;
export type FollowUpSequence = typeof followUpSequences.$inferSelect;

export const scheduledJobs = pgTable("scheduled_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("pending"),
  triggeredBy: text("triggered_by").notNull().default("scheduler"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  result: text("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type ScheduledJob = typeof scheduledJobs.$inferSelect;

export const intelligenceReports = pgTable("intelligence_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportType: text("report_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  period: text("period").notNull(),
  status: text("status").notNull().default("draft"),
  generatedAt: timestamp("generated_at").defaultNow(),
});
export type IntelligenceReport = typeof intelligenceReports.$inferSelect;

export const spendingTrends = pgTable("spending_trends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  trend: text("trend").notNull(),
  insight: text("insight").notNull(),
  confidenceLevel: text("confidence_level").notNull().default("medium"),
  sourceNotes: text("source_notes"),
  periodWeek: text("period_week").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type SpendingTrend = typeof spendingTrends.$inferSelect;

export const websiteIssues = pgTable("website_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  issueType: text("issue_type").notNull(),
  severity: text("severity").notNull().default("warning"),
  description: text("description").notNull(),
  affectedUrl: text("affected_url"),
  affectedItem: text("affected_item"),
  suggestion: text("suggestion"),
  status: text("status").notNull().default("open"),
  detectedAt: timestamp("detected_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});
export type WebsiteIssue = typeof websiteIssues.$inferSelect;

/* ============================================================================
   PROFIT / DEAL INTELLIGENCE / BLOG
   ========================================================================== */

export const profitRecords = pgTable("profit_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planningRequestId: text("planning_request_id"),
  officeSizeSqm: integer("office_size_sqm"),
  staffCount: integer("staff_count"),
  industryType: text("industry_type"),
  layoutType: text("layout_type"),
  packageName: text("package_name"),
  packageTier: text("package_tier"),
  productMixSummary: text("product_mix_summary"),
  supplierMixSummary: text("supplier_mix_summary"),
  estimatedFactoryCost: integer("estimated_factory_cost"),
  estimatedShippingCost: integer("estimated_shipping_cost"),
  estimatedInstallationCost: integer("estimated_installation_cost"),
  estimatedLandedCost: integer("estimated_landed_cost"),
  quotedPrice: integer("quoted_price"),
  estimatedProfit: integer("estimated_profit"),
  estimatedMarginPercent: integer("estimated_margin_percent"),
  confidenceLevel: text("confidence_level").default("medium"),
  financeUsed: boolean("finance_used").default(false),
  conversionResult: text("conversion_result").default("pending"),
  ...timestamps,
});
export const insertProfitRecordSchema = createInsertSchema(profitRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfitRecord = z.infer<typeof insertProfitRecordSchema>;
export type ProfitRecord = typeof profitRecords.$inferSelect;

export const dealIntelligenceRecords = pgTable("deal_intelligence_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(),
  relatedLeadId: text("related_lead_id"),
  relatedPlanningRequestId: text("related_planning_request_id"),
  relatedQuoteId: text("related_quote_id"),
  relatedProspectId: text("related_prospect_id"),
  relatedRadarId: text("related_radar_id"),
  relatedOpportunityId: varchar("related_opportunity_id"),
  companyName: text("company_name").notNull(),
  city: text("city"),
  industry: text("industry"),
  officeSizeSqm: integer("office_size_sqm"),
  staffCount: integer("staff_count"),
  budgetBand: text("budget_band"),
  pipelineStage: text("pipeline_stage"),
  estimatedProjectValue: integer("estimated_project_value"),
  estimatedGrossProfit: integer("estimated_gross_profit"),
  estimatedMarginPct: integer("estimated_margin_pct"),
  winProbability: integer("win_probability").notNull().default(0),
  probabilityTier: text("probability_tier").notNull().default("low"),
  confidenceLevel: text("confidence_level").notNull().default("low"),
  dealStrength: integer("deal_strength").notNull().default(0),
  weightedExpectedRevenue: integer("weighted_expected_revenue"),
  weightedExpectedProfit: integer("weighted_expected_profit"),
  recommendedNextAction: text("recommended_next_action"),
  recommendedFollowUpTiming: text("recommended_follow_up_timing"),
  recommendedOffer: text("recommended_offer"),
  reasoningSummary: text("reasoning_summary"),
  scoringSignalsJson: jsonb("scoring_signals_json")
    .$type<Record<string, unknown>[] | null>()
    .default(null),
  quoteStatus: text("quote_status"),
  financeInterest: boolean("finance_interest").default(false),
  hasRadarSignal: boolean("has_radar_signal").default(false),
  hasPlanningRequest: boolean("has_planning_request").default(false),
  hasQuote: boolean("has_quote").default(false),
  outcomeResult: text("outcome_result").default("pending"),
  ...timestamps,
});

export const insertDealIntelligenceSchema = createInsertSchema(dealIntelligenceRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDealIntelligence = z.infer<typeof insertDealIntelligenceSchema>;
export type DealIntelligenceRecord = typeof dealIntelligenceRecords.$inferSelect;

export const generatedBlogArticles = pgTable("generated_blog_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  metaDescription: text("meta_description"),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags").array(),
  internalLinkingSuggestions: text("internal_linking_suggestions"),
  imagePrompts: text("image_prompts").array(),
  status: text("status").notNull().default("draft"),
  qualityScore: integer("quality_score"),
  generatedAt: timestamp("generated_at").defaultNow(),
  publishedAt: timestamp("published_at"),
});
export type GeneratedBlogArticle = typeof generatedBlogArticles.$inferSelect;

/* ============================================================================
   PARTNERS / REFERRALS / COMMISSIONS / REVENUE SHARE
   ========================================================================== */

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerName: text("referrer_name").notNull(),
  company: text("company"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  leadSource: text("lead_source").notNull(),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  estimatedValue: integer("estimated_value"),
  notes: text("notes"),
  status: text("status").notNull().default("New"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  partnerType: text("partner_type").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  website: text("website"),
  abn: text("abn"),
  linkedinUrl: text("linkedin_url"),
  city: text("city"),
  state: text("state"),
  serviceRegions: text("service_regions").array(),
  industrySpecialties: text("industry_specialties").array(),
  servicesOffered: text("services_offered").array(),
  companySize: text("company_size"),
  portfolioExamples: text("portfolio_examples"),
  bio: text("bio"),
  activeStatus: text("active_status").notNull().default("pending"),
  onboardingStatus: text("onboarding_status").notNull().default("lead"),
  agreementStatus: text("agreement_status").notNull().default("pending"),
  agreementToken: varchar("agreement_token"),
  agreementSentAt: timestamp("agreement_sent_at"),
  agreementSignedAt: timestamp("agreement_signed_at"),
  agreementSignedByName: text("agreement_signed_by_name"),
  agreementSignedByIp: text("agreement_signed_by_ip"),
  referralRate: real("referral_rate").default(0.075),
  rating: integer("rating").default(0),
  totalOpportunitiesReceived: integer("total_opportunities_received").default(0),
  totalProjectsWon: integer("total_projects_won").default(0),
  totalRevenueGenerated: integer("total_revenue_generated").default(0),
  partnerScore: integer("partner_score").default(0),
  partnerTier: text("partner_tier").default("tier1"),
  referralCount: integer("referral_count").default(0),
  conversionRate: real("conversion_rate").default(0),
  lastReferralAt: timestamp("last_referral_at"),
  lastActivityAt: timestamp("last_activity_at"),
  adminNotes: text("admin_notes"),
  approvedAt: timestamp("approved_at"),
  ...timestamps,
});

export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  totalOpportunitiesReceived: true,
  totalProjectsWon: true,
  totalRevenueGenerated: true,
  agreementToken: true,
  agreementSentAt: true,
  agreementSignedAt: true,
  agreementSignedByName: true,
  agreementSignedByIp: true,
});
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partners.$inferSelect;

export const partnerOpportunities = pgTable("partner_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  opportunityTitle: text("opportunity_title").notNull(),
  opportunityId: varchar("opportunity_id"),
  companyName: text("company_name"),
  city: text("city"),
  industry: text("industry"),
  projectType: text("project_type"),
  officeSizeSqm: integer("office_size_sqm"),
  staffCount: integer("staff_count"),
  estimatedProjectValue: integer("estimated_project_value"),
  relocationScore: integer("relocation_score"),
  sourceType: text("source_type"),
  sourceId: varchar("source_id"),
  routingReason: text("routing_reason"),
  status: text("status").notNull().default("invited"),
  role: text("role").default("referral"),
  commissionRate: real("commission_rate").default(5.0),
  commissionValue: integer("commission_value"),
  dealExecutionId: varchar("deal_execution_id"),
  outreachThreadId: varchar("outreach_thread_id"),
  viewedAt: timestamp("viewed_at"),
  respondedAt: timestamp("responded_at"),
  notes: text("notes"),
  ...timestamps,
});
export const insertPartnerOpportunitySchema = createInsertSchema(partnerOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerOpportunity = z.infer<typeof insertPartnerOpportunitySchema>;
export type PartnerOpportunity = typeof partnerOpportunities.$inferSelect;

export const partnerReferrals = pgTable("partner_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id"),
  opportunityId: varchar("opportunity_id"),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  officeLocation: text("office_location"),
  officeSizeSqm: integer("office_size_sqm"),
  staffCount: integer("staff_count"),
  projectType: text("project_type"),
  projectStage: text("project_stage"),
  estimatedValue: integer("estimated_value"),
  sourceNotes: text("source_notes"),
  uploadedFilesJson: jsonb("uploaded_files_json").$type<string[]>().default([]),
  aiSummary: text("ai_summary"),
  aiFitScore: integer("ai_fit_score"),
  aiUrgencyScore: integer("ai_urgency_score"),
  aiCloseLikelihoodScore: integer("ai_close_likelihood_score"),
  aiPriority: text("ai_priority"),
  aiRecommendedOwner: text("ai_recommended_owner"),
  aiNextBestAction: text("ai_next_best_action"),
  aiTagsJson: jsonb("ai_tags_json").$type<string[]>().default([]),
  aiRiskFlagsJson: jsonb("ai_risk_flags_json").$type<string[]>().default([]),
  projectValue: integer("project_value"),
  referralFee: integer("referral_fee"),
  commissionPercent: real("commission_percent").default(7.5),
  status: text("status").notNull().default("submitted"),
  assignedTo: text("assigned_to"),
  quoteId: varchar("quote_id"),
  crmLeadId: varchar("crm_lead_id"),
  conversionResult: text("conversion_result"),
  notes: text("notes"),
  ...timestamps,
});
export const insertPartnerReferralSchema = createInsertSchema(partnerReferrals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerReferral = z.infer<typeof insertPartnerReferralSchema>;
export type PartnerReferral = typeof partnerReferrals.$inferSelect;

export const partnerReferralEvents = pgTable("partner_referral_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull(),
  eventType: text("event_type").notNull(),
  eventNote: text("event_note"),
  metadataJson: jsonb("metadata_json"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPartnerReferralEventSchema = createInsertSchema(partnerReferralEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertPartnerReferralEvent = z.infer<typeof insertPartnerReferralEventSchema>;
export type PartnerReferralEvent = typeof partnerReferralEvents.$inferSelect;

export const partnerCommissions = pgTable("partner_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull(),
  partnerId: varchar("partner_id").notNull(),
  commissionRate: real("commission_rate").notNull().default(0.075),
  dealValue: integer("deal_value").notNull(),
  commissionAmount: integer("commission_amount").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentDueAt: timestamp("payment_due_at"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  ...timestamps,
});
export const insertPartnerCommissionSchema = createInsertSchema(partnerCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerCommission = z.infer<typeof insertPartnerCommissionSchema>;
export type PartnerCommission = typeof partnerCommissions.$inferSelect;

export const partnerDocuments = pgTable("partner_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  documentType: text("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});
export const insertPartnerDocumentSchema = createInsertSchema(partnerDocuments).omit({
  id: true,
  uploadedAt: true,
});
export type InsertPartnerDocument = z.infer<typeof insertPartnerDocumentSchema>;
export type PartnerDocument = typeof partnerDocuments.$inferSelect;

export const partnerSettings = pgTable("partner_settings", {
  id: serial("id").primaryKey(),
  defaultReferralRate: real("default_referral_rate").notNull().default(0.075),
  payoutRuleText: text("payout_rule_text")
    .notNull()
    .default("Commission is paid within 30 days of verified client payment, at 7.5% of the approved deal value."),
  agreementTemplateVersion: text("agreement_template_version").notNull().default("v1"),
  ...timestamps,
});

export const partnerAgreements = pgTable("partner_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  templateVersion: text("template_version").notNull().default("v1"),
  agreementText: text("agreement_text").notNull(),
  signedByName: text("signed_by_name").notNull(),
  signedAt: timestamp("signed_at").notNull(),
  signedByIp: text("signed_by_ip"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPartnerAgreementSchema = createInsertSchema(partnerAgreements).omit({
  id: true,
  createdAt: true,
});
export type InsertPartnerAgreement = z.infer<typeof insertPartnerAgreementSchema>;
export type PartnerAgreement = typeof partnerAgreements.$inferSelect;

export const revenueShareRecords = pgTable("revenue_share_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  opportunityId: varchar("opportunity_id"),
  projectValue: integer("project_value").notNull(),
  platformFee: integer("platform_fee"),
  partnerFee: integer("partner_fee"),
  referralSource: text("referral_source"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertRevenueShareSchema = createInsertSchema(revenueShareRecords).omit({
  id: true,
  createdAt: true,
});
export type InsertRevenueShare = z.infer<typeof insertRevenueShareSchema>;
export type RevenueShareRecord = typeof revenueShareRecords.$inferSelect;

export const commissions = pgTable("commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  opportunityId: varchar("opportunity_id"),
  quoteId: varchar("quote_id"),
  referralId: varchar("referral_id"),
  dealValue: integer("deal_value").notNull(),
  commissionPercent: real("commission_percent").notNull().default(5.0),
  commissionAmount: integer("commission_amount").notNull(),
  currency: text("currency").notNull().default("aud"),
  status: text("status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  invoiceRef: text("invoice_ref"),
  notes: text("notes"),
  ...timestamps,
});
export const insertCommissionSchema = createInsertSchema(commissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

/* ============================================================================
   OUTREACH ENGINE
   ========================================================================== */

export const leadMessageTemplates = pgTable("lead_message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().unique(),
  label: text("label").notNull(),
  body: text("body").notNull(),
  ...timestamps,
});
export const insertLeadMessageTemplateSchema = createInsertSchema(leadMessageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type LeadMessageTemplate = typeof leadMessageTemplates.$inferSelect;

export const leadOutreach = pgTable("lead_outreach", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  templateType: text("template_type").notNull(),
  renderedMessage: text("rendered_message").notNull(),
  leadName: text("lead_name"),
  adminApproved: boolean("admin_approved").default(false),
  approvedAt: timestamp("approved_at"),
  createdBy: text("created_by").default("admin"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertLeadOutreachSchema = createInsertSchema(leadOutreach).omit({
  id: true,
  createdAt: true,
});
export type LeadOutreach = typeof leadOutreach.$inferSelect;

export const contactDiscoveryRuns = pgTable(
  "contact_discovery_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyId: varchar("company_id").notNull(),
    companyName: text("company_name").notNull(),
    opportunityId: varchar("opportunity_id"),
    runStatus: text("run_status").notNull().default("pending"),
    contactsFound: integer("contacts_found").notNull().default(0),
    fallbackContactsCreated: integer("fallback_contacts_created").notNull().default(0),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
  },
  (t) => ({
    idxDiscoveryCompany: index("idx_discovery_company_id").on(t.companyId),
    idxDiscoveryStatus: index("idx_discovery_run_status").on(t.runStatus),
  }),
);
export const insertContactDiscoveryRunSchema = createInsertSchema(contactDiscoveryRuns).omit({
  id: true,
  startedAt: true,
});
export type InsertContactDiscoveryRun = z.infer<typeof insertContactDiscoveryRunSchema>;
export type ContactDiscoveryRun = typeof contactDiscoveryRuns.$inferSelect;

export const contactVerificationLogs = pgTable(
  "contact_verification_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    contactId: varchar("contact_id").notNull(),
    checkType: text("check_type").notNull(),
    result: text("result").notNull(),
    detailsJson: jsonb("details_json").$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxVerifContact: index("idx_verif_contact_id").on(t.contactId),
  }),
);
export const insertContactVerificationLogSchema = createInsertSchema(contactVerificationLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertContactVerificationLog = z.infer<typeof insertContactVerificationLogSchema>;
export type ContactVerificationLog = typeof contactVerificationLogs.$inferSelect;

export const outreachThreads = pgTable(
  "outreach_threads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyId: varchar("company_id").notNull(),
    companyName: text("company_name").notNull(),
    contactId: varchar("contact_id"),
    opportunityId: varchar("opportunity_id"),
    status: text("status").notNull().default("pending"),
    channel: text("channel").notNull().default("email"),
    currentStage: integer("current_stage").notNull().default(0),
    outreachAngle: text("outreach_angle"),
    opportunityScore: integer("opportunity_score"),
    relocationProbability: integer("relocation_probability"),
    stopReason: text("stop_reason"),
    bookingLink: text("booking_link"),
    bookingStatus: text("booking_status").notNull().default("not_created"),
    contactReadiness: text("contact_readiness").notNull().default("NEEDS_CONTACT"),
    resolvedEmail: text("resolved_email"),
    resolvedEmailSource: text("resolved_email_source"),
    ...timestamps,
  },
  (t) => ({
    idxThreadCompany: index("idx_thread_company_id").on(t.companyId),
    idxThreadStatus: index("idx_thread_status").on(t.status),
    idxThreadContact: index("idx_thread_contact_id").on(t.contactId),
  }),
);
export const insertOutreachThreadSchema = createInsertSchema(outreachThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutreachThread = z.infer<typeof insertOutreachThreadSchema>;
export type OutreachThread = typeof outreachThreads.$inferSelect;

export const outreachMessages = pgTable(
  "outreach_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    threadId: varchar("thread_id").notNull(),
    direction: text("direction").notNull().default("outbound"),
    channel: text("channel").notNull().default("email"),
    subject: text("subject"),
    body: text("body").notNull(),
    stage: integer("stage").notNull().default(0),
    messageType: text("message_type").notNull().default("intro"),
    deliveryStatus: text("delivery_status").notNull().default("draft"),

    identityHash: text("identity_hash").unique(),
    companyName: text("company_name"),
    campaignKey: text("campaign_key"),
    recipientEmail: text("recipient_email"),
    emailSourceType: text("email_source_type"),
    blockingReason: text("blocking_reason"),
    suppressionReason: text("suppression_reason"),
    resendMessageId: text("resend_message_id"),
    lastError: text("last_error"),

    approvedAt: timestamp("approved_at"),
    lockedAt: timestamp("locked_at"),
    sentAt: timestamp("sent_at"),
    failedAt: timestamp("failed_at"),
    openedAt: timestamp("opened_at"),
    repliedAt: timestamp("replied_at"),

    ...timestamps,
  },
  (t) => ({
    idxMsgThread: index("idx_msg_thread_id").on(t.threadId),
    idxMsgStatus: index("idx_msg_delivery_status").on(t.deliveryStatus),
    idxMsgCompany: index("idx_msg_company_name").on(t.companyName),
    idxMsgIdentity: index("idx_msg_identity_hash").on(t.identityHash),
    idxMsgRecipientCampaign: uniqueIndex("idx_msg_recipient_campaign_unique").on(
      t.recipientEmail,
      t.companyName,
      t.campaignKey,
    ),
  }),
);
export const insertOutreachMessageSchema = createInsertSchema(outreachMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutreachMessage = z.infer<typeof insertOutreachMessageSchema>;
export type OutreachMessage = typeof outreachMessages.$inferSelect;

export const outreachSuppressions = pgTable(
  "outreach_suppressions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    suppressionScope: text("suppression_scope").notNull().default("company"),
    companyName: text("company_name"),
    recipientEmail: text("recipient_email"),
    campaignKey: text("campaign_key"),
    reason: text("reason").notNull(),
    active: integer("active").notNull().default(1),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => ({
    idxSupprCompany: index("idx_suppr_company").on(t.companyName, t.active),
    idxSupprEmail: index("idx_suppr_email").on(t.recipientEmail, t.active),
  }),
);
export const insertOutreachSuppressionSchema = createInsertSchema(outreachSuppressions).omit({
  id: true,
  createdAt: true,
});
export type InsertOutreachSuppression = z.infer<typeof insertOutreachSuppressionSchema>;
export type OutreachSuppression = typeof outreachSuppressions.$inferSelect;

export const outreachJobs = pgTable("outreach_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobKey: text("job_key").notNull().unique(),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("idle"),
  lockedBy: text("locked_by"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastRunAt: timestamp("last_run_at"),
  errorMessage: text("error_message"),
  runCount: integer("run_count").notNull().default(0),
  ...timestamps,
});
export const insertOutreachJobSchema = createInsertSchema(outreachJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutreachJob = z.infer<typeof insertOutreachJobSchema>;
export type OutreachJob = typeof outreachJobs.$inferSelect;

export const outreachAuditEvents = pgTable(
  "outreach_audit_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    eventType: text("event_type").notNull(),
    companyName: text("company_name"),
    recipientEmail: text("recipient_email"),
    campaignKey: text("campaign_key"),
    details: jsonb("details").$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxAuditEntity: index("idx_oa_entity").on(t.entityType, t.entityId),
    idxAuditType: index("idx_oa_event_type").on(t.eventType),
    idxAuditCreated: index("idx_oa_created_at").on(t.createdAt),
  }),
);
export const insertOutreachAuditEventSchema = createInsertSchema(outreachAuditEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertOutreachAuditEvent = z.infer<typeof insertOutreachAuditEventSchema>;
export type OutreachAuditEvent = typeof outreachAuditEvents.$inferSelect;

export const outreachSequences = pgTable(
  "outreach_sequences",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    threadId: varchar("thread_id").notNull(),
    sequenceType: text("sequence_type").notNull().default("standard"),
    stage: integer("stage").notNull().default(0),
    scheduledFor: timestamp("scheduled_for").notNull(),
    sentAt: timestamp("sent_at"),
    status: text("status").notNull().default("scheduled"),
    stopReason: text("stop_reason"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxSeqThread: index("idx_seq_thread_id").on(t.threadId),
    idxSeqScheduled: index("idx_seq_scheduled_for").on(t.scheduledFor),
    idxSeqStatus: index("idx_seq_status").on(t.status),
  }),
);
export const insertOutreachSequenceSchema = createInsertSchema(outreachSequences).omit({
  id: true,
  createdAt: true,
});
export type InsertOutreachSequence = z.infer<typeof insertOutreachSequenceSchema>;
export type OutreachSequence = typeof outreachSequences.$inferSelect;

export const outreachEvents = pgTable(
  "outreach_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    threadId: varchar("thread_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxEventThread: index("idx_event_thread_id").on(t.threadId),
    idxEventType: index("idx_event_type").on(t.eventType),
  }),
);
export const insertOutreachEventSchema = createInsertSchema(outreachEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertOutreachEvent = z.infer<typeof insertOutreachEventSchema>;
export type OutreachEvent = typeof outreachEvents.$inferSelect;

export const meetingBookingEvents = pgTable(
  "meeting_booking_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyId: varchar("company_id").notNull(),
    companyName: text("company_name").notNull(),
    contactId: varchar("contact_id"),
    opportunityId: varchar("opportunity_id"),
    threadId: varchar("thread_id"),
    bookingProvider: text("booking_provider").notNull().default("manual"),
    bookingStatus: text("booking_status").notNull().default("pending"),
    bookingLink: text("booking_link"),
    meetingTime: timestamp("meeting_time"),
    meetingTitle: text("meeting_title"),
    meetingNotes: text("meeting_notes"),
    calendarEventId: text("calendar_event_id"),
    isSandbox: boolean("is_sandbox").notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    idxBookingCompany: index("idx_booking_company_id").on(t.companyId),
    idxBookingStatus: index("idx_booking_status").on(t.bookingStatus),
    idxBookingThread: index("idx_booking_thread_id").on(t.threadId),
  }),
);
export const insertMeetingBookingEventSchema = createInsertSchema(meetingBookingEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMeetingBookingEvent = z.infer<typeof insertMeetingBookingEventSchema>;
export type MeetingBookingEvent = typeof meetingBookingEvents.$inferSelect;

/* ============================================================================
   PAYMENTS / STRIPE / WEBHOOKS / REVENUE
   ========================================================================== */

export const paymentCustomers = pgTable(
  "payment_customers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyId: varchar("company_id"),
    contactId: varchar("contact_id"),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    ...timestamps,
  },
  (t) => ({
    idxPayCustStripe: uniqueIndex("idx_pay_cust_stripe_id").on(t.stripeCustomerId),
    idxPayCustEmail: index("idx_pay_cust_email").on(t.email),
  }),
);
export const insertPaymentCustomerSchema = createInsertSchema(paymentCustomers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentCustomer = z.infer<typeof insertPaymentCustomerSchema>;
export type PaymentCustomer = typeof paymentCustomers.$inferSelect;

export const paymentLinks = pgTable(
  "payment_links",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quoteId: varchar("quote_id"),
    opportunityId: varchar("opportunity_id"),
    companyId: varchar("company_id"),
    stripePaymentLinkId: text("stripe_payment_link_id"),
    stripePriceId: text("stripe_price_id"),
    stripeProductId: text("stripe_product_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("aud"),
    linkUrl: text("link_url"),
    linkType: text("link_type").notNull().default("full"),
    status: text("status").notNull().default("active"),
    isTestMode: boolean("is_test_mode").notNull().default(true),
    isSafeMode: boolean("is_safe_mode").notNull().default(true),
    supersededAt: timestamp("superseded_at"),
    ...timestamps,
  },
  (t) => ({
    idxPayLinkQuote: index("idx_pay_link_quote_id").on(t.quoteId),
    idxPayLinkStatus: index("idx_pay_link_status").on(t.status),
  }),
);
export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;
export type PaymentLink = typeof paymentLinks.$inferSelect;

export const paymentIntentsLog = pgTable(
  "payment_intents_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quoteId: varchar("quote_id"),
    opportunityId: varchar("opportunity_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("aud"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    rawPayloadJson: jsonb("raw_payload_json").$type<Record<string, unknown> | null>().default(null),
    ...timestamps,
  },
  (t) => ({
    idxPayIntentStripe: index("idx_pay_intent_stripe_id").on(t.stripePaymentIntentId),
    idxPayIntentQuote: index("idx_pay_intent_quote_id").on(t.quoteId),
  }),
);
export const insertPaymentIntentLogSchema = createInsertSchema(paymentIntentsLog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentIntentLog = z.infer<typeof insertPaymentIntentLogSchema>;
export type PaymentIntentLog = typeof paymentIntentsLog.$inferSelect;

export const invoicesLog = pgTable(
  "invoices_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    quoteId: varchar("quote_id"),
    opportunityId: varchar("opportunity_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    stripeInvoiceUrl: text("stripe_invoice_url"),
    stripeHostedInvoiceUrl: text("stripe_hosted_invoice_url"),
    stripeCustomerId: text("stripe_customer_id"),
    amountDue: integer("amount_due").notNull(),
    amountPaid: integer("amount_paid").default(0),
    currency: text("currency").notNull().default("aud"),
    status: text("status").notNull().default("draft"),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),
    isTestMode: boolean("is_test_mode").notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    idxInvoiceStripe: index("idx_invoice_stripe_id").on(t.stripeInvoiceId),
    idxInvoiceQuote: index("idx_invoice_quote_id").on(t.quoteId),
  }),
);
export const insertInvoiceLogSchema = createInsertSchema(invoicesLog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvoiceLog = z.infer<typeof insertInvoiceLogSchema>;
export type InvoiceLog = typeof invoicesLog.$inferSelect;

export const revenueEvents = pgTable(
  "revenue_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyId: varchar("company_id"),
    opportunityId: varchar("opportunity_id"),
    quoteId: varchar("quote_id"),
    paymentSource: text("payment_source").notNull().default("stripe"),
    eventType: text("event_type").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("aud"),
    status: text("status").notNull().default("recorded"),
    isSimulated: boolean("is_simulated").notNull().default(false),
    occurredAt: timestamp("occurred_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxRevEventType: index("idx_rev_event_type").on(t.eventType),
    idxRevEventOccurred: index("idx_rev_event_occurred").on(t.occurredAt),
    idxRevEventCompany: index("idx_rev_event_company").on(t.companyId),
  }),
);
export const insertRevenueEventSchema = createInsertSchema(revenueEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertRevenueEvent = z.infer<typeof insertRevenueEventSchema>;
export type RevenueEvent = typeof revenueEvents.$inferSelect;

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    provider: text("provider").notNull().default("stripe"),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at"),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown> | null>().default(null),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxWebhookExtId: uniqueIndex("idx_webhook_ext_id").on(t.provider, t.externalEventId),
    idxWebhookProcessed: index("idx_webhook_processed").on(t.processed),
  }),
);
export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;

/* ============================================================================
   AUDIT / APPROVAL / PROPOSALS / DEAL EXECUTION
   ========================================================================== */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    actorType: text("actor_type").notNull().default("system"),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxAuditAction: index("idx_audit_action").on(t.action),
    idxAuditEntity: index("idx_audit_entity").on(t.entityType, t.entityId),
    idxAuditCreated: index("idx_audit_created").on(t.createdAt),
  }),
);
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const proposals = pgTable(
  "proposals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    opportunityId: varchar("opportunity_id"),
    quoteId: varchar("quote_id"),
    version: integer("version").notNull().default(1),
    title: text("title"),
    clientName: text("client_name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    pdfUrl: text("pdf_url"),
    htmlContent: text("html_content"),
    contentJson: jsonb("content_json").$type<Record<string, unknown> | null>().default(null),
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at"),
    viewedAt: timestamp("viewed_at"),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    rejectionReason: text("rejection_reason"),
    validUntil: timestamp("valid_until"),
    ...timestamps,
  },
  (t) => ({
    idxProposalQuote: index("idx_proposal_quote_id").on(t.quoteId),
    idxProposalStatus: index("idx_proposal_status").on(t.status),
  }),
);
export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export const approvals = pgTable(
  "approvals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    opportunityId: varchar("opportunity_id"),
    quoteId: varchar("quote_id"),
    proposalId: varchar("proposal_id"),
    requiredRole: text("required_role").notNull().default("admin"),
    triggerReason: text("trigger_reason"),
    status: text("status").notNull().default("pending"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    rejectionNote: text("rejection_note"),
    marginAtApproval: integer("margin_at_approval"),
    dealValueAtApproval: integer("deal_value_at_approval"),
    ...timestamps,
  },
  (t) => ({
    idxApprovalStatus: index("idx_approval_status").on(t.status),
    idxApprovalQuote: index("idx_approval_quote_id").on(t.quoteId),
  }),
);
export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;

export const dealExecution = pgTable("deal_execution", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: varchar("opportunity_id"),
  companyId: varchar("company_id"),
  companyName: text("company_name").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("new"),
  stage: varchar("stage", { length: 64 }).notNull().default("new"),
  assignedTo: varchar("assigned_to", { length: 32 }).notNull().default("alex"),
  lastAction: text("last_action"),
  nextAction: text("next_action"),
  lastContactedAt: timestamp("last_contacted_at"),
  meetingBooked: boolean("meeting_booked").default(false),
  meetingTime: timestamp("meeting_time"),
  dealValueEstimate: integer("deal_value_estimate"),
  opportunityScore: integer("opportunity_score"),
  outreachThreadId: varchar("outreach_thread_id"),
  proposalId: varchar("proposal_id"),
  stripePaymentLinkId: varchar("stripe_payment_link_id"),
  city: text("city"),
  industry: text("industry"),
  wonAt: timestamp("won_at"),
  lostAt: timestamp("lost_at"),
  lostReason: text("lost_reason"),
  ...timestamps,
});
export const insertDealExecutionSchema = createInsertSchema(dealExecution).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDealExecution = z.infer<typeof insertDealExecutionSchema>;
export type DealExecution = typeof dealExecution.$inferSelect;

/* ============================================================================
   LEGACY ALEX TABLES (KEPT FOR COMPATIBILITY)
   ========================================================================== */

export const alexActions = pgTable("alex_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actionType: varchar("action_type", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: varchar("entity_id"),
  entityName: text("entity_name"),
  decision: varchar("decision", { length: 64 }),
  reasoning: text("reasoning"),
  inputScore: integer("input_score"),
  inputSignals: jsonb("input_signals"),
  executed: boolean("executed").default(false),
  result: text("result"),
  isSafe: boolean("is_safe").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAlexActionSchema = createInsertSchema(alexActions).omit({
  id: true,
  createdAt: true,
});
export type InsertAlexAction = z.infer<typeof insertAlexActionSchema>;
export type AlexAction = typeof alexActions.$inferSelect;

export const alexCompanyRuns = pgTable("alex_company_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  summary: text("summary"),
  departmentResultsJson: jsonb("department_results_json")
    .$type<Record<string, unknown> | null>()
    .default(null),
  totalActionsTaken: integer("total_actions_taken").default(0),
  totalBlockers: integer("total_blockers").default(0),
  triggeredBy: text("triggered_by").default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type AlexCompanyRun = typeof alexCompanyRuns.$inferSelect;

/* ============================================================================
   CLUSTERS / BUILDING SIGNALS
   ========================================================================== */

export const buildingSignals = pgTable("building_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buildingName: text("building_name").notNull(),
  address: text("address"),
  suburb: text("suburb"),
  city: text("city").notNull(),
  state: text("state"),
  signalType: text("signal_type").notNull(),
  sourceUrl: text("source_url"),
  observedCompany: text("observed_company"),
  observedFloor: text("observed_floor"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBuildingSignalSchema = createInsertSchema(buildingSignals).omit({
  id: true,
  createdAt: true,
});
export type InsertBuildingSignal = z.infer<typeof insertBuildingSignalSchema>;
export type BuildingSignal = typeof buildingSignals.$inferSelect;

export const clusters = pgTable("clusters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 64 }).notNull(),
  region: text("region").notNull(),
  city: text("city"),
  clusterScore: real("cluster_score").default(0),
  entityCount: integer("entity_count").default(0),
  entityIds: jsonb("entity_ids").default([]),
  topIndustry: text("top_industry"),
  vacancyRisk: real("vacancy_risk").default(0),
  growthSignals: integer("growth_signals").default(0),
  relocationsDetected: integer("relocations_detected").default(0),
  lat: real("lat"),
  lng: real("lng"),
  ...timestamps,
});
export const insertClusterSchema = createInsertSchema(clusters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCluster = z.infer<typeof insertClusterSchema>;
export type Cluster = typeof clusters.$inferSelect;

/* ============================================================================
   REAL LEAD ENGINE
   ========================================================================== */

export const ingestedLeads = pgTable(
  "ingested_leads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    city: text("city").notNull(),
    state: text("state"),
    source: text("source").notNull().default("manual"),
    signalType: text("signal_type").notNull().default("expansion"),
    notes: text("notes"),
    estimatedValue: integer("estimated_value"),
    score: integer("score").notNull().default(60),
    status: text("status").notNull().default("new"),
    dealExecutionId: varchar("deal_execution_id"),
    intelligenceSignalId: varchar("intelligence_signal_id"),
    opportunityId: varchar("opportunity_id"),
    isDuplicate: boolean("is_duplicate").default(false),
    dedupeKey: text("dedupe_key"),
    ...timestamps,
  },
  (t) => ({
    idxIngestedLeadsDedupe: uniqueIndex("idx_ingested_leads_dedupe").on(t.dedupeKey),
  }),
);
export const insertIngestedLeadSchema = createInsertSchema(ingestedLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isDuplicate: true,
  dedupeKey: true,
});
export type InsertIngestedLead = z.infer<typeof insertIngestedLeadSchema>;
export type IngestedLead = typeof ingestedLeads.$inferSelect;

/* ============================================================================
   CATALOG / PRODUCT COMMAND CENTRE
   ========================================================================== */

export const productCategories = pgTable("product_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: varchar("parent_id"),
  description: text("description"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  introText: text("intro_text"),
  featuredProductId: varchar("featured_product_id"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  ...timestamps,
});
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type ProductCategory = typeof productCategories.$inferSelect;

export const uploadQueue = pgTable("upload_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  fileUrl: text("file_url"),
  uploadType: text("upload_type").notNull().default("image"),
  uploadStatus: text("upload_status").notNull().default("pending"),
  aiStatus: text("ai_status").notNull().default("pending"),
  detectedSku: text("detected_sku"),
  processingResult: jsonb("processing_result").$type<Record<string, unknown> | null>().default(null),
  errorMessage: text("error_message"),
  uploadedBy: text("uploaded_by").default("admin"),
  ...timestamps,
});
export const insertUploadQueueSchema = createInsertSchema(uploadQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUploadQueue = z.infer<typeof insertUploadQueueSchema>;
export type UploadQueueItem = typeof uploadQueue.$inferSelect;

export const productDrafts = pgTable("product_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uploadQueueId: varchar("upload_queue_id"),
  sku: text("sku"),
  title: text("title").notNull(),
  shortDescription: text("short_description"),
  fullDescription: text("full_description"),
  features: text("features").array().default(sql`'{}'`),
  tags: text("tags").array().default(sql`'{}'`),
  categoryId: varchar("category_id"),
  categoryName: text("category_name"),
  subcategoryName: text("subcategory_name"),
  style: text("style"),
  commercialUseCase: text("commercial_use_case"),
  productType: text("product_type"),
  brand: text("brand"),
  dimensions: text("dimensions"),
  materials: text("materials"),
  imageUrl: text("image_url"),
  galleryImages: text("gallery_images").array().default(sql`'{}'`),
  imageAltText: text("image_alt_text"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  aiConfidenceScore: real("ai_confidence_score").default(0),
  marketAppealScore: real("market_appeal_score").default(0),
  commercialRelevanceScore: real("commercial_relevance_score").default(0),
  visualQualityScore: real("visual_quality_score").default(0),
  brandFitScore: real("brand_fit_score").default(0),
  overallAiScore: real("overall_ai_score").default(0),
  publishReadiness: text("publish_readiness").notNull().default("hold_back"),
  status: text("status").notNull().default("new"),
  reviewNotes: text("review_notes"),
  publishedAt: timestamp("published_at"),
  isLive: boolean("is_live").default(false),
  isDuplicate: boolean("is_duplicate").default(false),
  duplicateGroupId: varchar("duplicate_group_id"),
  aiRaw: jsonb("ai_raw"),
  ...timestamps,
});
export const insertProductDraftSchema = createInsertSchema(productDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductDraft = z.infer<typeof insertProductDraftSchema>;
export type ProductDraft = typeof productDrafts.$inferSelect;

export const catalogStagingBatches = pgTable("catalog_staging_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("open"),
  totalImages: integer("total_images").default(0),
  approvedImages: integer("approved_images").default(0),
  liveImages: integer("live_images").default(0),
  ...timestamps,
});
export const insertCatalogStagingBatchSchema = createInsertSchema(catalogStagingBatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCatalogStagingBatch = z.infer<typeof insertCatalogStagingBatchSchema>;
export type CatalogStagingBatch = typeof catalogStagingBatches.$inferSelect;

export const catalogStagingItems = pgTable("catalog_staging_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  filename: text("filename").notNull(),
  imageUrl: text("image_url").notNull(),
  sku: text("sku"),
  productName: text("product_name"),
  category: text("category"),
  subcategory: text("subcategory"),
  dimensions: text("dimensions"),
  materials: text("materials"),
  priceAud: integer("price_aud"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  isDuplicate: boolean("is_duplicate").default(false),
  duplicateOf: varchar("duplicate_of"),
  status: text("status").notNull().default("uploaded"),
  aiSuggestions: jsonb("ai_suggestions"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  approvedAt: timestamp("approved_at"),
  liveAt: timestamp("live_at"),
  ...timestamps,
});
export const insertCatalogStagingItemSchema = createInsertSchema(catalogStagingItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCatalogStagingItem = z.infer<typeof insertCatalogStagingItemSchema>;
export type CatalogStagingItem = typeof catalogStagingItems.$inferSelect;

export const catalogProducts = pgTable(
  "catalog_products",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug"),
    category: text("category").notNull(),
    series: text("series"),
    brand: text("brand").default("The Corporate Desk"),
    imageUrl: text("image_url").notNull(),
    imageAlt: text("image_alt"),
    searchableText: text("searchable_text"),
    status: text("status").default("active"),
    batchSource: text("batch_source"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    skuIdx: uniqueIndex("catalog_products_sku_idx").on(table.sku),
    categoryIdx: index("catalog_products_category_idx").on(table.category),
  }),
);
export const insertCatalogProductSchema = createInsertSchema(catalogProducts).omit({
  id: true,
  createdAt: true,
});
export type InsertCatalogProduct = z.infer<typeof insertCatalogProductSchema>;
export type CatalogProduct = typeof catalogProducts.$inferSelect;

export const catalogConfig = pgTable("catalog_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ============================================================================
   BOOKINGS
   ========================================================================== */

export const strategyBookings = pgTable("strategy_bookings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  company: text("company").notNull(),
  staffCount: integer("staff_count"),
  officeLocation: text("office_location"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  moveDate: text("move_date"),
  message: text("message"),
  bookingDate: text("booking_date").notNull(),
  bookingTime: text("booking_time").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertStrategyBookingSchema = createInsertSchema(strategyBookings).omit({
  id: true,
  createdAt: true,
});
export type InsertStrategyBooking = z.infer<typeof insertStrategyBookingSchema>;
export type StrategyBooking = typeof strategyBookings.$inferSelect;
/* ============================================================================
   NEXORA AUTONOMOUS BRAIN — DB-BACKED MEMORY TABLES
   ========================================================================== */

export const nexoraDecisions = pgTable(
  "nexora_decisions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    runId: text("run_id").notNull(),
    signalId: text("signal_id").notNull(),
    companyName: text("company_name"),
    signalType: text("signal_type"),
    action: text("action").notNull().default("hold"),
    priority: text("priority").notNull().default("low"),
    confidence: real("confidence").notNull().default(0),
    reasoning: text("reasoning"),
    ruleDecision: jsonb("rule_decision").$type<Record<string, unknown> | null>().default(null),
    aiDecision: jsonb("ai_decision").$type<Record<string, unknown> | null>().default(null),
    finalDecision: jsonb("final_decision").$type<Record<string, unknown> | null>().default(null),
    autoApproved: boolean("auto_approved").default(false),
    pushedPipeline: boolean("pushed_pipeline").default(false),
    pushedRadar: boolean("pushed_radar").default(false),
    outreachQueued: boolean("outreach_queued").default(false),
    anomalyFlagged: boolean("anomaly_flagged").default(false),
    webhookSent: boolean("webhook_sent").default(false),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxNexDecisionRun: index("idx_nexdec_run_id").on(t.runId),
    idxNexDecisionSignal: index("idx_nexdec_signal_id").on(t.signalId),
    idxNexDecisionCompany: index("idx_nexdec_company").on(t.companyName),
    idxNexDecisionCreated: index("idx_nexdec_created_at").on(t.createdAt),
    idxNexDecisionIdempotency: index("idx_nexdec_idempotency_key").on(t.idempotencyKey),
  }),
);
export const insertNexoraDecisionSchema = createInsertSchema(nexoraDecisions).omit({ id: true, createdAt: true });
export type InsertNexoraDecision = z.infer<typeof insertNexoraDecisionSchema>;
export type NexoraDecision = typeof nexoraDecisions.$inferSelect;

export const nexoraOutcomes = pgTable(
  "nexora_outcomes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    decisionId: varchar("decision_id"),
    signalId: text("signal_id").notNull(),
    companyName: text("company_name"),
    outcome: text("outcome").notNull(),
    channel: text("channel"),
    responseText: text("response_text"),
    daysToOutcome: integer("days_to_outcome"),
    dealValue: real("deal_value"),
    confidenceAtDecision: real("confidence_at_decision"),
    priorityAtDecision: text("priority_at_decision"),
    notes: text("notes"),
    recordedAt: timestamp("recorded_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxNexOutcomeSignal: index("idx_nexout_signal_id").on(t.signalId),
    idxNexOutcomeCompany: index("idx_nexout_company").on(t.companyName),
    idxNexOutcomeOutcome: index("idx_nexout_outcome").on(t.outcome),
    idxNexOutcomeCreated: index("idx_nexout_created_at").on(t.createdAt),
  }),
);
export const insertNexoraOutcomeSchema = createInsertSchema(nexoraOutcomes).omit({ id: true, createdAt: true, recordedAt: true });
export type InsertNexoraOutcome = z.infer<typeof insertNexoraOutcomeSchema>;
export type NexoraOutcome = typeof nexoraOutcomes.$inferSelect;

export const nexoraThresholds = pgTable(
  "nexora_thresholds",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    version: integer("version").notNull().default(1),
    strongMove: real("strong_move").notNull().default(72),
    criticalValue: real("critical_value").notNull().default(150000),
    highValue: real("high_value").notNull().default(60000),
    bothMinValue: real("both_min_value").notNull().default(120000),
    strongPipeline: real("strong_pipeline").notNull().default(0.72),
    highIntentMin: real("high_intent_min").notNull().default(0.68),
    learningRate: real("learning_rate").notNull().default(0.15),
    changeReason: text("change_reason"),
    triggeredByOutcomes: integer("triggered_by_outcomes").default(0),
    winRate: real("win_rate"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxNexThreshActive: index("idx_nexthresh_active").on(t.isActive),
    idxNexThreshVersion: index("idx_nexthresh_version").on(t.version),
  }),
);
export const insertNexoraThresholdSchema = createInsertSchema(nexoraThresholds).omit({ id: true, createdAt: true });
export type InsertNexoraThreshold = z.infer<typeof insertNexoraThresholdSchema>;
export type NexoraThreshold = typeof nexoraThresholds.$inferSelect;

export const nexoraKnowledge = pgTable(
  "nexora_knowledge",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    entryKey: text("entry_key").notNull().unique(),
    companyName: text("company_name"),
    signalType: text("signal_type"),
    city: text("city"),
    industry: text("industry"),
    action: text("action"),
    priority: text("priority"),
    confidence: real("confidence").default(0.5),
    winRate: real("win_rate").default(0.5),
    successCount: integer("success_count").default(0),
    failCount: integer("fail_count").default(0),
    totalCount: integer("total_count").default(0),
    lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    idxNexKnowKey: index("idx_nexknow_entry_key").on(t.entryKey),
    idxNexKnowCompany: index("idx_nexknow_company").on(t.companyName),
    idxNexKnowSignal: index("idx_nexknow_signal_type").on(t.signalType),
  }),
);
export const insertNexoraKnowledgeSchema = createInsertSchema(nexoraKnowledge).omit({ id: true, createdAt: true, lastUpdatedAt: true });
export type InsertNexoraKnowledge = z.infer<typeof insertNexoraKnowledgeSchema>;
export type NexoraKnowledge = typeof nexoraKnowledge.$inferSelect;

export const nexoraIdempotencyKeys = pgTable(
  "nexora_idempotency_keys",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    idemKey: text("idem_key").notNull().unique(),
    action: text("action").notNull(),
    signalId: text("signal_id"),
    companyName: text("company_name"),
    status: text("status").notNull().default("claimed"),
    claimedAt: timestamp("claimed_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    expiresAt: timestamp("expires_at"),
  },
  (t) => ({
    idxNexIdemKey: index("idx_nexidem_key").on(t.idemKey),
    idxNexIdemStatus: index("idx_nexidem_status").on(t.status),
    idxNexIdemExpires: index("idx_nexidem_expires").on(t.expiresAt),
  }),
);
export const insertNexoraIdempotencyKeySchema = createInsertSchema(nexoraIdempotencyKeys).omit({ id: true, claimedAt: true });
export type InsertNexoraIdempotencyKey = z.infer<typeof insertNexoraIdempotencyKeySchema>;
export type NexoraIdempotencyKey = typeof nexoraIdempotencyKeys.$inferSelect;

export const nexoraRunLocks = pgTable(
  "nexora_run_locks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    lockKey: text("lock_key").notNull().unique(),
    runId: text("run_id").notNull(),
    acquiredAt: timestamp("acquired_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    releasedAt: timestamp("released_at"),
    status: text("status").notNull().default("active"),
  },
  (t) => ({
    idxNexLockKey: index("idx_nexlock_key").on(t.lockKey),
    idxNexLockStatus: index("idx_nexlock_status").on(t.status),
    idxNexLockExpires: index("idx_nexlock_expires").on(t.expiresAt),
  }),
);
export const insertNexoraRunLockSchema = createInsertSchema(nexoraRunLocks).omit({ id: true, acquiredAt: true });
export type InsertNexoraRunLock = z.infer<typeof insertNexoraRunLockSchema>;
export type NexoraRunLock = typeof nexoraRunLocks.$inferSelect;
