import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, RefreshCw, UploadCloud } from "lucide-react";

async function fetchDataLayerStatus() {
  const res = await fetch("/api/admin/data-layer/status", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminDataLayer() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/data-layer/status"],
    queryFn: fetchDataLayerStatus,
    refetchInterval: 30000,
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/data-layer/migrate-local-json", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tcd-admin-auth": "true",
        },
        body: JSON.stringify({}),
      });
      return res.json();
    },
    onSuccess: (json) => {
      alert(json.ok ? `Migrated ${json.migrated || 0} stores into Postgres.` : json.error || "Migration failed");
      refetch();
    },
  });

  const stores = data?.stores || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Production Data Layer</p>
          <h1 className="text-3xl font-bold mt-2">Postgres Runtime Stores</h1>
          <p className="text-white/50 mt-2">
            Move Nexora runtime data out of local JSON files and into durable Postgres storage.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 text-white/70 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => migrateMutation.mutate()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
            <UploadCloud className="w-4 h-4" /> Migrate Local JSON
          </button>
        </div>
      </div>

      {isLoading && <p className="text-white/40">Loading data layer status...</p>}

      <section className="grid md:grid-cols-4 gap-4">
        <Card label="DATABASE_URL" value={data?.databaseUrlConfigured ? "Set" : "Missing"} tone={data?.databaseUrlConfigured ? "ok" : "bad"} />
        <Card label="Connected" value={data?.connected ? "Yes" : "No"} tone={data?.connected ? "ok" : "bad"} />
        <Card label="Table Ready" value={data?.tableReady ? "Yes" : "No"} tone={data?.tableReady ? "ok" : "bad"} />
        <Card label="Stores" value={stores.length} />
      </section>

      {data?.error && (
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-red-300 font-semibold">Data layer error</p>
          <p className="text-white/60 text-sm mt-2">{data.error}</p>
        </section>
      )}

      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-center gap-3 text-amber-300">
          <Database />
          <h2 className="text-xl font-semibold">Safe migration mode</h2>
        </div>
        <p className="text-white/60 text-sm mt-3">
          This copies local .nexora-data JSON files into Postgres. It does not delete local files. Full service cutover happens after this migration is verified.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-xl font-semibold">Runtime Stores</h2>
          <p className="text-white/40 text-sm mt-1">Latest stores copied or written into Postgres.</p>
        </div>

        {stores.map((store: any) => (
          <div key={store.store_key} className="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <p className="font-semibold">{store.store_key}</p>
              <p className="text-white/35 text-xs">{store.data_type || "json"} · {store.size_bytes || 0} bytes</p>
            </div>
            <p className="text-white/35 text-xs">{store.updated_at}</p>
          </div>
        ))}

        {!stores.length && !isLoading && <p className="p-5 text-white/40">No Postgres runtime stores found yet.</p>}
      </section>
    </main>
  );
}

function Card({ label, value, tone }: any) {
  const cls = tone === "ok" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className={`text-2xl font-bold ${cls}`}>{String(value)}</p>
      <p className="text-white/40 text-sm">{label}</p>
    </div>
  );
}
