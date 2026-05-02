import { useEffect, useMemo, useState } from "react";

export function NexoraVisualSystemsB() {
  const [status, setStatus] = useState<any>(null);
  const [rotation, setRotation] = useState<any>(null);
  const [pressure, setPressure] = useState<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [s, r, p] = await Promise.allSettled([
        fetch("/api/polyedge/auto-paper/status").then((x) => x.json()),
        fetch("/api/nexora/learning/aggressive-rotation").then((x) => x.json()).catch(() => null),
        fetch("/api/nexora/learning/pressure").then((x) => x.json()).catch(() => null),
      ]);

      if (!alive) return;
      if (s.status === "fulfilled") setStatus(s.value);
      if (r.status === "fulfilled") setRotation(r.value);
      if (p.status === "fulfilled") setPressure(p.value);
      setTick((v) => v + 1);
    }

    load();
    const id = window.setInterval(load, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const plan = useMemo(() => {
    return Array.isArray(rotation?.plan) ? rotation.plan.slice(0, 8) : [];
  }, [rotation]);

  const learning = status?.learning || {};
  const pnl = Number(learning.totalPnl || 0);
  const score = Number(learning.learningScore || 0);
  const win = Number(learning.winRate || 0);

  return (
    <div className="col-span-12 grid grid-cols-12 gap-4">
      <style>{`
        @keyframes ringSpin { to { transform: rotate(360deg); } }
        @keyframes beamMove { 0% { transform: translateX(-30%); opacity:0; } 30% { opacity:.55; } 100% { transform: translateX(130%); opacity:0; } }
        @keyframes heatPulse { 0%,100% { opacity:.25; } 50% { opacity:.85; } }
        @keyframes clusterFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
      `}</style>

      <div className="col-span-12 xl:col-span-4 rounded-2xl border border-cyan-300/20 bg-black/50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">AI Consensus Rings</div>
        <div className="relative mx-auto mt-5 h-44 w-44">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border border-cyan-300/40"
              style={{
                inset: `${i * 18}px`,
                animation: `ringSpin ${8 + i * 4}s linear infinite`,
                borderTopColor: i === 0 ? "rgba(74,222,128,.9)" : i === 1 ? "rgba(96,165,250,.9)" : "rgba(251,191,36,.9)",
              }}
            />
          ))}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-black text-cyan-100">{score}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">learning</div>
          </div>
        </div>
      </div>

      <div className="col-span-12 xl:col-span-4 rounded-2xl border border-cyan-300/20 bg-black/50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">PnL Heatmap Overlay</div>
        <div className="mt-4 grid h-44 grid-cols-8 gap-1">
          {Array.from({ length: 64 }).map((_, i) => {
            const hot = (i * 7 + tick) % 11;
            const good = pnl >= 0 || hot % 3 === 0;
            return (
              <div
                key={i}
                className={good ? "rounded bg-emerald-300/30" : "rounded bg-red-400/30"}
                style={{ animation: `heatPulse ${1.5 + (i % 4) * 0.2}s ease-in-out infinite` }}
              />
            );
          })}
        </div>
      </div>

      <div className="col-span-12 xl:col-span-4 rounded-2xl border border-cyan-300/20 bg-black/50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Regime Switch Monitor</div>
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-3xl font-black text-cyan-100">{String(pressure?.mode || "paper").replaceAll("_", " ")}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.16em] text-white/50">
            <div>Win <span className="text-cyan-200">{win.toFixed(1)}%</span></div>
            <div>PnL <span className={pnl >= 0 ? "text-emerald-300" : "text-red-300"}>{pnl.toFixed(2)}</span></div>
            <div>Trades <span className="text-cyan-200">{pressure?.recentTrades ?? 0}</span></div>
            <div>Open <span className="text-cyan-200">{status?.openPositions ?? 0}</span></div>
          </div>
        </div>
      </div>

      <div className="col-span-12 rounded-2xl border border-cyan-300/20 bg-black/50 p-4">
        <div className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Live Position Beams + Strategy Clusters</div>
        <div className="relative h-56 overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,.16),transparent_60%)]" />
          <div className="absolute inset-y-0 w-1/3 bg-cyan-300/10 blur-2xl" style={{ animation: "beamMove 3s linear infinite" }} />

          {plan.map((p: any, i: number) => {
            const x = 8 + ((i * 12) % 84);
            const y = 22 + ((i * 17) % 56);
            const short = p.direction === "short";
            return (
              <div
                key={p.id || i}
                className="absolute rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em]"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  color: short ? "rgb(252,165,165)" : "rgb(134,239,172)",
                  borderColor: short ? "rgba(248,113,113,.45)" : "rgba(74,222,128,.45)",
                  background: "rgba(0,0,0,.55)",
                  animation: `clusterFloat ${2.5 + (i % 4) * 0.3}s ease-in-out infinite`,
                }}
              >
                {String(p.symbol || "?").replace("/USD", "")} {p.strategy}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
