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

function ShellPanel({
  label,
  title,
  children,
  className = "",
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-[10px] border border-[#d9913a26] bg-[#061014]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.42)] ${className}`}>
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,181,89,0.035),transparent_35%),radial-gradient(circle_at_50%_0%,rgba(255,181,89,0.055),transparent_45%)]" />
      <div className="relative flex h-8 items-center justify-between border-b border-[#d9913a1a] px-3">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#c98738]">// {label}</p>
        {title && <p className="font-mono text-[10px] text-slate-600">{title}</p>}
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

function MicroBars({ count = 8, values }: { count?: number; values?: number[] }) {
  const bars = values?.length ? values : Array.from({ length: count }, (_, i) => 92 - i * 8);
  return (
    <div className="space-y-[7px]">
      {bars.slice(0, count).map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-7 font-mono text-[9px] text-slate-700">{String(i + 1).padStart(2, "0")}</span>
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#132126]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7a3d16] via-[#ce7e2c] to-[#ffd28d]"
              style={{ width: `${Math.max(4, Math.min(100, Number(v || 0)))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatGrid() {
  return (
    <div className="grid grid-cols-9 gap-[3px]">
      {Array.from({ length: 72 }, (_, i) => {
        const o = 0.08 + ((i * 17) % 90) / 100;
        return <div key={i} className="h-4 rounded-[2px]" style={{ background: `rgba(255, 176, 90, ${o})` }} />;
      })}
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

export default function AdminPhantomXIntelligence() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/phantomx/intelligence", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Unable to load Phantom X feed");
    }
  }

  async function scan() {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/phantomx/scan-polymarket", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, []);

  const curve = useMemo(() => {
    const trades = data?.paperTrades || [];
    if (!trades.length) return [9, 11, 13, 19, 23, 29, 31, 43, 48, 57, 62, 74, 87, 94];
    let v = 12;
    return trades.slice(0, 16).map((t) => {
      v += Math.max(-7, Math.min(14, Number(t.pnl || 0) / 100));
      return Math.max(5, Math.min(96, v));
    });
  }, [data]);

  const marketBars = useMemo(() => {
    const markets = data?.markets || [];
    return markets.slice(0, 9).map((m) => Math.min(100, Math.log10(Number(m.volume || 0) + 10) * 23));
  }, [data]);

  const topMarkets = data?.markets || [];
  const topWallets = data?.wallets || [];
  const opps = data?.opportunities || [];
  const paper = data?.paperTrades || [];
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
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.42em] text-[#c98738]">POLYMARKET // PHANTOM X // COMMAND</p>
                <h1 className="mt-1 font-mono text-[34px] font-black tracking-[-0.12em] text-[#ffbd6b]">ALPHA FLOW TERMINAL</h1>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <span className="h-2 w-2 rounded-full bg-[#8fffd2] shadow-[0_0_15px_rgba(143,255,210,.9)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8fffd2]">paper/live-data</span>
              </div>
            </div>
          </div>

          <div className="col-span-12 grid grid-cols-2 gap-3 xl:col-span-5 md:grid-cols-5">
            <Stat label="Markets" value={fmt.num(data?.stats.markets)} />
            <Stat label="Wallets" value={fmt.num(data?.stats.wallets)} />
            <Stat label="Signals" value={fmt.num(data?.stats.opportunities)} green />
            <Stat label="Volume" value={fmt.money(data?.stats.totalVolume)} />
            <button
              onClick={scan}
              disabled={scanning}
              className="rounded-md border border-[#d9913a45] bg-[#d9913a18] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#ffbd6b] hover:bg-[#d9913a25] disabled:opacity-50"
            >
              {scanning ? "Scanning" : "Scan"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-3 rounded-md border border-red-400/30 bg-red-950/35 p-3 font-mono text-xs text-red-200">
            {error}
          </div>
        )}

        {data?.errors?.length ? (
          <div className="mb-3 rounded-md border border-orange-400/30 bg-orange-950/25 p-3 font-mono text-xs text-orange-200">
            {data.errors.map((e) => <div key={e}>⚠ {e}</div>)}
          </div>
        ) : null}

        <section className="grid grid-cols-12 gap-3">
          <ShellPanel label="Asset Resonance" className="col-span-12 xl:col-span-3">
            <MicroBars values={topWallets.length ? topWallets.map((w) => Number(w.score || 0)) : [93, 84, 78, 71, 65, 54, 47, 39]} />
          </ShellPanel>

          <ShellPanel label="Profit Vector" title="equity / signal strength" className="col-span-12 xl:col-span-6">
            <div className="h-[315px]">
              <svg viewBox="0 0 820 330" className="h-full w-full">
                <defs>
                  <linearGradient id="pxLine" x1="0" x2="1">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="45%" stopColor="#d9913a" />
                    <stop offset="100%" stopColor="#8fffd2" />
                  </linearGradient>
                  <filter id="pxGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {Array.from({ length: 7 }, (_, i) => (
                  <line key={`h-${i}`} x1="0" x2="820" y1={30 + i * 44} y2={30 + i * 44} stroke="rgba(148,163,184,.08)" />
                ))}
                {Array.from({ length: 10 }, (_, i) => (
                  <line key={`v-${i}`} y1="0" y2="330" x1={30 + i * 82} x2={30 + i * 82} stroke="rgba(148,163,184,.045)" />
                ))}

                <polyline
                  fill="none"
                  stroke="url(#pxLine)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#pxGlow)"
                  points={curve.map((v, i) => `${25 + (i / Math.max(1, curve.length - 1)) * 770},${310 - Number(v) * 2.85}`).join(" ")}
                />
              </svg>
            </div>
          </ShellPanel>

          <ShellPanel label="System Core" className="col-span-12 xl:col-span-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Mode" value="PAPER" green />
              <Stat label="Live $" value="OFF" red />
              <Stat label="Auto" value="LOCK" red />
              <Stat label="Evidence" value="ON" green />
            </div>
            <div className="mt-3">
              <Status label="Execution rail" value="disabled" bad />
              <Status label="Wallet copy" value="watch only" />
              <Status label="Market feed" value={topMarkets.length ? "active" : "empty"} good={!!topMarkets.length} />
              <Status label="Last sync" value={data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "—"} />
            </div>
          </ShellPanel>

          <ShellPanel label="Wallet Matrix" className="col-span-12 xl:col-span-3">
            <div className="space-y-2">
              {topWallets.slice(0, 8).map((w) => (
                <div key={w.address} className="grid grid-cols-[1fr_60px] gap-2 border-b border-slate-900 pb-2 font-mono text-[10px]">
                  <div className="truncate text-slate-300">{w.label || w.address}</div>
                  <div className="text-right text-[#8fffd2]">{fmt.num(w.score)}</div>
                </div>
              ))}
              {!topWallets.length && <div className="font-mono text-xs text-slate-600">Wallet intelligence ingestion ready. Add watched wallet addresses next.</div>}
            </div>
          </ShellPanel>

          <ShellPanel label="Market Array" className="col-span-12 xl:col-span-6">
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
              {!topMarkets.length && <div className="font-mono text-xs text-slate-600">Click Scan to load real Polymarket market data.</div>}
            </div>
          </ShellPanel>

          <ShellPanel label="Signal Density" className="col-span-12 xl:col-span-3">
            <MicroBars values={marketBars.length ? marketBars : [72, 64, 58, 51, 44, 37, 28, 21]} />
            <div className="mt-4">
              <HeatGrid />
            </div>
          </ShellPanel>

          <ShellPanel label="Opportunity Stack" className="col-span-12 xl:col-span-4">
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
              {!opps.length && <div className="font-mono text-xs text-slate-600">No scored opportunities yet.</div>}
            </div>
          </ShellPanel>

          <ShellPanel label="Paper Ledger" className="col-span-12 xl:col-span-4">
            <div className="space-y-2">
              {paper.slice(0, 8).map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr_50px_70px] gap-2 border-b border-slate-900 pb-2 font-mono text-[10px]">
                  <div className="truncate text-slate-300">{t.market_title || t.marketTitle || t.market_id}</div>
                  <div className="text-[#ffbd6b]">{t.side || "WATCH"}</div>
                  <div className={Number(t.pnl || 0) >= 0 ? "text-right text-[#8fffd2]" : "text-right text-red-300"}>{fmt.money(t.pnl)}</div>
                </div>
              ))}
              {!paper.length && <div className="font-mono text-xs text-slate-600">No paper trades logged yet.</div>}
            </div>
          </ShellPanel>

          <ShellPanel label="Decision Stream" className="col-span-12 xl:col-span-4">
            <div className="space-y-2">
              {decisions.slice(0, 8).map((d) => (
                <div key={d.id} className="rounded-md border border-slate-900 bg-black/24 p-2">
                  <div className="flex justify-between gap-3">
                    <p className="font-mono text-[10px] font-bold uppercase text-[#ffbd6b]">{d.decision || "Decision"}</p>
                    <p className="font-mono text-[10px] text-[#8fffd2]">{fmt.pct(d.confidence)}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-[9px] text-slate-600">{d.reason || "No decision reason recorded."}</p>
                </div>
              ))}
              {!decisions.length && <div className="font-mono text-xs text-slate-600">Decision evidence will appear here.</div>}
            </div>
          </ShellPanel>
        </section>
      </main>
    </div>
  );
}
