import { useQuery } from "@tanstack/react-query";
import { CreditCard, RefreshCw } from "lucide-react";

async function fetchSubscriptions() {
  const res = await fetch("/api/admin/subscriptions", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminSubscriptions() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/subscriptions"],
    queryFn: fetchSubscriptions,
    refetchInterval: 30000,
  });

  const subscriptions = data?.subscriptions || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Billing</p>
          <h1 className="text-3xl font-bold mt-2">Subscriptions</h1>
          <p className="text-white/45 mt-2">Stripe readiness, plan status, trials and billing configuration.</p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <section className="grid md:grid-cols-4 gap-4">
        <Card label="Total Customers" value={data?.stats?.total || 0} />
        <Card label="Trialing" value={data?.stats?.trialing || 0} />
        <Card label="Active" value={data?.stats?.active || 0} />
        <Card label="Past Due" value={data?.stats?.pastDue || 0} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 text-amber-300">
          <CreditCard />
          <h2 className="text-xl font-semibold">Stripe Configuration</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <Check label="Secret Key" value={data?.stripe?.secretKey} />
          <Check label="Webhook Secret" value={data?.stripe?.webhookSecret} />
          <Check label="Starter Price" value={data?.stripe?.prices?.starter} />
          <Check label="Growth Price" value={data?.stripe?.prices?.growth} />
          <Check label="LeaseHawk Pro Price" value={data?.stripe?.prices?.leasehawkPro} />
          <Check label="LeaseHawk Plus Price" value={data?.stripe?.prices?.leasehawkPlus} />
          <Check label="PhantomX Pro Price" value={data?.stripe?.prices?.phantomxPro} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {isLoading && <p className="p-5 text-white/40">Loading subscriptions...</p>}
        {subscriptions.map((sub: any) => (
          <div key={sub.id} className="p-5 border-b border-white/10">
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-semibold">{sub.companyName || sub.email}</p>
                <p className="text-white/45 text-sm">{sub.email}</p>
                <p className="text-white/30 text-xs mt-1">{sub.stripeCustomerId || "No Stripe customer yet"}</p>
              </div>
              <div className="text-right">
                <p className="text-amber-300">{sub.plan}</p>
                <p className="text-white/45 text-sm">{sub.subscriptionStatus}</p>
                <p className="text-white/30 text-xs">{sub.trialEndsAt ? "Trial ends " + sub.trialEndsAt.slice(0, 10) : "No trial date"}</p>
              </div>
            </div>
          </div>
        ))}
        {!subscriptions.length && !isLoading && <p className="p-5 text-white/40">No subscriptions yet.</p>}
      </section>
    </main>
  );
}

function Card({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-white/40 text-sm">{label}</p>
    </div>
  );
}

function Check({ label, value }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className={value ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>
        {value ? "Configured" : "Missing"}
      </p>
      <p className="text-white/40 text-xs">{label}</p>
    </div>
  );
}
