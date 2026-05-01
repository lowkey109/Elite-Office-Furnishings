import { db } from "../../db";
import { desc, inArray } from "drizzle-orm";
import { paperTradeOutcomes, paperTradingDecisions, paperPositions } from "@shared/schema";

function n(value: unknown, fallback = 0) {
  const x = typeof value === "number" ? value : Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function maybe(value: unknown) {
  const x = typeof value === "number" ? value : Number(value);
  return Number.isFinite(x) ? x : null;
}

function key(value: unknown) {
  return String(value || "unknown").trim() || "unknown";
}

function pct(wins: number, total: number) {
  return total ? Math.round((wins / total) * 10000) / 100 : 0;
}

function confidenceBand(confidence: number | null) {
  const c = n(confidence, 0);
  if (c >= 90) return "90-100";
  if (c >= 80) return "80-89";
  if (c >= 70) return "70-79";
  if (c >= 60) return "60-69";
  if (c >= 50) return "50-59";
  return "0-49";
}

function groupStats(rows: any[], groupKey: (row: any) => string) {
  const map = new Map<string, any>();

  for (const row of rows) {
    const k = groupKey(row);
    const current = map.get(k) || {
      key: k,
      trades: 0,
      wins: 0,
      losses: 0,
      pnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      avgConfidence: 0,
      avgSlippage: 0,
      avgRiskReward: 0,
    };

    const pnl = n(row.realizedPnl);
    const win = row.outcome === "win" || pnl > 0;

    current.trades += 1;
    current.wins += win ? 1 : 0;
    current.losses += win ? 0 : 1;
    current.pnl += pnl;
    if (pnl > 0) current.grossProfit += pnl;
    if (pnl < 0) current.grossLoss += Math.abs(pnl);
    current.avgConfidence += n(row.confidence);
    current.avgSlippage += n(row.slippage);
    current.avgRiskReward += n(row.riskReward);

    map.set(k, current);
  }

  return [...map.values()]
    .map((row) => {
      const winRate = pct(row.wins, row.trades);
      const profitFactor =
        row.grossLoss > 0 ? Math.round((row.grossProfit / row.grossLoss) * 100) / 100 : row.grossProfit > 0 ? 99 : 0;

      return {
        ...row,
        pnl: Math.round(row.pnl * 100) / 100,
        avgPnl: Math.round((row.pnl / Math.max(1, row.trades)) * 100) / 100,
        winRate,
        profitFactor,
        avgConfidence: Math.round((row.avgConfidence / Math.max(1, row.trades)) * 100) / 100,
        avgSlippage: Math.round((row.avgSlippage / Math.max(1, row.trades)) * 100) / 100,
        avgRiskReward: Math.round((row.avgRiskReward / Math.max(1, row.trades)) * 100) / 100,
        block: row.trades >= 12 && (winRate < 48 || row.pnl < 0 || profitFactor < 1),
      };
    })
    .sort((a, b) => b.trades - a.trades);
}

export async function buildPolyEdgeLearningDataset(limit = 1000) {
  const outcomes: any[] = await db
    .select()
    .from(paperTradeOutcomes)
    .orderBy(desc(paperTradeOutcomes.createdAt))
    .limit(limit);

  const decisionIds = [...new Set(outcomes.map((o) => String(o.linkedDecisionId)).filter(Boolean))];
  const positionIds = [...new Set(outcomes.map((o) => String(o.linkedPositionId)).filter(Boolean))];

  const decisions: any[] = decisionIds.length
    ? await db.select().from(paperTradingDecisions).where(inArray(paperTradingDecisions.id, decisionIds))
    : [];

  const positions: any[] = positionIds.length
    ? await db.select().from(paperPositions).where(inArray(paperPositions.id, positionIds))
    : [];

  const decisionById = new Map(decisions.map((d) => [String(d.id), d]));
  const positionById = new Map(positions.map((p) => [String(p.id), p]));

  const rows = outcomes.map((o) => {
    const d = decisionById.get(String(o.linkedDecisionId)) || {};
    const p = positionById.get(String(o.linkedPositionId)) || {};

    const entryPrice = n(o.entryPrice || p.entryPrice);
    const targetPrice = maybe(p.targetPrice);
    const stopPrice = maybe(p.stopPrice);

    const targetDistancePct =
      entryPrice > 0 && targetPrice !== null ? Math.round(Math.abs((targetPrice - entryPrice) / entryPrice) * 10000) / 100 : null;

    const stopDistancePct =
      entryPrice > 0 && stopPrice !== null ? Math.round(Math.abs((entryPrice - stopPrice) / entryPrice) * 10000) / 100 : null;

    const riskReward =
      stopDistancePct && stopDistancePct > 0 && targetDistancePct !== null
        ? Math.round((targetDistancePct / stopDistancePct) * 100) / 100
        : maybe(d.fullPayload?.riskReward);

    return {
      outcomeId: String(o.id),
      decisionId: String(o.linkedDecisionId),
      positionId: String(o.linkedPositionId),
      symbol: key(o.symbol || p.symbol || d.market),
      strategy: key(o.strategy || p.strategy || d.strategy),
      direction: key(o.direction || p.side || d.direction),
      confidence: maybe(d.confidence),
      confidenceThreshold: maybe(d.confidenceThreshold),
      regime: key(d.regime),
      volumeRatio: maybe(d.volumeRatio),
      expectedMove: maybe(d.expectedMove),
      slippageEstimate: maybe(d.slippageEstimate),
      riskBucket: key(d.riskBucket),
      dataQualityScore: maybe(d.dataQualityScore),
      reasonCode: key(d.reasonCode),
      entryPrice,
      exitPrice: n(o.exitPrice),
      realizedPnl: n(o.realizedPnl),
      fees: n(o.fees),
      slippage: n(o.slippage),
      outcome: key(o.outcome).toLowerCase(),
      exitReason: key(o.exitReason),
      duration: key(o.duration),
      riskReward,
      targetDistancePct,
      stopDistancePct,
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  const wins = rows.filter((r) => r.outcome === "win" || r.realizedPnl > 0).length;
  const pnl = rows.reduce((sum, row) => sum + row.realizedPnl, 0);
  const grossProfit = rows.filter((r) => r.realizedPnl > 0).reduce((sum, row) => sum + row.realizedPnl, 0);
  const grossLoss = Math.abs(rows.filter((r) => r.realizedPnl < 0).reduce((sum, row) => sum + row.realizedPnl, 0));

  const byStrategy = groupStats(rows, (r) => r.strategy);
  const bySymbol = groupStats(rows, (r) => r.symbol);
  const byPair = groupStats(rows, (r) => `${r.symbol}|${r.strategy}`);
  const byRegime = groupStats(rows, (r) => r.regime);
  const byConfidence = groupStats(rows, (r) => confidenceBand(r.confidence));
  const byExitReason = groupStats(rows, (r) => r.exitReason);

  const winRate = pct(wins, rows.length);
  const confidenceFloor = rows.length >= 100 && winRate < 50 ? 78 : rows.length >= 100 && winRate < 55 ? 72 : 64;

  return {
    ok: true,
    paperOnlyTrading: true,
    sampleSize: rows.length,
    winRate,
    pnl: Math.round(pnl * 100) / 100,
    profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 99 : 0,
    confidenceFloor,
    mode: rows.length >= 100 && winRate < 50 ? "TIGHTEN" : "NORMAL",
    blockedPairs: byPair.filter((x) => x.block).slice(0, 20),
    blockedStrategies: byStrategy.filter((x) => x.block).slice(0, 10),
    blockedSymbols: bySymbol.filter((x) => x.block).slice(0, 10),
    bestPairs: [...byPair].filter((x) => x.trades >= 8 && !x.block).sort((a, b) => b.pnl - a.pnl).slice(0, 12),
    byStrategy,
    bySymbol,
    byPair,
    byRegime,
    byConfidence,
    byExitReason,
    missingData: {
      confidence: rows.filter((r) => r.confidence === null).length,
      regime: rows.filter((r) => r.regime === "unknown").length,
      volumeRatio: rows.filter((r) => r.volumeRatio === null).length,
      expectedMove: rows.filter((r) => r.expectedMove === null).length,
      slippageEstimate: rows.filter((r) => r.slippageEstimate === null).length,
      riskReward: rows.filter((r) => r.riskReward === null).length,
    },
    latestRows: rows.slice(0, 25),
    message:
      rows.length >= 100 && winRate < 50
        ? `TIGHTEN: ${winRate}% over ${rows.length} trades. Block weak pairs and require confidence ${confidenceFloor}.`
        : `NORMAL: ${winRate}% over ${rows.length} trades.`,
    updatedAt: new Date().toISOString(),
  };
}

export async function scorePolyEdgeCandidate(candidate: any) {
  const dataset = await buildPolyEdgeLearningDataset(1000);

  const symbol = key(candidate.symbol);
  const strategy = key(candidate.strategy);
  const pairKey = `${symbol}|${strategy}`;
  const confidence = n(candidate.confidence);

  const pair = dataset.byPair.find((x: any) => x.key === pairKey);
  const strat = dataset.byStrategy.find((x: any) => x.key === strategy);
  const sym = dataset.bySymbol.find((x: any) => x.key === symbol);

  const reasons: string[] = [];
  let allowed = true;
  let score = 50;

  if (confidence < dataset.confidenceFloor) {
    allowed = false;
    reasons.push(`confidence ${confidence} below learned floor ${dataset.confidenceFloor}`);
  }

  for (const item of [pair, strat, sym].filter(Boolean) as any[]) {
    if (item.block) {
      allowed = false;
      reasons.push(`${item.key} blocked: ${item.winRate}% win rate, PnL ${item.pnl}`);
    } else {
      score += Math.max(-20, Math.min(20, item.winRate - 50));
    }
  }

  const rr = maybe(candidate.riskReward);
  if (rr !== null && rr < 1.4) {
    allowed = false;
    reasons.push(`risk/reward ${rr} below 1.4`);
  }

  const slippage = maybe(candidate.slippageEstimate);
  if (slippage !== null && slippage > 0.12) {
    allowed = false;
    reasons.push(`slippage estimate ${slippage} too high`);
  }

  return {
    ok: true,
    paperOnlyTrading: true,
    allowed,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.length ? reasons : ["candidate passed learned filters"],
    candidate: { symbol, strategy, confidence, regime: candidate.regime || null },
    datasetSummary: {
      sampleSize: dataset.sampleSize,
      winRate: dataset.winRate,
      confidenceFloor: dataset.confidenceFloor,
      mode: dataset.mode,
    },
    matchedHistory: { pair, strategy: strat, symbol: sym },
    updatedAt: new Date().toISOString(),
  };
}
