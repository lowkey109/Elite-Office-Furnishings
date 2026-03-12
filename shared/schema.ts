import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
