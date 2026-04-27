import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

async function fetchReadiness() {
  const res = await fetch("/api/admin/autonomy-readiness", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminAutonomyReadiness() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/autonomy-readiness"],
    queryFn: fetchReadiness,
    refetchInterval: 30000,
  });

  const checks = data?.checks || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Nexora Autonomy</p>
          <h1 className="text-3xl font-bold mt-2">Autonomy Readiness</h1>
          <p className="text-white/50 mt-2">
            Red/yellow/green safety board before allowing the platform to find leads, send outreach and push pipeline automatically.
          </p>
        </div>

        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {isLoading && <p className="text-white/40">Loading readiness...</p>}

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <StatusIcon status={data?.overall} large />
            <div>
              <p className="text-2xl font-bold">Overall: {String(data?.overall || "loading").toUpperCase()}</p>
              <p className="text-white/45 mt-1">{data?.nextMilestone || "Checking system..."}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 min-w-[280px]">
            <Counter label="Green" value={data?.counts?.green || 0} tone="green" />
            <Counter label="Yellow" value={data?.counts?.yellow || 0} tone="yellow" />
            <Counter label="Red" value={data?.counts?.red || 0} tone="red" />
          </div>
        </div>
      </section>

      {!data?.readyForFullAutonomy && (
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex gap-3">
          <AlertTriangle className="text-red-300 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-200">Do not enable full automatic outreach yet.</p>
            <p className="text-white/55 text-sm mt-1">
              Full autonomy should only be enabled when every item is green and an internal-only test lead has passed the complete loop.
            </p>
          </div>
        </section>
      )}

      {data?.readyForFullAutonomy && (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex gap-3">
          <ShieldCheck className="text-emerald-300 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-200">Ready for controlled certification.</p>
            <p className="text-white/55 text-sm mt-1">
              Run one internal-only end-to-end loop before any real customer/prospect outreach.
            </p>
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        {checks.map((check: any) => (
          <div key={check.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start gap-3">
              <StatusIcon status={check.status} />
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <h2 className="text-lg font-semibold">{check.label}</h2>
                  <span className={badgeClass(check.status)}>{String(check.status).toUpperCase()}</span>
                </div>

                <p className="text-white/55 text-sm mt-3">{check.summary}</p>

                {check.nextAction && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-amber-300 text-xs uppercase tracking-[0.18em]">Next action</p>
                    <p className="text-white/65 text-sm mt-1">{check.nextAction}</p>
                  </div>
                )}

                {check.evidence && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-white/40 text-sm">Evidence</summary>
                    <pre className="mt-3 rounded-xl bg-black/30 border border-white/10 p-3 text-xs text-white/55 overflow-auto max-h-64">
                      {JSON.stringify(check.evidence, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Counter({ label, value, tone }: any) {
  const cls = tone === "green" ? "text-emerald-300" : tone === "yellow" ? "text-amber-300" : "text-red-300";
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-white/35 text-xs">{label}</p>
    </div>
  );
}

function StatusIcon({ status, large = false }: any) {
  const size = large ? "w-10 h-10" : "w-6 h-6";
  if (status === "green") return <CheckCircle2 className={`${size} text-emerald-300 flex-shrink-0`} />;
  if (status === "yellow") return <AlertTriangle className={`${size} text-amber-300 flex-shrink-0`} />;
  if (status === "red") return <XCircle className={`${size} text-red-300 flex-shrink-0`} />;
  return <Circle className={`${size} text-white/30 flex-shrink-0`} />;
}

function badgeClass(status: string) {
  if (status === "green") return "px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs";
  if (status === "yellow") return "px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs";
  return "px-3 py-1 rounded-full bg-red-500/10 text-red-300 text-xs";
}
