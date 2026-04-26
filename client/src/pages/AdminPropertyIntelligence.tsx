import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Radar, Map, Send, RefreshCw, TrendingUp, ShieldCheck } from "lucide-react";

async function fetchJson(path: string) {
  const res = await fetch(path, { headers: { "x-tcd-admin-auth": "true" } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminPropertyIntelligence() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/admin/property-intelligence"],
    queryFn: () => fetchJson("/api/admin/property-intelligence"),
  });

  const stats = data?.stats || {};
  const opportunities = data?.opportunities || [];

  return (
    <div className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Nexora Property Intelligence</p>
          <h1 className="text-3xl font-bold mt-2">Property Intelligence Pro</h1>
          <p className="text-white/50 mt-2 max-w-3xl">
            Builder listing automation, office move signals, lease intelligence, territory scanning and market-map opportunities in one subscription-ready engine.
          </p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {isLoading && <div className="text-white/50">Loading property intelligence...</div>}
      {error && <div className="text-red-300">Property Intelligence failed to load.</div>}

      <div className="grid md:grid-cols-4 gap-4">
        <Card icon={<Building2 />} label="Total Opportunities" value={stats.totalOpportunities ?? 0} />
        <Card icon={<TrendingUp />} label="High Score" value={stats.highScore ?? 0} />
        <Card icon={<Send />} label="Outreach Ready" value={stats.outreachReady ?? 0} />
        <Card icon={<Radar />} label="Office/Lease Signals" value={stats.officeMoveSignals ?? 0} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Top Property Opportunities</h2>
            <Link href="/market-map"><span className="text-amber-400 text-sm cursor-pointer">Open Market Map →</span></Link>
          </div>
          <div className="space-y-3">
            {opportunities.slice(0, 12).map((o: any) => (
              <div key={o.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-semibold">{o.companyName || o.projectName || o.propertyName || "Property opportunity"}</p>
                    <p className="text-white/45 text-sm">{o.city || "Unknown city"} · {o.signalType || "signal"} · {o.sourceName || "source"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold">{o.opportunityScore}/100</p>
                    <p className="text-white/30 text-xs">opp score</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge>Confidence {o.confidenceScore}</Badge>
                  <Badge>Urgency {o.urgencyScore}</Badge>
                  <Badge>{o.assignedTier || "starter"}</Badge>
                  <Badge>{o.status}</Badge>
                </div>
                <p className="text-white/45 text-sm mt-3">{o.nextBestAction}</p>
              </div>
            ))}
            {!opportunities.length && <p className="text-white/40">No property opportunities yet. Connect sources or run available scanners.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <h2 className="font-semibold text-lg">Builder Listing Machine</h2>
          <p className="text-white/45 text-sm">
            Add builders, developers, projects and listing campaigns. Generate listing summaries, brochure copy, outreach and push qualified opportunities into Radar.
          </p>
          <div className="space-y-3">
            <Mini icon={<ShieldCheck />} title="Real-data first" text="No fake listings. Missing sources show clear not-configured states." />
            <Mini icon={<Map />} title="Market Map connected" text="Uses existing /api/market-map opportunities and clusters." />
            <Mini icon={<Radar />} title="Radar-ready" text="Designed to push qualified opportunities into Office Move Radar." />
          </div>
          <Link href="/property-intelligence"><span className="block text-center rounded-xl border border-amber-500/30 text-amber-300 py-3 cursor-pointer">View Public Product Page</span></Link>
        </section>
      </div>
    </div>
  );
}

function Card({ icon, label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-amber-400 w-5 h-5">{icon}</div>
      <p className="text-2xl font-bold mt-4">{value}</p>
      <p className="text-white/40 text-sm">{label}</p>
    </div>
  );
}

function Badge({ children }: any) {
  return <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/55">{children}</span>;
}

function Mini({ icon, title, text }: any) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/10 p-3">
      <div className="flex gap-2 items-center text-amber-300 font-medium">{icon}<span>{title}</span></div>
      <p className="text-white/40 text-sm mt-1">{text}</p>
    </div>
  );
}
