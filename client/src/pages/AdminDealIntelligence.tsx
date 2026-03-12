import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Target, TrendingUp, DollarSign, Zap, BarChart3, Loader2,
  RefreshCw, Building2, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Clock, Sparkles, Trophy,
  ArrowRight, FileText, Lightbulb,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";
const ADMIN_PASS = "Jaymin12!/";
const AUTH_KEY = "tcd_admin_auth";

interface DealRecord {
  id: string;
  sourceType: string;
  companyName: string;
  city: string | null;
  industry: string | null;
  officeSizeSqm: string | null;
  staffCount: string | null;
  budgetBand: string | null;
  pipelineStage: string | null;
  estimatedProjectValue: number | null;
  estimatedGrossProfit: number | null;
  estimatedMarginPct: number | null;
  winProbability: number;
  probabilityTier: string;
  confidenceLevel: string;
  dealStrength: number;
  weightedExpectedRevenue: number | null;
  weightedExpectedProfit: number | null;
  recommendedNextAction: string | null;
  recommendedFollowUpTiming: string | null;
  recommendedOffer: string | null;
  reasoningSummary: string | null;
  quoteStatus: string | null;
  hasPlanningRequest: boolean | null;
  hasQuote: boolean | null;
  hasRadarSignal: boolean | null;
  financeInterest: boolean | null;
  outcomeResult: string | null;
  createdAt: string;
}

interface Summary {
  total: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalWeightedRevenue: number;
  totalWeightedProfit: number;
  avgWinProbability: number;
  bestDeals: DealRecord[];
  highestProfit: DealRecord[];
  atRiskQuoted: DealRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVal(n: number | null | undefined): string {
  if (!n) return "TBD";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function probColor(tier: string): string {
  if (tier === "high") return "text-green-400 bg-green-500/10 border-green-500/30";
  if (tier === "medium") return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-white/40 bg-white/5 border-white/10";
}

function probDot(tier: string): string {
  if (tier === "high") return "bg-green-400";
  if (tier === "medium") return "bg-amber-400";
  return "bg-white/20";
}

function sourceLabel(src: string): string {
  if (src === "prospect") return "Pipeline";
  if (src === "planning_request") return "Planning";
  if (src === "radar") return "Radar";
  if (src === "lead") return "Inbound";
  return src;
}

function confidenceBadge(level: string): string {
  if (level === "high") return "text-blue-400 border-blue-500/20 bg-blue-500/5";
  if (level === "medium") return "text-white/50 border-white/10 bg-white/5";
  return "text-white/25 border-white/5 bg-transparent";
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({ deal, onMarkOutcome }: { deal: DealRecord; onMarkOutcome: (id: string, outcome: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden transition-all"
      data-testid={`deal-card-${deal.id}`}
    >
      {/* Header row */}
      <div
        className="px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Probability dot */}
        <div className="mt-1.5 flex-shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${probDot(deal.probabilityTier)}`} />
        </div>

        {/* Company + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{deal.companyName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {deal.city && (
                  <span className="text-white/30 text-xs flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" />{deal.city}
                  </span>
                )}
                <span className="text-white/20 text-[10px] border border-white/10 rounded-full px-1.5 py-0.5">
                  {sourceLabel(deal.sourceType)}
                </span>
                {deal.pipelineStage && (
                  <span className="text-white/25 text-[10px]">{deal.pipelineStage}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${probColor(deal.probabilityTier)}`}>
                {deal.winProbability}% WIN
              </span>
              {expanded ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
            </div>
          </div>

          {/* Quick financials */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <div>
              <p className="text-[hsl(43,78%,65%)] font-bold text-sm">{fmtVal(deal.estimatedProjectValue)}</p>
              <p className="text-white/25 text-[10px]">est. value</p>
            </div>
            <div>
              <p className="text-green-400 font-semibold text-sm">{fmtVal(deal.weightedExpectedRevenue)}</p>
              <p className="text-white/25 text-[10px]">weighted rev</p>
            </div>
            <div>
              <p className="text-blue-400 font-semibold text-sm">{fmtVal(deal.estimatedGrossProfit)}</p>
              <p className="text-white/25 text-[10px]">est. profit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Next action banner — always visible */}
      {deal.recommendedNextAction && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
          <Zap className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-amber-400 text-[11px] font-semibold">{deal.recommendedNextAction}</p>
            {deal.recommendedFollowUpTiming && (
              <p className="text-amber-400/50 text-[10px] mt-0.5 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />{deal.recommendedFollowUpTiming}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[rgba(255,255,255,0.05)] px-4 py-4 space-y-4">
          {/* Reasoning */}
          {deal.reasoningSummary && (
            <div className="text-white/50 text-xs leading-relaxed">
              {deal.reasoningSummary}
            </div>
          )}

          {/* Offer strategy */}
          {deal.recommendedOffer && (
            <div className="bg-[hsl(220,18%,12%)] rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[hsl(43,78%,65%)] text-[11px] font-semibold">
                <Lightbulb className="w-3 h-3" /> Recommended Offer
              </div>
              <p className="text-white/60 text-xs leading-relaxed">{deal.recommendedOffer}</p>
            </div>
          )}

          {/* Deal detail grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              {deal.officeSizeSqm && <div className="flex justify-between"><span className="text-white/30">Office size</span><span className="text-white/70">{deal.officeSizeSqm} sqm</span></div>}
              {deal.staffCount && <div className="flex justify-between"><span className="text-white/30">Staff</span><span className="text-white/70">{deal.staffCount}</span></div>}
              {deal.budgetBand && <div className="flex justify-between"><span className="text-white/30">Budget</span><span className="text-white/70 truncate ml-2 text-right">{deal.budgetBand}</span></div>}
              {deal.industry && <div className="flex justify-between"><span className="text-white/30">Industry</span><span className="text-white/70">{deal.industry}</span></div>}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-white/30">Margin</span><span className="text-white/70">{deal.estimatedMarginPct ?? 28}%</span></div>
              <div className="flex justify-between"><span className="text-white/30">Deal strength</span><span className="text-white/70">{deal.dealStrength}/100</span></div>
              <div className="flex justify-between">
                <span className="text-white/30">Confidence</span>
                <span className={`text-[10px] border rounded-full px-1.5 py-0.5 ${confidenceBadge(deal.confidenceLevel)}`}>
                  {deal.confidenceLevel}
                </span>
              </div>
              {deal.quoteStatus && <div className="flex justify-between"><span className="text-white/30">Quote</span><span className="text-white/70">{deal.quoteStatus}</span></div>}
            </div>
          </div>

          {/* Signal badges */}
          <div className="flex flex-wrap gap-1.5">
            {deal.hasPlanningRequest && <span className="text-[10px] border border-violet-500/20 bg-violet-500/5 text-violet-400 rounded-full px-2 py-0.5">Planning request</span>}
            {deal.hasQuote && <span className="text-[10px] border border-amber-500/20 bg-amber-500/5 text-amber-400 rounded-full px-2 py-0.5">Quote {deal.quoteStatus || "drafted"}</span>}
            {deal.hasRadarSignal && <span className="text-[10px] border border-blue-500/20 bg-blue-500/5 text-blue-400 rounded-full px-2 py-0.5">Radar signal</span>}
            {deal.financeInterest && <span className="text-[10px] border border-green-500/20 bg-green-500/5 text-green-400 rounded-full px-2 py-0.5">Finance interest</span>}
          </div>

          {/* Outcome buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onMarkOutcome(deal.id, "won")}
              className="flex-1 text-xs py-1.5 border border-green-500/20 bg-green-500/5 text-green-400 rounded-lg hover:bg-green-500/15 transition-colors flex items-center justify-center gap-1.5"
              data-testid={`button-mark-won-${deal.id}`}
            >
              <Trophy className="w-3 h-3" /> Mark Won
            </button>
            <button
              onClick={() => onMarkOutcome(deal.id, "lost")}
              className="flex-1 text-xs py-1.5 border border-red-500/20 bg-red-500/5 text-red-400 rounded-lg hover:bg-red-500/15 transition-colors"
              data-testid={`button-mark-lost-${deal.id}`}
            >
              Mark Lost
            </button>
            <button
              onClick={() => onMarkOutcome(deal.id, "stalled")}
              className="flex-1 text-xs py-1.5 border border-white/10 text-white/30 rounded-lg hover:bg-white/5 transition-colors"
              data-testid={`button-mark-stalled-${deal.id}`}
            >
              Stalled
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDealIntelligence() {
  const [authed, setAuthed] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authErr, setAuthErr] = useState(false);
  const [tierFilter, setTierFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "best">("table");

  const { toast } = useToast();

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    if (stored === `${ADMIN_EMAIL}:${ADMIN_PASS}` || stored === "true") setAuthed(true);
  }, []);

  const { data: deals = [], isLoading: dealsLoading } = useQuery<DealRecord[]>({
    queryKey: ["/api/admin/deal-intelligence", tierFilter, sourceFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tierFilter !== "all") params.set("probabilityTier", tierFilter);
      if (sourceFilter !== "all") params.set("sourceType", sourceFilter);
      return fetch(`/api/admin/deal-intelligence?${params}`).then(r => r.json());
    },
    enabled: authed,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["/api/admin/deal-intelligence/summary"],
    queryFn: () => fetch("/api/admin/deal-intelligence/summary").then(r => r.json()),
    enabled: authed,
  });

  const analyseAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/deal-intelligence/analyse-all"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deal-intelligence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deal-intelligence/summary"] });
      toast({ title: `Analysis complete`, description: data.message ?? `${data.processed} deals scored` });
    },
    onError: () => toast({ title: "Analysis failed", variant: "destructive" }),
  });

  const outcomeMutation = useMutation({
    mutationFn: ({ id, outcomeResult }: { id: string; outcomeResult: string }) =>
      apiRequest("PATCH", `/api/admin/deal-intelligence/${id}/outcome`, { outcomeResult }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deal-intelligence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deal-intelligence/summary"] });
      toast({ title: "Outcome recorded" });
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
            <p className="text-white/40 text-sm mt-1">AI Deal Intelligence</p>
          </div>
          <div className="space-y-3">
            <Input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Admin email" type="email" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            <Input value={authPw} onChange={e => setAuthPw(e.target.value)} placeholder="Password" type="password" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {authErr && <p className="text-red-400 text-xs">Invalid credentials</p>}
            <button onClick={handleLogin} className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[#0f0f13] font-semibold py-2 rounded-lg transition-colors" data-testid="button-login">Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  const activeDeals = deals.filter(d => d.outcomeResult === "pending" || !d.outcomeResult);
  const closedDeals = deals.filter(d => d.outcomeResult && d.outcomeResult !== "pending");

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-white" data-testid="page-deal-intelligence">
      {/* Nav */}
      <div className="bg-[hsl(220,18%,10%)] border-b border-[rgba(255,255,255,0.06)] px-6 py-3 flex items-center gap-4">
        <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase">TCD Admin</div>
        <div className="text-white/20">·</div>
        <a href="/admin/dashboard" className="text-white/40 hover:text-white/70 text-sm transition-colors">Dashboard</a>
        <div className="text-white/20">·</div>
        <span className="text-white text-sm font-medium">AI Deal Intelligence</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => analyseAllMutation.mutate()}
            disabled={analyseAllMutation.isPending}
            className="flex items-center gap-1.5 text-xs border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.08)] text-[hsl(43,78%,65%)] rounded-lg px-3 py-1.5 hover:bg-[rgba(201,168,76,0.15)] transition-colors disabled:opacity-50"
            data-testid="button-analyse-all"
          >
            {analyseAllMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Analyse All
          </button>
          <a href="/admin/dashboard" className="text-white/40 hover:text-white text-xs border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 transition-colors">← Dashboard</a>
        </div>
      </div>

      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-white font-serif text-2xl font-bold flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[hsl(43,78%,52%)]" /> AI Deal Intelligence Engine
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Win probability · expected value · gross profit · next action · offer strategy — across all leads, planning requests, quotes, and radar signals
          </p>
        </div>

        {/* Summary KPIs */}
        {summaryLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,78%,52%)]" /></div>
        ) : summary ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "High Probability", value: summary.highCount, sub: "≥65% win prob", icon: Target, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "Medium Probability", value: summary.mediumCount, sub: "35–64% win prob", icon: BarChart3, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Weighted Revenue", value: fmtVal(summary.totalWeightedRevenue), sub: "probability-adjusted", icon: DollarSign, color: "text-[hsl(43,78%,65%)]", bg: "bg-[rgba(201,168,76,0.1)] border-[rgba(201,168,76,0.2)]" },
              { label: "Weighted Profit", value: fmtVal(summary.totalWeightedProfit), sub: `avg ${summary.avgWinProbability}% win prob`, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
            ].map(kpi => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className={`border rounded-xl p-4 ${kpi.bg}`} data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                    <p className="text-white/50 text-xs">{kpi.label}</p>
                  </div>
                  <p className={`text-xl font-bold font-serif ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-white/25 text-[11px] mt-0.5">{kpi.sub}</p>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Best deals to chase — summary spotlight */}
        {summary && summary.bestDeals.length > 0 && (
          <div className="mb-8 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h3 className="text-white font-semibold text-sm">Best Deals to Chase Now</h3>
              <span className="ml-auto text-white/25 text-xs">Top high-probability by weighted revenue</span>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {summary.bestDeals.map((deal, idx) => (
                <div key={deal.id} className="flex items-center px-5 py-3 gap-4 hover:bg-white/[0.015] transition-colors">
                  <span className="text-white/15 text-sm font-bold w-5 flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{deal.companyName}</p>
                    {deal.recommendedNextAction && (
                      <p className="text-amber-400/70 text-xs truncate mt-0.5">{deal.recommendedNextAction}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[hsl(43,78%,65%)] font-bold text-sm">{fmtVal(deal.weightedExpectedRevenue)}</p>
                      <p className="text-white/25 text-[10px]">weighted</p>
                    </div>
                    <span className="text-[11px] font-bold border border-green-500/30 bg-green-500/10 text-green-400 rounded-full px-2 py-0.5">
                      {deal.winProbability}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters + view toggle */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: "All Deals" },
              { key: "high", label: "High Probability" },
              { key: "medium", label: "Medium" },
              { key: "low", label: "Low" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setTierFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  tierFilter === f.key
                    ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]"
                    : "border-[rgba(255,255,255,0.08)] text-white/40 hover:text-white/70"
                }`}
                data-testid={`filter-tier-${f.key}`}
              >{f.label}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: "All Sources" },
              { key: "prospect", label: "Pipeline" },
              { key: "planning_request", label: "Planning" },
              { key: "radar", label: "Radar" },
              { key: "lead", label: "Inbound" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setSourceFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  sourceFilter === f.key
                    ? "bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.15)] text-white"
                    : "border-[rgba(255,255,255,0.06)] text-white/30 hover:text-white/60"
                }`}
                data-testid={`filter-source-${f.key}`}
              >{f.label}</button>
            ))}
          </div>
        </div>

        {/* Deal cards grid */}
        {dealsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,78%,52%)]" />
          </div>
        ) : (
          <>
            {activeDeals.length === 0 && (
              <div className="text-center py-16">
                <Sparkles className="w-8 h-8 text-white/15 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No deals scored yet.</p>
                <button
                  onClick={() => analyseAllMutation.mutate()}
                  className="mt-4 text-sm text-[hsl(43,78%,65%)] underline underline-offset-4"
                >
                  Run analysis now →
                </button>
              </div>
            )}

            {/* Active deals */}
            {activeDeals.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="deal-intelligence-grid">
                {activeDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onMarkOutcome={(id, outcome) => outcomeMutation.mutate({ id, outcomeResult: outcome })}
                  />
                ))}
              </div>
            )}

            {/* Closed deals */}
            {closedDeals.length > 0 && (
              <div className="mt-8">
                <h3 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">Closed / Resolved</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 opacity-50">
                  {closedDeals.map(deal => (
                    <div key={deal.id} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.04)] rounded-xl p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-white/50 font-semibold text-sm">{deal.companyName}</p>
                        <p className="text-white/25 text-xs mt-0.5">{fmtVal(deal.estimatedProjectValue)}</p>
                      </div>
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${
                        deal.outcomeResult === "won" ? "text-green-400 border-green-500/20 bg-green-500/5"
                        : deal.outcomeResult === "lost" ? "text-red-400 border-red-500/20 bg-red-500/5"
                        : "text-white/20 border-white/10"
                      }`}>
                        {deal.outcomeResult?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
