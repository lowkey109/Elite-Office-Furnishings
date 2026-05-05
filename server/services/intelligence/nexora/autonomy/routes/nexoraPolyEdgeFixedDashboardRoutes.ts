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
body{margin:0;background:#03070c;color:#dffaff;font-family:Inter,Arial,sans-serif}
.wrap{padding:16px;max-width:1500px;margin:0 auto}
h1{font-size:22px;margin:0 0 6px;letter-spacing:.12em;text-transform:uppercase}
.sub{color:#74a5b3;margin-bottom:14px}
.grid{display:grid;grid-template-columns:260px 1fr 320px;gap:12px}
.card{background:#07131d;border:1px solid #12364a;border-radius:12px;padding:12px;box-shadow:0 0 28px rgba(0,255,255,.08)}
h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#81f8ff;margin:0 0 8px}
.big{font-size:42px;font-weight:800;color:#88ffbd}
.warn{color:#ffd166}
.bad{color:#ff6680}
.good{color:#74ffb0}
pre{white-space:pre-wrap;font-size:11px;max-height:240px;overflow:auto;background:#02060a;border:1px solid #0f2b3c;border-radius:8px;padding:8px}
canvas{width:100%;height:620px;background:radial-gradient(circle,#09202b,#02060a);border-radius:10px}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{border-bottom:1px solid #12364a;padding:6px;text-align:left}
@media(max-width:1000px){.grid{grid-template-columns:1fr}canvas{height:420px}}
</style>
</head>
<body>
<div class="wrap">
<h1>Nexora PolyEdge Live</h1>
<div class="sub">MoonDev strategy brain + multi-asset paper practice + learning memory + risk lock.</div>
<div class="grid">
  <div>
    <div class="card"><h2>Evidence Confidence</h2><div id="conf" class="big">--%</div><div id="confNote" class="sub"></div></div>
    <div class="card" style="margin-top:12px"><h2>Latest Signal</h2><pre id="latest">Loading...</pre></div>
    <div class="card" style="margin-top:12px"><h2>Safety</h2><pre id="safety">Loading...</pre></div>
  </div>
  <div class="card"><h2>Moving Signal Graph</h2><canvas id="graph"></canvas></div>
  <div>
    <div class="card"><h2>Asset Leaderboard</h2><table id="assets"></table></div>
    <div class="card" style="margin-top:12px"><h2>Raw State</h2><pre id="raw">Loading...</pre></div>
  </div>
</div>
</div>
<script>
const c=document.getElementById("graph"),x=c.getContext("2d");let state=null,t=0;
function resize(){const r=c.getBoundingClientRect();c.width=r.width*devicePixelRatio;c.height=r.height*devicePixelRatio}resize();addEventListener("resize",resize);
async function load(){
 const r=await fetch("/api/nexora/poly-edge-fixed/state"); state=await r.json();
 document.getElementById("conf").textContent=state.confidence.displayedPercent+"%";
 document.getElementById("conf").className=state.confidence.targetReached?"big good":"big warn";
 document.getElementById("confNote").textContent="Win "+state.confidence.winRate+"% · Avg "+state.confidence.avgScore+" · Trades "+state.counts.countedTrades;
 document.getElementById("latest").textContent=JSON.stringify(state.latest,null,2);
 document.getElementById("safety").textContent=JSON.stringify(state.safety,null,2);
 document.getElementById("raw").textContent=JSON.stringify({counts:state.counts,paperPractice:state.paperPractice},null,2);
 document.getElementById("assets").innerHTML="<tr><th>Asset</th><th>Win</th><th>Score</th><th>Trades</th></tr>"+state.assets.map(a=>\`<tr><td>\${a.asset}</td><td>\${a.winRate}%</td><td>\${a.avgScore}</td><td>\${a.trades}</td></tr>\`).join("");
}
function draw(){
 t+=.02; const w=c.width,h=c.height,cx=w/2,cy=h/2; x.clearRect(0,0,w,h); x.fillStyle="#02060a"; x.fillRect(0,0,w,h);
 const assets=(state&&state.assets&&state.assets.length?state.assets:[{asset:"WAIT",avgScore:50,winRate:0,trades:0}]);
 const pts=assets.map((a,i)=>({a,ang:(Math.PI*2*i/assets.length)+t,r:110*devicePixelRatio+(a.avgScore||50)*2}));
 for(let i=0;i<pts.length;i++){for(let j=i+1;j<pts.length;j++){x.strokeStyle="rgba(80,220,255,.18)";x.beginPath();x.moveTo(cx+Math.cos(pts[i].ang)*pts[i].r,cy+Math.sin(pts[i].ang)*pts[i].r);x.lineTo(cx+Math.cos(pts[j].ang)*pts[j].r,cy+Math.sin(pts[j].ang)*pts[j].r);x.stroke()}}
 for(const p of pts){const px=cx+Math.cos(p.ang)*p.r,py=cy+Math.sin(p.ang)*p.r,rr=(10+(p.a.avgScore||50)/8)*devicePixelRatio;x.fillStyle=p.a.winRate>=80?"#74ffb0":"#ffd166";x.beginPath();x.arc(px,py,rr,0,Math.PI*2);x.fill();x.fillStyle="#dffaff";x.font=(12*devicePixelRatio)+"px monospace";x.fillText(p.a.asset,px+rr+4,py)}
 requestAnimationFrame(draw)
}
setInterval(load,5000);load();draw();
</script>
</body>
</html>`;
}

export function registerNexoraPolyEdgeFixedDashboardRoutes(app: Express): void {
  app.get("/api/nexora/poly-edge-fixed/state", (_req, res) => res.json(buildState()));

  app.get("/nexora/operator/poly-edge", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  });

  app.get("/nexora-poly-graph.html", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  });
}
