import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Lock, Building2 } from "lucide-react";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem("tcd_client_auth", "true");
    sessionStorage.setItem("tcd_client_email", email || "client@example.com");
    sessionStorage.setItem("tcd_client_company", company || "Client Company");

    const complete = sessionStorage.getItem("tcd_client_onboarding_complete") === "true";
    setLocation(complete ? "/client-dashboard" : "/client-onboarding");
  }

  return (
    <main className="min-h-screen bg-[#080A12] text-white flex items-center justify-center p-6">
      <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center"><Lock /></div>
          <div>
            <h1 className="text-2xl font-bold">Client Login</h1>
            <p className="text-white/40 text-sm">Separate from private admin access.</p>
          </div>
        </div>

        <label className="text-sm text-white/55">Business email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} className="mt-2 mb-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400" placeholder="you@company.com" />

        <label className="text-sm text-white/55">Company name</label>
        <input value={company} onChange={e => setCompany(e.target.value)} className="mt-2 mb-6 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-amber-400" placeholder="Company Pty Ltd" />

        <button className="w-full rounded-xl bg-amber-500 text-black font-semibold py-3">Log in to Client Portal</button>

        <p className="text-white/35 text-xs mt-4">
          Production auth, hashed passwords, Stripe verification and tenant checks will be wired server-side later.
        </p>

        <div className="mt-6 flex justify-between text-sm">
          <Link href="/client-signup"><span className="text-amber-300 cursor-pointer">Create account</span></Link>
          <Link href="/"><span className="text-white/35 cursor-pointer">Back home</span></Link>
        </div>
      </form>
    </main>
  );
}
