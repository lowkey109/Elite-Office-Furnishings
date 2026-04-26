import { Link } from "wouter";
import { Check, ShieldAlert } from "lucide-react";
import { subscriptionPlans, tradingAddOns, addOns } from "@/data/subscriptionPlans";

export default function Subscriptions() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white">
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <p className="text-amber-400 text-xs uppercase tracking-[0.3em] font-semibold">Subscriptions</p>
        <h1 className="text-4xl md:text-6xl font-bold mt-4">Choose the tools you need.</h1>
        <p className="text-white/55 mt-5 max-w-3xl text-lg">
          Manage workspace projects, request quotes, upload floor plans, compare furniture options, explore finance, unlock Nexora LeaseHawk, or add PhantomX paper trading.
        </p>
        <p className="text-amber-300 mt-4 font-semibold">14-day free trial on Starter, Growth, LeaseHawk and PhantomX paper plans. No lock-in.</p>\n        <p className="text-white/40 mt-3 text-sm">By subscribing, customers must accept our <a className="text-amber-300 underline" href="/legal/terms">Terms</a>, <a className="text-amber-300 underline" href="/legal/privacy">Privacy Notice</a>, <a className="text-amber-300 underline" href="/legal/subscription-terms">Subscription Terms</a> and, where applicable, the <a className="text-amber-300 underline" href="/legal/phantomx-risk-disclaimer">PhantomX Risk Disclaimer</a>.</p>
      </section>

      <section className="px-6 max-w-7xl mx-auto pb-14">
        <h2 className="text-2xl font-bold mb-5">Main plans</h2>
        <div className="grid lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {subscriptionPlans.map(plan => <Plan key={plan.id} plan={plan} />)}
        </div>
      </section>

      <section className="px-6 max-w-7xl mx-auto pb-14">
        <h2 className="text-2xl font-bold mb-5">AI trading add-ons</h2>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 mb-5 flex gap-3 text-sm text-red-100">
          <ShieldAlert className="w-5 h-5 text-red-300 flex-shrink-0" />
          <p>PhantomX subscriptions are paper trading and market intelligence only. Live-money trading is disabled by default and requires a separate private readiness review.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {tradingAddOns.map(plan => <Plan key={plan.id} plan={plan} />)}
        </div>
      </section>

      <section className="px-6 max-w-7xl mx-auto pb-24">
        <h2 className="text-2xl font-bold mb-5">Add-ons</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {addOns.map(a => (
            <div key={a.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex justify-between">
              <span>{a.name}</span>
              <span className="text-amber-300">{a.price}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Plan({ plan }: any) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col ${plan.featured ? "border-amber-500/60 bg-amber-500/10" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-xl font-bold">{plan.name}</p>
      <p className="text-3xl font-bold mt-3">{plan.price}</p>
      <p className="text-amber-300 text-sm mt-1">{plan.trial}</p>
      <p className="text-white/45 text-sm mt-4 min-h-[78px]">{plan.description}</p>
      <p className="text-white/35 text-xs mt-2">Best for: {plan.bestFor}</p>
      <ul className="mt-5 space-y-2 flex-1">
        {plan.features.map((f: string) => (
          <li key={f} className="flex gap-2 text-sm text-white/65"><Check className="w-4 h-4 text-amber-400 flex-shrink-0" />{f}</li>
        ))}
      </ul>
      <Link href={plan.id === "enterprise" ? "/start" : "/client-signup"}>
        <span className="block text-center mt-6 rounded-xl bg-amber-500 text-black font-semibold py-3 cursor-pointer">{plan.cta}</span>
      </Link>
    </div>
  );
}
