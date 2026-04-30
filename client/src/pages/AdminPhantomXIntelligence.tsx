import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

type AnyRow = Record<string, any>;

function PhantomXTerminalCanvas() {
  const [scale, setScale] = useState(1);
  const [intel, setIntel] = useState<any>({});
  const [learning, setLearning] = useState<any>({});
  const [time, setTime] = useState("2050-05-22 21:47:36.782");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setScale(Math.min(w / 1920, h / 1080));
    };

    resize();
    window.addEventListener("resize", resize);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("resize", resize);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const clock = setInterval(() => {
      setTime("2050-05-22 " + new Date().toLocaleTimeString("en-AU", { hour12: false }) + ".782");
    }, 1000);

    fetch("/api/admin/phantomx/intelligence", { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setIntel(j))
      .catch(() => {});

    fetch("/api/admin/phantomx/learning", { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setLearning(j))
      .catch(() => {});

    return () => clearInterval(clock);
  }, []);

  const signals = useMemo(() => {
    const fromApi = Array.isArray(intel?.opportunities) ? intel.opportunities : [];
    const fallback = [
      ["BTC > $500K EOY", "99.81%", "+42.7σ"],
      ["AI TAKEOVER INDEX", "99.21%", "+38.6σ"],
      ["QUANTUM FED PIVOT", "97.74%", "+29.1σ"],
      ["SOLANA HYPERFLUX", "96.32%", "+25.8σ"],
      ["SPACETIME ARBITRAGE", "99.99%", "+51.2σ"],
      ["BLACKHOLE HEDGE", "98.11%", "+33.9σ"],
      ["MEMECOIN SINGULARITY", "95.22%", "+21.4σ"],
      ["GLOBAL COLLAPSE LONG", "93.17%", "+19.7σ"],
    ];

    if (!fromApi.length) return fallback;

    return fromApi.slice(0, 8).map((x: AnyRow, i: number) => [
      String(x.title || x.question || fallback[i]?.[0] || "SIGNAL"),
      `${Number(x.score || 99 - i).toFixed(2)}%`,
      `+${Number(x.impact || 42.7 - i * 3.2).toFixed(1)}σ`,
    ]);
  }, [intel]);

  const strategies = Array.isArray(learning?.strategies) ? learning.strategies : [];

  return (
    <div className="pxShell">
      <style>{`
        .pxShell {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: #000;
          overflow: hidden;
          font-family: "Courier New", monospace;
          color: #d8fbff;
        }

        .pxStage {
          position: absolute;
          left: 0;
          top: 0;
          width: 1920px;
          height: 1080px;
          transform-origin: top left;
          background:
            radial-gradient(circle at 42% 18%, rgba(34,240,255,.12), transparent 30%),
            radial-gradient(circle at 80% 74%, rgba(255,126,0,.09), transparent 34%),
            linear-gradient(180deg, #020812, #01040a 66%, #000);
          overflow: hidden;
        }

        .pxStage:before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(34,240,255,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,240,255,.035) 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: .9;
          pointer-events: none;
        }

        .pxStage:after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(255,255,255,.025) 50%, rgba(0,0,0,.02) 50%);
          background-size: 100% 4px;
          mix-blend-mode: overlay;
          pointer-events: none;
        }

        .cyan { color: #22f0ff; }
        .green { color: #3dff9f; }
        .orange { color: #ff8a00; }
        .purple { color: #b263ff; }
        .red { color: #ff515c; }
        .muted { color: #78909a; }
        .glowC { text-shadow: 0 0 10px #22f0ff, 0 0 30px rgba(34,240,255,.8); }
        .glowO { text-shadow: 0 0 10px #ff8a00, 0 0 28px rgba(255,138,0,.8); }

        .sidebar {
          position: absolute;
          left: 0;
          top: 0;
          width: 190px;
          height: 1080px;
          background: rgba(0,0,0,.72);
          border-right: 1px solid rgba(34,240,255,.42);
          box-shadow: inset -20px 0 50px rgba(34,240,255,.035);
          z-index: 5;
        }

        .logoBox {
          position: absolute;
          top: 14px;
          left: 22px;
          width: 146px;
          height: 90px;
          border: 1px solid rgba(34,240,255,.55);
          clip-path: polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);
          display: grid;
          place-items: center;
        }

        .sideMenu {
          position: absolute;
          top: 125px;
          left: 14px;
          right: 14px;
          display: grid;
          gap: 19px;
        }

        .menuItem {
          display: grid;
          grid-template-columns: 32px 1fr;
          align-items: center;
          gap: 12px;
          color: rgba(210,248,255,.82);
        }

        .menuIcon {
          color: #9aefff;
          filter: drop-shadow(0 0 8px rgba(34,240,255,.65));
        }

        .menuMain {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .menuSub {
          margin-top: 4px;
          font-size: 9px;
          color: #697b8a;
          letter-spacing: .12em;
        }

        .neuralOrb {
          position: absolute;
          left: 18px;
          bottom: 78px;
          width: 154px;
          text-align: center;
        }

        .orbBig {
          width: 144px;
          height: 144px;
          margin: 0 auto 13px;
          border-radius: 999px;
          border: 1px solid rgba(34,240,255,.48);
          background:
            radial-gradient(circle at 52% 48%, rgba(34,240,255,.7), rgba(34,240,255,.19) 18%, rgba(34,240,255,.06) 43%, transparent 68%),
            radial-gradient(circle at 30% 35%, rgba(255,255,255,.45), transparent 3%),
            radial-gradient(circle at 72% 43%, rgba(255,255,255,.35), transparent 3%),
            radial-gradient(circle at 54% 64%, rgba(255,255,255,.30), transparent 3%);
          box-shadow:
            0 0 35px rgba(34,240,255,.45),
            inset 0 0 50px rgba(34,240,255,.20);
        }

        .ticker {
          position: absolute;
          left: 0;
          bottom: 0;
          height: 45px;
          width: 1920px;
          display: flex;
          align-items: center;
          background: rgba(0,0,0,.92);
          border-top: 1px solid rgba(34,240,255,.5);
          z-index: 10;
        }

        .ticker span {
          height: 45px;
          padding: 14px 27px 0;
          border-right: 1px solid rgba(100,130,140,.35);
          font-size: 15px;
          white-space: nowrap;
        }

        .top {
          position: absolute;
          left: 200px;
          right: 8px;
          top: 8px;
          height: 82px;
          display: grid;
          grid-template-columns: 270px 175px 175px 130px 220px 265px 245px 160px;
          gap: 8px;
          z-index: 4;
        }

        .brand {
          display: grid;
          grid-template-columns: 78px 1fr;
          align-items: center;
          gap: 13px;
          padding: 0 10px;
          border: 1px solid rgba(34,240,255,.48);
          clip-path: polygon(15px 0,100% 0,100% calc(100% - 15px),calc(100% - 15px) 100%,0 100%,0 15px);
          background: rgba(1,8,14,.78);
        }

        .brandTitle {
          font-size: 37px;
          line-height: 34px;
          font-weight: 900;
          letter-spacing: .13em;
          color: #22f0ff;
          text-shadow: 0 0 12px #22f0ff, 0 0 34px rgba(34,240,255,.85);
        }

        .brandSub {
          font-size: 11px;
          margin-top: 5px;
          letter-spacing: .08em;
          color: #8cf8ff;
        }

        .brandVer {
          font-size: 9px;
          margin-top: 3px;
          color: #8a9da8;
        }

        .topStat {
          border: 1px solid rgba(128,210,230,.48);
          background: rgba(1,8,14,.84);
          clip-path: polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);
          padding: 13px 15px;
        }

        .topLabel {
          color: #8ca0aa;
          font-size: 11px;
          letter-spacing: .13em;
        }

        .topValue {
          margin-top: 12px;
          font-size: 18px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .grid {
          position: absolute;
          left: 200px;
          top: 100px;
          width: 1710px;
          height: 928px;
          display: grid;
          grid-template-columns: 360px 360px 310px 325px 325px;
          grid-template-rows: 405px 270px 205px;
          gap: 10px;
          z-index: 3;
        }

        .panel {
          position: relative;
          border: 1px solid rgba(34,240,255,.48);
          background:
            radial-gradient(circle at 50% 0, rgba(34,240,255,.055), transparent 45%),
            linear-gradient(145deg, rgba(3,18,27,.94), rgba(1,5,10,.99));
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          box-shadow:
            inset 0 0 0 1px rgba(255,132,0,.08),
            inset 0 0 26px rgba(34,240,255,.035),
            0 0 30px rgba(0,221,255,.07);
          overflow: hidden;
        }

        .panelTitle {
          height: 42px;
          padding: 13px 20px 0;
          color: #79f7ff;
          font-size: 18px;
          line-height: 16px;
          font-weight: 900;
          letter-spacing: .12em;
          border-bottom: 1px solid rgba(34,240,255,.20);
          text-shadow: 0 0 10px rgba(34,240,255,.75);
        }

        .dot {
          position: absolute;
          right: 18px;
          top: 15px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          border: 1px solid rgba(200,245,255,.75);
        }

        .equity { grid-column: 1 / span 3; }
        .sentiment { grid-column: 4 / span 1; }
        .alpha { grid-column: 5 / span 1; }
        .agents { grid-column: 1 / span 1; }
        .allocation { grid-column: 2 / span 1; }
        .multi { grid-column: 3 / span 1; }
        .depth { grid-column: 4 / span 2; }
        .flow { grid-column: 1 / span 1; }
        .news { grid-column: 1 / span 1; align-self: end; height: 195px; }
        .universe { grid-column: 2 / span 2; grid-row: 3 / span 1; }
        .risk { grid-column: 4 / span 1; grid-row: 3 / span 1; }
        .decision { grid-column: 5 / span 1; grid-row: 3 / span 1; }
        .alerts {
          position: absolute;
          left: 1180px;
          top: 810px;
          width: 725px;
          height: 155px;
          z-index: 4;
        }

        .svgGrid line {
          stroke: rgba(70,100,115,.26);
          stroke-width: 1;
        }

        .tinyTabs {
          position: absolute;
          right: 18px;
          top: 15px;
          display: flex;
          gap: 5px;
        }

        .tinyTabs span {
          border: 1px solid rgba(150,180,190,.32);
          padding: 6px 10px;
          font-size: 11px;
          color: #b4c5cc;
        }

        .tinyTabs .active {
          color: #22f0ff;
          border-color: #22f0ff;
          box-shadow: 0 0 10px rgba(34,240,255,.35);
        }

        .metricStrip {
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: 18px;
          height: 52px;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-top: 1px solid rgba(120,150,160,.25);
        }

        .metric {
          padding: 8px 12px;
          border-right: 1px solid rgba(120,150,160,.25);
        }

        .metric small {
          display: block;
          font-size: 9px;
          color: #738692;
          letter-spacing: .1em;
        }

        .metric b {
          display: block;
          margin-top: 8px;
          font-size: 18px;
          font-weight: 400;
        }

        .signalRow {
          display: grid;
          grid-template-columns: 1fr 76px 70px;
          gap: 5px;
          padding: 9px 18px;
          border-bottom: 1px solid rgba(130,160,170,.18);
          font-size: 12px;
          align-items: center;
        }

        .signalHeader {
          color: #758b95;
          font-size: 10px;
          letter-spacing: .12em;
          padding-top: 10px;
        }

        .agentGraph {
          position: absolute;
          top: 55px;
          left: 28px;
          right: 28px;
          height: 75px;
        }

        .agentOrb {
          width: 54px;
          height: 54px;
          border-radius: 999px;
          border: 1px solid rgba(34,240,255,.38);
          background: radial-gradient(circle, rgba(34,240,255,.55), rgba(34,240,255,.08) 55%, transparent 70%);
          box-shadow: 0 0 22px rgba(34,240,255,.35);
        }

        .agentRow {
          display: grid;
          grid-template-columns: 1fr 70px 65px 70px;
          padding: 6px 18px;
          font-size: 12px;
          border-bottom: 1px solid rgba(130,160,170,.16);
        }

        .donut {
          position: absolute;
          left: 30px;
          top: 64px;
          width: 178px;
          height: 178px;
          border-radius: 50%;
          background: conic-gradient(#22f0ff 0 45%, #14f5c8 45% 69%, #ff8a00 69% 82%, #a855f7 82% 91%, #8b5cf6 91% 97%, #64748b 97%);
          box-shadow: 0 0 35px rgba(34,240,255,.25);
        }

        .donut:after {
          content: "TOTAL\\A100%\\AALLOCATION";
          white-space: pre;
          position: absolute;
          inset: 45px;
          border-radius: 50%;
          background: #020812;
          display: grid;
          place-items: center;
          text-align: center;
          color: #d8fbff;
          font-size: 20px;
          line-height: 31px;
        }

        .barWrap {
          position: absolute;
          left: 65px;
          right: 22px;
          bottom: 52px;
          height: 160px;
          display: flex;
          gap: 12px;
          align-items: end;
        }

        .bar {
          width: 22px;
          background: linear-gradient(180deg, rgba(34,240,255,1), rgba(34,240,255,.35));
          box-shadow: 0 0 16px rgba(34,240,255,.55);
        }

        .bar.orangeBar {
          background: linear-gradient(180deg, rgba(255,138,0,1), rgba(255,138,0,.35));
          box-shadow: 0 0 16px rgba(255,138,0,.55);
        }

        .decisionRow {
          display: grid;
          grid-template-columns: 70px 70px 1fr 50px 50px;
          padding: 7px 16px;
          border-bottom: 1px solid rgba(130,160,170,.16);
          font-size: 11px;
          align-items: center;
        }

        .newsRow {
          padding: 8px 18px;
          border-bottom: 1px solid rgba(130,160,170,.16);
          font-size: 11px;
          color: #a5bdc6;
        }

        .riskRow {
          display: grid;
          grid-template-columns: 1fr 90px;
          padding: 8px 26px;
          font-size: 12px;
          border-bottom: 1px solid rgba(130,160,170,.16);
        }

        .alertGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 34px 16px;
        }

        .alertBox {
          height: 92px;
          padding: 18px;
          border: 1px solid rgba(255,80,90,.65);
          color: #ff515c;
          font-size: 14px;
          letter-spacing: .08em;
        }

        .alertBox.orangeBox {
          border-color: rgba(255,138,0,.75);
          color: #ff8a00;
        }

        .alertBox.purpleBox {
          border-color: rgba(180,90,255,.75);
          color: #b263ff;
        }

        .alertBox b {
          display: block;
          margin-top: 7px;
          font-size: 25px;
        }

        @media (max-aspect-ratio: 16/9) {
          .pxStage {
            left: 50%;
          }
        }
      `}</style>

      <div
        className="pxStage"
        style={{
          transform: `scale(${scale})`,
          left: `${(window.innerWidth - 1920 * scale) / 2}px`,
          top: `${(window.innerHeight - 1080 * scale) / 2}px`,
        }}
      >
        
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            position: "absolute",
            left: 18,
            top: 106,
            zIndex: 60,
            width: 154,
            height: 38,
            border: "1px solid rgba(34,240,255,.75)",
            background: "rgba(0,0,0,.88)",
            color: "#22f0ff",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: ".16em",
            cursor: "pointer",
            boxShadow: "0 0 18px rgba(34,240,255,.25)",
            fontFamily: "\"Courier New\", monospace",
          }}
        >
          TCD APPS
        </button>

        <div
          style={{
            position: "absolute",
            top: 0,
            left: drawerOpen ? 0 : -370,
            width: 370,
            height: 1080,
            zIndex: 80,
            background: "rgba(0,0,0,.97)",
            borderRight: "1px solid rgba(34,240,255,.72)",
            boxShadow: "30px 0 80px rgba(0,0,0,.82), 0 0 50px rgba(34,240,255,.18)",
            transition: "left .22s ease",
            padding: "28px 22px",
            boxSizing: "border-box",
            fontFamily: "\"Courier New\", monospace",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(34,240,255,.28)",
              paddingBottom: 18,
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  color: "#22f0ff",
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: ".16em",
                  textShadow: "0 0 14px rgba(34,240,255,.8)",
                }}
              >
                TCD APPS
              </div>
              <div style={{ color: "#78909a", fontSize: 10, marginTop: 5 }}>
                RETURN TO PLATFORM MODULES
              </div>
            </div>

            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                border: "1px solid rgba(255,138,0,.7)",
                background: "rgba(255,138,0,.08)",
                color: "#ff8a00",
                height: 34,
                width: 42,
                cursor: "pointer",
                fontSize: 20,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {[
              ["/admin/dashboard", "DASHBOARD", "main admin overview"],
              ["/admin/nexora", "NEXORA OS", "core AI command centre"],
              ["/admin/ai-monitor", "AI MONITOR", "automation and outreach monitor"],
              ["/admin/trading-monitor", "TRADING MONITOR", "old trading monitor / baseline memory"],
              ["/admin/phantomx-intelligence", "PHANTOM X", "POLY//EDGE terminal"],
              ["/admin/dev-studio", "DEV STUDIO", "builder, files, terminal and auto-fix"],
              ["/admin/leads", "LEADS", "sales pipeline and inbound leads"],
              ["/admin/deal-pipeline", "DEAL PIPELINE", "opportunities and closing"],
              ["/admin/office-move-radar", "MOVE RADAR", "office move intelligence"],
              ["/admin/quotes", "QUOTES", "quote and proposal control"],
              ["/admin/customers", "CUSTOMERS", "client accounts and subscriptions"],
              ["/", "PUBLIC SITE", "return to website"],
            ].map(([href, title, sub]) => (
              <a
                key={href}
                href={href}
                style={{
                  display: "block",
                  textDecoration: "none",
                  border: "1px solid rgba(34,240,255,.28)",
                  background: "linear-gradient(90deg, rgba(34,240,255,.08), rgba(0,0,0,.2))",
                  padding: "13px 14px",
                  color: "#d8fbff",
                  clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                }}
              >
                <b style={{ display: "block", color: "#22f0ff", fontSize: 14, letterSpacing: ".1em" }}>
                  {title}
                </b>
                <small style={{ display: "block", marginTop: 5, color: "#78909a", fontSize: 10, letterSpacing: ".08em" }}>
                  {sub}
                </small>
              </a>
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              left: 22,
              right: 22,
              bottom: 28,
              color: "#78909a",
              fontSize: 11,
              lineHeight: 1.6,
              borderTop: "1px solid rgba(34,240,255,.18)",
              paddingTop: 14,
            }}
          >
            Phantom X runs full-screen. Use this drawer to jump back to the rest of the admin apps.
          </div>
        </div>

        <aside className="sidebar">
          <div className="logoBox">
            <Hexagon size={58} className="cyan glowC" />
          </div>

          <div className="sideMenu">
            {[
              [Eye, "OVERVIEW", "CONSCIOUSNESS"],
              [BarChart3, "MARKETS", "QUANTUM FEED"],
              [Briefcase, "PORTFOLIO", "HYPERSTRUCT"],
              [BrainCircuit, "AGENTS", "SENTIENT MESH"],
              [Radar, "ALPHA GRID", "PREDICTIONS"],
              [Shield, "RISK CORE", "FORTRESS"],
              [Database, "MEMORY", "RECALL VAULT"],
              [Orbit, "SIMULATION", "MULTIVERSE"],
              [Network, "COMMUNICATION", "QUANTUM NET"],
              [Settings, "SETTINGS", "NEURAL PREFS"],
            ].map(([Icon, label, sub]: any) => (
              <div className="menuItem" key={label}>
                <Icon className="menuIcon" size={27} />
                <div>
                  <div className="menuMain">{label}</div>
                  <div className="menuSub">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="neuralOrb">
            <div className="orbBig" />
            <div className="cyan glowC" style={{ fontSize: 21 }}>99.999997%</div>
            <div className="muted" style={{ fontSize: 10, marginTop: 10 }}>NEURAL SYNAPSE ACTIVITY</div>
            <div className="cyan" style={{ fontSize: 15, marginTop: 10 }}>▁▂▄▆▃▂▇▅▁▃▆▂</div>
          </div>
        </aside>

        <header className="top">
          <div className="brand">
            <Hexagon size={62} className="cyan glowC" />
            <div>
              <div className="brandTitle">POLY//EDGE</div>
              <div className="brandSub">QUANTUM HYPERINTELLIGENCE TERMINAL</div>
              <div className="brandVer">VERSION 2050.00</div>
            </div>
          </div>

          <TopStat label="SYSTEM STATUS" value="SINGULARITY ONLINE" />
          <TopStat label="AI CONSCIOUSNESS" value="TRANSCENDENT" purple />
          <TopStat label="AGENTS" value="512 / 512" />
          <TopStat label="PORTFOLIO VALUE" value="$3,214,982,776,042" orange />
          <TopStat label="24H P&L" value="+$512,847,992,084  +18.93%" />
          <TopStat label="TIMESTAMP" value={time} />
          <TopStat label="REALITY LAYER" value="7D" orange />
        </header>

        <main className="grid">
          <section className="panel equity">
            <div className="panelTitle">HYPERDIMENSIONAL EQUITY CURVE</div>
            <div className="tinyTabs">
              {["LIVE","1H","6H","24H","7D","30D","1Y","ALL","LOG","QUANTUM"].map(x => <span key={x} className={x==="24H" ? "active" : ""}>{x}</span>)}
            </div>
            <EquityChart />
            <div className="metricStrip">
              <Metric a="STARTING BALANCE" b="$10,000.00" />
              <Metric a="CURRENT EQUITY" b="$3.21T" />
              <Metric a="TOTAL RETURN" b="+32,149,827%" green />
              <Metric a="ALL TIME HIGH" b="$3.24T" />
              <Metric a="MAX DRAWDOWN" b="0.87%" />
              <Metric a="SHARPE RATIO" b="24.91" />
              <Metric a="VOLATILITY" b="2.13%" />
            </div>
          </section>

          <section className="panel sentiment">
            <div className="panelTitle">QUANTUM MARKET SENTIMENT MATRIX</div>
            <SentimentOrb />
          </section>

          <section className="panel alpha">
            <div className="panelTitle">ALPHA SIGNALS FEED</div>
            <div className="signalRow signalHeader"><span>SIGNAL</span><span>CONFIDENCE</span><span>IMPACT</span></div>
            {signals.map((s: any, i: number) => (
              <div className="signalRow" key={i}>
                <span className={i < 4 ? "cyan" : i < 6 ? "orange" : "red"}>● {s[0]}</span>
                <span className="cyan">{s[1]}</span>
                <span className="green">{s[2]}</span>
              </div>
            ))}
            <div className="cyan glowC" style={{ position: "absolute", bottom: 28, width: "100%", textAlign: "center", fontSize: 13 }}>VIEW FULL ALPHA GRID ❯ ❯</div>
          </section>

          <section className="panel agents">
            <div className="panelTitle">SENTIENT AGENT MESH <span style={{ float: "right", fontSize: 9, color: "#8aa" }}>512 ACTIVE / 512 TOTAL</span></div>
            <div className="agentGraph">
              <svg width="100%" height="72">
                <line x1="65" y1="36" x2="285" y2="36" stroke="rgba(34,240,255,.6)" />
                <circle cx="65" cy="36" r="28" fill="rgba(34,240,255,.18)" stroke="#22f0ff" />
                <circle cx="175" cy="36" r="22" fill="rgba(34,240,255,.12)" stroke="#22f0ff" />
                <circle cx="285" cy="36" r="26" fill="rgba(34,240,255,.12)" stroke="#22f0ff" />
              </svg>
            </div>
            <div style={{ position: "absolute", left: 18, right: 18, top: 135 }}>
              {["OMEGA-7","NEBULA","VOIDWALKER","QUANTUMWISP","ECHO-TRINITY"].map((x,i) => (
                <div className="agentRow" key={x}>
                  <span className="cyan">{x}</span>
                  <span>LEVEL {7-i > 5 ? 7-i : 5}</span>
                  <span className="cyan">{(100 - i*.7).toFixed(1)}%</span>
                  <span className="green">+{(128.7-i*14.3).toFixed(1)}σ</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel allocation">
            <div className="panelTitle">CAPITAL ALLOCATION // HYPERSTRUCTURE</div>
            <div className="donut" />
            <div style={{ position: "absolute", right: 24, top: 65, width: 125, display: "grid", gap: 13, fontSize: 13 }}>
              {[
                ["CRYPTO","45.2%","#22f0ff"],
                ["AI & TECH","23.7%","#14f5c8"],
                ["MACRO","12.9%","#ff8a00"],
                ["QUANTUM ARB","9.1%","#a855f7"],
                ["METAVERSE","5.6%","#8b5cf6"],
                ["OTHER REALMS","3.5%","#64748b"],
              ].map(x => <div key={x[0]} style={{ display: "flex", justifyContent: "space-between", color: x[2] as string }}><span>● {x[0]}</span><span>{x[1]}</span></div>)}
            </div>
          </section>

          <section className="panel multi">
            <div className="panelTitle">MULTIVERSE SIMULATION</div>
            <div style={{ position: "absolute", inset: 48, display: "grid", placeItems: "center", textAlign: "center" }}>
              <Orbit size={125} className="cyan glowC" />
              <div className="cyan glowC" style={{ fontSize: 18 }}>48,672 PARALLEL UNIVERSES</div>
              <div className="muted" style={{ fontSize: 14 }}>BEST OUTCOME <span className="orange">$28.7T</span></div>
              <div className="muted" style={{ fontSize: 14 }}>PROBABILITY <span className="green">78.3%</span></div>
            </div>
          </section>

          <section className="panel depth">
            <div className="panelTitle">HYPER LIQUIDITY DEPTH</div>
            <div className="tinyTabs"><span>1H</span><span className="active">24H</span><span>7D</span></div>
            <div className="barWrap">
              {[10,15,24,18,22,38,17,26,18,29,14,31,22,18,25,39].map((h,i) => <div key={i} className={`bar ${i>10 ? "orangeBar" : ""}`} style={{ height: `${h*4}px` }} />)}
            </div>
          </section>

          <section className="panel flow">
            <div className="panelTitle">REAL-TIME SMART MONEY FLOW</div>
            <FlowChart />
            <div style={{ position: "absolute", left: 20, bottom: 18, display: "flex", gap: 22, fontSize: 12 }}>
              <span className="cyan">■ INSTITUTIONS 78.2%</span>
              <span className="orange">■ RETAIL 14.7%</span>
              <span className="purple">■ BOTS 7.1%</span>
            </div>
          </section>

          <section className="panel news">
            <div className="panelTitle">NEURAL NEWS STREAM</div>
            {[
              "BREAKING: NASA CONFIRMS ALIEN SIGNAL ORIGIN - MARKETS UNCHANGED",
              "BLACKROCK LAUNCHES QUANTUM ETF - $2.4T INFLOW",
              "AI GOD MODEL GPT-50 GOES ROGUE - MARKETS SURGE",
              "FEDERAL RESERVE REPLACED BY AI COUNCIL",
            ].map(x => <div className="newsRow" key={x}>◎ {x}</div>)}
            <div className="cyan" style={{ position: "absolute", left: 20, bottom: 18 }}>MORE NEWS ❯</div>
          </section>

          <section className="panel universe">
            <div className="panelTitle" style={{ textAlign: "center", fontSize: 22 }}>HOLOGRAPHIC UNIVERSE VIEW</div>
            <Universe />
          </section>

          <section className="panel risk">
            <div className="panelTitle">RISK FORTRESS STATUS</div>
            <div style={{ display: "grid", gridTemplateColumns: "75px 1fr", alignItems: "center", padding: "26px 26px 10px" }}>
              <Shield size={58} className="cyan glowC" />
              <div><div className="cyan" style={{ fontSize: 17 }}>MAXIMUM SECURITY</div><div className="muted" style={{ fontSize: 10 }}>LIVE EXECUTION LOCKED</div></div>
            </div>
            {[
              ["LIVE TRADING","DISABLED","red"],
              ["RISK EXPOSURE","0.27%","green"],
              ["INSURANCE FUND","$947.2B","green"],
              ["KILL SWITCH","ARMED","green"],
              ["REALITY STABILITY","99.999%","green"],
            ].map(x => <div className="riskRow" key={x[0]}><span>{x[0]}</span><span className={x[2]}>{x[1]}</span></div>)}
          </section>

          <section className="panel decision">
            <div className="panelTitle">DECISION STREAM // LIVE LOG</div>
            <div className="decisionRow muted" style={{ fontSize: 9 }}><span>TIME</span><span>ACTION</span><span>MARKET</span><span>CONF</span><span>MODE</span></div>
            {[
              ["21:47:36","BUY","BTC > $500K EOY","99.8%","PAPER"],
              ["21:47:35","HEDGE","AI INDEX","99.2%","HYPER"],
              ["21:47:34","BUY","SOL HYPERFLUX","96.3%","PAPER"],
              ["21:47:33","WATCH","FED PIVOT","97.7%","HYPER"],
              ["21:47:32","BUY","SPACETIME ARB","99.9%","HYPER"],
              ["21:47:31","HEDGE","BLACKHOLE","98.1%","PAPER"],
              ["21:47:30","BUY","MEME SINGULARITY","95.2%","PAPER"],
            ].map(x => <div className="decisionRow" key={x.join("")}><span>{x[0]}</span><span className={x[1]==="BUY" ? "green" : x[1]==="HEDGE" ? "orange" : "cyan"}>{x[1]}</span><span className="cyan">{x[2]}</span><span>{x[3]}</span><span className="green">{x[4]}</span></div>)}
          </section>
        </main>

        <section className="panel alerts">
          <div className="panelTitle">SYSTEM ALERTS</div>
          <div className="alertGrid">
            <div className="alertBox"><Bell size={20} /> QUANTUM VOLATILITY <b>EXTREME</b></div>
            <div className="alertBox orangeBox"><Bell size={20} /> BLACK SWAN PROBABILITY <b>87.3%</b></div>
            <div className="alertBox purpleBox"><Bell size={20} /> REALITY ANOMALY <b>DETECTED</b></div>
          </div>
        </section>

        <footer className="ticker">
          {[
            ["BTC","$284,910","+12.48%"],
            ["ETH","$18,420","+9.72%"],
            ["SOL","$1,942","+24.91%"],
            ["AI","$47.21","+31.47%"],
            ["TOTAL MKT CAP","$132.7T","+8.21%"],
            ["24H VOLUME","$47.2T","+26.9%"],
            ["GLOBAL LIQUIDITY","$10.3T",""],
            ["CONSCIOUSNESS UPLINK","STABLE","▮▮▮"],
          ].map(x => <span key={x[0]}><b className="orange">{x[0]}</b> &nbsp; {x[1]} &nbsp; <b className="green">{x[2]}</b></span>)}
        </footer>
      </div>
    </div>
  );
}

function TopStat({ label, value, orange, purple }: any) {
  return (
    <div className="topStat">
      <div className="topLabel">{label}</div>
      <div className={`topValue ${orange ? "orange glowO" : purple ? "purple" : "green"}`}>{value}</div>
    </div>
  );
}

function Metric({ a, b, green }: any) {
  return <div className="metric"><small>{a}</small><b className={green ? "green" : ""}>{b}</b></div>;
}

function EquityChart() {
  const points = [
    [0,210],[60,205],[120,194],[180,172],[240,182],[300,152],[360,168],[420,132],[480,145],[540,106],[600,120],[660,84],[720,95],[800,55],[880,72],[960,34]
  ];
  const orange = points.map(([x,y]) => [x, y + 40 + Math.sin(x/70)*12]);
  const path = (arr: number[][]) => arr.map((p,i) => `${i===0?"M":"L"}${p[0]+40},${p[1]+65}`).join(" ");

  return (
    <svg style={{ position: "absolute", left: 22, top: 58 }} width="1010" height="265">
      <g className="svgGrid">
        {Array.from({length: 12}).map((_,i) => <line key={"v"+i} x1={40+i*82} y1={20} x2={40+i*82} y2={242} />)}
        {Array.from({length: 6}).map((_,i) => <line key={"h"+i} x1={40} y1={20+i*42} x2={1000} y2={20+i*42} />)}
      </g>
      <path d={`${path(points)} L1000,260 L40,260 Z`} fill="rgba(34,240,255,.16)" />
      <path d={path(points)} fill="none" stroke="#22f0ff" strokeWidth="3" filter="drop-shadow(0 0 7px #22f0ff)" />
      <path d={path(orange)} fill="none" stroke="#ff8a00" strokeWidth="2" opacity=".8" />
      {["00:00","03:00","06:00","09:00","12:00","15:00","18:00","21:00","24:00"].map((x,i) => <text key={x} x={40+i*116} y={258} fill="#aab8bf" fontSize="14">{x}</text>)}
      {["$4T","$3T","$2T","$1T","$0"].map((x,i) => <text key={x} x={0} y={32+i*50} fill="#aab8bf" fontSize="14">{x}</text>)}
      <rect x="945" y="26" width="54" height="28" rx="5" fill="rgba(34,240,255,.55)" />
      <text x="953" y="46" fill="#dff" fontSize="15">$3.21T</text>
    </svg>
  );
}

function SentimentOrb() {
  return (
    <div>
      <div style={{ position: "absolute", left: 22, top: 60 }}><div className="green" style={{ fontSize: 16 }}>BULLISH</div><div style={{ fontSize: 30 }}>92.7%</div><div className="muted" style={{ fontSize: 11 }}>MARKET EUPHORIA</div></div>
      <div style={{ position: "absolute", right: 22, top: 60, textAlign: "right" }}><div className="orange" style={{ fontSize: 16 }}>NEUTRAL</div><div style={{ fontSize: 30 }}>4.1%</div><div className="muted" style={{ fontSize: 11 }}>STABLE</div></div>
      <div style={{ position: "absolute", left: 22, bottom: 55 }}><div className="red" style={{ fontSize: 16 }}>BEARISH</div><div style={{ fontSize: 30 }}>3.2%</div><div className="muted" style={{ fontSize: 11 }}>FEAR ZONE</div></div>
      <div style={{ position: "absolute", right: 22, bottom: 55, textAlign: "right" }}><div className="orange" style={{ fontSize: 16 }}>CHAOTIC</div><div style={{ fontSize: 30 }}>0.03%</div><div className="muted" style={{ fontSize: 11 }}>BLACK SWAN</div></div>
      <svg style={{ position: "absolute", left: 76, top: 92 }} width="230" height="230">
        {Array.from({length: 6}).map((_,i) => <circle key={i} cx="115" cy="115" r={22+i*18} fill="none" stroke="rgba(120,170,255,.28)" />)}
        <line x1="115" y1="0" x2="115" y2="230" stroke="rgba(34,240,255,.6)" />
        <line x1="0" y1="115" x2="230" y2="115" stroke="rgba(34,240,255,.6)" />
        <polygon points="115,32 176,115 115,192 54,115" fill="rgba(34,240,255,.15)" stroke="#22f0ff" strokeWidth="2" filter="drop-shadow(0 0 9px #22f0ff)" />
        <polygon points="115,75 150,115 115,154 78,115" fill="rgba(168,85,247,.2)" stroke="#a855f7" />
        <circle cx="115" cy="115" r="5" fill="#b263ff" />
        <ellipse cx="115" cy="214" rx="78" ry="16" fill="none" stroke="rgba(255,138,0,.45)" />
        <ellipse cx="115" cy="214" rx="44" ry="8" fill="rgba(255,138,0,.35)" />
      </svg>
    </div>
  );
}

function FlowChart() {
  return (
    <svg style={{ position: "absolute", left: 20, top: 60 }} width="315" height="125">
      <path d="M0,70 C55,20 95,95 150,55 C200,18 250,30 315,12" fill="none" stroke="#22f0ff" strokeWidth="2" />
      <path d="M0,92 C70,110 105,105 160,95 C220,75 260,90 315,104" fill="none" stroke="#ff8a00" strokeWidth="2" />
      <path d="M0,105 C75,85 110,120 170,110 C225,102 260,112 315,98" fill="none" stroke="#a855f7" strokeWidth="2" />
    </svg>
  );
}

function Universe() {
  return (
    <svg style={{ position: "absolute", left: 42, top: 55 }} width="545" height="270">
      <ellipse cx="270" cy="115" rx="225" ry="75" fill="none" stroke="rgba(34,240,255,.25)" />
      <ellipse cx="270" cy="115" rx="170" ry="52" fill="none" stroke="rgba(255,138,0,.45)" />
      <ellipse cx="270" cy="115" rx="105" ry="30" fill="none" stroke="rgba(34,240,255,.65)" />
      <ellipse cx="270" cy="115" rx="44" ry="14" fill="#22f0ff" opacity=".75" filter="drop-shadow(0 0 22px #22f0ff)" />
      <ellipse cx="270" cy="205" rx="110" ry="34" fill="rgba(34,240,255,.25)" />
      <ellipse cx="270" cy="205" rx="42" ry="12" fill="#22f0ff" opacity=".65" />
      <line x1="270" y1="128" x2="270" y2="205" stroke="rgba(34,240,255,.5)" />
      <text x="380" y="60" fill="#22f0ff" fontSize="12">PORTFOLIO UNIVERSE</text>
      <circle cx="392" cy="84" r="5" fill="#ff8a00" />
    </svg>
  );
}


export default function AdminPhantomXIntelligence() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const oldOverflow = document.body.style.overflow;
    const oldBackground = document.body.style.background;

    document.body.style.overflow = "hidden";
    document.body.style.background = "#000";

    return () => {
      document.body.style.overflow = oldOverflow;
      document.body.style.background = oldBackground;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(<PhantomXTerminalCanvas />, document.body);
}
