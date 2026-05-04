import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraMetrics } from "../warehouse/nexoraLocalWarehouse";
import { getNexoraTimeline } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("polymarket-ui", "journal", "polymarket-ui-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeRead(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function count(file: string, event?: string) {
  const rows = safeRead(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

function latest(file: string, limit = 25) {
  return safeRead(file).slice(-limit).reverse();
}

function esc(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function badge(label: string, value: any) {
  return `<div class="badge"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
}

function table(rows: any[]) {
  if (!rows.length) return `<p class="muted">No records yet.</p>`;
  return `<table><thead><tr><th>Record</th></tr></thead><tbody>${rows.map((row) => `<tr><td><pre>${esc(JSON.stringify(row, null, 2))}</pre></td></tr>`).join("")}</tbody></table>`;
}

function layout(title: string, body: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { --bg:#070b14; --panel:#10192c; --panel2:#14213a; --line:#27476d; --text:#f5f9ff; --muted:#9eb3cc; --blue:#6bb7ff; --green:#5df2a6; --yellow:#ffd166; --red:#ff647c; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:Inter,Arial,sans-serif; }
    header { padding:28px; background:linear-gradient(135deg,#111f3b,#070b14); border-bottom:1px solid var(--line); }
    h1 { margin:0 0 8px; font-size:28px; }
    p { color:var(--muted); }
    nav { display:flex; flex-wrap:wrap; gap:10px; padding:14px 24px; background:#0b1425; border-bottom:1px solid var(--line); position:sticky; top:0; z-index:10; }
    nav a { color:var(--text); text-decoration:none; border:1px solid var(--line); padding:9px 12px; border-radius:10px; background:var(--panel); }
    main { max-width:1500px; margin:0 auto; padding:24px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; margin-bottom:18px; }
    .badge { background:var(--panel2); border:1px solid var(--line); border-radius:14px; padding:16px; }
    .badge strong { display:block; color:var(--blue); font-size:26px; }
    .badge span { color:var(--muted); }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:18px; margin-bottom:18px; }
    .panel h2 { margin-top:0; }
    pre { white-space:pre-wrap; overflow:auto; background:#050810; border:1px solid var(--line); border-radius:10px; padding:12px; color:#d9e8ff; }
    table { width:100%; border-collapse:collapse; }
    th,td { border-bottom:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; }
    th { color:var(--muted); }
    .muted { color:var(--muted); }
    .ok { color:var(--green); } .warn { color:var(--yellow); } .bad { color:var(--red); }
  </style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  <p>Phantom X / Polymarket paper intelligence. No live orders. No private keys. No wallet signing.</p>
</header>
<nav>
  <a href="/nexora/polymarket">Dashboard</a>
  <a href="/nexora/polymarket/signals">Signals</a>
  <a href="/nexora/polymarket/backtests">Backtests</a>
  <a href="/nexora/polymarket/execution">Execution Safety</a>
  <a href="/nexora/polymarket/research">Research Bridge</a>
  <a href="/nexora/polymarket/readiness">Readiness Gate</a>
</nav>
<main>${body}</main>
</body>
</html>`;
}

export function getNexoraPolymarketOperatorSummary() {
  const summary = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_operator_summary",
    generatedAt: now(),
    counts: {
      marketSignals: count(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), "paper_signal.created"),
      marketEdges: count(nexoraLocalPath("market-data", "edges", "edge-log.jsonl"), "edge.detected"),
      collectorSignals: count(nexoraLocalPath("polymarket-collector", "signals", "collector-signals.jsonl"), "collector.edge_signal"),
      superstackOrders: count(nexoraLocalPath("polymarket-superstack", "paper-orders", "orders.jsonl")),
      backtestRuns: count(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), "backtest.run"),
      tradingMegaExecutions: count(nexoraLocalPath("trading-mega", "paper-execution", "paper-execution-log.jsonl")),
      tradingExecutionIntents: count(nexoraLocalPath("trading-execution", "intents", "order-intent-log.jsonl"), "order_intent.created"),
      tradingExecutionFills: count(nexoraLocalPath("trading-execution", "fills", "simulated-fill-log.jsonl"), "simulated_fill.created"),
      readinessGates: count(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), "promotion_gate.evaluated"),
      moondevAudits: count(nexoraLocalPath("moondev-bridge", "audits", "moondev-audit-log.jsonl")),
      moondevAdoptionAudits: count(nexoraLocalPath("moondev-adoption", "inventory", "inventory-log.jsonl")),
    },
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      humansOnlyApproveSignCommit: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-ui", "snapshots", "latest-summary.json"), summary);
  journal("polymarket_ui.summary", summary);

  return summary;
}

export function renderNexoraPolymarketDashboard() {
  const s = getNexoraPolymarketOperatorSummary();
  return layout("Nexora Polymarket Paper Dashboard", `
    <div class="grid">
      ${badge("Signals", s.counts.marketSignals)}
      ${badge("Edges", s.counts.marketEdges)}
      ${badge("Collector Signals", s.counts.collectorSignals)}
      ${badge("Backtests", s.counts.backtestRuns)}
      ${badge("Intents", s.counts.tradingExecutionIntents)}
      ${badge("Fills", s.counts.tradingExecutionFills)}
      ${badge("Readiness Gates", s.counts.readinessGates)}
      ${badge("MoonDev Audits", s.counts.moondevAudits + s.counts.moondevAdoptionAudits)}
    </div>
    <div class="panel"><h2>Safety</h2><p><span class="ok">Paper only.</span> No live orders. No private keys. No wallet signing.</p></div>
    <div class="panel"><h2>Next Actions</h2><ul>
      <li>Run market-data sample cycle.</li>
      <li>Run backtest.</li>
      <li>Run swarm consensus.</li>
      <li>Create paper execution intent.</li>
      <li>Review readiness gate before any future promotion discussion.</li>
    </ul></div>
    <div class="panel"><h2>Summary</h2><pre>${esc(JSON.stringify(s, null, 2))}</pre></div>
  `);
}

export function renderNexoraPolymarketSignals() {
  const signals = [
    ...latest(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), 30),
    ...latest(nexoraLocalPath("polymarket-collector", "signals", "collector-signals.jsonl"), 30),
    ...latest(nexoraLocalPath("trading-lab", "signals", "signal-log.jsonl"), 30),
  ];
  return layout("Nexora Polymarket Signals", `
    <div class="grid">${badge("Signal Records", signals.length)}</div>
    <div class="panel"><h2>Recent Signals</h2>${table(signals)}</div>
  `);
}

export function renderNexoraPolymarketBacktests() {
  const runs = latest(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), 40);
  const pnl = latest(nexoraLocalPath("backtesting", "pnl", "pnl-log.jsonl"), 40);
  return layout("Nexora Polymarket Backtests", `
    <div class="grid">${badge("Backtest Runs", runs.length)}${badge("PnL Records", pnl.length)}</div>
    <div class="panel"><h2>Backtest Runs</h2>${table(runs)}</div>
    <div class="panel"><h2>PnL Records</h2>${table(pnl)}</div>
  `);
}

export function renderNexoraPolymarketExecution() {
  const intents = latest(nexoraLocalPath("trading-execution", "intents", "order-intent-log.jsonl"), 30);
  const fills = latest(nexoraLocalPath("trading-execution", "fills", "simulated-fill-log.jsonl"), 30);
  const recon = latest(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"), 30);
  const kill = latest(nexoraLocalPath("trading-execution", "kill-switch", "kill-switch-log.jsonl"), 30);
  return layout("Nexora Polymarket Execution Safety", `
    <div class="grid">${badge("Intents", intents.length)}${badge("Fills", fills.length)}${badge("Reconciliation", recon.length)}</div>
    <div class="panel"><h2>Execution Safety</h2><p><span class="ok">Simulated only.</span> Live execution is blocked.</p></div>
    <div class="panel"><h2>Intents</h2>${table(intents)}</div>
    <div class="panel"><h2>Fills</h2>${table(fills)}</div>
    <div class="panel"><h2>Reconciliation</h2>${table(recon)}</div>
  `);
}

export function renderNexoraPolymarketResearch() {
  const bridge = latest(nexoraLocalPath("research-bridge", "audits", "research-audit-log.jsonl"), 20);
  const adoption = latest(nexoraLocalPath("moondev-adoption", "inventory", "inventory-log.jsonl"), 20);
  const danger = [
    ...latest(nexoraLocalPath("research-bridge", "danger", "danger-log.jsonl"), 20),
    ...latest(nexoraLocalPath("moondev-adoption", "quarantine", "quarantine-log.jsonl"), 20),
  ];
  return layout("Nexora Polymarket Research Bridge", `
    <div class="grid">${badge("Research Audits", bridge.length)}${badge("Adoption Audits", adoption.length)}${badge("Danger/Quarantine", danger.length)}</div>
    <div class="panel"><h2>Research Bridge</h2>${table(bridge)}</div>
    <div class="panel"><h2>MoonDev Adoption</h2>${table(adoption)}</div>
    <div class="panel"><h2>Danger / Quarantine</h2>${table(danger)}</div>
  `);
}

export function renderNexoraPolymarketReadiness() {
  const gates = latest(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), 30);
  const evidence = latest(nexoraLocalPath("trading-readiness", "evidence", "evidence-log.jsonl"), 30);
  const reviews = latest(nexoraLocalPath("trading-readiness", "operator-review", "operator-review-log.jsonl"), 30);
  return layout("Nexora Polymarket Readiness Gate", `
    <div class="grid">${badge("Gates", gates.length)}${badge("Evidence Packs", evidence.length)}${badge("Owner Reviews", reviews.length)}</div>
    <div class="panel"><h2>Readiness Rule</h2><p><span class="bad">Live trading remains blocked.</span> Future promotion requires human commit and a separate safety build.</p></div>
    <div class="panel"><h2>Gates</h2>${table(gates)}</div>
    <div class="panel"><h2>Evidence</h2>${table(evidence)}</div>
    <div class="panel"><h2>Reviews</h2>${table(reviews)}</div>
  `);
}
