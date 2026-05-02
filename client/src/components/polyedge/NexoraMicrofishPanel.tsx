import { useEffect, useMemo, useState } from "react";

type NodePoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  kind: "bull" | "bear" | "neutral" | "probe" | "risk";
  score: number;
};

function cx(kind: NodePoint["kind"]) {
  if (kind === "bull") return "rgba(74, 222, 128, 0.95)";
  if (kind === "bear") return "rgba(248, 113, 113, 0.95)";
  if (kind === "probe") return "rgba(96, 165, 250, 0.95)";
  if (kind === "risk") return "rgba(251, 191, 36, 0.95)";
  return "rgba(165, 180, 252, 0.9)";
}

export default function NexoraMicrofishPanel() {
  const [data, setData] = useState<any>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [watch, status, cockpit] = await Promise.allSettled([
        fetch("/api/nexora/candidates/watchlist-v3").then((r) => r.json()),
        fetch("/api/polyedge/auto-paper/status").then((r) => r.json()),
        fetch("/api/nexora/learning/cockpit").then((r) => r.json()).catch(() => null),
      ]);

      if (!alive) return;

      setData({
        watch: watch.status === "fulfilled" ? watch.value : null,
        status: status.status === "fulfilled" ? status.value : null,
        cockpit: cockpit.status === "fulfilled" ? cockpit.value : null,
      });

      setTick((v) => v + 1);
    }

    load();
    const id = window.setInterval(load, 3500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const nodes = useMemo<NodePoint[]>(() => {
    const watchRows = Array.isArray(data?.watch?.watchlist) ? data.watch.watchlist : [];
    const leaderboard = Array.isArray(data?.cockpit?.leaderboard?.rows)
      ? data.cockpit.leaderboard.rows
      : [];

    const combined = [
      ...watchRows.slice(0, 14).map((r: any, i: number) => ({
        id: `${r.symbol}-${r.strategy}-${r.direction}-${i}`,
        label: `${r.symbol?.replace("/USD", "") || "?"} ${r.direction || ""}`,
        score: Number(r.watchScore || r.score || 40),
        kind:
          String(r.direction) === "long"
            ? "bull"
            : String(r.direction) === "short"
            ? "bear"
            : "neutral",
      })),
      ...leaderboard.slice(0, 10).map((r: any, i: number) => ({
        id: `lead-${r.symbol}-${r.strategy}-${r.direction}-${i}`,
        label: `${r.symbol?.replace("/USD", "") || "?"} ${Number(r.win_rate || 0).toFixed(0)}%`,
        score: Number(r.win_rate || 30),
        kind: Number(r.pnl || 0) >= 0 ? "probe" : "risk",
      })),
    ];

    const fallback = [
      { id: "btc", label: "BTC", score: 55, kind: "probe" },
      { id: "eth", label: "ETH", score: 50, kind: "probe" },
      { id: "sol", label: "SOL", score: 48, kind: "probe" },
      { id: "risk", label: "RISK", score: 40, kind: "risk" },
    ];

    const rows = combined.length ? combined : fallback;

    return rows.slice(0, 24).map((r: any, i: number) => {
      const band = i % 4;
      const jitter = ((tick + i * 13) % 10) - 5;

      return {
        ...r,
        x: 8 + ((i * 17) % 86),
        y: 22 + band * 16 + jitter * 0.6,
        size: Math.max(5, Math.min(16, Number(r.score || 40) / 5)),
      };
    });
  }, [data, tick]);

  const status = data?.status;
  const learning = status?.learning || {};
  const winRate = Number(learning.winRate || 0);
  const pnl = Number(learning.totalPnl || 0);
  const pf = Number(learning.profitFactor || 0);

  return (
    <div className="col-span-12 overflow-hidden rounded-2xl border border-cyan-300/20 bg-black/50 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
      <style>{`
        @keyframes microfishPulse {
          0%,100% { opacity: .45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes microfishDash {
          to { stroke-dashoffset: -120; }
        }
        @keyframes scanSweep {
          0% { transform: translateX(-30%); opacity: 0; }
          20% { opacity: .4; }
          100% { transform: translateX(120%); opacity: 0; }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-cyan-300/15 px-4 py-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">
            Microfish Relationship Graph
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/35">
            live signal paths · probe clusters · market pressure map
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-right text-[10px] uppercase tracking-[0.15em]">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-white/35">Win</div>
            <div className="font-black text-cyan-200">{winRate.toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-white/35">PF</div>
            <div className="font-black text-cyan-200">{pf.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-white/35">PnL</div>
            <div className={pnl >= 0 ? "font-black text-emerald-300" : "font-black text-red-300"}>
              {pnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-[280px]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,.10)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.10)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-cyan-300/5 blur-3xl" />
        <div className="absolute inset-y-0 right-0 w-1/3 bg-fuchsia-400/5 blur-3xl" />
        <div className="absolute inset-y-0 w-1/3 bg-cyan-200/10 blur-2xl" style={{ animation: "scanSweep 4s linear infinite" }} />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {nodes.slice(0, -1).map((n, i) => {
            const m = nodes[(i + 3) % nodes.length];
            const strong = Math.abs(n.score - m.score) < 20;
            return (
              <line
                key={`${n.id}-${m.id}`}
                x1={n.x}
                y1={n.y}
                x2={m.x}
                y2={m.y}
                stroke={strong ? "rgba(34,211,238,.5)" : "rgba(148,163,184,.22)"}
                strokeWidth={strong ? 0.35 : 0.18}
                strokeDasharray="4 5"
                style={{ animation: `microfishDash ${4 + (i % 5)}s linear infinite` }}
              />
            );
          })}

          <path
            d="M 4 78 C 22 62, 35 70, 49 54 S 78 37, 96 24"
            fill="none"
            stroke="rgba(96,165,250,.65)"
            strokeWidth="0.65"
            strokeDasharray="3 3"
            style={{ animation: "microfishDash 5s linear infinite" }}
          />

          {nodes.map((n, i) => (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.size * 0.42}
                fill={cx(n.kind)}
                opacity="0.18"
                style={{
                  transformOrigin: `${n.x}% ${n.y}%`,
                  animation: `microfishPulse ${2.2 + (i % 5) * 0.3}s ease-in-out infinite`,
                }}
              />
              <circle cx={n.x} cy={n.y} r={n.size * 0.18} fill={cx(n.kind)} />
            </g>
          ))}
        </svg>

        <div className="absolute inset-0">
          {nodes.map((n) => (
            <div
              key={`label-${n.id}`}
              className="absolute -translate-x-1/2 rounded border border-white/10 bg-black/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/70"
              style={{ left: `${n.x}%`, top: `${n.y + 4}%` }}
            >
              {n.label}
            </div>
          ))}
        </div>

        <div className="absolute bottom-3 left-4 flex gap-3 text-[10px] uppercase tracking-[0.16em] text-white/50">
          <span className="text-emerald-300">● bull</span>
          <span className="text-red-300">● bear</span>
          <span className="text-blue-300">● probe</span>
          <span className="text-amber-300">● risk</span>
        </div>

        <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-[0.18em] text-cyan-200/60">
          animated · real endpoint fed · paper intelligence
        </div>
      </div>
    </div>
  );
}
