import { Link } from "wouter";
import { AlertTriangle, BarChart3, ShieldAlert, TrendingUp, Wallet } from "lucide-react";

export default function PhantomXLanding() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white px-6 py-24">
      <div className="max-w-7xl mx-auto">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">PhantomX Paper Trader</p>
        <h1 className="text-5xl md:text-7xl font-bold mt-5 max-w-5xl leading-[0.95]">
          Free pretend-money AI trading simulation.
        </h1>
        <p className="text-white/60 text-xl mt-6 max-w-3xl">
          Test AI market strategies with pretend money. No real funds. No live exchange orders. No financial advice.
        </p>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex gap-3 mt-8 max-w-4xl">
          <ShieldAlert className="text-red-300 flex-shrink-0" />
          <p className="text-white/65 text-sm">
            PhantomX Paper Trader is free simulation only. Real-money trading is disabled by default and requires separate live-readiness review, legal/compliance checks, risk limits and written approval.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-4 mt-12">
          <Feature icon={<Wallet />} title="Pretend Balance" text="Use simulated balance and paper positions only." />
          <Feature icon={<TrendingUp />} title="Strategy Learning" text="Track paper decisions, ticks, outcomes and learning behaviour." />
          <Feature icon={<BarChart3 />} title="Market Dashboard" text="Monitor market data and strategy context without placing orders." />
          <Feature icon={<AlertTriangle />} title="Risk First" text="No profit guarantee, no financial advice and no live orders." />
        </div>

        <div className="flex flex-wrap gap-3 mt-10">
          <Link href="/client-signup"><span className="px-6 py-4 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Start Free Paper Mode</span></Link>
          <Link href="/client/phantomx-compliance"><span className="px-6 py-4 rounded-xl border border-white/15 text-white/80 cursor-pointer">Live Readiness Review</span></Link>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, title, text }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-amber-400">{icon}</div>
      <h2 className="text-xl font-semibold mt-5">{title}</h2>
      <p className="text-white/50 mt-3">{text}</p>
    </div>
  );
}
