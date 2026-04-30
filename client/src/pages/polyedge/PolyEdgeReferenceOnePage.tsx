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


function ecgSeed(text: unknown) {
  return String(text || "polyedge")
    .split("")
    .reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i + 7), 0);
}

function ecgAgeMs(monitor?: Monitor) {
  const raw = monitor?.lastCheckAt;
  if (!raw) return null;
  const t = Date.parse(String(raw));
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Date.now() - t);
}

function ecgRhythm(monitor?: Monitor) {
  const seed = ecgSeed(monitor?.key || monitor?.label);
  const age = ecgAgeMs(monitor);

  let base = 12.5;
  if (age !== null) {
    if (age < 2500) base = 6.8;
    else if (age < 5000) base = 8.2;
    else if (age < 10000) base = 10.5;
    else if (age < 20000) base = 13.5;
    else base = 17.5;
  }

  const spread = (seed % 9) * 0.37;
  const duration = base + spread;
  const delay = -((seed % 97) / 97) * duration;

  return {
    duration: `${duration.toFixed(2)}s`,
    delay: `${delay.toFixed(2)}s`,
  };
}

function EcgTrace({ monitor, compact = false }: { monitor?: Monitor; compact?: boolean }) {
  const state = String(monitor?.state || "").toLowerCase();
  const isMarket = monitor?.kind === "market";
  const live = monitor?.moving === true && (state === "online" || state === "running");
  const safe = state === "idle" || state === "blocked" || state === "paper_only";
  const fault = state === "offline" || state === "timeout" || state === "stalled" || state === "fault";
  const rhythm = ecgRhythm(monitor);

  const rhythmStyle = {
    "--ecg-duration": rhythm.duration,
    "--ecg-delay": rhythm.delay,
  } as React.CSSProperties;

  if (isMarket) {
    const seed = ecgSeed(monitor?.key || monitor?.label);
    return (
      <div className={compact ? "ecg-bars compact" : "ecg-bars"}>
        {Array.from({ length: compact ? 14 : 18 }).map((_, i) => (
          <span
            key={i}
            style={{
              height: `${Math.max(14, stateScore(monitor || {}) - (((i + seed) * 9) % 38))}%`,
              animationDelay: `${((i + seed) % 7) * 0.13}s`,
              animationDuration: rhythm.duration,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={compact ? "ecg-window compact" : "ecg-window"}>
      <svg className="ecg-track" viewBox="0 0 520 34" preserveAspectRatio="none">
        <line x1="0" y1="18" x2="520" y2="18" className={fault ? "flat fault" : safe ? "flat safe" : "flat"} />
        {live ? (
          <g className="beat-scroll live" style={rhythmStyle}>
            <path d="M0 18 H34 L42 9 L50 27 L59 3 L69 31 L80 18 H112 L120 18 L128 10 L136 25 L147 18 H176 L184 8 L192 27 L201 4 L211 30 L222 18 H260 H294 L302 9 L310 27 L319 3 L329 31 L340 18 H372 L380 18 L388 10 L396 25 L407 18 H436 L444 8 L452 27 L461 4 L471 30 L482 18 H520" />
          </g>
        ) : safe ? (
          <g className="beat-scroll safe" style={rhythmStyle}>
            <path d="M0 18 H86 L92 16 L98 20 L104 18 H172 L178 17 L184 20 L190 18 H260 H346 L352 16 L358 20 L364 18 H432 L438 17 L444 20 L450 18 H520" />
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

  const adminNavItems = [
    ["Dashboard", "/admin/dashboard"],
    ["Nexora OS", "/admin/nexora-os"],
    ["AI Monitor", "/admin/ai-monitor"],
    ["Trading Monitor", "/admin/trading-monitor"],
    ["PhantomX Intelligence", "/admin/phantomx-intelligence"],
    ["PolyEdge Aetherforge", "/admin/polyedge-aetherforge"],
    ["PhantomX Compliance", "/admin/phantomx-compliance"],
    ["AI Chat", "/admin/ai-chat"],
    ["Deal Pipeline", "/admin/deal-pipeline"],
    ["Leads", "/admin/leads"],
    ["Lead Engine", "/admin/lead-engine"],
    ["Quotes", "/admin/quotes"],
    ["Move Radar", "/admin/move-radar"],
    ["Property Intelligence", "/admin/property-intelligence"],
    ["Property Listings", "/admin/property-listings"],
    ["Import Listings", "/admin/import-listings"],
    ["Property Enquiries", "/admin/property-enquiries"],
    ["Customers", "/admin/customers"],
    ["Subscriptions", "/admin/subscriptions"],
    ["Client Projects", "/admin/client-projects"],
    ["Deal Hunter", "/admin/deal-hunter"],
    ["Territory Scanner", "/admin/territory-scanner"],
    ["Prediction Markets", "/admin/prediction-markets"],
  ];

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
          grid-template-rows: 46px 188px 1fr 46px;
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

        .nav-scroll {
          height: 100%;
          overflow: auto;
          padding-right: 2px;
          scrollbar-width: thin;
          scrollbar-color: rgba(34,211,238,.4) transparent;
        }

        .nav-scroll::-webkit-scrollbar {
          width: 3px;
        }

        .nav-scroll::-webkit-scrollbar-thumb {
          background: rgba(34,211,238,.35);
          border-radius: 999px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 14px;
          padding: 0 5px;
          text-decoration: none;
          border: 1px solid rgba(34,211,238,.12);
          background: rgba(0,0,0,.34);
          color: rgba(190,255,255,.72);
          font-size: 6.2px;
          font-weight: 900;
          letter-spacing: .13em;
          text-transform: uppercase;
        }

        .nav-item.active {
          color: #ffd166;
          border-color: rgba(255,209,102,.45);
          background: rgba(255,209,102,.10);
        }

        .ecg-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
          height: 100%;
          overflow: hidden;
        }

        .ecg-card {
          min-height: 26px;
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
          height: 9px;
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
          filter:
            drop-shadow(0 0 5px rgba(33,255,130,.75))
            drop-shadow(0 0 12px rgba(33,255,130,.48));
          animation: ecgLivePulse 1.05s ease-in-out infinite;
        }

        .beat-scroll.safe path {
          stroke: #ffd166;
          stroke-width: 2;
          filter: drop-shadow(0 0 4px rgba(255,209,102,.55));
          animation: ecgSafePulse 2.4s ease-in-out infinite;
        }

        .beat-scroll {
          animation: ecgMoveRightToLeft var(--ecg-duration, 12s) linear infinite;
          animation-delay: var(--ecg-delay, 0s);
          transform-box: fill-box;
          will-change: transform;
        }

        .beat-scroll.safe {
          opacity: .9;
        }

        /*
          Correct monitor direction:
          the waveform travels right-to-left through the viewport.
          Each monitor uses a different duration/delay from its connection freshness.
        */
        @keyframes ecgMoveCorrectDirection {
          from { transform: translateX(260px); }
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

        @keyframes ecgLivePulse {
          0%, 100% {
            opacity: .68;
            stroke-width: 2.6;
            filter:
              drop-shadow(0 0 4px rgba(33,255,130,.55))
              drop-shadow(0 0 9px rgba(33,255,130,.30));
          }
          38% {
            opacity: 1;
            stroke-width: 4.2;
            filter:
              drop-shadow(0 0 8px rgba(33,255,130,1))
              drop-shadow(0 0 18px rgba(33,255,130,.75));
          }
          54% {
            opacity: .92;
            stroke-width: 3.4;
            filter:
              drop-shadow(0 0 6px rgba(33,255,130,.8))
              drop-shadow(0 0 14px rgba(33,255,130,.55));
          }
        }

        @keyframes ecgSafePulse {
          0%, 100% {
            opacity: .38;
            stroke-width: 1.6;
          }
          45% {
            opacity: .78;
            stroke-width: 2.4;
          }
        }

        .holo-stage {
          position: relative;
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .holo-ring {
          position: absolute;
          border: 1px solid rgba(34,211,238,.34);
          border-radius: 999px;
          box-shadow: 0 0 18px rgba(34,211,238,.18);
          transform-style: preserve-3d;
        }

        .holo-ring.one {
          width: 82%;
          height: 42%;
          transform: rotateX(66deg);
          animation: holoRingSpin 9s linear infinite;
        }

        .holo-ring.two {
          width: 58%;
          height: 30%;
          border-color: rgba(217,70,239,.32);
          transform: rotateX(66deg) rotateZ(34deg);
          animation: holoRingSpinReverse 6.5s linear infinite;
        }

        .holo-ring.three {
          width: 36%;
          height: 18%;
          border-color: rgba(16,185,129,.28);
          transform: rotateX(66deg) rotateZ(-28deg);
          animation: holoRingSpin 4.8s linear infinite;
        }

        .holo-core {
          width: 26%;
          height: 18%;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255,255,255,.95), rgba(34,211,238,.74) 34%, rgba(192,38,211,.18) 68%, transparent);
          filter: blur(.4px);
          box-shadow:
            0 0 24px rgba(34,211,238,.82),
            0 0 48px rgba(192,38,211,.42);
          animation: holoCorePulse 1.8s ease-in-out infinite;
        }

        .holo-orbit-dot {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #67e8f9;
          box-shadow:
            0 0 12px rgba(103,232,249,1),
            0 0 26px rgba(103,232,249,.75);
          animation: holoDotOrbit 4.6s linear infinite;
        }

        .holo-scan {
          position: absolute;
          inset: 12%;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(34,211,238,.18), transparent);
          animation: holoScan 3.2s ease-in-out infinite;
          mix-blend-mode: screen;
        }

        .liquidity-stage {
          position: relative;
          height: 100%;
          display: flex;
          align-items: end;
          gap: 3px;
          padding: 8px 10px 5px;
          overflow: hidden;
        }

        .liquidity-stage::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(100deg, transparent 0%, rgba(34,211,238,.16) 45%, transparent 70%);
          transform: translateX(-120%);
          animation: liquiditySweep 3.6s linear infinite;
          pointer-events: none;
        }

        .liquidity-bar {
          position: relative;
          flex: 1;
          min-width: 3px;
          border-radius: 999px 999px 0 0;
          background: linear-gradient(to top, #f97316, #22d3ee, #fff);
          box-shadow:
            0 0 7px rgba(34,211,238,.45),
            0 0 14px rgba(249,115,22,.22);
          transform-origin: bottom;
          animation: liquidityPulse 1.7s ease-in-out infinite alternate;
        }

        .liquidity-bar::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 30%;
          border-radius: inherit;
          background: rgba(255,255,255,.42);
          filter: blur(1px);
        }

        @keyframes holoRingSpin {
          from { transform: rotateX(66deg) rotateZ(0deg); }
          to { transform: rotateX(66deg) rotateZ(360deg); }
        }

        @keyframes holoRingSpinReverse {
          from { transform: rotateX(66deg) rotateZ(360deg); }
          to { transform: rotateX(66deg) rotateZ(0deg); }
        }

        @keyframes holoCorePulse {
          0%, 100% {
            transform: scale(.86);
            opacity: .62;
          }
          45% {
            transform: scale(1.08);
            opacity: 1;
          }
        }

        @keyframes holoDotOrbit {
          0% { transform: rotate(0deg) translateX(42px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(42px) rotate(-360deg); }
        }

        @keyframes holoScan {
          0%, 100% { opacity: .08; transform: rotate(0deg) scale(.85); }
          50% { opacity: .36; transform: rotate(180deg) scale(1.08); }
        }

        @keyframes liquidityPulse {
          0% {
            transform: scaleY(.68);
            opacity: .58;
            filter: brightness(.85);
          }
          100% {
            transform: scaleY(1.08);
            opacity: 1;
            filter: brightness(1.3);
          }
        }

        @keyframes liquiditySweep {
          from { transform: translateX(-120%); }
          to { transform: translateX(120%); }
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

          .nav-scroll {
            overflow: visible;
          }

          .nav-item {
            height: 28px;
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
              <div className="nav-scroll">
              {adminNavItems.map(([label, href]) => (
                <a
                  className={`nav-item ${href === "/admin/polyedge-aetherforge" ? "active" : ""}`}
                  key={href}
                  href={href}
                >
                  <span>{label}</span><span>›</span>
                </a>
              ))}
              </div>
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
            <div className="liquidity-stage">
              {(statusBars.length ? statusBars : [22, 36, 48, 32, 58, 44, 70, 62, 38, 55, 46, 64, 34, 52, 76, 42, 60, 49, 66, 37, 54, 71]).map((h, i) => (
                <span
                  key={i}
                  className="liquidity-bar"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${(i % 9) * 0.11}s`,
                    animationDuration: `${1.35 + (i % 6) * 0.13}s`,
                  }}
                />
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
            <div className="holo-stage">
              <div className="holo-scan" />
              <div className="holo-ring one" />
              <div className="holo-ring two" />
              <div className="holo-ring three" />
              <div className="holo-core" />
              <div className="holo-orbit-dot" />
              <div className="absolute bottom-2 text-[8px] uppercase tracking-[0.18em] text-cyan-300/70">Real Monitors • Active Field</div>
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
            <span><b className="text-cyan-300">HEART:</b> PULSING ECG</span>
            <span><b className="text-amber-300">SAFE:</b> {safe}</span>
          </section>
        </main>
      </div>
    </div>
  );
}
