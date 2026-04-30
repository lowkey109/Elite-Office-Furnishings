import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  Brain,
  Cpu,
  Eye,
  Hexagon,
  Radar,
  Shield,
  Skull,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CockpitMode = "admin" | "customer";

type Props = {
  mode?: CockpitMode;
};

const colors = ["#22f0ff", "#ff00aa", "#ff3e00", "#a855f7", "#00ff9d"];

function buildEquityData(seed = 1) {
  return Array.from({ length: 120 }, (_, i) => ({
    t: i,
    value: Math.round(
      1240 +
        i * 52 +
        Math.sin((i + seed) / 5) * 720 +
        Math.pow(i / 35, 2.5) * 1650
    ),
    ghost: Math.round(1240 + i * 57 + Math.sin(i / 7) * 520),
  }));
}

const agents = [
  { name: "AETHER-Ω", load: 99.97, edge: "+142σ", status: "TRANSCENDENT" },
  { name: "VOID PHANTOM", load: 98.88, edge: "+97σ", status: "GODMODE" },
  { name: "NEXORA LATTICE", load: 97.64, edge: "+81σ", status: "ENTANGLED" },
  { name: "SINGULARITY EYE", load: 96.91, edge: "+134σ", status: "AWAKE" },
];

const signals = [
  ["BTC SINGULARITY", "PAPER LONG", "99.1%", "$184M", "+42σ"],
  ["AI NARRATIVE INDEX", "WATCH", "97.8%", "$97M", "+31σ"],
  ["VOLATILITY RIFT", "HEDGE", "95.4%", "$41M", "-12σ"],
  ["LIQUIDITY FRACTAL", "OBSERVE", "92.9%", "$28M", "+18σ"],
];

const allocation = [
  { name: "BTC", value: 42 },
  { name: "ETH", value: 24 },
  { name: "AI", value: 18 },
  { name: "CASH", value: 16 },
];

const depth = [
  { level: "L1", bid: 94, ask: 81 },
  { level: "L2", bid: 82, ask: 74 },
  { level: "L3", bid: 68, ask: 63 },
  { level: "L4", bid: 55, ask: 46 },
];

function HoloPanel({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#030712]/90 shadow-[0_0_40px_rgba(34,240,255,0.12)] backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[pulse_4s_ease-in-out_infinite]" />
      <div className="relative z-10 flex items-center justify-between border-b border-cyan-300/15 px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-cyan-300" /> : null}
          <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_#22f0ff]" />
          Live
        </div>
      </div>
      <div className="relative z-10 p-4">{children}</div>
    </motion.div>
  );
}

export default function PolyEdgeAetherforgeCockpit({ mode = "admin" }: Props) {
  const [clock, setClock] = useState("");
  const [pulse, setPulse] = useState(99.9991);
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(
        new Date().toLocaleTimeString("en-AU", {
          hour12: false,
          timeZone: "Australia/Sydney",
        }) + " AETHER"
      );
      setPulse(99.998 + Math.random() * 0.0015);
      setSeed((s) => s + 1);
    }, 1800);

    return () => window.clearInterval(timer);
  }, []);

  const equityData = useMemo(() => buildEquityData(seed), [seed]);
  const isAdmin = mode === "admin";

  return (
    <div className="min-h-screen overflow-hidden bg-[#010203] text-cyan-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,240,255,0.16),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(255,0,170,0.14),transparent_40%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none fixed left-0 top-0 h-40 w-full animate-[ping_5s_linear_infinite] bg-gradient-to-b from-cyan-300/0 via-cyan-300/20 to-cyan-300/0" />

      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-cyan-300/20 bg-black/40 p-4 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 p-2 shadow-[0_0_25px_rgba(34,240,255,0.25)]">
              <Hexagon className="h-7 w-7 text-cyan-200" />
            </div>
            <div>
              <div className="text-xl font-black tracking-[0.18em] text-white">
                POLY//EDGE
              </div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-fuchsia-300">
                Aetherforge ∞
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {[
              "Neural Core",
              "Paper Portfolio",
              "Alpha Grid",
              "Risk Fortress",
              "Agent Legion",
              "Reality Anchor",
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03] px-3 py-3 text-xs uppercase tracking-[0.18em] text-cyan-100"
              >
                <span>{item}</span>
                <span className="h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_#ff00aa]" />
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-200">
              Neural Synapse
            </div>
            <div className="mt-2 text-3xl font-black text-white drop-shadow-[0_0_18px_rgba(34,240,255,0.9)]">
              {pulse.toFixed(6)}%
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[99%] rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-orange-500" />
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
              Customer view is read-only paper intelligence. No financial advice.
              No live execution.
            </div>
          )}
        </aside>

        <main className="flex-1 p-4 lg:p-6">
          <header className="mb-4 flex flex-col gap-3 rounded-2xl border border-cyan-300/25 bg-black/45 p-4 shadow-[0_0_40px_rgba(34,240,255,0.12)] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-300">
                {isAdmin ? "Admin Command Cockpit" : "Customer Paper Cockpit"}
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-[0.16em] text-white lg:text-4xl">
                POLY//EDGE AETHERFORGE ∞
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-2">
                <div className="text-cyan-300">Mode</div>
                <div className="font-bold text-white">{isAdmin ? "ADMIN" : "READ ONLY"}</div>
              </div>
              <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/5 px-4 py-2">
                <div className="text-fuchsia-300">Equity</div>
                <div className="font-bold text-white">$8.47T</div>
              </div>
              <div className="rounded-xl border border-orange-300/20 bg-orange-300/5 px-4 py-2">
                <div className="text-orange-300">Risk</div>
                <div className="font-bold text-white">VOIDLOCKED</div>
              </div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-2">
                <div className="text-emerald-300">Time</div>
                <div className="font-bold text-white">{clock}</div>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <HoloPanel
              title="Hyperdimensional Equity Manifold"
              icon={TrendingUp}
              className="xl:col-span-7"
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData}>
                    <defs>
                      <linearGradient id="aether" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff3e00" stopOpacity={0.9} />
                        <stop offset="45%" stopColor="#ff00aa" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#22f0ff" stopOpacity={0.12} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" stroke="#66eaff" fontSize={10} />
                    <YAxis stroke="#66eaff" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        background: "#020407",
                        border: "1px solid rgba(34,240,255,.45)",
                        color: "#ddfffc",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#22f0ff"
                      strokeWidth={3}
                      fill="url(#aether)"
                    />
                    <Area
                      type="monotone"
                      dataKey="ghost"
                      stroke="#ff00aa"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </HoloPanel>

            <HoloPanel title="Reality Anchor" icon={Radar} className="xl:col-span-2">
              <div className="flex h-[360px] flex-col items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="relative h-40 w-40 rounded-full border border-cyan-300/40 bg-cyan-300/5 shadow-[0_0_40px_rgba(34,240,255,0.25)]"
                >
                  <div className="absolute inset-8 rounded-full border border-fuchsia-300/30" />
                  <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_20px_#fff]" />
                  <div className="absolute left-1/2 top-0 h-1/2 w-px origin-bottom bg-cyan-300" />
                </motion.div>
                <div className="mt-6 text-center">
                  <div className="text-4xl font-black text-white">99.9997</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                    Anchored
                  </div>
                </div>
              </div>
            </HoloPanel>

            <HoloPanel title="Capital Hyperstructure" icon={Activity} className="xl:col-span-3">
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocation} innerRadius={58} outerRadius={110} dataKey="value">
                      {allocation.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </HoloPanel>

            <HoloPanel title="Sentient Agent Legion" icon={Bot} className="xl:col-span-4">
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.name}
                    className="rounded-xl border border-cyan-300/15 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white">{agent.name}</div>
                      <div className="text-fuchsia-300">{agent.edge}</div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400"
                        style={{ width: `${agent.load}%` }}
                      />
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                      {agent.status}
                    </div>
                  </div>
                ))}
              </div>
            </HoloPanel>

            <HoloPanel title="Alpha Apocalypse Signal Grid" icon={Zap} className="xl:col-span-5">
              <div className="space-y-3">
                {signals.map((signal) => (
                  <div
                    key={signal[0]}
                    className="rounded-xl border border-fuchsia-300/20 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{signal[0]}</div>
                        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                          {signal[1]}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-white">{signal[2]}</div>
                        <div className="text-xs text-fuchsia-300">
                          {signal[3]} • {signal[4]}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </HoloPanel>

            <HoloPanel title="Holographic Liquidity Depth" icon={Cpu} className="xl:col-span-3">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={depth}>
                    <XAxis dataKey="level" stroke="#66eaff" fontSize={10} />
                    <YAxis stroke="#66eaff" fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="bid" fill="#22f0ff" />
                    <Bar dataKey="ask" fill="#ff00aa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </HoloPanel>

            <HoloPanel title="Risk Fortress" icon={Shield} className="xl:col-span-12">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Live Execution", isAdmin ? "GATED" : "DISABLED"],
                  ["Black Swan", "0.0003%"],
                  ["Consciousness Stability", "99.999%"],
                  ["Nexora Authority", "ENFORCED"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-cyan-300/15 bg-white/[0.03] p-4"
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                      {label}
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
            </HoloPanel>
          </section>

          <div className="mt-4 overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/60 px-4 py-3 text-xs uppercase tracking-[0.2em] text-cyan-100">
            <motion.div
              animate={{ x: ["100%", "-100%"] }}
              transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
              className="whitespace-nowrap"
            >
              BTC $2,847,910 +312% • ETH $142,800 +189% • AETHERFORGE PAPER
              INTELLIGENCE ACTIVE • NEXORA EXECUTION GATE ENFORCED • NO CUSTOMER
              LIVE TRADING • SINGULARITY PROTOCOL STABLE
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
