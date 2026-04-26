import { Link } from "wouter";
import { FileText, Map, CreditCard, Upload, PackageSearch, Building2, Headphones, TrendingUp } from "lucide-react";

export default function ClientDashboard() {
  const company = typeof window !== "undefined" ? sessionStorage.getItem("tcd_client_company") || "Your company" : "Your company";
  const tier = typeof window !== "undefined" ? sessionStorage.getItem("tcd_client_tier") || "Free" : "Free";

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Client Portal</p>
        <h1 className="text-3xl font-bold mt-2">{company}</h1>
        <p className="text-white/45 mt-2">Plan: {tier}. Your private client workspace is separate from internal admin.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card icon={<Building2 />} title="Project Overview" text="No active project yet — create your first workspace project." />
        <Card icon={<FileText />} title="Quotes" text="No quotes yet — request your first quote." />
        <Card icon={<Upload />} title="Floor Plans" text="No floor plans uploaded — upload a floor plan." />
        <Card icon={<PackageSearch />} title="Procurement" text="Submit product or supplier comparison requests." />
        <Card icon={<CreditCard />} title="Finance Options" text="Explore ways to reduce large upfront costs." />
        <Link href="/client/property-intelligence"><span><Card icon={<Map />} title="LeaseHawk" text="View subscription-safe property intelligence." /></span></Link>
        <Link href="/client/property-listings"><span><Card icon={<Building2 />} title="Property Listings" text="View houses for sale, leases and partner listings." /></span></Link>
        <Link href="/subscriptions"><span><Card icon={<TrendingUp />} title="Subscription" text="Manage plans, trials and add-ons." /></span></Link>
        <Card icon={<Headphones />} title="Support" text="Book a workspace strategy call." />
      </div>
    </main>
  );
}

function Card({ icon, title, text }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-amber-500/30 transition">
      <div className="text-amber-400">{icon}</div>
      <h2 className="font-semibold text-lg mt-4">{title}</h2>
      <p className="text-white/45 text-sm mt-2">{text}</p>
    </div>
  );
}
