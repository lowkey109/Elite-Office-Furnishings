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

  let base = 9.5;
  if (age !== null) {
    if (age < 2500) base = 5.6;
    else if (age < 5000) base = 6.8;
    else if (age < 10000) base = 8.8;
    else if (age < 20000) base = 11.5;
    else base = 15.5;
  }

  const duration = base + (seed % 8) * 0.41;
  const delay = -((seed % 101) / 101) * duration;

  return {
    duration: `${duration.toFixed(2)}s`,
    delay: `${delay.toFixed(2)}s`,
  };
}

function EcgTrace({ monitor, compact = false }: { monitor?: Monitor; compact?: boolean }) {
  const state = String(monitor?.state || "").toLowerCase();
  const score = stateScore(monitor || {});
  const rhythm = ecgRhythm(monitor);

  const disconnected =
    !state ||
    state.includes("offline") ||
    state.includes("timeout") ||
    state.includes("stalled") ||
    state.includes("fault") ||
    state.includes("blocked") ||
    state.includes("disconnect") ||
    state.includes("unavailable") ||
    state.includes("required") ||
    state.includes("waiting");

  const live =
    !disconnected &&
    (monitor?.moving === true || state === "online" || state === "running" || state === "active");

  const safe =
    !disconnected &&
    !live &&
    (state === "idle" || state === "paper_only" || state === "standby" || state === "ready");

  // Real monitor feel:
  // ECG time draws left-to-right, then resets.
  // Live connections draw faster; safe/idle draws slower; disconnected is a true flatline.
  const sweepDuration = disconnected
    ? "0s"
    : live
      ? `${Math.max(4.8, 7.4 - score / 30).toFixed(2)}s`
      : safe
        ? `${Math.max(7.2, 10.8 - score / 28).toFixed(2)}s`
        : rhythm.duration;

  const rhythmStyle = {
    "--ecg-duration": sweepDuration,
    "--ecg-delay": rhythm.delay,
  } as React.CSSProperties;

  return (
    <div
      className={
        disconnected
          ? compact
            ? "ecg-real-monitor compact flatline"
            : "ecg-real-monitor flatline"
          : compact
            ? "ecg-real-monitor compact"
            : "ecg-real-monitor"
      }
    >
      <svg className="ecg-real-svg" viewBox="0 0 260 38" preserveAspectRatio="none">
        <line
          x1="0"
          y1="20"
          x2="260"
          y2="20"
          className={disconnected ? "ecg-baseline fault" : safe ? "ecg-baseline safe" : "ecg-baseline"}
        />

        {disconnected ? null : (
          <g className={live ? "ecg-real-sweep live" : "ecg-real-sweep safe"} style={rhythmStyle}>
            <rect className="ecg-strip-flash" x="0" y="0" width="260" height="38" rx="4" />
            <path
              className="ecg-real-wave"
              pathLength={1000}
              d="
                M0 20
                H13
                C17 20 19 17.5 22 17.5
                C25 17.5 27 20 31 20
                H40
                L44 23
                L49 6
                L54 31
                L60 20
                H75
                C82 20 86 13.5 93 13.5
                C101 13.5 106 20 114 20
                H130

                H143
                C147 20 149 17.5 152 17.5
                C155 17.5 157 20 161 20
                H170
                L174 23
                L179 6
                L184 31
                L190 20
                H205
                C212 20 216 13.5 223 13.5
                C231 13.5 236 20 244 20
                H260
              "
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function PolyEdgeAdditiveRealDataMonitors({ data }: { data: any }) {
  const monitors = [
    ["Market Regime", data?.marketRegime?.regime, data?.marketRegime?.sourceType],
    ["Volatility ATR", data?.volatilityAtr?.mode, data?.volatilityAtr?.sourceType],
    ["Liquidity", data?.liquidity?.status || data?.liquidity?.mode, data?.liquidity?.sourceType],
    ["Execution Quality", data?.executionQuality?.status || data?.executionQuality?.grade, data?.executionQuality?.sourceType],
    ["Strategy Edge", data?.strategyEdge?.status || data?.strategyEdge?.edge, data?.strategyEdge?.sourceType],
    ["Capital Health", data?.capitalHealth?.status || data?.capitalHealth?.mode, data?.capitalHealth?.sourceType],
    ["Open PnL", data?.openPnl?.value ?? data?.openPnl, data?.openPnl?.sourceType],
    ["Win Rate", data?.performance?.winRate ?? data?.winRate, data?.performance?.sourceType],
    ["Profit Factor", data?.performance?.profitFactor ?? data?.profitFactor, data?.performance?.sourceType],
    ["Feed Health", data?.feedHealth?.status || data?.primaryFeed?.status, data?.feedHealth?.sourceType || data?.primaryFeed?.sourceType],
  ];

  return (
    <section className="polyedge-additive-real-monitors">
      <div className="polyedge-section-heading">
        <span>ADDITIVE REAL-DATA MONITORS</span>
        <small>non-replacing expansion</small>
      </div>

      <div className="polyedge-additive-monitor-grid">
        {monitors.map(([label, value, source]) => (
          <div className="polyedge-additive-monitor-card" key={label}>
            <div className="polyedge-additive-monitor-label">{label}</div>
            <div className="polyedge-additive-monitor-value">
              {value === null || value === undefined || value === "" ? "WAITING" : String(value)}
            </div>
            <div className="polyedge-additive-monitor-source">
              {source ? String(source) : "WAITING_FOR_REAL_DATA"}
            </div>
          </div>
        ))}
      </div>
    </section>
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
  const [traderMonitors, setTraderMonitors] = useState<any>(null);
  const [additiveRealMonitors, setAdditiveRealMonitors] = useState<any>(null);
  const [capitalState, setCapitalState] = useState<any>(null);
  const [capitalType, setCapitalType] = useState<"real" | "paper">("paper");
  const [capitalAmount, setCapitalAmount] = useState("");
  const [capitalNote, setCapitalNote] = useState("");
  const [capitalMessage, setCapitalMessage] = useState("");
  const [autoPaperState, setAutoPaperState] = useState<any>(null);
  const [autoPaperMessage, setAutoPaperMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const requests = await Promise.allSettled([
        fetch("/api/polyedge/action-monitor").then((r) => r.json()),
        fetch("/api/polyedge/replay/status").then((r) => r.json()),
        fetch("/api/polyedge/capital/status").then((r) => r.json()),
        fetch("/api/polyedge/auto-paper/status").then((r) => r.json()),
      ]);

      if (!active) return;

      if (requests[0].status === "fulfilled") setActionMonitor(requests[0].value);
      if (requests[1].status === "fulfilled") setReplayStatus(requests[1].value);
      if (requests[2]?.status === "fulfilled") setCapitalState(requests[2].value?.capital || null);
      if (requests[3]?.status === "fulfilled") setAutoPaperState(requests[3].value || null);

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

  useEffect(() => {
    let active = true;

    async function loadTraderMonitors() {
      try {
        const res = await fetch("/api/polyedge/trader-monitors");
        const json = await res.json();
        if (active) setTraderMonitors(json);
      } catch {
        if (active) setTraderMonitors(null);
      }
    }

    loadTraderMonitors();
    const timer = window.setInterval(loadTraderMonitors, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);


  useEffect(() => {
    let active = true;

    async function loadAdditiveRealMonitors() {
      try {
        const res = await fetch("/api/polyedge/additive-real-monitors");
        if (!res.ok) throw new Error("additive monitor request failed");
        const json = await res.json();
        if (active) setAdditiveRealMonitors(json);
      } catch {
        if (active) setAdditiveRealMonitors(null);
      }
    }

    loadAdditiveRealMonitors();
    const timer = window.setInterval(loadAdditiveRealMonitors, 15000);

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

  const autoExecMonitor = traderMonitors?.autoExecution || {};
  const openPositionMonitor = Array.isArray(traderMonitors?.openPositions) ? traderMonitors.openPositions : [];
  const learningMonitor = traderMonitors?.learning || {};
  const riskMonitor = traderMonitors?.riskGovernor || {};
  const regimeMonitor = traderMonitors?.marketRegime || {};
  const strategyLeaderboardMonitor = Array.isArray(traderMonitors?.strategyLeaderboard) ? traderMonitors.strategyLeaderboard : [];
  const symbolWatchlistMonitor = Array.isArray(traderMonitors?.symbolWatchlist) ? traderMonitors.symbolWatchlist : [];
  const signalQualityMonitor = traderMonitors?.signalQuality || {};
  const liquidityMonitor = traderMonitors?.liquidityOrderFlow || {};
  const newsRiskMonitor = traderMonitors?.newsEventRisk || {};

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

  async function submitCapitalAdd() {
    setCapitalMessage("");

    const amount = Number(capitalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCapitalMessage("Enter a valid amount greater than zero.");
      return;
    }

    try {
      const res = await fetch("/api/polyedge/capital/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: capitalType, amount, note: capitalNote }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Capital update failed.");

      setCapitalState(json.state);
      setCapitalAmount("");
      setCapitalNote("");
      setCapitalMessage(json.message || "Capital updated.");
    } catch (err: any) {
      setCapitalMessage(err?.message || "Capital update failed.");
    }
  }

  async function quickAddCapital(type: "real" | "paper", amount: number) {
    setCapitalMessage("");

    try {
      const res = await fetch("/api/polyedge/capital/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount, note: type === "paper" ? "quick paper boost" : "quick real tracking" }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Capital update failed.");

      setCapitalState(json.state);
      setCapitalMessage(json.message || "Capital updated.");
    } catch (err: any) {
      setCapitalMessage(err?.message || "Capital update failed.");
    }
  }

  async function callAutoPaper(action: "start-fast" | "stop" | "tick") {
    setAutoPaperMessage("");

    try {
      const res = await fetch(`/api/polyedge/auto-paper/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json();
      setAutoPaperState(json.state ? { ...json.state, learning: json.learning } : json);
      setAutoPaperMessage(json.lastReason || json.state?.lastReason || json.opened?.reason || json.error || "Auto paper updated.");
    } catch (err: any) {
      setAutoPaperMessage(err?.message || "Auto paper action failed.");
    }
  }

  async function resetPaperCapital() {
    setCapitalMessage("");

    const amount = Number(capitalAmount || 100000);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCapitalMessage("Enter a valid paper reset amount.");
      return;
    }

    try {
      const res = await fetch("/api/polyedge/capital/reset-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Paper reset failed.");

      setCapitalState(json.state);
      setCapitalAmount("");
      setCapitalNote("");
      setCapitalMessage(json.message || "Paper capital reset.");
    } catch (err: any) {
      setCapitalMessage(err?.message || "Paper reset failed.");
    }
  }

  const realCapital = realMoney(capitalState?.realMoneyBalance || 0);
  const paperCapital = realMoney(capitalState?.paperMoneyBalance || 0);

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

        .ecg-real-monitor {
          position: relative;
          width: 100%;
          height: 15px;
          margin-top: 1px;
          overflow: hidden;
          background:
            linear-gradient(rgba(33,255,130,.09) 1px, transparent 1px),
            linear-gradient(90deg, rgba(33,255,130,.07) 1px, transparent 1px),
            rgba(0, 12, 5, .55);
          background-size: 12px 8px, 12px 8px, auto;
          box-shadow:
            inset 0 0 10px rgba(33,255,130,.10),
            0 0 6px rgba(33,255,130,.08);
        }

        .ecg-real-monitor.compact {
          height: 12px;
        }

        .ecg-real-svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .ecg-baseline {
          stroke: rgba(33,255,130,.34);
          stroke-width: 1.3;
        }

        .ecg-baseline.safe {
          stroke: rgba(255,209,102,.45);
        }

        .ecg-baseline.fault {
          stroke: rgba(255,77,109,.55);
        }

        .ecg-real-sweep {
          will-change: contents;
        }

        .ecg-real-wave {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2.45;
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: ecgDrawLeftToRight var(--ecg-duration, 6.2s) linear infinite;
          animation-delay: var(--ecg-delay, 0s);
        }

        .ecg-real-sweep.live .ecg-real-wave {
          stroke: #21ff82;
          filter:
            drop-shadow(0 0 5px rgba(33,255,130,.98))
            drop-shadow(0 0 14px rgba(33,255,130,.72));
        }

        .ecg-real-sweep.safe .ecg-real-wave {
          stroke: #ffd166;
          stroke-width: 1.9;
          opacity: .86;
          filter: drop-shadow(0 0 5px rgba(255,209,102,.55));
        }

        .ecg-strip-flash {
          fill: rgba(33,255,130,.14);
          opacity: 0;
          filter: blur(5px) drop-shadow(0 0 20px rgba(33,255,130,.85));
          animation: ecgWholeStripFlash var(--ecg-duration, 6.2s) ease-in-out infinite;
          animation-delay: var(--ecg-delay, 0s);
          mix-blend-mode: screen;
        }

        .ecg-real-sweep.safe .ecg-strip-flash {
          fill: rgba(255,209,102,.10);
          filter: blur(5px) drop-shadow(0 0 15px rgba(255,209,102,.55));
        }

        @keyframes ecgDrawLeftToRight {
          0% {
            stroke-dashoffset: 1000;
            opacity: .9;
          }
          4% {
            opacity: 1;
          }
          92% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: .42;
          }
        }

        @keyframes ecgWholeStripFlash {
          0%, 7%, 23%, 39%, 55%, 72%, 88%, 100% {
            opacity: 0;
          }
          10%, 42%, 75% {
            opacity: .92;
          }
          13%, 45%, 78% {
            opacity: .22;
          }
        }

          /* FINAL LAYOUT REPAIR AFTER ECG PATCH — do not remove ECG styles */
          .capital-form input,
          .capital-form select,
          .capital-form textarea {
            background: rgba(2, 8, 23, 0.92) !important;
            color: rgb(224, 242, 254) !important;
            border: 1px solid rgba(34, 211, 238, 0.28) !important;
            outline: none !important;
          }

          .capital-form input::placeholder,
          .capital-form textarea::placeholder {
            color: rgba(165, 243, 252, 0.42) !important;
          }

          .polyedge-additive-real-monitors {
            grid-column: 1 / -1;
            margin-top: 4px;
            min-height: 104px;
            max-height: 132px;
            overflow: hidden;
            border: 1px solid rgba(34, 211, 238, 0.28);
            background: linear-gradient(180deg, rgba(3, 12, 24, 0.92), rgba(2, 6, 18, 0.96));
            box-shadow:
              inset 0 0 24px rgba(34, 211, 238, 0.055),
              0 0 18px rgba(34, 211, 238, 0.08);
            padding: 6px;
          }

          .polyedge-section-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 6px;
            color: rgb(165, 243, 252);
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 0.16em;
            line-height: 1;
            text-transform: uppercase;
          }

          .polyedge-section-heading small {
            color: rgba(196, 181, 253, 0.72);
            font-size: 6px;
            font-weight: 900;
            letter-spacing: 0.12em;
            white-space: nowrap;
          }

          .polyedge-additive-monitor-grid {
            display: grid !important;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 5px;
          }

          .polyedge-additive-monitor-card {
            min-height: 40px;
            overflow: hidden;
            border: 1px solid rgba(34, 211, 238, 0.16);
            background: rgba(2, 8, 23, 0.74);
            padding: 5px;
          }

          .polyedge-additive-monitor-label {
            color: rgba(224, 242, 254, 0.66);
            font-size: 6.5px;
            font-weight: 900;
            letter-spacing: 0.075em;
            line-height: 1.05;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .polyedge-additive-monitor-value {
            margin-top: 4px;
            color: rgb(134, 239, 172);
            font-size: 8px;
            font-weight: 900;
            line-height: 1.05;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .polyedge-additive-monitor-source {
            margin-top: 3px;
            color: rgba(103, 232, 249, 0.54);
            font-size: 5.5px;
            font-weight: 800;
            letter-spacing: 0.035em;
            line-height: 1.05;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          @media (max-width: 900px) {
            .polyedge-additive-monitor-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .polyedge-additive-real-monitors {
              max-height: none;
            }
          }


        /* QUANTUM HOLO ONLY PATCH — ECG untouched */
        .holo-core {
          width: 18% !important;
          height: 18% !important;
          border-radius: 999px !important;
          background:
            radial-gradient(circle, rgba(255,255,255,.96) 0%, rgba(125,211,252,.84) 22%, rgba(34,211,238,.32) 44%, rgba(192,38,211,.10) 68%, transparent 74%) !important;
          filter: blur(.25px) !important;
          box-shadow:
            0 0 18px rgba(34,211,238,.76),
            0 0 38px rgba(192,38,211,.30) !important;
          animation: holoCorePulse 2.4s ease-in-out infinite !important;
        }

        .holo-orbit-dot {
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          width: 2.4px !important;
          height: 2.4px !important;
          margin-left: -1.2px !important;
          margin-top: -1.2px !important;
          border-radius: 999px !important;
          background: rgba(220, 252, 231, .94) !important;
          opacity: .82 !important;
          box-shadow:
            0 0 5px rgba(134,239,172,.9),
            0 0 13px rgba(34,211,238,.5) !important;
          mix-blend-mode: screen !important;
        }

        .holo-orbit-dot::after {
          content: "" !important;
          position: absolute !important;
          right: 2px !important;
          top: 1px !important;
          width: 15px !important;
          height: 1px !important;
          border-radius: 999px !important;
          background: linear-gradient(90deg, transparent, rgba(103,232,249,.58)) !important;
          filter: blur(.45px) !important;
          opacity: .68 !important;
        }

        .holo-orbit-dot.one {
          animation: quantumElectronOrbitA 6.2s linear infinite !important;
        }

        .holo-orbit-dot.two {
          width: 2px !important;
          height: 2px !important;
          margin-left: -1px !important;
          margin-top: -1px !important;
          background: rgba(216,180,254,.92) !important;
          animation: quantumElectronOrbitB 7.6s linear infinite !important;
          animation-delay: -1.2s !important;
        }

        .holo-orbit-dot.three {
          width: 2.25px !important;
          height: 2.25px !important;
          margin-left: -1.125px !important;
          margin-top: -1.125px !important;
          background: rgba(125,211,252,.94) !important;
          animation: quantumElectronOrbitC 6.9s linear infinite !important;
          animation-delay: -2.1s !important;
        }

        .holo-orbit-dot.four {
          width: 1.8px !important;
          height: 1.8px !important;
          margin-left: -.9px !important;
          margin-top: -.9px !important;
          background: rgba(253,224,71,.86) !important;
          animation: quantumElectronOrbitD 8.8s linear infinite !important;
          animation-delay: -3.4s !important;
        }

        .holo-orbit-dot.five {
          width: 2.1px !important;
          height: 2.1px !important;
          margin-left: -1.05px !important;
          margin-top: -1.05px !important;
          background: rgba(244,114,182,.88) !important;
          animation: quantumElectronOrbitE 9.8s linear infinite !important;
          animation-delay: -4.5s !important;
        }

        .holo-orbit-dot.six {
          width: 1.8px !important;
          height: 1.8px !important;
          margin-left: -.9px !important;
          margin-top: -.9px !important;
          background: rgba(255,255,255,.90) !important;
          animation: quantumElectronOrbitF 5.9s linear infinite !important;
          animation-delay: -2.8s !important;
        }

        .quantum-market-atom {
          position: relative;
          display: grid;
          place-items: center;
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
        }

        .quantum-market-ring {
          position: absolute;
          border: 1px solid rgba(103,232,249,.42);
          border-radius: 999px;
          box-shadow:
            0 0 18px rgba(34,211,238,.18),
            inset 0 0 18px rgba(34,211,238,.08);
          transform-style: preserve-3d;
        }

        .quantum-market-ring.q-one {
          inset: 13%;
          border-color: rgba(217,70,239,.72);
          animation: quantumMarketSpinA 7.2s linear infinite;
        }

        .quantum-market-ring.q-two {
          inset: 24%;
          border-color: rgba(34,211,238,.50);
          animation: quantumMarketSpinB 5.6s linear infinite;
        }

        .quantum-market-ring.q-three {
          inset: 34%;
          border-color: rgba(134,239,172,.38);
          animation: quantumMarketSpinC 8.8s linear infinite;
        }

        .quantum-market-core {
          width: 15px;
          height: 15px;
          border-radius: 999px;
          background: radial-gradient(circle, #fff, rgba(125,211,252,.9) 35%, rgba(217,70,239,.18) 72%, transparent);
          box-shadow:
            0 0 18px rgba(255,255,255,.92),
            0 0 38px rgba(34,211,238,.36);
          animation: quantumMarketCorePulse 2.3s ease-in-out infinite;
        }

        @keyframes quantumElectronOrbitA {
          from { transform: rotateX(64deg) rotateZ(0deg) translateX(42px) rotateZ(0deg); }
          to { transform: rotateX(64deg) rotateZ(360deg) translateX(42px) rotateZ(-360deg); }
        }

        @keyframes quantumElectronOrbitB {
          from { transform: rotateX(64deg) rotateZ(360deg) translateX(34px) rotateZ(-360deg); }
          to { transform: rotateX(64deg) rotateZ(0deg) translateX(34px) rotateZ(0deg); }
        }

        @keyframes quantumElectronOrbitC {
          from { transform: rotateX(74deg) rotateZ(0deg) translateX(52px) rotateZ(0deg); }
          to { transform: rotateX(74deg) rotateZ(360deg) translateX(52px) rotateZ(-360deg); }
        }

        @keyframes quantumElectronOrbitD {
          from { transform: rotateX(54deg) rotateZ(360deg) translateX(47px) rotateZ(-360deg); }
          to { transform: rotateX(54deg) rotateZ(0deg) translateX(47px) rotateZ(0deg); }
        }

        @keyframes quantumElectronOrbitE {
          from { transform: rotateX(78deg) rotateZ(180deg) translateX(39px) rotateZ(-180deg); }
          to { transform: rotateX(78deg) rotateZ(540deg) translateX(39px) rotateZ(-540deg); }
        }

        @keyframes quantumElectronOrbitF {
          from { transform: rotateX(58deg) rotateZ(540deg) translateX(56px) rotateZ(-540deg); }
          to { transform: rotateX(58deg) rotateZ(180deg) translateX(56px) rotateZ(-180deg); }
        }

        @keyframes quantumMarketSpinA {
          from { transform: rotateX(68deg) rotateZ(38deg); }
          to { transform: rotateX(68deg) rotateZ(398deg); }
        }

        @keyframes quantumMarketSpinB {
          from { transform: rotateX(68deg) rotateZ(328deg); }
          to { transform: rotateX(68deg) rotateZ(-32deg); }
        }

        @keyframes quantumMarketSpinC {
          from { transform: rotateX(52deg) rotateZ(82deg); }
          to { transform: rotateX(52deg) rotateZ(442deg); }
        }

        @keyframes quantumMarketCorePulse {
          0%, 100% { transform: scale(.82); opacity: .72; }
          50% { transform: scale(1.08); opacity: 1; }
        }


        /* CAPITAL + QUANTUM VISUAL PATCH — ECG untouched */
        .capital-auto-panel .panel-body {
          padding: 4px !important;
        }

        .capital-auto-panel .grid.grid-cols-2 {
          gap: 4px !important;
        }

        .capital-auto-panel .mini-box {
          min-height: 34px !important;
          padding: 5px !important;
          border: 1px solid rgba(34,211,238,.16) !important;
          background: rgba(0,0,0,.42) !important;
        }

        .capital-auto-panel .capital-form {
          display: grid !important;
          grid-template-columns: 70px 1fr 1fr !important;
          gap: 4px !important;
          margin-top: 4px !important;
        }

        .capital-auto-panel .capital-form select,
        .capital-auto-panel .capital-form input {
          height: 22px !important;
          min-height: 22px !important;
          padding: 0 7px !important;
          font-size: 8px !important;
          line-height: 1 !important;
          background: rgba(2, 8, 23, .94) !important;
          color: rgb(224,242,254) !important;
          border: 1px solid rgba(34,211,238,.28) !important;
          border-radius: 0 !important;
          outline: none !important;
        }

        .capital-auto-panel .capital-buttons,
        .capital-auto-panel .capital-quick-buttons,
        .capital-auto-panel .auto-paper-buttons {
          display: grid !important;
          gap: 4px !important;
          margin-top: 4px !important;
        }

        .capital-auto-panel .capital-buttons {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .capital-auto-panel .capital-quick-buttons,
        .capital-auto-panel .auto-paper-buttons {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .capital-auto-panel button {
          height: 20px !important;
          min-height: 20px !important;
          padding: 0 6px !important;
          font-size: 7px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
          letter-spacing: .12em !important;
          text-transform: uppercase !important;
          color: rgb(190,255,255) !important;
          border: 1px solid rgba(34,211,238,.24) !important;
          background: rgba(3, 15, 30, .78) !important;
        }

        .capital-auto-panel button:hover {
          background: rgba(34,211,238,.14) !important;
          box-shadow: 0 0 12px rgba(34,211,238,.18) !important;
        }

        .capital-auto-panel .mt-1 {
          margin-top: 4px !important;
          font-size: 7px !important;
        }

        .quantum-market-panel .panel-body {
          padding: 5px !important;
        }

        .quantum-market-atom {
          position: relative;
          display: grid;
          place-items: center;
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
          perspective: 420px;
        }

        .quantum-market-ring {
          position: absolute;
          border-radius: 999px;
          border: 1px solid rgba(103,232,249,.42);
          box-shadow:
            0 0 18px rgba(34,211,238,.18),
            inset 0 0 18px rgba(34,211,238,.08);
          transform-style: preserve-3d;
        }

        .quantum-market-ring.q-one {
          inset: 11%;
          border-color: rgba(217,70,239,.78);
          animation: quantumMarketSpinA 5.8s linear infinite;
        }

        .quantum-market-ring.q-two {
          inset: 22%;
          border-color: rgba(34,211,238,.58);
          animation: quantumMarketSpinB 4.4s linear infinite;
        }

        .quantum-market-ring.q-three {
          inset: 32%;
          border-color: rgba(134,239,172,.46);
          animation: quantumMarketSpinC 7.2s linear infinite;
        }

        .quantum-market-core {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: radial-gradient(circle, #fff, rgba(125,211,252,.92) 35%, rgba(217,70,239,.22) 72%, transparent);
          box-shadow:
            0 0 18px rgba(255,255,255,.95),
            0 0 38px rgba(34,211,238,.38);
          animation: quantumMarketCorePulse 2.1s ease-in-out infinite;
        }

        .quantum-market-orbit-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 4px;
          height: 4px;
          margin-left: -2px;
          margin-top: -2px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 0 10px rgba(255,255,255,.95), 0 0 18px rgba(34,211,238,.7);
          mix-blend-mode: screen;
        }

        .quantum-market-orbit-dot.d-one {
          animation: quantumMarketDotA 5.8s linear infinite;
        }

        .quantum-market-orbit-dot.d-two {
          width: 3px;
          height: 3px;
          margin-left: -1.5px;
          margin-top: -1.5px;
          background: #c084fc;
          animation: quantumMarketDotB 4.4s linear infinite;
        }

        .quantum-market-orbit-dot.d-three {
          width: 3px;
          height: 3px;
          margin-left: -1.5px;
          margin-top: -1.5px;
          background: #86efac;
          animation: quantumMarketDotC 7.2s linear infinite;
        }

        @keyframes quantumMarketSpinA {
          from { transform: rotateX(68deg) rotateZ(38deg); }
          to { transform: rotateX(68deg) rotateZ(398deg); }
        }

        @keyframes quantumMarketSpinB {
          from { transform: rotateX(68deg) rotateZ(328deg); }
          to { transform: rotateX(68deg) rotateZ(-32deg); }
        }

        @keyframes quantumMarketSpinC {
          from { transform: rotateX(52deg) rotateZ(82deg); }
          to { transform: rotateX(52deg) rotateZ(442deg); }
        }

        @keyframes quantumMarketDotA {
          from { transform: rotateX(68deg) rotateZ(0deg) translateX(48px) rotateZ(0deg); }
          to { transform: rotateX(68deg) rotateZ(360deg) translateX(48px) rotateZ(-360deg); }
        }

        @keyframes quantumMarketDotB {
          from { transform: rotateX(68deg) rotateZ(360deg) translateX(34px) rotateZ(-360deg); }
          to { transform: rotateX(68deg) rotateZ(0deg) translateX(34px) rotateZ(0deg); }
        }

        @keyframes quantumMarketDotC {
          from { transform: rotateX(52deg) rotateZ(70deg) translateX(26px) rotateZ(-70deg); }
          to { transform: rotateX(52deg) rotateZ(430deg) translateX(26px) rotateZ(-430deg); }
        }

        @keyframes quantumMarketCorePulse {
          0%, 100% { transform: scale(.82); opacity: .72; }
          50% { transform: scale(1.08); opacity: 1; }
        }


        /* FORCE QUANTUM MARKET MOTION DOTS — ECG untouched */
        .quantum-market-ring.q-one {
          animation: quantumMarketSpinA 3.6s linear infinite !important;
        }

        .quantum-market-ring.q-two {
          animation: quantumMarketSpinB 2.8s linear infinite reverse !important;
        }

        .quantum-market-ring.q-three {
          animation: quantumMarketSpinC 4.6s linear infinite !important;
        }

        .quantum-market-orbit-dot {
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          width: 5px !important;
          height: 5px !important;
          margin-left: -2.5px !important;
          margin-top: -2.5px !important;
          border-radius: 999px !important;
          background: #ffffff !important;
          box-shadow:
            0 0 10px rgba(255,255,255,.95),
            0 0 22px rgba(34,211,238,.85) !important;
          z-index: 3 !important;
          mix-blend-mode: screen !important;
        }

        .quantum-market-orbit-dot.d-one {
          animation: quantumMarketDotA 3.6s linear infinite !important;
        }

        .quantum-market-orbit-dot.d-two {
          width: 4px !important;
          height: 4px !important;
          margin-left: -2px !important;
          margin-top: -2px !important;
          background: #c084fc !important;
          box-shadow:
            0 0 10px rgba(192,132,252,.95),
            0 0 22px rgba(217,70,239,.70) !important;
          animation: quantumMarketDotB 2.8s linear infinite reverse !important;
        }

        .quantum-market-orbit-dot.d-three {
          width: 4px !important;
          height: 4px !important;
          margin-left: -2px !important;
          margin-top: -2px !important;
          background: #86efac !important;
          box-shadow:
            0 0 10px rgba(134,239,172,.95),
            0 0 22px rgba(34,197,94,.70) !important;
          animation: quantumMarketDotC 4.6s linear infinite !important;
        }

        @keyframes quantumMarketDotA {
          from { transform: rotateX(68deg) rotateZ(0deg) translateX(48px) rotateZ(0deg); }
          to { transform: rotateX(68deg) rotateZ(360deg) translateX(48px) rotateZ(-360deg); }
        }

        @keyframes quantumMarketDotB {
          from { transform: rotateX(68deg) rotateZ(360deg) translateX(34px) rotateZ(-360deg); }
          to { transform: rotateX(68deg) rotateZ(0deg) translateX(34px) rotateZ(0deg); }
        }

        @keyframes quantumMarketDotC {
          from { transform: rotateX(52deg) rotateZ(70deg) translateX(26px) rotateZ(-70deg); }
          to { transform: rotateX(52deg) rotateZ(430deg) translateX(26px) rotateZ(-430deg); }
        }


        /* PUBLIC EXCHANGE FLOW MONITORS — ECG untouched */
        .polyedge-additive-real-monitors {
          overflow-y: auto !important;
          scrollbar-width: thin;
          scrollbar-color: rgba(34,211,238,.35) transparent;
        }

        .polyedge-additive-real-monitors::-webkit-scrollbar {
          width: 4px;
        }

        .polyedge-additive-real-monitors::-webkit-scrollbar-thumb {
          background: rgba(34,211,238,.35);
          border-radius: 999px;
        }

        .mobile-cockpit {
          display: none;
        }

        @media (max-width: 767px) {
          .shell {
            display: none !important;
          }

          .mobile-cockpit {
            position: relative;
            z-index: 2;
            display: block;
            min-height: 100vh;
            padding: 10px;
            color: #cffafe;
          }

          .mobile-top-card {
            border: 1px solid rgba(34,211,238,.35);
            background: rgba(2,8,23,.82);
            box-shadow: inset 0 0 28px rgba(34,211,238,.08), 0 0 24px rgba(34,211,238,.08);
            padding: 12px;
            margin-bottom: 10px;
          }

          .mobile-brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .mobile-logo {
            display: grid;
            height: 38px;
            width: 38px;
            place-items: center;
            border-radius: 10px;
            border: 1px solid rgba(103,232,249,.45);
            background: rgba(34,211,238,.12);
            color: #a5f3fc;
            font-size: 12px;
            font-weight: 900;
          }

          .mobile-title {
            font-size: 20px;
            line-height: 1;
            font-weight: 900;
            letter-spacing: .18em;
            color: #ecfeff;
          }

          .mobile-subtitle {
            margin-top: 3px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: .22em;
            color: rgba(103,232,249,.65);
          }

          .mobile-pill {
            border: 1px solid rgba(52,211,153,.35);
            background: rgba(16,185,129,.1);
            color: #6ee7b7;
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .mobile-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 12px;
          }

          .mobile-metric {
            border: 1px solid rgba(34,211,238,.22);
            background: rgba(0,0,0,.35);
            padding: 9px;
            min-height: 58px;
          }

          .mobile-metric-label {
            font-size: 9px;
            color: rgba(207,250,254,.48);
            text-transform: uppercase;
            letter-spacing: .14em;
          }

          .mobile-metric-value {
            margin-top: 4px;
            font-size: 15px;
            font-weight: 900;
            color: #67e8f9;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-section {
            border: 1px solid rgba(34,211,238,.28);
            background: rgba(2,8,23,.78);
            margin-top: 10px;
            padding: 12px;
          }

          .mobile-section-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 10px;
            color: #e0f2fe;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: .18em;
            text-transform: uppercase;
          }

          .mobile-status-text {
            color: #fbbf24;
            font-size: 11px;
            line-height: 1.35;
          }

          .mobile-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-top: 10px;
          }

          .mobile-actions button {
            border: 1px solid rgba(34,211,238,.25);
            background: rgba(34,211,238,.08);
            color: #cffafe;
            padding: 9px 6px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .mobile-list {
            display: grid;
            gap: 7px;
          }

          .mobile-row {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            border: 1px solid rgba(34,211,238,.14);
            background: rgba(0,0,0,.28);
            padding: 8px;
            font-size: 11px;
          }

          .mobile-row span {
            color: rgba(207,250,254,.68);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mobile-row b {
            color: #67e8f9;
            white-space: nowrap;
          }

          .mobile-ecg-grid {
            display: grid;
            gap: 8px;
          }
        }

`}

</style>

      <div className="grid-bg" />

      <div className="mobile-cockpit">
        <section className="mobile-top-card">
          <div className="mobile-brand-row">
            <div className="flex items-center gap-3">
              <div className="mobile-logo">P/E</div>
              <div>
                <div className="mobile-title">POLY//EDGE</div>
                <div className="mobile-subtitle">Aetherforge • Paper Only</div>
              </div>
            </div>
            <div className="mobile-pill">{autoPaperState?.enabled ? "Running" : "Standby"}</div>
          </div>

          <div className="mobile-grid">
            <div className="mobile-metric">
              <div className="mobile-metric-label">Win Rate</div>
              <div className="mobile-metric-value">{winRate}</div>
            </div>
            <div className="mobile-metric">
              <div className="mobile-metric-label">Paper P&L</div>
              <div className="mobile-metric-value">{pnl}</div>
            </div>
            <div className="mobile-metric">
              <div className="mobile-metric-label">Trades</div>
              <div className="mobile-metric-value">{trades}</div>
            </div>
            <div className="mobile-metric">
              <div className="mobile-metric-label">Open</div>
              <div className="mobile-metric-value">{autoPaperState?.openPositions ?? 0}</div>
            </div>
            <div className="mobile-metric">
              <div className="mobile-metric-label">Learning</div>
              <div className="mobile-metric-value">{autoPaperState?.learning?.learningScore ?? "WAIT"}</div>
            </div>
            <div className="mobile-metric">
              <div className="mobile-metric-label">Safe</div>
              <div className="mobile-metric-value">{autoPaperState?.paperOnly ? "PAPER" : "CHECK"}</div>
            </div>
          </div>
        </section>

        <section className="mobile-section">
          <div className="mobile-section-title">
            <span>Auto Paper Execution</span>
            <span>{autoPaperState?.running ? "ACTIVE" : "WATCHING"}</span>
          </div>
          <div className="mobile-status-text">
            {capitalMessage || autoPaperMessage || autoPaperState?.lastReason || "Paper-only auto learning ready."}
          </div>
          <div className="mobile-actions">
            <button type="button" onClick={() => callAutoPaper("start-fast")}>Start</button>
            <button type="button" onClick={() => callAutoPaper("tick")}>Tick</button>
            <button type="button" onClick={() => callAutoPaper("stop")}>Stop</button>
          </div>
        </section>

        <section className="mobile-section">
          <div className="mobile-section-title">
            <span>Learning Performance</span>
            <span>{autoPaperState?.learning?.sampleSize ?? 0} samples</span>
          </div>
          <div className="mobile-list">
            <div className="mobile-row"><span>Win Rate</span><b>{autoPaperState?.learning?.winRate ?? "WAIT"}%</b></div>
            <div className="mobile-row"><span>Total P&L</span><b>{realMoney(autoPaperState?.learning?.totalPnl || 0)}</b></div>
            <div className="mobile-row"><span>Profit Factor</span><b>{autoPaperState?.learning?.profitFactor ?? "WAIT"}</b></div>
            <div className="mobile-row"><span>Confidence Floor</span><b>{autoPaperState?.learning?.confidenceFloor ?? "WAIT"}</b></div>
          </div>
        </section>

        <section className="mobile-section">
          <div className="mobile-section-title">
            <span>Strategy Leaderboard</span>
            <span>Live DB</span>
          </div>
          <div className="mobile-list">
            {strategyLeaderboardMonitor.length ? strategyLeaderboardMonitor.slice(0, 5).map((row: any) => (
              <div key={row.strategy} className="mobile-row">
                <span>{row.strategy} • {row.trades} trades</span>
                <b>{row.winRate ?? "WAIT"}% / {realMoney(row.pnl || 0)}</b>
              </div>
            )) : (
              <div className="mobile-row"><span>Waiting for strategy outcomes</span><b>WAIT</b></div>
            )}
          </div>
        </section>

        <section className="mobile-section">
          <div className="mobile-section-title">
            <span>Symbol Watchlist</span>
            <span>Paper</span>
          </div>
          <div className="mobile-list">
            {symbolWatchlistMonitor.length ? symbolWatchlistMonitor.slice(0, 5).map((row: any) => (
              <div key={row.symbol} className="mobile-row">
                <span>{row.symbol} • {row.trend} • open {row.open}</span>
                <b>{row.winRate ?? "WAIT"}% / {realMoney(row.pnl || 0)}</b>
              </div>
            )) : (
              <div className="mobile-row"><span>Waiting for symbol data</span><b>WAIT</b></div>
            )}
          </div>
        </section>

        <section className="mobile-section">
          <div className="mobile-section-title">
            <span>ECG Monitor Rail</span>
            <span>{live}/{monitors.length}</span>
          </div>
          <div className="mobile-ecg-grid">
            {leftRailRows.slice(0, 8).map((monitor) => {
              const t = tone(monitor.state);
              return (
                <div key={monitor.key || monitor.label} className="ecg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-white">{monitor.label || monitor.key}</div>
                    <div className={`text-[9px] font-black uppercase ${t.text}`}>{monitor.state || "unknown"}</div>
                  </div>
                  <EcgTrace monitor={monitor} compact />
                </div>
              );
            })}
          </div>
        </section>
      </div>

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

          <Panel title="Quantum Market Sentiment Matrix" className="col-span-3 quantum-market-panel">
            <div className="grid h-full grid-cols-2 items-center gap-2">
              <div>
                <div className="text-3xl font-black text-emerald-300">{onlinePct}%</div>
                <div className="text-[8px] uppercase tracking-[.2em] text-emerald-300/70">Online</div>
                <div className="mt-3 text-xl font-black text-red-300">{fault}</div>
                <div className="text-[8px] uppercase tracking-[.2em] text-red-300/70">Faults</div>
              </div>
              <div className="quantum-market-atom">
                <div className="quantum-market-ring q-one" />
                <div className="quantum-market-ring q-two" />
                <div className="quantum-market-ring q-three" />
                <div className="quantum-market-orbit-dot d-one" />
                <div className="quantum-market-orbit-dot d-two" />
                <div className="quantum-market-orbit-dot d-three" />
                <div className="quantum-market-core" />
              </div>
            </div>
          </Panel>

          <Panel title="Signal Quality Monitor" className="col-span-3">
            <div className="space-y-1">
              <div className="trader-monitor-row"><span>Confidence</span><b>{signalQualityMonitor.confidence || 0}</b></div>
              <div className="trader-monitor-row"><span>Data Quality</span><b>{signalQualityMonitor.dataQuality || 0}</b></div>
              <div className="trader-monitor-row"><span>Actionable</span><b>{signalQualityMonitor.actionable ? "YES" : "WAIT"}</b></div>
              <div className="trader-monitor-row"><span>Symbol</span><b>{signalQualityMonitor.latestSymbol || "WAITING"}</b></div>
              <div className="trader-monitor-row"><span>Strategy</span><b>{signalQualityMonitor.latestStrategy || "WAITING"}</b></div>
              <div className="truncate text-[7px] text-amber-300">{signalQualityMonitor.latestReason || "Waiting for signal reason."}</div>
            </div>
          </Panel>

          <Panel title="Strategy Leaderboard" className="col-span-3">
            <div className="space-y-1">
              {strategyLeaderboardMonitor.length ? strategyLeaderboardMonitor.map((row: any) => (
                <div key={row.strategy} className="trader-monitor-row">
                  <span>{row.strategy} • {row.trades} trades</span>
                  <b>{row.winRate ?? "WAIT"}% / {realMoney(row.pnl || 0)}</b>
                </div>
              )) : (
                <div className="grid h-full place-items-center text-[9px] text-cyan-300/60">WAITING FOR STRATEGY OUTCOMES</div>
              )}
            </div>
          </Panel>

          <Panel title="Capital + Auto Paper Control" className="col-span-4 capital-auto-panel">
            <div className="grid grid-cols-2 gap-1 text-[8px]">
              <div className="mini-box">
                <div className="text-cyan-100/45">REAL MONEY</div>
                <div className="font-black text-emerald-300">{realCapital}</div>
                <div className="text-[6px] text-cyan-100/40">Tracked only</div>
              </div>
              <div className="mini-box">
                <div className="text-cyan-100/45">PAPER MONEY</div>
                <div className="font-black text-cyan-300">{paperCapital}</div>
                <div className="text-[6px] text-cyan-100/40">Simulation only</div>
              </div>
            </div>

            <div className="capital-form">
              <select value={capitalType} onChange={(e) => setCapitalType(e.target.value as "real" | "paper")}>
                <option value="paper">Paper</option>
                <option value="real">Real</option>
              </select>
              <input
                value={capitalAmount}
                onChange={(e) => setCapitalAmount(e.target.value)}
                placeholder="Amount"
                inputMode="decimal"
              />
              <input
                value={capitalNote}
                onChange={(e) => setCapitalNote(e.target.value)}
                placeholder="Note"
              />
            </div>

            <div className="capital-buttons">
              <button type="button" onClick={submitCapitalAdd}>Add Capital</button>
              <button type="button" onClick={resetPaperCapital}>Reset Paper</button>
            </div>

            <div className="capital-quick-buttons">
              <button type="button" onClick={() => quickAddCapital("paper", 1000)}>+1K Paper</button>
              <button type="button" onClick={() => quickAddCapital("paper", 10000)}>+10K Paper</button>
              <button type="button" onClick={() => quickAddCapital("real", 1000)}>+1K Real</button>
            </div>

            <div className="auto-paper-buttons">
              <button type="button" onClick={() => callAutoPaper("start-fast")}>Start Fast</button>
              <button type="button" onClick={() => callAutoPaper("tick")}>Tick Now</button>
              <button type="button" onClick={() => callAutoPaper("stop")}>Stop</button>
            </div>

            <div className="mt-1 truncate text-[7px] text-amber-300">
              {capitalMessage || autoPaperMessage || autoPaperState?.lastReason || "Paper-only auto learning ready."}
            </div>
          </Panel>
          <Panel title="News / Event Risk Monitor" className="col-span-2">
            <div className="space-y-1">
              <div className="trader-monitor-row"><span>Mode</span><b>{newsRiskMonitor.mode || "WAITING"}</b></div>
              <div className="trader-monitor-row"><span>Shock</span><b>{newsRiskMonitor.shockRisk || "WAITING"}</b></div>
              <div className="trader-monitor-row"><span>Action</span><b>{newsRiskMonitor.action || "WAITING"}</b></div>
              <div className="trader-monitor-row"><span>Risk</span><b>{newsRiskMonitor.riskScore ?? "WAIT"}</b></div>
              <div className="truncate text-[7px] text-amber-300">{newsRiskMonitor.headline || "Waiting for news feed."}</div>
            </div>
          </Panel>

          <Panel title="Order Flow / Liquidity Monitor" className="col-span-3">
            <div className="space-y-1">
              <div className="trader-monitor-row"><span>Liquidity</span><b>{liquidityMonitor.liquidityScore ?? "WAIT"}</b></div>
              <div className="trader-monitor-row"><span>Spread Risk</span><b>{liquidityMonitor.spreadRisk || "WAITING"}</b></div>
              <div className="trader-monitor-row"><span>Slippage</span><b>{liquidityMonitor.simulatedSlippage ?? 0}</b></div>
              <div className="trader-monitor-row"><span>Pressure</span><b>{liquidityMonitor.volumePressure || "WAITING"}</b></div>
              <div className="trader-monitor-row"><span>Execution</span><b>{liquidityMonitor.executionQuality || "WAITING"}</b></div>
            </div>
          </Panel>

          <Panel title="Symbol Watchlist Monitor" className="col-span-3">
            <div className="space-y-1">
              {symbolWatchlistMonitor.length ? symbolWatchlistMonitor.map((row: any) => (
                <div key={row.symbol} className="trader-monitor-row">
                  <span>{row.symbol} • {row.trend} • open {row.open}</span>
                  <b>{row.winRate ?? "WAIT"}% / {realMoney(row.pnl || 0)}</b>
                </div>
              )) : (
                <div className="grid h-full place-items-center text-[9px] text-cyan-300/60">WAITING FOR SYMBOL DATA</div>
              )}
            </div>
          </Panel>

          <Panel title="Holographic Universe View" className="col-span-4">
            <div className="holo-stage">
              <div className="holo-scan" />
              <div className="holo-ring one" />
              <div className="holo-ring two" />
              <div className="holo-ring three" />
              <div className="holo-core" />
              <div className="holo-orbit-dot one" />
              <div className="holo-orbit-dot two" />
              <div className="holo-orbit-dot three" />
              <div className="holo-orbit-dot four" />
              <div className="holo-orbit-dot five" />
              <div className="holo-orbit-dot six" />
              <div className="absolute bottom-2 text-[8px] uppercase tracking-[0.18em] text-cyan-300/70">Real Monitors • Active Field</div>
            </div>
          </Panel>

          <Panel title="Market Regime Monitor" className="col-span-3">
            <div className="grid h-full grid-cols-2 gap-1 text-[8px]">
              <div className="mini-box">
                <div className="text-cyan-100/45">REGIME</div>
                <div className="font-black text-emerald-300">{regimeMonitor.regime || "WAITING"}</div>
              </div>
              <div className="mini-box">
                <div className="text-cyan-100/45">SCORE</div>
                <div className="font-black text-cyan-300">{regimeMonitor.score ?? "WAITING"}</div>
              </div>
              <div className="mini-box">
                <div className="text-cyan-100/45">SIGNAL</div>
                <div className="font-black text-amber-300">{regimeMonitor.signalQuality ?? "WAITING"}</div>
              </div>
              <div className="mini-box">
                <div className="text-cyan-100/45">LATEST</div>
                <div className="font-black text-purple-300">{regimeMonitor.latestSymbol || "WAITING"}</div>
              </div>
            </div>
          </Panel>

          <Panel title="Risk Governor Monitor" className="col-span-2">
            <div className="space-y-1">
              <div className="trader-monitor-row"><span>Mode</span><b>{riskMonitor.mode || "WAITING"}</b></div>
              <div className="trader-monitor-row"><span>Exposure</span><b>{realMoney(riskMonitor.exposure || 0)}</b></div>
              <div className="trader-monitor-row"><span>Open P&L</span><b>{realMoney(riskMonitor.openPnl || 0)}</b></div>
              <div className="trader-monitor-row"><span>Open</span><b>{riskMonitor.openPositions || 0}/{riskMonitor.maxOpenPositions || 8}</b></div>
              <div className="trader-monitor-row"><span>Blocked</span><b>{riskMonitor.blockedTrades || 0}</b></div>
            </div>
          </Panel>

          <Panel title="Auto Paper Execution Monitor" className="col-span-3">
            <div className="space-y-1">
              <div className="trader-monitor-row"><span>Mode</span><b>{autoExecMonitor.enabled ? "FAST RUNNING" : "STOPPED"}</b></div>
              <div className="trader-monitor-row"><span>Ticks</span><b>{autoExecMonitor.ticks || 0}</b></div>
              <div className="trader-monitor-row"><span>Decisions</span><b>{autoExecMonitor.decisionsCreated || 0}</b></div>
              <div className="trader-monitor-row"><span>Opened</span><b>{autoExecMonitor.positionsOpened || 0}</b></div>
              <div className="trader-monitor-row"><span>Closed</span><b>{autoExecMonitor.positionsClosed || 0}</b></div>
              <div className="truncate text-[7px] text-amber-300">{autoExecMonitor.lastReason || "Waiting for auto paper loop."}</div>
            </div>
          </Panel>

          <Panel title="Learning Performance Monitor" className="col-span-3">
            <div className="grid grid-cols-2 gap-1 text-[8px]">
              <div className="mini-box">Samples<br /><b>{learningMonitor.sampleSize || 0}</b></div>
              <div className="mini-box">Win Rate<br /><b>{learningMonitor.winRate ?? "WAITING"}%</b></div>
              <div className="mini-box">Total P&L<br /><b>{realMoney(learningMonitor.totalPnl || 0)}</b></div>
              <div className="mini-box">Profit Factor<br /><b>{learningMonitor.profitFactor ?? "WAITING"}</b></div>
              <div className="mini-box">Learning<br /><b>{learningMonitor.learningScore ?? "WAITING"}</b></div>
              <div className="mini-box">Conf Floor<br /><b>{learningMonitor.confidenceFloor ?? "WAITING"}</b></div>
            </div>
          </Panel>

          <Panel title="Open Positions Monitor" className="col-span-6">
            <div className="space-y-1">
              {openPositionMonitor.length ? openPositionMonitor.map((p: any) => (
                <div key={p.id} className="trader-monitor-row">
                  <span>{p.symbol} • {p.side} • {p.strategy}</span>
                  <b>{realMoney(p.pnl || 0)}</b>
                </div>
              )) : (
                <div className="grid h-full place-items-center text-[9px] text-cyan-300/60">
                  WAITING FOR AUTO PAPER POSITIONS
                </div>
              )}
            </div>
          </Panel>

          <section className="panel col-span-12 flex items-center justify-between px-3 text-[8px] uppercase tracking-[0.16em]">
            <span><b className="text-emerald-300">MAX DD:</b> {maxDd}</span>
            <span><b className="text-emerald-300">WIN RATE:</b> {winRate}</span>
            <span><b className="text-purple-300">PF:</b> {profitFactor}</span>
            <span><b className="text-cyan-300">HEART:</b> REAL ECG PULSE</span>
            <span><b className="text-amber-300">SAFE:</b> {safe}</span>
          </section>
        
        <PolyEdgeAdditiveRealDataMonitors data={additiveRealMonitors} />
</main>
      </div>
    </div>
  );
}
