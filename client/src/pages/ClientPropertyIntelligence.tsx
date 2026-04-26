import { Link } from "wouter";
import { Lock, Map, Radar, Building2 } from "lucide-react";

export default function ClientPropertyIntelligence() {
  const authed = typeof window !== "undefined" && window.sessionStorage.getItem("tcd_client_auth") === "true";

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#080A12] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Lock className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold mt-4">Client login required</h1>
          <p className="text-white/45 mt-3">Property Intelligence Pro is a customer subscription module. Please log in to your client portal.</p>
          <Link href="/client-login"><span className="inline-block mt-6 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Client Login</span></Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Client Portal</p>
        <h1 className="text-3xl font-bold mt-2">Property Intelligence Pro</h1>
        <p className="text-white/50 mt-2">Customer-safe opportunity intelligence. Internal admin controls are hidden.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card icon={<Map />} title="Market Opportunity Map" text="View subscription-safe territory and market signals." />
        <Card icon={<Radar />} title="Office Move Radar Feed" text="See qualified public signals relevant to your plan." />
        <Card icon={<Building2 />} title="Saved Territories" text="Track cities, suburbs, builders or commercial zones." />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-semibold text-xl">Upgrade to unlock more</h2>
        <p className="text-white/45 mt-2">Growth and Enterprise plans unlock more cities, more opportunity history, export tools, outreach suggestions and team access.</p>
      </div>
    </main>
  );
}

function Card({ icon, title, text }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-amber-400">{icon}</div>
      <h2 className="font-semibold text-lg mt-4">{title}</h2>
      <p className="text-white/45 text-sm mt-2">{text}</p>
    </div>
  );
}
