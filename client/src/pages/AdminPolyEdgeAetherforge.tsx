import { AdminLayout } from "@/components/AdminLayout";
import { ExternalLink, ShieldCheck, Activity } from "lucide-react";

export default function AdminPolyEdgeAetherforge() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#05070d] text-white p-4 lg:p-6">
        <div className="border border-cyan-500/20 bg-[#07131d] rounded-2xl p-5 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-cyan-300 font-bold">
                NEXORA POLYEDGE TERMINAL
              </div>
              <h1 className="text-3xl font-black mt-2">
                Quantum Trading Intelligence Terminal
              </h1>
              <p className="text-sm text-white/55 mt-2 max-w-3xl">
                Exact terminal view wired into admin: MoonDev strategy brain,
                multi-asset paper trader, paper summary sync, learning memory,
                live graph, final readiness, and locked real-money safety.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/nexora/polyedge-terminal"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 text-black px-4 py-2 text-sm font-bold"
              >
                <ExternalLink className="h-4 w-4" />
                Open Fullscreen
              </a>

              <a
                href="/nexora-poly-graph.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-4 py-2 text-sm font-bold text-cyan-200"
              >
                <Activity className="h-4 w-4" />
                Graph Page
              </a>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="text-xs text-emerald-200 uppercase tracking-wide">Mode</div>
              <div className="font-black text-emerald-300 mt-1">Paper Learning</div>
            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
              <div className="text-xs text-yellow-200 uppercase tracking-wide">Win Target</div>
              <div className="font-black text-yellow-300 mt-1">95% Earned Only</div>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <div className="text-xs text-red-200 uppercase tracking-wide">Live Money</div>
              <div className="font-black text-red-300 mt-1 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Locked
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-cyan-500/20 bg-black">
          <iframe
            title="Nexora PolyEdge Quantum Terminal"
            src="/nexora/polyedge-terminal"
            className="w-full border-0"
            style={{ height: "calc(100vh - 300px)", minHeight: 900 }}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
