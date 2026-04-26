import { useState } from "react";
import { useLocation, Link } from "wouter";
import { subscriptionPlans } from "@/data/subscriptionPlans";
import LegalAcceptance from "@/components/LegalAcceptance";

export default function ClientSignup() {
  const [, setLocation] = useLocation();
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    companySize: "",
    projectType: "",
    tier: "growth",
  });

  function update(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function signup(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedLegal) {
      alert("Please accept the legal terms before creating an account.");
      return;
    }
    sessionStorage.setItem("tcd_client_auth", "true");
    sessionStorage.setItem("tcd_client_email", form.email || "client@example.com");
    sessionStorage.setItem("tcd_client_company", form.company || "Client Company");
    sessionStorage.setItem("tcd_client_tier", form.tier);
    sessionStorage.setItem("tcd_client_legal_accepted_at", new Date().toISOString());
    setLocation("/client-onboarding");
  }

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 flex items-center justify-center">
      <form onSubmit={signup} className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Create Client Account</p>
        <h1 className="text-3xl font-bold mt-2">Start with a 14-day free trial</h1>
        <p className="text-white/45 mt-2">Client accounts are separate from private admin access.</p>

        <div className="grid md:grid-cols-2 gap-4 mt-8">
          <Input label="Full name" value={form.name} onChange={(v: string) => update("name", v)} />
          <Input label="Business email" value={form.email} onChange={(v: string) => update("email", v)} />
          <Input label="Company name" value={form.company} onChange={(v: string) => update("company", v)} />
          <Input label="Phone" value={form.phone} onChange={(v: string) => update("phone", v)} />
          <Input label="Company size" value={form.companySize} onChange={(v: string) => update("companySize", v)} placeholder="e.g. 10–50 staff" />
          <Input label="Project type" value={form.projectType} onChange={(v: string) => update("projectType", v)} placeholder="Relocation / fitout / procurement" />
        </div>

        <label className="block text-sm text-white/55 mt-5 mb-2">Preferred plan</label>
        <select value={form.tier} onChange={e => update("tier", e.target.value)} className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3">
          {subscriptionPlans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}
        </select>

        <div className="mt-6"><LegalAcceptance accepted={acceptedLegal} onAcceptedChange={setAcceptedLegal} /></div>

        <button className="mt-6 w-full rounded-xl bg-amber-500 text-black font-semibold py-3">Create Account & Start Tutorial</button>

        <div className="mt-6 flex justify-between text-sm">
          <Link href="/client-login"><span className="text-amber-300 cursor-pointer">Already have an account?</span></Link>
          <Link href="/subscriptions"><span className="text-white/35 cursor-pointer">View pricing</span></Link>
        </div>
      </form>
    </main>
  );
}

function Input({ label, value, onChange, placeholder }: any) {
  return (
    <label className="block">
      <span className="text-sm text-white/55">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400" />
    </label>
  );
}
