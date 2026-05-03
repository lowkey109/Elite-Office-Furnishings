import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  Users, TrendingUp, FileText, BarChart3, MessageSquare,
  ChevronRight, Calendar, MapPin, Phone, Mail, Clock,
  Megaphone, ShieldCheck, Eye, ExternalLink, Target, Package, Upload, Star,
  AlertTriangle, CheckCircle2, XCircle, Zap, Globe, Brain, DollarSign,
  Network, Radar, Crosshair, Shield,
} from "lucide-react";
import { validateAdminLogin } from "@/lib/adminAuth";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  type: string;
  message?: string;
  officeSize?: string;
  staffCount?: string;
  budget?: string;
  officeLocation?: string;
  opportunityScore?: number;
  opportunityTier?: string;
  estimatedValueRange?: string;
  estimateJson?: string;
  sourcePage?: string;
  nexoraIntent?: string;
  nexoraJourney?: string;
  nexoraUrgency?: string;
  nexoraConfidence?: number;
  nexoraAdminSummary?: string;
  nexoraNextAction?: string;
  nexoraDealBand?: string;
  nexoraEscalation?: string;
  createdAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  "layout-plan": "Layout Plan",
  "quote-request": "Quote Request",
  "strategy-call": "Strategy Call",
  "quote-builder": "Quote Builder",
  "finance-lead": "Finance Lead",
  "contact": "Contact",
  "general": "General",
};

const TYPE_COLORS: Record<string, string> = {
  "layout-plan": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "quote-request": "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]",
  "strategy-call": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "quote-builder": "bg-green-500/10 text-green-400 border-green-500/20",
  "finance-lead": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "contact": "bg-white/10 text-white/60 border-white/10",
  "general": "bg-white/10 text-white/60 border-white/10",
};

function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isThisWeek(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo && d <= now;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(() =>
    sessionStorage.getItem("tcd_admin_auth") === "true" ||
    localStorage.getItem("tcd_admin_auth") === "true"
  );
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Admin Dashboard | The Corporate Desk";
    if (sessionStorage.getItem("tcd_admin_auth") === "true" ||
        localStorage.getItem("tcd_admin_auth") === "true") {
      setAuthed(true);
    }
  }, []);

  const { data: leadsRaw = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    enabled: authed,
  });

  const { data: health } = useQuery<{ email: boolean; stripe: boolean; status: string }>({
    queryKey: ["/api/health"],
    enabled: authed,
    refetchInterval: 60000,
  });

  interface PlanningReq { id: string; name: string; company: string; status: string; leadScore?: number; estimatedValue?: string; squareMetres?: string; staffCount?: string; createdAt?: string; packageJson?: string; }
  const { data: planningRequestsRaw = [] } = useQuery<PlanningReq[]>({
    queryKey: ["/api/admin/planning-requests"],
    enabled: authed,
    refetchInterval: 60000,
  });

  interface ForecastOpportunity {
    id: string;
    companyName: string;
    projectValue: number;
    pipelineStage: string;
    probabilityScore: number;
    expectedRevenue: number;
  }
  interface DealForecast {
    grossPipeline: number;
    weightedRevenue: number;
    probableDealsCount: number;
    probableDealsValue: number;
    wonValue: number;
    wonDealsCount: number;
    winRate: number | null;
    totalLeads: number;
    stageCounts: Record<string, { count: number; value: number }>;
    opportunities: ForecastOpportunity[];
    closing90Days: ForecastOpportunity[];
    closing90DaysValue: number;
  }
  const { data: forecast } = useQuery<DealForecast>({
    queryKey: ["/api/admin/deal-forecast"],
    queryFn: () => fetch("/api/admin/deal-forecast").then(r => r.json()),
    enabled: authed,
  });

  interface ScheduledJob { id: string; jobType: string; status: string; startedAt?: string; completedAt?: string; }
  const { data: recentJobsRaw = [] } = useQuery<ScheduledJob[]>({
    queryKey: ["/api/admin/intelligence/jobs"],
    enabled: authed,
    refetchInterval: 120000,
  });

  interface RadarStats { total: number; high: number; medium: number; low: number; newCount: number; inPipeline: number; avgScore: number; }
  const { data: radarStats } = useQuery<RadarStats>({
    queryKey: ["/api/admin/office-move-radar/stats"],
    enabled: authed,
    refetchInterval: 60000,
  });

  interface AnalyticsData {
    pageViews: { today: number; week: number; month: number; year: number; total: number };
    uniqueVisitors: { today: number; week: number; month: number; year: number };
    leads: { today: number; week: number; month: number; year: number; total: number };
    topPages: { page_path: string; views: number }[];
    referrers: { source: string; visits: number }[];
    leadsBreakdown: { type: string; count: number }[];
    conversionRate: number;
  }
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    enabled: authed,
    refetchInterval: 120000,
  });
  interface RadarRecord { id: string; companyName: string; city: string; priority: string; radarScore: number; estimatedProjectValue: string | null; signalType: string; status: string; }
  const { data: radarRecordsRaw = [] } = useQuery<RadarRecord[]>({
    queryKey: ["/api/admin/office-move-radar"],
    enabled: authed && (radarStats?.total ?? 0) > 0,
    refetchInterval: 60000,
  });

  interface StrategyBooking {
    id: number; name: string; email: string; phone: string; company: string;
    staffCount?: string; officeLocation?: string; budget?: string; moveDate?: string;
    message?: string; bookingDate: string; bookingTime: string; status: string; createdAt?: string;
  }
  const { data: strategyBookingsRaw = [], refetch: refetchBookings } = useQuery<StrategyBooking[]>({
    queryKey: ["/api/admin/strategy-bookings"],
    enabled: authed,
    refetchInterval: 60000,
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

  const leads = Array.isArray(leadsRaw) ? leadsRaw : [];
  const planningRequests = Array.isArray(planningRequestsRaw) ? planningRequestsRaw : [];
  const recentJobs = Array.isArray(recentJobsRaw) ? recentJobsRaw : [];
  const radarRecords = Array.isArray(radarRecordsRaw) ? radarRecordsRaw : [];
  const strategyBookings = Array.isArray(strategyBookingsRaw) ? strategyBookingsRaw : [];

  const totalLeads = leads.length;
  const todayLeads = leads.filter(l => isToday(l.createdAt)).length;
  const weekLeads = leads.filter(l => isThisWeek(l.createdAt)).length;
  const quoteLeads = leads.filter(l => l.type === "quote-request" || l.type === "quote-builder").length;
  const layoutLeads = leads.filter(l => l.type === "layout-plan").length;
  const strategyLeads = leads.filter(l => l.type === "strategy-call").length;
  const financeLeads = leads.filter(l => l.type === "finance-lead").length;

  const hotLeads = [...leads]
    .filter(l => (l.opportunityScore || 0) >= 70)
    .sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))
    .slice(0, 5);

  const newPlanningCount = planningRequests.filter(r => r.status === "New").length;
  const newLeadsToday = leads.filter(l => isToday(l.createdAt));
  const planningWithPackages = planningRequests.filter(r => r.packageJson).length;

  const leadsByType = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.type] = (acc[l.type] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const lastJobRun = recentJobs.length > 0 ? recentJobs[0] : null;
  const jobStatusColor = lastJobRun?.status === "completed" ? "text-green-400" : lastJobRun?.status === "failed" ? "text-red-400" : "text-white/40";

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-4">
              <span className="text-2xl font-serif font-bold text-white">THE CORPORATE</span>
              <span className="text-sm font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
            </div>
            <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
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
              className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-1 ${
                pwError ? "border-red-500/50" : "border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)]"
              }`}
              style={{ minHeight: "48px" }}
            />
            {pwError && <p className="text-red-400 text-xs mb-3">Incorrect credentials. Please try again.</p>}
            <Button
              onClick={handleLogin}
              className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] mt-3"
              data-testid="button-admin-login"
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Access Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">
      <header className="bg-[hsl(220,18%,8%)] border-b border-[rgba(201,168,76,0.1)] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="flex flex-col cursor-pointer" data-testid="link-admin-logo">
                <span className="text-base font-serif font-bold text-white leading-tight">THE CORPORATE</span>
                <span className="text-xs font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
              </div>
            </Link>
            <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />
            <span className="text-white/50 text-sm font-medium">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              size="sm"
              className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[40px]"
              data-testid="button-command-centre"
            >
              <Link href="/admin/command-centre"><Zap className="w-4 h-4 mr-1.5" /> Command Centre</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[40px]"
              data-testid="button-admin-leads"
            >
              <Link href="/admin/leads"><Target className="w-4 h-4 mr-1.5" /> Lead Intelligence</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[40px]"
              data-testid="button-admin-marketing"
            >
              <Link href="/admin/marketing"><Megaphone className="w-4 h-4 mr-1.5" /> Marketing Hub</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-white/50 hover:text-white min-h-[40px]"
              data-testid="button-admin-view-site"
            >
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" /> View Site
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Business Overview</h1>
          <p className="text-white/40 text-sm">Lead tracking and business metrics for The Corporate Desk</p>
        </div>

        {health && (!health.email || !health.stripe) && (
          <div className="mb-6 bg-[rgba(251,146,60,0.06)] border border-[rgba(251,146,60,0.2)] rounded-2xl overflow-hidden" data-testid="panel-system-health">
            <div className="px-5 py-3 border-b border-[rgba(251,146,60,0.12)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 text-sm font-semibold">System Configuration Alerts</span>
              <span className="ml-auto text-orange-400/50 text-xs">Live configuration status</span>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!health.stripe && (
                <div className="flex items-start gap-3 bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(251,146,60,0.15)]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">Stripe not configured</p>
                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">Stripe checkout is not configured in the current runtime. Add or verify <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">STRIPE_SECRET_KEY</code> and matching price IDs in Railway variables.</p>
                  </div>
                </div>
              )}
              {!health.email && (
                <div className="flex items-start gap-3 bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(251,146,60,0.15)]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">SMTP email not configured</p>
                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">Email delivery is not fully configured in the current runtime. Add or verify <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">SMTP_HOST</code>, <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">SMTP_USER</code>, and <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">SMTP_PASS</code> in Railway variables, or wire this panel to Resend status.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 pb-3">
              <p className="text-orange-400/50 text-xs">Fix these in Railway Variables for the deployed service. Do not use Replit Secrets for production.</p>
            </div>
          </div>
        )}

        {health && health.email && health.stripe && (
          <div className="mb-6 flex items-center gap-2 bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)] rounded-xl px-4 py-3" data-testid="panel-system-healthy">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-green-400 text-sm font-medium">All systems operational</span>
            <span className="text-white/30 text-xs ml-auto">Email · Stripe · AI</span>
          </div>
        )}

        {/* ── SECTION 1: TRAFFIC ANALYTICS ────────────────────────────────────── */}
        <div className="mb-6 bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.12)] rounded-2xl overflow-hidden" data-testid="panel-traffic-analytics">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[hsl(43,78%,65%)]" />
            <span className="text-white font-semibold text-sm">Website Traffic</span>
            <span className="ml-auto text-white/25 text-xs">Live · updates every 2 min</span>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Visitors Today", pv: analytics?.pageViews.today ?? 0, uv: analytics?.uniqueVisitors.today ?? 0 },
              { label: "This Week", pv: analytics?.pageViews.week ?? 0, uv: analytics?.uniqueVisitors.week ?? 0 },
              { label: "This Month", pv: analytics?.pageViews.month ?? 0, uv: analytics?.uniqueVisitors.month ?? 0 },
              { label: "This Year", pv: analytics?.pageViews.year ?? 0, uv: analytics?.uniqueVisitors.year ?? 0 },
            ].map(({ label, pv, uv }) => (
              <div key={label} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(255,255,255,0.06)]" data-testid={`stat-traffic-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                <p className="text-white/40 text-xs mb-1">{label}</p>
                <p className="text-2xl font-bold text-white">{pv.toLocaleString()}</p>
                <p className="text-white/30 text-xs mt-0.5">{uv.toLocaleString()} unique</p>
              </div>
            ))}
          </div>
          {(analytics?.topPages?.length ?? 0) > 0 && (
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-white/40 text-xs mb-2 font-medium uppercase tracking-wide">Top Pages (This Month)</p>
                <div className="space-y-1.5" data-testid="list-top-pages">
                  {(analytics?.topPages ?? []).slice(0, 5).map((p) => (
                    <div key={p.page_path} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <span className="text-white/60 text-xs truncate max-w-[200px]">{p.page_path || "/"}</span>
                      <span className="text-white/80 text-xs font-medium ml-2">{Number(p.views).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-2 font-medium uppercase tracking-wide">Traffic Sources</p>
                <div className="space-y-1.5" data-testid="list-referrers">
                  {(analytics?.referrers ?? []).slice(0, 5).map((r) => (
                    <div key={r.source} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <span className="text-white/60 text-xs truncate max-w-[200px]">{r.source || "Direct"}</span>
                      <span className="text-white/80 text-xs font-medium ml-2">{Number(r.visits).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {(analytics?.topPages?.length ?? 0) === 0 && (
            <div className="px-5 pb-5">
              <p className="text-white/20 text-xs text-center py-2">Tracking active — page view data will appear as visitors browse the site</p>
            </div>
          )}
        </div>

        {/* ── SECTION 2: LEAD ANALYTICS ────────────────────────────────────────── */}
        <div className="mb-6 bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.12)] rounded-2xl overflow-hidden" data-testid="panel-lead-analytics">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
            <Target className="w-4 h-4 text-[hsl(43,78%,65%)]" />
            <span className="text-white font-semibold text-sm">Lead Tracking</span>
            <span className="ml-auto text-white/25 text-xs">All lead types combined</span>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "New Today", val: analytics?.leads.today ?? 0 },
              { label: "This Week", val: analytics?.leads.week ?? 0 },
              { label: "This Month", val: analytics?.leads.month ?? 0 },
              { label: "This Year", val: analytics?.leads.year ?? 0 },
            ].map(({ label, val }) => (
              <div key={label} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(255,255,255,0.06)]" data-testid={`stat-leads-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                <p className="text-white/40 text-xs mb-1">{label}</p>
                <p className="text-2xl font-bold text-white">{val}</p>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(analytics?.leadsBreakdown?.length ?? 0) > 0 && (
              <div>
                <p className="text-white/40 text-xs mb-2 font-medium uppercase tracking-wide">By Type (This Month)</p>
                <div className="space-y-1.5" data-testid="list-leads-breakdown">
                  {(analytics?.leadsBreakdown ?? []).map((b) => (
                    <div key={b.type} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <span className="text-white/60 text-xs">{TYPE_LABELS[b.type] ?? b.type}</span>
                      <span className="text-white/80 text-xs font-medium">{Number(b.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <p className="text-white/40 text-xs mb-1 font-medium uppercase tracking-wide">Conversion</p>
              <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(255,255,255,0.06)]">
                <p className="text-white/40 text-xs mb-1">Visitor → Lead Rate</p>
                <p className="text-2xl font-bold text-[hsl(43,78%,65%)]" data-testid="stat-conversion-rate">{analytics?.conversionRate ?? 0}%</p>
                <p className="text-white/30 text-xs mt-0.5">Based on page views vs enquiries this month</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Required Banner ───────────────────────────────────────────── */}
        {(newPlanningCount > 0 || newLeadsToday.length > 0 || hotLeads.length > 0) && (
          <div className="mb-6 bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-5" data-testid="panel-action-required">
            <p className="text-[hsl(43,78%,65%)] text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Needs Your Attention
            </p>
            <div className="flex flex-wrap gap-3">
              {newPlanningCount > 0 && (
                <Link href="/admin/planning-requests">
                  <div className="flex items-center gap-2 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-xl px-4 py-2.5 cursor-pointer hover:bg-[rgba(201,168,76,0.15)] transition-all" data-testid="action-new-planning">
                    <Upload className="w-3.5 h-3.5 text-[hsl(43,78%,65%)]" />
                    <span className="text-white text-sm font-medium">{newPlanningCount} new planning submission{newPlanningCount !== 1 ? "s" : ""}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                  </div>
                </Link>
              )}
              {newLeadsToday.length > 0 && (
                <Link href="/admin/command-centre">
                  <div className="flex items-center gap-2 bg-[rgba(34,197,94,0.08)] border border-green-500/20 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-[rgba(34,197,94,0.12)] transition-all" data-testid="action-today-leads">
                    <Users className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-white text-sm font-medium">{newLeadsToday.length} new lead{newLeadsToday.length !== 1 ? "s" : ""} today</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                  </div>
                </Link>
              )}
              {hotLeads.length > 0 && (
                <Link href="/admin/command-centre">
                  <div className="flex items-center gap-2 bg-[rgba(251,146,60,0.08)] border border-orange-500/20 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-[rgba(251,146,60,0.12)] transition-all" data-testid="action-hot-leads">
                    <Star className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-white text-sm font-medium">{hotLeads.length} hot lead{hotLeads.length !== 1 ? "s" : ""} ready to convert</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Leads", value: isLoading ? "—" : totalLeads, icon: Users, color: "text-[hsl(43,78%,65%)]", testId: "stat-total-leads" },
            { label: "Leads Today", value: isLoading ? "—" : todayLeads, icon: Calendar, color: "text-green-400", testId: "stat-today-leads" },
            { label: "Planning Requests", value: planningRequests.length || "—", icon: Upload, color: "text-blue-400", testId: "stat-planning-requests" },
            { label: "Finance Leads", value: isLoading ? "—" : financeLeads, icon: DollarSign, color: "text-emerald-400", testId: "stat-finance-leads" },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/50 text-sm">{kpi.label}</p>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p className={`text-3xl font-serif font-bold ${kpi.color}`} data-testid={kpi.testId}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "This Week", value: isLoading ? "—" : weekLeads, icon: TrendingUp, color: "text-purple-400", testId: "stat-week-leads" },
            { label: "Quote Requests", value: isLoading ? "—" : quoteLeads, icon: FileText, color: "text-[hsl(43,78%,65%)]", testId: "stat-quote-leads" },
            { label: "Hot Leads", value: isLoading ? "—" : hotLeads.length, icon: Star, color: "text-orange-400", testId: "stat-hot-leads" },
            { label: "Packaged Plans", value: planningWithPackages || "—", icon: Package, color: "text-green-400", testId: "stat-packaged-plans" },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/50 text-sm">{kpi.label}</p>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p className={`text-3xl font-serif font-bold ${kpi.color}`} data-testid={kpi.testId}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Recent Leads
              </h2>
              <span className="text-white/30 text-sm">{totalLeads} total</span>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-[rgba(255,255,255,0.03)] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No leads yet.</p>
                <p className="text-white/25 text-xs mt-1">They'll appear here when visitors submit forms.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...leads].reverse().slice(0, 15).map(lead => (
                  <div key={lead.id} data-testid={`row-lead-${lead.id}`}>
                    <button
                      onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                      className="w-full text-left p-4 rounded-xl border border-[rgba(255,255,255,0.04)] hover:border-[rgba(201,168,76,0.15)] transition-all bg-[rgba(255,255,255,0.02)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[rgba(201,168,76,0.1)] flex items-center justify-center flex-shrink-0 text-[hsl(43,78%,52%)] text-sm font-bold">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                            <p className="text-white/40 text-xs truncate">{lead.company || lead.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs border ${TYPE_COLORS[lead.type] || TYPE_COLORS["general"]}`}>
                            {TYPE_LABELS[lead.type] || lead.type}
                          </Badge>
                          <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${expandedLead === lead.id ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    </button>
                    {expandedLead === lead.id && (
                      <div className="mx-1 mb-2 p-4 bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.1)] rounded-b-xl border-t-0 text-sm space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 text-white/60">
                            <Mail className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                            <a href={`mailto:${lead.email}`} className="hover:text-white transition-colors truncate">{lead.email}</a>
                          </div>
                          {lead.phone && (
                            <div className="flex items-center gap-2 text-white/60">
                              <Phone className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                              <a href={`tel:${lead.phone}`} className="hover:text-white transition-colors">{lead.phone}</a>
                            </div>
                          )}
                          {lead.company && (
                            <div className="flex items-center gap-2 text-white/60">
                              <MapPin className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                              <span>{lead.company}</span>
                            </div>
                          )}
                          {lead.createdAt && (
                            <div className="flex items-center gap-2 text-white/60">
                              <Clock className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                              <span>{formatDate(lead.createdAt)}</span>
                            </div>
                          )}
                        </div>
                        {(lead.officeSize || lead.staffCount || lead.budget || lead.officeLocation) && (
                          <div className="pt-2 border-t border-[rgba(255,255,255,0.05)] grid grid-cols-2 gap-2">
                            {lead.staffCount && <div><p className="text-white/35 text-xs">Staff</p><p className="text-white/70 text-xs font-medium">{lead.staffCount}</p></div>}
                            {lead.officeSize && <div><p className="text-white/35 text-xs">Office Size</p><p className="text-white/70 text-xs font-medium">{lead.officeSize}</p></div>}
                            {lead.budget && <div><p className="text-white/35 text-xs">Budget</p><p className="text-white/70 text-xs font-medium">{lead.budget}</p></div>}
                            {lead.officeLocation && <div><p className="text-white/35 text-xs">Location</p><p className="text-white/70 text-xs font-medium">{lead.officeLocation}</p></div>}
                          </div>
                        )}
                        {(lead.opportunityScore || lead.estimatedValueRange) && (
                          <div className="pt-2 border-t border-[rgba(255,255,255,0.05)] flex items-center gap-4">
                            {lead.opportunityScore !== undefined && (
                              <div>
                                <p className="text-white/35 text-xs">Opportunity Score</p>
                                <p className="text-[hsl(43,78%,65%)] text-sm font-bold">{lead.opportunityScore}<span className="text-white/30 text-xs font-normal">/100</span></p>
                              </div>
                            )}
                            {lead.estimatedValueRange && (
                              <div>
                                <p className="text-white/35 text-xs">Estimated Value</p>
                                <p className="text-[hsl(43,78%,65%)] text-sm font-bold">{lead.estimatedValueRange}</p>
                              </div>
                            )}
                            {lead.opportunityTier && (
                              <div>
                                <p className="text-white/35 text-xs">Tier</p>
                                <p className="text-white/70 text-xs font-medium">{lead.opportunityTier}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {lead.estimateJson && (() => {
                          try {
                            const est = JSON.parse(lead.estimateJson);
                            if (lead.type === "finance-lead") {
                              return (
                                <div className="pt-2 border-t border-emerald-500/20">
                                  <p className="text-emerald-400 text-xs font-semibold mb-2">Finance Lead Details</p>
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    {est.financeType && <div><p className="text-white/35 text-xs">Finance Type</p><p className="text-white/70 text-xs font-medium">{est.financeType}</p></div>}
                                    {est.financeTerm && <div><p className="text-white/35 text-xs">Preferred Term</p><p className="text-white/70 text-xs font-medium">{est.financeTerm}</p></div>}
                                    {est.projectValue && <div><p className="text-white/35 text-xs">Project Value</p><p className="text-emerald-400 text-xs font-bold">{est.projectValue}</p></div>}
                                    {est.routingDestination && <div><p className="text-white/35 text-xs">Routed To</p><p className="text-white/70 text-xs font-medium">{est.routingDestination}</p></div>}
                                    {est.sourcePage && <div><p className="text-white/35 text-xs">Source</p><p className="text-white/70 text-xs">{est.sourcePage}</p></div>}
                                    {est.linkedId && <div><p className="text-white/35 text-xs">Linked ID</p><p className="text-white/60 text-xs font-mono">{est.linkedId}</p></div>}
                                  </div>
                                </div>
                              );
                            }
                            const cs = est?.costSummary;
                            return (
                              <div className="pt-2 border-t border-[rgba(201,168,76,0.15)]">
                                <p className="text-[hsl(43,78%,52%)] text-xs font-semibold mb-2">Advanced Estimate Summary</p>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  {est.packageTier && <div><p className="text-white/35 text-xs">Package Tier</p><p className="text-white/70 text-xs font-medium">{est.packageTier}</p></div>}
                                  {est.workspaceType && <div><p className="text-white/35 text-xs">Workspace Type</p><p className="text-white/70 text-xs font-medium">{est.workspaceType}</p></div>}
                                  {est.quoteReference && <div><p className="text-white/35 text-xs">Quote Ref</p><p className="text-white/70 text-xs font-mono">{est.quoteReference}</p></div>}
                                  {est.implementationTimeline && <div><p className="text-white/35 text-xs">Timeline</p><p className="text-white/70 text-xs font-medium">{est.implementationTimeline}</p></div>}
                                </div>
                                {cs && (
                                  <div className="bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.12)] rounded-lg p-3 text-xs space-y-1">
                                    <div className="flex justify-between"><span className="text-white/40">Furniture</span><span className="text-white/70">${Math.round(cs.furnitureSubtotal || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-white/40">Delivery + Install</span><span className="text-white/70">${Math.round((cs.delivery || 0) + (cs.installation || 0)).toLocaleString()}</span></div>
                                    <div className="flex justify-between font-semibold border-t border-[rgba(201,168,76,0.1)] pt-1 mt-1"><span className="text-white/70">Total Inc GST</span><span className="text-[hsl(43,78%,65%)]">${Math.round(cs.totalIncGst || 0).toLocaleString()}</span></div>
                                  </div>
                                )}
                                {est.productSchedule && est.productSchedule.length > 0 && (
                                  <p className="text-white/35 text-xs mt-1">{est.productSchedule.length} line item{est.productSchedule.length !== 1 ? "s" : ""} in BOQ</p>
                                )}
                              </div>
                            );
                          } catch { return null; }
                        })()}
                        {(lead.nexoraAdminSummary || lead.nexoraIntent || lead.sourcePage) && (
                          <div className="pt-2 border-t border-[rgba(201,168,76,0.15)] space-y-2">
                            <p className="text-[hsl(43,78%,52%)] text-xs font-semibold flex items-center gap-1.5">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)]" />
                              Nexora Intelligence
                            </p>
                            {lead.nexoraAdminSummary && (
                              <p className="text-white/75 text-xs leading-relaxed bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.1)] rounded-lg p-2.5">{lead.nexoraAdminSummary}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              {lead.nexoraIntent && (
                                <div><p className="text-white/35 text-xs">Intent</p><p className="text-white/70 text-xs font-medium capitalize">{lead.nexoraIntent.replace(/_/g, " ")}</p></div>
                              )}
                              {lead.nexoraJourney && (
                                <div><p className="text-white/35 text-xs">Journey</p><p className="text-white/70 text-xs font-medium capitalize">{lead.nexoraJourney}</p></div>
                              )}
                              {lead.nexoraUrgency && (
                                <div><p className="text-white/35 text-xs">Urgency</p><p className={`text-xs font-bold capitalize ${lead.nexoraUrgency === "critical" ? "text-red-400" : lead.nexoraUrgency === "high" ? "text-orange-400" : lead.nexoraUrgency === "medium" ? "text-yellow-400" : "text-white/50"}`}>{lead.nexoraUrgency}</p></div>
                              )}
                              {lead.nexoraConfidence !== undefined && (
                                <div><p className="text-white/35 text-xs">Confidence</p><p className="text-white/70 text-xs font-medium">{lead.nexoraConfidence}%</p></div>
                              )}
                              {lead.nexoraDealBand && (
                                <div className="col-span-2"><p className="text-white/35 text-xs">Est. Deal Band</p><p className="text-[hsl(43,78%,65%)] text-xs font-bold">{lead.nexoraDealBand}</p></div>
                              )}
                              {lead.nexoraNextAction && (
                                <div className="col-span-2"><p className="text-white/35 text-xs">Recommended Next Action</p><p className="text-white/70 text-xs font-medium font-mono">{lead.nexoraNextAction}</p></div>
                              )}
                              {lead.sourcePage && (
                                <div className="col-span-2"><p className="text-white/35 text-xs">Source Page</p><p className="text-white/60 text-xs">{lead.sourcePage}</p></div>
                              )}
                              {lead.nexoraEscalation === "yes" && (
                                <div className="col-span-2"><p className="text-red-400 text-xs font-bold flex items-center gap-1"><span>⚡</span> Escalation Required — contact this lead immediately</p></div>
                              )}
                            </div>
                          </div>
                        )}
                        {lead.message && (
                          <div className="pt-2 border-t border-[rgba(255,255,255,0.05)]">
                            <p className="text-white/40 text-xs mb-1">Message</p>
                            <p className="text-white/60 whitespace-pre-wrap text-xs leading-relaxed">{lead.message}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Leads by Type
              </h2>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-[rgba(255,255,255,0.03)] rounded animate-pulse" />)}
                </div>
              ) : leadsByType.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {leadsByType.map(([type, count]) => (
                    <div key={type} data-testid={`stat-type-${type}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/60 text-sm">{TYPE_LABELS[type] || type}</span>
                        <span className="text-white font-semibold text-sm">{count}</span>
                      </div>
                      <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[hsl(43,78%,52%)] rounded-full transition-all"
                          style={{ width: `${Math.round((count / totalLeads) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Strategy Bookings
                <span className="ml-auto text-xs text-white/30 font-normal">{strategyBookings.length} total</span>
              </h2>
              {strategyBookings.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No bookings yet</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {strategyBookings.map(b => (
                    <div key={b.id} data-testid={`row-booking-${b.id}`}
                      className="p-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{b.name}</div>
                          <div className="text-white/40 text-xs truncate">{b.company} · {b.email}</div>
                          <div className="text-[hsl(43,78%,65%)] text-xs mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {b.bookingDate} at {b.bookingTime}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            b.status === "confirmed" ? "border-green-500/30 text-green-400 bg-green-500/10" :
                            b.status === "cancelled" ? "border-red-500/30 text-red-400 bg-red-500/10" :
                            "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                          }`}>{b.status}</span>
                          {b.status === "pending" && (
                            <button onClick={async () => {
                              await fetch(`/api/admin/strategy-bookings/${b.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ status:"confirmed" }) });
                              refetchBookings();
                            }} className="text-[10px] text-green-400/70 hover:text-green-400 border border-green-500/20 rounded px-1.5 py-0.5 transition-colors">
                              Confirm
                            </button>
                          )}
                          {b.status !== "cancelled" && (
                            <button onClick={async () => {
                              await fetch(`/api/admin/strategy-bookings/${b.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ status:"cancelled" }) });
                              refetchBookings();
                            }} className="text-[10px] text-red-400/70 hover:text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 transition-colors">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Quick Actions
              </h2>
              <div className="space-y-2">
                {[
                  { label: "Planning Requests", href: "/admin/planning-requests", icon: Upload, desc: "Floor plan & space planning" },
                  { label: "Lead Intelligence", href: "/admin/leads", icon: Target, desc: "AI prospecting engine" },
                  { label: "Supplier Quotes", href: "/admin/supplier-quotes", icon: Package, desc: "Quotes & referral tracking" },
                  { label: "Manufacturer Messaging", href: "/admin/manufacturer-messaging", icon: MessageSquare, desc: "WhatsApp manufacturer comms" },
                  { label: "Follow-Up Sequences", href: "/admin/follow-up-sequences", icon: Mail, desc: "Automated lead email sequences" },
                  { label: "Office Move Radar", href: "/admin/office-move-radar", icon: Zap, desc: "Detect relocations, expansions & fit-outs" },
                  { label: "Lease Signal Scanner", href: "/admin/lease-signals", icon: Zap, desc: "AI office move lead detection" },
                  { label: "AI Deal Intelligence", href: "/admin/deal-intelligence", icon: TrendingUp, desc: "Win probability · value · next action · offer strategy" },
                  { label: "Deal Pipeline", href: "/admin/deal-pipeline", icon: TrendingUp, desc: "Weighted revenue forecast" },
                  { label: "Territory Scanner", href: "/admin/territory-scanner", icon: Globe, desc: "Office tower tenant tracking" },
                  { label: "Procurement Engine", href: "/admin/procurement-engine", icon: Package, desc: "Supplier routing & cost estimates" },
                  { label: "Supplier Intelligence", href: "/admin/supplier-intelligence", icon: Shield, desc: "Performance profiles · RFQ automation · Response tracking" },
                  { label: "Workspace Learning", href: "/admin/workspace-learning", icon: Brain, desc: "AI pattern intelligence from projects" },
                  { label: "Intelligence Hub", href: "/admin/intelligence-hub", icon: BarChart3, desc: "Autonomous BI, trends & SEO content" },
                  { label: "Formal Quotes", href: "/admin/quotes", icon: FileText, desc: "Create & send PDF client quotes" },
                  { label: "AI Deal Hunter", href: "/admin/deal-hunter", icon: Crosshair, desc: "Automated opportunity discovery & pipeline feeder" },
                  { label: "Partner Network", href: "/admin/partner-network", icon: Network, desc: "Broker & partner ecosystem management" },
                  { label: "Relocation Intelligence", href: "/admin/relocation-intelligence", icon: Radar, desc: "Market signals & relocation probability" },
                  { label: "Workspace Strategy", href: "/admin/workspace-strategy", icon: Brain, desc: "AI layout, package & margin optimisation" },
                  { label: "Profit Engine", href: "/admin/profit-engine", icon: DollarSign, desc: "Package margin & cost stack analysis" },
                  { label: "Product Reviews", href: "/admin/product-reviews", icon: Star, desc: "Moderate client reviews" },
                  { label: "Marketing Hub", href: "/admin/marketing", icon: Megaphone, desc: "Generate & post content" },
                  { label: "View Full Site", href: "/", icon: Eye, desc: "See your website" },
                  { label: "Quote Builder", href: "/quote-builder", icon: FileText, desc: "Interactive quote tool" },
                ].map(action => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.href} href={action.href}>
                      <div
                        data-testid={`button-quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-[rgba(255,255,255,0.05)] hover:border-[rgba(201,168,76,0.2)] transition-all cursor-pointer min-h-[56px]"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[rgba(201,168,76,0.08)] flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{action.label}</p>
                          <p className="text-white/40 text-xs">{action.desc}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Hot Leads */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
                  <Star className="w-4 h-4 text-orange-400" /> Hot Leads
                </h2>
                <Link href="/admin/command-centre">
                  <span className="text-white/30 text-xs hover:text-white/60 transition-colors cursor-pointer">View all</span>
                </Link>
              </div>
              {hotLeads.length === 0 ? (
                <div className="text-center py-6">
                  <Star className="w-7 h-7 text-white/15 mx-auto mb-2" />
                  <p className="text-white/30 text-xs">No high-score leads yet</p>
                  <p className="text-white/20 text-xs mt-1">Leads scoring 70+ appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {hotLeads.map(lead => (
                    <Link key={lead.id} href="/admin/command-centre">
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(255,255,255,0.04)] hover:border-[rgba(251,146,60,0.2)] transition-all cursor-pointer" data-testid={`row-hot-lead-${lead.id}`}>
                        <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-orange-400 text-xs font-bold">
                          {lead.opportunityScore}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-xs font-medium truncate">{lead.name}</p>
                          <p className="text-white/40 text-xs truncate">{lead.company || lead.type}</p>
                        </div>
                        {lead.estimatedValueRange && (
                          <span className="text-[hsl(43,78%,65%)] text-xs font-semibold flex-shrink-0">{lead.estimatedValueRange}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Revenue Intelligence Panel */}
            <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" /> Revenue Intelligence
                </h3>
                <a href="/admin/deal-pipeline" className="text-white/30 hover:text-white/60 text-xs transition-colors cursor-pointer">
                  Full pipeline →
                </a>
              </div>
              {forecast ? (
                <div className="space-y-4">
                  {/* ── KPI row ── */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 text-center">
                      <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Pipeline</div>
                      <div className="text-white font-bold text-sm" data-testid="forecast-gross-pipeline">
                        {forecast.grossPipeline >= 1000000
                          ? `$${(forecast.grossPipeline / 1000000).toFixed(1)}M`
                          : forecast.grossPipeline >= 1000
                          ? `$${(forecast.grossPipeline / 1000).toFixed(0)}k`
                          : `$${forecast.grossPipeline}`}
                      </div>
                    </div>
                    <div className="bg-[rgba(201,168,76,0.08)] rounded-xl p-3 text-center">
                      <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Expected Revenue</div>
                      <div className="text-[hsl(43,78%,65%)] font-bold text-sm" data-testid="forecast-expected-revenue">
                        {forecast.weightedRevenue >= 1000000
                          ? `$${(forecast.weightedRevenue / 1000000).toFixed(1)}M`
                          : forecast.weightedRevenue >= 1000
                          ? `$${(forecast.weightedRevenue / 1000).toFixed(0)}k`
                          : `$${forecast.weightedRevenue}`}
                      </div>
                    </div>
                    <div className="bg-[rgba(251,191,36,0.06)] rounded-xl p-3 text-center">
                      <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Closing 90d</div>
                      <div className="text-amber-400 font-bold text-sm" data-testid="forecast-closing-90d">
                        {forecast.closing90Days?.length ?? 0}
                        <span className="text-white/30 text-[10px] font-normal ml-1">deals</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Opportunity table ── */}
                  {(forecast.opportunities ?? []).length > 0 ? (
                    <div>
                      <div className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Opportunities</div>
                      <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.05)]">
                        <table className="w-full text-xs" data-testid="revenue-intel-table">
                          <thead>
                            <tr className="bg-[rgba(255,255,255,0.03)] border-b border-[rgba(255,255,255,0.05)]">
                              <th className="text-left text-white/30 font-medium px-3 py-2">Company</th>
                              <th className="text-right text-white/30 font-medium px-3 py-2">Value</th>
                              <th className="text-center text-white/30 font-medium px-3 py-2 hidden sm:table-cell">Stage</th>
                              <th className="text-center text-white/30 font-medium px-3 py-2">Prob</th>
                              <th className="text-right text-white/30 font-medium px-3 py-2">Expected</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(forecast.opportunities ?? []).slice(0, 8).map((opp, i) => {
                              const probColor =
                                opp.probabilityScore >= 75 ? "text-green-400" :
                                opp.probabilityScore >= 60 ? "text-amber-400" :
                                opp.probabilityScore >= 40 ? "text-blue-400" :
                                "text-white/40";
                              const fmtVal = (n: number) =>
                                n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M`
                                : n >= 1000 ? `$${(n / 1000).toFixed(0)}k`
                                : n > 0 ? `$${n}` : "—";
                              return (
                                <tr key={opp.id} className={`border-b border-[rgba(255,255,255,0.03)] ${i % 2 === 0 ? "" : "bg-[rgba(255,255,255,0.01)]"}`} data-testid={`opp-row-${opp.id}`}>
                                  <td className="px-3 py-2 text-white/80 truncate max-w-[90px]">{opp.companyName}</td>
                                  <td className="px-3 py-2 text-white/60 text-right whitespace-nowrap">{fmtVal(opp.projectValue)}</td>
                                  <td className="px-3 py-2 text-white/40 text-center whitespace-nowrap hidden sm:table-cell text-[10px]">{opp.pipelineStage}</td>
                                  <td className={`px-3 py-2 text-center font-bold ${probColor}`}>{opp.probabilityScore}%</td>
                                  <td className="px-3 py-2 text-[hsl(43,78%,65%)] font-semibold text-right whitespace-nowrap">{fmtVal(opp.expectedRevenue)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {(forecast.opportunities ?? []).length > 0 && (
                            <tfoot>
                              <tr className="bg-[rgba(201,168,76,0.05)] border-t border-[rgba(201,168,76,0.15)]">
                                <td className="px-3 py-2 text-white/50 font-semibold text-xs" colSpan={2}>
                                  Total ({forecast.opportunities.length} opportunities)
                                </td>
                                <td className="hidden sm:table-cell" />
                                <td className="px-3 py-2 text-center text-white/40 text-xs font-semibold">—</td>
                                <td className="px-3 py-2 text-right text-[hsl(43,78%,65%)] font-bold text-xs" data-testid="forecast-total-expected">
                                  {forecast.weightedRevenue >= 1000000
                                    ? `$${(forecast.weightedRevenue / 1000000).toFixed(1)}M`
                                    : forecast.weightedRevenue >= 1000
                                    ? `$${(forecast.weightedRevenue / 1000).toFixed(0)}k`
                                    : `$${forecast.weightedRevenue}`}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                      {(forecast.opportunities ?? []).length > 8 && (
                        <div className="text-center mt-2">
                          <a href="/admin/deal-pipeline" className="text-white/30 hover:text-white/60 text-xs transition-colors">
                            +{forecast.opportunities.length - 8} more →
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-white/30 text-xs text-center py-4">No active opportunities — add leads to the pipeline to see forecasts</div>
                  )}

                  {/* ── Secondary stats ── */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[rgba(255,255,255,0.05)]">
                    <div className="text-xs flex justify-between">
                      <span className="text-white/40">Won Revenue</span>
                      <span className="text-green-400 font-semibold" data-testid="forecast-won-revenue">
                        {forecast.wonValue > 0
                          ? forecast.wonValue >= 1000000 ? `$${(forecast.wonValue / 1000000).toFixed(1)}M`
                          : forecast.wonValue >= 1000 ? `$${(forecast.wonValue / 1000).toFixed(0)}k`
                          : `$${forecast.wonValue}` : "—"}
                      </span>
                    </div>
                    {forecast.winRate !== null && (
                      <div className="text-xs flex justify-between">
                        <span className="text-white/40">Win Rate</span>
                        <span className="text-blue-400 font-semibold" data-testid="forecast-win-rate">{forecast.winRate}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-white/60">
                  <div className="flex justify-between">
                    <span>Quote Requests</span>
                    <span className="text-white font-medium">{quoteLeads}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Layout Plans</span>
                    <span className="text-white font-medium">{layoutLeads}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Strategy Calls</span>
                    <span className="text-white font-medium">{strategyLeads}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Finance Leads</span>
                    <span className="text-white font-medium">{financeLeads}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Intelligence Status */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" /> Intelligence Engine
                </h3>
                <Link href="/admin/intelligence-hub">
                  <span className="text-white/30 text-xs hover:text-white/60 transition-colors cursor-pointer">Hub</span>
                </Link>
              </div>
              {lastJobRun ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Last job</span>
                    <span className={`text-xs font-medium ${jobStatusColor}`}>{lastJobRun.jobType?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Status</span>
                    <span className={`text-xs ${jobStatusColor}`}>{lastJobRun.status}</span>
                  </div>
                </div>
              ) : (
                <p className="text-white/30 text-xs">No jobs run yet</p>
              )}
              <Link href="/admin/profit-engine">
                <div className="mt-3 text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <DollarSign className="w-3 h-3" /> Profit Engine
                </div>
              </Link>
            </div>

            {/* Office Move Radar Widget */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Office Move Radar
                </h3>
                <Link href="/admin/office-move-radar">
                  <span className="text-white/30 text-xs hover:text-white/60 transition-colors cursor-pointer">View all</span>
                </Link>
              </div>
              {radarStats && radarStats.total > 0 ? (
                <div className="space-y-2" data-testid="radar-widget-stats">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Total signals</span>
                    <span data-testid="radar-widget-total" className="text-white text-xs font-medium">{radarStats.total}</span>
                  </div>
                  {radarStats.high > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">High priority</span>
                      <span className="text-red-400 text-xs font-medium">{radarStats.high} urgent</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Unreviewed</span>
                    <span className="text-blue-400 text-xs font-medium">{radarStats.newCount} new</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">In pipeline</span>
                    <span className="text-emerald-400 text-xs font-medium">{radarStats.inPipeline}</span>
                  </div>
                  {radarRecords.filter(r => r.priority === "High" && r.status === "New").slice(0, 2).map(r => (
                    <Link key={r.id} href="/admin/office-move-radar">
                      <div className="mt-1 p-2 rounded-lg bg-red-500/5 border border-red-500/20 cursor-pointer hover:border-red-500/40 transition-colors">
                        <p className="text-red-300 text-xs font-medium">{r.companyName}</p>
                        <p className="text-white/30 text-xs">{r.city} · Score {r.radarScore}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-white/30 text-xs mb-3">No radar signals yet — run a scan to detect office move opportunities.</p>
                  <Link href="/admin/office-move-radar">
                    <div className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer">
                      <Zap className="w-3 h-3" /> Open Radar
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
