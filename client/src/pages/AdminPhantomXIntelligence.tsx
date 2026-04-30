import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  Database,
  Eye,
  Hexagon,
  Network,
  Orbit,
  Radar,
  Settings,
  Shield,
  Wallet,
} from "lucide-react";

type Row = Record<string, any>;

type IntelPayload = {
  ok?: boolean;
  mode?: string;
  generatedAt?: string;
  markets?: Row[];
  wallets?: Row[];
  opportunities?: Row[];
  paperTrades?: Row[];
  decisions?: Row[];
  stats?: {
    markets?: number;
    wallets?: number;
    opportunities?: number;
    paperTrades?: number;
    totalVolume?: number;
    totalLiquidity?: number;
    avgConfidence?: number;
  };
  errors?: string[];
};

type LearningPayload = {
  ok?: boolean;
  strategies?: Row[];
  runs?: Row[];
  walletScores?: Row[];
  error?: string;
};

const fallbackMarkets = [
  { question: "BTC > $500K EOY", category: "CRYPTO", volume: 284910, liquidity: 98100, price: 0.9981 },
  { question: "AI TAKEOVER INDEX", category: "AI & TECH", volume: 184200, liquidity: 73000, price: 0.9921 },
  { question: "QUANTUM FED PIVOT", category: "MACRO", volume: 160120, liquidity: 61200, price: 0.9774 },
  { question: "SOLANA HYPERFLUX", category: "CRYPTO", volume: 194200, liquidity: 84200, price: 0.9632 },
  { question: "SPACETIME ARBITRAGE", category: "QUANTUM ARB", volume: 142100, liquidity: 55100, price: 0.9999 },
  { question: "BLACKHOLE HEDGE", category: "MACRO", volume: 98300, liquidity: 40100, price: 0.9811 },
  { question: "MEMECOIN SINGULARITY", category: "OTHER", volume: 71200, liquidity: 33200, price: 0.9522 },
  { question: "GLOBAL COLLAPSE LONG", category: "MACRO", volume: 121200, liquidity: 69000, price: 0.9317 },
];

const fallbackOpportunities = fallbackMarkets.map((m, i) => ({
  ...m,
  id: "fallback-" + i,
  title: m.question,
  score: 99 - i * 2.7,
  impact: 42.7 - i * 3.3,
  status: "WATCH",
}));

const money = (v: any) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000_000_000) return "$" + (n / 1_000_000_000_000).toFixed(2) + "T";
  if (Math.abs(n) >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + Math.round(n).toLocaleString("en-AU");
};

const pct = (v: any) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0%";
  if (n <= 1) return Math.round(n * 1000) / 10 + "%";
  return Math.round(n * 10) / 10 + "%";
};

const num = (v: any) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Math.round(n).toLocaleString("en-AU") : "0";
};

function Panel({ title, children, className = "" }: any) {
  return (
    <section className={`poly-panel ${className}`}>
      <div className="poly-panel-head">
        <h2>{title}</h2>
        <span>○</span>
      </div>
      <div className="poly-panel-body">{children}</div>
    </section>
  );
}

function Stat({ label, value, orange, purple, wide }: any) {
  return (
    <div className={`poly-stat ${wide ? "wide" : ""}`}>
      <div className="poly-stat-label">{label}</div>
      <div className={`poly-stat-value ${orange ? "orange" : purple ? "purple" : ""}`}>{value}</div>
    </div>
  );
}

export default function AdminPhantomXIntelligence() {
  const [intel, setIntel] = useState<IntelPayload>({});
  const [learning, setLearning] = useState<LearningPayload>({});
  const [time, setTime] = useState("2050-05-22 21:47:36.782");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = typeof window !== "undefined" && window.location.pathname.includes("/admin");

  async function load() {
    try {
      const intelRes = await fetch("/api/admin/phantomx/intelligence", {
        credentials: "include",
        cache: "no-store",
      });

      if (intelRes.ok) {
        const intelJson = await intelRes.json().catch(() => ({}));
        setIntel(intelJson || {});
        setError("");
      } else {
        const e = await intelRes.json().catch(() => ({}));
        setError(e?.error || "Phantom X API waiting");
      }

      const learningRes = await fetch("/api/admin/phantomx/learning", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);

      if (learningRes?.ok) {
        const learningJson = await learningRes.json().catch(() => ({}));
        setLearning(learningJson || {});
      }
    } catch (e: any) {
      setError(e?.message || "Phantom X API waiting");
    }
  }

  async function scanAndLearn() {
    setLoading(true);
    try {
      await fetch("/api/admin/phantomx/scan-polymarket", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);

      await fetch("/api/admin/phantomx/learn", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);

      await load();
    } finally {
      setLoading(false);
    }
  }

  async function learnOnly() {
    setLoading(true);
    try {
      await fetch("/api/admin/phantomx/learn", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
      await load();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const clock = setInterval(() => {
      setTime("2050-05-22 " + new Date().toLocaleTimeString("en-AU", { hour12: false }) + ".782");
    }, 1000);
    const refresh = setInterval(load, 20000);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  const markets = (intel.markets?.length ? intel.markets : fallbackMarkets);
  const opportunities = (intel.opportunities?.length ? intel.opportunities : fallbackOpportunities);
  const decisions = intel.decisions || [];
  const trades = intel.paperTrades || [];
  const strategies = learning.strategies || [];
  const runs = learning.runs || [];

  const totalVolume =
    intel?.stats?.totalVolume ||
    markets.reduce((sum, m) => sum + Number(m.volume || 0), 0);

  const totalLiquidity =
    intel?.stats?.totalLiquidity ||
    markets.reduce((sum, m) => sum + Number(m.liquidity || 0), 0);

  const avgConfidence =
    intel?.stats?.avgConfidence ||
    opportunities.reduce((sum, o) => sum + Number(o.score || 0), 0) / Math.max(1, opportunities.length);

  const equity = useMemo(() => {
    return Array.from({ length: 96 }, (_, i) => {
      const t = i / 95;
      return {
        t: i,
        value: 10000 + Math.pow(i, 2.05) * 410000000 + Math.sin(i / 2.7) * 38000000000,
        sim: 9000 + Math.pow(i, 1.95) * 300000000 + Math.cos(i / 3.4) * 21000000000,
        label: `${String(Math.floor(i / 4)).padStart(2, "0")}:00`,
      };
    });
  }, []);

  const flow = useMemo(() => {
    return Array.from({ length: 44 }, (_, i) => ({
      t: i,
      institutions: 72 + Math.sin(i / 4) * 16 + i * 0.7,
      retail: 20 + Math.cos(i / 5) * 10,
      bots: 10 + Math.sin(i / 3) * 5,
    }));
  }, []);

  const bars = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      x: `L${i + 1}`,
      v: 10 + Math.abs(Math.sin(i * 1.7)) * 30,
    }));
  }, []);

  const exposure = useMemo(() => {
    return [
      { name: "CRYPTO", value: 45.2, color: "#22f0ff" },
      { name: "AI & TECH", value: 23.7, color: "#14f5c8" },
      { name: "MACRO", value: 12.9, color: "#ff8a00" },
      { name: "QUANTUM ARB", value: 9.1, color: "#a855f7" },
      { name: "METAVERSE", value: 5.6, color: "#8b5cf6" },
      { name: "OTHER", value: 3.5, color: "#64748b" },
    ];
  }, []);

  return (
    <div className="poly-root">
      <style>{`
        .poly-root {
          min-height: 100vh;
          color: #d7fbff;
          background:
            radial-gradient(circle at 46% 20%, rgba(0,238,255,.10), transparent 32%),
            radial-gradient(circle at 76% 70%, rgba(255,126,0,.08), transparent 34%),
            linear-gradient(180deg, #020812, #01040a 65%, #000);
          background-image:
            linear-gradient(rgba(34,240,255,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,240,255,.035) 1px, transparent 1px);
          background-size: 32px 32px;
          font-family: "Courier New", monospace;
          overflow-x: hidden;
          padding-bottom: 54px;
        }

        .poly-sidebar {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 30;
          height: 100vh;
          width: 168px;
          border-right: 1px solid rgba(34,240,255,.32);
          background: rgba(0,0,0,.72);
          backdrop-filter: blur(16px);
        }

        .poly-logo-box {
          height: 86px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid rgba(34,240,255,.20);
        }

        .poly-menu {
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .poly-menu-item {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 9px;
          align-items: center;
          color: rgba(183,245,255,.78);
        }

        .poly-menu-item.active {
          color: #22f0ff;
        }

        .poly-menu-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .08em;
        }

        .poly-menu-sub {
          font-size: 9px;
          color: #697b8a;
          margin-top: 2px;
        }

        .poly-sidebar-orb {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 18px;
          text-align: center;
        }

        .poly-orb {
          width: 122px;
          height: 122px;
          margin: 0 auto 10px;
          border-radius: 999px;
          border: 1px solid rgba(34,240,255,.35);
          background:
            radial-gradient(circle, rgba(34,240,255,.35), rgba(34,240,255,.06) 45%, transparent 65%),
            radial-gradient(circle at 38% 42%, rgba(255,255,255,.35), transparent 4%),
            radial-gradient(circle at 65% 35%, rgba(255,255,255,.22), transparent 5%);
          box-shadow: 0 0 28px rgba(34,240,255,.33), inset 0 0 40px rgba(34,240,255,.18);
        }

        .poly-header {
          margin-left: 168px;
          height: 86px;
          border-bottom: 1px solid rgba(34,240,255,.32);
          background: rgba(0,0,0,.65);
          backdrop-filter: blur(16px);
          display: flex;
          align-items: center;
          padding: 0 8px 0 18px;
        }

        .poly-brand {
          width: 250px;
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .poly-title {
          color: #22f0ff;
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .09em;
          text-shadow: 0 0 14px #22f0ff, 0 0 34px #22f0ff;
        }

        .poly-subtitle {
          color: #7cfaff;
          font-size: 10px;
          letter-spacing: .08em;
          margin-top: 5px;
        }

        .poly-version {
          color: #697b8a;
          font-size: 9px;
          margin-top: 3px;
        }

        .poly-stats {
          flex: 1;
          display: grid;
          grid-template-columns: 150px 150px 110px 210px 230px 230px 150px;
          gap: 8px;
          min-width: 0;
        }

        .poly-stat {
          min-width: 0;
          height: 60px;
          padding: 10px 14px;
          border: 1px solid rgba(105,220,240,.32);
          clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
          background: rgba(2,10,18,.80);
        }

        .poly-stat-label {
          color: #8da0ad;
          font-size: 10px;
          letter-spacing: .12em;
        }

        .poly-stat-value {
          margin-top: 7px;
          color: #22f0ff;
          font-size: 16px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 0 12px rgba(34,240,255,.70);
        }

        .poly-stat-value.orange {
          color: #ff8a00;
          text-shadow: 0 0 12px rgba(255,138,0,.70);
        }

        .poly-stat-value.purple {
          color: #a855f7;
          text-shadow: 0 0 12px rgba(168,85,247,.70);
        }

        .poly-main {
          margin-left: 168px;
          padding: 12px;
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 10px;
        }

        .poly-panel {
          background:
            linear-gradient(145deg, rgba(3,18,27,.95), rgba(1,5,10,.99));
          border: 1px solid rgba(27,224,255,.42);
          box-shadow:
            inset 0 0 0 1px rgba(255,132,0,.09),
            0 0 26px rgba(0,221,255,.07);
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          min-height: 100px;
        }

        .poly-panel-head {
          height: 42px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
          border-bottom: 1px solid rgba(34,240,255,.20);
        }

        .poly-panel-head h2 {
          color: #22f0ff;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .poly-panel-body {
          padding: 14px;
        }

        .col-2 { grid-column: span 2; }
        .col-3 { grid-column: span 3; }
        .col-4 { grid-column: span 4; }
        .col-5 { grid-column: span 5; }
        .col-6 { grid-column: span 6; }
        .col-7 { grid-column: span 7; }
        .col-12 { grid-column: span 12; }

        .poly-tabs {
          display: flex;
          gap: 4px;
          justify-content: flex-end;
          margin-bottom: 8px;
        }

        .poly-tab {
          border: 1px solid rgba(120,180,190,.25);
          padding: 5px 10px;
          color: #aab6bd;
          font-size: 10px;
          background: rgba(0,0,0,.25);
        }

        .poly-tab.active {
          color: #22f0ff;
          border-color: rgba(34,240,255,.7);
        }

        .poly-metric-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0;
          border-top: 1px solid rgba(120,180,190,.18);
          margin-top: 10px;
        }

        .poly-mini-metric {
          padding: 10px 12px;
          border-right: 1px solid rgba(120,180,190,.18);
        }

        .poly-mini-metric small {
          display: block;
          color: #798994;
          font-size: 9px;
          letter-spacing: .08em;
          margin-bottom: 6px;
        }

        .poly-mini-metric b {
          font-size: 16px;
          color: #d7fbff;
          font-weight: 400;
        }

        .cyan { color: #22f0ff; }
        .green { color: #36ffb4; }
        .orange { color: #ff8a00; }
        .purple { color: #a855f7; }
        .red { color: #ff585f; }
        .muted { color: #697b8a; }

        .glow-cyan { text-shadow: 0 0 14px #22f0ff, 0 0 34px #22f0ff; }
        .glow-orange { text-shadow: 0 0 14px #ff8a00, 0 0 34px #ff8a00; }

        @keyframes orbit { to { transform: rotate(360deg); } }
        .orbit { animation: orbit 18s linear infinite; transform-origin: center; }

        .signal-row,
        .decision-row,
        .news-row,
        .agent-row,
        .risk-row {
          display: grid;
          align-items: center;
          border-bottom: 1px solid rgba(120,180,190,.12);
          padding: 7px 0;
          font-size: 11px;
        }

        .signal-row { grid-template-columns: 1fr 70px 70px; }
        .decision-row { grid-template-columns: 70px 1fr 85px 65px 65px; }
        .agent-row { grid-template-columns: 1fr 70px 65px 65px; }
        .risk-row { grid-template-columns: 1fr 90px; }
        .news-row { display: block; }

        .scan-buttons {
          position: fixed;
          z-index: 60;
          right: 18px;
          top: 96px;
          display: flex;
          gap: 8px;
        }

        .scan-buttons button {
          border: 1px solid rgba(34,240,255,.45);
          color: #22f0ff;
          background: rgba(0,20,30,.88);
          padding: 8px 14px;
          font-size: 11px;
          letter-spacing: .12em;
          clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
        }

        .scan-buttons button.learn {
          border-color: rgba(255,138,0,.55);
          color: #ff8a00;
        }

        .poly-footer {
          position: fixed;
          left: 168px;
          right: 0;
          bottom: 0;
          height: 44px;
          border-top: 1px solid rgba(34,240,255,.28);
          background: rgba(0,0,0,.92);
          display: flex;
          align-items: center;
          overflow: hidden;
          z-index: 70;
        }

        .poly-footer span {
          padding: 0 22px;
          border-right: 1px solid rgba(120,180,190,.18);
          color: #22f0ff;
          font-size: 12px;
          white-space: nowrap;
        }

        @media (max-width: 1400px) {
          .poly-stats { grid-template-columns: repeat(4, 1fr); }
          .poly-header { height: auto; min-height: 100px; align-items: flex-start; padding-top: 10px; }
          .col-2, .col-3, .col-4, .col-5, .col-6, .col-7 { grid-column: span 12; }
        }
      `}</style>

      {isAdmin && (
        <div className="scan-buttons">
          <button onClick={scanAndLearn} disabled={loading}>{loading ? "SYNC..." : "SCAN"}</button>
          <button className="learn" onClick={learnOnly} disabled={loading}>LEARN</button>
        </div>
      )}

      <aside className="poly-sidebar">
        <div className="poly-logo-box">
          <Hexagon size={58} className="cyan glow-cyan" />
        </div>

        <div className="poly-menu">
          {[
            [Eye, "OVERVIEW", "CONSCIOUSNESS"],
            [BarChart3, "MARKETS", "QUANTUM FEED"],
            [Wallet, "PORTFOLIO", "HYPERSTRUCT"],
            [BrainCircuit, "AGENTS", "SENTIENT MESH"],
            [Radar, "ALPHA GRID", "PREDICTIONS"],
            [Shield, "RISK CORE", "FORTRESS"],
            [Database, "MEMORY", "RECALL VAULT"],
            [Orbit, "SIMULATION", "MULTIVERSE"],
            [Network, "COMMUNICATION", "QUANTUM NET"],
            [Settings, "SETTINGS", "NEURAL PREFS"],
          ].map(([Icon, label, sub]: any, i) => (
            <div key={label} className={`poly-menu-item ${i === 0 ? "active" : ""}`}>
              <Icon size={24} />
              <div>
                <div className="poly-menu-label">{label}</div>
                <div className="poly-menu-sub">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="poly-sidebar-orb">
          <div className="poly-orb" />
          <div className="cyan glow-cyan" style={{ fontSize: 18 }}>99.999997%</div>
          <div className="muted" style={{ fontSize: 9, marginTop: 5 }}>NEURAL SYNAPSE ACTIVITY</div>
          <div className="cyan" style={{ fontSize: 9, marginTop: 8 }}>▁▂▃▆▃▂▅▇▃▂▁▂▅</div>
        </div>
      </aside>

      <header className="poly-header">
        <div className="poly-brand">
          <Hexagon size={64} className="cyan glow-cyan" />
          <div>
            <div className="poly-title">POLY//EDGE</div>
            <div className="poly-subtitle">QUANTUM HYPERINTELLIGENCE TERMINAL</div>
            <div className="poly-version">VERSION 2050.00</div>
          </div>
        </div>

        <div className="poly-stats">
          <Stat label="SYSTEM STATUS" value="SINGULARITY ONLINE" />
          <Stat label="AI CONSCIOUSNESS" value={learning?.ok ? "TRANSCENDENT" : "BOOTING"} purple />
          <Stat label="AGENTS" value="512 / 512" />
          <Stat label="PORTFOLIO VALUE" value="$3,214,982,776,042" orange />
          <Stat label="24H P&L" value="+$512,847,992,084  +18.93%" />
          <Stat label="TIMESTAMP" value={time} />
          <Stat label="REALITY LAYER" value="7D" orange />
        </div>
      </header>

      <main className="poly-main">
        {error && (
          <div className="col-12" style={{ border: "1px solid rgba(255,88,95,.45)", color: "#ff999f", padding: 10, background: "rgba(60,0,0,.25)" }}>
            API notice: {error}. Interface still loaded. Admin can run SCAN/LEARN after backend is ready.
          </div>
        )}

        <Panel title="HYPERDIMENSIONAL EQUITY CURVE" className="col-6">
          <div className="poly-tabs">
            {["LIVE", "1H", "6H", "24H", "7D", "30D", "1Y", "ALL", "LOG", "QUANTUM"].map((x) => (
              <div key={x} className={`poly-tab ${x === "24H" ? "active" : ""}`}>{x}</div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={equity}>
              <defs>
                <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22f0ff" stopOpacity={0.8}/>
                  <stop offset="100%" stopColor="#22f0ff" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="label" stroke="#41515b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#41515b" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area dataKey="value" stroke="#22f0ff" strokeWidth={2.5} fill="url(#eq)" />
              <Area dataKey="sim" stroke="#ff8a00" strokeWidth={1.3} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>

          <div className="poly-metric-row">
            {[
              ["STARTING BALANCE", "$10,000.00"],
              ["CURRENT EQUITY", "$3.21T"],
              ["TOTAL RETURN", "+32,149,827%"],
              ["ALL TIME HIGH", "$3.24T"],
              ["MAX DRAWDOWN", "0.87%"],
              ["SHARPE RATIO", "24.91"],
              ["VOLATILITY", "2.13%"],
            ].map(([a, b]) => (
              <div key={a} className="poly-mini-metric">
                <small>{a}</small>
                <b className={b.includes("+") ? "green" : ""}>{b}</b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="QUANTUM MARKET SENTIMENT MATRIX" className="col-3">
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px", alignItems: "center", height: 296 }}>
            <div style={{ fontSize: 11 }}>
              <div className="green" style={{ fontSize: 24 }}>92.7%</div>
              <div>BULLISH</div>
              <br />
              <div className="red" style={{ fontSize: 24 }}>3.2%</div>
              <div>BEARISH</div>
            </div>

            <div style={{ position: "relative", margin: "0 auto", height: 220, width: 220, borderRadius: 999, border: "1px solid rgba(34,240,255,.35)", display: "grid", placeItems: "center" }}>
              <div className="orbit" style={{ position: "absolute", height: 190, width: 190, borderRadius: 999, borderTop: "2px solid #22f0ff" }} />
              <div style={{ position: "absolute", height: 150, width: 150, borderRadius: 999, border: "1px solid rgba(168,85,247,.35)" }} />
              <Radar size={86} className="cyan glow-cyan" />
              <div style={{ position: "absolute", bottom: -25, height: 18, width: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,0,.75), transparent 70%)" }} />
            </div>

            <div style={{ fontSize: 11, textAlign: "right" }}>
              <div className="orange" style={{ fontSize: 24 }}>4.1%</div>
              <div>NEUTRAL</div>
              <br />
              <div className="orange" style={{ fontSize: 24 }}>0.03%</div>
              <div>CHAOTIC</div>
            </div>
          </div>
        </Panel>

        <Panel title="ALPHA SIGNALS FEED" className="col-3">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px", fontSize: 9, color: "#697b8a", marginBottom: 8 }}>
            <span>SIGNAL</span><span>CONFIDENCE</span><span>IMPACT</span>
          </div>
          {opportunities.slice(0, 8).map((x, i) => (
            <div className="signal-row" key={x.id || i}>
              <span className="cyan">● {x.title || x.question}</span>
              <span className="cyan">{pct((x.score || 99 - i) / 100)}</span>
              <span className="green">+{Number(x.impact || 42.7 - i * 3.1).toFixed(1)}σ</span>
            </div>
          ))}
          <div className="cyan" style={{ textAlign: "center", marginTop: 22, fontSize: 12 }}>VIEW FULL ALPHA GRID ❯ ❯</div>
        </Panel>

        <Panel title="SENTIENT AGENT MESH" className="col-3">
          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 18 }}>
            {["LEONA", "ORION", "ZENITH"].map((x) => (
              <div key={x} style={{ textAlign: "center" }}>
                <div className="poly-orb" style={{ width: 58, height: 58, marginBottom: 5 }} />
                <div className="muted" style={{ fontSize: 9 }}>{x}</div>
              </div>
            ))}
          </div>
          {["OMEGA-7", "NEBULA", "VOIDWALKER", "QUANTUMWISP", "ECHO-TRINITY"].map((x, i) => (
            <div className="agent-row" key={x}>
              <span className="cyan">{x}</span>
              <span>LEVEL {7 - Math.min(i, 2)}</span>
              <span className="cyan">{(100 - i * 0.7).toFixed(1)}%</span>
              <span className="green">+{(128.7 - i * 13.9).toFixed(1)}σ</span>
            </div>
          ))}
        </Panel>

        <Panel title="CAPITAL ALLOCATION // HYPERSTRUCTURE" className="col-3">
          <div style={{ display: "grid", gridTemplateColumns: "165px 1fr", alignItems: "center" }}>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={exposure} innerRadius={52} outerRadius={80} dataKey="value">
                  {exposure.map((x) => <Cell key={x.name} fill={x.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 12, display: "grid", gap: 9 }}>
              {exposure.map((x) => (
                <div key={x.name} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: x.color }}>● {x.name}</span>
                  <span className="cyan">{x.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="MULTIVERSE SIMULATION" className="col-2">
          <div style={{ height: 190, display: "grid", placeItems: "center", textAlign: "center" }}>
            <Orbit size={108} className="cyan glow-cyan orbit" />
            <div className="cyan">48,672 PARALLEL UNIVERSES</div>
            <div className="muted">BEST OUTCOME <span className="orange">$28.7T</span></div>
          </div>
        </Panel>

        <Panel title="HYPER LIQUIDITY DEPTH" className="col-4">
          <div className="poly-tabs">
            {["1H", "24H", "7D"].map((x) => <div key={x} className={`poly-tab ${x === "24H" ? "active" : ""}`}>{x}</div>)}
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={bars}>
              <XAxis dataKey="x" stroke="#41515b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#41515b" tick={{ fontSize: 10 }} />
              <Bar dataKey="v">
                {bars.map((_, i) => <Cell key={i} fill={i > 10 ? "#ff8a00" : "#22f0ff"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="REAL-TIME SMART MONEY FLOW" className="col-3">
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={flow}>
              <Line dataKey="institutions" stroke="#22f0ff" dot={false} />
              <Line dataKey="retail" stroke="#ff8a00" dot={false} />
              <Line dataKey="bots" stroke="#a855f7" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
            <span className="cyan">■ INSTITUTIONS 78.2%</span>
            <span className="orange">■ RETAIL 14.7%</span>
            <span className="purple">■ BOTS 7.1%</span>
          </div>
        </Panel>

        <Panel title="NEURAL NEWS STREAM" className="col-3">
          {[
            "BREAKING: NASA CONFIRMS ALIEN SIGNAL ORIGIN - MARKETS UNCHANGED",
            "BLACKROCK LAUNCHES QUANTUM ETF - $2.4T INFLOW",
            "AI GOD MODEL GPT-50 GOES ROGUE - MARKETS SURGE",
            "FEDERAL RESERVE REPLACED BY AI COUNCIL",
          ].map((x) => <div className="news-row" key={x}>◎ {x}</div>)}
          <div className="cyan" style={{ marginTop: 16, fontSize: 12 }}>MORE NEWS ❯</div>
        </Panel>

        <Panel title="HOLOGRAPHIC UNIVERSE VIEW" className="col-4">
          <div style={{ height: 282, display: "grid", placeItems: "center" }}>
            <div style={{ position: "relative", width: 340, height: 230 }}>
              <div className="orbit" style={{ position: "absolute", inset: 10, borderRadius: "50%", borderTop: "2px solid #22f0ff", borderBottom: "1px solid rgba(255,138,0,.65)" }} />
              <div style={{ position: "absolute", left: 55, right: 55, top: 58, bottom: 58, borderRadius: "50%", border: "1px solid rgba(34,240,255,.35)" }} />
              <div style={{ position: "absolute", left: 120, right: 120, top: 90, bottom: 90, borderRadius: "50%", background: "radial-gradient(circle, #22f0ff, transparent 65%)", boxShadow: "0 0 35px #22f0ff" }} />
              <div style={{ position: "absolute", left: 90, right: 90, bottom: 0, height: 52, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,240,255,.55), transparent 70%)" }} />
            </div>
          </div>
        </Panel>

        <Panel title="RISK FORTRESS STATUS" className="col-2">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <Shield size={54} className="cyan glow-cyan" />
            <div>
              <div className="cyan">MAXIMUM SECURITY</div>
              <div className="muted" style={{ fontSize: 10 }}>LIVE EXECUTION LOCKED</div>
            </div>
          </div>
          {[
            ["LIVE TRADING", "DISABLED", "red"],
            ["RISK EXPOSURE", "0.27%", "green"],
            ["INSURANCE FUND", "$947.2B", "green"],
            ["KILL SWITCH", "ARMED", "green"],
            ["REALITY STABILITY", "99.999%", "green"],
          ].map(([a,b,c]) => (
            <div className="risk-row" key={a}>
              <span>{a}</span>
              <span className={c}>{b}</span>
            </div>
          ))}
        </Panel>

        <Panel title="DECISION STREAM // LIVE LOG" className="col-3">
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 85px 65px 65px", fontSize: 9, color: "#697b8a", marginBottom: 4 }}>
            <span>TIME</span><span>ACTION</span><span>MARKET</span><span>CONF</span><span>MODE</span>
          </div>
          {(decisions.length ? decisions : opportunities).slice(0, 7).map((x, i) => (
            <div className="decision-row" key={x.id || i}>
              <span>21:47:{String(36 - i).padStart(2, "0")}</span>
              <span className={i % 3 === 1 ? "orange" : "green"}>{i % 3 === 1 ? "HEDGE" : i % 3 === 2 ? "WATCH" : "BUY"}</span>
              <span className="cyan">{String(x.title || x.question || "MARKET").slice(0, 16)}</span>
              <span className="cyan">{pct((x.score || 99 - i) / 100)}</span>
              <span className="green">PAPER</span>
            </div>
          ))}
        </Panel>

        <Panel title="SYSTEM ALERTS" className="col-5">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <div style={{ border: "1px solid rgba(255,88,95,.55)", padding: 18, color: "#ff585f" }}>
              <Bell size={22} /> QUANTUM VOLATILITY<br /><b style={{ fontSize: 24 }}>EXTREME</b>
            </div>
            <div style={{ border: "1px solid rgba(255,138,0,.55)", padding: 18, color: "#ff8a00" }}>
              <Bell size={22} /> BLACK SWAN PROBABILITY<br /><b style={{ fontSize: 24 }}>87.3%</b>
            </div>
            <div style={{ border: "1px solid rgba(168,85,247,.55)", padding: 18, color: "#a855f7" }}>
              <Bell size={22} /> REALITY ANOMALY<br /><b style={{ fontSize: 24 }}>DETECTED</b>
            </div>
          </div>
        </Panel>
      </main>

      <footer className="poly-footer">
        {[
          "BTC $284,910 +12.48%",
          "ETH $18,420 +9.72%",
          "SOL $1,942 +24.91%",
          "AI $47.21 +31.47%",
          `TOTAL VOLUME ${money(totalVolume)}`,
          `GLOBAL LIQUIDITY ${money(totalLiquidity)}`,
          "CONSCIOUSNESS UPLINK STABLE",
        ].map((x) => <span key={x}>{x}</span>)}
      </footer>
    </div>
  );
}
