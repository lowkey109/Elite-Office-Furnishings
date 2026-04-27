import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";

export default function TrustCentre() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white px-6 py-24">
      <div className="max-w-7xl mx-auto">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Trust Centre</p>
        <h1 className="text-5xl md:text-7xl font-bold mt-5 max-w-5xl leading-[0.95]">
          Clear boundaries for customers, billing, property data and PhantomX.
        </h1>
        <p className="text-white/60 text-xl mt-6 max-w-3xl">
          The platform is structured around client separation, plan access, legal acceptance and compliance-first trading controls.
        </p>

        <div className="grid lg:grid-cols-3 gap-4 mt-12">
          {[
            "Client accounts are separate from internal admin.",
            "LeaseHawk access is controlled by subscription plan.",
            "Property listing sources are labelled and verified progressively.",
            "Stripe billing uses price IDs and subscription state syncing.",
            "PhantomX Paper Trader is free pretend-money simulation.",
            "Live-money trading is disabled by default.",
            "No financial advice and no profit guarantee.",
            "Live-readiness requires private review.",
            "Production database migration is saved for the final hardening layer.",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex gap-3">
              <CheckCircle2 className="text-amber-400 flex-shrink-0" />
              <p className="text-white/60">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
