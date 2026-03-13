import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { validateAdminLogin } from "@/lib/adminAuth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, Building2, BarChart3, Globe, ExternalLink, RefreshCw, Radar } from "lucide-react";

function fmtVal(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return n > 0 ? `$${n}` : "—";
}

interface MarketIntelData {
  totalDetected: number;
  activeSignals: number;
  totalPipelineValue: number;
  topCities: { city: string; count: number }[];
  topIndustries: { industry: string; count: number }[];
  bySignalType: Record<string, number>;
  highPriority: number;
  recentSignals: {
    id: string; companyName: string; city: string;
    signalType: string; priority: string;
    estimatedProjectValue: string | null; dateDetected: string;
  }[];
}

export default function AdminMarketIntelligence() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("tcd_admin_auth") === "true");
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authErr, setAuthErr] = useState(false);

  function handleLogin() {
    if (validateAdminLogin(authEmail, authPw)) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
    } else {
      setAuthErr(true);
    }
  }

  const { data, isLoading, refetch } = useQuery<MarketIntelData>({
    queryKey: ["/api/admin/market-intelligence"],
    queryFn: () => fetch("/api/admin/market-intelligence").then(r => r.json()),
    enabled: authed,
    refetchInterval: 120_000,
  });

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,7%)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-2">The Corporate Desk</div>
            <h1 className="text-white font-serif text-xl font-bold">Admin Access</h1>
            <p className="text-white/40 text-sm mt-1">Market Intelligence</p>
          </div>
          <div className="space-y-3">
            <Input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Admin email" type="email" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            <Input value={authPw} onChange={e => setAuthPw(e.target.value)} placeholder="Password" type="password" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {authErr && <p className="text-red-400 text-xs">Invalid credentials</p>}
            <button onClick={handleLogin} className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[#0f0f13] font-semibold py-2 rounded-lg transition-colors">Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  const topSignalType = data ? Object.entries(data.bySignalType).sort((a, b) => b[1] - a[1])[0] : null;

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,9%)]">
        <div className="max-w-screen-xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-1">Admin · Market Intelligence</div>
            <h1 className="text-white font-serif text-2xl font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              National Market Intelligence
            </h1>
            <p className="text-white/40 text-sm mt-1">Office relocation and expansion signals across Australia</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/market-map">
              <button className="flex items-center gap-2 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] text-sm px-4 py-2 rounded-xl hover:bg-[rgba(201,168,76,0.15)] transition-colors" data-testid="button-view-map">
                <MapPin className="w-4 h-4" /> View Map
              </button>
            </Link>
            <button onClick={() => refetch()} className="p-2 text-white/40 hover:text-white/70 transition-colors" title="Refresh" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32 text-white/40">Loading market intelligence…</div>
      ) : (
        <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Detected", value: data?.totalDetected ?? 0, color: "text-white", icon: Radar },
              { label: "Active Signals", value: data?.activeSignals ?? 0, color: "text-[hsl(43,78%,65%)]", icon: TrendingUp },
              { label: "High Priority", value: data?.highPriority ?? 0, color: "text-red-400", icon: Building2 },
              { label: "Est. Pipeline Value", value: fmtVal(data?.totalPipelineValue ?? 0), color: "text-green-400", icon: BarChart3 },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  <span className="text-white/40 text-xs uppercase tracking-wider">{label}</span>
                </div>
                <div className={`text-2xl font-bold ${color}`} data-testid={`kpi-${label.replace(/\s+/g, "-").toLowerCase()}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Two column layout */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Cities */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" /> Opportunities by City
              </h3>
              <div className="space-y-3">
                {(data?.topCities ?? []).map(({ city, count }) => {
                  const max = data?.topCities[0]?.count ?? 1;
                  return (
                    <div key={city} className="flex items-center gap-3" data-testid={`city-row-${city}`}>
                      <div className="w-24 text-white/70 text-sm">{city}</div>
                      <div className="flex-1 h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[hsl(43,78%,52%)] rounded-full transition-all"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 text-right text-[hsl(43,78%,65%)] font-semibold text-sm">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Industries */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" /> Opportunities by Industry
              </h3>
              <div className="space-y-3">
                {(data?.topIndustries ?? []).map(({ industry, count }) => {
                  const max = data?.topIndustries[0]?.count ?? 1;
                  return (
                    <div key={industry} className="flex items-center gap-3" data-testid={`industry-row-${industry}`}>
                      <div className="w-36 text-white/70 text-sm truncate">{industry}</div>
                      <div className="flex-1 h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 text-right text-blue-400 font-semibold text-sm">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Signal type breakdown */}
          {data?.bySignalType && (
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" /> Signal Type Breakdown
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(data.bySignalType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-2.5 flex items-center gap-3" data-testid={`signal-type-${type}`}>
                      <span className="text-white/70 text-sm">{type.replace(/_/g, " ")}</span>
                      <span className="text-[hsl(43,78%,65%)] font-bold text-sm">{count}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Recent Signals Table */}
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Radar className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" /> Recent Signals
              </h3>
              <Link href="/admin/office-move-radar">
                <span className="text-white/30 text-xs hover:text-white/60 transition-colors cursor-pointer">Full radar →</span>
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.05)]">
                  {["Company", "City", "Signal Type", "Priority", "Est. Value", "Detected"].map(h => (
                    <th key={h} className="text-left text-white/30 font-medium px-5 py-3 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                {(data?.recentSignals ?? []).map(s => (
                  <tr key={s.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors" data-testid={`signal-row-${s.id}`}>
                    <td className="px-5 py-3 font-medium text-white">{s.companyName}</td>
                    <td className="px-5 py-3 text-white/50">{s.city}</td>
                    <td className="px-5 py-3 text-white/50 capitalize">{s.signalType?.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3">
                      <Badge className={`text-xs border ${
                        s.priority === "High" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        s.priority === "Medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-white/5 text-white/40 border-white/10"
                      }`}>
                        {s.priority}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-[hsl(43,78%,65%)] font-semibold">
                      {s.estimatedProjectValue
                        ? fmtVal(parseInt((s.estimatedProjectValue || "0").replace(/[^0-9]/g, "")) || 0)
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-white/30 text-xs">
                      {s.dateDetected ? new Date(s.dateDetected).toLocaleDateString("en-AU") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
