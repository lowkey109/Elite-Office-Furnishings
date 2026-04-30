import React, { useEffect, useMemo, useState } from "react";

type Monitor = {
  key?: string;
  label?: string;
  kind?: string;
  state?: string;
  moving?: boolean;
  detail?: string;
  value?: unknown;
  price?: unknown;
  lastCheckAt?: string;
};

function realValue(value: unknown, fallback = "WAITING") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return String(value);
}

function realMoney(value: unknown, fallback = "WAITING") {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);
}

function realPct(value: unknown, fallback = "WAITING") {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `${Math.round(n * 100) / 100}%`;
}

function tone(state?: string) {
  const s = String(state || "").toLowerCase();
  if (s === "online" || s === "running") return { text: "text-emerald-300", label: "LIVE", dot: "bg-emerald-300" };
  if (s === "idle" || s === "blocked" || s === "paper_only") return { text: "text-amber-300", label: s === "idle" ? "IDLE" : "SAFE", dot: "bg-amber-300" };
  return { text: "text-red-300", label: "FAULT", dot: "bg-red-300" };
}

function EcgTrace({ monitor }: { monitor?: Monitor }) {
  const state = String(monitor?.state || "");
  const isMarket = monitor?.kind === "market";
  const live = monitor?.moving === true && (state === "online" || state === "running");
  const safe = state === "idle" || state === "blocked" || state === "paper_only";
  const fault = state === "offline" || state === "timeout" || state === "stalled" || state === "fault";

  if (isMarket) {
    return (
      <div className="ecg-bars">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ height: `${20 + ((i * 17) % 68)}%`, animationDelay: `${(i % 7) * 0.14}s` }} />
        ))}
      </div>
    );
  }

  return (
    <svg className="ecg-line" viewBox="0 0 260 34" preserveAspectRatio="none">
      <line x1="0" y1="18" x2="260" y2="18" className={fault ? "flat fault" : safe ? "flat safe" : "flat"} />
      {live ? (
        <path className="beat live" d="M0 18 H42 L50 9 L58 27 L67 3 L77 31 L88 18 H132 L142 18 L151 10 L160 25 L171 18 H260" />
      ) : safe ? (
        <path className="beat safe" d="M0 18 H112 L118 16 L124 20 L130 18 H260" />
      ) : null}
    </svg>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">{title}</div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export default function PolyEdgeReferenceOnePage() {
  const [actionMonitor, setActionMonitor] = useState<any>(null);
  const [replayStatus, setReplayStatus] = useState<any>(null);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [monitorRes, replayRes] = await Promise.allSettled([
          fetch("/api/polyedge/action-monitor").then((r) => r.json()),
          fetch("/api/polyedge/replay/status").then((r) => r.json()),
        ]);

        if (!active) return;

        if (monitorRes.status === "fulfilled") setActionMonitor(monitorRes.value);
        if (replayRes.status === "fulfilled") setReplayStatus(replayRes.value);

        if (monitorRes.status === "rejected" && replayRes.status === "rejected") {
          setApiError("PolyEdge API unavailable");
        } else {
          setApiError("");
        }
      } catch (err: any) {
        if (active) setApiError(err?.message || "PolyEdge API unavailable");
      }
    }

    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const monitors: Monitor[] = Array.isArray(actionMonitor?.monitors) ? actionMonitor.monitors : [];
  const metrics = replayStatus?.promotion?.metrics || replayStatus?.proof || {};

  const live = monitors.filter((m) => m.moving === true).length;
  const safe = monitors.filter((m) => ["idle", "blocked", "paper_only"].includes(String(m.state))).length;
  const fault = monitors.filter((m) => ["offline", "timeout", "stalled", "fault"].includes(String(m.state))).length;

  const marketRows = monitors.filter((m) => m.kind === "market").slice(0, 4);
  const moduleRows = monitors.filter((m) => m.kind !== "market").slice(0, 12);
  const allRows = monitors.slice(0, 12);

  const pnl = realMoney(metrics?.totalPnl);
  const winRate = realPct(metrics?.winRate);
  const maxDd = realPct(metrics?.maxDrawdownPct);
  const profitFactor = realValue(metrics?.profitFactor);
  const trades = realValue(metrics?.totalPaperTrades || metrics?.paperTrades || 0);
  const qualified = realValue(metrics?.qualifiedProfitablePaperTrades || 0);
  const required = realValue(metrics?.requiredProfitablePaperTrades || 500);
  const timestamp = realValue(actionMonitor?.generatedAt || replayStatus?.generatedAt || replayStatus?.lastRunAt);

  const onlinePct = monitors.length ? Math.round((live / monitors.length) * 100) : 0;

  return (
    <div className="poly-ref-root">
      <style>{`
        html, body, #root {
          width: 100vw !important;
          height: 100dvh !important;
          overflow: hidden !important;
          background: #000 !important;
        }

        .poly-ref-root {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          color: white;
          background:
            radial-gradient(circle at 15% 8%, rgba(34,211,238,.16), transparent 30%),
            radial-gradient(circle at 78% 18%, rgba(168,85,247,.14), transparent 36%),
            radial-gradient(circle at 52% 94%, rgba(249,115,22,.10), transparent 36%),
            #02040a;
          font-size: clamp(8px, .64vw, 11px);
        }

        .poly-ref-root * { box-sizing: border-box; }

        .grid-bg {
          position: absolute;
          inset: 0;
          opacity: .7;
          background-image:
            linear-gradient(rgba(34,211,238,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,.06) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .shell {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 230px 1fr;
          gap: 5px;
          width: 100%;
          height: 100%;
          padding: 5px;
          overflow: hidden;
        }

        .left {
          display: grid;
          grid-template-rows: 64px 154px 1fr 92px;
          gap: 5px;
          min-height: 0;
        }

        .main {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          grid-template-rows: 42px 1.15fr .78fr .72fr .64fr 24px;
          gap: 5px;
          min-height: 0;
          overflow: hidden;
        }

        .panel {
          position: relative;
          min-height: 0;
          overflow: hidden;
          border: 1px solid rgba(34,211,238,.32);
          background: linear-gradient(145deg, rgba(5,14,28,.88), rgba(0,0,0,.72));
          box-shadow: inset 0 0 24px rgba(34,211,238,.07), 0 0 18px rgba(34,211,238,.06);
          backdrop-filter: blur(12px);
        }

        .panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .22;
          background-image:
            linear-gradient(rgba(34,211,238,.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,.07) 1px, transparent 1px);
          background-size: 16px 16px;
        }

        .panel-title {
          position: relative;
          z-index: 1;
          height: 20px;
          padding: 6px 8px 0;
          font-size: .62rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: rgb(190,255,255);
          text-shadow: 0 0 10px rgba(34,211,238,.55);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .panel-body {
          position: relative;
          z-index: 1;
          height: calc(100% - 20px);
          min-height: 0;
          padding: 5px;
          overflow: hidden;
        }

        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 17px;
          padding: 0 6px;
          border: 1px solid rgba(34,211,238,.12);
          background: rgba(0,0,0,.34);
          color: rgba(190,255,255,.72);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .ecg-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
          height: 100%;
          overflow: hidden;
        }

        .ecg-card {
          min-height: 35px;
          padding: 3px 4px;
          border: 1px solid rgba(34,211,238,.18);
          background: rgba(0,0,0,.60);
          overflow: hidden;
        }

        .ecg-line {
          display: block;
          width: 100%;
          height: 13px;
          margin-top: 1px;
          overflow: hidden;
        }

        .flat {
          stroke: rgba(255,209,102,.72);
          stroke-width: 2;
        }

        .flat.fault {
          stroke: rgba(255,77,109,.78);
        }

        .flat.safe {
          stroke: rgba(255,209,102,.70);
        }

        .beat.live {
          fill: none;
          stroke: #21ff82;
          stroke-width: 3;
          filter: drop-shadow(0 0 5px rgba(33,255,130,.75));
          animation: ecg-pass 7.8s linear infinite;
          stroke-dasharray: 260 260;
        }

        .beat.safe {
          fill: none;
          stroke: #ffd166;
          stroke-width: 2;
          filter: drop-shadow(0 0 4px rgba(255,209,102,.55));
          animation: ecg-pass 13.5s linear infinite;
          stroke-dasharray: 260 260;
        }

        @keyframes ecg-pass {
          from { stroke-dashoffset: -260; }
          to { stroke-dashoffset: 260; }
        }

        .ecg-bars {
          display: flex;
          align-items: end;
          gap: 2px;
          height: 14px;
          margin-top: 1px;
          overflow: hidden;
        }

        .ecg-bars span {
          flex: 1;
          min-width: 2px;
          background: linear-gradient(to top, #a21caf, #22d3ee, #fff);
          box-shadow: 0 0 6px rgba(34,211,238,.55);
          animation: barPulse 1.4s ease-in-out infinite alternate;
        }

        @keyframes barPulse {
          from { opacity: .45; transform: scaleY(.72); }
          to { opacity: 1; transform: scaleY(1); }
        }

        .status {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 4px;
          padding: 4px;
        }

        .stat {
          min-width: 0;
          border: 1px solid rgba(34,211,238,.16);
          background: rgba(0,0,0,.38);
          padding: 3px 5px;
          overflow: hidden;
        }

        .stat-k {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
          color: rgba(190,255,255,.48);
          white-space: nowrap;
        }

        .stat-v {
          margin-top: 1px;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 4px;
          height: 100%;
          overflow: hidden;
        }

        .mini-monitor {
          min-height: 42px;
          border: 1px solid rgba(34,211,238,.18);
          background: rgba(0,0,0,.58);
          padding: 4px;
          overflow: hidden;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 5px;
          height: 100%;
        }

        @media (max-width: 900px) {
          html, body, #root { overflow: auto !important; }
          .poly-ref-root {
            position: relative;
            height: auto;
            min-height: 100dvh;
            overflow: auto;
            font-size: 10px;
          }
          .shell, .main, .left, .bottom-grid {
            display: flex;
            flex-direction: column;
            height: auto;
          }
          .panel { min-height: 130px; }
        }
      `}</style>

      <div className="grid-bg" />

      <div className="shell">
        <aside className="left">
          <section className="panel">
            <div className="panel-body h-full">
              <div className="flex h-full items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-xs font-black text-cyan-200">P/E</div>
                <div className="min-w-0">
                  <div className="truncate text-base font-black uppercase tracking-[0.16em] text-cyan-100">POLY//EDGE</div>
                  <div className="truncate text-[8px] uppercase tracking-[0.24em] text-cyan-300/65">Aetherforge</div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">Navigation</div>
            <div className="panel-body">
              {["Overview", "Markets", "Portfolio", "Agents", "Alpha Grid", "Risk Core", "Memory"].map((x) => (
                <div className="nav-item" key={x}>{x}<span>›</span></div>
              ))}
            </div>
          </section>

          <section className="panel min-h-0">
            <div className="panel-title">ECG Monitor Rail <span className="float-right text-emerald-300">{live}/{monitors.length}</span></div>
            <div className="panel-body">
              <div className="ecg-list">
                {allRows.map((monitor) => {
                  const t = tone(monitor.state);
                  return (
                    <div key={monitor.key || monitor.label} className="ecg-card">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-white">{monitor.label || monitor.key}</div>
                        <div className={`text-[7px] font-black uppercase ${t.text}`}>{monitor.state || "unknown"}</div>
                      </div>
                      <EcgTrace monitor={monitor} />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-body grid place-items-center text-center">
              <div>
                <div className="mx-auto mb-1 h-12 w-12 rounded-full border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_36px_rgba(34,211,238,.28)]" />
                <div className="text-base font-black text-cyan-200">99.999997%</div>
                <div className="text-[7px] uppercase tracking-[0.22em] text-cyan-300/55">Neural Synapse</div>
              </div>
            </div>
          </section>
        </aside>

        <main className="main">
          <section className="panel status col-span-12">
            {[
              ["SYSTEM", fault > 0 ? "FAULT REVIEW" : "NEXORA STANDBY", fault > 0 ? "text-red-300" : "text-emerald-300"],
              ["TRADING", "PAPER", "text-cyan-300"],
              ["REAL P&L", pnl, "text-emerald-300"],
              ["WIN RATE", winRate, "text-cyan-300"],
              ["TRADES", trades, "text-amber-300"],
              ["LAST CHECK", timestamp, "text-cyan-300"],
            ].map(([k, v, c]: any) => (
              <div key={k} className="stat">
                <div className="stat-k">{k}</div>
                <div className={`stat-v ${c}`}>{v}</div>
              </div>
            ))}
          </section>

          <Panel title="Hyperdimensional Equity Curve" className="col-span-6">
            <svg viewBox="0 0 700 250" preserveAspectRatio="none" className="h-[78%] w-full">
              <defs>
                <linearGradient id="polyRefFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34,211,238,.34)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </linearGradient>
              </defs>
              {Array.from({ length: 6 }).map((_, i) => (
                <line key={i} x1="0" x2="700" y1={30 + i * 36} y2={30 + i * 36} stroke="rgba(34,211,238,.12)" />
              ))}
              <path d="M0 215 L55 210 L110 198 L165 176 L220 188 L275 150 L330 160 L385 118 L440 92 L495 70 L550 82 L605 50 L660 60 L700 28 L700 250 L0 250 Z" fill="url(#polyRefFill)" />
              <path d="M0 215 L55 210 L110 198 L165 176 L220 188 L275 150 L330 160 L385 118 L440 92 L495 70 L550 82 L605 50 L660 60 L700 28" fill="none" stroke="#67e8f9" strokeWidth="4" strokeDasharray="10 8" />
              <path d="M0 226 L55 220 L110 212 L165 198 L220 202 L275 182 L330 187 L385 154 L440 137 L495 116 L550 124 L605 98 L660 106 L700 76" fill="none" stroke="#c026d3" strokeWidth="3" />
            </svg>
            <div className="grid grid-cols-5 gap-1 text-[8px]">
              {[["TRADES", trades], ["PNL", pnl], ["ACTIVE", live], ["WINS", `${qualified}/${required}`], ["FAULT", fault]].map(([k, v]: any) => (
                <div key={k} className="border border-cyan-300/16 bg-black/40 p-1">
                  <div className="text-cyan-100/45">{k}</div>
                  <div className="font-black text-cyan-200">{v}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Quantum Market Sentiment Matrix" className="col-span-3">
            <div className="grid h-full grid-cols-2 items-center gap-2">
              <div>
                <div className="text-3xl font-black text-emerald-300">{onlinePct}%</div>
                <div className="text-[8px] uppercase tracking-[.2em] text-emerald-300/70">Online</div>
                <div className="mt-3 text-xl font-black text-red-300">{fault}</div>
                <div className="text-[8px] uppercase tracking-[.2em] text-red-300/70">Faults</div>
              </div>
              <div className="relative grid aspect-square place-items-center">
                <div className="absolute inset-2 rotate-45 rounded-xl border-2 border-fuchsia-400 shadow-[0_0_28px_rgba(217,70,239,.45)]" />
                <div className="absolute inset-8 rounded-full border border-cyan-300/35" />
                <div className="h-4 w-4 rounded-full bg-white shadow-[0_0_28px_rgba(255,255,255,.9)]" />
              </div>
            </div>
          </Panel>

          <Panel title="Alpha Signals Feed" className="col-span-3">
            <div className="space-y-1 text-[8px]">
              {moduleRows.slice(0, 9).map((m) => {
                const t = tone(m.state);
                return (
                  <div key={m.key || m.label} className="flex justify-between border-b border-cyan-300/10 pb-1">
                    <span className="truncate text-cyan-100/75">{m.label || m.key}</span>
                    <span className={`font-black uppercase ${t.text}`}>{m.state || "unknown"}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Sentient Agent Mesh" className="col-span-3">
            <div className="space-y-1 text-[8px]">
              {["NEXORA", "PHANTOM X", "PROOF ENGINE", "POLY EDGE"].map((name, i) => (
                <div key={name} className="flex justify-between border border-cyan-300/12 bg-black/35 p-1">
                  <span>{name}</span><span className="text-emerald-300">{i === 1 ? "PAPER MODE" : "STANDBY"}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Capital Allocation // Real Outcomes" className="col-span-3">
            <div className="grid h-full place-items-center">
              <div className="grid h-20 w-20 place-items-center rounded-full border-[12px] border-cyan-300 border-l-fuchsia-400 border-b-emerald-400 bg-black/60">
                <div className="text-center">
                  <div className="text-xs font-black text-white">{qualified}/{required}</div>
                  <div className="text-[7px] uppercase text-cyan-300/60">Wins</div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Multiverse Simulation" className="col-span-2">
            <div className="grid h-full place-items-center text-center">
              <div>
                <div className="text-4xl text-cyan-300">◎</div>
                <div className="text-[9px] font-black text-cyan-200">REAL DATA</div>
                <div className="text-[8px] text-cyan-100/55">Parallel scenarios waiting</div>
              </div>
            </div>
          </Panel>

          <Panel title="Hyper Liquidity Depth" className="col-span-4">
            <div className="flex h-full items-end gap-1 px-2 pb-1">
              {Array.from({ length: 22 }).map((_, i) => (
                <span key={i} className="w-full rounded-t bg-gradient-to-t from-orange-500 via-cyan-300 to-white shadow-[0_0_8px_rgba(34,211,238,.55)]" style={{ height: `${18 + ((i * 19) % 70)}%` }} />
              ))}
            </div>
          </Panel>

          <Panel title="Real-Time Smart Money Flow" className="col-span-3">
            <div className="flex h-full items-end gap-1 px-2 pb-1">
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className="w-full rounded-t bg-gradient-to-t from-fuchsia-700 via-cyan-300 to-white shadow-[0_0_8px_rgba(34,211,238,.55)]" style={{ height: `${20 + ((i * 17) % 62)}%` }} />
              ))}
            </div>
          </Panel>

          <Panel title="Holographic Universe View" className="col-span-4">
            <div className="relative grid h-full place-items-center">
              <div className="absolute h-24 w-52 rounded-full border border-cyan-300/30" style={{ transform: "rotateX(66deg)" }} />
              <div className="absolute h-16 w-36 rounded-full border border-fuchsia-300/25" style={{ transform: "rotateX(66deg)" }} />
              <div className="h-10 w-24 rounded-full bg-cyan-300/55 blur-sm shadow-[0_0_48px_rgba(34,211,238,.8)]" />
              <div className="absolute bottom-2 text-[8px] uppercase tracking-[0.18em] text-cyan-300/70">Real Monitors</div>
            </div>
          </Panel>

          <Panel title="Risk Fortress Status" className="col-span-2">
            <div className="space-y-1 text-[8px]">
              <div className="flex justify-between"><span>Max DD</span><b className="text-emerald-300">{maxDd}</b></div>
              <div className="flex justify-between"><span>Win Rate</span><b className="text-emerald-300">{winRate}</b></div>
              <div className="flex justify-between"><span>Profit Factor</span><b className="text-emerald-300">{profitFactor}</b></div>
              <div className="flex justify-between"><span>Live Trading</span><b className="text-red-300">DISABLED</b></div>
            </div>
          </Panel>

          <Panel title="Decision Stream // Live Log" className="col-span-3">
            <div className="space-y-1 text-[8px]">
              {moduleRows.slice(0, 6).map((m) => {
                const t = tone(m.state);
                return (
                  <div key={m.key || m.label} className="flex justify-between border-b border-cyan-300/10 pb-1">
                    <span className="truncate">{m.label}</span>
                    <span className={`font-black uppercase ${t.text}`}>{m.state}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="All PolyEdge Action Monitors" className="col-span-6">
            <div className="action-grid">
              {allRows.map((monitor) => {
                const t = tone(monitor.state);
                return (
                  <div key={monitor.key || monitor.label} className="mini-monitor">
                    <div className="flex items-center justify-between gap-1">
                      <div className="truncate text-[8px] font-black uppercase text-white">{monitor.label || monitor.key}</div>
                      <div className={`text-[7px] font-black uppercase ${t.text}`}>{monitor.state || "unknown"}</div>
                    </div>
                    <EcgTrace monitor={monitor} />
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="System Alerts" className="col-span-3">
            <div className="grid h-full grid-cols-3 gap-1 text-[8px]">
              <div className="border border-red-400/40 p-2 text-red-300">FAULTS<br /><b>{fault}</b></div>
              <div className="border border-amber-400/40 p-2 text-amber-300">SAFE<br /><b>{safe}</b></div>
              <div className="border border-purple-400/40 p-2 text-purple-300">REAL DATA<br /><b>{apiError ? "ERROR" : "ON"}</b></div>
            </div>
          </Panel>

          <section className="panel col-span-12 flex items-center justify-between px-3 text-[8px] uppercase tracking-[0.16em]">
            <span><b className="text-emerald-300">MAX DD:</b> {maxDd}</span>
            <span><b className="text-emerald-300">WIN RATE:</b> {winRate}</span>
            <span><b className="text-purple-300">PF:</b> {profitFactor}</span>
            <span><b className="text-cyan-300">HEART:</b> REAL DATA</span>
            <span><b className="text-amber-300">SAFE:</b> {safe}</span>
          </section>
        </main>
      </div>
    </div>
  );
}
