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
  if (s === "online" || s === "running") return { text: "text-emerald-300", dot: "bg-emerald-300", label: "LIVE" };
  if (s === "idle" || s === "blocked" || s === "paper_only") return { text: "text-amber-300", dot: "bg-amber-300", label: s === "idle" ? "IDLE" : "SAFE" };
  return { text: "text-red-300", dot: "bg-red-300", label: "FAULT" };
}

function stateScore(monitor: Monitor) {
  const s = String(monitor.state || "").toLowerCase();
  if (s === "online" || s === "running") return 88;
  if (s === "idle") return 44;
  if (s === "blocked" || s === "paper_only") return 34;
  if (s === "offline" || s === "timeout" || s === "fault" || s === "stalled") return 12;
  return 24;
}

function EcgTrace({ monitor, compact = false }: { monitor?: Monitor; compact?: boolean }) {
  const state = String(monitor?.state || "").toLowerCase();
  const isMarket = monitor?.kind === "market";
  const live = monitor?.moving === true && (state === "online" || state === "running");
  const safe = state === "idle" || state === "blocked" || state === "paper_only";
  const fault = state === "offline" || state === "timeout" || state === "stalled" || state === "fault";

  if (isMarket) {
    return (
      <div className={compact ? "ecg-bars compact" : "ecg-bars"}>
        {Array.from({ length: compact ? 14 : 18 }).map((_, i) => (
          <span key={i} style={{ height: `${Math.max(14, stateScore(monitor || {}) - ((i * 9) % 38))}%`, animationDelay: `${(i % 7) * 0.13}s` }} />
        ))}
      </div>
    );
  }

  return (
    <div className={compact ? "ecg-window compact" : "ecg-window"}>
      <svg className="ecg-track" viewBox="0 0 520 34" preserveAspectRatio="none">
        <line x1="0" y1="18" x2="520" y2="18" className={fault ? "flat fault" : safe ? "flat safe" : "flat"} />
        {live ? (
          <g className="beat-scroll live">
            <path d="M0 18 H42 L50 9 L58 27 L67 3 L77 31 L88 18 H132 L142 18 L151 10 L160 25 L171 18 H260 H302 L310 9 L318 27 L327 3 L337 31 L348 18 H392 L402 18 L411 10 L420 25 L431 18 H520" />
          </g>
        ) : safe ? (
          <g className="beat-scroll safe">
            <path d="M0 18 H112 L118 16 L124 20 L130 18 H260 H372 L378 16 L384 20 L390 18 H520" />
          </g>
        ) : null}
      </svg>
    </div>
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
      const requests = await Promise.allSettled([
        fetch("/api/polyedge/action-monitor").then((r) => r.json()),
        fetch("/api/polyedge/replay/status").then((r) => r.json()),
      ]);

      if (!active) return;

      if (requests[0].status === "fulfilled") setActionMonitor(requests[0].value);
      if (requests[1].status === "fulfilled") setReplayStatus(requests[1].value);

      if (requests[0].status === "rejected" && requests[1].status === "rejected") {
        setApiError("PolyEdge API unavailable");
      } else {
        setApiError("");
      }
    }

    load().catch((err: any) => active && setApiError(err?.message || "PolyEdge API unavailable"));
    const timer = window.setInterval(() => load().catch(() => undefined), 5000);

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

  const leftRailRows = monitors.slice(0, 14);
  const moduleRows = monitors.filter((m) => m.kind !== "market").slice(0, 12);
  const marketRows = monitors.filter((m) => m.kind === "market").slice(0, 4);
  const actionRows = monitors.slice(0, 12);

  const totalPnl = Number(metrics?.totalPnl);
  const hasRealEquity = Number.isFinite(totalPnl);

  const pnl = realMoney(metrics?.totalPnl);
  const winRate = realPct(metrics?.winRate);
  const maxDd = realPct(metrics?.maxDrawdownPct);
  const profitFactor = realValue(metrics?.profitFactor);
  const trades = realValue(metrics?.totalPaperTrades || metrics?.paperTrades || 0);
  const qualified = realValue(metrics?.qualifiedProfitablePaperTrades || 0);
  const required = realValue(metrics?.requiredProfitablePaperTrades || 500);
  const timestamp = realValue(actionMonitor?.generatedAt || replayStatus?.generatedAt || replayStatus?.lastRunAt);
  const onlinePct = monitors.length ? Math.round((live / monitors.length) * 100) : 0;

  const statusBars = useMemo(() => {
    const rows = monitors.length ? monitors.slice(0, 22) : [];
    return rows.map((m, i) => Math.max(10, stateScore(m) - ((i * 7) % 24)));
  }, [monitors]);

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
            radial-gradient(circle at 14% 8%, rgba(34,211,238,.16), transparent 30%),
            radial-gradient(circle at 78% 18%, rgba(168,85,247,.14), transparent 36%),
            radial-gradient(circle at 50% 96%, rgba(249,115,22,.10), transparent 34%),
            #02040a;
          font-size: clamp(8px, .61vw, 10.5px);
        }

        .poly-ref-root * { box-sizing: border-box; }

        .grid-bg {
          position: absolute;
          inset: 0;
          opacity: .7;
          background-image:
            linear-gradient(rgba(34,211,238,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,.06) 1px, transparent 1px);
          background-size: 22px 22px;
        }

        .shell {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 190px 1fr;
          gap: 4px;
          width: 100%;
          height: 100%;
          padding: 4px;
          overflow: hidden;
        }

        .left {
          display: grid;
          grid-template-rows: 50px 102px 1fr 58px;
          gap: 4px;
          min-height: 0;
        }

        .main {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          grid-template-rows: 38px 1.14fr .74fr .66fr .58fr 22px;
          gap: 4px;
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
          background-size: 15px 15px;
        }

        .panel-title {
          position: relative;
          z-index: 1;
          height: 18px;
          padding: 5px 7px 0;
          font-size: .58rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .17em;
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
          height: calc(100% - 18px);
          min-height: 0;
          padding: 4px;
          overflow: hidden;
        }

        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 15px;
          padding: 0 5px;
          border: 1px solid rgba(34,211,238,.12);
          background: rgba(0,0,0,.34);
          color: rgba(190,255,255,.72);
          font-size: 6.5px;
          font-weight: 900;
          letter-spacing: .13em;
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
          min-height: 28px;
          padding: 3px 4px;
          border: 1px solid rgba(34,211,238,.18);
          background: rgba(0,0,0,.60);
          overflow: hidden;
        }

        .ecg-window {
          width: 100%;
          height: 13px;
          margin-top: 1px;
          overflow: hidden;
          background: rgba(0,0,0,.32);
        }

        .ecg-window.compact {
          height: 10px;
        }

        .ecg-track {
          display: block;
          width: 100%;
          height: 100%;
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

        .beat-scroll path {
          fill: none;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .beat-scroll.live path {
          stroke: #21ff82;
          filter: drop-shadow(0 0 5px rgba(33,255,130,.75));
        }

        .beat-scroll.safe path {
          stroke: #ffd166;
          stroke-width: 2;
          filter: drop-shadow(0 0 4px rgba(255,209,102,.55));
        }

        .beat-scroll {
          animation: ecgMoveRightToLeft 8.8s linear infinite;
        }

        .beat-scroll.safe {
          animation-duration: 15s;
        }

        @keyframes ecgMoveRightToLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-260px); }
        }

        .ecg-bars {
          display: flex;
          align-items: end;
          gap: 2px;
          height: 13px;
          margin-top: 1px;
          overflow: hidden;
        }

        .ecg-bars.compact {
          height: 11px;
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
          gap: 3px;
          padding: 3px;
        }

        .stat {
          min-width: 0;
          border: 1px solid rgba(34,211,238,.16);
          background: rgba(0,0,0,.38);
          padding: 3px 5px;
          overflow: hidden;
        }

        .stat-k {
          font-size: 6.5px;
          font-weight: 900;
          letter-spacing: .15em;
          text-transform: uppercase;
          color: rgba(190,255,255,.48);
          white-space: nowrap;
        }

        .stat-v {
          margin-top: 1px;
          font-size: 8.5px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 3px;
          height: 100%;
          overflow: hidden;
        }

        .mini-monitor {
          min-height: 37px;
          border: 1px solid rgba(34,211,238,.18);
          background: rgba(0,0,0,.58);
          padding: 3px;
          overflow: hidden;
        }

        .mini-row {
          display: flex;
          justify-content: space-between;
          gap: 5px;
          border-bottom: 1px solid rgba(34,211,238,.10);
          padding-bottom: 3px;
          margin-bottom: 3px;
          font-size: 7.5px;
        }

        .mini-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 3px;
          font-size: 7.5px;
        }

        .mini-box {
          border: 1px solid rgba(34,211,238,.13);
          background: rgba(0,0,0,.35);
          padding: 3px;
          min-height: 24px;
        }

        @media (max-width: 900px) {
          html, body, #root {
            overflow: auto !important;
            height: auto !important;
          }

          .poly-ref-root {
            position: relative;
            height: auto;
            min-height: 100dvh;
            overflow: auto;
            font-size: 10px;
          }

          .shell {
            display: flex;
            flex-direction: column;
            height: auto;
            min-height: 100dvh;
            padding: 6px;
          }

          .left,
          .main {
            display: flex;
            flex-direction: column;
            height: auto;
          }

          .panel {
            min-height: 120px;
          }

          .status {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ecg-list {
            max-height: none;
            overflow: visible;
          }

          .ecg-card {
            min-height: 42px;
          }

          .ecg-window,
          .ecg-window.compact {
            height: 16px;
          }

          .nav-item {
            height: 24px;
            font-size: 9px;
          }
        }
      `}</style>

      <div className="grid-bg" />

      <div className="shell">
        <aside className="left">
          <section className="panel">
            <div className="panel-body h-full">
              <div className="flex h-full items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-[10px] font-black text-cyan-200">P/E</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black uppercase tracking-[0.16em] text-cyan-100">POLY//EDGE</div>
                  <div className="truncate text-[7px] uppercase tracking-[0.22em] text-cyan-300/65">Aetherforge</div>
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
                {leftRailRows.map((monitor) => {
                  const t = tone(monitor.state);
                  return (
                    <div key={monitor.key || monitor.label} className="ecg-card">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[7.5px] font-black uppercase tracking-[0.1em] text-white">{monitor.label || monitor.key}</div>
                        <div className={`text-[6.5px] font-black uppercase ${t.text}`}>{monitor.state || "unknown"}</div>
                      </div>
                      <EcgTrace monitor={monitor} compact />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-body grid place-items-center text-center">
              <div>
                <div className="mx-auto mb-1 h-7 w-7 rounded-full border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,.28)]" />
                <div className="text-[10px] font-black text-cyan-200">{live}/{monitors.length}</div>
                <div className="text-[6px] uppercase tracking-[0.16em] text-cyan-300/55">Module Sync</div>
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
            {hasRealEquity ? (
              <svg viewBox="0 0 700 250" preserveAspectRatio="none" className="h-[76%] w-full">
                <defs>
                  <linearGradient id="polyRefFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(34,211,238,.34)" />
                    <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                  </linearGradient>
                </defs>
                {Array.from({ length: 6 }).map((_, i) => (
                  <line key={i} x1="0" x2="700" y1={30 + i * 36} y2={30 + i * 36} stroke="rgba(34,211,238,.12)" />
                ))}
                <path d="M0 210 L70 205 L140 192 L210 176 L280 166 L350 140 L420 122 L490 98 L560 78 L630 58 L700 38 L700 250 L0 250 Z" fill="url(#polyRefFill)" />
                <path d="M0 210 L70 205 L140 192 L210 176 L280 166 L350 140 L420 122 L490 98 L560 78 L630 58 L700 38" fill="none" stroke="#67e8f9" strokeWidth="4" strokeDasharray="10 8" />
                <path d="M0 225 L70 216 L140 208 L210 194 L280 184 L350 166 L420 150 L490 130 L560 112 L630 94 L700 78" fill="none" stroke="#c026d3" strokeWidth="3" />
              </svg>
            ) : (
              <div className="grid h-[76%] place-items-center border border-cyan-300/12 bg-black/25 text-center">
                <div>
                  <div className="text-lg font-black text-cyan-200">WAITING</div>
                  <div className="text-[8px] uppercase tracking-[0.22em] text-cyan-300/55">Real paper outcomes required</div>
                </div>
              </div>
            )}
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
                <div className="text-[9px] font-black text-cyan-200">WAITING</div>
                <div className="text-[8px] text-cyan-100/55">Real scenarios</div>
              </div>
            </div>
          </Panel>

          <Panel title="Hyper Liquidity Depth" className="col-span-4">
            <div className="flex h-full items-end gap-1 px-2 pb-1">
              {(statusBars.length ? statusBars : [10, 10, 10, 10, 10, 10, 10, 10]).map((h, i) => (
                <span key={i} className="w-full rounded-t bg-gradient-to-t from-orange-500 via-cyan-300 to-white shadow-[0_0_8px_rgba(34,211,238,.55)]" style={{ height: `${h}%` }} />
              ))}
            </div>
          </Panel>

          <Panel title="Real-Time Smart Money Flow" className="col-span-3">
            <div className="space-y-1 text-[8px]">
              {marketRows.length ? marketRows.map((m) => (
                <div key={m.key || m.label}>
                  <div className="mb-1 flex justify-between">
                    <span>{m.label}</span><span className="text-emerald-300">{realValue(m.value || m.price)}</span>
                  </div>
                  <EcgTrace monitor={m} compact />
                </div>
              )) : <div className="grid h-full place-items-center text-cyan-300/60">WAITING FOR MARKET FEEDS</div>}
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

          <Panel title="System Alerts" className="col-span-3">
            <div className="grid h-full grid-cols-3 gap-1 text-[8px]">
              <div className="border border-red-400/40 p-2 text-red-300">FAULTS<br /><b>{fault}</b></div>
              <div className="border border-amber-400/40 p-2 text-amber-300">SAFE<br /><b>{safe}</b></div>
              <div className="border border-purple-400/40 p-2 text-purple-300">API<br /><b>{apiError ? "ERROR" : "OK"}</b></div>
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

          <Panel title="Replay Engine Monitor" className="col-span-3">
            <div className="text-lg font-black text-amber-300">{realValue(replayStatus?.state || "IDLE")}</div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[8px]">
              <div className="mini-box">Wins<br /><b>{qualified}</b></div>
              <div className="mini-box">Trades<br /><b>{trades}</b></div>
            </div>
          </Panel>

          <Panel title="Neural Learning Core" className="col-span-3">
            <div className="mini-stat-grid">
              <div className="mini-box">Learning<br /><b>{realValue(metrics?.learningScore || 0)}</b></div>
              <div className="mini-box">Samples<br /><b>{trades}</b></div>
              <div className="mini-box">Threshold<br /><b>{required}</b></div>
              <div className="mini-box">Live<br /><b>NO</b></div>
            </div>
          </Panel>

          <Panel title="Decision Stream // Live Log" className="col-span-6">
            <div className="space-y-1 text-[8px]">
              {moduleRows.slice(0, 5).map((m) => {
                const t = tone(m.state);
                return (
                  <div key={m.key || m.label} className="mini-row">
                    <span className="truncate">{m.label}</span>
                    <span className={`font-black uppercase ${t.text}`}>{m.state}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <section className="panel col-span-12 flex items-center justify-between px-3 text-[8px] uppercase tracking-[0.16em]">
            <span><b className="text-emerald-300">MAX DD:</b> {maxDd}</span>
            <span><b className="text-emerald-300">WIN RATE:</b> {winRate}</span>
            <span><b className="text-purple-300">PF:</b> {profitFactor}</span>
            <span><b className="text-cyan-300">HEART:</b> RIGHT-TO-LEFT ECG</span>
            <span><b className="text-amber-300">SAFE:</b> {safe}</span>
          </section>
        </main>
      </div>
    </div>
  );
}
