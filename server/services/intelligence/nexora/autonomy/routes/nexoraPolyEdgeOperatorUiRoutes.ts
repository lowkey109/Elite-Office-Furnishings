import type { Express } from "express";

function page(): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Nexora Poly Edge Control</title>
  <style>
    body{margin:0;background:#05070d;color:#eaf3ff;font-family:Inter,system-ui,sans-serif}
    .wrap{max-width:1300px;margin:0 auto;padding:28px 16px 60px}
    h1{margin:0;font-size:32px;letter-spacing:-.04em}
    .sub{color:#91a1b9;margin:8px 0 22px;line-height:1.5}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .card{background:#0d1420;border:1px solid #1b2c45;border-radius:16px;padding:15px;min-height:190px}
    .card h2{font-size:15px;margin:0 0 10px;color:#d7e8ff}
    pre{white-space:pre-wrap;overflow:auto;max-height:270px;background:#05080d;border:1px solid #17263c;border-radius:12px;padding:10px;font-size:11px;color:#bfe3ff}
    button{background:#2d7dff;color:#fff;border:0;border-radius:10px;padding:9px 12px;font-weight:700;margin:4px 6px 8px 0;cursor:pointer}
    button.lock{background:#2a1d22;color:#ffbdc6;border:1px solid #66313c}
    .wide{grid-column:span 3}
    .pill{display:inline-block;background:#0e2a1c;color:#8fffc2;border:1px solid #1f7048;border-radius:999px;padding:6px 10px;font-size:12px;margin-top:8px}
    .warn{background:#241a08;border:1px solid #6b4a10;color:#ffd88c;border-radius:12px;padding:12px;margin-top:12px}
    @media(max-width:900px){.grid{grid-template-columns:1fr}.wide{grid-column:span 1}}
  </style>
</head>
<body>
<div class="wrap">
  <h1>Nexora Poly Edge Control</h1>
  <div class="sub">
    One operator screen for MoonDev strategy brain, paper practice, learning memory, final readiness,
    moving charts, bank-connect scaffold, and live-money safety.
  </div>
  <div class="pill">PAPER LEARNING ACTIVE · REAL MONEY LOCKED</div>

  <div class="grid" style="margin-top:18px">
    <div class="card"><h2>MoonDev Strategy Brain</h2><button onclick="load('moon','/api/nexora/moondev-strategy-import/status')">Refresh</button><pre id="moon">Waiting...</pre></div>
    <div class="card"><h2>Paper Trader Practice</h2><button onclick="load('practice','/api/nexora/paper-practice/status')">Refresh</button><pre id="practice">Waiting...</pre></div>
    <div class="card"><h2>Learning Memory</h2><button onclick="load('learning','/api/nexora/learning-memory/status')">Refresh</button><pre id="learning">Waiting...</pre></div>

    <div class="card"><h2>Final Readiness</h2><button onclick="load('final','/api/nexora/poly-builds/final/latest')">Refresh</button><pre id="final">Waiting...</pre></div>
    <div class="card"><h2>Live-Money Safety</h2><button class="lock" onclick="load('live','/api/nexora/live-money/status')">Check Lock</button><pre id="live">Waiting...</pre></div>
    <div class="card"><h2>Bank Connect</h2><button onclick="load('bank','/api/nexora/bank-connect/status')">Refresh</button><pre id="bank">Waiting...</pre></div>

    <div class="card"><h2>Moving Terminal Chart</h2><button onclick="load('terminal','/api/nexora/poly-charts/terminal')">Refresh</button><pre id="terminal">Waiting...</pre></div>
    <div class="card"><h2>Force Graph Signals</h2><button onclick="load('graph','/api/nexora/poly-charts/force-graph')">Refresh</button><pre id="graph">Waiting...</pre></div>
    <div class="card"><h2>DB / Recovery Safety</h2><button onclick="load('db','/api/nexora/db/safety')">Refresh</button><pre id="db">Waiting...</pre></div>

    <div class="card wide">
      <h2>Operator Rules</h2>
      <div class="warn">
        Nexora may practice, learn, score, and draft trade intent. Nexora may not place live trades,
        move bank money, store private keys, sign wallets, or bypass human approval.
      </div>
      <pre id="summary">Loading...</pre>
    </div>
  </div>
</div>

<script>
async function getJson(url){
  const res = await fetch(url,{headers:{Accept:"application/json"}});
  const text = await res.text();
  try{return JSON.parse(text)}catch{return {ok:false, nonJson:text.slice(0,500)}}
}
function short(data){
  if(data && data.report && data.report.latestRanking){
    return {
      ok:data.ok,
      service:data.service,
      counts:data.report.counts,
      top:(data.report.latestRanking.top||[]).slice(0,3).map(x=>({name:x.name,score:x.finalScore,action:x.action}))
    }
  }
  if(data && data.state && data.state.latestEvent){
    return {
      ok:data.ok,
      service:data.service,
      events:data.state.events,
      lessons:data.state.lessons,
      latest:{
        domain:data.state.latestEvent.domain,
        action:data.state.latestEvent.action,
        result:data.state.latestEvent.result,
        score:data.state.latestEvent.scored && data.state.latestEvent.scored.score
      }
    }
  }
  return data
}
async function load(id,url){
  const el=document.getElementById(id);
  el.textContent="Loading...";
  const data=await getJson(url);
  el.textContent=JSON.stringify(short(data),null,2).slice(0,2200);
}
async function refreshAll(){
  await load("moon","/api/nexora/moondev-strategy-import/status");
  await load("practice","/api/nexora/paper-practice/status");
  await load("learning","/api/nexora/learning-memory/status");
  await load("final","/api/nexora/poly-builds/final/latest");
  await load("live","/api/nexora/live-money/status");
  await load("bank","/api/nexora/bank-connect/status");
  await load("terminal","/api/nexora/poly-charts/terminal");
  await load("graph","/api/nexora/poly-charts/force-graph");
  await load("db","/api/nexora/db/safety");
  document.getElementById("summary").textContent=JSON.stringify({
    moonDev:"connected as strategy/reference brain",
    paperTrader:"running/practicing",
    learning:"records events, lessons, playbook, recommendations",
    realMoney:"prepared but locked",
    bank:"read-only scaffold only",
    safety:["no live trading","no wallet signing","no private keys","no auto bank transfers"]
  },null,2);
}
refreshAll();
setInterval(refreshAll,30000);
</script>
</body>
</html>`;
}

export function registerNexoraPolyEdgeOperatorUiRoutes(app: Express): void {
  app.get("/nexora/operator/poly-edge", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  });

  app.get("/api/nexora/poly-edge-ui/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_edge_operator_ui_status",
      generatedAt: new Date().toISOString(),
      uiRoute: "/nexora/operator/poly-edge",
      cards: [
        "moondev_strategy_brain",
        "paper_trader_practice",
        "learning_memory",
        "final_readiness",
        "live_money_safety",
        "bank_connect",
        "moving_terminal_chart",
        "force_graph_signals",
        "db_recovery_safety"
      ],
      safety: {
        liveTradingEnabled: false,
        privateKeysInsideNexora: false,
        walletSigningInsideNexora: false,
        automaticBankTransfers: false
      }
    });
  });
}
