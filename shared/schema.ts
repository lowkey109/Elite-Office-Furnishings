import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, real, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  message: text("message"),
  officeSize: text("office_size"),
  staffCount: text("staff_count"),
  budget: text("budget"),
  timeline: text("timeline"),
  officeLocation: text("office_location"),
  moveDate: text("move_date"),
  opportunityScore: integer("opportunity_score"),
  opportunityTier: text("opportunity_tier"),
  signalsJson: text("signals_json"),
  nextAction: text("next_action"),
  estimatedValueRange: text("estimated_value_range"),
  estimateJson: text("estimate_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const prospectedLeads = pgTable("prospected_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  company: text("company").notNull(),
  domain: text("domain"),
  website: text("website"),
  location: text("location").notNull(),
  industry: text("industry").notNull(),
  estimatedTeamSize: text("estimated_team_size").notNull(),
  likelyOfficeNeed: text("likely_office_need"),
  signalsDetected: text("signals_detected").array().notNull().default(sql`'{}'`),
  estimatedProjectValue: text("estimated_project_value").notNull(),
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
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  // — Extended intelligence fields —
  signalType: text("signal_type"),
  city: text("city"),
  contactEmail: text("contact_email"),
  contactRole: text("contact_role"),
  dealProbability: integer("deal_probability"),
  estimatedOfficeSqm: text("estimated_office_sqm"),
  estimatedHeadcount: text("estimated_headcount"),
  recommendedNextAction: text("recommended_next_action"),
  outreachSubject: text("outreach_subject"),
  scanBatchId: text("scan_batch_id"),
});

// ─── Territories ───────────────────────────────────────────────────────────────
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTerritorySchema = createInsertSchema(territories).omit({ id: true, createdAt: true });
export type InsertTerritory = z.infer<typeof insertTerritorySchema>;
export type Territory = typeof territories.$inferSelect;

export const supplierQuotes = pgTable("supplier_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierName: text("supplier_name").notNull(),
  supplierPhone: text("supplier_phone"),
  supplierEmail: text("supplier_email"),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull().default(1),
  colourFinish: text("colour_finish"),
  unitPrice: text("unit_price").notNull(),
  freightCost: text("freight_cost"),
  leadTime: text("lead_time"),
  quoteDate: text("quote_date").notNull(),
  projectReference: text("project_reference"),
  status: text("status").notNull().default("Requested"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerName: text("referrer_name").notNull(),
  company: text("company"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  leadSource: text("lead_source").notNull(),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  estimatedValue: text("estimated_value"),
  notes: text("notes"),
  status: text("status").notNull().default("New"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const planningRequests = pgTable("planning_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city"),
  projectType: text("project_type"),
  squareMetres: text("square_metres"),
  staffCount: text("staff_count"),
  meetingRooms: text("meeting_rooms"),
  receptionRequired: boolean("reception_required").default(false),
  breakoutRequired: boolean("breakout_required").default(false),
  executiveOfficeRequired: boolean("executive_office_required").default(false),
  budgetRange: text("budget_range"),
  stylePreference: text("style_preference"),
  specialRequirements: text("special_requirements"),
  uploadedFilesJson: text("uploaded_files_json").default("[]"),
  aiSummary: text("ai_summary"),
  aiRecommendations: text("ai_recommendations"),
  leadScore: integer("lead_score"),
  estimatedValue: text("estimated_value"),
  implementationTimeline: text("implementation_timeline"),
  status: text("status").notNull().default("New"),
  source: text("source").default("upload-floor-plan"),
  adminNotes: text("admin_notes"),
  isPaid: boolean("is_paid").default(false),
  stripeSessionId: text("stripe_session_id"),
  paymentStatus: text("payment_status").default("unpaid"),
  paymentTier: text("payment_tier"),
  packageJson: text("package_json"),
  quoteJson: text("quote_json"),
  quoteStatus: text("quote_status").default("draft"),
  floorGeometryJson: text("floor_geometry_json"),
  geometrySource: text("geometry_source"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PlanningRequest = typeof planningRequests.$inferSelect;

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

export const followUpSequences = pgTable("follow_up_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: text("lead_id").notNull(),
  leadName: text("lead_name").notNull(),
  leadEmail: text("lead_email").notNull(),
  leadCompany: text("lead_company").notNull(),
  leadType: text("lead_type").notNull(),
  officeSize: text("office_size"),
  staffCount: text("staff_count"),
  budget: text("budget"),
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

// ─── Workspace Learning Records ─────────────────────────────────────────────
export const workspaceLearningRecords = pgTable("workspace_learning_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planningRequestId: text("planning_request_id"),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  city: text("city"),
  projectType: text("project_type"),
  officeSqm: text("office_sqm"),
  staffCount: text("staff_count"),
  meetingRoomCount: text("meeting_room_count"),
  receptionIncluded: boolean("reception_included").default(false),
  breakoutIncluded: boolean("breakout_included").default(false),
  executiveOfficeIncluded: boolean("executive_office_included").default(false),
  budgetRange: text("budget_range"),
  stylePreference: text("style_preference"),
  officeType: text("office_type"),
  packageTier: text("package_tier"),
  estimatedCost: text("estimated_cost"),
  leadScore: integer("lead_score"),
  workspaceZonesJson: text("workspace_zones_json"),
  productRecsJson: text("product_recs_json"),
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

// ─── Scheduled Jobs ──────────────────────────────────────────────────────────
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

// ─── Intelligence Reports ────────────────────────────────────────────────────
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

// ─── Spending Trends ─────────────────────────────────────────────────────────
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

// ─── Website Issues ──────────────────────────────────────────────────────────
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

// ─── Profit Records ──────────────────────────────────────────────────────────
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertProfitRecordSchema = createInsertSchema(profitRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProfitRecord = z.infer<typeof insertProfitRecordSchema>;
export type ProfitRecord = typeof profitRecords.$inferSelect;

// ─── Formal Quotes ───────────────────────────────────────────────────────────
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: text("quote_number").notNull(),
  status: text("status").notNull().default("Draft"),
  clientName: text("client_name").notNull(),
  companyName: text("company_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  planningRequestId: text("planning_request_id"),
  officeSizeSqm: integer("office_size_sqm"),
  staffCount: integer("staff_count"),
  projectSummary: text("project_summary"),
  quoteItems: text("quote_items"),
  subtotal: integer("subtotal").default(0),
  freightCost: integer("freight_cost").default(0),
  installationCost: integer("installation_cost").default(0),
  otherCosts: integer("other_costs").default(0),
  discount: integer("discount").default(0),
  gst: integer("gst").default(0),
  total: integer("total").default(0),
  totalIncGst: integer("total_inc_gst").default(0),
  financeMonthlyEstimate: integer("finance_monthly_estimate"),
  notes: text("notes"),
  validityDays: integer("validity_days").default(30),
  preparedBy: text("prepared_by").default("The Corporate Desk"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  opportunityId: varchar("opportunity_id"),
  companyId: varchar("company_id"),
  costPrice: integer("cost_price").default(0),
  marginPercent: real("margin_percent").default(0),
  discountPercent: real("discount_percent").default(0),
  pipelineStage: text("pipeline_stage").default("lead"),
});
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// ─── Office Move Radar ────────────────────────────────────────────────────────
export const officeMovRadar = pgTable("office_move_radar", {
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
  estimatedHeadcount: text("estimated_headcount"),
  estimatedOfficeSizeSqm: text("estimated_office_size_sqm"),
  estimatedProjectValue: text("estimated_project_value"),
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
  status: text("status").notNull().default("New"),
  notes: text("notes"),
  sourceType: text("source_type").default("manual"),
  verificationStatus: text("verification_status").default("unverified"),
  evidenceExcerpt: text("evidence_excerpt"),
  normalizedCompanyName: text("normalized_company_name"),
  normalizedCity: text("normalized_city"),
  signalWindowBucket: text("signal_window_bucket"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxRadarCompanyCity: index("idx_radar_company_city").on(t.companyName, t.city),
  idxRadarStatus: index("idx_radar_status").on(t.status),
  idxRadarSignalType: index("idx_radar_signal_type").on(t.signalType),
  idxRadarCreatedAt: index("idx_radar_created_at").on(t.createdAt),
  idxRadarDedupe: uniqueIndex("idx_radar_dedupe").on(t.normalizedCompanyName, t.normalizedCity, t.signalType, t.signalWindowBucket),
}));

export const insertOfficeMovRadarSchema = createInsertSchema(officeMovRadar).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertOfficeMovRadar = z.infer<typeof insertOfficeMovRadarSchema>;
export type OfficeMovRadar = typeof officeMovRadar.$inferSelect;

// ─── Building Signals ─────────────────────────────────────────────────────────
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
  id: true, createdAt: true,
});
export type InsertBuildingSignal = z.infer<typeof insertBuildingSignalSchema>;
export type BuildingSignal = typeof buildingSignals.$inferSelect;

// ─── Deal Intelligence Records ────────────────────────────────────────────────
export const dealIntelligenceRecords = pgTable("deal_intelligence_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(), // "lead" | "prospect" | "planning_request" | "quote" | "radar"
  relatedLeadId: text("related_lead_id"),
  relatedPlanningRequestId: text("related_planning_request_id"),
  relatedQuoteId: text("related_quote_id"),
  relatedProspectId: text("related_prospect_id"),
  relatedRadarId: text("related_radar_id"),
  companyName: text("company_name").notNull(),
  city: text("city"),
  industry: text("industry"),
  officeSizeSqm: text("office_size_sqm"),
  staffCount: text("staff_count"),
  budgetBand: text("budget_band"),
  pipelineStage: text("pipeline_stage"),
  estimatedProjectValue: integer("estimated_project_value"),
  estimatedGrossProfit: integer("estimated_gross_profit"),
  estimatedMarginPct: integer("estimated_margin_pct"),
  winProbability: integer("win_probability").notNull().default(0),
  probabilityTier: text("probability_tier").notNull().default("low"), // "low" | "medium" | "high"
  confidenceLevel: text("confidence_level").notNull().default("low"), // "low" | "medium" | "high"
  dealStrength: integer("deal_strength").notNull().default(0),
  weightedExpectedRevenue: integer("weighted_expected_revenue"),
  weightedExpectedProfit: integer("weighted_expected_profit"),
  recommendedNextAction: text("recommended_next_action"),
  recommendedFollowUpTiming: text("recommended_follow_up_timing"),
  recommendedOffer: text("recommended_offer"),
  reasoningSummary: text("reasoning_summary"),
  scoringSignalsJson: text("scoring_signals_json"),
  quoteStatus: text("quote_status"),
  financeInterest: boolean("finance_interest").default(false),
  hasRadarSignal: boolean("has_radar_signal").default(false),
  hasPlanningRequest: boolean("has_planning_request").default(false),
  hasQuote: boolean("has_quote").default(false),
  outcomeResult: text("outcome_result").default("pending"), // "pending" | "won" | "lost" | "stalled"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDealIntelligenceSchema = createInsertSchema(dealIntelligenceRecords).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDealIntelligence = z.infer<typeof insertDealIntelligenceSchema>;
export type DealIntelligenceRecord = typeof dealIntelligenceRecords.$inferSelect;

// ─── Generated Blog Articles ─────────────────────────────────────────────────
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

// ─── Partner Network ──────────────────────────────────────────────────────────
export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  partnerType: text("partner_type").notNull(), // broker|tenant_rep|architect|designer|builder|furniture_supplier|mover|finance_partner|technology_partner
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  website: text("website"),
  city: text("city"),
  state: text("state"),
  serviceRegions: text("service_regions").array(), // ["Brisbane","Sydney","Melbourne"]
  industrySpecialties: text("industry_specialties").array(), // ["Technology","Finance","Legal"]
  servicesOffered: text("services_offered").array(),
  companySize: text("company_size"), // "1-10"|"10-50"|"50-200"|"200+"
  portfolioExamples: text("portfolio_examples"),
  bio: text("bio"),
  activeStatus: text("active_status").notNull().default("pending"), // pending|active|suspended
  rating: integer("rating").default(0), // 0-100 internal rating
  totalOpportunitiesReceived: integer("total_opportunities_received").default(0),
  totalProjectsWon: integer("total_projects_won").default(0),
  totalRevenueGenerated: integer("total_revenue_generated").default(0), // in cents
  adminNotes: text("admin_notes"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true, totalOpportunitiesReceived: true, totalProjectsWon: true, totalRevenueGenerated: true });
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partners.$inferSelect;

export const partnerOpportunities = pgTable("partner_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  opportunityTitle: text("opportunity_title").notNull(),
  companyName: text("company_name"),
  city: text("city"),
  industry: text("industry"),
  projectType: text("project_type"), // relocation|expansion|refit|new_office
  officeSizeSqm: text("office_size_sqm"),
  staffCount: text("staff_count"),
  estimatedProjectValue: integer("estimated_project_value"), // in dollars
  relocationScore: integer("relocation_score"), // 0-100
  sourceType: text("source_type"), // radar|lead|planning_request|manual|relocation_signal
  sourceId: varchar("source_id"),
  routingReason: text("routing_reason"),
  status: text("status").notNull().default("invited"), // invited|viewed|accepted|declined|won|lost
  viewedAt: timestamp("viewed_at"),
  respondedAt: timestamp("responded_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertPartnerOpportunitySchema = createInsertSchema(partnerOpportunities).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPartnerOpportunity = z.infer<typeof insertPartnerOpportunitySchema>;
export type PartnerOpportunity = typeof partnerOpportunities.$inferSelect;

export const partnerReferrals = pgTable("partner_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  opportunityId: varchar("opportunity_id"),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  projectValue: integer("project_value"), // in dollars
  referralFee: integer("referral_fee"), // in dollars
  commissionPercent: integer("commission_percent").default(5),
  status: text("status").notNull().default("invited"), // invited|viewed|accepted|declined|won|lost
  conversionResult: text("conversion_result"), // won|lost|pending
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertPartnerReferralSchema = createInsertSchema(partnerReferrals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPartnerReferral = z.infer<typeof insertPartnerReferralSchema>;
export type PartnerReferral = typeof partnerReferrals.$inferSelect;

export const revenueShareRecords = pgTable("revenue_share_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  opportunityId: varchar("opportunity_id"),
  projectValue: integer("project_value").notNull(), // in dollars
  platformFee: integer("platform_fee"), // in dollars
  partnerFee: integer("partner_fee"), // in dollars
  referralSource: text("referral_source"),
  status: text("status").notNull().default("pending"), // pending|approved|paid
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertRevenueShareSchema = createInsertSchema(revenueShareRecords).omit({ id: true, createdAt: true });
export type InsertRevenueShare = z.infer<typeof insertRevenueShareSchema>;
export type RevenueShareRecord = typeof revenueShareRecords.$inferSelect;

// ─── Relocation Intelligence ──────────────────────────────────────────────────
export const relocationSignals = pgTable("relocation_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  industry: text("industry"),
  city: text("city").notNull(),
  state: text("state"),
  signalType: text("signal_type").notNull(), // job_growth|hiring_surge|lease_expiry|commercial_listing|headcount_growth|press_announcement|planning_permit|linkedin_growth|expansion_news|new_office
  signalSource: text("signal_source"), // seek.com|linkedin|domain.com|afr|planning_portal|ai_scan
  signalDetail: text("signal_detail"),
  sourceUrl: text("source_url"),
  jobPostingsCount: integer("job_postings_count"),
  estimatedHeadcount: integer("estimated_headcount"),
  headcountGrowthPct: integer("headcount_growth_pct"),
  leaseExpiryDate: text("lease_expiry_date"),
  officeSizeSqm: integer("office_size_sqm"),
  relocationProbability: integer("relocation_probability").notNull().default(0), // 0-100
  probabilityTier: text("probability_tier").notNull().default("low"), // high|medium|low
  estimatedProjectValue: integer("estimated_project_value"),
  estimatedTimeline: text("estimated_timeline"), // "0-3 months"|"3-6 months"|"6-12 months"|"12+ months"
  recommendedAction: text("recommended_action"),
  linkedRadarId: varchar("linked_radar_id"),
  linkedProspectId: varchar("linked_prospect_id"),
  pushedToPipeline: boolean("pushed_to_pipeline").default(false),
  status: text("status").notNull().default("active"), // active|converted|dismissed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertRelocationSignalSchema = createInsertSchema(relocationSignals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRelocationSignal = z.infer<typeof insertRelocationSignalSchema>;
export type RelocationSignal = typeof relocationSignals.$inferSelect;

// ─── AI Deal Hunter Signals ───────────────────────────────────────────────────
export const dealHunterSignals = pgTable("deal_hunter_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Company identity
  companyName: text("company_name").notNull(),
  companyDomain: text("company_domain"),
  city: text("city").notNull(),
  state: text("state"),
  country: text("country").default("Australia"),
  industry: text("industry").notNull(),
  // Raw signal data
  employeeEstimate: integer("employee_estimate"),
  growthRateEstimate: integer("growth_rate_estimate"), // %
  signalType: text("signal_type").notNull(), // hiring_growth|funding|lease_activity|relocation_signal|new_office_signal|coworking_exit|facilities_hiring|building_move_signal|industry_growth|other_growth_indicator
  signalSubtype: text("signal_subtype"),
  signalSource: text("signal_source").notNull(), // seek.com.au|linkedin|domain.com.au|afr.com|asx|crunchbase|press_release|manual
  sourceUrl: text("source_url"),
  signalDate: timestamp("signal_date").defaultNow(),
  rawPayloadSummary: text("raw_payload_summary"),
  // Scoring
  signalStrengthScore: integer("signal_strength_score").notNull().default(0), // 0-100
  signalConfidence: integer("signal_confidence").notNull().default(50), // 0-100
  reasoningSummary: text("reasoning_summary"),
  // Opportunity enrichment
  estimatedWorkspaceSqm: integer("estimated_workspace_sqm"),
  estimatedProjectValue: integer("estimated_project_value"),
  relocationProbability: integer("relocation_probability").default(0), // 0-100
  officeChangeProbability: integer("office_change_probability").default(0), // 0-100
  probabilityTier: text("probability_tier").notNull().default("low"), // high|medium|low
  projectType: text("project_type"), // relocation|expansion|redesign|new_office|fit_out|strategy
  estimatedTimeline: text("estimated_timeline"), // "0-3 months"|"3-6 months"|"6-12 months"|"12+ months"
  recommendedAction: text("recommended_action"),
  recommendedOutreachAngle: text("recommended_outreach_angle"),
  recommendedContactRolesJson: text("recommended_contact_roles_json"), // JSON array
  outreachDraft: text("outreach_draft"),
  sourceSignalCount: integer("source_signal_count").default(1),
  // Status & routing
  isReviewed: boolean("is_reviewed").default(false),
  pushedToPipeline: boolean("pushed_to_pipeline").default(false),
  pushedToRadar: boolean("pushed_to_radar").default(false),
  linkedRadarId: varchar("linked_radar_id"),
  linkedProspectId: varchar("linked_prospect_id"),
  isDuplicate: boolean("is_duplicate").default(false),
  mergedFromIds: text("merged_from_ids").array().default(sql`'{}'`),
  status: text("status").notNull().default("new"), // new|reviewed|pushed|dismissed|duplicate
  normalizedCompanyName: text("normalized_company_name"),
  normalizedCity: text("normalized_city"),
  signalWindowBucket: text("signal_window_bucket"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxDealHunterCompanyCity: index("idx_deal_hunter_company_city").on(t.companyName, t.city),
  idxDealHunterStatus: index("idx_deal_hunter_status").on(t.status),
  idxDealHunterSignalType: index("idx_deal_hunter_signal_type").on(t.signalType),
  idxDealHunterCreatedAt: index("idx_deal_hunter_created_at").on(t.createdAt),
  idxDealHunterDedupe: uniqueIndex("idx_deal_hunter_dedupe").on(t.normalizedCompanyName, t.normalizedCity, t.signalType, t.signalWindowBucket),
}));
export const insertDealHunterSignalSchema = createInsertSchema(dealHunterSignals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDealHunterSignal = z.infer<typeof insertDealHunterSignalSchema>;
export type DealHunterSignal = typeof dealHunterSignals.$inferSelect;

// ─── Workspace Strategy Recommendations ───────────────────────────────────────
export const workspaceStrategyRecommendations = pgTable("workspace_strategy_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planningRequestId: varchar("planning_request_id"),
  officeSqm: integer("office_sqm"),
  staffCount: integer("staff_count"),
  projectType: text("project_type"),
  industryContext: text("industry_context"),
  recommendedLayoutType: text("recommended_layout_type"), // open_plan|hybrid|executive|collaborative|cellular|mixed
  recommendedDeskDensity: text("recommended_desk_density"), // sqm per person
  recommendedZonesJson: text("recommended_zones_json"), // JSON array of zone allocations
  recommendedPackageTier: text("recommended_package_tier"), // Premium|Balanced|Value
  recommendedFurnitureJson: text("recommended_furniture_json"), // JSON list of product recommendations
  predictedProjectValue: integer("predicted_project_value"),
  predictedGrossProfit: integer("predicted_gross_profit"),
  predictedMarginPct: integer("predicted_margin_pct"),
  supplierMixJson: text("supplier_mix_json"),
  workspaceConcept: text("workspace_concept"), // AI-generated concept description
  budgetEstimateLow: integer("budget_estimate_low"),
  budgetEstimateHigh: integer("budget_estimate_high"),
  proposalSummary: text("proposal_summary"),
  keyInsights: text("key_insights").array(),
  confidenceScore: integer("confidence_score").default(50), // 0-100 based on data quality
  dataSourcesUsed: integer("data_sources_used").default(0), // how many learning records informed this
  outcomeTracked: boolean("outcome_tracked").default(false),
  actualProjectValue: integer("actual_project_value"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertWorkspaceStrategySchema = createInsertSchema(workspaceStrategyRecommendations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkspaceStrategy = z.infer<typeof insertWorkspaceStrategySchema>;
export type WorkspaceStrategyRecommendation = typeof workspaceStrategyRecommendations.$inferSelect;

// ─── Site Analytics — Visitor Tracking ────────────────────────────────────────
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
export const insertSiteVisitSchema = createInsertSchema(siteVisits).omit({ id: true, createdAt: true });
export type InsertSiteVisit = z.infer<typeof insertSiteVisitSchema>;
export type SiteVisit = typeof siteVisits.$inferSelect;

// ─── Supplier Performance Profiles ───────────────────────────────────────────

export const supplierProfiles = pgTable("supplier_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: text("supplier_id").notNull().unique(),
  supplierName: text("supplier_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  country: text("country"),
  specializations: text("specializations"), // JSON string[]
  pricingScore: integer("pricing_score").default(3),       // 1–5
  deliveryScore: integer("delivery_score").default(3),     // 1–5
  reliabilityScore: integer("reliability_score").default(3), // 1–5
  qualityScore: integer("quality_score").default(3),       // 1–5
  installationScore: integer("installation_score").default(3), // 1–5
  responsivenessScore: integer("responsiveness_score").default(3), // 1–5
  overallScore: integer("overall_score"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertSupplierProfileSchema = createInsertSchema(supplierProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplierProfile = z.infer<typeof insertSupplierProfileSchema>;
export type SupplierProfile = typeof supplierProfiles.$inferSelect;

// ─── RFQ Projects ─────────────────────────────────────────────────────────────

export const rfqProjects = pgTable("rfq_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectName: text("project_name").notNull(),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  clientEmail: text("client_email"),
  city: text("city"),
  headcount: integer("headcount"),
  officeSizeSqm: integer("office_size_sqm"),
  budget: text("budget"),
  timeline: text("timeline"),
  status: text("status").notNull().default("draft"), // draft | sent | responding | awarded | complete
  furnitureJson: text("furniture_json"),         // JSON: [{category, quantity, notes}]
  recommendationsJson: text("recommendations_json"), // JSON: [{supplier, categories, reason}]
  linkedLeadId: varchar("linked_lead_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertRfqProjectSchema = createInsertSchema(rfqProjects).omit({ id: true, createdAt: true });
export type InsertRfqProject = z.infer<typeof insertRfqProjectSchema>;
export type RfqProject = typeof rfqProjects.$inferSelect;

// ─── RFQ Responses ────────────────────────────────────────────────────────────

export const rfqResponses = pgTable("rfq_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfqProjectId: varchar("rfq_project_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  category: text("category").notNull(),
  quotedUnitPrice: text("quoted_unit_price"),
  quotedTotalPrice: text("quoted_total_price"),
  deliveryWeeks: text("delivery_weeks"),
  availability: text("availability"),
  alternatives: text("alternatives"),
  notes: text("notes"),
  status: text("status").notNull().default("received"), // received | accepted | rejected
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertRfqResponseSchema = createInsertSchema(rfqResponses).omit({ id: true, createdAt: true });
export type InsertRfqResponse = z.infer<typeof insertRfqResponseSchema>;
export type RfqResponse = typeof rfqResponses.$inferSelect;

// ─── Visitor Sessions ─────────────────────────────────────────────────────────
export const visitorSessions = pgTable("visitor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: text("visitor_id").notNull(),           // anonymous cookie-based ID
  ipAddress: text("ip_address"),
  country: text("country"),
  city: text("city"),
  region: text("region"),
  companyName: text("company_name"),                 // from IP org enrichment
  companyDomain: text("company_domain"),
  isp: text("isp"),                                  // ISP / org from IP lookup
  industry: text("industry"),
  deviceType: text("device_type"),
  browser: text("browser"),
  pagesViewed: text("pages_viewed").array().notNull().default(sql`'{}'`),
  sessionDurationSeconds: integer("session_duration_seconds").default(0),
  engagementScore: integer("engagement_score").notNull().default(0),
  intent: text("intent"),                            // workspace_planning|office_relocation|furniture_purchase|fitout_project|general_enquiry
  estimatedProjectValue: integer("estimated_project_value"),
  confidenceScore: integer("confidence_score").default(0),
  pushedToPipeline: boolean("pushed_to_pipeline").default(false),
  isBot: boolean("is_bot").default(false),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertVisitorSessionSchema = createInsertSchema(visitorSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVisitorSession = z.infer<typeof insertVisitorSessionSchema>;
export type VisitorSession = typeof visitorSessions.$inferSelect;

// ─── Company Intelligence Profiles ───────────────────────────────────────────
export const companyIntelligence = pgTable("company_intelligence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  domain: text("domain"),
  country: text("country").notNull().default("Australia"),
  city: text("city").notNull(),
  state: text("state"),
  industry: text("industry"),
  employeeEstimate: text("employee_estimate"),
  estimatedOfficeSizeSqm: text("estimated_office_size_sqm"),
  estimatedProjectValue: text("estimated_project_value"),
  growthRateEstimate: text("growth_rate_estimate"),
  radarSignalCount: integer("radar_signal_count").notNull().default(0),
  visitorSessions: integer("visitor_sessions").notNull().default(0),
  engagementScore: integer("engagement_score").notNull().default(0),
  moveProbability: integer("move_probability").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  priorityLevel: text("priority_level").notNull().default("low"), // urgent|high|medium|low
  signalTypesJson: text("signal_types_json"), // JSON string[]
  signalTimelineJson: text("signal_timeline_json"), // JSON [{type, date, source}]
  latestSignalDate: timestamp("latest_signal_date"),
  reasoningSummary: text("reasoning_summary"),
  notes: text("notes"),
  linkedRadarIds: text("linked_radar_ids"), // JSON string[] of radar record IDs
  status: text("status").notNull().default("active"), // active|archived|converted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertCompanyIntelligenceSchema = createInsertSchema(companyIntelligence).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyIntelligence = z.infer<typeof insertCompanyIntelligenceSchema>;
export type CompanyIntelligence = typeof companyIntelligence.$inferSelect;

// ─── Company Contacts (Org-Chart + Contact Discovery) ────────────────────────
export const companyContacts = pgTable("company_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyIntelligenceId: varchar("company_intelligence_id").notNull(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull(), // Head of Workplace | Facilities Manager | etc.
  department: text("department"),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  confidenceScore: integer("confidence_score").notNull().default(50),
  verificationStatus: text("verification_status").notNull().default("unverified"), // verified|high_confidence|medium_confidence|generic_fallback|unverified|blocked
  isPrimary: boolean("is_primary").notNull().default(false),
  contactSource: text("contact_source").notNull().default("inferred"), // inferred|linkedin|directory|ai_generated
  contactType: text("contact_type").notNull().default("direct"), // direct|generic_fallback|forward_request
  isBlocked: boolean("is_blocked").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxContactCompany: index("idx_contact_company_intel").on(t.companyIntelligenceId),
  idxContactEmail: index("idx_contact_email").on(t.email),
  idxContactVerification: index("idx_contact_verification").on(t.verificationStatus),
}));
export const insertCompanyContactSchema = createInsertSchema(companyContacts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyContact = z.infer<typeof insertCompanyContactSchema>;
export type CompanyContact = typeof companyContacts.$inferSelect;

// ─── Intelligence Sources ─────────────────────────────────────────────────────
export const intelligenceSources = pgTable("intelligence_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // rss|job_board|property_feed|sublease|funding|visitor_intent
  url: text("url"),
  region: text("region").notNull().default("Australia"),
  isActive: boolean("is_active").notNull().default(true),
  lastFetchedAt: timestamp("last_fetched_at"),
  fetchIntervalMinutes: integer("fetch_interval_minutes").notNull().default(720),
  totalSignalsIngested: integer("total_signals_ingested").notNull().default(0),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  config: text("config"), // JSON blob of connector config
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxSourceType: index("idx_source_type").on(t.type),
  idxSourceActive: index("idx_source_active").on(t.isActive),
}));
export const insertIntelligenceSourceSchema = createInsertSchema(intelligenceSources).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntelligenceSource = z.infer<typeof insertIntelligenceSourceSchema>;
export type IntelligenceSource = typeof intelligenceSources.$inferSelect;

// ─── Raw Signals ──────────────────────────────────────────────────────────────
export const rawSignals = pgTable("raw_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id"),
  sourceType: text("source_type").notNull(), // rss|job_board|property_feed|manual
  rawContent: text("raw_content").notNull(),
  url: text("url"),
  publishedAt: timestamp("published_at"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  isProcessed: boolean("is_processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  contentHash: text("content_hash"), // SHA256 for dedupe
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxRawSignalHash: uniqueIndex("idx_raw_signal_hash").on(t.contentHash),
  idxRawSignalProcessed: index("idx_raw_signal_processed").on(t.isProcessed),
  idxRawSignalFetched: index("idx_raw_signal_fetched").on(t.fetchedAt),
}));
export const insertRawSignalSchema = createInsertSchema(rawSignals).omit({ id: true, createdAt: true });
export type InsertRawSignal = z.infer<typeof insertRawSignalSchema>;
export type RawSignal = typeof rawSignals.$inferSelect;

// ─── Intelligence Signals ─────────────────────────────────────────────────────
export const intelligenceSignals = pgTable("intelligence_signals", {
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
  commercialTier: text("commercial_tier").default("mid"), // premium|upper|mid|entry
  classification: text("classification"), // office_move|expansion|sublease|new_market|consolidation
  evidenceSummary: text("evidence_summary"),
  linkedRadarId: varchar("linked_radar_id"),
  linkedDealHunterId: varchar("linked_deal_hunter_id"),
  status: text("status").notNull().default("active"), // active|archived|converted|dismissed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxIntelSigCompany: index("idx_intel_sig_company").on(t.normalizedCompanyName),
  idxIntelSigCity: index("idx_intel_sig_city").on(t.normalizedCity),
  idxIntelSigType: index("idx_intel_sig_type").on(t.signalType),
  idxIntelSigStatus: index("idx_intel_sig_status").on(t.status),
  idxIntelSigDedupe: uniqueIndex("idx_intel_sig_dedupe").on(t.normalizedCompanyName, t.normalizedCity, t.signalType, t.signalWindowBucket),
}));
export const insertIntelligenceSignalSchema = createInsertSchema(intelligenceSignals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntelligenceSignal = z.infer<typeof insertIntelligenceSignalSchema>;
export type IntelligenceSignal = typeof intelligenceSignals.$inferSelect;

// ─── Signal Evidence ──────────────────────────────────────────────────────────
export const signalEvidence = pgTable("signal_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intelligenceSignalId: varchar("intelligence_signal_id").notNull(),
  evidenceType: text("evidence_type").notNull(), // job_posting|news_article|property_listing|funding_announcement|visitor_session
  title: text("title"),
  url: text("url"),
  excerpt: text("excerpt"),
  publishedAt: timestamp("published_at"),
  confidenceContribution: real("confidence_contribution").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxEvidenceSignal: index("idx_evidence_signal").on(t.intelligenceSignalId),
}));
export const insertSignalEvidenceSchema = createInsertSchema(signalEvidence).omit({ id: true, createdAt: true });
export type InsertSignalEvidence = z.infer<typeof insertSignalEvidenceSchema>;
export type SignalEvidence = typeof signalEvidence.$inferSelect;

// ─── Company Building Edges ───────────────────────────────────────────────────
export const companyBuildingEdges = pgTable("company_building_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  normalizedCompanyName: text("normalized_company_name").notNull(),
  buildingName: text("building_name"),
  buildingAddress: text("building_address"),
  suburb: text("suburb"),
  city: text("city").notNull(),
  state: text("state"),
  relationshipType: text("relationship_type").notNull(), // current_tenant|former_tenant|prospect|shortlisted
  confidenceScore: real("confidence_score").notNull().default(50),
  evidenceSource: text("evidence_source"),
  detectedAt: timestamp("detected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxEdgeCompany: index("idx_edge_company").on(t.normalizedCompanyName),
  idxEdgeCity: index("idx_edge_city").on(t.city),
}));
export const insertCompanyBuildingEdgeSchema = createInsertSchema(companyBuildingEdges).omit({ id: true, createdAt: true });
export type InsertCompanyBuildingEdge = z.infer<typeof insertCompanyBuildingEdgeSchema>;
export type CompanyBuildingEdge = typeof companyBuildingEdges.$inferSelect;

// ─── Company Zone Scores ──────────────────────────────────────────────────────
export const companyZoneScores = pgTable("company_zone_scores", {
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
}, (t) => ({
  idxZoneCompany: index("idx_zone_company").on(t.normalizedCompanyName),
  idxZoneSuburb: index("idx_zone_suburb").on(t.suburb, t.city),
}));
export const insertCompanyZoneScoreSchema = createInsertSchema(companyZoneScores).omit({ id: true, createdAt: true });
export type InsertCompanyZoneScore = z.infer<typeof insertCompanyZoneScoreSchema>;
export type CompanyZoneScore = typeof companyZoneScores.$inferSelect;

// ─── Building Risk Snapshots ──────────────────────────────────────────────────
export const buildingRiskSnapshots = pgTable("building_risk_snapshots", {
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
  riskTier: text("risk_tier").notNull().default("low"), // critical|high|medium|low
  snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxBuildingRiskCity: index("idx_building_risk_city").on(t.city),
  idxBuildingRiskDate: index("idx_building_risk_date").on(t.snapshotDate),
  idxBuildingRiskTier: index("idx_building_risk_tier").on(t.riskTier),
}));
export const insertBuildingRiskSnapshotSchema = createInsertSchema(buildingRiskSnapshots).omit({ id: true, createdAt: true });
export type InsertBuildingRiskSnapshot = z.infer<typeof insertBuildingRiskSnapshotSchema>;
export type BuildingRiskSnapshot = typeof buildingRiskSnapshots.$inferSelect;

// ─── Suburb Demand Snapshots ──────────────────────────────────────────────────
export const suburbDemandSnapshots = pgTable("suburb_demand_snapshots", {
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
  demandTier: text("demand_tier").notNull().default("low"), // hot|high|medium|low
  snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxSuburbDemandCity: index("idx_suburb_demand_city").on(t.city),
  idxSuburbDemandDate: index("idx_suburb_demand_date").on(t.snapshotDate),
  idxSuburbDemandTier: index("idx_suburb_demand_tier").on(t.demandTier),
}));
export const insertSuburbDemandSnapshotSchema = createInsertSchema(suburbDemandSnapshots).omit({ id: true, createdAt: true });
export type InsertSuburbDemandSnapshot = z.infer<typeof insertSuburbDemandSnapshotSchema>;
export type SuburbDemandSnapshot = typeof suburbDemandSnapshots.$inferSelect;

// ─── UPGRADE 1: Tenant Lease Expiry Engine ────────────────────────────────────

export const leaseRecords = pgTable("lease_records", {
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
  leaseStatus: text("lease_status").notNull().default("active"), // active|expired|unknown|expiring_soon
  dataSource: text("data_source").notNull().default("inferred"), // property_feed|manual|inferred|news
  confidenceScore: integer("confidence_score").notNull().default(50),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxLeaseCompany: index("idx_lease_company_name").on(t.companyName),
  idxLeaseCity: index("idx_lease_city").on(t.city),
  idxLeaseExpiry: index("idx_lease_expiry_date").on(t.leaseExpiryDate),
  idxLeaseStatus: index("idx_lease_status").on(t.leaseStatus),
}));
export const insertLeaseRecordSchema = createInsertSchema(leaseRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLeaseRecord = z.infer<typeof insertLeaseRecordSchema>;
export type LeaseRecord = typeof leaseRecords.$inferSelect;

export const leaseExpiryPredictions = pgTable("lease_expiry_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseRecordId: varchar("lease_record_id"),
  companyName: text("company_name").notNull(),
  city: text("city").notNull(),
  predictedExpiryYear: integer("predicted_expiry_year"),
  predictedExpiryQuarter: text("predicted_expiry_quarter"), // Q1|Q2|Q3|Q4
  relocationProbability: integer("relocation_probability").notNull().default(50),
  opportunityScore: integer("opportunity_score").notNull().default(50),
  urgencyTier: text("urgency_tier").notNull().default("medium"), // critical|high|medium|low
  estimatedProjectValue: integer("estimated_project_value"),
  signalCount: integer("signal_count").notNull().default(0),
  reasoningSummary: text("reasoning_summary"),
  linkedRadarId: varchar("linked_radar_id"),
  status: text("status").notNull().default("open"), // open|contacted|won|lost|archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxLeaseExpiryCompany: index("idx_lease_expiry_company").on(t.companyName),
  idxLeaseExpiryCity: index("idx_lease_expiry_city").on(t.city),
  idxLeaseExpiryUrgency: index("idx_lease_expiry_urgency").on(t.urgencyTier),
}));
export const insertLeaseExpiryPredictionSchema = createInsertSchema(leaseExpiryPredictions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLeaseExpiryPrediction = z.infer<typeof insertLeaseExpiryPredictionSchema>;
export type LeaseExpiryPrediction = typeof leaseExpiryPredictions.$inferSelect;

// ─── UPGRADE 2: Company Hierarchy System ─────────────────────────────────────

export const companyHierarchyNodes = pgTable("company_hierarchy_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  normalizedName: text("normalized_name").notNull(), // lowercase, trimmed, for dedup
  companyIntelligenceId: varchar("company_intelligence_id"),
  parentId: varchar("parent_id"), // self-referential
  nodeType: text("node_type").notNull().default("standalone"), // parent|subsidiary|branch|standalone
  industry: text("industry"),
  city: text("city"),
  state: text("state"),
  country: text("country").notNull().default("Australia"),
  employeeEstimate: integer("employee_estimate"),
  aggregatedSignalCount: integer("aggregated_signal_count").notNull().default(0),
  aggregatedConfidenceScore: integer("aggregated_confidence_score").notNull().default(0),
  aggregatedOpportunityValue: integer("aggregated_opportunity_value").notNull().default(0),
  dataSource: text("data_source").notNull().default("inferred"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxHierarchyNormalized: uniqueIndex("idx_hierarchy_normalized_name").on(t.normalizedName),
  idxHierarchyParent: index("idx_hierarchy_parent_id").on(t.parentId),
  idxHierarchyType: index("idx_hierarchy_node_type").on(t.nodeType),
}));
export const insertCompanyHierarchyNodeSchema = createInsertSchema(companyHierarchyNodes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyHierarchyNode = z.infer<typeof insertCompanyHierarchyNodeSchema>;
export type CompanyHierarchyNode = typeof companyHierarchyNodes.$inferSelect;

export const companyRelationships = pgTable("company_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEntityType: text("from_entity_type").notNull(), // company|building|suburb
  fromEntityId: varchar("from_entity_id").notNull(),
  fromEntityName: text("from_entity_name").notNull(),
  toEntityType: text("to_entity_type").notNull(), // company|building|suburb|zone
  toEntityId: varchar("to_entity_id").notNull(),
  toEntityName: text("to_entity_name").notNull(),
  relationshipType: text("relationship_type").notNull(), // subsidiary_of|located_in|competes_with|merged_with|acquired
  strength: integer("strength").notNull().default(50), // 0–100
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxRelFrom: index("idx_rel_from_entity").on(t.fromEntityId),
  idxRelTo: index("idx_rel_to_entity").on(t.toEntityId),
  idxRelType: index("idx_rel_type").on(t.relationshipType),
}));
export const insertCompanyRelationshipSchema = createInsertSchema(companyRelationships).omit({ id: true, createdAt: true });
export type InsertCompanyRelationship = z.infer<typeof insertCompanyRelationshipSchema>;
export type CompanyRelationship = typeof companyRelationships.$inferSelect;

// ─── UPGRADE 5: Global Intelligence Graph ────────────────────────────────────

export const intelligenceGraphEdges = pgTable("intelligence_graph_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(), // company|building|suburb|zone|signal
  sourceId: varchar("source_id").notNull(),
  sourceName: text("source_name").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  targetName: text("target_name").notNull(),
  edgeType: text("edge_type").notNull(), // located_in|generates_signal|in_suburb|in_zone|subsidiary_of|competes_with
  weight: real("weight").notNull().default(1.0),
  metadata: text("metadata"), // JSON string
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxGraphSource: index("idx_graph_source").on(t.sourceId, t.sourceType),
  idxGraphTarget: index("idx_graph_target").on(t.targetId, t.targetType),
  idxGraphEdgeType: index("idx_graph_edge_type").on(t.edgeType),
}));
export const insertIntelligenceGraphEdgeSchema = createInsertSchema(intelligenceGraphEdges).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntelligenceGraphEdge = z.infer<typeof insertIntelligenceGraphEdgeSchema>;
export type IntelligenceGraphEdge = typeof intelligenceGraphEdges.$inferSelect;

// ─── OUTREACH ENGINE: Contact Discovery ──────────────────────────────────────

export const contactDiscoveryRuns = pgTable("contact_discovery_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  companyName: text("company_name").notNull(),
  opportunityId: varchar("opportunity_id"),
  runStatus: text("run_status").notNull().default("pending"), // pending|running|completed|failed
  contactsFound: integer("contacts_found").notNull().default(0),
  fallbackContactsCreated: integer("fallback_contacts_created").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
}, (t) => ({
  idxDiscoveryCompany: index("idx_discovery_company_id").on(t.companyId),
  idxDiscoveryStatus: index("idx_discovery_run_status").on(t.runStatus),
}));
export const insertContactDiscoveryRunSchema = createInsertSchema(contactDiscoveryRuns).omit({ id: true, startedAt: true });
export type InsertContactDiscoveryRun = z.infer<typeof insertContactDiscoveryRunSchema>;
export type ContactDiscoveryRun = typeof contactDiscoveryRuns.$inferSelect;

export const contactVerificationLogs = pgTable("contact_verification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  checkType: text("check_type").notNull(), // email_format|domain_check|ai_confidence|linkedin_check
  result: text("result").notNull(), // passed|failed|warning
  detailsJson: text("details_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxVerifContact: index("idx_verif_contact_id").on(t.contactId),
}));
export const insertContactVerificationLogSchema = createInsertSchema(contactVerificationLogs).omit({ id: true, createdAt: true });
export type InsertContactVerificationLog = z.infer<typeof insertContactVerificationLogSchema>;
export type ContactVerificationLog = typeof contactVerificationLogs.$inferSelect;

// ─── OUTREACH ENGINE: Threads, Messages, Sequences, Events ───────────────────

export const outreachThreads = pgTable("outreach_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  companyName: text("company_name").notNull(),
  contactId: varchar("contact_id"),
  opportunityId: varchar("opportunity_id"),
  status: text("status").notNull().default("pending"), // pending|active|paused|stopped|completed|replied|booked
  channel: text("channel").notNull().default("email"), // email|linkedin_task|call_task
  currentStage: integer("current_stage").notNull().default(0), // 0=intro, 1=followup1, 2=followup2, 3=final
  outreachAngle: text("outreach_angle"), // lease_timing|move_planning|market_development
  opportunityScore: integer("opportunity_score"),
  relocationProbability: integer("relocation_probability"),
  stopReason: text("stop_reason"),
  bookingLink: text("booking_link"),
  bookingStatus: text("booking_status").notNull().default("not_created"), // not_created|link_created|clicked|booked
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxThreadCompany: index("idx_thread_company_id").on(t.companyId),
  idxThreadStatus: index("idx_thread_status").on(t.status),
  idxThreadContact: index("idx_thread_contact_id").on(t.contactId),
}));
export const insertOutreachThreadSchema = createInsertSchema(outreachThreads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOutreachThread = z.infer<typeof insertOutreachThreadSchema>;
export type OutreachThread = typeof outreachThreads.$inferSelect;

export const outreachMessages = pgTable("outreach_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull(),
  direction: text("direction").notNull().default("outbound"), // outbound|inbound
  channel: text("channel").notNull().default("email"),
  subject: text("subject"),
  body: text("body").notNull(),
  stage: integer("stage").notNull().default(0),
  messageType: text("message_type").notNull().default("intro"), // intro|followup|final|forward_request|reply
  deliveryStatus: text("delivery_status").notNull().default("draft"), // draft|approved|queued|sent|failed|bounced
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxMsgThread: index("idx_msg_thread_id").on(t.threadId),
  idxMsgStatus: index("idx_msg_delivery_status").on(t.deliveryStatus),
}));
export const insertOutreachMessageSchema = createInsertSchema(outreachMessages).omit({ id: true, createdAt: true });
export type InsertOutreachMessage = z.infer<typeof insertOutreachMessageSchema>;
export type OutreachMessage = typeof outreachMessages.$inferSelect;

export const outreachSequences = pgTable("outreach_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull(),
  sequenceType: text("sequence_type").notNull().default("standard"), // standard|lease_expiry|tenant_movement
  stage: integer("stage").notNull().default(0),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  status: text("status").notNull().default("scheduled"), // scheduled|sent|skipped|stopped|failed
  stopReason: text("stop_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxSeqThread: index("idx_seq_thread_id").on(t.threadId),
  idxSeqScheduled: index("idx_seq_scheduled_for").on(t.scheduledFor),
  idxSeqStatus: index("idx_seq_status").on(t.status),
}));
export const insertOutreachSequenceSchema = createInsertSchema(outreachSequences).omit({ id: true, createdAt: true });
export type InsertOutreachSequence = z.infer<typeof insertOutreachSequenceSchema>;
export type OutreachSequence = typeof outreachSequences.$inferSelect;

export const outreachEvents = pgTable("outreach_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull(),
  eventType: text("event_type").notNull(), // created|approved|sent|opened|replied|booking_clicked|meeting_booked|paused|stopped|failed
  payloadJson: text("payload_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxEventThread: index("idx_event_thread_id").on(t.threadId),
  idxEventType: index("idx_event_type").on(t.eventType),
}));
export const insertOutreachEventSchema = createInsertSchema(outreachEvents).omit({ id: true, createdAt: true });
export type InsertOutreachEvent = z.infer<typeof insertOutreachEventSchema>;
export type OutreachEvent = typeof outreachEvents.$inferSelect;

// ─── OUTREACH ENGINE: Meeting Booking ─────────────────────────────────────────

export const meetingBookingEvents = pgTable("meeting_booking_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  companyName: text("company_name").notNull(),
  contactId: varchar("contact_id"),
  opportunityId: varchar("opportunity_id"),
  threadId: varchar("thread_id"),
  bookingProvider: text("booking_provider").notNull().default("manual"), // google|calendly|manual
  bookingStatus: text("booking_status").notNull().default("pending"), // pending|link_created|clicked|confirmed|cancelled|failed
  bookingLink: text("booking_link"),
  meetingTime: timestamp("meeting_time"),
  meetingTitle: text("meeting_title"),
  meetingNotes: text("meeting_notes"),
  calendarEventId: text("calendar_event_id"),
  isSandbox: boolean("is_sandbox").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxBookingCompany: index("idx_booking_company_id").on(t.companyId),
  idxBookingStatus: index("idx_booking_status").on(t.bookingStatus),
  idxBookingThread: index("idx_booking_thread_id").on(t.threadId),
}));
export const insertMeetingBookingEventSchema = createInsertSchema(meetingBookingEvents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeetingBookingEvent = z.infer<typeof insertMeetingBookingEventSchema>;
export type MeetingBookingEvent = typeof meetingBookingEvents.$inferSelect;

// ─── STRIPE REVENUE ENGINE ────────────────────────────────────────────────────

export const paymentCustomers = pgTable("payment_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  contactId: varchar("contact_id"),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxPayCustStripe: uniqueIndex("idx_pay_cust_stripe_id").on(t.stripeCustomerId),
  idxPayCustEmail: index("idx_pay_cust_email").on(t.email),
}));
export const insertPaymentCustomerSchema = createInsertSchema(paymentCustomers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentCustomer = z.infer<typeof insertPaymentCustomerSchema>;
export type PaymentCustomer = typeof paymentCustomers.$inferSelect;

export const paymentLinks = pgTable("payment_links", {
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxPayLinkQuote: index("idx_pay_link_quote_id").on(t.quoteId),
  idxPayLinkStatus: index("idx_pay_link_status").on(t.status),
}));
export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;
export type PaymentLink = typeof paymentLinks.$inferSelect;

export const paymentIntentsLog = pgTable("payment_intents_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id"),
  opportunityId: varchar("opportunity_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("aud"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  rawPayloadJson: text("raw_payload_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxPayIntentStripe: index("idx_pay_intent_stripe_id").on(t.stripePaymentIntentId),
  idxPayIntentQuote: index("idx_pay_intent_quote_id").on(t.quoteId),
}));
export const insertPaymentIntentLogSchema = createInsertSchema(paymentIntentsLog).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentIntentLog = z.infer<typeof insertPaymentIntentLogSchema>;
export type PaymentIntentLog = typeof paymentIntentsLog.$inferSelect;

export const invoicesLog = pgTable("invoices_log", {
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxInvoiceStripe: index("idx_invoice_stripe_id").on(t.stripeInvoiceId),
  idxInvoiceQuote: index("idx_invoice_quote_id").on(t.quoteId),
}));
export const insertInvoiceLogSchema = createInsertSchema(invoicesLog).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoiceLog = z.infer<typeof insertInvoiceLogSchema>;
export type InvoiceLog = typeof invoicesLog.$inferSelect;

export const revenueEvents = pgTable("revenue_events", {
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
}, (t) => ({
  idxRevEventType: index("idx_rev_event_type").on(t.eventType),
  idxRevEventOccurred: index("idx_rev_event_occurred").on(t.occurredAt),
  idxRevEventCompany: index("idx_rev_event_company").on(t.companyId),
}));
export const insertRevenueEventSchema = createInsertSchema(revenueEvents).omit({ id: true, createdAt: true });
export type InsertRevenueEvent = z.infer<typeof insertRevenueEventSchema>;
export type RevenueEvent = typeof revenueEvents.$inferSelect;

export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("stripe"),
  externalEventId: text("external_event_id").notNull(),
  eventType: text("event_type").notNull(),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  payloadJson: text("payload_json"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxWebhookExtId: uniqueIndex("idx_webhook_ext_id").on(t.provider, t.externalEventId),
  idxWebhookProcessed: index("idx_webhook_processed").on(t.processed),
}));
export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ id: true, createdAt: true });
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorType: text("actor_type").notNull().default("system"),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadataJson: text("metadata_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxAuditAction: index("idx_audit_action").on(t.action),
  idxAuditEntity: index("idx_audit_entity").on(t.entityType, t.entityId),
  idxAuditCreated: index("idx_audit_created").on(t.createdAt),
}));
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ─── DEAL CLOSING SYSTEM ──────────────────────────────────────────────────────

export const proposals = pgTable("proposals", {
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
  contentJson: text("content_json"),
  status: text("status").notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxProposalQuote: index("idx_proposal_quote_id").on(t.quoteId),
  idxProposalStatus: index("idx_proposal_status").on(t.status),
}));
export const insertProposalSchema = createInsertSchema(proposals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export const approvals = pgTable("approvals", {
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxApprovalStatus: index("idx_approval_status").on(t.status),
  idxApprovalQuote: index("idx_approval_quote_id").on(t.quoteId),
}));
export const insertApprovalSchema = createInsertSchema(approvals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxCommissionPartner: index("idx_commission_partner_id").on(t.partnerId),
  idxCommissionStatus: index("idx_commission_status").on(t.status),
}));
export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

// ─── BUILDING + TENANT DATABASE ───────────────────────────────────────────────

export const buildings = pgTable("buildings", {
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxBuildingCity: index("idx_building_city").on(t.city),
  idxBuildingSuburb: index("idx_building_suburb").on(t.suburb),
}));
export const insertBuildingSchema = createInsertSchema(buildings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildings.$inferSelect;

export const tenants = pgTable("tenants", {
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxTenantBuilding: index("idx_tenant_building_id").on(t.buildingId),
  idxTenantCompany: index("idx_tenant_company_id").on(t.companyId),
}));
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

export const leases = pgTable("leases", {
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  idxNewLeaseTenant: index("idx_new_lease_tenant_id").on(t.tenantId),
  idxNewLeaseBuilding: index("idx_new_lease_building_id").on(t.buildingId),
  idxNewLeaseExpiry: index("idx_new_lease_expiry_date").on(t.expiryDate),
}));
export const insertLeaseSchema = createInsertSchema(leases).omit({ id: true, createdAt: true, updatedAt: true });
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
export const insertBuildingSuburbEdgeSchema = createInsertSchema(buildingSuburbEdges).omit({ id: true });
export type InsertBuildingSuburbEdge = z.infer<typeof insertBuildingSuburbEdgeSchema>;
export type BuildingSuburbEdge = typeof buildingSuburbEdges.$inferSelect;

// ── Deal Execution (Stage 6 — Alex Deal Tracking) ────────────────────────────
export const dealExecution = pgTable("deal_execution", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertDealExecutionSchema = createInsertSchema(dealExecution).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDealExecution = z.infer<typeof insertDealExecutionSchema>;
export type DealExecution = typeof dealExecution.$inferSelect;

// ── Alex Actions Log (Stage 10 — Action Logging) ─────────────────────────────
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
export const insertAlexActionSchema = createInsertSchema(alexActions).omit({ id: true, createdAt: true });
export type InsertAlexAction = z.infer<typeof insertAlexActionSchema>;
export type AlexAction = typeof alexActions.$inferSelect;

// ── Intelligence Clusters (Stage 1.5 — Cluster Engine) ───────────────────────
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertClusterSchema = createInsertSchema(clusters).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCluster = z.infer<typeof insertClusterSchema>;
export type Cluster = typeof clusters.$inferSelect;
