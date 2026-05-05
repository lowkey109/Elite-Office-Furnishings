import { AdminLayout } from "@/components/AdminLayout";
import { ShieldCheck } from "lucide-react";

export default function AdminPolyEdgeAetherforge() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#05070d] text-white p-3 lg:p-4">
        <div className="border border-cyan-500/20 bg-[#07131d] rounded-2xl p-4 mb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-cyan-300 font-bold">
                NEXORA POLYEDGE TERMINAL
              </div>
              <h1 className="text-2xl lg:text-2xl font-black mt-1">
                Quantum Trading Intelligence Terminal
              </h1>
              <p className="text-xs lg:text-sm text-white/55 mt-1 max-w-4xl">
                MoonDev strategy brain, multi-asset paper trader, learning memory,
                real/synced paper summary, live graph, final readiness, and locked real-money safety.
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
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
            src="/nexora/polyedge-terminal-v2"
            className="w-full border-0"
            style={{ height: "calc(100vh - 180px)", minHeight: 900 }}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
