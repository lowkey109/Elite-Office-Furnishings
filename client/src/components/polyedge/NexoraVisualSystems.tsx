import { useEffect, useMemo, useState } from "react";

export function NexoraVisualSystems() {
  const [status, setStatus] = useState<any>(null);
  const [watch, setWatch] = useState<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [s, w] = await Promise.allSettled([
        fetch("/api/polyedge/auto-paper/status").then((r) => r.json()),
        fetch("/api/nexora/candidates/watchlist-v3").then((r) => r.json()),
      ]);

      if (!alive) return;
      if (s.status === "fulfilled") setStatus(s.value);
      if (w.status === "fulfilled") setWatch(w.value);
      setTick((v) => v + 1);
    }

    load();
    const id = window.setInterval(load, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const rows = useMemo(() => {
    const watchRows = Array.isArray(watch?.watchlist) ? watch.watchlist : [];
    return watchRows.slice(0, 12);
  }, [watch]);

  const learning = status?.learning || {};
  const pnl = Number(learning.totalPnl || 0);
  const winRate = Number(learning.winRate || 0);
  const openPositions = Number(status?.openPositions || 0);

  return (
    <div className="col-span-12 grid grid-cols-12 gap-4">
      <style>{`
        @keyframes nexoraFlow { to { stroke-dashoffset: -160; } }
        @keyframes nexoraPulse { 0%,100% { opacity:.35; transform:scale(1); } 50% { opacity:1; transform:scale(1.22); } }
        @keyframes nexoraSweep { 0% { transform:translateX(-20%); opacity:0; } 25% { opacity:.35; } 100% { transform:translateX(120%); opacity:0; } }
        @keyframes nexoraBars { 0%,100% { transform:scaleY(.35); } 50% { transform:scaleY(1); } }
      `}</style>

      <div className="col-span-12 xl:col-span-7 overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/50 p-4">
        <div className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
          Live Candlestick Strip
        </div>
        <div className="flex h-32 items-end gap-1">
          {Array.from({ length: 48 }).map((_, i) => {
            const h = 20 + ((i * 17 + tick * 5) % 80);
            const up = (i + tick) % 3 !== 0;
            return (
              <div key={i} className="flex flex-1 items-end justify-center">
                <div
                  className={up ? "w-1 rounded bg-emerald-300/70" : "w-1 rounded bg-red-400/70"}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="col-span-12 xl:col-span-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/50 p-4">
        <div className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
          Liquidity / Orderflow Bars
        </div>
        <div className="grid h-32 grid-cols-16 items-end gap-1">
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className={i % 2 ? "origin-bottom rounded bg-cyan-300/60" : "origin-bottom rounded bg-fuchsia-300/50"}
              style={{
                height: `${20 + ((i * 11 + tick * 7) % 75)}%`,
                animation: `nexoraBars ${1.4 + (i % 5) * 0.2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="col-span-12 overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
            Signal Path Trails
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            open {openPositions} · win {winRate.toFixed(1)}% · pnl {pnl.toFixed(2)}
          </div>
        </div>

        <div className="relative h-48 overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.14),transparent_60%)]" />
          <div className="absolute inset-y-0 w-1/3 bg-cyan-300/10 blur-2xl" style={{ animation: "nexoraSweep 4s linear infinite" }} />

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {rows.map((r: any, i: number) => {
              const x = 8 + ((i * 13) % 84);
              const y = 18 + ((i * 19 + tick * 3) % 64);
              const x2 = 8 + (((i + 4) * 13) % 84);
              const y2 = 18 + (((i + 4) * 19 + tick * 3) % 64);
              const isLong = r.direction === "long";
              return (
                <g key={`${r.symbol}-${r.strategy}-${i}`}>
                  <line
                    x1={x}
                    y1={y}
                    x2={x2}
                    y2={y2}
                    stroke={isLong ? "rgba(74,222,128,.55)" : "rgba(248,113,113,.55)"}
                    strokeWidth="0.45"
                    strokeDasharray="4 5"
                    style={{ animation: `nexoraFlow ${3 + (i % 5)}s linear infinite` }}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={2 + Number(r.watchScore || 40) / 30}
                    fill={isLong ? "rgba(74,222,128,.9)" : "rgba(248,113,113,.9)"}
                    style={{ animation: `nexoraPulse ${2 + (i % 4) * 0.25}s ease-in-out infinite` }}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
