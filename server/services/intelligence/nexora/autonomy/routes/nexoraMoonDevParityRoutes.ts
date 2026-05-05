import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

function now() {
  return new Date().toISOString();
}

function readJsonl(file: string): R[] {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isPolymarketEvent(e: R): boolean {
  const raw = e.raw || {};
  return e.domain === "polymarket" ||
    raw.product === "Phantom X / Polymarket" ||
    Boolean(raw.asset) ||
    Boolean(raw.market);
}

function isFakeOrExperimental(e: R): boolean {
  const raw = e.raw || {};
  const action = String(e.action || "");
  const result = String(e.result || "");

  if (!raw || Object.keys(raw).length === 0) return true;
  if (action === "unknown_action") return true;
  if (result === "unknown_result") return true;
  if (!raw.asset && !raw.market) return true;
  if (raw.synthetic === true) return true;
  if (raw.fake === true) return true;

  return false;
}

function isPromotionCandidate(e: R): boolean {
  const raw = e.raw || {};
  const result = String(e.result || "");
  const action = String(e.action || "");
  const score = Number(e.scored?.score || 0);

  if (isFakeOrExperimental(e)) return false;
  if (action !== "paper_trade_intent_practice") return false;
  if (raw.countAsTrade === false) return false;
  if (raw.riskTriggered === true) return false;
  if (result.includes("skip")) return false;
  if (!String(raw.strategyUsed || "").toLowerCase().includes("moondev")) return false;
  if (score < 75) return false;

  return true;
}

function isWin(e: R): boolean {
  const raw = e.raw || {};
  const result = String(e.result || "");
  const pnl = Number(raw.pnl ?? e.metrics?.paperPnl ?? 0);

  return result.includes("success") || pnl > 0;
}

function summarize(events: R[]) {
  const wins = events.filter(isWin).length;
  const losses = events.length - wins;
  const scores = events
    .map((e) => Number(e.scored?.score))
    .filter((n) => Number.isFinite(n));

  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : 0;

  const winRate = events.length
    ? Math.round((wins / events.length) * 10000) / 100
    : 0;

  return {
    samples: events.length,
    wins,
    losses,
    winRate,
    avgScore
  };
}

function assetLeaderboard(events: R[]) {
  const map: Record<string, R> = {};

  for (const e of events) {
    const raw = e.raw || {};
    const asset = raw.asset || "unknown";
    const score = Number(e.scored?.score || 0);
    const pnl = Number(raw.pnl ?? e.metrics?.paperPnl ?? 0);

    if (!map[asset]) {
      map[asset] = {
        asset,
        samples: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
        scoreSum: 0
      };
    }

    map[asset].samples += 1;
    map[asset].pnl += Number.isFinite(pnl) ? pnl : 0;
    map[asset].scoreSum += Number.isFinite(score) ? score : 0;

    if (isWin(e)) map[asset].wins += 1;
    else map[asset].losses += 1;
  }

  return Object.values(map).map((a: R) => ({
    asset: a.asset,
    samples: a.samples,
    wins: a.wins,
    losses: a.losses,
    winRate: a.samples ? Math.round((a.wins / a.samples) * 10000) / 100 : 0,
    avgScore: a.samples ? Math.round((a.scoreSum / a.samples) * 100) / 100 : 0,
    pnl: Math.round(a.pnl * 100) / 100
  })).sort((a: R, b: R) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
    return b.samples - a.samples;
  });
}

function buildParityReport() {
  const eventsFile = path.join(process.cwd(), "data", "nexora", "local", "learning-memory", "events.jsonl");
  const allEvents = readJsonl(eventsFile).filter(isPolymarketEvent);

  const fakeOrExperimental = allEvents.filter(isFakeOrExperimental);
  const exploration = allEvents.filter((e) => !isFakeOrExperimental(e));
  const promotion = allEvents.filter(isPromotionCandidate);

  const explorationSummary = summarize(exploration);
  const promotionSummary = summarize(promotion);

  const passed95 =
    promotionSummary.samples >= 20 &&
    promotionSummary.winRate >= 95 &&
    promotionSummary.avgScore >= 80;

  const status = passed95
    ? "MOONDEV_PARITY_PROMOTION_PASSED"
    : "MOONDEV_PARITY_TRAINING_REQUIRED";

  const latestPromotion = promotion[promotion.length - 1] || null;
  const latestExploration = exploration[exploration.length - 1] || null;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_parity_truth_locked",
    generatedAt: now(),
    status,
    target: {
      requiredPromotionWinRate: 95,
      requiredPromotionSamples: 20,
      requiredAverageScore: 80,
      passed: passed95
    },
    truthRules: [
      "No fake candles.",
      "No fake order book.",
      "No fake win rate.",
      "No fake 95%.",
      "Unknown/empty events are quarantined as experimental.",
      "Exploration learning is separated from promotion win-rate.",
      "Only MoonDev-ranked, risk-approved paper trade events count toward promotion."
    ],
    counts: {
      totalPolymarketEvents: allEvents.length,
      fakeOrExperimental: fakeOrExperimental.length,
      explorationEvents: exploration.length,
      promotionCandidates: promotion.length
    },
    exploration: {
      ...explorationSummary,
      purpose: "All real paper-learning attempts. Useful for training, not for 95% promotion claim."
    },
    promotion: {
      ...promotionSummary,
      purpose: "Only MoonDev-ranked, risk-approved, counted paper trades. This is the real 95% gate."
    },
    assets: {
      exploration: assetLeaderboard(exploration),
      promotion: assetLeaderboard(promotion)
    },
    latest: {
      exploration: latestExploration ? {
        asset: latestExploration.raw?.asset,
        action: latestExploration.action,
        result: latestExploration.result,
        score: latestExploration.scored?.score,
        pnl: latestExploration.raw?.pnl,
        strategy: latestExploration.raw?.strategyUsed
      } : null,
      promotion: latestPromotion ? {
        asset: latestPromotion.raw?.asset,
        action: latestPromotion.action,
        result: latestPromotion.result,
        score: latestPromotion.scored?.score,
        pnl: latestPromotion.raw?.pnl,
        strategy: latestPromotion.raw?.strategyUsed
      } : null
    },
    moonDevProcess: [
      "market scan",
      "MoonDev strategy signal",
      "swarm/consensus review",
      "risk veto",
      "paper execution",
      "measured paper result",
      "learning memory",
      "promotion only if 95% gate passes"
    ],
    safety: {
      liveTradingEnabled: false,
      privateKeysInsideNexora: false,
      walletSigningInsideNexora: false,
      bankTransfersEnabled: false,
      externalSignerRequiredForReal: true,
      humanApprovalRequiredForReal: true
    }
  };
}

export function registerNexoraMoonDevParityRoutes(app: Express): void {
  app.get("/api/nexora/moondev-parity/status", (_req, res) => {
    res.json(buildParityReport());
  });

  app.get("/api/nexora/moondev-parity/promotion", (_req, res) => {
    const report = buildParityReport();
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_moondev_parity_promotion_gate",
      generatedAt: now(),
      status: report.status,
      target: report.target,
      promotion: report.promotion,
      assets: report.assets.promotion,
      safety: report.safety
    });
  });
}
