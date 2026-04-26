import { Link } from "wouter";
import { Building2, Radar, Map, Lock, Sparkles, ArrowRight } from "lucide-react";

export default function PropertyIntelligence() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white">
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <p className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Property Intelligence Pro</p>
        <h1 className="text-4xl md:text-6xl font-bold mt-4 max-w-4xl">Find houses for sale, lease signals, office moves, builder stock and property opportunities before your competitors.</h1>
        <p className="text-white/55 mt-6 max-w-3xl text-lg">
          A subscription-ready property intelligence machine for builders, commercial agents, tenant reps, fitout companies, furniture suppliers and workspace consultants.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/client-login"><span className="px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Client Login</span></Link>\n          <Link href="/subscriptions"><span className="px-5 py-3 rounded-xl border border-amber-500/30 text-amber-300 cursor-pointer">View Plans</span></Link>
          <Link href="/client/property-intelligence"><span className="px-5 py-3 rounded-xl border border-white/15 cursor-pointer">View Client Portal</span></Link>
          <Link href="/start"><span className="px-5 py-3 rounded-xl border border-amber-500/30 text-amber-300 cursor-pointer">Request Demo</span></Link>
        </div>
      </section>

      <section className="px-6 pb-20 max-w-6xl mx-auto grid md:grid-cols-3 gap-4">
        <Feature icon={<Radar />} title="Office Move Radar" text="Track public signals that suggest relocations, new offices, expansions and fitout demand." />
        <Feature icon={<Map />} title="Market Map" text="Visualise opportunity clusters, lease-expiry zones and territory demand." />
        <Feature icon={<Building2 />} title="Builder Listing Machine" text="Manage builders, projects, listings, sales suites and workspace procurement opportunities." />
      </section>

      <section className="px-6 pb-24 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Subscription tiers</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["Free", "Sample insights, consultation and basic intake."],
            ["Starter", "1 city, limited opportunities, saved searches and monthly reports."],
            ["Growth", "Multiple cities, scoring, Market Map, Radar feed and outreach suggestions."],
            ["Enterprise", "National feed, territory scanner, exports, team access and strategy support."],
          ].map(([name, text]) => (
            <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xl font-semibold">{name}</p>
              <p className="text-white/45 text-sm mt-3 min-h-[70px]">{text}</p>
              <button className="mt-4 w-full rounded-xl border border-amber-500/30 text-amber-300 py-2 flex items-center justify-center gap-2">
                View Plan <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-white/35 text-sm mt-6 flex gap-2 items-center"><Lock className="w-4 h-4" /> Customer portal access is separate from private admin tools.</p>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-amber-400">{icon}</div>
      <h3 className="font-semibold text-xl mt-4">{title}</h3>
      <p className="text-white/45 mt-2">{text}</p>
    </div>
  );
}
