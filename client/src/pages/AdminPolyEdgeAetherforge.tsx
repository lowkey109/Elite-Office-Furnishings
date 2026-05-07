import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { ShieldCheck } from "lucide-react";

export default function AdminPolyEdgeAetherforge() {

  const [moonDevPolicy, setMoonDevPolicy] = useState<any>(null);

  useEffect(() => {
    fetch("/api/nexora/coinbase/paper/strategy")
      .then((r) => r.json())
      .then((data) => {
        setMoonDevPolicy(data?.strategy?.moonDevPolicy || data?.moonDevPolicy || null);
      })
      .catch(() => {});
  }, []);

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

          <div className="rounded-2xl border border-cyan-500/20 bg-black/40 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-cyan-300 text-xl font-bold">
                  MOONDEV POLICY CORE
                </h2>
                <p className="text-cyan-100/60 text-sm">
                  Live paper-trading policy intelligence imported into Nexora
                </p>
              </div>

              <div className="text-right">
                <div className="text-emerald-400 text-xs uppercase tracking-[0.25em]">
                  ACTIVE
                </div>
                <div className="text-white font-semibold">
                  Coinbase Paper
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="rounded-xl bg-cyan-950/30 p-4 border border-cyan-500/10">
                <div className="text-cyan-100/50 text-xs uppercase">Venue</div>
                <div className="text-white text-lg font-bold">
                  {moonDevPolicy?.venue || "Coinbase"}
                </div>
              </div>

              <div className="rounded-xl bg-cyan-950/30 p-4 border border-cyan-500/10">
                <div className="text-cyan-100/50 text-xs uppercase">Mode</div>
                <div className="text-white text-lg font-bold">
                  {moonDevPolicy?.mode || "Paper"}
                </div>
              </div>

              <div className="rounded-xl bg-cyan-950/30 p-4 border border-cyan-500/10">
                <div className="text-cyan-100/50 text-xs uppercase">Products</div>
                <div className="text-white text-lg font-bold">
                  {(moonDevPolicy?.products || []).length || 3}
                </div>
              </div>

              <div className="rounded-xl bg-cyan-950/30 p-4 border border-cyan-500/10">
                <div className="text-cyan-100/50 text-xs uppercase">Risk Engine</div>
                <div className="text-emerald-400 text-lg font-bold">
                  ONLINE
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-cyan-500/10 bg-black/30 p-4">
              <div className="text-cyan-300 text-sm font-semibold mb-2">
                Imported MoonDev Guidance
              </div>

              <div className="space-y-2 text-sm text-cyan-100/70">
                <div>• AI risk override enforcement</div>
                <div>• Portfolio allocation governance</div>
                <div>• Strategy validation + confidence scoring</div>
                <div>• Paper-trading learning adaptation</div>
                <div>• Market condition awareness</div>
              </div>
            </div>
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
            style={{ height: "calc(100vh - 150px)", minHeight: 620 }}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
