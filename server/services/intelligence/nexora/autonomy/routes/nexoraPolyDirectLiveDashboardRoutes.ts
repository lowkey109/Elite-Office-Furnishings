import type { Express } from "express";

function page(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Nexora PolyEdge Live Dashboard</title>
  <style>
    body{margin:0;background:#02070d;color:#dffaff;font-family:Inter,Arial,sans-serif}
    .wrap{padding:18px;max-width:1500px;margin:0 auto}
    h1{margin:0 0 8px;font-size:26px;letter-spacing:.08em;text-transform:uppercase}
    .sub{color:#7aa9b7;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:280px 1fr 330px;gap:12px}
    .card{background:#07131d;border:1px solid #12364a;border-radius:14px;padding:12px}
    h2{font-size:12px;color:#81f8ff;letter-spacing:.12em;text-transform:uppercase;margin:0 0 8px}
    .big{font-size:44px;font-weight:900;color:#80ffbd}
    pre{white-space:pre-wrap;overflow:auto;max-height:250px;background:#02060a;border:1px solid #0f2b3c;border-radius:8px;padding:8px;font-size:11px}
    canvas{width:100%;height:620px;background:radial-gradient(circle,#09202b,#02060a);border-radius:10px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    td,th{border-bottom:1px solid #12364a;padding:6px;text-align:left}
    @media(max-width:1000px){.grid{grid-template-columns:1fr}canvas{height:420px}}
  </style>
</head>
<body>
<div class="wrap">
  <h1>Nexora PolyEdge Live</h1>
  <div class="sub">MoonDev strategy brain · Multi-asset paper trader · Learning memory · Real-money locked</div>

  <div class="grid">
    <div>
      <div class="card"><h2>Evidence Confidence</h2><div id="conf" class="big">--%</div><pre id="meta">Loading...</pre></div>
      <div class="card" style="margin-top:12px"><h2>Latest Signal</h2><pre id="latest">Loading...</pre></div>
      <div class="card" style="margin-top:12px"><h2>Safety</h2><pre id="safety">Loading...</pre></div>
    </div>

    <div class="card">
      <h2>Moving Signal Graph</h2>
      <canvas id="graph"></canvas>
    </div>

    <div>
      <div class="card"><h2>Asset Leaderboard</h2><table id="assets"></table></div>
      <div class="card" style="margin-top:12px"><h2>System State</h2><pre id="raw">Loading...</pre></div>
    </div>
  </div>
</div>

<script>
const canvas=document.getElementById("graph");
const ctx=canvas.getContext("2d");
let state=null,t=0;

function resize(){
  const r=canvas.getBoundingClientRect();
  canvas.width=r.width*devicePixelRatio;
  canvas.height=r.height*devicePixelRatio;
}
resize(); addEventListener("resize",resize);

async function load(){
  const res=await fetch("/api/nexora/poly-edge-fixed/state",{headers:{Accept:"application/json"}});
  state=await res.json();

  document.getElementById("conf").textContent=state.confidence.displayedPercent+"%";
  document.getElementById("meta").textContent=JSON.stringify({
    target: state.confidence.targetPercent,
    winRate: state.confidence.winRate,
    avgScore: state.confidence.avgScore,
    countedTrades: state.counts.countedTrades,
    wins: state.counts.wins
  },null,2);

  document.getElementById("latest").textContent=JSON.stringify(state.latest,null,2);
  document.getElementById("safety").textContent=JSON.stringify(state.safety,null,2);
  document.getElementById("raw").textContent=JSON.stringify({
    paperPractice: state.paperPractice,
    counts: state.counts
  },null,2);

  document.getElementById("assets").innerHTML =
    "<tr><th>Asset</th><th>Win</th><th>Score</th><th>Trades</th></tr>" +
    state.assets.map(a=>\`<tr><td>\${a.asset}</td><td>\${a.winRate}%</td><td>\${a.avgScore}</td><td>\${a.trades}</td></tr>\`).join("");
}

function draw(){
  t+=0.02;
  const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#02060a";ctx.fillRect(0,0,w,h);

  const assets=(state&&state.assets&&state.assets.length)?state.assets:[{asset:"WAIT",avgScore:50,winRate:0,trades:0}];
  const pts=assets.map((a,i)=>({a,ang:(Math.PI*2*i/assets.length)+t,r:(120+(a.avgScore||50)*2)*devicePixelRatio}));

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
    const x=cx+Math.cos(p.ang)*p.r;
    const y=cy+Math.sin(p.ang)*p.r;
    const rr=(10+(p.a.avgScore||50)/8)*devicePixelRatio;
    ctx.fillStyle=p.a.winRate>=80?"#74ffb0":"#ffd166";
    ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#dffaff";
    ctx.font=(12*devicePixelRatio)+"px monospace";
    ctx.fillText(p.a.asset,x+rr+4,y);
  }

  requestAnimationFrame(draw);
}

setInterval(load,5000);
load();
draw();
</script>
</body>
</html>`;
}

export function registerNexoraPolyDirectLiveDashboardRoutes(app: Express): void {
  app.get("/nexora-poly-live", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  });

  app.get("/api/nexora/poly-live/status", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_poly_live_dashboard_status",
      page: "/nexora-poly-live",
      generatedAt: new Date().toISOString()
    });
  });
}
