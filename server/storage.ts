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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private leads: Map<string, Lead>;
  private prospectedLeads: Map<string, ProspectedLead>;

  constructor() {
    this.users = new Map();
    this.leads = new Map();
    this.prospectedLeads = new Map();
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
}

export const storage = new MemStorage();
