import { Link } from "wouter";
import { Building2, Radar, ShieldCheck, TrendingUp } from "lucide-react";

export default function ConversionProductStrip() {
  return (
    <section className="bg-[#080A12] text-white py-20 px-6 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl">
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">The Corporate Desk Platform</p>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 leading-tight">
            One platform for workspace projects, property intelligence and safe AI trading simulation.
          </h2>
          <p className="text-white/55 mt-5 text-lg">
            The Corporate Desk is moving beyond furniture supply into an execution, intelligence and finance-control layer for business operators.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-12">
          <Product
            icon={<Building2 />}
            title="Workspace Project Control"
            text="Control office fitouts, relocations, procurement, cost movement, suppliers and project decisions from one operating layer."
            href="/workspace-control"
            cta="Explore Workspace Control"
          />
          <Product
            icon={<Radar />}
            title="Nexora LeaseHawk"
            text="Find and manage property opportunities, listings, leases, customer enquiries, CSV imports and partner-submitted opportunities."
            href="/leasehawk"
            cta="Explore LeaseHawk"
          />
          <Product
            icon={<TrendingUp />}
            title="PhantomX Paper Trader"
            text="Free pretend-money AI trading simulator for testing strategies safely. No live funds. No exchange orders. No financial advice."
            href="/phantomx"
            cta="Explore PhantomX"
          />
        </div>

        <div className="mt-10 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-3">
          <ShieldCheck className="text-amber-300 flex-shrink-0" />
          <div>
            <p className="font-semibold">Built with controlled access and compliance boundaries.</p>
            <p className="text-white/55 text-sm mt-1">
              Client accounts, subscription plans, LeaseHawk access gates and PhantomX live-readiness review keep the platform structured before production release.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Product({ icon, title, text, href, cta }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] transition">
      <div className="text-amber-400">{icon}</div>
      <h3 className="text-2xl font-semibold mt-5">{title}</h3>
      <p className="text-white/50 mt-3 min-h-[96px]">{text}</p>
      <Link href={href}>
        <span className="inline-block mt-6 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">
          {cta}
        </span>
      </Link>
    </div>
  );
}
