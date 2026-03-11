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
  website: text("website"),
  location: text("location").notNull(),
  industry: text("industry").notNull(),
  estimatedTeamSize: text("estimated_team_size").notNull(),
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
});

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
  status: text("status").notNull().default("New"),
  source: text("source").default("upload-floor-plan"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PlanningRequest = typeof planningRequests.$inferSelect;
