import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, leads, prospectedLeads, supplierQuotes, referrals, planningRequests,
  type User, type InsertUser, type Lead, type InsertLead, type PlanningRequest,
} from "@shared/schema";

export interface ProspectedLead {
  id: string;
  company: string;
  website: string | null;
  location: string;
  industry: string;
  estimatedTeamSize: string;
  signalsDetected: string[];
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  decisionMakers: string;
  outreachMessage: string;
  reasoning: string;
  rawInput: string;
  status: "New" | "Contacted" | "Responded" | "Qualified" | "Closed";
  sourceType: string | null;
  sourceUrl: string | null;
  createdAt: Date;
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
  source?: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  createProspectedLead(data: Omit<ProspectedLead, "id" | "createdAt" | "status">): Promise<ProspectedLead>;
  getProspectedLeads(): Promise<ProspectedLead[]>;
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
}

function rowToProspectedLead(row: typeof prospectedLeads.$inferSelect): ProspectedLead {
  return {
    id: row.id,
    company: row.company,
    website: row.website ?? null,
    location: row.location,
    industry: row.industry,
    estimatedTeamSize: row.estimatedTeamSize,
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

  async createProspectedLead(data: Omit<ProspectedLead, "id" | "createdAt" | "status">): Promise<ProspectedLead> {
    const [row] = await db.insert(prospectedLeads).values({
      company: data.company,
      website: data.website,
      location: data.location,
      industry: data.industry,
      estimatedTeamSize: data.estimatedTeamSize,
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
    }).returning();
    return rowToProspectedLead(row);
  }

  async getProspectedLeads(): Promise<ProspectedLead[]> {
    const rows = await db.select().from(prospectedLeads).orderBy(desc(prospectedLeads.createdAt));
    return rows.map(rowToProspectedLead);
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
}

export const storage = new DrizzleStorage();
