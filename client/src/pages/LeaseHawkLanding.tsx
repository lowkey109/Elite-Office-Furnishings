import { Link } from "wouter";
import { Building2, FileSpreadsheet, Home, MessageSquare, Radar } from "lucide-react";

export default function LeaseHawkLanding() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white px-6 py-24">
      <div className="max-w-7xl mx-auto">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Nexora LeaseHawk</p>
        <h1 className="text-5xl md:text-7xl font-bold mt-5 max-w-5xl leading-[0.95]">
          Property listings and opportunity intelligence for business operators.
        </h1>
        <p className="text-white/60 text-xl mt-6 max-w-3xl">
          Show houses for sale, commercial leases, partner listings and customer enquiries without relying on paid property APIs first.
        </p>

        <div className="grid lg:grid-cols-4 gap-4 mt-12">
          <Feature icon={<Home />} title="For Sale + Lease" text="Display houses, units, land, offices, warehouses and commercial leases." />
          <Feature icon={<FileSpreadsheet />} title="CSV Import" text="Bulk import partner listings and detect duplicates before saving." />
          <Feature icon={<MessageSquare />} title="Enquiries" text="Customers can request intros, finance, inspections or save listings." />
          <Feature icon={<Radar />} title="Intelligence Layer" text="Connect listings to LeaseHawk territories, reports and opportunity signals." />
        </div>

        <div className="flex flex-wrap gap-3 mt-10">
          <Link href="/client-signup"><span className="px-6 py-4 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Start LeaseHawk</span></Link>
          <Link href="/subscriptions"><span className="px-6 py-4 rounded-xl border border-white/15 text-white/80 cursor-pointer">View Plans</span></Link>
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
