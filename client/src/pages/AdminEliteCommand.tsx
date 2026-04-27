import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CreditCard,
  Database,
  Home,
  Radar,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";

async function fetchEliteStatus() {
  const res = await fetch("/api/admin/elite/status", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminEliteCommand() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/elite/status"],
    queryFn: fetchEliteStatus,
    refetchInterval: 30000,
  });

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Nexora Elite OS</p>
          <h1 className="text-3xl font-bold mt-2">Executive Command</h1>
          <p className="text-white/45 mt-2">
            One control layer for customers, subscriptions, LeaseHawk, PhantomX, Stripe, compliance and deployment readiness.
          </p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold">
          Refresh
        </button>
      </div>

      {isLoading && <p className="text-white/40">Loading elite status...</p>}

      <section className="grid md:grid-cols-4 gap-4">
        <Card icon={<Users />} title="Customers" value={data?.counts?.customers ?? 0} />
        <Card icon={<CreditCard />} title="Trialing" value={data?.counts?.trialing ?? 0} />
        <Card icon={<Home />} title="Listings" value={data?.counts?.propertyListings ?? 0} />
        <Card icon={<ShieldAlert />} title="Compliance Apps" value={data?.counts?.phantomXApplications ?? 0} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Panel
          icon={<CreditCard />}
          title="Stripe Billing"
          status={data?.stripe?.ready ? "Ready" : "Needs setup"}
          tone={data?.stripe?.ready ? "ok" : "warning"}
          items={[
            "Secret key: " + (data?.stripe?.secretKey ? "set" : "missing"),
            "Starter price: " + (data?.stripe?.prices?.starter ? "set" : "missing"),
            "Growth price: " + (data?.stripe?.prices?.growth ? "set" : "missing"),
            "LeaseHawk Pro price: " + (data?.stripe?.prices?.leasehawkPro ? "set" : "missing"),
            "LeaseHawk Plus price: " + (data?.stripe?.prices?.leasehawkPlus ? "set" : "missing"),
            "PhantomX Pro price: " + (data?.stripe?.prices?.phantomxPro ? "set" : "missing"),
            "Webhook secret: " + (data?.stripe?.webhookSecret ? "set" : "missing"),
          ]}
        />

        <Panel
          icon={<Radar />}
          title="LeaseHawk"
          status="Commercialising"
          tone="ok"
          items={[
            "Manual listings active",
            "CSV import active",
            "Client enquiries active",
            "Partner listing path active",
            "Paid API optional later",
          ]}
        />

        <Panel
          icon={<ShieldAlert />}
          title="PhantomX"
          status="Compliance first"
          tone="ok"
          items={[
            "Paper trading free",
            "No financial advice",
            "No profit guarantee",
            "Live trading disabled",
            "Live-readiness application active",
          ]}
        />

        <Panel
          icon={<Database />}
          title="Production Data Layer"
          status="Do last"
          tone="warning"
          items={[
            "Move JSON runtime stores into Postgres last",
            "Add migrations and indexes",
            "Add tenant-safe data isolation",
            "Add backup/restore after schema is stable",
          ]}
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 text-amber-300">
          <Zap />
          <h2 className="text-xl font-semibold">Next Build Order</h2>
        </div>
        <ol className="mt-4 space-y-2 text-white/60 text-sm list-decimal list-inside">
          {(data?.nextBuildOrder || []).map((item: string) => <li key={item}>{item}</li>)}
        </ol>
      </section>
    </main>
  );
}

function Card({ icon, title, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-amber-400">{icon}</div>
      <p className="text-3xl font-bold mt-4">{value}</p>
      <p className="text-white/40 text-sm">{title}</p>
    </div>
  );
}

function Panel({ icon, title, status, tone, items }: any) {
  const color = tone === "ok" ? "text-emerald-300" : "text-amber-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-amber-400">{icon}</div>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <span className={`text-sm ${color}`}>{status}</span>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-white/55">
        {items.map((item: string) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
