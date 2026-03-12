import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, Target, BarChart3, Trophy,
  MapPin, Loader2, ChevronDown, Zap, Building2
} from "lucide-react";

const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";
const ADMIN_PASS = "Jaymin12!/";
const AUTH_KEY = "tcd_admin_auth";

interface ProspectedLead {
  id: string;
  company: string;
  location: string;
  industry: string;
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  status: string;
  city: string | null;
  dealProbability: number | null;
  estimatedOfficeSqm: string | null;
  estimatedHeadcount: string | null;
  signalType: string | null;
  recommendedNextAction: string | null;
  createdAt: string;
}

// ─── Stage config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: "Lead Detected",  label: "Lead Detected",  prob: 10,  color: "border-t-white/20", badge: "bg-white/5 text-white/40 border-white/10" },
  { key: "Contacted",      label: "Contacted",       prob: 25,  color: "border-t-blue-500",   badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { key: "Planning",       label: "Planning",         prob: 40,  color: "border-t-violet-500", badge: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { key: "Quoted",         label: "Quoted",           prob: 60,  color: "border-t-amber-500",  badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { key: "Negotiation",    label: "Negotiation",      prob: 80,  color: "border-t-orange-500", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { key: "Won",            label: "Won",              prob: 100, color: "border-t-green-500",  badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  { key: "Lost",           label: "Lost",             prob: 0,   color: "border-t-red-500",    badge: "bg-red-500/10 text-red-400 border-red-500/20" },
];

// Legacy status mapping to new stages
const LEGACY_MAP: Record<string, string> = {
  "New": "Lead Detected",
  "Responded": "Contacted",
  "Qualified": "Planning",
  "Closed": "Won",
};

function normaliseStatus(s: string): string {
  return LEGACY_MAP[s] ?? s;
}

function getStageMeta(status: string) {
  const key = normaliseStatus(status);
  return STAGES.find(s => s.key === key) ?? STAGES[0];
}

function parseValue(val: string | null | undefined): number {
  if (!val) return 0;
  const match = val.match(/\$([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, "")) : 0;
}

function fmtVal(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

// ─── Stage Card ───────────────────────────────────────────────────────────────
function LeadCard({ lead, onMove }: { lead: ProspectedLead; onMove: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const stage = getStageMeta(lead.status);
  const val = parseValue(lead.estimatedProjectValue);

  return (
    <div className="bg-[hsl(220,18%,12%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 space-y-2.5" data-testid={`pipeline-card-${lead.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{lead.company}</p>
          {lead.city && (
            <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />{lead.city}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 flex-shrink-0 ${stage.badge}`}>
          {stage.prob}%
        </span>
      </div>

      {lead.signalType && (
        <p className="text-white/30 text-xs leading-relaxed truncate">
          {lead.signalType.replace(/_/g, " ")}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[hsl(43,78%,65%)] font-bold text-sm">{lead.estimatedProjectValue || "TBD"}</span>
        <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${
          lead.score >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20"
          : lead.score >= 50 ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
          : "bg-white/5 text-white/30 border-white/10"
        }`}>
          {lead.score}
        </span>
      </div>

      {lead.recommendedNextAction && (
        <p className="text-amber-400/70 text-[11px] leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-lg px-2.5 py-1.5">
          {lead.recommendedNextAction}
        </p>
      )}

      {/* Move stage */}
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between text-xs text-white/30 hover:text-white/60 border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] rounded-lg px-2.5 py-1.5 transition-colors"
          data-testid={`button-move-stage-${lead.id}`}
        >
          <span>Move to stage…</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 w-full bg-[hsl(220,18%,14%)] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl z-10 overflow-hidden mb-1">
            {STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => { onMove(lead.id, s.key); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors flex items-center justify-between ${
                  normaliseStatus(lead.status) === s.key ? "text-[hsl(43,78%,65%)]" : "text-white/60"
                }`}
              >
                <span>{s.label}</span>
                <span className="text-white/20">{s.prob}%</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { Input } from "@/components/ui/input";

export default function AdminDealPipeline() {
  const [authed, setAuthed] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authErr, setAuthErr] = useState(false);
  const [cityFilter, setCityFilter] = useState("All");

  const { toast } = useToast();

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    if (stored === `${ADMIN_EMAIL}:${ADMIN_PASS}`) setAuthed(true);
  }, []);

  const { data: leads = [], isLoading } = useQuery<ProspectedLead[]>({
    queryKey: ["/api/admin/prospects"],
    queryFn: () => fetch("/api/admin/prospects").then(r => r.json()),
    enabled: authed,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/admin/prospects/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deal-forecast"] });
      toast({ title: `Moved to ${vars.status}` });
    },
  });

  const handleLogin = () => {
    if (authEmail === ADMIN_EMAIL && authPw === ADMIN_PASS) {
      sessionStorage.setItem(AUTH_KEY, `${ADMIN_EMAIL}:${ADMIN_PASS}`);
      setAuthed(true);
    } else {
      setAuthErr(true);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,7%)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-2">The Corporate Desk</div>
            <h1 className="text-white font-serif text-xl font-bold">Admin Access</h1>
            <p className="text-white/40 text-sm mt-1">Deal Pipeline</p>
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

  const cities = ["All", "Brisbane", "Sydney", "Melbourne"];
  const filtered = leads.filter(l =>
    cityFilter === "All" || l.city === cityFilter || l.location?.includes(cityFilter)
  );

  // Live forecasting from current data
  const PROB: Record<string, number> = {
    "Lead Detected": 10, "New": 10,
    "Contacted": 25, "Responded": 25,
    "Planning": 40, "Qualified": 40,
    "Quoted": 60,
    "Negotiation": 80,
    "Won": 100, "Closed": 100,
    "Lost": 0,
  };

  const grossPipeline = filtered.filter(l => l.status !== "Lost" && l.status !== "Closed").reduce((s, l) => s + parseValue(l.estimatedProjectValue), 0);
  const weightedRevenue = filtered.reduce((s, l) => s + parseValue(l.estimatedProjectValue) * (PROB[l.status] ?? 30) / 100, 0);
  const probableDeals = filtered.filter(l => (PROB[l.status] ?? 0) >= 60 && l.status !== "Lost");
  const wonDeals = filtered.filter(l => l.status === "Won" || l.status === "Closed");
  const wonValue = wonDeals.reduce((s, l) => s + parseValue(l.estimatedProjectValue), 0);
  const lostDeals = filtered.filter(l => l.status === "Lost");
  const totalClosed = wonDeals.length + lostDeals.length;
  const winRate = totalClosed > 0 ? Math.round(wonDeals.length / totalClosed * 100) : null;

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-white" data-testid="page-deal-pipeline">
      {/* Top nav */}
      <div className="bg-[hsl(220,18%,10%)] border-b border-[rgba(255,255,255,0.06)] px-6 py-3 flex items-center gap-4">
        <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase">TCD Admin</div>
        <div className="text-white/20">·</div>
        <a href="/admin/dashboard" className="text-white/40 hover:text-white/70 text-sm transition-colors">Dashboard</a>
        <div className="text-white/20">·</div>
        <span className="text-white text-sm font-medium">Deal Pipeline</span>
        <div className="ml-auto">
          <a href="/admin/dashboard" className="text-white/40 hover:text-white text-xs border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 transition-colors">← Dashboard</a>
        </div>
      </div>

      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-white font-serif text-2xl font-bold flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[hsl(43,78%,52%)]" /> Deal Pipeline
            </h1>
            <p className="text-white/40 text-sm mt-1">7-stage revenue forecasting · probability-weighted pipeline</p>
          </div>
          <div className="flex gap-1.5">
            {cities.map(c => (
              <button
                key={c}
                onClick={() => setCityFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  cityFilter === c
                    ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]"
                    : "border-[rgba(255,255,255,0.08)] text-white/40 hover:text-white/70"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* Forecast KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Gross Pipeline", value: fmtVal(grossPipeline), sub: "active opportunities", icon: DollarSign, color: "text-white/80" },
            { label: "Expected Revenue", value: fmtVal(Math.round(weightedRevenue)), sub: "probability-weighted", icon: BarChart3, color: "text-[hsl(43,78%,65%)]" },
            { label: "Probable Deals", value: probableDeals.length, sub: "≥60% win probability", icon: Target, color: "text-amber-400" },
            { label: "Won Revenue", value: fmtVal(wonValue), sub: `${wonDeals.length} closed`, icon: Trophy, color: "text-green-400" },
            { label: "Win Rate", value: winRate !== null ? `${winRate}%` : "—", sub: `${wonDeals.length}W · ${lostDeals.length}L`, icon: TrendingUp, color: "text-blue-400" },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                  <p className="text-white/40 text-xs">{kpi.label}</p>
                </div>
                <p className={`text-xl font-bold font-serif ${kpi.color}`} data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>{kpi.value}</p>
                <p className="text-white/25 text-[11px] mt-0.5">{kpi.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Stage probability legend */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span className="text-white/30 text-xs">Stage probability:</span>
          {STAGES.map(s => (
            <span key={s.key} className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${s.badge}`}>
              {s.label} {s.prob}%
            </span>
          ))}
        </div>

        {/* 7-Stage Kanban */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,78%,52%)]" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {STAGES.map(stage => {
                const colLeads = filtered.filter(l => normaliseStatus(l.status) === stage.key);
                const colValue = colLeads.reduce((s, l) => s + parseValue(l.estimatedProjectValue), 0);
                return (
                  <div key={stage.key} className="w-[240px] flex-shrink-0" data-testid={`column-${stage.key.toLowerCase().replace(/\s+/g, "-")}`}>
                    {/* Column header */}
                    <div className={`rounded-t-xl border-t-4 ${stage.color} bg-[hsl(220,18%,10%)] border-l border-r border-[rgba(255,255,255,0.06)] px-3 py-3 mb-2`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${stage.badge}`}>{stage.prob}%</span>
                          <span className="text-white/70 font-semibold text-sm">{stage.label}</span>
                        </div>
                        <span className="text-white/30 text-xs">{colLeads.length}</span>
                      </div>
                      {colValue > 0 && (
                        <p className="text-white/40 text-xs mt-1.5">{fmtVal(colValue)}</p>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {colLeads.length === 0 ? (
                        <div className="border border-dashed border-[rgba(255,255,255,0.07)] rounded-xl p-5 text-center text-white/20 text-xs">
                          No leads
                        </div>
                      ) : colLeads.map(lead => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          onMove={(id, status) => moveMutation.mutate({ id, status })}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage breakdown table */}
        <div className="mt-8 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-white font-semibold text-sm">Stage Breakdown</h3>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {STAGES.map(stage => {
              const colLeads = filtered.filter(l => normaliseStatus(l.status) === stage.key);
              const colValue = colLeads.reduce((s, l) => s + parseValue(l.estimatedProjectValue), 0);
              const weighted = Math.round(colValue * stage.prob / 100);
              if (colLeads.length === 0) return null;
              return (
                <div key={stage.key} className="flex items-center px-5 py-3 gap-4">
                  <div className="w-36 flex-shrink-0">
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${stage.badge}`}>{stage.label}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-white font-semibold">{colLeads.length}</span>
                      <span className="text-white/30 text-xs ml-1">deal{colLeads.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div>
                      <span className="text-white/70">{fmtVal(colValue)}</span>
                      <span className="text-white/30 text-xs ml-1">gross</span>
                    </div>
                    <div>
                      <span className="text-[hsl(43,78%,65%)]">{fmtVal(weighted)}</span>
                      <span className="text-white/30 text-xs ml-1">weighted</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
