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
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readJson(file: string, fallback: R = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}


function readSyncedPaperSummary(): any | null {
  const file = path.join(process.cwd(), "data", "nexora", "local", "paper-summary", "latest-summary.json");
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {}
  return null;
}

function buildState() {
  const eventsFile = path.join(process.cwd(), "data/nexora/local/learning-memory/events.jsonl");
  const statusFile = path.join(process.cwd(), "data/nexora/local/paper-practice/status.json");

  const all = readJsonl(eventsFile);
  const polymarket = all.filter((e: any) => {
    const raw = e.raw || {};
    return e.domain === "polymarket" || raw.product === "Phantom X / Polymarket" || raw.asset;
  });

  const recent = polymarket.slice(-100);
  const latest = recent[recent.length - 1] || null;

  const byAsset: R = {};
  for (const e of recent) {
    const raw = e.raw || {};
    const asset = raw.asset || "unknown";
    if (!byAsset[asset]) {
      byAsset[asset] = { asset, events: 0, trades: 0, wins: 0, losses: 0, skips: 0, scoreSum: 0, scoreCount: 0, pnlSum: 0 };
    }

    const bucket = byAsset[asset];
    const result = String(e.result || "");
    const score = Number(e.scored?.score);
    const pnl = Number(raw.pnl ?? e.metrics?.paperPnl ?? 0);
    const countAsTrade = raw.countAsTrade !== false && raw.action !== "paper_observe_no_trade" && !result.includes("skip");

    bucket.events += 1;
    if (countAsTrade) bucket.trades += 1;
    if (countAsTrade && (result.includes("success") || pnl > 0)) bucket.wins += 1;
    if (countAsTrade && (result.includes("loss") || pnl < 0)) bucket.losses += 1;
    if (!countAsTrade) bucket.skips += 1;
    if (Number.isFinite(score)) {
      bucket.scoreSum += score;
      bucket.scoreCount += 1;
    }
    if (Number.isFinite(pnl)) bucket.pnlSum += pnl;
  }

  const assets = Object.values(byAsset).map((a: any) => ({
    asset: a.asset,
    events: a.events,
    trades: a.trades,
    wins: a.wins,
    losses: a.losses,
    skips: a.skips,
    winRate: a.trades ? Math.round((a.wins / a.trades) * 10000) / 100 : 0,
    avgScore: a.scoreCount ? Math.round((a.scoreSum / a.scoreCount) * 100) / 100 : 0,
    pnl: Math.round(a.pnlSum * 100) / 100,
  })).sort((a: any, b: any) => b.avgScore - a.avgScore);

  const trades = recent.filter((e: any) => {
    const raw = e.raw || {};
    const result = String(e.result || "");
    return raw.countAsTrade !== false && raw.action !== "paper_observe_no_trade" && !result.includes("skip");
  });

  const wins = trades.filter((e: any) => {
    const raw = e.raw || {};
    const pnl = Number(raw.pnl ?? e.metrics?.paperPnl ?? 0);
    const result = String(e.result || "");
    return result.includes("success") || pnl > 0;
  });

  const avgScore = recent.length
    ? Math.round((recent.reduce((s: number, e: any) => s + Number(e.scored?.score || 0), 0) / recent.length) * 100) / 100
    : 0;

  const winRate = trades.length ? Math.round((wins.length / trades.length) * 10000) / 100 : 0;

  const confidence = trades.length >= 20 && winRate >= 80 && avgScore >= 80
    ? 95
    : Math.round(Math.min(94, Math.max(50, (winRate * 0.55) + (avgScore * 0.45))));

  
  const syncedSummary = readSyncedPaperSummary();

  if (recent.length === 0 && syncedSummary) {
    return {
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_edge_fixed_dashboard_state",
      generatedAt: now(),
      paperPractice: {
        state: "synced_summary",
        loop: syncedSummary.latest?.raw?.loop || 0,
        source: "paper-summary"
      },
      counts: {
        polymarketEvents: syncedSummary.polymarketEvents || 0,
        recentEvents: syncedSummary.recentEvents || 0,
        countedTrades: syncedSummary.countedTrades || 0,
        wins: syncedSummary.wins || 0
      },
      confidence: {
        displayedPercent: syncedSummary.displayedConfidencePercent || 50,
        targetPercent: syncedSummary.targetConfidencePercent || 95,
        winRate: syncedSummary.winRate || 0,
        avgScore: syncedSummary.avgScore || 0,
        enoughSamplesFor95: (syncedSummary.countedTrades || 0) >= 20,
        targetReached: syncedSummary.targetReached || false,
        rule: "Using synced local paper-learning summary. 95% only shows after 20+ counted trades, 80%+ win rate, and 80+ average score."
      },
      latest: syncedSummary.latest ? {
        asset: syncedSummary.latest.raw?.asset || "unknown",
        symbol: syncedSummary.latest.raw?.symbol,
        market: syncedSummary.latest.raw?.market,
        action: syncedSummary.latest.action,
        result: syncedSummary.latest.result,
        score: syncedSummary.latest.scored?.score,
        pnl: syncedSummary.latest.raw?.pnl,
        confidence: syncedSummary.latest.raw?.confidence,
        strategy: syncedSummary.latest.raw?.strategyUsed,
        signal: syncedSummary.latest.raw?.paperSignal,
        countAsTrade: syncedSummary.latest.raw?.countAsTrade !== false
      } : null,
      assets: syncedSummary.assets || [],
      safety: {
        liveTradingEnabled: false,
        privateKeysInsideNexora: false,
        walletSigningInsideNexora: false,
        bankTransfersEnabled: false
      }
    };
  }


  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_edge_fixed_dashboard_state",
    generatedAt: now(),
    paperPractice: readJson(statusFile, { state: "unknown", loop: 0 }),
    counts: {
      polymarketEvents: polymarket.length,
      recentEvents: recent.length,
      countedTrades: trades.length,
      wins: wins.length,
    },
    confidence: {
      displayedPercent: confidence,
      targetPercent: 95,
      winRate,
      avgScore,
      enoughSamplesFor95: trades.length >= 20,
      targetReached: confidence >= 95,
      rule: "95% only shows after 20+ counted trades, 80%+ win rate, and 80+ average score."
    },
    latest: latest ? {
      asset: latest.raw?.asset || "unknown",
      symbol: latest.raw?.symbol,
      market: latest.raw?.market,
      action: latest.action,
      result: latest.result,
      score: latest.scored?.score,
      pnl: latest.raw?.pnl,
      confidence: latest.raw?.confidence,
      strategy: latest.raw?.strategyUsed,
      signal: latest.raw?.paperSignal,
      countAsTrade: latest.raw?.countAsTrade !== false,
    } : null,
    assets,
    safety: {
      liveTradingEnabled: false,
      privateKeysInsideNexora: false,
      walletSigningInsideNexora: false,
      bankTransfersEnabled: false
    }
  };
}

function page() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Nexora PolyEdge Live</title>
<style>
:root{
  --bg:#02060b;--panel:#07131d;--panel2:#0a1824;--line:#12364a;
  --cyan:#80f7ff;--green:#77ffae;--yellow:#ffd166;--red:#ff667d;--muted:#7aa9b7;
}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at top,#071827,#02060b 55%);color:#dffaff;font-family:Inter,Arial,sans-serif}
.wrap{padding:18px;max-width:1600px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}
h1{margin:0;font-size:26px;letter-spacing:.12em;text-transform:uppercase}
.sub{color:var(--muted);font-size:13px;margin-top:5px}
.badge{padding:8px 12px;border-radius:999px;background:#092d1c;border:1px solid #1d7049;color:var(--green);font-size:12px;font-weight:800}
.metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}
.metric{background:linear-gradient(180deg,var(--panel),#040b11);border:1px solid var(--line);border-radius:14px;padding:12px;min-height:86px}
.metric span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em}
.metric b{display:block;font-size:28px;margin-top:7px}
.green{color:var(--green)}.yellow{color:var(--yellow)}.red{color:var(--red)}.cyan{color:var(--cyan)}
.grid{display:grid;grid-template-columns:1.9fr 1fr;gap:12px}
.card{background:linear-gradient(180deg,var(--panel),#040b11);border:1px solid var(--line);border-radius:14px;padding:12px;box-shadow:0 0 28px rgba(0,255,255,.08)}
.card h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan);margin:0 0 10px}
canvas{width:100%;height:620px;background:radial-gradient(circle,#09202b,#02060a);border-radius:12px;border:1px solid #0f2b3c}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{border-bottom:1px solid var(--line);padding:8px;text-align:left}
th{color:var(--muted);font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
pre{white-space:pre-wrap;overflow:auto;max-height:230px;background:#02060a;border:1px solid #0f2b3c;border-radius:10px;padding:10px;font-size:11px;color:#c9f7ff}
.details{display:none;margin-top:8px}
button{background:#12364a;color:#dffaff;border:1px solid #1d5d7a;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.signalBox{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.signalBox div{background:#02060a;border:1px solid #0f2b3c;border-radius:10px;padding:10px}
.signalBox small{display:block;color:var(--muted);text-transform:uppercase;font-size:10px}
.signalBox strong{font-size:18px}
@media(max-width:1100px){.metrics{grid-template-columns:repeat(2,1fr)}.grid,.row{grid-template-columns:1fr}canvas{height:440px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div>
      <h1>Nexora PolyEdge Live</h1>
      <div class="sub">MoonDev strategy brain · Multi-asset paper trader · Learning memory · Risk locked · Real money gated</div>
    </div>
    <div class="badge">PAPER LEARNING ACTIVE · LIVE MONEY LOCKED</div>
  </div>

  <div class="metrics">
    <div class="metric"><span>Evidence confidence</span><b id="mConfidence" class="yellow">--%</b></div>
    <div class="metric"><span>Win rate</span><b id="mWin" class="cyan">--%</b></div>
    <div class="metric"><span>Counted trades</span><b id="mTrades">--</b></div>
    <div class="metric"><span>Wins</span><b id="mWins" class="green">--</b></div>
    <div class="metric"><span>Paper loop</span><b id="mLoop">--</b></div>
    <div class="metric"><span>Live money</span><b class="red">LOCKED</b></div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Moving Signal Graph</h2>
      <canvas id="graph"></canvas>
    </div>

    <div class="card">
      <h2>Latest Signal</h2>
      <div class="signalBox">
        <div><small>Asset</small><strong id="sAsset">--</strong></div>
        <div><small>Signal</small><strong id="sSignal">--</strong></div>
        <div><small>Result</small><strong id="sResult">--</strong></div>
        <div><small>Score</small><strong id="sScore">--</strong></div>
        <div><small>PNL</small><strong id="sPnl">--</strong></div>
        <div><small>Strategy</small><strong id="sStrategy">MoonDev + Nexora</strong></div>
      </div>

      <h2 style="margin-top:14px">Asset Leaderboard</h2>
      <table id="assets"></table>

      <h2 style="margin-top:14px">Safety Lock</h2>
      <pre id="safety">Loading...</pre>
    </div>
  </div>

  <div class="row">
    <div class="card">
      <h2>System State</h2>
      <pre id="state">Loading...</pre>
    </div>
    <div class="card">
      <h2>Debug Details</h2>
      <button onclick="toggleDetails()">Show / Hide Raw JSON</button>
      <pre id="details" class="details">Loading...</pre>
    </div>
  </div>
</div>

<script>
const canvas=document.getElementById("graph"),ctx=canvas.getContext("2d");
let state=null,t=0;

function resize(){
  const r=canvas.getBoundingClientRect();
  canvas.width=r.width*devicePixelRatio;
  canvas.height=r.height*devicePixelRatio;
}
resize();addEventListener("resize",resize);

function clsByPercent(v){return v>=80?"green":v>=60?"yellow":"red"}

async function load(){
  const res=await fetch("/api/nexora/poly-edge-fixed/state",{headers:{Accept:"application/json"}});
  state=await res.json();

  const c=state.confidence||{};
  const latest=state.latest||{};
  const counts=state.counts||{};
  const loop=state.paperPractice?.loop ?? "--";

  mConfidence.textContent=(c.displayedPercent ?? "--")+"%";
  mConfidence.className=clsByPercent(c.displayedPercent||0);
  mWin.textContent=(c.winRate ?? "--")+"%";
  mWin.className=clsByPercent(c.winRate||0);
  mTrades.textContent=counts.countedTrades ?? "--";
  mWins.textContent=counts.wins ?? "--";
  mLoop.textContent=loop;

  sAsset.textContent=latest.asset||"--";
  sSignal.textContent=latest.signal||"--";
  sResult.textContent=latest.result||"--";
  sScore.textContent=latest.score ?? "--";
  sPnl.textContent=latest.pnl ?? "--";
  sStrategy.textContent=(latest.strategy||"MoonDev + Nexora").replace("moondev_ranked_strategy_plus_nexora_risk_gate","MoonDev Ranked + Risk Gate");

  assets.innerHTML="<tr><th>Asset</th><th>Win</th><th>Score</th><th>Trades</th><th>PNL</th></tr>"+
    (state.assets||[]).map(a=>\`<tr><td>\${a.asset}</td><td class="\${clsByPercent(a.winRate)}">\${a.winRate}%</td><td>\${a.avgScore}</td><td>\${a.trades}</td><td>\${a.pnl}</td></tr>\`).join("");

  safety.textContent=JSON.stringify(state.safety,null,2);
  document.getElementById("state").textContent=JSON.stringify({
    paperPractice:state.paperPractice,
    counts:state.counts,
    confidence:state.confidence
  },null,2);
  details.textContent=JSON.stringify(state,null,2);
}

function toggleDetails(){
  details.style.display=details.style.display==="block"?"none":"block";
}

function draw(){
  t+=0.02;
  const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#02060a";ctx.fillRect(0,0,w,h);

  const arr=(state&&state.assets&&state.assets.length)?state.assets:[{asset:"WAIT",avgScore:50,winRate:0,trades:0,pnl:0}];
  const pts=arr.map((a,i)=>({a,ang:(Math.PI*2*i/arr.length)+t,r:(130+(a.avgScore||50)*2)*devicePixelRatio}));

  for(let i=0;i<pts.length;i++){
    for(let j=i+1;j<pts.length;j++){
      ctx.strokeStyle="rgba(90,230,255,.18)";
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(pts[i].ang)*pts[i].r,cy+Math.sin(pts[i].ang)*pts[i].r);
      ctx.lineTo(cx+Math.cos(pts[j].ang)*pts[j].r,cy+Math.sin(pts[j].ang)*pts[j].r);
      ctx.stroke();
    }
  }

  for(const p of pts){
    const x=cx+Math.cos(p.ang)*p.r,y=cy+Math.sin(p.ang)*p.r;
    const rr=(10+(p.a.avgScore||50)/8)*devicePixelRatio;
    ctx.fillStyle=(p.a.winRate||0)>=80?"#74ffb0":(p.a.winRate||0)>=60?"#ffd166":"#ff667d";
    ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#dffaff";ctx.font=(12*devicePixelRatio)+"px monospace";
    ctx.fillText(p.a.asset,x+rr+4,y);
  }

  requestAnimationFrame(draw);
}

setInterval(load,5000);
load();draw();
</script>
</body>
</html>`;
}
export function registerNexoraPolyEdgeFixedDashboardRoutes(app: Express): void {
  app.get("/api/nexora/poly-edge-fixed/state", (_req, res) => res.json(buildState()));

  app.get("/admin/polyedge-aetherforge", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  });

  app.get("/nexora/operator/poly-edge", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  });

  app.get("/nexora-poly-graph.html", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  });
}
