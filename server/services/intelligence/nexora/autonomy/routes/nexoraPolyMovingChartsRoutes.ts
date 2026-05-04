import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-moving-charts");
const STATE = path.join(ROOT, "state.json");
const EVENTS = path.join(ROOT, "events.jsonl");

function now() {
  return new Date().toISOString();
}

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    mode: "paper_visualization",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false,
    humanApprovalRequiredForReal: true,
    externalSignerRequiredForReal: true,
  };
}

function readState(): R {
  ensure();
  try {
    if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {}

  return {
    ok: true,
    service: "nexora_poly_moving_charts_state",
    createdAt: now(),
    updatedAt: now(),
    ticks: 0,
    latestTerminal: null,
    latestForceGraph: null,
    latestLoop: null,
    safety: safety(),
  };
}

function save(patch: R): R {
  ensure();
  const next = {
    ...readState(),
    ...patch,
    updatedAt: now(),
    safety: safety(),
  };
  fs.writeFileSync(STATE, JSON.stringify(next, null, 2));
  return next;
}

function log(type: string, payload: R) {
  ensure();
  fs.appendFileSync(EVENTS, JSON.stringify({ ts: now(), type, ...payload }) + "\n");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeTerminalChart(seedInput: R = {}) {
  const state = readState();
  const tick = Number(state.ticks || 0) + 1;
  const base = Number(seedInput.basePrice || 77499);
  const wave = Math.sin(tick / 3) * 58;
  const drift = tick * 3.7;
  const shock = tick % 9 === 0 ? -120 : tick % 13 === 0 ? 150 : 0;
  const price = Math.round((base + wave + drift + shock) * 100) / 100;

  const yes = clamp(0.5 + ((price - base) / 2400), 0.08, 0.92);
  const confidence = clamp(55 + Math.sin(tick / 4) * 18 + (yes - 0.5) * 35, 1, 99);

  const candles = Array.from({ length: 42 }).map((_, i) => {
    const local = tick + i - 41;
    const open = base + Math.sin(local / 4) * 75 + local * 2.1;
    const close = open + Math.sin(local / 2) * 28;
    const high = Math.max(open, close) + 18 + (i % 4) * 3;
    const low = Math.min(open, close) - 18 - (i % 3) * 3;
    return {
      index: i,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(900 + Math.abs(Math.sin(local)) * 450 + i * 7),
    };
  });

  const orderBook = Array.from({ length: 12 }).map((_, i) => {
    const offset = i - 6;
    return {
      level: i + 1,
      price: Math.round((price + offset * 2.5) * 100) / 100,
      bidSize: Math.round((60 + Math.abs(Math.sin(tick + i)) * 120) * 100) / 100,
      askSize: Math.round((55 + Math.abs(Math.cos(tick + i)) * 130) * 100) / 100,
    };
  });

  const trades = Array.from({ length: 10 }).map((_, i) => {
    const side = (tick + i) % 3 === 0 ? "BUY" : "SELL";
    return {
      id: `paper-trade-${tick}-${i}`,
      side,
      price: Math.round((price + Math.sin(i) * 9) * 100) / 100,
      size: Math.round((20 + Math.abs(Math.cos(tick + i)) * 90) * 100) / 100,
      paperOnly: true,
    };
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_terminal_chart",
    generatedAt: now(),
    tick,
    title: "PolyMarket Terminal",
    symbol: seedInput.symbol || "BTC / Polymarket",
    price,
    yesProbability: Math.round(yes * 10000) / 100,
    confidence: Math.round(confidence * 100) / 100,
    signal: yes > 0.56 ? "PAPER_LONG_YES" : yes < 0.44 ? "PAPER_FADE_YES" : "PAPER_HOLD",
    candles,
    orderBook,
    trades,
    safety: safety(),
  };
}

function makeForceGraph(seedInput: R = {}) {
  const state = readState();
  const tick = Number(state.ticks || 0) + 1;

  const groups = ["momentum", "liquidity", "risk", "sentiment", "moondev", "execution"];
  const nodes = Array.from({ length: 42 }).map((_, i) => {
    const group = groups[i % groups.length];
    const pulse = Math.abs(Math.sin((tick + i) / 5));
    return {
      id: `node-${i}`,
      label: `${group}-${i}`,
      group,
      size: Math.round((6 + pulse * 18 + (i % 7)) * 100) / 100,
      score: Math.round(clamp(40 + pulse * 50 - (group === "risk" ? 8 : 0), 0, 100) * 100) / 100,
      x: Math.round((Math.sin(i * 1.7 + tick / 5) * 100) * 100) / 100,
      y: Math.round((Math.cos(i * 1.3 + tick / 6) * 70) * 100) / 100,
    };
  });

  const links = Array.from({ length: 58 }).map((_, i) => {
    const source = i % nodes.length;
    const target = (i * 7 + tick) % nodes.length;
    return {
      source: `node-${source}`,
      target: `node-${target}`,
      strength: Math.round(clamp(Math.abs(Math.sin((i + tick) / 4)), 0.05, 1) * 100) / 100,
      type: groups[i % groups.length],
    };
  });

  const clusters = groups.map((group) => {
    const members = nodes.filter((n) => n.group === group);
    const avg = members.reduce((s, n) => s + Number(n.score || 0), 0) / Math.max(1, members.length);
    return {
      group,
      nodes: members.length,
      averageScore: Math.round(avg * 100) / 100,
      status: group === "risk" && avg < 55 ? "watch" : avg >= 70 ? "strong" : "neutral",
    };
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_force_graph",
    generatedAt: now(),
    tick,
    title: "Poly Signal Force Graph",
    nodes,
    links,
    clusters,
    highlightedPath: ["moondev", "momentum", "liquidity", "risk", "execution"],
    safety: safety(),
  };
}

function tick(input: R = {}) {
  const previous = readState();
  const nextTick = Number(previous.ticks || 0) + 1;
  const terminal = makeTerminalChart({ ...input, tick: nextTick });
  const forceGraph = makeForceGraph({ ...input, tick: nextTick });

  const loop = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_moving_charts_tick",
    generatedAt: now(),
    tick: nextTick,
    chartsUpdated: [
      "terminal_chart",
      "force_graph",
    ],
    paperSignal: terminal.signal,
    graphStatus: forceGraph.clusters,
    safety: safety(),
  };

  const state = save({
    ticks: nextTick,
    latestTerminal: terminal,
    latestForceGraph: forceGraph,
    latestLoop: loop,
  });

  log("moving_charts_tick", { tick: nextTick, signal: terminal.signal });

  return {
    ...loop,
    terminal,
    forceGraph,
    state,
  };
}

export function registerNexoraPolyMovingChartsRoutes(app: Express): void {
  app.get("/api/nexora/poly-charts/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_moving_charts_status",
      generatedAt: now(),
      state: readState(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-charts/tick", (req, res) => {
    res.json(tick((req.body || {}) as R));
  });

  app.get("/api/nexora/poly-charts/terminal", (_req, res) => {
    const state = readState();
    res.json(state.latestTerminal || makeTerminalChart({}));
  });

  app.get("/api/nexora/poly-charts/force-graph", (_req, res) => {
    const state = readState();
    res.json(state.latestForceGraph || makeForceGraph({}));
  });

  app.get("/api/nexora/poly-charts/latest", (_req, res) => {
    const state = readState();
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_moving_charts_latest",
      generatedAt: now(),
      terminal: state.latestTerminal || makeTerminalChart({}),
      forceGraph: state.latestForceGraph || makeForceGraph({}),
      latestLoop: state.latestLoop || null,
      safety: safety(),
    });
  });
}
