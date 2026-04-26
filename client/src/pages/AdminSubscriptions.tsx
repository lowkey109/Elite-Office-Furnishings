import { subscriptionPlans, tradingAddOns } from "@/data/subscriptionPlans";
import { CreditCard, ShieldAlert } from "lucide-react";

export default function AdminSubscriptions() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Billing Admin</p>
        <h1 className="text-3xl font-bold mt-2">Subscriptions</h1>
        <p className="text-white/45 mt-2">Stripe-ready plan configuration. Checkout remains disabled until Stripe secrets and price IDs are configured.</p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-3">
        <ShieldAlert className="text-amber-300" />
        <p className="text-white/60 text-sm">Configure STRIPE_SECRET_KEY and plan price IDs before taking payments. All PhantomX plans must remain paper-only unless separately approved.</p>
      </div>

      <section className="grid md:grid-cols-3 gap-4">
        {[...subscriptionPlans, ...tradingAddOns].map(plan => (
          <div key={plan.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <CreditCard className="text-amber-400" />
            <h2 className="text-xl font-bold mt-4">{plan.name}</h2>
            <p className="text-3xl font-bold mt-2">{plan.price}</p>
            <p className="text-amber-300 text-sm">{plan.trial}</p>
            <p className="text-white/40 text-sm mt-3">{plan.description}</p>
            <code className="block mt-4 text-xs text-white/35">Plan ID: {plan.id}</code>
          </div>
        ))}
      </section>
    </main>
  );
}
