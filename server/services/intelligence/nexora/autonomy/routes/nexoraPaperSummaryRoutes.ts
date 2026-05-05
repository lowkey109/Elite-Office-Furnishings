import type { Express } from "express";
import fs from "fs";
import path from "path";

function fallbackSummary() {
  return {
    ok: true,
    service: "nexora_paper_learning_summary",
    generatedAt: new Date().toISOString(),
    source: "fallback_empty",
    polymarketEvents: 0,
    recentEvents: 0,
    countedTrades: 0,
    wins: 0,
    losses: 0,
    skips: 0,
    winRate: 0,
    avgScore: 0,
    displayedConfidencePercent: 50,
    targetConfidencePercent: 95,
    targetReached: false,
    assets: [],
    latest: null,
    safety: {
      liveTradingEnabled: false,
      privateKeysInsideNexora: false,
      walletSigningInsideNexora: false,
      postgresReplay: false,
      bankTransfers: false
    }
  };
}

function readSummary() {
  const file = path.join(process.cwd(), "data", "nexora", "local", "paper-summary", "latest-summary.json");
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {}
  return fallbackSummary();
}

export function registerNexoraPaperSummaryRoutes(app: Express): void {
  app.get("/api/nexora/poly-paper-summary/latest", (_req, res) => {
    res.json(readSummary());
  });

  app.get("/api/nexora/poly-paper-summary/status", (_req, res) => {
    const file = path.join(process.cwd(), "data", "nexora", "local", "paper-summary", "latest-summary.json");
    res.json({
      ok: true,
      service: "nexora_poly_paper_summary_status",
      generatedAt: new Date().toISOString(),
      summaryFileExists: fs.existsSync(file),
      route: "/api/nexora/poly-paper-summary/latest",
      safety: {
        liveTradingEnabled: false,
        postgresReplay: false,
        bankTransfers: false
      }
    });
  });
}
