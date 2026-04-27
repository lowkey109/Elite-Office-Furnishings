import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Lock, TrendingUp, ShieldAlert } from "lucide-react";

function token() {
  return typeof window !== "undefined" ? window.sessionStorage.getItem("tcd_client_token") || "" : "";
}

async function fetchPaper() {
  const res = await fetch("/api/client/phantomx/paper", {
    headers: { authorization: "Bearer " + token() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ClientPhantomXPaper() {
  const authed = typeof window !== "undefined" && window.sessionStorage.getItem("tcd_client_auth") === "true";
  const { data, isLoading } = useQuery({
    queryKey: ["/api/client/phantomx/paper"],
    queryFn: fetchPaper,
    enabled: authed,
  });

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#080A12] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Lock className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold mt-4">Client login required</h1>
          <p className="text-white/45 mt-3">Create a free client account to use PhantomX Paper Trader.</p>
          <Link href="/client-signup"><span className="inline-block mt-6 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Create Free Account</span></Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">PhantomX Paper Trader</p>
        <h1 className="text-3xl font-bold mt-2">Free Pretend-Money Trading Mode</h1>
        <p className="text-white/50 mt-2">Test AI trading logic with pretend money. No live funds. No exchange orders. No financial advice.</p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-3">
        <ShieldAlert className="text-amber-300 flex-shrink-0" />
        <p className="text-white/60 text-sm">
          PhantomX Paper Trader is free simulation only. Real-money trading is disabled and will require a separate private approval, legal, compliance and risk process later.
        </p>
      </div>

      {isLoading && <p className="text-white/40">Loading PhantomX paper state...</p>}

      <div className="grid md:grid-cols-4 gap-4">
        <Card title="Mode" value={data?.paperOnly ? "Paper only" : "—"} />
        <Card title="Balance" value={data?.balance ?? "—"} />
        <Card title="Equity" value={data?.equity ?? "—"} />
        <Card title="Ticks" value={data?.tickCount ?? 0} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 text-amber-300">
          <TrendingUp />
          <h2 className="text-xl font-semibold">Strategy Learning</h2>
        </div>
        <pre className="mt-4 overflow-auto text-xs text-white/60 bg-black/30 rounded-xl p-4">
          {JSON.stringify(data?.learning || {}, null, 2)}
        </pre>
      </section>
    </main>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-2xl font-bold">{String(value)}</p>
      <p className="text-white/40 text-sm">{title}</p>
    </div>
  );
}
