import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldAlert, RefreshCw } from "lucide-react";

async function fetchApplications() {
  const res = await fetch("/api/admin/phantomx/applications", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminPhantomXCompliance() {
  const { data, refetch } = useQuery({
    queryKey: ["/api/admin/phantomx/applications"],
    queryFn: fetchApplications,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch("/api/admin/phantomx/applications/" + id, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-tcd-admin-auth": "true",
        },
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const applications = data?.applications || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">PhantomX Admin</p>
          <h1 className="text-3xl font-bold mt-2">Compliance Review</h1>
          <p className="text-white/45 mt-2">Review live-readiness applications. This does not enable real-money trading.</p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex gap-3">
        <ShieldAlert className="text-red-300 flex-shrink-0" />
        <p className="text-white/60 text-sm">
          Approval here means readiness review only. Do not enable live trading without separate legal, compliance, exchange API and risk controls.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card label="Total" value={data?.stats?.total || 0} />
        <Card label="Submitted" value={data?.stats?.submitted || 0} />
        <Card label="Reviewing" value={data?.stats?.reviewing || 0} />
        <Card label="Readiness Approved" value={data?.stats?.approvedForReadinessOnly || 0} />
      </div>

      <section className="grid lg:grid-cols-2 gap-4">
        {applications.map((app: any) => (
          <div key={app.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-semibold">{app.clientCompanyName || app.clientEmail}</p>
            <p className="text-white/45 text-sm">{app.clientEmail}</p>
            <p className="text-amber-300 mt-3">{app.status}</p>
            <p className="text-white/50 text-sm mt-3">{app.tradingExperience || "No experience description."}</p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-white/45">
              <span>Exchange: {app.preferredExchange || "—"}</span>
              <span>Daily limit: {app.maxDailyLossLimit || "—"}</span>
              <span>Monthly limit: {app.maxMonthlyLossLimit || "—"}</span>
              <span>Mode: {app.requestedMode}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["reviewing", "more_info_required", "approved_for_readiness_only", "declined", "closed"].map((status) => (
                <button
                  key={status}
                  onClick={() => updateMutation.mutate({ id: app.id, status })}
                  className={`px-3 py-2 rounded-xl text-xs border ${app.status === status ? "bg-amber-500 text-black border-amber-500" : "border-white/10 text-white/55"}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {!applications.length && <p className="text-white/40">No PhantomX applications yet.</p>}
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
