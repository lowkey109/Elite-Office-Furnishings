import { useQuery } from "@tanstack/react-query";
import { Users, Building2, CreditCard, Upload } from "lucide-react";

async function fetchAdminClients() {
  const res = await fetch("/api/admin/clients", { headers: { "x-tcd-admin-auth": "true" } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminCustomers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/clients"],
    queryFn: fetchAdminClients,
  });

  const users = data?.users || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Client SaaS Admin</p>
        <h1 className="text-3xl font-bold mt-2">Customers</h1>
        <p className="text-white/45 mt-2">Manage client accounts, plans, trials and tenant data.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card icon={<Users />} label="Clients" value={data?.stats?.users ?? 0} />
        <Card icon={<Building2 />} label="Projects" value={data?.stats?.projects ?? 0} />
        <Card icon={<CreditCard />} label="Trialing" value={data?.stats?.trialing ?? 0} />
        <Card icon={<Upload />} label="Uploads" value={data?.stats?.uploads ?? 0} />
      </div>

      {isLoading && <p className="text-white/40">Loading clients...</p>}
      {error && <p className="text-red-300">Could not load clients.</p>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="grid grid-cols-6 gap-3 text-xs uppercase tracking-wider text-white/35 border-b border-white/10 p-4">
          <span>Company</span><span>Email</span><span>Plan</span><span>Status</span><span>Trial Ends</span><span>Tenant</span>
        </div>
        {users.map((u: any) => (
          <div key={u.id} className="grid grid-cols-6 gap-3 text-sm border-b border-white/5 p-4">
            <span className="font-medium">{u.companyName}</span>
            <span className="text-white/55">{u.email}</span>
            <span className="text-amber-300">{u.plan}</span>
            <span>{u.subscriptionStatus}</span>
            <span className="text-white/45">{u.trialEndsAt?.slice?.(0, 10)}</span>
            <span className="text-white/25 truncate">{u.tenantId}</span>
          </div>
        ))}
        {!users.length && <p className="p-6 text-white/40">No customers yet.</p>}
      </section>
    </main>
  );
}

function Card({ icon, label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-amber-400">{icon}</div>
      <p className="text-2xl font-bold mt-4">{value}</p>
      <p className="text-white/40 text-sm">{label}</p>
    </div>
  );
}
