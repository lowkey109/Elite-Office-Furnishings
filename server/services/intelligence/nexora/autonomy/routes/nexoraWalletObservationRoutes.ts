import type { Express } from "express";
import fs from "fs";
import path from "path";

type JsonRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "wallet-observations");
const OBS = path.join(ROOT, "observations.jsonl");

function now() {
  return new Date().toISOString();
}

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    mode: "read_only_wallet_observation",
    fakeWalletData: false,
    liveCopyTrading: false,
    liveTradingEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false
  };
}

function readObservations(limit = 100) {
  ensureRoot();
  if (!fs.existsSync(OBS)) return [];

  return fs.readFileSync(OBS, "utf8")
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function scoreObservation(input: JsonRecord) {
  const size = Number(input.sizeUsd || input.size || 0);
  const confidence = Math.max(0, Math.min(100, Number(input.confidence || 50)));
  const liquidity = Math.max(0, Math.min(100, Number(input.liquidityScore || 50)));
  const score = Math.round(((Math.min(size, 10000) / 10000) * 35) + (confidence * 0.4) + (liquidity * 0.25));

  return Math.max(0, Math.min(100, score));
}

export function registerNexoraWalletObservationRoutes(app: Express): void {
  app.get("/api/nexora/wallet-graph/status", (_req, res) => {
    const observations = readObservations(50);
    res.json({
      ok: true,
      service: "nexora_wallet_graph_status",
      generatedAt: now(),
      observations: observations.length,
      hasRealWalletData: observations.length > 0,
      message: observations.length ? "Real wallet observations available." : "WAITING FOR REAL WALLET DATA",
      safety: safety()
    });
  });

  app.get("/api/nexora/wallet-graph/observations", (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const observations = readObservations(limit);
    res.json({
      ok: true,
      service: "nexora_wallet_graph_observations",
      generatedAt: now(),
      observations,
      message: observations.length ? "Real wallet observations only." : "WAITING FOR REAL WALLET DATA",
      safety: safety()
    });
  });

  app.post("/api/nexora/wallet-graph/record", (req, res) => {
    ensureRoot();

    const wallet = String(req.body?.wallet || req.body?.address || "").trim();
    const market = String(req.body?.market || "").trim();

    if (!wallet || !market) {
      return res.status(400).json({
        ok: false,
        error: "wallet_and_market_required",
        message: "No fake wallet records. Provide a real observed wallet/address and market.",
        safety: safety()
      });
    }

    const record = {
      ok: true,
      service: "nexora_wallet_observation_record",
      id: `wallet-observation-${Date.now()}`,
      generatedAt: now(),
      wallet,
      market,
      side: req.body?.side || "unknown",
      sizeUsd: Number(req.body?.sizeUsd || 0),
      price: req.body?.price ?? null,
      source: req.body?.source || "operator_observed",
      confidence: Number(req.body?.confidence || 50),
      liquidityScore: Number(req.body?.liquidityScore || 50),
      score: scoreObservation(req.body || {}),
      paperOnly: true,
      liveCopyTrading: false,
      safety: safety()
    };

    fs.appendFileSync(OBS, JSON.stringify(record) + "\n");
    res.json(record);
  });

  app.get("/api/nexora/wallet-graph/nodes", (_req, res) => {
    const observations = readObservations(200);
    const wallets: Record<string, any> = {};

    for (const obs of observations) {
      const wallet = obs.wallet || "unknown";
      if (!wallets[wallet]) {
        wallets[wallet] = {
          id: wallet,
          wallet,
          observations: 0,
          scoreSum: 0,
          markets: new Set<string>()
        };
      }
      wallets[wallet].observations += 1;
      wallets[wallet].scoreSum += Number(obs.score || 0);
      if (obs.market) wallets[wallet].markets.add(String(obs.market));
    }

    const nodes = Object.values(wallets).map((w: any) => ({
      id: w.id,
      label: w.wallet.slice(0, 6) + "..." + w.wallet.slice(-4),
      observations: w.observations,
      averageScore: w.observations ? Math.round((w.scoreSum / w.observations) * 100) / 100 : 0,
      markets: Array.from(w.markets)
    }));

    res.json({
      ok: true,
      service: "nexora_wallet_graph_nodes",
      generatedAt: now(),
      nodes,
      message: nodes.length ? "Real observed wallet nodes." : "WAITING FOR REAL WALLET DATA",
      safety: safety()
    });
  });
}
