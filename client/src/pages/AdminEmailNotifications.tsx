import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, RefreshCw, Send } from "lucide-react";

async function fetchEmailLog() {
  const res = await fetch("/api/admin/notifications/email-log", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminEmailNotifications() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["/api/admin/notifications/email-log"],
    queryFn: fetchEmailLog,
    refetchInterval: 30000,
  });

  const reminderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/notifications/trial-ending-reminders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tcd-admin-auth": "true",
        },
        body: JSON.stringify({ daysAhead: 3 }),
      });
      return res.json();
    },
    onSuccess: (json) => {
      alert(json.ok ? `Trial reminder check complete. Candidates: ${json.candidates}` : json.error || "Reminder check failed");
      refetch();
    },
  });

  const emails = data?.emails || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Notifications</p>
          <h1 className="text-3xl font-bold mt-2">Email Notifications</h1>
          <p className="text-white/50 mt-2">Welcome emails, enquiry alerts, support alerts, PhantomX alerts and trial reminders.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border border-white/10 text-white/70 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => reminderMutation.mutate()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
            <Send className="w-4 h-4" /> Run Trial Reminders
          </button>
        </div>
      </div>

      <section className="grid md:grid-cols-4 gap-4">
        <Card label="Configured" value={data?.configured ? "Yes" : "No"} />
        <Card label="Sent" value={data?.stats?.sent || 0} />
        <Card label="Skipped" value={data?.stats?.skipped || 0} />
        <Card label="Failed" value={data?.stats?.failed || 0} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 text-amber-300">
          <Mail />
          <h2 className="text-xl font-semibold">Configuration</h2>
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm text-white/55">
          <p><span className="text-white/35">From:</span> {data?.from || "—"}</p>
          <p><span className="text-white/35">Admin alerts:</span> {data?.adminEmail || "—"}</p>
        </div>
      </section>

      {isLoading && <p className="text-white/40">Loading email log...</p>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {emails.map((email: any) => (
          <div key={email.id} className="p-5 border-b border-white/10">
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-semibold">{email.subject}</p>
                <p className="text-white/45 text-sm">{email.to}</p>
                <p className="text-white/35 text-xs mt-1">{email.category}</p>
              </div>
              <div className="text-right">
                <p className={email.status === "sent" ? "text-emerald-300" : email.status === "failed" ? "text-red-300" : "text-amber-300"}>
                  {email.status}
                </p>
                <p className="text-white/35 text-xs">{email.createdAt}</p>
              </div>
            </div>
            {email.error && <p className="text-red-300 text-sm mt-3">{email.error}</p>}
          </div>
        ))}

        {!emails.length && !isLoading && <p className="p-5 text-white/40">No email notifications logged yet.</p>}
      </section>
    </main>
  );
}

function Card({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-2xl font-bold">{String(value)}</p>
      <p className="text-white/40 text-sm">{label}</p>
    </div>
  );
}
