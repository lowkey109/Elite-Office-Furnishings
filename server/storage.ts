import { eq, desc, or, ilike, and, sql as drizzleSql } from "drizzle-orm";
import { db } from "./db";
import {
  users, leads, prospectedLeads, supplierQuotes, referrals, planningRequests, productReviews,
  manufacturerMessages, followUpSequences, territories, workspaceLearningRecords,
  scheduledJobs, intelligenceReports, spendingTrends, websiteIssues, profitRecords,
  generatedBlogArticles, quotes, officeMovRadar, buildingSignals,
  type User, type InsertUser, type Lead, type InsertLead, type PlanningRequest,
  type ProductReview, type InsertProductReview,
  type ManufacturerMessage, type InsertManufacturerMessage,
  type FollowUpSequence, type InsertFollowUpSequence,
  type Territory, type InsertTerritory,
  type WorkspaceLearning, type InsertWorkspaceLearning,
  type ScheduledJob, type IntelligenceReport, type SpendingTrend,
  type WebsiteIssue, type ProfitRecord, type InsertProfitRecord,
  type GeneratedBlogArticle, type Quote, type InsertQuote,
  type OfficeMovRadar, type InsertOfficeMovRadar,
  type BuildingSignal, type InsertBuildingSignal,
} from "@shared/schema";

export interface ProspectedLead {
  id: string;
  company: string;
  domain: string | null;
  website: string | null;
  location: string;
  industry: string;
  estimatedTeamSize: string;
  likelyOfficeNeed: string | null;
  signalsDetected: string[];
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  decisionMakers: string;
  outreachMessage: string;
  reasoning: string;
  rawInput: string;
  status: "New" | "Contacted" | "Responded" | "Qualified" | "Closed" | "Lead Detected" | "Planning" | "Quoted" | "Negotiation" | "Won" | "Lost";
  sourceType: string | null;
  sourceUrl: string | null;
  createdAt: Date;
  // Extended intelligence fields
  signalType: string | null;
  city: string | null;
  contactEmail: string | null;
  contactRole: string | null;
  dealProbability: number | null;
  estimatedOfficeSqm: string | null;
  estimatedHeadcount: string | null;
  recommendedNextAction: string | null;
  outreachSubject: string | null;
  scanBatchId: string | null;
}

export interface SupplierQuote {
  id: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  productName: string;
  sku: string;
  quantity: number;
  colourFinish?: string;
  unitPrice: string;
  freightCost?: string;
  leadTime?: string;
  quoteDate: string;
  projectReference?: string;
  status: "Requested" | "Received" | "Approved" | "Ordered" | "Shipped" | "Delivered";
  notes?: string;
  createdAt: Date;
}

export interface InsertSupplierQuote {
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  productName: string;
  sku: string;
  quantity: number;
  colourFinish?: string;
  unitPrice: string;
  freightCost?: string;
  leadTime?: string;
  quoteDate: string;
  projectReference?: string;
  status?: SupplierQuote["status"];
  notes?: string;
}

export interface Referral {
  id: string;
  referrerName: string;
  company?: string;
  contactEmail?: string;
  contactPhone?: string;
  leadSource: "Real Estate Agent" | "Architect" | "Interior Designer" | "Project Manager" | "Builder" | "Workplace Consultant" | "Other";
  clientName?: string;
  clientCompany?: string;
  estimatedValue?: string;
  notes?: string;
  status: "New" | "Contacted" | "Qualified" | "Won" | "Lost";
  createdAt: Date;
}

export interface InsertReferral {
  referrerName: string;
  company?: string;
  contactEmail?: string;
  contactPhone?: string;
  leadSource: Referral["leadSource"];
  clientName?: string;
  clientCompany?: string;
  estimatedValue?: string;
  notes?: string;
}

export interface InsertPlanningRequest {
  name: string;
  company: string;
  email: string;
  phone: string;
  city?: string;
  projectType?: string;
  squareMetres?: string;
  staffCount?: string;
  meetingRooms?: string;
  receptionRequired?: boolean;
  breakoutRequired?: boolean;
  executiveOfficeRequired?: boolean;
  budgetRange?: string;
  stylePreference?: string;
  specialRequirements?: string;
  uploadedFilesJson?: string;
  aiSummary?: string;
  aiRecommendations?: string;
  leadScore?: number;
  estimatedValue?: string;
  implementationTimeline?: string;
  source?: string;
  packageJson?: string;
  quoteJson?: string;
  quoteStatus?: string;
  floorGeometryJson?: string;
  geometrySource?: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  createProspectedLead(data: Omit<ProspectedLead, "id" | "createdAt" | "status">): Promise<ProspectedLead>;
  getProspectedLeads(): Promise<ProspectedLead[]>;
  findProspectDuplicate(company: string, domain: string | null, sourceUrl: string | null): Promise<ProspectedLead | null>;
  updateProspectedLeadStatus(id: string, status: ProspectedLead["status"]): Promise<ProspectedLead | undefined>;
  deleteProspectedLead(id: string): Promise<void>;
  createSupplierQuote(data: InsertSupplierQuote): Promise<SupplierQuote>;
  getSupplierQuotes(): Promise<SupplierQuote[]>;
  updateSupplierQuoteStatus(id: string, status: SupplierQuote["status"]): Promise<SupplierQuote | undefined>;
  updateSupplierQuote(id: string, data: Partial<InsertSupplierQuote>): Promise<SupplierQuote | undefined>;
  deleteSupplierQuote(id: string): Promise<void>;
  createReferral(data: InsertReferral): Promise<Referral>;
  getReferrals(): Promise<Referral[]>;
  updateReferralStatus(id: string, status: Referral["status"]): Promise<Referral | undefined>;
  deleteReferral(id: string): Promise<void>;
  createPlanningRequest(data: InsertPlanningRequest): Promise<PlanningRequest>;
  getPlanningRequests(): Promise<PlanningRequest[]>;
  getPlanningRequest(id: string): Promise<PlanningRequest | undefined>;
  updatePlanningRequestStatus(id: string, status: string): Promise<PlanningRequest | undefined>;
  updatePlanningRequest(id: string, data: Partial<InsertPlanningRequest & { status?: string; adminNotes?: string }>): Promise<PlanningRequest | undefined>;
  deletePlanningRequest(id: string): Promise<void>;
  markPlanningRequestPaid(id: string, sessionId: string): Promise<PlanningRequest | undefined>;
  updateFloorGeometry(id: string, floorGeometryJson: string, geometrySource: string): Promise<PlanningRequest | undefined>;
  updateLeadScore(id: string, data: { opportunityScore: number; opportunityTier: string; signalsJson: string; nextAction: string; estimatedValueRange: string }): Promise<void>;

  // Scheduled Jobs
  createScheduledJob(data: Omit<ScheduledJob, "id" | "createdAt">): Promise<ScheduledJob>;
  getScheduledJobs(limit?: number): Promise<ScheduledJob[]>;
  updateScheduledJob(id: string, data: Partial<ScheduledJob>): Promise<ScheduledJob | undefined>;

  // Intelligence Reports
  createIntelligenceReport(data: Omit<IntelligenceReport, "id" | "generatedAt">): Promise<IntelligenceReport>;
  getIntelligenceReports(reportType?: string): Promise<IntelligenceReport[]>;
  updateIntelligenceReportStatus(id: string, status: string): Promise<IntelligenceReport | undefined>;

  // Spending Trends
  createSpendingTrend(data: Omit<SpendingTrend, "id" | "createdAt">): Promise<SpendingTrend>;
  getSpendingTrends(limit?: number): Promise<SpendingTrend[]>;

  // Website Issues
  createWebsiteIssue(data: Omit<WebsiteIssue, "id" | "detectedAt">): Promise<WebsiteIssue>;
  getWebsiteIssues(status?: string): Promise<WebsiteIssue[]>;
  resolveWebsiteIssue(id: string): Promise<WebsiteIssue | undefined>;
  updateWebsiteIssueStatus(id: string, status: string): Promise<WebsiteIssue | undefined>;

  // Profit Records
  createProfitRecord(data: InsertProfitRecord): Promise<ProfitRecord>;
  getProfitRecords(limit?: number): Promise<ProfitRecord[]>;
  updateProfitRecord(id: string, data: Partial<ProfitRecord>): Promise<ProfitRecord | undefined>;

  // Formal Quotes
  createQuote(data: InsertQuote): Promise<Quote>;
  getQuotes(status?: string): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  updateQuote(id: string, data: Partial<Quote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<void>;

  // Generated Blog Articles
  createGeneratedBlogArticle(data: Omit<GeneratedBlogArticle, "id" | "generatedAt">): Promise<GeneratedBlogArticle>;
  getGeneratedBlogArticles(status?: string): Promise<GeneratedBlogArticle[]>;
  updateBlogArticleStatus(id: string, status: string): Promise<GeneratedBlogArticle | undefined>;

  // Office Move Radar
  createOfficeMovRadarRecord(data: InsertOfficeMovRadar): Promise<OfficeMovRadar>;
  getOfficeMovRadarRecords(filters?: { city?: string; signalType?: string; priority?: string; status?: string }): Promise<OfficeMovRadar[]>;
  getOfficeMovRadarRecord(id: string): Promise<OfficeMovRadar | undefined>;
  updateOfficeMovRadarRecord(id: string, data: Partial<OfficeMovRadar>): Promise<OfficeMovRadar | undefined>;
  deleteOfficeMovRadarRecord(id: string): Promise<void>;
  findRadarDuplicate(companyName: string, city: string, signalType: string): Promise<OfficeMovRadar | null>;

  // Building Signals
  createBuildingSignal(data: InsertBuildingSignal): Promise<BuildingSignal>;
  getBuildingSignals(city?: string): Promise<BuildingSignal[]>;
}

function rowToProspectedLead(row: typeof prospectedLeads.$inferSelect): ProspectedLead {
  return {
    id: row.id,
    company: row.company,
    domain: row.domain ?? null,
    website: row.website ?? null,
    location: row.location,
    industry: row.industry,
    estimatedTeamSize: row.estimatedTeamSize,
    likelyOfficeNeed: row.likelyOfficeNeed ?? null,
    signalsDetected: row.signalsDetected ?? [],
    estimatedProjectValue: row.estimatedProjectValue,
    score: row.score,
    priority: row.priority as ProspectedLead["priority"],
    decisionMakers: row.decisionMakers,
    outreachMessage: row.outreachMessage,
    reasoning: row.reasoning,
    rawInput: row.rawInput,
    status: row.status as ProspectedLead["status"],
    sourceType: row.sourceType ?? null,
    sourceUrl: row.sourceUrl ?? null,
    createdAt: row.createdAt ?? new Date(),
    signalType: row.signalType ?? null,
    city: row.city ?? null,
    contactEmail: row.contactEmail ?? null,
    contactRole: row.contactRole ?? null,
    dealProbability: row.dealProbability ?? null,
    estimatedOfficeSqm: row.estimatedOfficeSqm ?? null,
    estimatedHeadcount: row.estimatedHeadcount ?? null,
    recommendedNextAction: row.recommendedNextAction ?? null,
    outreachSubject: row.outreachSubject ?? null,
    scanBatchId: row.scanBatchId ?? null,
  };
}

function rowToSupplierQuote(row: typeof supplierQuotes.$inferSelect): SupplierQuote {
  return {
    id: row.id,
    supplierName: row.supplierName,
    supplierPhone: row.supplierPhone ?? undefined,
    supplierEmail: row.supplierEmail ?? undefined,
    productName: row.productName,
    sku: row.sku,
    quantity: row.quantity,
    colourFinish: row.colourFinish ?? undefined,
    unitPrice: row.unitPrice,
    freightCost: row.freightCost ?? undefined,
    leadTime: row.leadTime ?? undefined,
    quoteDate: row.quoteDate,
    projectReference: row.projectReference ?? undefined,
    status: row.status as SupplierQuote["status"],
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? new Date(),
  };
}

function rowToReferral(row: typeof referrals.$inferSelect): Referral {
  return {
    id: row.id,
    referrerName: row.referrerName,
    company: row.company ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    contactPhone: row.contactPhone ?? undefined,
    leadSource: row.leadSource as Referral["leadSource"],
    clientName: row.clientName ?? undefined,
    clientCompany: row.clientCompany ?? undefined,
    estimatedValue: row.estimatedValue ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status as Referral["status"],
    createdAt: row.createdAt ?? new Date(),
  };
}

export class DrizzleStorage implements IStorage {

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values({
      ...insertLead,
      company: insertLead.company ?? "",
    }).returning();
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async updateLeadScore(id: string, data: { opportunityScore: number; opportunityTier: string; signalsJson: string; nextAction: string; estimatedValueRange: string }): Promise<void> {
    await db.update(leads).set({
      opportunityScore: data.opportunityScore,
      opportunityTier: data.opportunityTier,
      signalsJson: data.signalsJson,
      nextAction: data.nextAction,
      estimatedValueRange: data.estimatedValueRange,
    }).where(eq(leads.id, id));
  }

  async createProspectedLead(data: Omit<ProspectedLead, "id" | "createdAt" | "status">): Promise<ProspectedLead> {
    const [row] = await db.insert(prospectedLeads).values({
      company: data.company,
      domain: data.domain ?? null,
      website: data.website,
      location: data.location,
      industry: data.industry,
      estimatedTeamSize: data.estimatedTeamSize,
      likelyOfficeNeed: data.likelyOfficeNeed ?? null,
      signalsDetected: data.signalsDetected,
      estimatedProjectValue: data.estimatedProjectValue,
      score: data.score,
      priority: data.priority,
      decisionMakers: data.decisionMakers,
      outreachMessage: data.outreachMessage,
      reasoning: data.reasoning,
      rawInput: data.rawInput,
      status: "New",
      sourceType: data.sourceType ?? "manual",
      sourceUrl: data.sourceUrl ?? null,
      signalType: data.signalType ?? null,
      city: data.city ?? null,
      contactEmail: data.contactEmail ?? null,
      contactRole: data.contactRole ?? null,
      dealProbability: data.dealProbability ?? null,
      estimatedOfficeSqm: data.estimatedOfficeSqm ?? null,
      estimatedHeadcount: data.estimatedHeadcount ?? null,
      recommendedNextAction: data.recommendedNextAction ?? null,
      outreachSubject: data.outreachSubject ?? null,
      scanBatchId: data.scanBatchId ?? null,
    }).returning();
    return rowToProspectedLead(row);
  }

  async getProspectedLeads(): Promise<ProspectedLead[]> {
    const rows = await db.select().from(prospectedLeads).orderBy(desc(prospectedLeads.createdAt));
    return rows.map(rowToProspectedLead);
  }

  async findProspectDuplicate(
    company: string,
    domain: string | null,
    sourceUrl: string | null,
  ): Promise<ProspectedLead | null> {
    const normalisedCompany = company.toLowerCase()
      .replace(/\b(pty|ltd|limited|inc|llc|corp)\b/gi, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const conditions = [
      ilike(prospectedLeads.company, `%${normalisedCompany}%`),
    ];
    if (domain) {
      conditions.push(eq(prospectedLeads.domain, domain));
    }
    if (sourceUrl) {
      conditions.push(eq(prospectedLeads.sourceUrl, sourceUrl));
    }

    const rows = await db
      .select()
      .from(prospectedLeads)
      .where(or(...conditions))
      .limit(1);

    return rows.length > 0 ? rowToProspectedLead(rows[0]) : null;
  }

  async updateProspectedLeadStatus(id: string, status: ProspectedLead["status"]): Promise<ProspectedLead | undefined> {
    const [row] = await db
      .update(prospectedLeads)
      .set({ status })
      .where(eq(prospectedLeads.id, id))
      .returning();
    if (!row) return undefined;
    return rowToProspectedLead(row);
  }

  async deleteProspectedLead(id: string): Promise<void> {
    await db.delete(prospectedLeads).where(eq(prospectedLeads.id, id));
  }

  async createSupplierQuote(data: InsertSupplierQuote): Promise<SupplierQuote> {
    const [row] = await db.insert(supplierQuotes).values({
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      supplierEmail: data.supplierEmail,
      productName: data.productName,
      sku: data.sku,
      quantity: data.quantity,
      colourFinish: data.colourFinish,
      unitPrice: data.unitPrice,
      freightCost: data.freightCost,
      leadTime: data.leadTime,
      quoteDate: data.quoteDate,
      projectReference: data.projectReference,
      status: data.status ?? "Requested",
      notes: data.notes,
    }).returning();
    return rowToSupplierQuote(row);
  }

  async getSupplierQuotes(): Promise<SupplierQuote[]> {
    const rows = await db.select().from(supplierQuotes).orderBy(desc(supplierQuotes.createdAt));
    return rows.map(rowToSupplierQuote);
  }

  async updateSupplierQuoteStatus(id: string, status: SupplierQuote["status"]): Promise<SupplierQuote | undefined> {
    const [row] = await db
      .update(supplierQuotes)
      .set({ status })
      .where(eq(supplierQuotes.id, id))
      .returning();
    if (!row) return undefined;
    return rowToSupplierQuote(row);
  }

  async updateSupplierQuote(id: string, data: Partial<InsertSupplierQuote>): Promise<SupplierQuote | undefined> {
    const [row] = await db
      .update(supplierQuotes)
      .set(data)
      .where(eq(supplierQuotes.id, id))
      .returning();
    if (!row) return undefined;
    return rowToSupplierQuote(row);
  }

  async deleteSupplierQuote(id: string): Promise<void> {
    await db.delete(supplierQuotes).where(eq(supplierQuotes.id, id));
  }

  async createReferral(data: InsertReferral): Promise<Referral> {
    const [row] = await db.insert(referrals).values({
      referrerName: data.referrerName,
      company: data.company,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      leadSource: data.leadSource,
      clientName: data.clientName,
      clientCompany: data.clientCompany,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
      status: "New",
    }).returning();
    return rowToReferral(row);
  }

  async getReferrals(): Promise<Referral[]> {
    const rows = await db.select().from(referrals).orderBy(desc(referrals.createdAt));
    return rows.map(rowToReferral);
  }

  async updateReferralStatus(id: string, status: Referral["status"]): Promise<Referral | undefined> {
    const [row] = await db
      .update(referrals)
      .set({ status })
      .where(eq(referrals.id, id))
      .returning();
    if (!row) return undefined;
    return rowToReferral(row);
  }

  async deleteReferral(id: string): Promise<void> {
    await db.delete(referrals).where(eq(referrals.id, id));
  }

  async createPlanningRequest(data: InsertPlanningRequest): Promise<PlanningRequest> {
    const [row] = await db.insert(planningRequests).values({
      name: data.name,
      company: data.company ?? "",
      email: data.email,
      phone: data.phone,
      city: data.city,
      projectType: data.projectType,
      squareMetres: data.squareMetres,
      staffCount: data.staffCount,
      meetingRooms: data.meetingRooms,
      receptionRequired: data.receptionRequired ?? false,
      breakoutRequired: data.breakoutRequired ?? false,
      executiveOfficeRequired: data.executiveOfficeRequired ?? false,
      budgetRange: data.budgetRange,
      stylePreference: data.stylePreference,
      specialRequirements: data.specialRequirements,
      uploadedFilesJson: data.uploadedFilesJson ?? "[]",
      aiSummary: data.aiSummary,
      aiRecommendations: data.aiRecommendations,
      leadScore: data.leadScore,
      estimatedValue: data.estimatedValue,
      implementationTimeline: data.implementationTimeline,
      packageJson: data.packageJson,
      quoteJson: data.quoteJson,
      floorGeometryJson: data.floorGeometryJson,
      geometrySource: data.geometrySource,
      status: "New",
      source: data.source ?? "upload-floor-plan",
    }).returning();
    return row;
  }

  async getPlanningRequests(): Promise<PlanningRequest[]> {
    return db.select().from(planningRequests).orderBy(desc(planningRequests.createdAt));
  }

  async getPlanningRequest(id: string): Promise<PlanningRequest | undefined> {
    const [row] = await db.select().from(planningRequests).where(eq(planningRequests.id, id));
    return row;
  }

  async updatePlanningRequestStatus(id: string, status: string): Promise<PlanningRequest | undefined> {
    const [row] = await db
      .update(planningRequests)
      .set({ status })
      .where(eq(planningRequests.id, id))
      .returning();
    return row;
  }

  async updatePlanningRequest(id: string, data: Partial<InsertPlanningRequest & { status?: string; adminNotes?: string }>): Promise<PlanningRequest | undefined> {
    const [row] = await db
      .update(planningRequests)
      .set(data as any)
      .where(eq(planningRequests.id, id))
      .returning();
    return row;
  }

  async deletePlanningRequest(id: string): Promise<void> {
    await db.delete(planningRequests).where(eq(planningRequests.id, id));
  }

  async markPlanningRequestPaid(id: string, sessionId: string): Promise<PlanningRequest | undefined> {
    const [row] = await db
      .update(planningRequests)
      .set({ isPaid: true, stripeSessionId: sessionId, paymentStatus: "paid", paymentTier: "full_report" })
      .where(eq(planningRequests.id, id))
      .returning();
    return row;
  }

  async updateFloorGeometry(id: string, floorGeometryJson: string, geometrySource: string): Promise<PlanningRequest | undefined> {
    const [row] = await db
      .update(planningRequests)
      .set({ floorGeometryJson, geometrySource })
      .where(eq(planningRequests.id, id))
      .returning();
    return row;
  }

  async createProductReview(data: InsertProductReview): Promise<ProductReview> {
    const [row] = await db.insert(productReviews).values({ ...data, status: "pending" }).returning();
    return row;
  }

  async getApprovedReviewsBySku(sku: string): Promise<ProductReview[]> {
    return db.select().from(productReviews)
      .where(and(eq(productReviews.productSku, sku), eq(productReviews.status, "approved")))
      .orderBy(desc(productReviews.createdAt));
  }

  async getAllProductReviews(): Promise<ProductReview[]> {
    return db.select().from(productReviews).orderBy(desc(productReviews.createdAt));
  }

  async updateProductReviewStatus(id: string, status: string, adminNote?: string): Promise<ProductReview | undefined> {
    const [row] = await db.update(productReviews)
      .set({ status, adminNote: adminNote ?? null })
      .where(eq(productReviews.id, id))
      .returning();
    return row;
  }

  async deleteProductReview(id: string): Promise<void> {
    await db.delete(productReviews).where(eq(productReviews.id, id));
  }

  // ─── Manufacturer Messages ──────────────────────────────────────────────────

  async createManufacturerMessage(data: InsertManufacturerMessage): Promise<ManufacturerMessage> {
    const [row] = await db.insert(manufacturerMessages).values(data).returning();
    return row;
  }

  async getManufacturerMessages(manufacturerId?: string): Promise<ManufacturerMessage[]> {
    if (manufacturerId) {
      return db.select().from(manufacturerMessages)
        .where(eq(manufacturerMessages.manufacturerId, manufacturerId))
        .orderBy(desc(manufacturerMessages.sentAt));
    }
    return db.select().from(manufacturerMessages).orderBy(desc(manufacturerMessages.sentAt));
  }

  async updateManufacturerMessageStatus(id: string, status: string, wapiMessageId?: string): Promise<ManufacturerMessage | undefined> {
    const [row] = await db.update(manufacturerMessages)
      .set({ status, ...(wapiMessageId ? { wapiMessageId } : {}) })
      .where(eq(manufacturerMessages.id, id))
      .returning();
    return row;
  }

  // ─── Follow-Up Sequences ────────────────────────────────────────────────────

  async createFollowUpSequence(data: InsertFollowUpSequence): Promise<FollowUpSequence> {
    const [row] = await db.insert(followUpSequences).values(data).returning();
    return row;
  }

  async getFollowUpSequences(status?: string): Promise<FollowUpSequence[]> {
    if (status) {
      return db.select().from(followUpSequences)
        .where(eq(followUpSequences.status, status))
        .orderBy(desc(followUpSequences.createdAt));
    }
    return db.select().from(followUpSequences).orderBy(desc(followUpSequences.createdAt));
  }

  async getFollowUpSequenceByLeadId(leadId: string): Promise<FollowUpSequence | undefined> {
    const [row] = await db.select().from(followUpSequences)
      .where(eq(followUpSequences.leadId, leadId));
    return row;
  }

  async getDueFollowUpSequences(): Promise<FollowUpSequence[]> {
    return db.select().from(followUpSequences)
      .where(
        and(
          eq(followUpSequences.status, "active"),
          drizzleSql`${followUpSequences.nextSendAt} <= NOW()`
        )
      );
  }

  async advanceFollowUpSequence(
    id: string,
    nextStage: number,
    nextSendAt: Date | null,
    status: string,
    stagesCompleted: string[]
  ): Promise<FollowUpSequence | undefined> {
    const [row] = await db.update(followUpSequences)
      .set({
        stage: nextStage,
        nextSendAt,
        lastSentAt: new Date(),
        status,
        stagesCompleted,
      })
      .where(eq(followUpSequences.id, id))
      .returning();
    return row;
  }

  async updateFollowUpSequenceStatus(id: string, status: string): Promise<FollowUpSequence | undefined> {
    const [row] = await db.update(followUpSequences)
      .set({ status })
      .where(eq(followUpSequences.id, id))
      .returning();
    return row;
  }

  // ─── Territories ──────────────────────────────────────────────────────────────

  async createTerritory(data: InsertTerritory): Promise<Territory> {
    const [row] = await db.insert(territories).values(data).returning();
    return row;
  }

  async getTerritories(): Promise<Territory[]> {
    return db.select().from(territories).orderBy(desc(territories.lastActivityAt));
  }

  async updateTerritory(id: string, data: Partial<InsertTerritory>): Promise<Territory | undefined> {
    const [row] = await db.update(territories)
      .set({ ...data, lastActivityAt: new Date() })
      .where(eq(territories.id, id))
      .returning();
    return row;
  }

  async deleteTerritory(id: string): Promise<void> {
    await db.delete(territories).where(eq(territories.id, id));
  }

  // ─── Extended prospectedLeads bulk insert ─────────────────────────────────────

  async bulkCreateProspectedLeads(leads: Array<Omit<ProspectedLead, "id" | "createdAt" | "status">>): Promise<ProspectedLead[]> {
    const results: ProspectedLead[] = [];
    for (const lead of leads) {
      try {
        const created = await this.createProspectedLead(lead);
        results.push(created);
      } catch {
        // skip duplicates
      }
    }
    return results;
  }

  async getProspectedLeadsByBatch(scanBatchId: string): Promise<ProspectedLead[]> {
    const rows = await db.select().from(prospectedLeads)
      .where(eq(prospectedLeads.scanBatchId, scanBatchId))
      .orderBy(desc(prospectedLeads.createdAt));
    return rows.map(rowToProspectedLead);
  }

  // ─── Workspace Learning Records ───────────────────────────────────────────────

  async createWorkspaceLearning(data: InsertWorkspaceLearning): Promise<WorkspaceLearning> {
    const [row] = await db.insert(workspaceLearningRecords).values(data).returning();
    return row;
  }

  async getWorkspaceLearningRecords(): Promise<WorkspaceLearning[]> {
    return db.select().from(workspaceLearningRecords).orderBy(desc(workspaceLearningRecords.createdAt));
  }

  async getWorkspaceLearningById(id: string): Promise<WorkspaceLearning | undefined> {
    const [row] = await db.select().from(workspaceLearningRecords).where(eq(workspaceLearningRecords.id, id));
    return row;
  }

  async updateWorkspaceLearningConversion(planningRequestId: string, result: string): Promise<void> {
    await db.update(workspaceLearningRecords)
      .set({ conversionResult: result })
      .where(eq(workspaceLearningRecords.planningRequestId, planningRequestId));
  }

  async getSimilarWorkspaceLearning(officeSqm: string, staffCount: string, projectType: string, limit = 3): Promise<WorkspaceLearning[]> {
    const all = await db.select().from(workspaceLearningRecords)
      .where(eq(workspaceLearningRecords.conversionResult, "paid"))
      .orderBy(desc(workspaceLearningRecords.createdAt))
      .limit(20);

    const sqm = parseFloat(officeSqm || "0");
    const staff = parseInt(staffCount || "0", 10);

    const scored = all.map(r => {
      let score = 0;
      if (r.projectType && r.projectType.toLowerCase() === (projectType || "").toLowerCase()) score += 10;
      const rSqm = parseFloat(r.officeSqm || "0");
      const rStaff = parseInt(r.staffCount || "0", 10);
      if (sqm > 0 && rSqm > 0) score += Math.max(0, 10 - Math.abs(sqm - rSqm) / 50);
      if (staff > 0 && rStaff > 0) score += Math.max(0, 10 - Math.abs(staff - rStaff) / 5);
      return { r, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.r);
  }

  // ─── Scheduled Jobs ───────────────────────────────────────────────────────

  async createScheduledJob(data: Omit<ScheduledJob, "id" | "createdAt">): Promise<ScheduledJob> {
    const [row] = await db.insert(scheduledJobs).values(data as any).returning();
    return row;
  }

  async getScheduledJobs(limit = 100): Promise<ScheduledJob[]> {
    return db.select().from(scheduledJobs)
      .orderBy(desc(scheduledJobs.createdAt))
      .limit(limit);
  }

  async updateScheduledJob(id: string, data: Partial<ScheduledJob>): Promise<ScheduledJob | undefined> {
    const [row] = await db.update(scheduledJobs).set(data as any).where(eq(scheduledJobs.id, id)).returning();
    return row;
  }

  // ─── Intelligence Reports ─────────────────────────────────────────────────

  async createIntelligenceReport(data: Omit<IntelligenceReport, "id" | "generatedAt">): Promise<IntelligenceReport> {
    const [row] = await db.insert(intelligenceReports).values(data as any).returning();
    return row;
  }

  async getIntelligenceReports(reportType?: string): Promise<IntelligenceReport[]> {
    const query = db.select().from(intelligenceReports).orderBy(desc(intelligenceReports.generatedAt));
    if (reportType) {
      return db.select().from(intelligenceReports)
        .where(eq(intelligenceReports.reportType, reportType))
        .orderBy(desc(intelligenceReports.generatedAt))
        .limit(50);
    }
    return query.limit(50);
  }

  async updateIntelligenceReportStatus(id: string, status: string): Promise<IntelligenceReport | undefined> {
    const [row] = await db.update(intelligenceReports).set({ status }).where(eq(intelligenceReports.id, id)).returning();
    return row;
  }

  // ─── Spending Trends ──────────────────────────────────────────────────────

  async createSpendingTrend(data: Omit<SpendingTrend, "id" | "createdAt">): Promise<SpendingTrend> {
    const [row] = await db.insert(spendingTrends).values(data as any).returning();
    return row;
  }

  async getSpendingTrends(limit = 50): Promise<SpendingTrend[]> {
    return db.select().from(spendingTrends)
      .orderBy(desc(spendingTrends.createdAt))
      .limit(limit);
  }

  // ─── Website Issues ───────────────────────────────────────────────────────

  async createWebsiteIssue(data: Omit<WebsiteIssue, "id" | "detectedAt">): Promise<WebsiteIssue> {
    const [row] = await db.insert(websiteIssues).values(data as any).returning();
    return row;
  }

  async getWebsiteIssues(status?: string): Promise<WebsiteIssue[]> {
    if (status) {
      return db.select().from(websiteIssues)
        .where(eq(websiteIssues.status, status))
        .orderBy(desc(websiteIssues.detectedAt))
        .limit(100);
    }
    return db.select().from(websiteIssues).orderBy(desc(websiteIssues.detectedAt)).limit(100);
  }

  async resolveWebsiteIssue(id: string): Promise<WebsiteIssue | undefined> {
    const [row] = await db.update(websiteIssues)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(websiteIssues.id, id))
      .returning();
    return row;
  }

  async updateWebsiteIssueStatus(id: string, status: string): Promise<WebsiteIssue | undefined> {
    const updates: any = { status };
    if (status === "resolved") updates.resolvedAt = new Date();
    const [row] = await db.update(websiteIssues).set(updates).where(eq(websiteIssues.id, id)).returning();
    return row;
  }

  // ─── Profit Records ───────────────────────────────────────────────────────

  async createProfitRecord(data: InsertProfitRecord): Promise<ProfitRecord> {
    const [row] = await db.insert(profitRecords).values(data as any).returning();
    return row;
  }

  async getProfitRecords(limit = 50): Promise<ProfitRecord[]> {
    return db.select().from(profitRecords)
      .orderBy(desc(profitRecords.createdAt))
      .limit(limit);
  }

  async updateProfitRecord(id: string, data: Partial<ProfitRecord>): Promise<ProfitRecord | undefined> {
    const [row] = await db.update(profitRecords).set(data as any).where(eq(profitRecords.id, id)).returning();
    return row;
  }

  // ─── Formal Quotes ────────────────────────────────────────────────────────

  async createQuote(data: InsertQuote): Promise<Quote> {
    const [row] = await db.insert(quotes).values(data as any).returning();
    return row;
  }

  async getQuotes(status?: string): Promise<Quote[]> {
    if (status && status !== "All") {
      return db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt)).limit(100);
    }
    return db.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(100);
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [row] = await db.select().from(quotes).where(eq(quotes.id, id));
    return row;
  }

  async updateQuote(id: string, data: Partial<Quote>): Promise<Quote | undefined> {
    const [row] = await db.update(quotes).set({ ...data as any, updatedAt: new Date() }).where(eq(quotes.id, id)).returning();
    return row;
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  // ─── Generated Blog Articles ──────────────────────────────────────────────

  async createGeneratedBlogArticle(data: Omit<GeneratedBlogArticle, "id" | "generatedAt">): Promise<GeneratedBlogArticle> {
    const [row] = await db.insert(generatedBlogArticles).values(data as any).returning();
    return row;
  }

  async getGeneratedBlogArticles(status?: string): Promise<GeneratedBlogArticle[]> {
    if (status) {
      return db.select().from(generatedBlogArticles)
        .where(eq(generatedBlogArticles.status, status))
        .orderBy(desc(generatedBlogArticles.generatedAt))
        .limit(50);
    }
    return db.select().from(generatedBlogArticles).orderBy(desc(generatedBlogArticles.generatedAt)).limit(50);
  }

  async updateBlogArticleStatus(id: string, status: string): Promise<GeneratedBlogArticle | undefined> {
    const updates: any = { status };
    if (status === "published") updates.publishedAt = new Date();
    const [row] = await db.update(generatedBlogArticles).set(updates).where(eq(generatedBlogArticles.id, id)).returning();
    return row;
  }

  // ─── Office Move Radar ────────────────────────────────────────────────────

  async createOfficeMovRadarRecord(data: InsertOfficeMovRadar): Promise<OfficeMovRadar> {
    const [row] = await db.insert(officeMovRadar).values(data as any).returning();
    return row;
  }

  async getOfficeMovRadarRecords(filters?: { city?: string; signalType?: string; priority?: string; status?: string }): Promise<OfficeMovRadar[]> {
    let query = db.select().from(officeMovRadar).orderBy(desc(officeMovRadar.radarScore), desc(officeMovRadar.createdAt)).$dynamic();
    const conditions: any[] = [];
    if (filters?.city) conditions.push(ilike(officeMovRadar.city, `%${filters.city}%`));
    if (filters?.signalType) conditions.push(eq(officeMovRadar.signalType, filters.signalType));
    if (filters?.priority) conditions.push(eq(officeMovRadar.priority, filters.priority));
    if (filters?.status) conditions.push(eq(officeMovRadar.status, filters.status));
    if (conditions.length > 0) query = query.where(and(...conditions));
    return query.limit(200);
  }

  async getOfficeMovRadarRecord(id: string): Promise<OfficeMovRadar | undefined> {
    const [row] = await db.select().from(officeMovRadar).where(eq(officeMovRadar.id, id));
    return row;
  }

  async updateOfficeMovRadarRecord(id: string, data: Partial<OfficeMovRadar>): Promise<OfficeMovRadar | undefined> {
    const [row] = await db.update(officeMovRadar)
      .set({ ...data as any, updatedAt: new Date() })
      .where(eq(officeMovRadar.id, id))
      .returning();
    return row;
  }

  async deleteOfficeMovRadarRecord(id: string): Promise<void> {
    await db.delete(officeMovRadar).where(eq(officeMovRadar.id, id));
  }

  async findRadarDuplicate(companyName: string, city: string, signalType: string): Promise<OfficeMovRadar | null> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await db.select().from(officeMovRadar)
      .where(
        and(
          ilike(officeMovRadar.companyName, companyName),
          ilike(officeMovRadar.city, city),
          eq(officeMovRadar.signalType, signalType),
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  // ─── Building Signals ─────────────────────────────────────────────────────

  async createBuildingSignal(data: InsertBuildingSignal): Promise<BuildingSignal> {
    const [row] = await db.insert(buildingSignals).values(data as any).returning();
    return row;
  }

  async getBuildingSignals(city?: string): Promise<BuildingSignal[]> {
    if (city) {
      return db.select().from(buildingSignals)
        .where(ilike(buildingSignals.city, `%${city}%`))
        .orderBy(desc(buildingSignals.createdAt))
        .limit(100);
    }
    return db.select().from(buildingSignals).orderBy(desc(buildingSignals.createdAt)).limit(100);
  }
}

export const storage = new DrizzleStorage();
