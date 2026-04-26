import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const steps = [
  ["Welcome to your workspace portal", "This portal helps you manage quotes, furniture selections, floor plans, finance options, procurement requests and project updates."],
  ["Your project dashboard", "Track active projects, quotes, floor plans, next steps and strategy calls from one clean dashboard."],
  ["Upload floor plans and photos", "Upload plans or office photos so The Corporate Desk can review layout, furniture requirements and project scope."],
  ["Quotes and furniture selections", "View proposals, product selections, quote revisions and project history."],
  ["Finance options", "Explore finance pathways that may reduce large upfront furniture or fitout costs."],
  ["Procurement requests", "Request product comparisons, supplier options, approvals and procurement support."],
  ["LeaseHawk and PhantomX", "Depending on your plan, you can access LeaseHawk opportunity intelligence or PhantomX paper-trader insights. Live trading is disabled by default."],
  ["Finish setup", "Tell us what you are trying to achieve so the portal can guide your next steps."],
];

export default function ClientOnboarding() {
  const [, setLocation] = useLocation();
  const [index, setIndex] = useState(0);
  const [setup, setSetup] = useState({ goal: "", timeline: "", budget: "", seats: "", city: "" });
  const last = index === steps.length - 1;

  async function finish() {
    sessionStorage.setItem("tcd_client_onboarding_complete", "true");
    sessionStorage.setItem("tcd_client_setup", JSON.stringify(setup));
    setLocation("/client-dashboard");
  }

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 flex items-center justify-center">
      <section className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <div className="flex justify-between items-center mb-8">
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">First-time tutorial</p>
          <p className="text-white/35 text-sm">{index + 1} / {steps.length}</p>
        </div>

        <h1 className="text-3xl font-bold">{steps[index][0]}</h1>
        <p className="text-white/50 mt-4 text-lg">{steps[index][1]}</p>

        {last && (
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            {[
              ["goal", "Main project goal"],
              ["timeline", "Estimated timeline"],
              ["budget", "Budget range"],
              ["seats", "Number of staff/seats"],
              ["city", "City/state"],
            ].map(([key, label]) => (
              <input key={key} value={(setup as any)[key]} onChange={e => setSetup(s => ({ ...s, [key]: e.target.value }))} placeholder={label} className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400" />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-between items-center">
          <button disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))} className="text-white/40 disabled:opacity-20">Back</button>
          {last ? (
            <button onClick={finish} className="px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
              Finish setup <CheckCircle2 className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setIndex(i => i + 1)} className="px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
