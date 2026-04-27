import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, FileCheck2 } from "lucide-react";

function token() {
  return typeof window !== "undefined" ? window.sessionStorage.getItem("tcd_client_token") || "" : "";
}

async function fetchApplications() {
  const res = await fetch("/api/client/phantomx/applications", {
    headers: { authorization: "Bearer " + token() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ClientPhantomXCompliance() {
  const [form, setForm] = useState({
    requestedMode: "live_readiness",
    tradingExperience: "",
    maxMonthlyLossLimit: "",
    maxDailyLossLimit: "",
    preferredExchange: "",
    notes: "",
    understandsRisk: false,
    acceptsNoFinancialAdvice: false,
    acceptsNoProfitGuarantee: false,
    acceptsPaperFirst: false,
    acceptsKillSwitch: false,
    confirmsOwnFunds: false,
    confirmsNoBorrowedFunds: false,
  });

  const { data, refetch } = useQuery({
    queryKey: ["/api/client/phantomx/applications"],
    queryFn: fetchApplications,
  });

  async function submit() {
    const res = await fetch("/api/client/phantomx/applications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + token(),
      },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    alert(json.ok ? json.message : json.error || "Could not submit application.");
    if (json.ok) refetch();
  }

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">PhantomX Compliance</p>
        <h1 className="text-3xl font-bold mt-2">Live Readiness Application</h1>
        <p className="text-white/50 mt-2">
          Apply for private review only. This does not enable live trading, does not provide financial advice and does not guarantee profit.
        </p>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex gap-3">
        <ShieldAlert className="text-red-300 flex-shrink-0" />
        <p className="text-white/65 text-sm">
          Real-money trading is disabled by default. Any future exchange connection requires compliance review, risk limits,
          kill-switch controls, audit logging and written approval.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <h2 className="text-xl font-semibold">Application details</h2>

        <label className="block">
          <span className="text-sm text-white/45">Trading experience</span>
          <textarea
            value={form.tradingExperience}
            onChange={(e) => setForm({ ...form, tradingExperience: e.target.value })}
            className="mt-2 w-full min-h-[90px] rounded-xl bg-black/30 border border-white/10 px-4 py-3"
            placeholder="Describe your experience with trading, crypto, risk controls and paper testing."
          />
        </label>

        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Preferred exchange" value={form.preferredExchange} onChange={(v: string) => setForm({ ...form, preferredExchange: v })} />
          <Input label="Max daily loss limit" value={form.maxDailyLossLimit} onChange={(v: string) => setForm({ ...form, maxDailyLossLimit: v })} />
          <Input label="Max monthly loss limit" value={form.maxMonthlyLossLimit} onChange={(v: string) => setForm({ ...form, maxMonthlyLossLimit: v })} />
        </div>

        <label className="block">
          <span className="text-sm text-white/45">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-2 w-full min-h-[70px] rounded-xl bg-black/30 border border-white/10 px-4 py-3"
          />
        </label>

        <div className="space-y-3">
          <Check label="I understand crypto/trading can result in loss of capital." checked={form.understandsRisk} onChange={(v: boolean) => setForm({ ...form, understandsRisk: v })} />
          <Check label="I understand PhantomX does not provide financial advice." checked={form.acceptsNoFinancialAdvice} onChange={(v: boolean) => setForm({ ...form, acceptsNoFinancialAdvice: v })} />
          <Check label="I understand no profit or outcome is guaranteed." checked={form.acceptsNoProfitGuarantee} onChange={(v: boolean) => setForm({ ...form, acceptsNoProfitGuarantee: v })} />
          <Check label="I accept paper trading and review must happen before any live-readiness process." checked={form.acceptsPaperFirst} onChange={(v: boolean) => setForm({ ...form, acceptsPaperFirst: v })} />
          <Check label="I accept kill-switch and loss-limit controls are required." checked={form.acceptsKillSwitch} onChange={(v: boolean) => setForm({ ...form, acceptsKillSwitch: v })} />
          <Check label="I confirm any future funds would be my own funds in my own account." checked={form.confirmsOwnFunds} onChange={(v: boolean) => setForm({ ...form, confirmsOwnFunds: v })} />
          <Check label="I confirm I will not use borrowed funds for any live-readiness testing." checked={form.confirmsNoBorrowedFunds} onChange={(v: boolean) => setForm({ ...form, confirmsNoBorrowedFunds: v })} />
        </div>

        <button onClick={submit} className="px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold">
          Submit Live Readiness Application
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold flex items-center gap-2"><FileCheck2 className="text-amber-400" /> My applications</h2>
        <div className="mt-4 space-y-3">
          {(data?.applications || []).map((app: any) => (
            <div key={app.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="font-semibold">{app.requestedMode}</p>
              <p className="text-amber-300 text-sm">{app.status}</p>
              <p className="text-white/35 text-xs mt-1">{app.createdAt}</p>
            </div>
          ))}
          {!data?.applications?.length && <p className="text-white/40">No applications submitted yet.</p>}
        </div>
      </section>
    </main>
  );
}

function Input({ label, value, onChange }: any) {
  return (
    <label>
      <span className="text-sm text-white/45">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3" />
    </label>
  );
}

function Check({ label, checked, onChange }: any) {
  return (
    <label className="flex gap-3 text-sm text-white/70 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>{label}</span>
    </label>
  );
}
