import { fetchLivePrices, fetchDetailedMarketData } from "./marketDataAdapter";
import { writeSnapshots, pruneOldSnapshots } from "./marketSnapshots";
import { markOpenPaperPositions } from "./positionMarker";
import { evaluateExits } from "./exitEvaluator";

const FAST_INTERVAL_MS = 15_000;
const DETAILED_INTERVAL_MS = 60_000;
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

let fastTimer: ReturnType<typeof setInterval> | null = null;
let detailedTimer: ReturnType<typeof setInterval> | null = null;
let pruneTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastFastCycleAt: Date | null = null;
let lastDetailedCycleAt: Date | null = null;
let cycleErrors = 0;

export function isMarketLoopRunning(): boolean {
  return isRunning;
}

export function getMarketLoopStatus() {
  return {
    isRunning,
    lastFastCycleAt: lastFastCycleAt?.toISOString() ?? null,
    lastDetailedCycleAt: lastDetailedCycleAt?.toISOString() ?? null,
    cycleErrors,
  };
}

export function startMarketLoop(): void {
  if (process.env.PHANTOM_X_MARKET_LOOP_ENABLED !== "true") {
    console.log("[MarketLoop] Not started — controlled worker disabled unless PHANTOM_X_MARKET_LOOP_ENABLED=true");
    return;
  }

  if (isRunning) return;
  isRunning = true;
  console.log("[MarketLoop] Starting as controlled worker — fast: 15s, detailed: 60s");

  runFastCycle();

  setTimeout(() => runDetailedCycle(), 5000);

  fastTimer = setInterval(() => runFastCycle(), FAST_INTERVAL_MS);
  detailedTimer = setInterval(() => runDetailedCycle(), DETAILED_INTERVAL_MS);
  pruneTimer = setInterval(() => runPrune(), PRUNE_INTERVAL_MS);
}

export function stopMarketLoop(): void {
  if (!isRunning) return;
  isRunning = false;
  if (fastTimer) { clearInterval(fastTimer); fastTimer = null; }
  if (detailedTimer) { clearInterval(detailedTimer); detailedTimer = null; }
  if (pruneTimer) { clearInterval(pruneTimer); pruneTimer = null; }
  console.log("[MarketLoop] Stopped");
}

async function runFastCycle(): Promise<void> {
  try {
    const feeds = await fetchLivePrices();
    const available = feeds.filter(f => f.available);
    if (available.length === 0) {
      cycleErrors++;
      return;
    }

    await writeSnapshots(available);

    const marks = await markOpenPaperPositions();

    const exits = await evaluateExits();

    lastFastCycleAt = new Date();

    if (exits.length > 0) {
      console.log(`[MarketLoop] ${exits.length} position(s) auto-exited: ${exits.map(e => `${e.symbol} ${e.exitReason} PnL:${e.realizedPnl}`).join(", ")}`);
    }
  } catch (err: unknown) {
    cycleErrors++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MarketLoop] fast cycle error: ${msg}`);
  }
}

async function runDetailedCycle(): Promise<void> {
  try {
    const feeds = await fetchDetailedMarketData();
    const available = feeds.filter(f => f.available);
    if (available.length > 0) {
      await writeSnapshots(available);
    }
    lastDetailedCycleAt = new Date();
  } catch (err: unknown) {
    cycleErrors++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MarketLoop] detailed cycle error: ${msg}`);
  }
}

async function runPrune(): Promise<void> {
  try {
    const removed = await pruneOldSnapshots(48);
    if (removed > 0) {
      console.log(`[MarketLoop] Pruned ${removed} old snapshots`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MarketLoop] prune error: ${msg}`);
  }
}
