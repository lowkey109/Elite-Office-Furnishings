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
  CheckCircle2, XCircle, ArrowRight, Building2, Clock, Zap, Target,
  FileText, Package, ChevronRight, Phone, Mail, Megaphone, ExternalLink,
  Eye, BarChart3, Shield, Calendar, Layers, Crown,
} from "lucide-react";

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
  budgetRange?: string;
  stylePreference?: string;
  specialRequirements?: string;
  aiRecommendations?: string;
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

const BUDGET_MIDPOINTS: Record<string, number> = {
  "Under $30,000": 22500,
  "$30,000 – $60,000": 45000,
  "$60,000 – $100,000": 80000,
  "$100,000 – $180,000": 140000,
  "$180,000 – $300,000": 240000,
  "$300,000+": 400000,
};

const SQM_RATE: Record<string, number> = {
  "Luxury Executive": 1500,
  "Corporate Prestige": 1200,
  "Modern Open Plan": 950,
  "Warm Timber / Premium": 1100,
  "Minimal": 800,
  "Mixed / Flexible": 900,
};

function parseBudgetMid(budget?: string): number {
  if (!budget) return 0;
  for (const [key, val] of Object.entries(BUDGET_MIDPOINTS)) {
    if (budget.includes(key) || key.includes(budget)) return val;
  }
  for (const [key, val] of Object.entries(BUDGET_MIDPOINTS)) {
    if (budget.includes("300")) return 400000;
    if (budget.includes("180")) return 240000;
    if (budget.includes("100")) return 140000;
    if (budget.includes("60")) return 80000;
    if (budget.includes("30")) return 45000;
  }
  return 0;
}

function parseStoredValue(val?: string): number {
  if (!val) return 0;
  const m = val.match(/[\d,]+/g);
  if (!m) return 0;
  const nums = m.map(s => parseInt(s.replace(/,/g, "")));
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[nums.length - 1]) / 2);
}

function computePipelineValue(req: PlanningRequest): number {
  if (req.estimatedValue) {
    const v = parseStoredValue(req.estimatedValue);
    if (v > 0) return v;
  }
  const sqm = parseFloat(req.squareMetres || "0");
  const staff = parseInt(req.staffCount || "0");
  const style = req.stylePreference || "";
  const rate = SQM_RATE[style] || 900;

  if (sqm >= 30) return Math.round(sqm * rate);
  if (staff >= 5) return Math.round(staff * 3500);
  const budget = parseBudgetMid(req.budgetRange);
  if (budget > 0) return budget;
  return 0;
}

function computeLeadScore(req: PlanningRequest): number {
  if (req.leadScore != null && req.leadScore > 0) return req.leadScore;

  let score = 0;
  const staff = parseInt(req.staffCount || "0");
  const sqm = parseFloat(req.squareMetres || "0");
  const pt = req.projectType || "";
  const budget = req.budgetRange || "";
  const style = req.stylePreference || "";

  if (staff >= 100) score += 25;
  else if (staff >= 50) score += 21;
  else if (staff >= 25) score += 16;
  else if (staff >= 15) score += 12;
  else if (staff >= 8) score += 8;
  else if (staff >= 3) score += 4;

  if (sqm >= 500) score += 25;
  else if (sqm >= 300) score += 21;
  else if (sqm >= 200) score += 16;
  else if (sqm >= 100) score += 12;
  else if (sqm >= 50) score += 8;
  else if (sqm >= 20) score += 4;

  if (pt.includes("New Office")) score += 20;
  else if (pt.includes("Relocation")) score += 20;
  else if (pt.includes("Expansion")) score += 17;
  else if (pt.includes("Refurbishment")) score += 13;
  else if (pt.includes("Refresh")) score += 8;

  if (budget.includes("300")) score += 20;
  else if (budget.includes("180")) score += 17;
  else if (budget.includes("100")) score += 13;
  else if (budget.includes("60")) score += 9;
  else if (budget.includes("30")) score += 5;

  if (style.includes("Luxury") || style.includes("Executive")) score += 10;
  else if (style.includes("Prestige") || style.includes("Corporate")) score += 8;
  else if (style.includes("Timber") || style.includes("Premium")) score += 7;
  else if (style.includes("Modern")) score += 5;
  else score += 3;

  return Math.min(score, 100);
}

function getLeadTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 70) return { label: "High Value", color: "text-[hsl(43,78%,65%)]", bg: "bg-[rgba(201,168,76,0.12)] border-[rgba(201,168,76,0.25)]" };
  if (score >= 45) return { label: "Medium", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
  return { label: "Low Priority", color: "text-white/40", bg: "bg-white/5 border-white/10" };
}

function isRelocation(req: PlanningRequest): boolean {
  return (req.projectType || "").toLowerCase().includes("reloc");
}

function isExpansion(req: PlanningRequest): boolean {
  const pt = (req.projectType || "").toLowerCase();
  return pt.includes("expan") || pt.includes("new office");
}

function formatAUD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

function formatDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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

const PIPELINE_STAGES = ["New", "In Review", "Quoted", "Converted", "Archived"] as const;
const STAGE_COLORS: Record<string, string> = {
  "New": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Review": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Quoted": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Converted": "bg-green-500/20 text-green-400 border-green-500/30",
  "Archived": "bg-white/5 text-white/30 border-white/10",
};

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

  const { data: requests = [], isLoading: reqLoading } = useQuery<PlanningRequest[]>({
    queryKey: ["/api/admin/planning-requests"],
    enabled: authed,
  });

  const { data: leads = [], isLoading: leadLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    enabled: authed,
  });

  const { data: health } = useQuery<{ email: boolean; stripe: boolean }>({
    queryKey: ["/api/health"],
    enabled: authed,
    refetchInterval: 60000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/planning-requests/${id}/status`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/planning-requests"] });
      toast({ title: "Status updated" });
    },
  });

  function handleLogin() {
    if (validateAdminLogin(email, pw)) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  const scored = useMemo(() =>
    requests.map(r => ({
      ...r,
      _score: computeLeadScore(r),
      _value: computePipelineValue(r),
    })).sort((a, b) => b._score - a._score),
    [requests]
  );

  const totalPipeline = useMemo(() => scored.reduce((s, r) => s + r._value, 0), [scored]);
  const paidCount = useMemo(() => requests.filter(r => r.isPaid).length, [requests]);
  const highValue = useMemo(() => scored.filter(r => r._score >= 70), [scored]);
  const topOpportunities = useMemo(() => scored.slice(0, 5), [scored]);

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => { map[s] = 0; });
    requests.forEach(r => { if (map[r.status] != null) map[r.status]++; });
    return map;
  }, [requests]);

  const avgScore = useMemo(() => {
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((s, r) => s + r._score, 0) / scored.length);
  }, [scored]);

  const recentLeads = leads.slice(0, 6);
  const quoteLeads = leads.filter(l => l.type === "quote-request" || l.type === "quote-builder").length;
  const strategyLeads = leads.filter(l => l.type === "strategy-call").length;
  const layoutLeads = leads.filter(l => l.type === "layout-plan").length;

  const relocationCount = scored.filter(r => isRelocation(r)).length;
  const newHQCount = scored.filter(r => isExpansion(r)).length;

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
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-6">
            <label className="block text-sm text-white/60 mb-2">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="admin@thecorporatedesk.com.au"
              data-testid="input-admin-email"
              className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-4"
              style={{ minHeight: "48px" }}
            />
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter password"
              data-testid="input-admin-password"
              className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-4 ${pwError ? "border-red-500/50" : "border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)]"}`}
              style={{ minHeight: "48px" }}
            />
            {pwError && <p className="text-red-400 text-xs mb-3">Invalid credentials.</p>}
            <Button
              onClick={handleLogin}
              className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]"
              data-testid="button-admin-login"
            >
              Access Command Centre
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = reqLoading || leadLoading;

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">
      <header className="bg-[hsl(220,18%,8%)] border-b border-[rgba(201,168,76,0.1)] px-4 sm:px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-2">
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

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-1">Business Command Centre</h1>
            <p className="text-white/40 text-sm">Real-time pipeline intelligence — The Corporate Desk</p>
          </div>
          <div className="text-right text-xs text-white/30 hidden sm:block">
            <p>{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="mt-0.5">AEST</p>
          </div>
        </div>

        {health && (!health.email || !health.stripe) && (
          <div className="bg-[rgba(251,146,60,0.06)] border border-[rgba(251,146,60,0.2)] rounded-2xl overflow-hidden" data-testid="panel-system-alerts">
            <div className="px-5 py-3 border-b border-[rgba(251,146,60,0.12)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 text-sm font-semibold">Revenue-Critical Alerts</span>
              <span className="ml-auto text-orange-400/50 text-xs">Action required</span>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {!health.stripe && (
                <div className="flex items-start gap-2.5 bg-[rgba(255,255,255,0.03)] rounded-xl p-3.5 border border-[rgba(251,146,60,0.15)] flex-1 min-w-[200px]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">Stripe not configured</p>
                    <p className="text-white/50 text-xs mt-0.5">$399 unlock button is broken for all users. Add <code className="bg-white/8 px-1 rounded text-orange-300">STRIPE_SECRET_KEY</code> in Secrets.</p>
                  </div>
                </div>
              )}
              {!health.email && (
                <div className="flex items-start gap-2.5 bg-[rgba(255,255,255,0.03)] rounded-xl p-3.5 border border-[rgba(251,146,60,0.15)] flex-1 min-w-[200px]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">Email notifications off</p>
                    <p className="text-white/50 text-xs mt-0.5">All lead alerts are silently dropping. Add <code className="bg-white/8 px-1 rounded text-orange-300">SMTP_HOST</code>, <code className="bg-white/8 px-1 rounded text-orange-300">SMTP_USER</code>, <code className="bg-white/8 px-1 rounded text-orange-300">SMTP_PASS</code> in Secrets.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Estimated Pipeline", value: isLoading ? "—" : formatAUD(totalPipeline),
              sub: `${requests.length} planner submission${requests.length !== 1 ? "s" : ""}`,
              icon: DollarSign, color: "text-[hsl(43,78%,65%)]",
              bg: "bg-[rgba(201,168,76,0.08)] border-[rgba(201,168,76,0.15)]",
              testId: "stat-pipeline-value",
            },
            {
              label: "High-Value Leads", value: isLoading ? "—" : highValue.length,
              sub: `Score ≥ 70 · avg ${avgScore}/100`,
              icon: Crown, color: "text-amber-400",
              bg: "bg-amber-500/8 border-amber-500/15",
              testId: "stat-high-value",
            },
            {
              label: "Paid Unlocks", value: isLoading ? "—" : paidCount,
              sub: `$${(paidCount * 399).toLocaleString("en-AU")} AUD collected`,
              icon: Shield, color: "text-green-400",
              bg: "bg-green-500/8 border-green-500/15",
              testId: "stat-paid-unlocks",
            },
            {
              label: "Web Leads", value: isLoading ? "—" : leads.length,
              sub: `${quoteLeads} quote · ${strategyLeads} strategy · ${layoutLeads} layout`,
              icon: Target, color: "text-blue-400",
              bg: "bg-blue-500/8 border-blue-500/15",
              testId: "stat-web-leads",
            },
          ].map(({ label, value, sub, icon: Icon, color, bg, testId }) => (
            <div key={label} className={`rounded-2xl border p-5 ${bg}`} data-testid={testId}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center border`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold font-serif ${color} mb-0.5`}>{value}</p>
              <p className="text-white/50 text-xs">{label}</p>
              <p className="text-white/25 text-xs mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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
              <div className="flex gap-1 mb-4 h-3 rounded-full overflow-hidden">
                {PIPELINE_STAGES.filter(s => s !== "Archived").map(stage => {
                  const count = stageCounts[stage] || 0;
                  const total = requests.length || 1;
                  const pct = (count / total) * 100;
                  const colors: Record<string, string> = {
                    "New": "bg-blue-500",
                    "In Review": "bg-purple-500",
                    "Quoted": "bg-amber-500",
                    "Converted": "bg-green-500",
                  };
                  return (
                    <div
                      key={stage}
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                      className={`${colors[stage]} rounded-full`}
                      title={`${stage}: ${count}`}
                    />
                  );
                })}
                {requests.length === 0 && <div className="w-full bg-white/5 rounded-full" />}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PIPELINE_STAGES.filter(s => s !== "Archived").map(stage => {
                  const count = stageCounts[stage] || 0;
                  const stageValue = scored
                    .filter(r => r.status === stage)
                    .reduce((s, r) => s + r._value, 0);
                  return (
                    <div key={stage} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 border border-[rgba(255,255,255,0.05)]">
                      <p className="text-white/40 text-xs mb-1">{stage}</p>
                      <p className="text-white font-bold text-lg">{count}</p>
                      {stageValue > 0 && <p className="text-[hsl(43,78%,65%)] text-xs mt-0.5">{formatAUD(stageValue)}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Commercial Mix</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Relocation / Move", count: relocationCount, icon: Building2, color: "text-[hsl(43,78%,65%)]" },
                { label: "New Office / HQ", count: newHQCount, icon: Crown, color: "text-amber-400" },
                { label: "High Lead Score (70+)", count: highValue.length, icon: Star, color: "text-purple-400" },
                { label: "Paid Report Access", count: paidCount, icon: Shield, color: "text-green-400" },
                { label: "Quote Requests", count: quoteLeads, icon: FileText, color: "text-blue-400" },
                { label: "Strategy Calls", count: strategyLeads, icon: Calendar, color: "text-pink-400" },
              ].map(({ label, count, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
                  <span className="text-white/60 text-xs flex-1">{label}</span>
                  <span className={`font-bold text-sm ${count > 0 ? "text-white" : "text-white/20"}`}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Top Opportunities</h2>
              <span className="text-white/30 text-xs ml-1">ranked by lead score</span>
            </div>
            <Link href="/admin/planning-requests">
              <button className="text-[hsl(43,78%,52%)] text-xs hover:underline flex items-center gap-1 hidden sm:flex">
                Full view <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-white/30 text-sm">Loading submissions…</div>
          ) : topOpportunities.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No planner submissions yet. Submissions appear here as the AI Planner is used.</div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {topOpportunities.map((req, idx) => {
                const score = req._score;
                const value = req._value;
                const tier = getLeadTier(score);
                const isHighest = idx === 0;
                return (
                  <div key={req.id} className={`p-5 ${isHighest ? "bg-[rgba(201,168,76,0.04)]" : ""}`} data-testid={`opportunity-row-${req.id}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start gap-2 mb-1.5">
                          <p className="text-white font-semibold text-sm">{req.name}</p>
                          {req.company && <span className="text-white/40 text-sm">· {req.company}</span>}
                          <Badge className={`text-xs border ml-auto ${tier.bg} ${tier.color}`}>{tier.label}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40 mb-2">
                          {req.projectType && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{req.projectType}</span>}
                          {req.squareMetres && <span>{req.squareMetres} sqm</span>}
                          {req.staffCount && <span><Users className="w-3 h-3 inline mr-0.5" />{req.staffCount} staff</span>}
                          {req.budgetRange && <span>{req.budgetRange}</span>}
                          {req.city && <span>{req.city}</span>}
                          <span className="ml-auto text-white/25">{timeAgo(req.createdAt)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${score >= 70 ? "bg-[hsl(43,78%,52%)]" : score >= 45 ? "bg-blue-500" : "bg-white/30"}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${tier.color}`}>{score}/100</span>
                          </div>
                          {value > 0 && (
                            <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">{formatAUD(value)} est.</span>
                          )}
                          {req.isPaid && (
                            <span className="text-xs text-green-400 flex items-center gap-1"><Shield className="w-3 h-3" />Paid</span>
                          )}
                          {isRelocation(req) && (
                            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Relocation</span>
                          )}
                          {isExpansion(req) && !isRelocation(req) && (
                            <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">New HQ</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
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
                        {score >= 70 && (
                          <div className="mt-3 p-3 bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl">
                            <p className="text-[hsl(43,78%,65%)] text-xs font-semibold mb-1">CEO Recommendation</p>
                            <p className="text-white/60 text-xs leading-relaxed">
                              {value >= 150000
                                ? `Priority contact. ${formatAUD(value)} estimated project — senior consultant call within 24h. Prepare full proposal package.`
                                : value >= 80000
                                ? `Strong commercial opportunity. ${formatAUD(value)} estimated — book strategy call and prepare preliminary quote.`
                                : `Qualified lead. Follow up within 48h with workspace concept and product recommendations.`
                              }
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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
            {recentLeads.length === 0 ? (
              <div className="p-6 text-center text-white/30 text-sm">No web leads yet.</div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {recentLeads.map(lead => {
                  const typeColors: Record<string, string> = {
                    "layout-plan": "text-blue-400 bg-blue-500/10 border-blue-500/20",
                    "quote-request": "text-[hsl(43,78%,65%)] bg-[rgba(201,168,76,0.12)] border-[rgba(201,168,76,0.2)]",
                    "strategy-call": "text-purple-400 bg-purple-500/10 border-purple-500/20",
                    "quote-builder": "text-green-400 bg-green-500/10 border-green-500/20",
                    "unlock-request": "text-amber-400 bg-amber-500/10 border-amber-500/20",
                  };
                  const typeLabel: Record<string, string> = {
                    "layout-plan": "Layout Plan",
                    "quote-request": "Quote Request",
                    "strategy-call": "Strategy Call",
                    "quote-builder": "Quote Builder",
                    "unlock-request": "Unlock Request",
                    "contact": "Contact",
                  };
                  const color = typeColors[lead.type] || "text-white/40 bg-white/5 border-white/10";
                  const label = typeLabel[lead.type] || lead.type;
                  return (
                    <div key={lead.id} className="px-5 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5">
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{lead.name}</span>
                          {lead.company && <span className="text-white/40 text-xs">· {lead.company}</span>}
                          <Badge className={`text-xs border ml-auto ${color}`}>{label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <a href={`mailto:${lead.email}`} className="text-white/35 text-xs hover:text-[hsl(43,78%,65%)] transition-colors truncate">{lead.email}</a>
                          <span className="text-white/20 text-xs flex-shrink-0">{timeAgo(lead.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Pipeline Intelligence</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl p-4">
                <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3">Value Breakdown</p>
                <div className="space-y-2">
                  {[
                    { label: "Total estimated pipeline", value: formatAUD(totalPipeline), highlight: true },
                    { label: "Average project value", value: requests.length > 0 ? formatAUD(Math.round(totalPipeline / requests.length)) : "—" },
                    { label: "High-value share (≥$100K)", value: formatAUD(scored.filter(r => r._value >= 100000).reduce((s, r) => s + r._value, 0)) },
                    { label: "Paid unlock revenue", value: `$${(paidCount * 399).toLocaleString("en-AU")}` },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-white/50 text-xs">{label}</span>
                      <span className={`font-bold text-sm ${highlight ? "text-[hsl(43,78%,65%)]" : "text-white/80"}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Lead Quality Distribution</p>
                {[
                  { label: "High Value (70–100)", count: scored.filter(r => r._score >= 70).length, color: "bg-[hsl(43,78%,52%)]" },
                  { label: "Medium (45–69)", count: scored.filter(r => r._score >= 45 && r._score < 70).length, color: "bg-blue-500" },
                  { label: "Low Priority (<45)", count: scored.filter(r => r._score < 45).length, color: "bg-white/20" },
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

              <div className="text-center pt-1">
                <p className="text-white/20 text-xs italic">
                  Pipeline values estimated from office size, staff count, and style preference.
                  {" "}Actual values confirmed after AI analysis.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-4">Admin Navigation</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/admin/planning-requests", icon: FileText, label: "Planning Requests", sub: `${requests.length} submissions` },
              { href: "/admin/leads", icon: Users, label: "Lead Intelligence", sub: `${leads.length} web leads` },
              { href: "/admin/supplier-quotes", icon: Package, label: "Supplier Quotes", sub: "Purchase orders" },
              { href: "/admin/marketing", icon: Megaphone, label: "Marketing Hub", sub: "Prospects & outreach" },
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
