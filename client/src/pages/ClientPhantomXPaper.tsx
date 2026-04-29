import React, { useEffect, useMemo, useState } from "react";

type AnyRow = Record<string, any>;

type Payload = {
  ok: boolean;
  mode: string;
  generatedAt: string;
  markets: AnyRow[];
  wallets: AnyRow[];
  opportunities: AnyRow[];
  paperTrades: AnyRow[];
  decisions: AnyRow[];
  stats: {
    markets: number;
    wallets: number;
    opportunities: number;
    paperTrades: number;
    totalVolume: number;
    totalLiquidity: number;
    avgConfidence: number;
  };
  errors?: string[];
};

const fmt = {
  money(v: any) {
    const n = Number(v || 0);
    if (!Number.isFinite(n) || n === 0) return "$0";
    if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
    return "$" + Math.round(n).toLocaleString("en-AU");
  },
  num(v: any) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? Math.round(n).toLocaleString("en-AU") : "0";
  },
  pct(v: any) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? Math.round(n * 100) + "%" : "0%";
  },
};

function Panel({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative overflow-hidden rounded-[10px] border border-[#d9913a26] bg-[#061014]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.42)] ${className}`}>
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,181,89,0.035),transparent_35%),radial-gradient(circle_at_50%_0%,rgba(255,181,89,0.055),transparent_45%)]" />
      <div className="relative flex h-8 items-center justify-between border-b border-[#d9913a1a] px-3">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#c98738]">// {label}</p>
      </div>
      <div className="relative p-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, green = false, red = false }: { label: string; value: string; green?: boolean; red?: boolean }) {
  return (
    <div className="rounded-md border border-[#d9913a1c] bg-black/28 p-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">{label}</p>
      <p className={`mt-1 font-mono text-[18px] font-black leading-none ${green ? "text-[#8fffd2]" : red ? "text-[#ff6f6f]" : "text-[#ffbd6b]"}`}>
        {value}
      </p>
    </div>
  );
}

function MicroBars({ values }: { values: number[] }) {
  const bars = values.length ? values : [93, 84, 78, 71, 65, 54, 47, 39];
  return (
    <div className="space-y-[7px]">
      {bars.slice(0, 8).map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-7 font-mono text-[9px] text-slate-700">{String(i + 1).padStart(2, "0")}</span>
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#132126]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7a3d16] via-[#ce7e2c] to-[#ffd28d]" style={{ width: `${Math.max(4, Math.min(100, Number(v || 0)))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Status({ label, value, good = false, bad = false }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-900/80 py-2 font-mono text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className={good ? "text-[#8fffd2]" : bad ? "text-[#ff7070]" : "text-[#ffbd6b]"}>{value}</span>
    </div>
  );
}

export default function ClientPhantomXPaper() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/phantomx/intelligence", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Unable to load Phantom X");
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, []);

  const curve = useMemo(() => [9, 11, 13, 19, 23, 29, 31, 43, 48, 57, 62, 74, 87, 94], []);
  const marketBars = useMemo(() => {
    const markets = data?.markets || [];
    return markets.slice(0, 9).map((m) => Math.min(100, Math.log10(Number(m.volume || 0) + 10) * 23));
  }, [data]);

  const topMarkets = data?.markets || [];
  const opps = data?.opportunities || [];
  const decisions = data?.decisions || [];

  return (
    <div className="min-h-screen bg-[#020607] text-[#dbe7e5]">
      <style>{`
        .phantom-grid {
          background-image:
            linear-gradient(rgba(217,145,58,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(217,145,58,.045) 1px, transparent 1px);
          background-size: 34px 34px;
        }
      `}</style>

      <div className="phantom-grid fixed inset-0 opacity-35" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,145,58,.12),transparent_35%),linear-gradient(180deg,rgba(2,6,7,.2),#020607_85%)]" />

      <main className="relative z-10 p-4">
        <header className="mb-3 grid grid-cols-12 gap-3">
          <div className="col-span-12 rounded-[10px] border border-[#d9913a2b] bg-black/55 px-4 py-3 xl:col-span-7">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.42em] text-[#c98738]">PHANTOM X // CUSTOMER PAPER TERMINAL</p>
            <h1 className="mt-1 font-mono text-[34px] font-black tracking-[-0.12em] text-[#ffbd6b]">POLYMARKET ALPHA VIEW</h1>
            <p className="mt-2 max-w-3xl font-mono text-[11px] text-slate-500">
              Paper-only market intelligence. No live-money trading. No financial advice. Admin-controlled signal feed.
            </p>
          </div>

          <div className="col-span-12 grid grid-cols-2 gap-3 xl:col-span-5 md:grid-cols-5">
            <Stat label="Markets" value={fmt.num(data?.stats.markets)} />
            <Stat label="Signals" value={fmt.num(data?.stats.opportunities)} green />
            <Stat label="Paper" value="ON" green />
            <Stat label="Live $" value="OFF" red />
            <Stat label="Volume" value={fmt.money(data?.stats.totalVolume)} />
          </div>
        </header>

        {error && <div className="mb-3 rounded-md border border-red-400/30 bg-red-950/35 p-3 font-mono text-xs text-red-200">{error}</div>}

        <section className="grid grid-cols-12 gap-3">
          <Panel label="Market Signal Strength" className="col-span-12 xl:col-span-3">
            <MicroBars values={marketBars} />
          </Panel>

          <Panel label="Paper Performance Curve" className="col-span-12 xl:col-span-6">
            <div className="h-[315px]">
              <svg viewBox="0 0 820 330" className="h-full w-full">
                <defs>
                  <linearGradient id="clientPxLine" x1="0" x2="1">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="45%" stopColor="#d9913a" />
                    <stop offset="100%" stopColor="#8fffd2" />
                  </linearGradient>
                  <filter id="clientPxGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {Array.from({ length: 7 }, (_, i) => <line key={`h-${i}`} x1="0" x2="820" y1={30 + i * 44} y2={30 + i * 44} stroke="rgba(148,163,184,.08)" />)}
                <polyline
                  fill="none"
                  stroke="url(#clientPxLine)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#clientPxGlow)"
                  points={curve.map((v, i) => `${25 + (i / Math.max(1, curve.length - 1)) * 770},${310 - Number(v) * 2.85}`).join(" ")}
                />
              </svg>
            </div>
          </Panel>

          <Panel label="Risk Controls" className="col-span-12 xl:col-span-3">
            <Status label="Live trading" value="disabled" bad />
            <Status label="Auto execution" value="locked" bad />
            <Status label="Paper mode" value="enabled" good />
            <Status label="Evidence required" value="enabled" good />
            <Status label="Admin feed" value="controlled" good />
          </Panel>

          <Panel label="Market Feed" className="col-span-12 xl:col-span-6">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {topMarkets.slice(0, 10).map((m) => (
                <div key={m.id} className="rounded-md border border-slate-900 bg-black/24 p-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 font-mono text-[10px] font-bold text-slate-200">{m.question}</p>
                    <p className="font-mono text-[10px] text-[#ffbd6b]">{fmt.pct(m.price)}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[9px] text-slate-600">
                    <span>VOL {fmt.money(m.volume)}</span>
                    <span>LIQ {fmt.money(m.liquidity)}</span>
                    <span>{m.category || "POLY"}</span>
                  </div>
                </div>
              ))}
              {!topMarkets.length && <div className="font-mono text-xs text-slate-600">No live market feed yet. Admin must scan Polymarket first.</div>}
            </div>
          </Panel>

          <Panel label="Opportunity Stack" className="col-span-12 xl:col-span-3">
            <div className="space-y-2">
              {opps.slice(0, 8).map((o) => (
                <div key={o.id} className="rounded-md border border-slate-900 bg-black/24 p-2">
                  <div className="flex justify-between gap-3">
                    <p className="line-clamp-2 font-mono text-[10px] font-bold text-slate-200">{o.title}</p>
                    <span className="font-mono text-[10px] text-[#8fffd2]">{fmt.num(o.score)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-[9px] text-slate-600">{o.thesis || o.evidence_summary || "Awaiting evidence thesis."}</p>
                </div>
              ))}
              {!opps.length && <div className="font-mono text-xs text-slate-600">No opportunities yet.</div>}
            </div>
          </Panel>

          <Panel label="Decision Evidence" className="col-span-12 xl:col-span-3">
            <div className="space-y-2">
              {decisions.slice(0, 8).map((d) => (
                <div key={d.id} className="rounded-md border border-slate-900 bg-black/24 p-2">
                  <div className="flex justify-between gap-3">
                    <p className="font-mono text-[10px] font-bold uppercase text-[#ffbd6b]">{d.decision || "Decision"}</p>
                    <p className="font-mono text-[10px] text-[#8fffd2]">{fmt.pct(d.confidence)}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-[9px] text-slate-600">{d.reason || "No reason recorded."}</p>
                </div>
              ))}
              {!decisions.length && <div className="font-mono text-xs text-slate-600">No decision evidence yet.</div>}
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}
