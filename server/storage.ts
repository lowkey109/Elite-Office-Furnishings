import { type User, type InsertUser, type Lead, type InsertLead } from "@shared/schema";
import { randomUUID } from "crypto";

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
  // Supplier quotes
  createSupplierQuote(data: InsertSupplierQuote): Promise<SupplierQuote>;
  getSupplierQuotes(): Promise<SupplierQuote[]>;
  updateSupplierQuoteStatus(id: string, status: SupplierQuote["status"]): Promise<SupplierQuote | undefined>;
  updateSupplierQuote(id: string, data: Partial<InsertSupplierQuote>): Promise<SupplierQuote | undefined>;
  deleteSupplierQuote(id: string): Promise<void>;
  // Referrals
  createReferral(data: InsertReferral): Promise<Referral>;
  getReferrals(): Promise<Referral[]>;
  updateReferralStatus(id: string, status: Referral["status"]): Promise<Referral | undefined>;
  deleteReferral(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private leads: Map<string, Lead>;
  private prospectedLeads: Map<string, ProspectedLead>;
  private supplierQuotes: Map<string, SupplierQuote>;
  private referrals: Map<string, Referral>;

  constructor() {
    this.users = new Map();
    this.leads = new Map();
    this.prospectedLeads = new Map();
    this.supplierQuotes = new Map();
    this.referrals = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = {
      ...insertLead,
      id,
      message: insertLead.message ?? null,
      officeSize: insertLead.officeSize ?? null,
      staffCount: insertLead.staffCount ?? null,
      budget: insertLead.budget ?? null,
      timeline: insertLead.timeline ?? null,
      officeLocation: insertLead.officeLocation ?? null,
      moveDate: insertLead.moveDate ?? null,
      createdAt: new Date(),
    };
    this.leads.set(id, lead);
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
  }

  async createProspectedLead(data: Omit<ProspectedLead, "id" | "createdAt" | "status">): Promise<ProspectedLead> {
    const id = randomUUID();
    const lead: ProspectedLead = {
      ...data,
      id,
      status: "New",
      createdAt: new Date(),
    };
    this.prospectedLeads.set(id, lead);
    return lead;
  }

  async getProspectedLeads(): Promise<ProspectedLead[]> {
    return Array.from(this.prospectedLeads.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateProspectedLeadStatus(id: string, status: ProspectedLead["status"]): Promise<ProspectedLead | undefined> {
    const lead = this.prospectedLeads.get(id);
    if (!lead) return undefined;
    const updated = { ...lead, status };
    this.prospectedLeads.set(id, updated);
    return updated;
  }

  async deleteProspectedLead(id: string): Promise<void> {
    this.prospectedLeads.delete(id);
  }

  // ─── Supplier Quotes ───────────────────────────────────────────────────────

  async createSupplierQuote(data: InsertSupplierQuote): Promise<SupplierQuote> {
    const id = randomUUID();
    const quote: SupplierQuote = {
      ...data,
      id,
      status: data.status ?? "Requested",
      createdAt: new Date(),
    };
    this.supplierQuotes.set(id, quote);
    return quote;
  }

  async getSupplierQuotes(): Promise<SupplierQuote[]> {
    return Array.from(this.supplierQuotes.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateSupplierQuoteStatus(id: string, status: SupplierQuote["status"]): Promise<SupplierQuote | undefined> {
    const quote = this.supplierQuotes.get(id);
    if (!quote) return undefined;
    const updated = { ...quote, status };
    this.supplierQuotes.set(id, updated);
    return updated;
  }

  async updateSupplierQuote(id: string, data: Partial<InsertSupplierQuote>): Promise<SupplierQuote | undefined> {
    const quote = this.supplierQuotes.get(id);
    if (!quote) return undefined;
    const updated = { ...quote, ...data };
    this.supplierQuotes.set(id, updated);
    return updated;
  }

  async deleteSupplierQuote(id: string): Promise<void> {
    this.supplierQuotes.delete(id);
  }

  // ─── Referrals ─────────────────────────────────────────────────────────────

  async createReferral(data: InsertReferral): Promise<Referral> {
    const id = randomUUID();
    const referral: Referral = {
      ...data,
      id,
      status: "New",
      createdAt: new Date(),
    };
    this.referrals.set(id, referral);
    return referral;
  }

  async getReferrals(): Promise<Referral[]> {
    return Array.from(this.referrals.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateReferralStatus(id: string, status: Referral["status"]): Promise<Referral | undefined> {
    const referral = this.referrals.get(id);
    if (!referral) return undefined;
    const updated = { ...referral, status };
    this.referrals.set(id, updated);
    return updated;
  }

  async deleteReferral(id: string): Promise<void> {
    this.referrals.delete(id);
  }
}

export const storage = new MemStorage();
