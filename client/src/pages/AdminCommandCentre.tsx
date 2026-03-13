import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { validateAdminLogin } from "@/lib/adminAuth";
import {
  LayoutDashboard, TrendingUp, DollarSign, Users, Star, AlertTriangle,
  CheckCircle2, XCircle, Zap, Target, FileText, Package, ChevronRight,
  Phone, Mail, Megaphone, ExternalLink, Eye, BarChart3, Shield, Calendar,
  Layers, Crown, RefreshCw, Building2, Briefcase, Radio, MapPin, ArrowRight,
  Loader2, Network, Radar, Brain, Crosshair,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanningRequest {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  city?: string;
  projectType?: string;
  squareMetres?: string;
  staffCount?: string;
  meetingRooms?: string;
  receptionRequired?: boolean;
  breakoutRequired?: boolean;
  executiveOfficeRequired?: boolean;
  budgetRange?: string;
  stylePreference?: string;
  specialRequirements?: string;
  aiRecommendations?: string;
  aiSummary?: string;
  leadScore?: number;
  estimatedValue?: string;
  implementationTimeline?: string;
  status: string;
  adminNotes?: string;
  isPaid?: boolean;
  paymentStatus?: string;
  quoteStatus?: string;
  createdAt?: string;
}

interface Lead {
  id: string;
  type: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message?: string;
  budget?: string;
  officeSize?: string;
  staffCount?: string;
  createdAt?: string;
}

interface OppSignal {
  type: string;
  confidence: number;
  source: string;
  reason: string;
}

interface OppRecord {
  id: string;
  sourceType: "inbound_lead" | "planning_request";
  name: string;
  company: string;
  email: string;
  phone: string;
  leadType: string;
  opportunityScore: number;
  opportunityTier: "enterprise" | "high" | "medium" | "low";
  signals: OppSignal[];
  nextAction: string;
  estimatedValueRange: string;
  createdAt: string;
  isPaid?: boolean;
  status?: string;
  details: {
    officeSize?: string | null;
    staffCount?: string | null;
    budget?: string | null;
    timeline?: string | null;
    message?: string | null;
    officeLocation?: string | null;
    squareMetres?: string | null;
    budgetRange?: string | null;
    stylePreference?: string | null;
    city?: string | null;
  };
}

interface OppIntelligenceResult {
  all: OppRecord[];
  highOpportunities: OppRecord[];
  mediumOpportunities: OppRecord[];
  summary: { total: number; highCount: number; mediumCount: number; lowCount: number };
}

interface PipelineStats {
  total: number;
  highValueCount: number;
  mediumCount: number;
  lowCount: number;
  paidCount: number;
  unscoredInDb: number;
  avgScore: number;
  totalPipelineValue: number;
  stageCounts: Record<string, number>;
  stageValues: Record<string, number>;
  topLeads: Array<{
    id: string; score: number; value: number;
    aiEstimatedValue?: string | null;
    aiTimeline?: string | null;
    aiOfficeType?: string | null;
  }>;
}

// ─── Client-side helpers (used for per-record display, not KPI totals) ────────

const STYLE_RATES: Record<string, number> = {
  "Luxury Executive": 1500,
  "Corporate Prestige": 1200,
  "Modern Open Plan": 950,
  "Warm Timber / Premium": 1100,
  "Minimal": 800,
  "Mixed / Flexible": 900,
};

function parseAiRec(req: PlanningRequest): Record<string, any> | null {
  if (!req.aiRecommendations) return null;
  try {
    const p = JSON.parse(req.aiRecommendations);
    return typeof p === "object" && p ? p : null;
  } catch { return null; }
}

function parseValueStr(v?: string | null): number {
  if (!v) return 0;
  const nums = (v.match(/[\d,]+/g) || []).map(s => parseInt(s.replace(/,/g, ""), 10));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

// Mirrors the AI prompt scoring criteria exactly
function computeScore(req: PlanningRequest, aiRec: Record<string, any> | null): number {
  if (req.leadScore != null) return req.leadScore;
  if (aiRec?.leadScore != null && typeof aiRec.leadScore === "number") return aiRec.leadScore;
  let score = 0;
  const staff = parseInt(req.staffCount || "0", 10);
  const pt = (req.projectType || "").toLowerCase();
  const budget = req.budgetRange || "";
  // Staff count → up to 30 pts
  if (staff >= 50) score += 30;
  else if (staff >= 25) score += 21;
  else if (staff >= 15) score += 16;
  else if (staff >= 10) score += 12;
  else if (staff >= 5) score += 8;
  else if (staff >= 1) score += 5;
  // Budget / project value → up to 25 pts
  if (budget.includes("300,000") || budget.startsWith("$300") || budget === "$300,000+") score += 25;
  else if (budget.includes("180,000")) score += 21;
  else if (budget.includes("100,000")) score += 17;
  else if (budget.includes("60,000")) score += 13;
  else if (budget.includes("30,000")) score += 9;
  else if (budget && budget !== "Not specified") score += 5;
  // Expansion signals → +20 pts
  if (pt.includes("reloc") || pt.includes("new office") || pt.includes("expan") || pt.includes("new hq")) score += 20;
  // Budget clarity → +15 pts
  if (budget && budget !== "Not specified") score += 15;
  // Multiple zones required → up to 10 pts
  let zones = 0;
  if (req.receptionRequired) zones++;
  if (req.breakoutRequired) zones++;
  if (req.executiveOfficeRequired) zones++;
  if (req.meetingRooms && req.meetingRooms !== "0") zones++;
  score += Math.min(zones * 3, 10);
  return Math.min(score, 100);
}

function computeValue(req: PlanningRequest, aiRec: Record<string, any> | null): { num: number; display: string } {
  // Priority 1: stored estimatedValue
  if (req.estimatedValue) {
    const v = parseValueStr(req.estimatedValue);
    if (v > 0) return { num: v, display: req.estimatedValue };
  }
  // Priority 2: AI-generated text value from JSON
  if (aiRec?.estimatedProjectValue) {
    const v = parseValueStr(aiRec.estimatedProjectValue);
    if (v > 0) return { num: v, display: aiRec.estimatedProjectValue };
  }
  // Priority 3: costBreakdown total from AI
  if (aiRec?.costBreakdown?.total && typeof aiRec.costBreakdown.total === "number") {
    const t = aiRec.costBreakdown.total;
    return { num: t, display: `$${Math.round(t * 0.85).toLocaleString("en-AU")} – $${t.toLocaleString("en-AU")}` };
  }
  // Priority 4: sqm × style rate
  const sqm = parseFloat(req.squareMetres || "0");
  const rate = STYLE_RATES[req.stylePreference || ""] || 900;
  if (sqm >= 20) {
    const t = Math.round(sqm * rate);
    return { num: t, display: `$${Math.round(t * 0.85).toLocaleString("en-AU")} – $${t.toLocaleString("en-AU")}` };
  }
  // Priority 5: budget midpoint
  const b = req.budgetRange || "";
  if (b === "$300,000+") return { num: 400000, display: "$300,000+" };
  if (b.includes("180,000")) return { num: 240000, display: b };
  if (b.includes("100,000")) return { num: 140000, display: b };
  if (b.includes("60,000")) return { num: 80000, display: b };
  if (b.includes("30,000")) return { num: 45000, display: b };
  return { num: 0, display: "" };
}

function getScoreTier(score: number) {
  if (score >= 70) return {
    label: "High Value", color: "text-[hsl(43,78%,65%)]",
    bg: "bg-[rgba(201,168,76,0.12)] border-[rgba(201,168,76,0.25)]",
    bar: "bg-[hsl(43,78%,52%)]",
  };
  if (score >= 45) return {
    label: "Medium", color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20", bar: "bg-blue-500",
  };
  return {
    label: "Low Priority", color: "text-white/40",
    bg: "bg-white/5 border-white/10", bar: "bg-white/25",
  };
}

function formatAUD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return n > 0 ? `$${n}` : "—";
}

function timeAgo(d?: string): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PIPELINE_STAGES = ["New", "In Review", "Quoted", "Converted"] as const;
const STAGE_BAR_COLORS: Record<string, string> = {
  "New": "bg-blue-500", "In Review": "bg-purple-500",
  "Quoted": "bg-amber-500", "Converted": "bg-green-500",
};

interface RadarRecord {
  id: string;
  companyName: string;
  city: string;
  state: string | null;
  industry: string | null;
  signalType: string;
  priority: string;
  radarScore: number;
  estimatedProjectValue: string | null;
  estimatedOfficeSizeSqm: string | null;
  status: string;
  createdAt: string;
}

interface RadarStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  newCount: number;
  inPipeline: number;
  avgScore: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCommandCentre() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "Command Centre | The Corporate Desk";
    if (sessionStorage.getItem("tcd_admin_auth") === "true") setAuthed(true);
  }, []);

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<PipelineStats>({
    queryKey: ["/api/admin/pipeline-stats"],
    enabled: authed,
  });

  const { data: requests = [], isLoading: reqLoading } = useQuery<PlanningRequest[]>({
    queryKey: ["/api/admin/planning-requests"],
    enabled: authed,
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    enabled: authed,
  });

  const { data: health } = useQuery<{ email: boolean; stripe: boolean }>({
    queryKey: ["/api/health"],
    enabled: authed,
    refetchInterval: 60000,
  });

  const { data: oppIntelligence, isLoading: oppLoading } = useQuery<OppIntelligenceResult>({
    queryKey: ["/api/admin/opportunity-intelligence"],
    enabled: authed,
    staleTime: 60000,
  });

  const { data: radarStats } = useQuery<RadarStats>({
    queryKey: ["/api/admin/office-move-radar/stats"],
    enabled: authed,
    refetchInterval: 60000,
  });

  const { data: radarRecords = [] } = useQuery<RadarRecord[]>({
    queryKey: ["/api/admin/office-move-radar", "", "", "", "New"],
    queryFn: () => fetch("/api/admin/office-move-radar?status=New").then(r => r.json()),
    enabled: authed && (radarStats?.total ?? 0) > 0,
    refetchInterval: 60000,
  });

  const { data: dealIntelSummary } = useQuery<{
    total: number; highCount: number; mediumCount: number; lowCount: number;
    totalWeightedRevenue: number; totalWeightedProfit: number; avgWinProbability: number;
    bestDeals: any[]; highestProfit: any[]; atRiskQuoted: any[];
  }>({
    queryKey: ["/api/admin/deal-intelligence/summary"],
    enabled: authed,
    staleTime: 120000,
  });

  // ── Score backfill mutation ─────────────────────────────────────────────────
  const backfillMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/planning-requests/backfill-scores", {});
    },
    onSuccess: (data: any) => {
      const updated = (data?.results || []).filter((r: any) => r.action === "updated").length;
      toast({
        title: updated > 0 ? `${updated} record${updated !== 1 ? "s" : ""} updated` : "Already up to date",
        description: updated > 0
          ? "Lead scores and estimated values synced from AI recommendations."
          : "All records already have scores — no changes needed.",
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/planning-requests"] });
      refetchStats();
    },
    onError: () => toast({ title: "Sync failed", description: "Could not sync scores. Try again.", variant: "destructive" }),
  });

  // ── Rescore all leads with updated scoring model ────────────────────────────
  const rescoreMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/opportunity-intelligence/rescore-all", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: `${data?.updated || 0} leads rescored`,
        description: "All leads recalculated with updated scoring model (v2). Enterprise tier now active.",
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/opportunity-intelligence"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/leads"] });
    },
    onError: () => toast({ title: "Rescore failed", description: "Could not rescore leads.", variant: "destructive" }),
  });

  // ── Per-record enrichment for the opportunity list ─────────────────────────
  const enrichedRequests = useMemo(() =>
    requests.map(r => {
      const aiRec = parseAiRec(r);
      const score = computeScore(r, aiRec);
      const val = computeValue(r, aiRec);
      return {
        ...r,
        _score: score,
        _value: val.num,
        _valueDisplay: val.display,
        _aiOfficeType: aiRec?.officeType || null,
        _aiTimeline: aiRec?.implementationTimeline || r.implementationTimeline || null,
        _aiSummary: r.aiSummary || aiRec?.clientBrief || null,
        _aiRec: aiRec,
      };
    }).sort((a, b) => b._score - a._score),
    [requests]
  );

  const topOpportunities = enrichedRequests.slice(0, 6);
  const paidRequests = enrichedRequests.filter(r => r.isPaid);
  const highValueRequests = enrichedRequests.filter(r => r._score >= 70);

  // Lead type breakdowns from actual DB data
  const leadTypeMap = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { map[l.type] = (map[l.type] || 0) + 1; });
    return map;
  }, [leads]);

  // ── Auth ────────────────────────────────────────────────────────────────────
  function handleLogin() {
    if (validateAdminLogin(email, pw)) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  // ── Login screen ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-4">
              <span className="text-2xl font-serif font-bold text-white">THE CORPORATE</span>
              <span className="text-sm font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
            </div>
            <h1 className="text-xl font-semibold text-white">Command Centre</h1>
            <p className="text-white/40 text-sm mt-1">Authorised access only</p>
          </div>
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Admin Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="admin@thecorporatedesk.com.au"
                data-testid="input-admin-email"
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Password</label>
              <input
                type="password" value={pw} onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter password"
                data-testid="input-admin-password"
                className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base ${pwError ? "border-red-500/50" : "border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)]"}`}
              />
              {pwError && <p className="text-red-400 text-xs mt-1">Invalid credentials.</p>}
            </div>
            <Button onClick={handleLogin} className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]" data-testid="button-admin-login">
              Access Command Centre
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = statsLoading || reqLoading;

  // Use server stats where available, fall back to client-side
  const kpiPipeline = stats?.totalPipelineValue ?? enrichedRequests.reduce((s, r) => s + r._value, 0);
  const kpiHighValue = stats?.highValueCount ?? highValueRequests.length;
  const kpiPaid = stats?.paidCount ?? paidRequests.length;
  const kpiAvgScore = stats?.avgScore ?? (enrichedRequests.length > 0
    ? Math.round(enrichedRequests.reduce((s, r) => s + r._score, 0) / enrichedRequests.length) : 0);
  const kpiUnscored = stats?.unscoredInDb ?? 0;
  const stageCounts = stats?.stageCounts ?? {};
  const stageValues = stats?.stageValues ?? {};

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-[hsl(220,18%,8%)] border-b border-[rgba(201,168,76,0.1)] px-4 sm:px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="flex flex-col cursor-pointer">
                <span className="text-base font-serif font-bold text-white leading-tight">THE CORPORATE</span>
                <span className="text-xs font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
              </div>
            </Link>
            <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
              <span className="text-white font-semibold text-sm">Command Centre</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync button — reads aiRecommendations JSON and populates DB columns */}
            <Button
              size="sm"
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
              className="bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.2)] min-h-[38px] text-xs"
              data-testid="button-sync-scores"
              title={kpiUnscored > 0 ? `${kpiUnscored} records missing stored scores` : "Sync AI scores to database"}
            >
              {backfillMutation.isPending
                ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Syncing…</>
                : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Sync AI Scores{kpiUnscored > 0 ? ` (${kpiUnscored})` : ""}</>
              }
            </Button>
            <Button asChild size="sm" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[38px] text-xs">
              <Link href="/admin/dashboard"><LayoutDashboard className="w-3.5 h-3.5 mr-1" /> Dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[38px] text-xs">
              <Link href="/admin/planning-requests"><FileText className="w-3.5 h-3.5 mr-1" /> Requests</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-white/50 hover:text-white min-h-[38px] text-xs">
              <a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Site</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Page title ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-1">Business Command Centre</h1>
            <p className="text-white/40 text-sm">
              Real-time pipeline intelligence — scores derived from{" "}
              {requests.filter(r => r.leadScore != null).length > 0
                ? `${requests.filter(r => r.leadScore != null).length} AI-scored records + formula fallback`
                : "formula model (sync AI scores to populate from existing AI data)"}
            </p>
          </div>
          <p className="text-white/25 text-xs hidden sm:block text-right">
            {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* ── System health alerts ─────────────────────────────────────────── */}
        {health && (!health.email || !health.stripe) && (
          <div className="bg-[rgba(251,146,60,0.06)] border border-[rgba(251,146,60,0.2)] rounded-2xl overflow-hidden" data-testid="panel-system-alerts">
            <div className="px-5 py-3 border-b border-[rgba(251,146,60,0.12)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 text-sm font-semibold">Revenue-Critical System Alerts</span>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {!health.stripe && (
                <div className="flex items-start gap-2.5 bg-[rgba(255,255,255,0.03)] rounded-xl p-3.5 border border-[rgba(251,146,60,0.15)] flex-1 min-w-[240px]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">Stripe not configured</p>
                    <p className="text-white/50 text-xs mt-0.5">$399 unlock is broken for all users. Add <code className="text-orange-300 bg-white/8 px-1 rounded">STRIPE_SECRET_KEY</code> to Secrets.</p>
                  </div>
                </div>
              )}
              {!health.email && (
                <div className="flex items-start gap-2.5 bg-[rgba(255,255,255,0.03)] rounded-xl p-3.5 border border-[rgba(251,146,60,0.15)] flex-1 min-w-[240px]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">Email notifications off</p>
                    <p className="text-white/50 text-xs mt-0.5">Lead alerts silently dropping. Add <code className="text-orange-300 bg-white/8 px-1 rounded">SMTP_HOST</code>, <code className="text-orange-300 bg-white/8 px-1 rounded">SMTP_USER</code>, <code className="text-orange-300 bg-white/8 px-1 rounded">SMTP_PASS</code>.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Sync status notice ───────────────────────────────────────────── */}
        {!isLoading && kpiUnscored > 0 && (
          <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl px-4 py-3 flex items-center gap-3" data-testid="panel-sync-notice">
            <AlertTriangle className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
            <p className="text-white/70 text-sm flex-1">
              <span className="text-[hsl(43,78%,65%)] font-semibold">{kpiUnscored} records</span> have AI data stored but not yet synced to the scoring database.
              Click <span className="text-[hsl(43,78%,65%)] font-semibold">Sync AI Scores</span> above to populate in seconds — no API calls needed.
            </p>
            <Button size="sm" onClick={() => backfillMutation.mutate()} disabled={backfillMutation.isPending}
              className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold text-xs flex-shrink-0 min-h-[34px]">
              {backfillMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Sync Now"}
            </Button>
          </div>
        )}

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Estimated Pipeline", value: isLoading ? "—" : formatAUD(kpiPipeline),
              sub: `${requests.length} planner submission${requests.length !== 1 ? "s" : ""}`,
              icon: DollarSign, color: "text-[hsl(43,78%,65%)]",
              bg: "bg-[rgba(201,168,76,0.08)] border-[rgba(201,168,76,0.15)]",
              testId: "stat-pipeline-value",
            },
            {
              label: "High-Value Leads", value: isLoading ? "—" : kpiHighValue,
              sub: `Score ≥70 · avg score ${kpiAvgScore}/100`,
              icon: Crown, color: "text-amber-400",
              bg: "bg-amber-500/8 border-amber-500/15",
              testId: "stat-high-value",
            },
            {
              label: "Paid Unlocks", value: isLoading ? "—" : kpiPaid,
              sub: `$${(kpiPaid * 399).toLocaleString("en-AU")} AUD collected`,
              icon: Shield, color: "text-green-400",
              bg: "bg-green-500/8 border-green-500/15",
              testId: "stat-paid-unlocks",
            },
            {
              label: "Web Leads", value: isLoading ? "—" : leads.length,
              sub: Object.entries(leadTypeMap).map(([t, n]) => `${n} ${t}`).join(" · ") || "No leads yet",
              icon: Target, color: "text-blue-400",
              bg: "bg-blue-500/8 border-blue-500/15",
              testId: "stat-web-leads",
            },
          ].map(({ label, value, sub, icon: Icon, color, bg, testId }) => (
            <div key={label} className={`rounded-2xl border p-5 ${bg}`} data-testid={testId}>
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center border mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold font-serif ${color} mb-0.5`}>{value}</p>
              <p className="text-white/50 text-xs">{label}</p>
              <p className="text-white/25 text-xs mt-0.5 truncate">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Deal Pipeline + Commercial Mix ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Pipeline funnel */}
          <div className="lg:col-span-2 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                <h2 className="text-white font-semibold text-sm">Deal Pipeline</h2>
              </div>
              <Link href="/admin/planning-requests">
                <button className="text-[hsl(43,78%,52%)] text-xs hover:underline flex items-center gap-1">
                  Manage <ChevronRight className="w-3 h-3" />
                </button>
              </Link>
            </div>
            <div className="p-6">
              {/* Visual bar */}
              <div className="flex gap-1 mb-4 h-3 rounded-full overflow-hidden">
                {PIPELINE_STAGES.map(stage => {
                  const count = stageCounts[stage] || 0;
                  const total = requests.length || 1;
                  const pct = Math.max((count / total) * 100, count > 0 ? 4 : 0);
                  return (
                    <div key={stage} style={{ width: `${pct}%` }}
                      className={`${STAGE_BAR_COLORS[stage]} rounded-full`}
                      title={`${stage}: ${count}`} />
                  );
                })}
                {requests.length === 0 && <div className="w-full bg-white/5 rounded-full" />}
              </div>
              {/* Stage cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PIPELINE_STAGES.map(stage => {
                  const count = stageCounts[stage] || 0;
                  const val = stageValues[stage] || 0;
                  return (
                    <div key={stage} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 border border-[rgba(255,255,255,0.05)]" data-testid={`stage-${stage.toLowerCase().replace(" ", "-")}`}>
                      <p className="text-white/40 text-xs mb-1">{stage}</p>
                      <p className="text-white font-bold text-lg">{count}</p>
                      {val > 0 && <p className="text-[hsl(43,78%,65%)] text-xs mt-0.5">{formatAUD(val)}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Commercial mix */}
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Commercial Mix</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "High Value (score ≥70)", count: kpiHighValue, icon: Crown, color: "text-[hsl(43,78%,65%)]" },
                { label: "Medium (score 45–69)", count: stats?.mediumCount ?? enrichedRequests.filter(r => r._score >= 45 && r._score < 70).length, icon: Star, color: "text-blue-400" },
                { label: "Low Priority (<45)", count: stats?.lowCount ?? enrichedRequests.filter(r => r._score < 45).length, icon: Target, color: "text-white/30" },
                { label: "Paid Report Access", count: kpiPaid, icon: Shield, color: "text-green-400" },
                { label: "Relocation / Expansion", count: enrichedRequests.filter(r => /(reloc|new office|expan)/i.test(r.projectType || "")).length, icon: Building2, color: "text-amber-400" },
                { label: "Web Leads (all types)", count: leads.length, icon: Users, color: "text-purple-400" },
              ].map(({ label, count, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
                  <span className="text-white/55 text-xs flex-1">{label}</span>
                  <span className={`font-bold text-sm ${count > 0 ? "text-white" : "text-white/20"}`}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Top Opportunities ────────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Top Opportunities</h2>
              <span className="text-white/30 text-xs ml-1">ranked by lead score</span>
            </div>
            <Link href="/admin/planning-requests">
              <button className="text-[hsl(43,78%,52%)] text-xs hover:underline items-center gap-1 hidden sm:flex">
                Full view <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-white/30 text-sm">Loading submissions…</div>
          ) : topOpportunities.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">
              No planner submissions yet. They appear here as the AI Planner is used.
            </div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {topOpportunities.map((req, idx) => {
                const score = req._score;
                const tier = getScoreTier(score);
                const isHighest = idx === 0;
                return (
                  <div key={req.id} className={`p-5 ${isHighest ? "bg-[rgba(201,168,76,0.04)]" : ""}`}
                    data-testid={`opportunity-row-${req.id}`}>
                    <div className="flex items-start gap-4">
                      {/* Rank */}
                      <div className="w-9 h-9 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Name + tier */}
                        <div className="flex flex-wrap items-start gap-2 mb-1.5">
                          <p className="text-white font-semibold text-sm">{req.name}</p>
                          {req.company && <span className="text-white/40 text-sm">· {req.company}</span>}
                          {req._aiOfficeType && (
                            <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-full border border-white/10">{req._aiOfficeType}</span>
                          )}
                          <Badge className={`text-xs border ml-auto ${tier.bg} ${tier.color}`}>{tier.label}</Badge>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40 mb-2">
                          {req.projectType && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{req.projectType}</span>}
                          {req.squareMetres && <span>{req.squareMetres} sqm</span>}
                          {req.staffCount && <span><Users className="w-3 h-3 inline mr-0.5" />{req.staffCount} staff</span>}
                          {req.budgetRange && <span>{req.budgetRange}</span>}
                          {req._aiTimeline && <span><Calendar className="w-3 h-3 inline mr-0.5" />{req._aiTimeline}</span>}
                          {req.city && <span>{req.city}</span>}
                          <span className="ml-auto text-white/25">{timeAgo(req.createdAt)}</span>
                        </div>

                        {/* Score bar + value */}
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full ${tier.bar} rounded-full`} style={{ width: `${score}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${tier.color}`} data-testid={`score-${req.id}`}>{score}/100</span>
                            {req.leadScore != null && (
                              <span className="text-white/25 text-xs">(AI)</span>
                            )}
                          </div>
                          {req._valueDisplay && (
                            <span className="text-[hsl(43,78%,65%)] text-xs font-semibold" data-testid={`value-${req.id}`}>
                              {req._valueDisplay.startsWith("$") ? req._valueDisplay : formatAUD(req._value)} est.
                            </span>
                          )}
                          {req.isPaid && (
                            <span className="text-xs text-green-400 flex items-center gap-1"><Shield className="w-3 h-3" />Paid</span>
                          )}
                        </div>

                        {/* AI brief */}
                        {req._aiSummary && (
                          <p className="text-white/40 text-xs leading-relaxed mb-2 italic">"{req._aiSummary.slice(0, 140)}{req._aiSummary.length > 140 ? "…" : ""}"</p>
                        )}

                        {/* Contact + actions */}
                        <div className="flex flex-wrap gap-3 items-center">
                          <a href={`mailto:${req.email}`} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[hsl(43,78%,65%)] transition-colors">
                            <Mail className="w-3 h-3" />{req.email}
                          </a>
                          {req.phone && (
                            <a href={`tel:${req.phone}`} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[hsl(43,78%,65%)] transition-colors">
                              <Phone className="w-3 h-3" />{req.phone}
                            </a>
                          )}
                          <Link href="/admin/planning-requests">
                            <button className="ml-auto flex items-center gap-1 text-xs text-[hsl(43,78%,52%)] hover:underline">
                              <Eye className="w-3 h-3" /> Full brief
                            </button>
                          </Link>
                        </div>

                        {/* CEO recommendation for high-value leads */}
                        {score >= 70 && (
                          <div className="mt-3 p-3 bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl">
                            <p className="text-[hsl(43,78%,65%)] text-xs font-semibold mb-1 flex items-center gap-1.5">
                              <Crown className="w-3 h-3" /> CEO Recommendation
                            </p>
                            <p className="text-white/60 text-xs leading-relaxed">
                              {req._value >= 200000
                                ? `Priority contact. ${req._valueDisplay || formatAUD(req._value)} estimated project — senior consultant call within 24h. Prepare full proposal package.`
                                : req._value >= 100000
                                ? `Strong commercial opportunity. ${req._valueDisplay || formatAUD(req._value)} estimated — book strategy call and prepare preliminary quote.`
                                : `Qualified lead. Score ${score}/100. Follow up within 48h with workspace concept and product recommendations.`
                              }
                              {req._aiRec?.recommendedNextStep && (
                                <span className="block mt-1 text-white/40">AI suggests: {req._aiRec.recommendedNextStep}</span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Opportunity Intelligence Panel ───────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl overflow-hidden" data-testid="panel-opportunity-intelligence">
          <div className="px-6 py-4 border-b border-[rgba(201,168,76,0.15)] flex items-center justify-between bg-[rgba(201,168,76,0.04)]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">High Opportunity Intelligence</h2>
              <span className="text-white/30 text-xs ml-1">— inbound leads + planner submissions scored by office move signals</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {oppIntelligence && (
                <>
                  {(oppIntelligence.summary as any).enterpriseCount > 0 && (
                    <span className="text-purple-300 text-xs font-bold">{(oppIntelligence.summary as any).enterpriseCount} ENTERPRISE</span>
                  )}
                  <span className="text-[hsl(43,78%,65%)] text-xs font-bold">{oppIntelligence.summary.highCount} HIGH</span>
                  <span className="text-blue-400 text-xs">{oppIntelligence.summary.mediumCount} MED</span>
                  <span className="text-white/30 text-xs">{oppIntelligence.summary.lowCount} LOW</span>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-white/40 hover:text-white text-xs min-h-[28px] h-7 px-2"
                onClick={() => rescoreMutation.mutate()}
                disabled={rescoreMutation.isPending}
                data-testid="button-rescore-all"
              >
                {rescoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Rescore All
              </Button>
            </div>
          </div>

          {oppLoading ? (
            <div className="p-8 text-center text-white/30 text-sm">Scoring opportunities…</div>
          ) : !oppIntelligence || oppIntelligence.summary.highCount === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">
              No high-opportunity signals detected yet. New leads and planner submissions are scored automatically on arrival.
            </div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {oppIntelligence.highOpportunities.slice(0, 8).map((rec) => {
                const tierBg = rec.opportunityTier === "enterprise"
                  ? "bg-purple-500/15 border-purple-400/30 text-purple-300"
                  : rec.opportunityTier === "high"
                  ? "bg-[rgba(201,168,76,0.12)] border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)]"
                  : rec.opportunityTier === "medium"
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  : "bg-white/5 border-white/10 text-white/40";
                const tierBar = rec.opportunityTier === "enterprise" ? "bg-purple-400" : rec.opportunityTier === "high" ? "bg-[hsl(43,78%,52%)]" : rec.opportunityTier === "medium" ? "bg-blue-500" : "bg-white/20";
                const sourceLabel = rec.sourceType === "inbound_lead" ? "Web Lead" : "Planner";
                const sourceBadge = rec.sourceType === "inbound_lead"
                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20";
                return (
                  <div key={`${rec.sourceType}-${rec.id}`} className="p-5 bg-[rgba(201,168,76,0.02)]" data-testid={`opp-record-${rec.id}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 text-[hsl(43,78%,65%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Name + badges */}
                        <div className="flex flex-wrap items-start gap-2 mb-1.5">
                          <p className="text-white font-semibold text-sm">{rec.name}</p>
                          {rec.company && <span className="text-white/40 text-sm">· {rec.company}</span>}
                          <Badge className={`text-xs border ${sourceBadge}`}>{sourceLabel}</Badge>
                          <Badge className={`text-xs border ${tierBg} ml-auto`}>{rec.opportunityTier.toUpperCase()}</Badge>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40 mb-2">
                          {rec.leadType && rec.leadType !== "Floor Plan" && (
                            <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{rec.leadType.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                          )}
                          {(rec.details.staffCount) && <span><Users className="w-3 h-3 inline mr-0.5" />{rec.details.staffCount} staff</span>}
                          {(rec.details.squareMetres || rec.details.officeSize) && <span>{rec.details.squareMetres || rec.details.officeSize} sqm</span>}
                          {(rec.details.budgetRange || rec.details.budget) && <span>{rec.details.budgetRange || rec.details.budget}</span>}
                          {rec.details.city && <span>{rec.details.city}</span>}
                          {rec.details.officeLocation && <span>{rec.details.officeLocation}</span>}
                          <span className="ml-auto text-white/20">{timeAgo(rec.createdAt)}</span>
                        </div>

                        {/* Score bar + estimated value */}
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full ${tierBar} rounded-full`} style={{ width: `${rec.opportunityScore}%` }} />
                            </div>
                            <span className="text-xs font-bold text-[hsl(43,78%,65%)]">{rec.opportunityScore}/100</span>
                          </div>
                          {rec.estimatedValueRange && (
                            <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">{rec.estimatedValueRange} est.</span>
                          )}
                        </div>

                        {/* Detected signals */}
                        {rec.signals.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {rec.signals.slice(0, 4).map(sig => (
                              <span key={sig.type} className="text-xs bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] px-2 py-0.5 rounded-full" title={sig.reason}>
                                {sig.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                            ))}
                            {rec.signals.length > 4 && (
                              <span className="text-xs text-white/30 px-2 py-0.5">+{rec.signals.length - 4} more</span>
                            )}
                          </div>
                        )}

                        {/* Next action */}
                        {rec.nextAction && (
                          <div className="mt-2 p-2.5 bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl flex items-start gap-2">
                            <Target className="w-3 h-3 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                            <p className="text-white/60 text-xs leading-relaxed">{rec.nextAction}</p>
                          </div>
                        )}

                        {/* Contacts */}
                        <div className="flex flex-wrap gap-3 items-center mt-2">
                          <a href={`mailto:${rec.email}`} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[hsl(43,78%,65%)] transition-colors">
                            <Mail className="w-3 h-3" />{rec.email}
                          </a>
                          {rec.phone && (
                            <a href={`tel:${rec.phone}`} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[hsl(43,78%,65%)] transition-colors">
                              <Phone className="w-3 h-3" />{rec.phone}
                            </a>
                          )}
                          <Link href={rec.sourceType === "planning_request" ? "/admin/planning-requests" : "/admin/dashboard"}>
                            <button className="ml-auto flex items-center gap-1 text-xs text-[hsl(43,78%,52%)] hover:underline">
                              <Eye className="w-3 h-3" /> View record
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── AI Deal Intelligence Panel ────────────────────────────────────── */}
        {dealIntelSummary && dealIntelSummary.total > 0 && (
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,200,120,0.18)] rounded-2xl overflow-hidden" data-testid="panel-deal-intelligence">
            <div className="px-6 py-4 border-b border-[rgba(100,200,120,0.12)] flex items-center justify-between bg-[rgba(100,200,120,0.04)]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                <h2 className="text-white font-semibold text-sm">AI Deal Intelligence</h2>
                <span className="text-white/30 text-xs ml-1">— win probability · weighted revenue · next actions</span>
              </div>
              <div className="flex items-center gap-3">
                {dealIntelSummary.highCount > 0 && (
                  <span className="text-green-400 text-xs font-bold">{dealIntelSummary.highCount} HIGH PROB</span>
                )}
                {dealIntelSummary.mediumCount > 0 && (
                  <span className="text-amber-400 text-xs">{dealIntelSummary.mediumCount} MED</span>
                )}
                <span className="text-white/30 text-xs">avg {dealIntelSummary.avgWinProbability}% win</span>
                <a href="/admin/deal-intelligence" className="text-green-400/70 text-xs hover:text-green-400 flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Summary financials */}
            <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-[rgba(255,255,255,0.04)]">
              <div>
                <p className="text-white/30 text-xs mb-1">Weighted Pipeline Revenue</p>
                <p className="text-[hsl(43,78%,65%)] font-bold font-serif text-lg">{formatAUD(dealIntelSummary.totalWeightedRevenue)}</p>
              </div>
              <div>
                <p className="text-white/30 text-xs mb-1">Weighted Gross Profit</p>
                <p className="text-green-400 font-bold font-serif text-lg">{formatAUD(dealIntelSummary.totalWeightedProfit)}</p>
              </div>
            </div>

            {/* Best deals to chase */}
            {dealIntelSummary.bestDeals.length > 0 && (
              <div>
                <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.04)]">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Best Deals to Chase Now</p>
                </div>
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {dealIntelSummary.bestDeals.slice(0, 4).map((deal: any, idx: number) => (
                    <div key={deal.id} className="flex items-center px-5 py-3 gap-3 hover:bg-white/[0.015] transition-colors">
                      <span className="text-white/15 text-sm font-bold w-4 flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{deal.companyName}</p>
                        {deal.recommendedNextAction && (
                          <p className="text-amber-400/70 text-xs truncate mt-0.5">{deal.recommendedNextAction}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-[hsl(43,78%,65%)] font-bold text-sm">{formatAUD(deal.weightedExpectedRevenue ?? 0)}</p>
                          <p className="text-white/20 text-[10px]">weighted</p>
                        </div>
                        <span className="text-[10px] font-bold border border-green-500/30 bg-green-500/10 text-green-400 rounded-full px-2 py-0.5">
                          {deal.winProbability}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.04)]">
                  <a href="/admin/deal-intelligence" className="text-green-400/60 text-xs hover:text-green-400 transition-colors">
                    View full deal intelligence dashboard →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Office Move Radar Panel ──────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(250,180,50,0.18)] rounded-2xl overflow-hidden" data-testid="panel-office-move-radar">
          <div className="px-6 py-4 border-b border-[rgba(250,180,50,0.15)] flex items-center justify-between bg-[rgba(250,180,50,0.04)]">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-semibold text-sm">Office Move Radar</h2>
              <span className="text-white/30 text-xs ml-1">— companies detected relocating, expanding, or fitting out</span>
            </div>
            <div className="flex items-center gap-4">
              {radarStats && radarStats.total > 0 && (
                <>
                  {radarStats.high > 0 && <span className="text-red-400 text-xs font-bold">{radarStats.high} HIGH</span>}
                  {radarStats.medium > 0 && <span className="text-amber-400 text-xs">{radarStats.medium} MED</span>}
                  <span className="text-white/30 text-xs">{radarStats.newCount} unreviewed</span>
                </>
              )}
              <Link href="/admin/office-move-radar">
                <button data-testid="link-radar-view-all" className="text-amber-400/70 text-xs hover:text-amber-400 flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></button>
              </Link>
            </div>
          </div>

          {!radarStats || radarStats.total === 0 ? (
            <div className="p-8 text-center">
              <Radio className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm mb-2">No radar signals yet.</p>
              <p className="text-white/20 text-xs mb-4">Run a scan to detect companies relocating, expanding, or fitting out their offices.</p>
              <Link href="/admin/office-move-radar">
                <button className="text-amber-400/60 text-xs hover:text-amber-400 transition-colors flex items-center gap-1.5 mx-auto">
                  <Radio className="w-3.5 h-3.5" /> Open Radar
                </button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {radarRecords.slice(0, 6).map(rec => {
                const priorityColor = rec.priority === "High"
                  ? "text-red-400 bg-red-500/10 border-red-500/20"
                  : rec.priority === "Medium"
                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  : "text-zinc-400 bg-zinc-500/10 border-zinc-600/20";
                const signalLabel = rec.signalType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <Link key={rec.id} href="/admin/office-move-radar">
                    <div className="px-5 py-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer" data-testid={`radar-row-${rec.id}`}>
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-xl bg-[rgba(250,180,50,0.08)] border border-[rgba(250,180,50,0.15)] flex items-center justify-center flex-shrink-0">
                          <Radio className="w-4 h-4 text-amber-400/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1 flex-wrap">
                            <p className="text-white font-semibold text-sm">{rec.companyName}</p>
                            <Badge className={`text-xs border ${priorityColor}`}>{rec.priority}</Badge>
                            <span className="ml-auto text-[hsl(43,78%,65%)] text-sm font-bold">{rec.estimatedProjectValue ?? "—"}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/40">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{rec.city}</span>
                            {rec.industry && <span>{rec.industry}</span>}
                            <span className="text-amber-400/60">{signalLabel}</span>
                            <span className="ml-auto">Score {rec.radarScore}</span>
                          </div>
                          {rec.estimatedOfficeSizeSqm && (
                            <p className="text-white/30 text-xs mt-1">{rec.estimatedOfficeSizeSqm} estimated</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <ArrowRight className="w-4 h-4 text-white/20" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {radarStats.newCount > 6 && (
                <div className="px-5 py-3 text-center">
                  <Link href="/admin/office-move-radar">
                    <button className="text-white/30 text-xs hover:text-white/60 transition-colors">
                      +{radarStats.newCount - 6} more unreviewed opportunities
                    </button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom panels: Pipeline Intelligence + Recent Leads ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pipeline Intelligence */}
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Pipeline Intelligence</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Value breakdown */}
              <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl p-4">
                <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3">Value Breakdown</p>
                <div className="space-y-2">
                  {[
                    { label: "Total estimated pipeline", value: formatAUD(kpiPipeline), hi: true },
                    { label: "Average project value", value: requests.length > 0 ? formatAUD(Math.round(kpiPipeline / requests.length)) : "—" },
                    { label: "High-value share (≥$100K)", value: formatAUD(enrichedRequests.filter(r => r._value >= 100000).reduce((s, r) => s + r._value, 0)) },
                    { label: "Paid unlock revenue", value: `$${(kpiPaid * 399).toLocaleString("en-AU")}` },
                  ].map(({ label, value, hi }) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-white/50 text-xs">{label}</span>
                      <span className={`font-bold text-sm ${hi ? "text-[hsl(43,78%,65%)]" : "text-white/80"}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score distribution */}
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Lead Quality Distribution</p>
                {[
                  { label: "High Value (70–100)", count: kpiHighValue, color: "bg-[hsl(43,78%,52%)]" },
                  { label: "Medium (45–69)", count: stats?.mediumCount ?? enrichedRequests.filter(r => r._score >= 45 && r._score < 70).length, color: "bg-blue-500" },
                  { label: "Low Priority (<45)", count: stats?.lowCount ?? enrichedRequests.filter(r => r._score < 45).length, color: "bg-white/20" },
                ].map(({ label, count, color }) => {
                  const pct = requests.length > 0 ? (count / requests.length) * 100 : 0;
                  return (
                    <div key={label} className="mb-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/50 text-xs">{label}</span>
                        <span className="text-white/70 text-xs font-semibold">{count}</span>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-white/20 text-xs italic">
                {requests.filter(r => r.leadScore != null).length > 0
                  ? `${requests.filter(r => r.leadScore != null).length} of ${requests.length} records use AI-generated scores. Formula used for remaining.`
                  : "Scores computed by formula (click Sync AI Scores to use stored AI data)."}
              </p>
            </div>
          </div>

          {/* Recent Web Leads */}
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                <h2 className="text-white font-semibold text-sm">Recent Web Leads</h2>
              </div>
              <Link href="/admin/leads">
                <button className="text-[hsl(43,78%,52%)] text-xs hover:underline flex items-center gap-1">
                  All leads <ChevronRight className="w-3 h-3" />
                </button>
              </Link>
            </div>
            {leads.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">No web leads yet.</div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {leads.slice(0, 8).map(lead => {
                  const typeColors: Record<string, string> = {
                    "layout-plan": "text-blue-400 bg-blue-500/10 border-blue-500/20",
                    "quote-request": "text-[hsl(43,78%,65%)] bg-[rgba(201,168,76,0.12)] border-[rgba(201,168,76,0.2)]",
                    "strategy-call": "text-purple-400 bg-purple-500/10 border-purple-500/20",
                    "quote-builder": "text-green-400 bg-green-500/10 border-green-500/20",
                    "unlock-request": "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    "contact": "text-white/40 bg-white/5 border-white/10",
                  };
                  const typeLabels: Record<string, string> = {
                    "layout-plan": "Layout Plan", "quote-request": "Quote Request",
                    "strategy-call": "Strategy Call", "quote-builder": "Quote Builder",
                    "unlock-request": "Unlock Request", "contact": "Contact",
                  };
                  const colorClass = typeColors[lead.type] || "text-white/40 bg-white/5 border-white/10";
                  const typeLabel = typeLabels[lead.type] || lead.type;
                  return (
                    <div key={lead.id} className="px-5 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5">
                        {(lead.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{lead.name}</span>
                          {lead.company && <span className="text-white/40 text-xs">· {lead.company}</span>}
                          <Badge className={`text-xs border ml-auto ${colorClass}`}>{typeLabel}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <a href={`mailto:${lead.email}`} className="text-white/35 text-xs hover:text-[hsl(43,78%,65%)] transition-colors truncate">{lead.email}</a>
                          <span className="text-white/20 text-xs flex-shrink-0">{timeAgo(lead.createdAt?.toString())}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Admin Navigation shortcuts ────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-4">Admin Navigation</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/admin/planning-requests", icon: FileText, label: "Planning Requests", sub: `${requests.length} submissions` },
              { href: "/admin/leads", icon: Users, label: "Lead Intelligence", sub: `${leads.length} web leads` },
              { href: "/admin/office-move-radar", icon: Radio, label: "Office Move Radar", sub: radarStats ? `${radarStats.total} signals` : "Radar signals" },
              { href: "/admin/supplier-quotes", icon: Package, label: "Supplier Quotes", sub: "Purchase orders" },
              { href: "/admin/marketing", icon: Megaphone, label: "Marketing Hub", sub: "Prospects & outreach" },
              { href: "/admin/deal-hunter", icon: Crosshair, label: "AI Deal Hunter", sub: "Automated opportunity discovery" },
              { href: "/admin/partner-network", icon: Network, label: "Partner Network", sub: "Broker & partner ecosystem" },
              { href: "/admin/relocation-intelligence", icon: Radar, label: "Relocation Intel", sub: "Market relocation signals" },
              { href: "/admin/workspace-strategy", icon: Brain, label: "Workspace Strategy", sub: "AI layout & package optimisation" },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link key={href} href={href}>
                <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 cursor-pointer transition-colors">
                  <Icon className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{label}</p>
                    <p className="text-white/30 text-xs truncate">{sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
