import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  Briefcase,
  Database,
  Eye,
  Hexagon,
  Network,
  Orbit,
  Radar,
  Settings,
  Shield,
} from "lucide-react";
import "./AdminPhantomXIntelligence.fix.css";

type PhantomPayload = {
  ok?: boolean;
  stats?: Record<string, any>;
  markets?: any[];
  opportunities?: any[];
  decisions?: any[];
  learning?: any;
};

const navItems = [
  [Eye, "OVERVIEW", "CONSCIOUSNESS", "/admin"],
  [BarChart3, "MARKETS", "QUANTUM FEED", "/admin/trading-monitor"],
  [Briefcase, "PORTFOLIO", "HYPERSTRUCT", "/admin/phantomx-intelligence"],
  [BrainCircuit, "AGENTS", "SENTIENT MESH", "/admin/nexora"],
  [Radar, "ALPHA GRID", "PREDICTIONS", "/admin/prediction-markets"],
  [Shield, "RISK CORE", "FORTRESS", "/admin/trading-monitor"],
  [Database, "MEMORY", "RECALL VAULT", "/admin/nexora"],
  [Orbit, "SIMULATION", "MULTIVERSE", "/admin/ai-monitor"],
  [Network, "COMMUNICATION", "QUANTUM NET", "/admin/partners"],
  [Settings, "SETTINGS", "NEURAL PREFS", "/admin/dev-studio"],
] as const;

const appLinks = [
  ["/admin", "Admin Dashboard"],
  ["/admin/nexora", "Nexora OS"],
  ["/admin/ai-monitor", "AI Monitor"],
  ["/admin/trading-monitor", "Trading Monitor"],
  ["/admin/phantomx-intelligence", "Phantom X"],
  ["/admin/dev-studio", "Dev Studio"],
  ["/admin/leads", "Leads"],
  ["/admin/quotes", "Quotes"],
  ["/admin/office-move-radar", "Office Move Radar"],
  ["/admin/deal-hunter", "Deal Hunter"],
];

const alphaRows = [
  ["BTC > $500K EOY", "99.81%", "+42.7σ"],
  ["AI TAKEOVER INDEX", "99.21%", "+38.6σ"],
  ["QUANTUM FED PIVOT", "97.74%", "+29.1σ"],
  ["SOLANA HYPERFLUX", "96.32%", "+25.8σ"],
  ["SPACETIME ARBITRAGE", "99.99%", "+51.2σ"],
  ["BLACKHOLE HEDGE", "98.11%", "+33.9σ"],
  ["MEMECOIN SINGULARITY", "95.22%", "+21.4σ"],
  ["GLOBAL COLLAPSE LONG", "93.17%", "+19.7σ"],
];

const agentRows = [
  ["OMEGA-7", "LEVEL 7", "100.0%", "+128.7σ"],
  ["NEBULA", "LEVEL 6", "99.3%", "+114.4σ"],
  ["VOIDWALKER", "LEVEL 5", "98.6%", "+100.1σ"],
  ["QUANTUMWISP", "LEVEL 5", "97.9%", "+87.0σ"],
  ["ECHO-TRINITY", "LEVEL 5", "97.2%", "+73.1σ"],
];

const decisionRows = [
  ["21:47:36", "BUY", "BTC > $500K", "99.8%", "PAPER"],
  ["21:47:35", "HEDGE", "AI INDEX", "99.2%", "PAPER"],
  ["21:47:34", "WATCH", "QUANTUM FED", "97.7%", "PAPER"],
  ["21:47:33", "BUY", "SOL HYPERFLUX", "96.3%", "PAPER"],
  ["21:47:32", "HEDGE", "SPACETIME ARB", "99.9%", "PAPER"],
];

const newsRows = [
  "NASA confirms alien signal origin — markets unchanged",
  "BlackRock launches quantum ETF — $2.4T inflow",
  "AI god model GPT-50 goes rogue — markets surge",
  "Federal reserve replaced by AI council",
];

function Panel({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`pxPanel ${className}`}>
      <div className="pxPanelTitle">
        <span>{title}</span>
        <span className="pxPanelDot">○</span>
      </div>
      <div className="pxPanelBody">{children}</div>
    </section>
  );
}

function TopStat({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: string;
  tone?: "cyan" | "green" | "orange" | "purple";
}) {
  return (
    <div className={`pxTopStat tone-${tone}`}>
      <div className="pxTopLabel">{label}</div>
      <div className="pxTopValue">{value}</div>
    </div>
  );
}

function EquityChart() {
  const points = useMemo(
    () => [
      [0, 225],
      [80, 224],
      [155, 214],
      [230, 220],
      [305, 190],
      [380, 208],
      [455, 165],
      [530, 182],
      [605, 130],
      [680, 148],
      [755, 102],
      [830, 116],
      [905, 70],
    ],
    [],
  );

  const line = points.map((p) => p.join(",")).join(" ");
  const fill = `0,250 ${line} 905,250`;

  return (
    <div className="equityWrap">
      <div className="pxTabs">
        {["LIVE", "1H", "6H", "24H", "7D", "30D", "1Y", "ALL", "LOG", "QUANTUM"].map((x) => (
          <span key={x} className={x === "24H" ? "active" : ""}>
            {x}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 940 270" className="equitySvg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eqFillClean" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22f0ff" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#22f0ff" stopOpacity="0.02" />
          </linearGradient>
          <filter id="cyanGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={30 + i * 105} x2={30 + i * 105} y1="12" y2="250" className="gridLine" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="30" x2="930" y1={25 + i * 55} y2={25 + i * 55} className="gridLine" />
        ))}

        <text x="2" y="35" className="axisText">$4T</text>
        <text x="2" y="90" className="axisText">$3T</text>
        <text x="2" y="145" className="axisText">$2T</text>
        <text x="2" y="200" className="axisText">$1T</text>
        <text x="8" y="252" className="axisText">$0</text>

        <polygon points={fill} fill="url(#eqFillClean)" />
        <polyline points={line} fill="none" stroke="#22f0ff" strokeWidth="4" filter="url(#cyanGlow)" />
        <polyline
          points={points.map(([x, y]) => `${x},${y + 35}`).join(" ")}
          fill="none"
          stroke="#ff8a00"
          strokeWidth="2"
          opacity="0.8"
        />

        {["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "24:00"].map((t, i) => (
          <text key={t} x={30 + i * 105} y="266" className="axisText">
            {t}
          </text>
        ))}
      </svg>

      <div className="metricStrip">
        {[
          ["STARTING BALANCE", "$10,000.00"],
          ["CURRENT EQUITY", "$3.21T"],
          ["TOTAL RETURN", "+32,149,827%"],
          ["ALL TIME HIGH", "$3.24T"],
          ["MAX DRAWDOWN", "0.87%"],
          ["SHARPE RATIO", "24.91"],
          ["VOLATILITY", "2.13%"],
        ].map(([a, b]) => (
          <div className="metric" key={a}>
            <small>{a}</small>
            <b>{b}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentMatrix() {
  return (
    <div className="sentimentWrap">
      <div className="sentimentStat sBull">
        <b>92.7%</b>
        <span>BULLISH</span>
      </div>
      <div className="sentimentStat sNeutral">
        <b>4.1%</b>
        <span>NEUTRAL</span>
      </div>
      <div className="sentimentStat sBear">
        <b>3.2%</b>
        <span>BEARISH</span>
      </div>
      <div className="sentimentStat sChaos">
        <b>0.03%</b>
        <span>CHAOTIC</span>
      </div>
      <div className="radarCore">
        <div className="radarRings" />
        <svg viewBox="0 0 240 240" className="radarSvg">
          <line x1="120" y1="8" x2="120" y2="232" />
          <line x1="8" y1="120" x2="232" y2="120" />
          <polygon points="120,36 186,120 120,205 54,120" className="radarPoly1" />
          <polygon points="120,70 155,120 120,170 85,120" className="radarPoly2" />
          <circle cx="120" cy="120" r="8" className="radarDot" />
        </svg>
        <div className="blackSwanRing" />
      </div>
    </div>
  );
}

function AgentMesh() {
  return (
    <div className="agentWrap">
      <div className="agentNodes">
        {["LEONA", "ORION", "ZENITH"].map((n) => (
          <div key={n} className="agentNode">
            <span />
            <small>{n}</small>
          </div>
        ))}
      </div>
      <div className="agentTable">
        {agentRows.map((r) => (
          <div className="agentRow" key={r[0]}>
            <span>{r[0]}</span>
            <span>{r[1]}</span>
            <span>{r[2]}</span>
            <span>{r[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Allocation() {
  const items = [
    ["CRYPTO", "45.2%", "#22f0ff"],
    ["AI & TECH", "23.7%", "#2df5be"],
    ["MACRO", "12.9%", "#ff8a00"],
    ["QUANTUM ARB", "9.1%", "#a855f7"],
    ["METAVERSE", "5.6%", "#8b5cf6"],
    ["OTHER", "3.5%", "#64748b"],
  ];

  return (
    <div className="allocationWrap">
      <div className="donutClean">
        <div className="donutCenter">
          <b>100%</b>
          <span>TOTAL ALLOCATION</span>
        </div>
      </div>
      <div className="allocationLegendClean">
        {items.map(([name, value, color]) => (
          <div key={name}>
            <span style={{ color }}>● {name}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars() {
  const vals = [34, 48, 62, 44, 56, 82, 43, 58, 49, 71, 40, 76, 52, 47, 60, 86];
  return (
    <div className="barsWrap">
      <div className="barsTabs">
        <span>1H</span>
        <span className="active">24H</span>
        <span>7D</span>
      </div>
      <div className="bars">
        {vals.map((v, i) => (
          <div key={i} className={i > 10 ? "bar orange" : "bar"} style={{ height: `${v}%` }} />
        ))}
      </div>
    </div>
  );
}

function Flow() {
  return (
    <div className="flowWrap">
      <svg viewBox="0 0 360 150" preserveAspectRatio="none">
        <path d="M10 88 C 55 30, 100 120, 150 70 S 245 20, 350 42" className="flowCyan" />
        <path d="M10 112 C 80 135, 110 105, 160 124 S 250 98, 350 128" className="flowOrange" />
        <path d="M10 128 C 78 116, 110 135, 160 122 S 245 140, 350 130" className="flowPurple" />
      </svg>
      <div className="flowLegend">
        <span className="cyanBox">INSTITUTIONS 78.2%</span>
        <span className="orangeBox">RETAIL 14.7%</span>
        <span className="purpleBox">BOTS 7.1%</span>
      </div>
    </div>
  );
}

function Universe() {
  return (
    <div className="universeWrap">
      <svg viewBox="0 0 700 330" preserveAspectRatio="none">
        <ellipse cx="350" cy="150" rx="250" ry="70" className="orbitBlue" />
        <ellipse cx="350" cy="150" rx="185" ry="48" className="orbitOrange" />
        <ellipse cx="350" cy="150" rx="105" ry="28" className="orbitBlue" />
        <ellipse cx="350" cy="150" rx="56" ry="13" className="universeCore" />
        <line x1="350" y1="150" x2="350" y2="320" className="universeBeam" />
        <ellipse cx="350" cy="295" rx="95" ry="24" className="universeCore lower" />
        <circle cx="535" cy="96" r="7" className="orangeDot" />
        <text x="510" y="70" className="universeText">PORTFOLIO UNIVERSE</text>
      </svg>
    </div>
  );
}

function RiskStatus() {
  return (
    <div className="riskWrap">
      <div className="riskHead">
        <Shield size={44} />
        <div>
          <b>MAXIMUM SECURITY</b>
          <span>LIVE EXECUTION LOCKED</span>
        </div>
      </div>
      {[
        ["LIVE TRADING", "DISABLED"],
        ["RISK EXPOSURE", "0.27%"],
        ["INSURANCE FUND", "$947.2B"],
        ["KILL SWITCH", "ARMED"],
        ["REALITY STABILITY", "99.999%"],
      ].map(([a, b]) => (
        <div className="riskRow" key={a}>
          <span>{a}</span>
          <b className={b === "DISABLED" ? "red" : ""}>{b}</b>
        </div>
      ))}
    </div>
  );
}

function DecisionLog() {
  return (
    <div className="decisionWrap">
      <div className="decisionHeader">
        <span>TIME</span>
        <span>ACTION</span>
        <span>MARKET</span>
        <span>CONF</span>
        <span>MODE</span>
      </div>
      {decisionRows.map((r) => (
        <div className="decisionRow" key={r.join("-")}>
          {r.map((c, i) => (
            <span key={i} className={i === 1 ? "green" : ""}>
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Alerts() {
  return (
    <div className="alertsWrap">
      {[
        ["QUANTUM VOLATILITY", "EXTREME", "red"],
        ["BLACK SWAN PROBABILITY", "87.3%", "orange"],
        ["REALITY ANOMALY", "DETECTED", "purple"],
      ].map(([a, b, tone]) => (
        <div key={a} className={`alertBoxClean ${tone}`}>
          <Bell size={18} />
          <span>{a}</span>
          <b>{b}</b>
        </div>
      ))}
    </div>
  );
}

export default function AdminPhantomXIntelligence() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [payload, setPayload] = useState<PhantomPayload>({});
  const [time, setTime] = useState("2050-05-22 21:47:36.782");

  useEffect(() => {
    const t = setInterval(() => {
      setTime(`2050-05-22 ${new Date().toLocaleTimeString("en-AU", { hour12: false })}.782`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  async function loadIntel(action: "scan" | "learn" | "status" = "status") {
    try {
      const endpoint =
        action === "learn"
          ? "/api/admin/phantomx/learn"
          : action === "scan"
            ? "/api/admin/phantomx/scan"
            : "/api/admin/phantomx/intelligence";

      const res = await fetch(endpoint, {
        method: action === "status" ? "GET" : "POST",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      setPayload(json);
    } catch {
      setPayload((p) => ({ ...p, ok: false }));
    }
  }

  useEffect(() => {
    loadIntel("status");
  }, []);

  return (
    <div className="pxShellClean">
      <aside className="pxRailClean">
        <div className="pxLogoMark">
          <Hexagon size={50} />
        </div>

        <button className="tcdAppsButtonClean" onClick={() => setDrawerOpen(true)}>
          TCD APPS
        </button>

        <nav className="pxNavClean">
          {navItems.map(([Icon, a, b, href]) => (
            <a key={a} href={href} className="pxNavItemClean">
              <Icon size={18} />
              <span>
                <b>{a}</b>
                <small>{b}</small>
              </span>
            </a>
          ))}
        </nav>

        <div className="neuralClean">
          <div className="neuralOrbClean">
            <Activity size={34} />
          </div>
          <b>99.999997%</b>
          <span>NEURAL SYNAPSE ACTIVITY</span>
          <div className="miniBarsClean">
            {Array.from({ length: 14 }).map((_, i) => (
              <i key={i} style={{ height: `${6 + ((i * 7) % 22)}px` }} />
            ))}
          </div>
        </div>
      </aside>

      <header className="pxTopClean">
        <div className="brandClean">
          <Hexagon size={40} />
          <div>
            <h1>POLY//EDGE</h1>
            <p>QUANTUM HYPERINTELLIGENCE TERMINAL</p>
            <small>VERSION 2050.00</small>
          </div>
        </div>

        <TopStat label="SYSTEM STATUS" value="SINGULARITY ONLINE" tone="green" />
        <TopStat label="AI CONSCIOUSNESS" value="TRANSCENDENT" tone="purple" />
        <TopStat label="AGENTS" value="512 / 512" />
        <TopStat label="PORTFOLIO VALUE" value="$3,214,982,776,042" tone="orange" />
        <TopStat label="24H P&L" value="+$512,847,992,084" tone="green" />
        <TopStat label="TIMESTAMP" value={time} />
        <TopStat label="REALITY LAYER" value="7D" tone="orange" />

        <div className="pxActionsClean">
          <button onClick={() => loadIntel("scan")}>SCAN</button>
          <button onClick={() => loadIntel("learn")}>LEARN</button>
        </div>
      </header>

      <main className="pxGridClean">
        <Panel title="HYPERDIMENSIONAL EQUITY CURVE" className="equityPanelClean">
          <EquityChart />
        </Panel>

        <Panel title="QUANTUM MARKET SENTIMENT MATRIX" className="sentimentPanelClean">
          <SentimentMatrix />
        </Panel>

        <Panel title="ALPHA SIGNALS FEED" className="alphaPanelClean">
          <div className="alphaHeader">
            <span>SIGNAL</span>
            <span>CONFIDENCE</span>
            <span>IMPACT</span>
          </div>
          {alphaRows.map((r) => (
            <div className="alphaRow" key={r[0]}>
              <span>● {r[0]}</span>
              <b>{r[1]}</b>
              <em>{r[2]}</em>
            </div>
          ))}
          <a className="alphaLink" href="/admin/prediction-markets">
            VIEW FULL ALPHA GRID ❯❯
          </a>
        </Panel>

        <Panel title="SENTIENT AGENT MESH" className="agentPanelClean">
          <AgentMesh />
        </Panel>

        <Panel title="CAPITAL ALLOCATION // HYPERSTRUCTURE" className="allocationPanelClean">
          <Allocation />
        </Panel>

        <Panel title="MULTIVERSE SIMULATION" className="multiPanelClean">
          <div className="multiClean">
            <Orbit size={92} />
            <b>48,672 PARALLEL UNIVERSES</b>
            <span>BEST OUTCOME $28.7T</span>
          </div>
        </Panel>

        <Panel title="HYPER LIQUIDITY DEPTH" className="liquidityPanelClean">
          <Bars />
        </Panel>

        <Panel title="REAL-TIME SMART MONEY FLOW" className="flowPanelClean">
          <Flow />
        </Panel>

        <Panel title="NEURAL NEWS STREAM" className="newsPanelClean">
          <div className="newsListClean">
            {newsRows.map((n) => (
              <div key={n}>◎ {n}</div>
            ))}
          </div>
          <a href="/admin/ai-monitor">MORE NEWS ❯</a>
        </Panel>

        <Panel title="HOLOGRAPHIC UNIVERSE VIEW" className="universePanelClean">
          <Universe />
        </Panel>

        <Panel title="RISK FORTRESS STATUS" className="riskPanelClean">
          <RiskStatus />
        </Panel>

        <Panel title="DECISION STREAM // LIVE LOG" className="decisionPanelClean">
          <DecisionLog />
        </Panel>

        <Panel title="SYSTEM ALERTS" className="alertsPanelClean">
          <Alerts />
        </Panel>
      </main>

      <footer className="tickerClean">
        {["BTC $284,910 +12.48%", "ETH $18,420 +9.72%", "SOL $1,942 +24.91%", "AI $47.21 +31.47%", "TOTAL MKT CAP $132.7T +8.21%", "24H VOLUME $47.2T +26.9%", "GLOBAL LIQUIDITY $10.3T", "CONSCIOUSNESS UPLINK STABLE"].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </footer>

      {drawerOpen && (
        <div className="drawerShadeClean" onClick={() => setDrawerOpen(false)}>
          <aside className="drawerClean" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2>TCD APPS</h2>
              <button onClick={() => setDrawerOpen(false)}>×</button>
            </div>
            <p>Jump to the rest of your admin programs.</p>
            <div className="drawerLinksClean">
              {appLinks.map(([href, label]) => (
                <a href={href} key={href}>
                  {label}
                </a>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
