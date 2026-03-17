import type { Express } from "express";
import { storage } from "./storage";

export async function registerRoutes(app: Express) {

  // Health check
  app.get("/api/health", async (_req, res) => {
    res.json({ status: "ok" });
  });

  // Leads
  app.get("/api/leads", async (_req, res) => {
    const leads = await storage.getLeads();
    res.json(leads);
  });

  // Prospected leads
  app.get("/api/prospected-leads", async (_req, res) => {
    const leads = await storage.getProspectedLeads();
    res.json(leads);
  });

  // Planning requests
  app.get("/api/planning-requests", async (_req, res) => {
    const requests = await storage.getPlanningRequests();
    res.json(requests);
  });

  // Quotes
  app.get("/api/quotes", async (_req, res) => {
    const quotes = await storage.getQuotes();
    res.json(quotes);
  });

}