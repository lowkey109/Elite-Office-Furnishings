import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, UserRound, Building2 } from "lucide-react";

async function fetchCustomers() {
  const res = await fetch("/api/admin/customers", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminCustomers() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/customers"],
    queryFn: fetchCustomers,
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: any) => {
      const res = await fetch("/api/admin/customers/" + id + "/subscription", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-tcd-admin-auth": "true",
        },
        body: JSON.stringify(patch),
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.ok) setSelected(result.customer);
      refetch();
    },
  });

  const customers = (data?.customers || []).filter((c: any) =>
    [c.fullName, c.email, c.companyName, c.plan, c.subscriptionStatus].join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Admin</p>
          <h1 className="text-3xl font-bold mt-2">Customers</h1>
          <p className="text-white/45 mt-2">Manage client accounts, plans, trials, onboarding and access.</p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <section className="grid md:grid-cols-5 gap-4">
        <Card label="Total" value={data?.stats?.total || 0} />
        <Card label="Trialing" value={data?.stats?.trialing || 0} />
        <Card label="Active" value={data?.stats?.active || 0} />
        <Card label="Past Due" value={data?.stats?.pastDue || 0} />
        <Card label="Needs Onboarding" value={data?.stats?.onboardingIncomplete || 0} />
      </section>

      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-4 h-4 text-white/30" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers..."
          className="w-full rounded-xl bg-black/30 border border-white/10 pl-10 pr-4 py-3"
        />
      </div>

      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          {isLoading && <p className="p-5 text-white/40">Loading customers...</p>}
          {customers.map((customer: any) => (
            <button
              key={customer.id}
              onClick={() => setSelected(customer)}
              className="w-full text-left p-5 border-b border-white/10 hover:bg-white/[0.04] transition"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-semibold">{customer.companyName || customer.fullName}</p>
                  <p className="text-white/45 text-sm">{customer.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-300 text-sm">{customer.plan}</p>
                  <p className="text-white/35 text-xs">{customer.subscriptionStatus}</p>
                </div>
              </div>
            </button>
          ))}
          {!customers.length && !isLoading && <p className="p-5 text-white/40">No customers found.</p>}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {!selected ? (
            <div className="text-center py-12">
              <UserRound className="mx-auto text-white/30" />
              <p className="text-white/40 mt-3">Select a customer.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xl font-semibold">{selected.companyName || selected.fullName}</p>
                <p className="text-white/45 text-sm">{selected.email}</p>
                <p className="text-white/35 text-xs mt-1">Tenant: {selected.tenantId}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Mini label="Projects" value={selected.counts?.projects || 0} />
                <Mini label="Uploads" value={selected.counts?.uploads || 0} />
                <Mini label="Email verified" value={selected.emailVerified ? "Yes" : "No"} />
                <Mini label="Onboarding" value={selected.onboardingComplete ? "Done" : "Needed"} />
              </div>

              <label className="block">
                <span className="text-sm text-white/45">Plan</span>
                <select
                  value={selected.plan}
                  onChange={(e) => updateMutation.mutate({ id: selected.id, patch: { plan: e.target.value } })}
                  className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3"
                >
                  {["free", "starter", "growth", "leasehawk-pro", "leasehawk-plus", "enterprise", "phantomx-live-readiness"].map((plan) => (
                    <option key={plan} value={plan}>{plan}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-white/45">Subscription status</span>
                <select
                  value={selected.subscriptionStatus}
                  onChange={(e) => updateMutation.mutate({ id: selected.id, patch: { subscriptionStatus: e.target.value } })}
                  className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3"
                >
                  {["trialing", "active", "past_due", "cancelled", "incomplete", "paused", "manual_review"].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <button
                onClick={() => updateMutation.mutate({ id: selected.id, patch: { emailVerified: !selected.emailVerified } })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 text-white/70"
              >
                Toggle Email Verified
              </button>

              <button
                onClick={() => updateMutation.mutate({ id: selected.id, patch: { onboardingComplete: !selected.onboardingComplete } })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 text-white/70"
              >
                Toggle Onboarding Complete
              </button>
            </div>
          )}
        </div>
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

function Mini({ label, value }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="font-semibold">{value}</p>
      <p className="text-white/40 text-xs">{label}</p>
    </div>
  );
}
