import { useQuery } from "@tanstack/react-query";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

function token() {
  return typeof window !== "undefined" ? window.sessionStorage.getItem("tcd_client_token") || "" : "";
}

async function fetchPlanAccess() {
  const res = await fetch("/api/client/plan-access", {
    headers: { authorization: "Bearer " + token() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function openBillingPortal() {
  const res = await fetch("/api/client/subscription/portal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token(),
    },
    body: JSON.stringify({
      returnUrl: window.location.origin + "/client/billing",
    }),
  });

  const json = await res.json();

  if (json.url) {
    window.location.href = json.url;
    return;
  }

  alert(json.message || json.error || "Billing portal is not configured yet.");
}

export default function ClientBilling() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/client/plan-access"],
    queryFn: fetchPlanAccess,
  });

  const user = data?.user;
  const access = data?.access;

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Billing</p>
        <h1 className="text-3xl font-bold mt-2">Subscription & Billing</h1>
        <p className="text-white/50 mt-2">Manage your plan, trial, Stripe billing and access level.</p>
      </div>

      {isLoading && <p className="text-white/40">Loading billing...</p>}

      <section className="grid md:grid-cols-3 gap-4">
        <Card title="Plan" value={user?.plan || "—"} />
        <Card title="Status" value={user?.subscriptionStatus || "—"} />
        <Card title="Trial Ends" value={user?.trialEndsAt?.slice?.(0, 10) || "—"} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div className="flex items-center gap-3 text-amber-300">
          <CreditCard />
          <h2 className="text-xl font-semibold">Stripe billing portal</h2>
        </div>
        <p className="text-white/55 text-sm">
          Use the billing portal to update payment details, view invoices, cancel or manage your subscription once Stripe is fully connected.
        </p>
        <button onClick={openBillingPortal} className="px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold inline-flex items-center gap-2">
          Open Billing Portal <ExternalLink className="w-4 h-4" />
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 text-amber-300">
          <ShieldCheck />
          <h2 className="text-xl font-semibold">Current access</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          {Object.entries(access?.features || {}).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className={value ? "text-emerald-300" : "text-white/35"}>{value ? "Enabled" : "Locked"}</p>
              <p className="text-white/40 text-xs">{key}</p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/subscriptions">
        <span className="inline-block px-5 py-3 rounded-xl border border-white/10 text-white/70 cursor-pointer">
          View Plans
        </span>
      </Link>
    </main>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-2xl font-bold">{String(value)}</p>
      <p className="text-white/40 text-sm">{title}</p>
    </div>
  );
}
