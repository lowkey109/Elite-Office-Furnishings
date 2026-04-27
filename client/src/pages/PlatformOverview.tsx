import { Link } from "wouter";
import { Building2, CheckCircle2, Radar, ShieldAlert, TrendingUp, Zap } from "lucide-react";
import ConversionProductStrip from "@/components/ConversionProductStrip";

export default function PlatformOverview() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white">
      <section className="px-6 py-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">The Corporate Desk</p>
            <h1 className="text-5xl md:text-7xl font-bold mt-5 leading-[0.95]">
              The operating layer for workspace execution and intelligence.
            </h1>
            <p className="text-white/60 text-xl mt-6 max-w-3xl">
              Control office project cost, manage property opportunities, capture client enquiries and test AI market strategies with safe pretend-money simulation.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/client-signup">
                <span className="px-6 py-4 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Start Client Account</span>
              </Link>
              <Link href="/strategy-call">
                <span className="px-6 py-4 rounded-xl border border-white/15 text-white/80 cursor-pointer">Book Strategy Call</span>
              </Link>
              <Link href="/subscriptions">
                <span className="px-6 py-4 rounded-xl border border-white/15 text-white/80 cursor-pointer">View Pricing</span>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="grid gap-4">
              <Metric icon={<Building2 />} label="Workspace Control" value="Cost + execution visibility" />
              <Metric icon={<Radar />} label="LeaseHawk" value="Listings + property intelligence" />
              <Metric icon={<TrendingUp />} label="PhantomX" value="Free paper trading simulation" />
              <Metric icon={<ShieldAlert />} label="Compliance" value="Live trading disabled by default" />
            </div>
          </div>
        </div>
      </section>

      <ConversionProductStrip />

      <section className="px-6 py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8">
          <div>
            <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Why it matters</p>
            <h2 className="text-4xl font-bold mt-4">Built for real commercial outcomes.</h2>
          </div>
          <div className="grid gap-4">
            {[
              "Reduce cost overruns and project confusion.",
              "Turn property and relocation signals into actionable opportunities.",
              "Give customers a clean portal instead of scattered emails and spreadsheets.",
              "Keep PhantomX safe: paper mode first, compliance review before anything live.",
            ].map((item) => (
              <div key={item} className="flex gap-3 text-white/65">
                <CheckCircle2 className="text-amber-400 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center gap-3 text-amber-300">
        {icon}
        <p className="font-semibold">{label}</p>
      </div>
      <p className="text-white/55 mt-2">{value}</p>
    </div>
  );
}
