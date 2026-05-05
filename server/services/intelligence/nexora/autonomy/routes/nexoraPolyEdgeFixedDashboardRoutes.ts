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
<title>Nexora PolyEdge Terminal</title>
<style>
:root{
  --bg:#f7f9f2;
  --ink:#1d2a22;
  --muted:#6e7a72;
  --line:#cfd8ca;
  --panel:#fbfcf7;
  --green:#0c9b5f;
  --red:#b63f50;
  --blue:#326ad8;
  --gold:#b9841f;
}
*{box-sizing:border-box}
body{
  margin:0;
  background:var(--bg);
  color:var(--ink);
  font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;
  font-size:12px;
}
.wrap{
  padding:10px;
  max-width:1800px;
  margin:0 auto;
}
.header{
  display:grid;
  grid-template-columns:260px 1fr 260px;
  gap:8px;
  align-items:stretch;
  margin-bottom:8px;
}
.panel{
  background:var(--panel);
  border:1px solid var(--line);
  box-shadow:0 1px 0 rgba(0,0,0,.04);
  padding:8px;
}
.title{
  font-weight:900;
  letter-spacing:.14em;
  font-size:20px;
  text-transform:uppercase;
}
.sub{
  color:var(--muted);
  font-size:11px;
}
.kpiRow{
  display:grid;
  grid-template-columns:repeat(6,1fr);
  gap:6px;
}
.kpi span{
  display:block;
  color:var(--muted);
  font-size:10px;
  text-transform:uppercase;
}
.kpi b{
  display:block;
  font-size:18px;
}
.green{color:var(--green)}
.red{color:var(--red)}
.gold{color:var(--gold)}
.blue{color:var(--blue)}

.topGrid{
  display:grid;
  grid-template-columns:220px 1fr 220px 270px;
  gap:8px;
  margin-bottom:8px;
}
.midGrid{
  display:grid;
  grid-template-columns:1fr 330px;
  gap:8px;
  margin-bottom:8px;
}
.bottomGrid{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  gap:8px;
}
h3{
  margin:0 0 6px;
  font-size:11px;
  letter-spacing:.14em;
  text-transform:uppercase;
  color:#31566b;
}
.bigMoney{
  font-size:44px;
  font-weight:900;
  letter-spacing:.03em;
}
canvas{
  width:100%;
  display:block;
}
#candles{height:260px}
#force{height:430px}
#pnl{height:160px}
table{
  width:100%;
  border-collapse:collapse;
  font-size:11px;
}
td,th{
  border-bottom:1px solid #e1e7dc;
  padding:4px;
  text-align:left;
}
th{
  color:var(--muted);
  font-size:10px;
  text-transform:uppercase;
}
.signalCard{
  border:2px solid #b7a36c;
  padding:10px;
  background:#fffaf0;
  min-height:250px;
}
.signalCard .score{
  font-size:42px;
  font-weight:900;
}
pre{
  margin:0;
  white-space:pre-wrap;
  max-height:160px;
  overflow:auto;
}
.small{
  font-size:10px;
  color:var(--muted);
}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.box{
  border:1px solid #d7dfd2;
  background:white;
  padding:6px;
}
@media(max-width:1100px){
  .header,.topGrid,.midGrid,.bottomGrid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="wrap">

  <div class="header">
    <div class="panel">
      <div class="title">PolyEdge</div>
      <div class="sub">Aetherforge · Paper terminal · MoonDev strategy layer</div>
    </div>
    <div class="panel kpiRow">
      <div class="kpi"><span>Evidence</span><b id="kConfidence">--%</b></div>
      <div class="kpi"><span>Win Rate</span><b id="kWin">--%</b></div>
      <div class="kpi"><span>Trades</span><b id="kTrades">--</b></div>
      <div class="kpi"><span>Wins</span><b id="kWins">--</b></div>
      <div class="kpi"><span>Loop</span><b id="kLoop">--</b></div>
      <div class="kpi"><span>Live</span><b class="red">LOCKED</b></div>
    </div>
    <div class="panel">
      <div class="small">UTC</div>
      <b id="clock">--:--:--</b>
      <div class="small">No wallet signing · No private keys · No live execution</div>
    </div>
  </div>

  <div class="topGrid">
    <div class="panel">
      <h3>Account / Paper Wallet</h3>
      <div id="accountName"><b>Marketing101</b></div>
      <div class="small">paper wallet · local learning</div>
      <div class="bigMoney" id="paperEquity">$--</div>
      <table>
        <tr><th>Trades</th><td id="tTrades">--</td></tr>
        <tr><th>Win%</th><td id="tWin">--</td></tr>
        <tr><th>Avg Score</th><td id="tScore">--</td></tr>
      </table>
    </div>

    <div class="panel">
      <h3 id="chartTitle">Candlestick / Paper Price</h3>
      <canvas id="candles"></canvas>
    </div>

    <div class="panel">
      <h3>Order Book / Liquidity</h3>
      <table id="book"></table>
    </div>

    <div class="signalCard">
      <h3>Best Trade / Signal</h3>
      <div class="small">MoonDev + Nexora</div>
      <div class="score" id="signalScore">--</div>
      <div id="signalText"><b>Waiting</b></div>
      <hr/>
      <div class="grid2">
        <div class="box"><span class="small">Asset</span><br/><b id="sigAsset">--</b></div>
        <div class="box"><span class="small">Signal</span><br/><b id="sigSignal">--</b></div>
        <div class="box"><span class="small">PNL</span><br/><b id="sigPnl">--</b></div>
        <div class="box"><span class="small">Confidence</span><br/><b id="sigConf">--</b></div>
      </div>
    </div>
  </div>

  <div class="midGrid">
    <div class="panel">
      <h3>Moving Force Graph · Market Signal Network</h3>
      <canvas id="force"></canvas>
    </div>

    <div class="panel">
      <h3>Asset Leaderboard</h3>
      <table id="leaderboard"></table>
      <h3 style="margin-top:10px">Risk Governor</h3>
      <pre id="risk">Loading...</pre>
    </div>
  </div>

  <div class="bottomGrid">
    <div class="panel">
      <h3>Paper PNL Curve</h3>
      <canvas id="pnl"></canvas>
    </div>
    <div class="panel">
      <h3>Recent Trades / Events</h3>
      <table id="recent"></table>
    </div>
    <div class="panel">
      <h3>Live Analytics / Debug</h3>
      <pre id="debug">Loading...</pre>
    </div>
  </div>

</div>

<script>
let state=null;
let tick=0;

function fmt(n){
  if(n===undefined||n===null)return "--";
  if(typeof n==="number")return Math.round(n*100)/100;
  return n;
}
function cls(v){return v>=80?"green":v>=60?"gold":"red"}

async function getJson(url){
  const r=await fetch(url,{headers:{Accept:"application/json"}});
  const t=await r.text();
  try{return JSON.parse(t)}catch{return {ok:false,html:t.slice(0,200)}}
}

async function load(){
  state=await getJson("/api/nexora/poly-edge-fixed/state");
  const chart=await getJson("/api/nexora/poly-charts/latest");
  const live=await getJson("/api/nexora/live-money/status");

  const c=state.confidence||{};
  const counts=state.counts||{};
  const latest=state.latest||{};
  const assets=state.assets||[];

  kConfidence.textContent=(c.displayedPercent??"--")+"%";
  kConfidence.className=cls(c.displayedPercent||0);
  kWin.textContent=(c.winRate??"--")+"%";
  kWin.className=cls(c.winRate||0);
  kTrades.textContent=counts.countedTrades??"--";
  kWins.textContent=counts.wins??"--";
  kLoop.textContent=state.paperPractice?.loop??"--";

  tTrades.textContent=counts.countedTrades??"--";
  tWin.textContent=(c.winRate??"--")+"%";
  tScore.textContent=c.avgScore??"--";
  paperEquity.textContent="PAPER ONLY";

  sigAsset.textContent=latest.asset||"--";
  sigSignal.textContent=latest.signal||"--";
  sigPnl.textContent=fmt(latest.pnl);
  sigConf.textContent=fmt(latest.confidence);
  signalScore.textContent=fmt(latest.score ?? c.displayedPercent ?? "--");
  signalText.innerHTML="<b>"+(latest.result||"Waiting")+"</b><br/><span class='small'>"+(latest.strategy||"MoonDev Ranked + Risk Gate")+"</span>";

  leaderboard.innerHTML="<tr><th>Asset</th><th>Win</th><th>Score</th><th>Trades</th><th>PNL</th></tr>"+
    assets.map(a=>\`<tr><td>\${a.asset}</td><td class="\${cls(a.winRate)}">\${a.winRate}%</td><td>\${a.avgScore}</td><td>\${a.countedTrades}</td><td>\${fmt(a.pnl)}</td></tr>\`).join("");

  risk.textContent=JSON.stringify({
    liveTradingEnabled:live.liveTradingEnabled,
    privateKeysAllowed:live.privateKeysAllowed,
    walletSigningAllowed:live.walletSigningAllowed,
    bankTransfersEnabled:state.safety?.bankTransfersEnabled
  },null,2);

  debug.textContent=JSON.stringify({paperPractice:state.paperPractice,counts:state.counts,confidence:state.confidence,latest:state.latest},null,2);

  drawCandles(chart.terminal||{}, latest);
  drawForce(assets, latest);
  drawPnl(assets);
  drawBook(chart.terminal||{}, latest);
  drawRecent(assets);
}

function resizeCanvas(canvas){
  const r=canvas.getBoundingClientRect();
  canvas.width=r.width*devicePixelRatio;
  canvas.height=r.height*devicePixelRatio;
}

function drawCandles(terminal, latest){
  const canvas=document.getElementById("candles");resizeCanvas(canvas);
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
  const candles=(terminal.candles||[]);
  const fallback=[]; // no synthetic candles: show waiting when real candle data is missing // no synthetic candles: show waiting when real candle data is missing
  for(let i=0;i<44;i++){
    const base=100+Math.sin((i+tick)/4)*7+(latest.pnl||0);
    fallback.push({open:base,close:base+Math.sin(i/2)*3,high:base+6,low:base-6,volume:100+i});
  }
  const data=candles.length?candles:[];
  if(!data.length){ctx.fillStyle="#6e7a72";ctx.font="16px monospace";ctx.fillText("WAITING FOR REAL CANDLE DATA",20,40);return;}\n  if(!data.length){ctx.fillStyle="#6e7a72";ctx.font="16px monospace";ctx.fillText("WAITING FOR REAL CANDLE DATA",20,40);return;}\n  const prices=data.flatMap(d=>[d.high,d.low,d.open,d.close]).filter(Number.isFinite);
  const min=Math.min(...prices),max=Math.max(...prices);
  const cw=w/data.length;
  ctx.strokeStyle="#d7dfd2";
  for(let i=0;i<5;i++){const y=h*(i/5);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  data.forEach((d,i)=>{
    const x=i*cw+cw/2;
    const y=v=>h-((v-min)/(max-min||1))*h*.85-h*.075;
    const up=d.close>=d.open;
    ctx.strokeStyle=up?"#0c9b5f":"#b63f50";
    ctx.fillStyle=ctx.strokeStyle;
    ctx.beginPath();ctx.moveTo(x,y(d.high));ctx.lineTo(x,y(d.low));ctx.stroke();
    ctx.fillRect(x-cw*.28,Math.min(y(d.open),y(d.close)),cw*.56,Math.max(2,Math.abs(y(d.open)-y(d.close))));
  });
}

function drawBook(terminal, latest){
  const rows=(terminal.orderBook||[]).slice(0,10);
  if(!rows.length){
    book.innerHTML="<tr><th>Status</th><th>Reason</th></tr><tr><td>WAITING</td><td>REAL ORDER BOOK DATA REQUIRED</td></tr>";
  } else {
    book.innerHTML="<tr><th>Px</th><th>Bid</th><th>Ask</th></tr>"+rows.map(r=>\`<tr><td>\${fmt(r.price)}</td><td>\${fmt(r.bidSize)}</td><td>\${fmt(r.askSize)}</td></tr>\`).join("");
  }
}

function drawForce(assets, latest){
  const canvas=document.getElementById("force");resizeCanvas(canvas);
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#fbfcf7";ctx.fillRect(0,0,w,h);
  const arr=assets.length?assets:[{asset:"WAIT",avgScore:50,winRate:0,countedTrades:0}];
  const pts=arr.map((a,i)=>({a,ang:Math.PI*2*i/arr.length+tick*.01,r:(120+(a.avgScore||50))*devicePixelRatio}));
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
    ctx.strokeStyle="rgba(40,80,110,.18)";
    ctx.beginPath();ctx.moveTo(cx+Math.cos(pts[i].ang)*pts[i].r,cy+Math.sin(pts[i].ang)*pts[i].r);
    ctx.lineTo(cx+Math.cos(pts[j].ang)*pts[j].r,cy+Math.sin(pts[j].ang)*pts[j].r);ctx.stroke();
  }
  pts.forEach(p=>{
    const x=cx+Math.cos(p.ang)*p.r,y=cy+Math.sin(p.ang)*p.r;
    const rr=(12+(p.a.avgScore||50)/7)*devicePixelRatio;
    ctx.fillStyle=p.a.winRate>=80?"#66ee99":p.a.winRate>=60?"#ffd15a":"#ff5d75";
    ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#1d2a22";ctx.font=(12*devicePixelRatio)+"px monospace";ctx.fillText(p.a.asset,x+rr+5,y);
  });
}

function drawPnl(assets){
  const canvas=document.getElementById("pnl");resizeCanvas(canvas);
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#fbfcf7";ctx.fillRect(0,0,w,h);
  const vals=assets.map(a=>a.pnl||0);
  if(!vals.length)return;
  const min=Math.min(...vals,0),max=Math.max(...vals,1);
  ctx.strokeStyle="#0c9b5f";ctx.lineWidth=2*devicePixelRatio;ctx.beginPath();
  vals.forEach((v,i)=>{const x=i*(w/(vals.length-1||1));const y=h-((v-min)/(max-min||1))*h*.8-h*.1;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
  ctx.stroke();
}

function drawRecent(assets){
  recent.innerHTML="<tr><th>Asset</th><th>Signal</th><th>Score</th></tr>"+assets.slice(0,8).map(a=>\`<tr><td>\${a.asset}</td><td>\${a.winRate>=80?"PROMOTE":"WATCH"}</td><td>\${a.avgScore}</td></tr>\`).join("");
}

function clock(){document.getElementById("clock").textContent=new Date().toISOString().slice(11,19)+" UTC";}
setInterval(clock,1000);clock();
setInterval(()=>{tick++; if(state) {drawForce(state.assets||[],state.latest||{});}},1000);
setInterval(load,5000);
load();
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
