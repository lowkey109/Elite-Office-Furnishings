import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { validateAdminLogin } from "@/lib/adminAuth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Eye, TrendingUp, MapPin, Target, Monitor, Smartphone, RefreshCw, Globe } from "lucide-react";

interface VisitorSession {
  id: string;
  visitorId: string;
  ipAddress: string | null;
  city: string | null;
  country: string | null;
  companyName: string | null;
  isp: string | null;
  industry: string | null;
  deviceType: string | null;
  pagesViewed: string[];
  sessionDurationSeconds: number | null;
  engagementScore: number;
  intent: string | null;
  estimatedProjectValue: number | null;
  pushedToPipeline: boolean | null;
  referrer: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VisitorStats {
  total: number;
  highIntent: number;
  byCity: [string, number][];
  byIntent: [string, number][];
}

const INTENT_LABELS: Record<string, string> = {
  workspace_planning:  "Workspace Planning",
  fitout_project:      "Fitout Project",
  furniture_purchase:  "Furniture Purchase",
  office_expansion:    "Office Expansion",
  general_enquiry:     "General Enquiry",
};

const INTENT_COLORS: Record<string, string> = {
  workspace_planning:  "bg-violet-500/10 text-violet-400 border-violet-500/20",
  fitout_project:      "bg-amber-500/10 text-amber-400 border-amber-500/20",
  furniture_purchase:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  office_expansion:    "bg-green-500/10 text-green-400 border-green-500/20",
  general_enquiry:     "bg-white/5 text-white/40 border-white/10",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? "bg-red-400" : score >= 40 ? "bg-amber-400" : score >= 20 ? "bg-blue-400" : "bg-white/20";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`font-bold text-xs ${score >= 60 ? "text-red-400" : score >= 40 ? "text-amber-400" : "text-white/50"}`}>{score}</span>
    </div>
  );
}

export default function AdminCompanyVisitors() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("tcd_admin_auth") === "true");
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authErr, setAuthErr] = useState(false);
  const [minScore, setMinScore] = useState("0");
  const [intentFilter, setIntentFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  function handleLogin() {
    if (validateAdminLogin(authEmail, authPw)) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
    } else {
      setAuthErr(true);
    }
  }

  const params = new URLSearchParams();
  if (minScore !== "0") params.set("minScore", minScore);
  if (intentFilter) params.set("intent", intentFilter);
  if (cityFilter) params.set("city", cityFilter);

  const { data: sessions = [], isLoading, refetch } = useQuery<VisitorSession[]>({
    queryKey: ["/api/admin/company-visitors", minScore, intentFilter, cityFilter],
    queryFn: () => fetch(`/api/admin/company-visitors?${params}`).then(r => r.json()),
    enabled: authed,
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<VisitorStats>({
    queryKey: ["/api/admin/company-visitors/stats"],
    queryFn: () => fetch("/api/admin/company-visitors/stats").then(r => r.json()),
    enabled: authed,
    refetchInterval: 60_000,
  });

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,7%)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-2">The Corporate Desk</div>
            <h1 className="text-white font-serif text-xl font-bold">Admin Access</h1>
            <p className="text-white/40 text-sm mt-1">Company Visitor Intelligence</p>
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

  const highIntentSessions = sessions.filter(s => s.engagementScore >= 40);

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,9%)]">
        <div className="max-w-screen-xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-1">Admin · Visitor Intelligence</div>
            <h1 className="text-white font-serif text-2xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              Company Visitor Identification
            </h1>
            <p className="text-white/40 text-sm mt-1">B2B companies visiting the website — engagement scored and intent detected</p>
          </div>
          <button onClick={() => refetch()} className="p-2 text-white/40 hover:text-white/70 transition-colors" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Visitors", value: stats?.total ?? sessions.length, icon: Users, color: "text-white" },
            { label: "High Intent", value: stats?.highIntent ?? highIntentSessions.length, icon: Target, color: "text-amber-400" },
            { label: "Top City", value: stats?.byCity?.[0]?.[0] ?? "—", icon: MapPin, color: "text-blue-400" },
            { label: "Top Intent", value: INTENT_LABELS[stats?.byIntent?.[0]?.[0] ?? ""] ?? "—", icon: TrendingUp, color: "text-[hsl(43,78%,65%)]" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                <span className="text-white/40 text-xs uppercase tracking-wider">{label}</span>
              </div>
              <div className={`text-xl font-bold ${color} truncate`} data-testid={`kpi-${label.replace(/\s+/g,"-").toLowerCase()}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <span className="text-white/30 text-xs">Filter:</span>
          <select
            value={minScore}
            onChange={e => setMinScore(e.target.value)}
            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white text-xs rounded-lg px-3 py-1.5"
            data-testid="filter-min-score"
          >
            <option value="0">Any Score</option>
            <option value="20">Score ≥ 20</option>
            <option value="40">Score ≥ 40 (High Intent)</option>
            <option value="60">Score ≥ 60 (Very High)</option>
          </select>
          <select
            value={intentFilter}
            onChange={e => setIntentFilter(e.target.value)}
            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white text-xs rounded-lg px-3 py-1.5"
            data-testid="filter-intent"
          >
            <option value="">All Intents</option>
            {Object.entries(INTENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            placeholder="Filter by city…"
            className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] text-white placeholder:text-white/30 text-xs w-40 h-8"
            data-testid="filter-city"
          />
          <span className="ml-auto text-white/30 text-xs">{sessions.length} sessions</span>
        </div>

        {/* Sessions Table */}
        {isLoading ? (
          <div className="text-white/40 text-center py-12">Loading visitor data…</div>
        ) : sessions.length === 0 ? (
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-12 text-center">
            <Globe className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <div className="text-white/40 text-sm">No visitor sessions yet.</div>
            <div className="text-white/20 text-xs mt-1">Sessions are recorded as visitors browse the website. Make sure visitor tracking is active.</div>
          </div>
        ) : (
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <table className="w-full text-sm" data-testid="visitors-table">
              <thead>
                <tr className="bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.05)]">
                  {["Company / ISP", "City", "Pages Viewed", "Intent", "Score", "Device", "Session Time", "First Seen"].map(h => (
                    <th key={h} className="text-left text-white/30 font-medium px-5 py-3 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors" data-testid={`visitor-row-${s.id}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-white text-xs">{s.companyName || "Unknown"}</div>
                      {s.isp && s.isp !== s.companyName && (
                        <div className="text-white/30 text-[10px] mt-0.5">{s.isp}</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-white/60 text-xs">{s.city || "—"}</div>
                      {s.country && <div className="text-white/30 text-[10px]">{s.country}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-white/60 text-xs font-semibold">{s.pagesViewed.length} pages</div>
                      <div className="text-white/30 text-[10px] max-w-[140px] truncate">
                        {s.pagesViewed.slice(0, 2).join(", ")}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {s.intent ? (
                        <Badge className={`text-[10px] border px-2 py-0 ${INTENT_COLORS[s.intent] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                          {INTENT_LABELS[s.intent] ?? s.intent}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <ScoreBar score={s.engagementScore} />
                    </td>
                    <td className="px-5 py-3 text-white/40">
                      {s.deviceType === "mobile"
                        ? <Smartphone className="w-3.5 h-3.5" />
                        : <Monitor className="w-3.5 h-3.5" />}
                    </td>
                    <td className="px-5 py-3 text-white/40 text-xs">
                      {s.sessionDurationSeconds && s.sessionDurationSeconds > 0
                        ? `${Math.floor(s.sessionDurationSeconds / 60)}m ${s.sessionDurationSeconds % 60}s`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-white/30 text-xs">
                      {new Date(s.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
