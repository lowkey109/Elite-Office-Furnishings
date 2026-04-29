import { Link } from "wouter";

export default function PhantomXLanding() {
  return (
    <main className="min-h-screen bg-[#020607] text-white p-6">
      <div className="max-w-6xl mx-auto rounded-2xl border border-[#d9913a33] bg-black/50 p-8">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-[#d9913a]">Phantom X // Polymarket Intelligence</p>
        <h1 className="mt-4 font-mono text-5xl font-black tracking-[-0.08em] text-[#ffbd6b]">Alpha Flow Terminal</h1>
        <p className="mt-5 max-w-3xl text-slate-400">
          Phantom X is now a Polymarket intelligence and paper-trading command layer. It tracks public market activity,
          opportunity scores, evidence logs and simulated paper-only decisions. Live-money trading is disabled.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/client/phantomx-paper">
            <span className="cursor-pointer rounded-xl border border-[#d9913a55] bg-[#d9913a18] px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-[#ffbd6b]">
              Open Customer Terminal
            </span>
          </Link>
          <Link href="/legal/phantomx-risk-disclaimer">
            <span className="cursor-pointer rounded-xl border border-slate-700 px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-slate-300">
              Risk Disclaimer
            </span>
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-red-400/25 bg-red-950/25 p-4 text-sm text-red-100">
          Paper mode only. No financial advice. No live-money execution.
        </div>
      </div>
    </main>
  );
}
