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
