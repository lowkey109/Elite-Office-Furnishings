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
  Loader2, Network, Radar, Brain, Crosshair, Globe, Flame, Activity,
  ChevronDown, X as XIcon, UserCheck, Sparkles, CreditCard, Receipt, Webhook,
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

  // ── Heatmap + Company Intelligence queries ─────────────────────────────────
  const [selectedHeatmapCity, setSelectedHeatmapCity] = useState<string | null>(null);
  const [showHeatmapDetail, setShowHeatmapDetail] = useState(false);

  const { data: heatmapData } = useQuery<{
    cities: {
      city: string; country: string; opportunities: number; highPriority: number;
      avgConfidence: number; totalPipelineValue: number; formattedValue: string;
      companies: { name: string; signalType: string; confidence: number; value: string; priority: string }[];
    }[];
    countryBreakdown: { country: string; totalOpportunities: number; formattedValue: string; cities: number }[];
    hottestCity: { city: string; opportunities: number; formattedValue: string } | null;
    totalOpportunities: number;
  }>({
    queryKey: ["/api/admin/heatmap-data"],
    enabled: authed,
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const { data: companyProfiles = [] } = useQuery<{
    id: string; companyName: string; city: string; country: string; industry: string | null;
    confidenceScore: number; priorityLevel: string; moveProbability: number;
    radarSignalCount: number; visitorSessions: number; estimatedProjectValue: string | null;
    reasoningSummary: string | null; signalTypesJson: string | null; latestSignalDate: string | null;
  }[]>({
    queryKey: ["/api/admin/company-intelligence"],
    enabled: authed,
    staleTime: 120000,
  });

  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const { data: companyDetail } = useQuery<{
    id: string; companyName: string; city: string; country: string; industry: string | null;
    employeeEstimate: string | null; estimatedOfficeSizeSqm: string | null;
    estimatedProjectValue: string | null; confidenceScore: number; moveProbability: number;
    priorityLevel: string; radarSignalCount: number; visitorSessions: number;
    reasoningSummary: string | null; signalTimelineJson: string | null;
    contacts: { id: string; role: string; contactName: string | null; department: string | null; confidenceScore: number; notes: string | null }[];
  }>({
    queryKey: ["/api/admin/company-intelligence", selectedCompany],
    queryFn: () => fetch(`/api/admin/company-intelligence/${selectedCompany}`).then(r => r.json()),
    enabled: authed && !!selectedCompany,
    staleTime: 30000,
  });

  // ── Workspace Intelligence queries (Stage 7) ─────────────────────────────
  const { data: intelligenceDashboard } = useQuery<{
    topOpportunityZones: { suburb: string; city: string; zoneScore: number; demandScore: number; activeCompanies: number; recentSignals: number }[];
    demandHotspots: { suburb: string; city: string; demandScore: number; demandTier: string; activeCompanies: number; recentSignals: number }[];
    atRiskBuildings: { buildingName: string; city: string; vacancyRiskScore: number; riskTier: string; tenantTurnoverRate: number }[];
    relocationReadyCompanies: { companyName: string; city: string; moveProbability: number; confidenceScore: number; industry: string | null; priorityLevel: string }[];
    systemStats: { totalSignals: number; activeCompanies: number; highPriorityOpps: number; avgConfidence: number };
  }>({
    queryKey: ["/api/admin/intelligence/dashboard"],
    queryFn: () => fetch("/api/admin/intelligence/dashboard").then(r => r.json()),
    enabled: authed,
    staleTime: 120000,
    refetchInterval: 180000,
  });

  const { data: sourceHealth, refetch: refetchSourceHealth } = useQuery<{ sources: { id: string; sourceName: string; sourceType: string; isActive: boolean; lastSuccessfulRun: string | null; errorCount: number }[]; total: number }>({
    queryKey: ["/api/admin/intelligence/source-health"],
    queryFn: () => fetch("/api/admin/intelligence/source-health").then(r => r.json()),
    enabled: authed,
    staleTime: 300000,
  });

  const { data: jobQueueStats, refetch: refetchJobQueue } = useQuery<{ initialized: boolean; queues: { name: string; active: number; completed: number; failed: number }[] }>({
    queryKey: ["/api/admin/intelligence/job-queue"],
    queryFn: () => fetch("/api/admin/intelligence/job-queue").then(r => r.json()),
    enabled: authed,
    refetchInterval: 15000,
  });

  const { data: graphStats } = useQuery<{ totalEdges: number; edgesByType: Record<string, number>; topConnectedCompanies: { name: string; connections: number }[] }>({
    queryKey: ["/api/admin/intelligence/graph-stats"],
    queryFn: () => fetch("/api/admin/intelligence/graph-stats").then(r => r.json()),
    enabled: authed,
    staleTime: 60000,
  });

  const { data: leaseOpps } = useQuery<{ opps: { id: string; companyName: string; city: string; urgencyTier: string; opportunityScore: number; predictedExpiryYear: number | null; estimatedProjectValue: number | null }[]; total: number }>({
    queryKey: ["/api/admin/intelligence/lease-expiry-opps"],
    queryFn: () => fetch("/api/admin/intelligence/lease-expiry-opps").then(r => r.json()),
    enabled: authed,
    staleTime: 60000,
  });

  // ── Outreach Engine queries ────────────────────────────────────────────────
  const { data: outreachStats, refetch: refetchOutreach } = useQuery<{
    drafts: number; sent: number; replied: number; failed: number; replyRate: number;
    activeThreads: number; bookedThreads: number; repliedThreads: number; totalThreads: number;
    outreachReadyCount: number; followUpsDueCount: number; activeThreadCount: number; safeMode: boolean;
  }>({
    queryKey: ["/api/admin/outreach/stats"],
    queryFn: () => fetch("/api/admin/outreach/stats").then(r => r.json()),
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: bookingStats, refetch: refetchBookings } = useQuery<{
    provider: string; isSandbox: boolean; totalLinks: number; clicked: number; confirmed: number; conversionRate: number;
    byStatus: Record<string, number>; recentMeetings: { companyName: string; meetingTime: string | null; provider: string }[];
  }>({
    queryKey: ["/api/admin/bookings/stats"],
    queryFn: () => fetch("/api/admin/bookings/stats").then(r => r.json()),
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: contactDiscoveryStats, refetch: refetchContactDiscovery } = useQuery<{
    totalRuns: number; completedRuns: number; totalContacts: number; directContacts: number;
    fallbackContacts: number; highConfidenceContacts: number; avgContactsPerRun: number;
  }>({
    queryKey: ["/api/admin/contact-discovery/stats"],
    queryFn: () => fetch("/api/admin/contact-discovery/stats").then(r => r.json()),
    enabled: authed,
    refetchInterval: 60000,
  });

  const { data: revenueStats, refetch: refetchRevenue } = useQuery<{
    revenueToday: number; revenueThisWeek: number; depositsReceived: number;
    fullPaymentsReceived: number; outstandingInvoices: number; expiredLinks: number;
    quotesAwaitingPayment: number; stripeEnabled: boolean; testMode: boolean; safeMode: boolean;
    webhookHealthy: boolean; lastWebhookAt: string | null;
  }>({
    queryKey: ["/api/admin/revenue/stats"],
    queryFn: () => fetch("/api/admin/revenue/stats").then(r => r.json()),
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: revenuePayments } = useQuery<{ payments: any[]; total: number }>({
    queryKey: ["/api/admin/revenue/payments"],
    queryFn: () => fetch("/api/admin/revenue/payments").then(r => r.json()),
    enabled: authed,
    refetchInterval: 60000,
  });

  const { data: revenueWebhooks } = useQuery<{ events: any[]; total: number; processed: number }>({
    queryKey: ["/api/admin/revenue/webhooks"],
    queryFn: () => fetch("/api/admin/revenue/webhooks").then(r => r.json()),
    enabled: authed,
    refetchInterval: 60000,
  });

  const { data: outreachThreadsList } = useQuery<{ threads: { id: string; companyName: string; status: string; currentStage: number; outreachAngle: string | null; bookingStatus: string; updatedAt: string | null }[]; total: number }>({
    queryKey: ["/api/outreach/threads"],
    queryFn: () => fetch("/api/outreach/threads?limit=20").then(r => r.json()),
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: dealClosingStats, refetch: refetchDealClosing } = useQuery<{
    proposals: { total: number; draft: number; sent: number; viewed: number; approved: number; rejected: number };
    approvals: { total: number; pending: number; approved: number; rejected: number };
    negotiation: number;
    closingThisWeek: number;
    pipeline: Record<string, number>;
  }>({
    queryKey: ["/api/admin/deal-closing/stats"],
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: commissionStats, refetch: refetchCommissions } = useQuery<{
    total: number; pending: number; approved: number; paid: number;
    totalPayableAud: number; totalPaidAud: number;
  }>({
    queryKey: ["/api/commissions/stats"],
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: buildingStats, refetch: refetchBuildings } = useQuery<{
    totalBuildings: number; totalTenants: number; activeLeases: number;
    expiringIn12Months: number; cities: number;
  }>({
    queryKey: ["/api/admin/buildings/stats"],
    enabled: authed,
    refetchInterval: 60000,
  });

  const runContactDiscoveryMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/outreach/run-contact-discovery", {}),
    onSuccess: () => { toast({ title: "Contact discovery started", description: "Discovering contacts for high-value opportunities." }); refetchContactDiscovery(); },
    onError: () => toast({ title: "Discovery failed", variant: "destructive" }),
  });

  const generateOutreachMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/outreach/create-for-top-opportunities", {}),
    onSuccess: (d: any) => { toast({ title: `Outreach generated`, description: `${d?.created ?? 0} new threads created.` }); refetchOutreach(); },
    onError: () => toast({ title: "Generation failed", variant: "destructive" }),
  });

  const processFollowUpsMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/outreach/process-followups", {}),
    onSuccess: (d: any) => { toast({ title: "Follow-ups processed", description: `${d?.sent ?? 0} scheduled, ${d?.skipped ?? 0} skipped.` }); refetchOutreach(); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const [triggeringScan, setTriggeringScan] = useState<string | null>(null);
  const triggerScanMutation = useMutation({
    mutationFn: async (scanType: string) => {
      setTriggeringScan(scanType);
      return await apiRequest("POST", "/api/admin/intelligence/trigger-scan", { scanType });
    },
    onSuccess: (_data, scanType) => {
      toast({ title: `Scan triggered`, description: `${scanType === "all" ? "All scans" : scanType} scan queued successfully.` });
      setTimeout(() => refetchJobQueue(), 2000);
      setTriggeringScan(null);
    },
    onError: () => {
      toast({ title: "Scan failed", description: "Could not trigger scan. Try again.", variant: "destructive" });
      setTriggeringScan(null);
    },
  });

  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      await apiRequest("PATCH", `/api/admin/intelligence/source/${id}/toggle`, { isActive }),
    onSuccess: () => {
      refetchSourceHealth();
      toast({ title: "Source updated", description: "Intelligence source status changed." });
    },
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

        {/* ── Deal Heatmap Panel ───────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,90,50,0.18)] rounded-2xl overflow-hidden" data-testid="panel-deal-heatmap">
          <div className="px-6 py-4 border-b border-[rgba(255,90,50,0.15)] flex items-center justify-between bg-[rgba(255,90,50,0.03)]">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <h2 className="text-white font-semibold text-sm">Deal Heatmap</h2>
              <span className="text-white/30 text-xs ml-1">— opportunity density by city</span>
            </div>
            <div className="flex items-center gap-3">
              {heatmapData?.hottestCity && (
                <span className="text-orange-400 text-xs font-semibold">
                  🔥 {heatmapData.hottestCity.city} ({heatmapData.hottestCity.opportunities} opps)
                </span>
              )}
              {showHeatmapDetail && (
                <button onClick={() => { setShowHeatmapDetail(false); setSelectedHeatmapCity(null); }}
                  className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1">
                  <XIcon className="w-3 h-3" /> Close
                </button>
              )}
            </div>
          </div>

          {!heatmapData || heatmapData.cities.length === 0 ? (
            <div className="p-8 text-center">
              <Flame className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm mb-1">No heatmap data yet.</p>
              <p className="text-white/20 text-xs">Add radar signals or visitor data to populate the heatmap.</p>
            </div>
          ) : (
            <div className="p-5">
              {/* Australian city heatmap — visual bubble map */}
              <div className="relative bg-[rgba(0,0,0,0.3)] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden mb-4" style={{ height: 260 }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/5 text-[80px] font-black select-none pointer-events-none">AU</span>
                </div>
                {/* City bubbles positioned geographically */}
                {(() => {
                  const CITY_POSITIONS: Record<string, { x: number; y: number }> = {
                    "Sydney": { x: 86, y: 66 }, "Melbourne": { x: 72, y: 80 }, "Brisbane": { x: 87, y: 45 },
                    "Perth": { x: 12, y: 58 }, "Adelaide": { x: 56, y: 70 }, "Canberra": { x: 81, y: 72 },
                    "Gold Coast": { x: 88, y: 49 }, "Newcastle": { x: 86, y: 60 }, "Hobart": { x: 72, y: 93 },
                    "Darwin": { x: 42, y: 8 }, "Sunshine Coast": { x: 88, y: 42 }, "Wollongong": { x: 84, y: 69 },
                    "Geelong": { x: 70, y: 82 }, "Cairns": { x: 68, y: 15 }, "Townsville": { x: 65, y: 22 },
                  };
                  const auCities = heatmapData.cities.filter(c => c.country === "Australia" && CITY_POSITIONS[c.city]);
                  const maxOpp = Math.max(...auCities.map(c => c.opportunities), 1);
                  return auCities.map(city => {
                    const pos = CITY_POSITIONS[city.city];
                    if (!pos) return null;
                    const intensity = city.opportunities / maxOpp;
                    const size = Math.max(24, Math.min(56, 24 + intensity * 32));
                    const color = intensity >= 0.75 ? "rgb(239,68,68)" : intensity >= 0.5 ? "rgb(251,146,60)" : intensity >= 0.25 ? "rgb(234,179,8)" : "rgb(74,222,128)";
                    const isSelected = selectedHeatmapCity === city.city;
                    return (
                      <button
                        key={city.city}
                        data-testid={`heatmap-city-${city.city.replace(/\s/g, "-")}`}
                        onClick={() => { setSelectedHeatmapCity(city.city); setShowHeatmapDetail(true); }}
                        className="absolute flex flex-col items-center transition-all hover:scale-110"
                        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <div
                          className="rounded-full flex items-center justify-center transition-all"
                          style={{
                            width: size, height: size,
                            backgroundColor: color + "33",
                            border: `2px solid ${isSelected ? "white" : color}`,
                            boxShadow: isSelected ? `0 0 12px ${color}` : `0 0 6px ${color}44`,
                          }}
                        >
                          <span className="text-white font-black text-xs">{city.opportunities}</span>
                        </div>
                        <span className="text-white/70 text-[9px] mt-0.5 whitespace-nowrap font-medium">{city.city}</span>
                      </button>
                    );
                  });
                })()}
              </div>

              {/* City detail drill-down */}
              {showHeatmapDetail && selectedHeatmapCity && (() => {
                const city = heatmapData.cities.find(c => c.city === selectedHeatmapCity);
                if (!city) return null;
                return (
                  <div className="bg-[rgba(255,90,50,0.05)] border border-[rgba(255,90,50,0.18)] rounded-xl p-4 mb-4" data-testid="heatmap-city-detail">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold text-sm">{city.city}</p>
                        <p className="text-white/40 text-xs">{city.opportunities} opportunities · Avg confidence {city.avgConfidence}% · {city.formattedValue} est. value</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {city.highPriority > 0 && <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">{city.highPriority} HIGH</Badge>}
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {city.companies.map((co, i) => (
                        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: co.priority === "High" ? "rgb(239,68,68)" : co.priority === "Medium" ? "rgb(251,146,60)" : "rgb(74,222,128)" }} />
                          <span className="text-white text-xs font-medium flex-1 truncate">{co.name}</span>
                          <span className="text-white/40 text-xs flex-shrink-0">{co.signalType.replace(/_/g, " ")}</span>
                          <span className="text-[hsl(43,78%,65%)] text-xs flex-shrink-0 font-semibold">{co.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* City ranking bar chart */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Top Cities</p>
                  <div className="space-y-1.5">
                    {heatmapData.cities.filter(c => c.country === "Australia").slice(0, 5).map((city, i) => {
                      const maxOpp = heatmapData.cities[0]?.opportunities || 1;
                      const pct = (city.opportunities / maxOpp) * 100;
                      const barColor = i === 0 ? "bg-red-500" : i === 1 ? "bg-orange-500" : i === 2 ? "bg-yellow-500" : "bg-green-500";
                      return (
                        <button key={city.city} onClick={() => { setSelectedHeatmapCity(city.city); setShowHeatmapDetail(true); }}
                          className="w-full" data-testid={`heatmap-bar-${city.city.replace(/\s/g, "-")}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 text-xs w-20 text-left truncate">{city.city}</span>
                            <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-white/50 text-xs w-4 text-right">{city.opportunities}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Global Pipeline</p>
                  <div className="space-y-1.5">
                    {(heatmapData.countryBreakdown || []).filter(c => c.totalOpportunities > 0).map(country => (
                      <div key={country.country} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-white/30" />
                          <span className="text-white/60 text-xs truncate" style={{ maxWidth: 90 }}>{country.country}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 text-xs">{country.totalOpportunities} opps</span>
                          <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">{country.formattedValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Company Intelligence Panel ────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.18)] rounded-2xl overflow-hidden" data-testid="panel-company-intelligence">
          <div className="px-6 py-4 border-b border-[rgba(100,180,255,0.15)] flex items-center justify-between bg-[rgba(100,180,255,0.03)]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold text-sm">Company Intelligence</h2>
              <span className="text-white/30 text-xs ml-1">— persistent profiles with stacked signal scoring</span>
            </div>
            <div className="flex items-center gap-3">
              {companyProfiles.length > 0 && (
                <span className="text-blue-400/70 text-xs">{companyProfiles.length} companies tracked</span>
              )}
              <button
                onClick={() => apiRequest("POST", "/api/admin/company-intelligence/sync", {}).then(() => qc.invalidateQueries({ queryKey: ["/api/admin/company-intelligence"] }))}
                className="text-blue-400/70 text-xs hover:text-blue-400 flex items-center gap-1 transition-colors"
                data-testid="button-company-intel-sync"
              >
                <RefreshCw className="w-3 h-3" /> Sync
              </button>
              {selectedCompany && (
                <button onClick={() => setSelectedCompany(null)}
                  className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1">
                  <XIcon className="w-3 h-3" /> Close
                </button>
              )}
            </div>
          </div>

          {companyProfiles.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm mb-1">No company profiles yet.</p>
              <p className="text-white/20 text-xs mb-4">Click Sync to aggregate radar signals into company intelligence profiles.</p>
              <button
                onClick={() => apiRequest("POST", "/api/admin/company-intelligence/sync", {}).then(() => qc.invalidateQueries({ queryKey: ["/api/admin/company-intelligence"] }))}
                className="text-blue-400/60 text-xs hover:text-blue-400 transition-colors flex items-center gap-1.5 mx-auto"
                data-testid="button-company-intel-sync-empty"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync now
              </button>
            </div>
          ) : selectedCompany && companyDetail ? (
            /* Company detail view */
            <div className="p-5" data-testid="panel-company-detail">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white font-bold text-base">{companyDetail.companyName}</p>
                  <p className="text-white/40 text-xs mt-0.5">{companyDetail.city}, {companyDetail.country} · {companyDetail.industry || "Unknown industry"}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black" style={{ color: companyDetail.confidenceScore >= 80 ? "rgb(239,68,68)" : companyDetail.confidenceScore >= 65 ? "rgb(251,146,60)" : companyDetail.confidenceScore >= 45 ? "rgb(234,179,8)" : "rgb(74,222,128)" }}>
                    {companyDetail.confidenceScore}%
                  </p>
                  <p className="text-white/40 text-xs">confidence</p>
                </div>
              </div>

              {/* Signal stacking summary */}
              {companyDetail.reasoningSummary && (
                <div className="bg-[rgba(100,180,255,0.06)] border border-[rgba(100,180,255,0.15)] rounded-xl p-3 mb-4">
                  <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">Why this score</p>
                  <div className="flex flex-wrap gap-1.5">
                    {companyDetail.reasoningSummary.split(" • ").map((reason, i) => (
                      <span key={i} className="text-white/70 text-xs bg-[rgba(255,255,255,0.05)] rounded-lg px-2 py-0.5 border border-[rgba(255,255,255,0.08)]">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Radar signals", value: companyDetail.radarSignalCount },
                  { label: "Visitor sessions", value: companyDetail.visitorSessions },
                  { label: "Move probability", value: `${companyDetail.moveProbability}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 text-center border border-[rgba(255,255,255,0.06)]">
                    <p className="text-white font-bold text-lg">{value}</p>
                    <p className="text-white/40 text-xs">{label}</p>
                  </div>
                ))}
              </div>

              {companyDetail.estimatedProjectValue && (
                <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl p-3 mb-4 flex justify-between items-center">
                  <span className="text-white/60 text-xs">Estimated project value</span>
                  <span className="text-[hsl(43,78%,65%)] font-bold">{companyDetail.estimatedProjectValue}</span>
                </div>
              )}

              {/* Org chart contacts */}
              {companyDetail.contacts && companyDetail.contacts.length > 0 && (
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Inferred Decision Makers</p>
                  <div className="space-y-2">
                    {companyDetail.contacts.map(contact => (
                      <div key={contact.id} className="flex items-center gap-3 bg-[rgba(255,255,255,0.03)] rounded-xl p-3 border border-[rgba(255,255,255,0.06)]">
                        <UserCheck className="w-4 h-4 text-blue-400/60 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold">{contact.contactName || "Unknown contact"}</p>
                          <p className="text-white/40 text-xs">{contact.role}{contact.department ? ` · ${contact.department}` : ""}</p>
                        </div>
                        <span className="text-white/30 text-xs">{contact.confidenceScore}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {companyDetail.contacts && companyDetail.contacts.length === 0 && (
                <button
                  onClick={() => apiRequest("POST", `/api/admin/company-intelligence/${selectedCompany}/extract-contacts`, {}).then(() => qc.invalidateQueries({ queryKey: ["/api/admin/company-intelligence", selectedCompany] }))}
                  className="w-full mt-2 text-blue-400/60 hover:text-blue-400 text-xs flex items-center gap-1.5 justify-center py-2 border border-[rgba(100,180,255,0.15)] rounded-xl transition-colors"
                  data-testid="button-extract-contacts"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Extract decision maker contacts (AI)
                </button>
              )}
            </div>
          ) : (
            /* Company list view */
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {companyProfiles.slice(0, 8).map(company => {
                const priorityColor = company.priorityLevel === "urgent"
                  ? "text-red-400 bg-red-500/10 border-red-500/20"
                  : company.priorityLevel === "high"
                  ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
                  : company.priorityLevel === "medium"
                  ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                  : "text-zinc-400 bg-zinc-500/10 border-zinc-600/20";
                const signalTypes = (() => {
                  try { return JSON.parse(company.signalTypesJson || "[]") as string[]; } catch { return []; }
                })();
                return (
                  <button
                    key={company.id}
                    onClick={() => setSelectedCompany(company.id)}
                    className="w-full text-left px-5 py-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    data-testid={`company-intel-row-${company.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[rgba(100,180,255,0.08)] border border-[rgba(100,180,255,0.15)] flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-400/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1 flex-wrap">
                          <p className="text-white font-semibold text-sm">{company.companyName}</p>
                          <Badge className={`text-xs border capitalize ${priorityColor}`}>{company.priorityLevel}</Badge>
                          {company.estimatedProjectValue && (
                            <span className="ml-auto text-[hsl(43,78%,65%)] text-sm font-bold">{company.estimatedProjectValue}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/40">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{company.city}, {company.country}</span>
                          {company.industry && <span>{company.industry}</span>}
                          <span className="text-blue-400/60">{company.radarSignalCount} signals</span>
                          <span className="ml-auto text-white/60 font-semibold">{company.confidenceScore}% confidence</span>
                        </div>
                        {signalTypes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {signalTypes.slice(0, 3).map(st => (
                              <span key={st} className="text-[10px] text-white/30 bg-[rgba(255,255,255,0.04)] rounded px-1.5 py-0.5 border border-[rgba(255,255,255,0.06)]">
                                {st.replace(/_/g, " ")}
                              </span>
                            ))}
                            {signalTypes.length > 3 && <span className="text-[10px] text-white/20">+{signalTypes.length - 3}</span>}
                          </div>
                        )}
                        {company.reasoningSummary && (
                          <p className="text-white/25 text-xs mt-1 italic truncate">{company.reasoningSummary}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/20 flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
              {companyProfiles.length > 8 && (
                <div className="px-5 py-3 text-center">
                  <span className="text-white/30 text-xs">{companyProfiles.length - 8} more companies tracked</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Workspace Intelligence Widgets (Stage 7) ─────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-workspace-intelligence">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold text-sm">Workspace Intelligence</h2>
              <span className="text-[10px] text-blue-400/60 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full ml-1">LIVE</span>
            </div>
            <Link href="/market-map">
              <button className="text-blue-400/70 text-xs hover:text-blue-400 flex items-center gap-1">
                Open Map <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>

          {/* System stats row */}
          {intelligenceDashboard?.systemStats && (
            <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.04)] grid grid-cols-4 gap-4">
              {[
                { label: "Total Signals", value: intelligenceDashboard.systemStats.totalSignals, color: "text-blue-400" },
                { label: "Active Companies", value: intelligenceDashboard.systemStats.activeCompanies, color: "text-green-400" },
                { label: "High-Priority Opps", value: intelligenceDashboard.systemStats.highPriorityOpps, color: "text-amber-400" },
                { label: "Avg Confidence", value: `${Math.round(intelligenceDashboard.systemStats.avgConfidence)}%`, color: "text-purple-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-xl font-bold ${color}`} data-testid={`intel-stat-${label.replace(/\s+/g, "-").toLowerCase()}`}>{value}</div>
                  <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[rgba(255,255,255,0.04)]">

            {/* Top Opportunity Zones */}
            <div className="p-5">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" /> Top Opportunity Zones
              </p>
              <div className="space-y-2">
                {(intelligenceDashboard?.topOpportunityZones ?? []).slice(0, 5).map((z, i) => (
                  <div key={i} className="flex items-center justify-between gap-2" data-testid={`intel-zone-${i}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                      <div className="min-w-0">
                        <div className="text-white text-xs font-medium truncate">{z.suburb || z.city}</div>
                        <div className="text-white/30 text-[10px]">{z.city} · {z.activeCompanies} companies</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-amber-400 text-xs font-bold">{Math.round(z.zoneScore)}/100</div>
                      <div className="text-white/20 text-[10px]">{z.recentSignals} signals</div>
                    </div>
                  </div>
                ))}
                {(!intelligenceDashboard?.topOpportunityZones || intelligenceDashboard.topOpportunityZones.length === 0) && (
                  <p className="text-white/20 text-xs">No zone data yet — scanner will populate automatically.</p>
                )}
              </div>
            </div>

            {/* Demand Hotspots */}
            <div className="p-5">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-green-400" /> Demand Hotspots
              </p>
              <div className="space-y-2">
                {(intelligenceDashboard?.demandHotspots ?? []).slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2" data-testid={`intel-demand-${i}`}>
                    <div className="min-w-0">
                      <div className="text-white text-xs font-medium truncate">{d.suburb || d.city}</div>
                      <div className="text-white/30 text-[10px]">{d.city} · {d.activeCompanies} active</div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <Badge className={`text-[9px] px-1.5 py-0 border ${
                        d.demandTier === "hot" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        d.demandTier === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                        "bg-white/5 text-white/40 border-white/10"
                      }`}>{d.demandTier}</Badge>
                      <span className="text-green-400 text-xs font-bold">{Math.round(d.demandScore)}</span>
                    </div>
                  </div>
                ))}
                {(!intelligenceDashboard?.demandHotspots || intelligenceDashboard.demandHotspots.length === 0) && (
                  <p className="text-white/20 text-xs">No demand data yet — demand aggregation will populate this.</p>
                )}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[rgba(255,255,255,0.04)] border-t border-[rgba(255,255,255,0.04)]">

            {/* At-Risk Buildings */}
            <div className="p-5">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> At-Risk Buildings
              </p>
              <div className="space-y-2">
                {(intelligenceDashboard?.atRiskBuildings ?? []).slice(0, 5).map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-2" data-testid={`intel-risk-${i}`}>
                    <div className="min-w-0">
                      <div className="text-white text-xs font-medium truncate">{b.buildingName}</div>
                      <div className="text-white/30 text-[10px]">{b.city} · {Math.round(b.tenantTurnoverRate)}% turnover</div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <Badge className={`text-[9px] px-1.5 py-0 border ${
                        b.riskTier === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        b.riskTier === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                        "bg-white/5 text-white/40 border-white/10"
                      }`}>{b.riskTier}</Badge>
                      <span className="text-red-400 text-xs font-bold">{Math.round(b.vacancyRiskScore)}</span>
                    </div>
                  </div>
                ))}
                {(!intelligenceDashboard?.atRiskBuildings || intelligenceDashboard.atRiskBuildings.length === 0) && (
                  <p className="text-white/20 text-xs">No building risk data yet — risk scanner will populate this.</p>
                )}
              </div>
            </div>

            {/* Relocation-Ready Companies */}
            <div className="p-5">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Relocation-Ready Companies
              </p>
              <div className="space-y-2">
                {(intelligenceDashboard?.relocationReadyCompanies ?? []).slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2" data-testid={`intel-reloc-${i}`}>
                    <div className="min-w-0">
                      <div className="text-white text-xs font-medium truncate">{c.companyName}</div>
                      <div className="text-white/30 text-[10px]">{c.city} · {c.industry || "Unknown"}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-purple-400 text-xs font-bold">{Math.round(c.moveProbability)}% likely</div>
                      <div className="text-white/20 text-[10px]">Conf. {Math.round(c.confidenceScore)}%</div>
                    </div>
                  </div>
                ))}
                {(!intelligenceDashboard?.relocationReadyCompanies || intelligenceDashboard.relocationReadyCompanies.length === 0) && (
                  <p className="text-white/20 text-xs">No relocation data yet — company intelligence sync will populate this.</p>
                )}
              </div>
            </div>

          </div>

          {/* Source health footer */}
          {sourceHealth && sourceHealth.sources.length > 0 && (
            <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.04)] flex flex-wrap gap-3">
              <span className="text-white/30 text-[10px] self-center">Intelligence Sources:</span>
              {sourceHealth.sources.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-1" data-testid={`source-health-${s.id}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${s.isActive && s.errorCount === 0 ? "bg-green-400" : s.isActive ? "bg-amber-400" : "bg-red-500"}`} />
                  <span className="text-white/40 text-[10px]">{s.sourceName}</span>
                </div>
              ))}
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

        {/* ── UPGRADE: Lease Expiry Opportunities Panel ────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,209,100,0.15)] rounded-2xl overflow-hidden" data-testid="panel-lease-expiry">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-semibold text-sm">Lease Expiry Engine</h2>
              <span className="text-[10px] text-amber-400/60 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full ml-1">UPGRADE 1</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="sm"
                className="text-amber-400/60 text-xs hover:text-amber-400 h-7 px-2"
                onClick={() => triggerScanMutation.mutate("lease")}
                disabled={triggerScanMutation.isPending}
                data-testid="btn-trigger-lease-scan"
              >
                {triggeringScan === "lease" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Scan Now
              </Button>
              <Link href="/market-map">
                <button className="text-amber-400/60 text-xs hover:text-amber-400 flex items-center gap-1">Map <ChevronRight className="w-3 h-3" /></button>
              </Link>
            </div>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {(leaseOpps?.opps ?? []).slice(0, 8).map((opp, i) => (
              <div key={opp.id} className="px-5 py-3 flex items-center justify-between gap-3" data-testid={`lease-opp-${i}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${opp.urgencyTier === "critical" ? "bg-red-500" : opp.urgencyTier === "high" ? "bg-orange-400" : "bg-amber-400"}`} />
                  <div className="min-w-0">
                    <div className="text-white text-xs font-medium truncate">{opp.companyName}</div>
                    <div className="text-white/30 text-[10px]">{opp.city} · expiry {opp.predictedExpiryYear ?? "TBC"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge className={`text-[9px] border ${opp.urgencyTier === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20" : opp.urgencyTier === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                    {opp.urgencyTier}
                  </Badge>
                  <span className="text-amber-400 text-xs font-bold">{opp.opportunityScore}/100</span>
                </div>
              </div>
            ))}
            {(!leaseOpps?.opps || leaseOpps.opps.length === 0) && (
              <div className="px-5 py-8 text-center text-white/20 text-xs">No lease expiry opportunities yet — trigger a scan to generate predictions</div>
            )}
          </div>
        </div>

        {/* ── UPGRADE: Intelligence Graph + Company Hierarchy Panel ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Intelligence Graph Stats */}
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-graph-stats">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-400" />
              <h2 className="text-white font-semibold text-sm">Intelligence Graph</h2>
              <span className="text-[10px] text-cyan-400/60 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full ml-1">UPGRADE 5</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[rgba(6,182,212,0.06)] border border-[rgba(6,182,212,0.15)] rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400" data-testid="graph-total-edges">{graphStats?.totalEdges ?? 0}</div>
                  <div className="text-white/40 text-[10px] mt-0.5">Graph Edges</div>
                </div>
                <div className="bg-[rgba(6,182,212,0.06)] border border-[rgba(6,182,212,0.15)] rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400" data-testid="graph-edge-types">{Object.keys(graphStats?.edgesByType ?? {}).length}</div>
                  <div className="text-white/40 text-[10px] mt-0.5">Edge Types</div>
                </div>
              </div>
              {graphStats?.edgesByType && Object.keys(graphStats.edgesByType).length > 0 && (
                <div className="space-y-2">
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Edge Distribution</p>
                  {Object.entries(graphStats.edgesByType).slice(0, 6).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-white/50 text-xs">{type.replace(/_/g, " ")}</span>
                      <span className="text-cyan-400 text-xs font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {graphStats?.topConnectedCompanies && graphStats.topConnectedCompanies.length > 0 && (
                <div className="space-y-1.5 border-t border-[rgba(255,255,255,0.04)] pt-3">
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-2">Top Connected Companies</p>
                  {graphStats.topConnectedCompanies.slice(0, 5).map((co, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-white/60 text-xs truncate">{co.name}</span>
                      <span className="text-cyan-400 text-xs">{co.connections} connections</span>
                    </div>
                  ))}
                </div>
              )}
              {(!graphStats || graphStats.totalEdges === 0) && (
                <div className="text-center text-white/20 text-xs py-4">
                  Graph not yet built — trigger a Graph Refresh scan to build edges
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.04)]">
              <Button
                variant="ghost" size="sm" className="text-cyan-400/60 text-xs hover:text-cyan-400 h-7 px-2"
                onClick={() => triggerScanMutation.mutate("graph")}
                disabled={triggerScanMutation.isPending}
                data-testid="btn-trigger-graph-refresh"
              >
                {triggeringScan === "graph" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Refresh Graph
              </Button>
            </div>
          </div>

          {/* Job Control Dashboard */}
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden" data-testid="panel-job-control">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                <h2 className="text-white font-semibold text-sm">Job Control Dashboard</h2>
                <div className={`w-2 h-2 rounded-full ${jobQueueStats?.initialized ? "bg-green-400" : "bg-red-500"} ml-1`} />
              </div>
              <button
                className="text-white/30 text-[10px] hover:text-white/60"
                onClick={() => refetchJobQueue()}
                data-testid="btn-refresh-jobs"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Manual scan triggers */}
            <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.04)]">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-2">Manual Triggers</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { type: "all", label: "All Scans", color: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10" },
                  { type: "lease", label: "Lease Expiry", color: "text-orange-400 border-orange-500/30 hover:bg-orange-500/10" },
                  { type: "hierarchy", label: "Corp Hierarchy", color: "text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10" },
                  { type: "graph", label: "Graph", color: "text-purple-400 border-purple-500/30 hover:bg-purple-500/10" },
                  { type: "signals", label: "Signals", color: "text-blue-400 border-blue-500/30 hover:bg-blue-500/10" },
                  { type: "demand", label: "Demand", color: "text-green-400 border-green-500/30 hover:bg-green-500/10" },
                ].map(({ type, label, color }) => (
                  <button
                    key={type}
                    className={`text-[10px] border rounded-lg px-2.5 py-1.5 transition-colors ${color} ${triggeringScan === type ? "opacity-50" : ""}`}
                    onClick={() => triggerScanMutation.mutate(type)}
                    disabled={triggerScanMutation.isPending}
                    data-testid={`btn-trigger-${type}`}
                  >
                    {triggeringScan === type ? <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-1" /> : null}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Queue stats */}
            <div className="divide-y divide-[rgba(255,255,255,0.03)]">
              {(jobQueueStats?.queues ?? []).slice(0, 8).map((q) => (
                <div key={q.name} className="px-5 py-2 flex items-center justify-between" data-testid={`queue-stat-${q.name}`}>
                  <span className="text-white/50 text-xs font-mono truncate max-w-[140px]">{q.name}</span>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-blue-400">{q.active} active</span>
                    <span className="text-green-400">{q.completed} done</span>
                    {q.failed > 0 && <span className="text-red-400">{q.failed} fail</span>}
                  </div>
                </div>
              ))}
              {!jobQueueStats?.initialized && (
                <div className="px-5 py-4 text-center text-white/20 text-xs">pg-boss not yet initialized</div>
              )}
            </div>
          </div>
        </div>

        {/* ── UPGRADE: Source Control Panel ────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden" data-testid="panel-source-control">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Intelligence Source Control</h2>
              <span className="text-[10px] text-[hsl(43,78%,52%)]/60 bg-[hsl(43,78%,52%)]/10 border border-[hsl(43,78%,52%)]/20 px-2 py-0.5 rounded-full ml-1">UPGRADE 4</span>
            </div>
            <button
              className="text-white/30 text-[10px] hover:text-white/60"
              onClick={() => refetchSourceHealth()}
              data-testid="btn-refresh-sources"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)]">
                  <th className="px-5 py-2.5 text-left text-white/30 text-[10px] font-semibold uppercase tracking-wider">Source</th>
                  <th className="px-3 py-2.5 text-left text-white/30 text-[10px] font-semibold uppercase tracking-wider">Type</th>
                  <th className="px-3 py-2.5 text-left text-white/30 text-[10px] font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2.5 text-left text-white/30 text-[10px] font-semibold uppercase tracking-wider">Last Run</th>
                  <th className="px-3 py-2.5 text-left text-white/30 text-[10px] font-semibold uppercase tracking-wider">Errors</th>
                  <th className="px-5 py-2.5 text-right text-white/30 text-[10px] font-semibold uppercase tracking-wider">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
                {(sourceHealth?.sources ?? []).map((src) => (
                  <tr key={src.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors" data-testid={`source-row-${src.id}`}>
                    <td className="px-5 py-3">
                      <span className="text-white text-xs font-medium">{src.sourceName}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-white/40 text-xs">{src.sourceType}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${src.isActive && src.errorCount === 0 ? "bg-green-400" : src.isActive ? "bg-amber-400" : "bg-red-500"}`} />
                        <span className={`text-xs ${src.isActive ? "text-green-400" : "text-red-400"}`}>{src.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-white/30 text-xs">{src.lastSuccessfulRun ? new Date(src.lastSuccessfulRun).toLocaleDateString("en-AU", { day: "2-digit", month: "short" }) : "—"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs ${src.errorCount > 0 ? "text-red-400" : "text-white/30"}`}>{src.errorCount}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${src.isActive ? "border-green-500/30 text-green-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30" : "border-white/10 text-white/30 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30"}`}
                        onClick={() => toggleSourceMutation.mutate({ id: src.id, isActive: !src.isActive })}
                        disabled={toggleSourceMutation.isPending}
                        data-testid={`btn-toggle-source-${src.id}`}
                      >
                        {src.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
                {(!sourceHealth?.sources || sourceHealth.sources.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-white/20 text-xs">No intelligence sources configured</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            OUTREACH ENGINE — 4 New Control Panels
            ══════════════════════════════════════════════════════════════════════ */}

        {/* ── Outreach Control Panel ────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-outreach-control">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-sm">Outreach Control</h2>
              {outreachStats?.safeMode && (
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">SAFE MODE</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => generateOutreachMutation.mutate()}
                disabled={generateOutreachMutation.isPending}
                className="text-[10px] bg-[hsl(43,78%,52%)]/10 text-[hsl(43,78%,52%)] border border-[hsl(43,78%,52%)]/20 px-2.5 py-1 rounded-lg hover:bg-[hsl(43,78%,52%)]/20 transition-colors disabled:opacity-40"
                data-testid="btn-generate-outreach"
              >
                {generateOutreachMutation.isPending ? "Generating..." : "Generate Outreach"}
              </button>
              <button
                onClick={() => processFollowUpsMutation.mutate()}
                disabled={processFollowUpsMutation.isPending}
                className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                data-testid="btn-process-followups"
              >
                {processFollowUpsMutation.isPending ? "Processing..." : "Process Follow-ups"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 divide-x divide-[rgba(255,255,255,0.04)]">
            {[
              { label: "Outreach Ready", value: outreachStats?.outreachReadyCount ?? 0, color: "text-amber-400" },
              { label: "Active Threads", value: outreachStats?.activeThreadCount ?? 0, color: "text-blue-400" },
              { label: "Follow-ups Due", value: outreachStats?.followUpsDueCount ?? 0, color: "text-orange-400" },
              { label: "Reply Rate", value: `${outreachStats?.replyRate ?? 0}%`, color: "text-green-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center">
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 divide-x divide-[rgba(255,255,255,0.04)] border-t border-[rgba(255,255,255,0.04)]">
            {[
              { label: "Drafts", value: outreachStats?.drafts ?? 0, color: "text-white/50" },
              { label: "Sent", value: outreachStats?.sent ?? 0, color: "text-blue-300" },
              { label: "Replied", value: outreachStats?.replied ?? 0, color: "text-green-400" },
              { label: "Meetings Booked", value: outreachStats?.bookedThreads ?? 0, color: "text-purple-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center">
                <div className={`text-lg font-semibold ${color}`}>{value}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {/* Active threads list */}
          {outreachThreadsList?.threads && outreachThreadsList.threads.length > 0 && (
            <div className="border-t border-[rgba(255,255,255,0.04)] p-4">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3">Recent Threads</p>
              <div className="space-y-2">
                {outreachThreadsList.threads.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] rounded-lg px-3 py-2">
                    <div>
                      <div className="text-white text-xs font-semibold">{t.companyName}</div>
                      <div className="text-white/30 text-[10px]">{t.outreachAngle?.replace(/_/g, " ") ?? "general"}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        t.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        t.status === "booked" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        t.status === "replied" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        "bg-white/5 text-white/30 border-white/10"
                      }`}>{t.status}</span>
                      <span className="text-[10px] text-white/30">Stage {t.currentStage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Booking Control Panel ─────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-booking-control">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-sm">Booking Control</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                bookingStats?.isSandbox ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"
              }`}>{bookingStats?.isSandbox ? "SANDBOX" : "LIVE"}</span>
              {bookingStats?.provider && (
                <span className="text-[10px] bg-[rgba(255,255,255,0.04)] text-white/40 border border-white/10 px-2 py-0.5 rounded-full uppercase">{bookingStats.provider}</span>
              )}
            </div>
            <a href="/admin/market-map" className="text-[10px] text-[hsl(43,78%,52%)] hover:text-[hsl(43,78%,65%)]">View Map Layer →</a>
          </div>
          <div className="grid grid-cols-4 divide-x divide-[rgba(255,255,255,0.04)]">
            {[
              { label: "Links Created", value: bookingStats?.totalLinks ?? 0, color: "text-white/60" },
              { label: "Clicked", value: bookingStats?.clicked ?? 0, color: "text-amber-400" },
              { label: "Meetings Confirmed", value: bookingStats?.confirmed ?? 0, color: "text-green-400" },
              { label: "Conversion Rate", value: `${bookingStats?.conversionRate ?? 0}%`, color: "text-purple-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center">
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {bookingStats?.recentMeetings && bookingStats.recentMeetings.length > 0 && (
            <div className="border-t border-[rgba(255,255,255,0.04)] p-4">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3">Recent Meetings</p>
              <div className="space-y-2">
                {bookingStats.recentMeetings.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] rounded-lg px-3 py-2">
                    <div className="text-white text-xs font-semibold">{m.companyName}</div>
                    <div className="text-white/30 text-[10px]">{m.meetingTime ? new Date(m.meetingTime).toLocaleDateString() : "Pending"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!bookingStats?.recentMeetings || bookingStats.recentMeetings.length === 0) && (
            <div className="p-6 text-center text-white/20 text-xs">No confirmed meetings yet — booking links active</div>
          )}
        </div>

        {/* ── Contact Discovery Panel ───────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-contact-discovery">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-white font-semibold text-sm">Contact Discovery</h2>
            <button
              onClick={() => runContactDiscoveryMutation.mutate()}
              disabled={runContactDiscoveryMutation.isPending}
              className="text-[10px] bg-[hsl(43,78%,52%)]/10 text-[hsl(43,78%,52%)] border border-[hsl(43,78%,52%)]/20 px-2.5 py-1 rounded-lg hover:bg-[hsl(43,78%,52%)]/20 transition-colors disabled:opacity-40"
              data-testid="btn-run-contact-discovery"
            >
              {runContactDiscoveryMutation.isPending ? "Discovering..." : "Run Discovery"}
            </button>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.04)]">
            {[
              { label: "Discovery Runs", value: contactDiscoveryStats?.totalRuns ?? 0, color: "text-white/60" },
              { label: "Contacts Found", value: contactDiscoveryStats?.totalContacts ?? 0, color: "text-green-400" },
              { label: "Fallback Contacts", value: contactDiscoveryStats?.fallbackContacts ?? 0, color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center">
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.04)] border-t border-[rgba(255,255,255,0.04)]">
            {[
              { label: "Direct Contacts", value: contactDiscoveryStats?.directContacts ?? 0, color: "text-blue-400" },
              { label: "High Confidence", value: contactDiscoveryStats?.highConfidenceContacts ?? 0, color: "text-green-400" },
              { label: "Avg / Run", value: contactDiscoveryStats?.avgContactsPerRun ?? 0, color: "text-white/50" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center">
                <div className={`text-lg font-semibold ${color}`}>{value}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-[rgba(255,255,255,0.02)] border-t border-[rgba(255,255,255,0.04)]">
            <p className="text-white/20 text-[10px]">Discovery targets: Head of Workplace · Facilities Manager · Operations Director · Office Manager · People & Culture · Procurement</p>
          </div>
        </div>

        {/* ── Sequence Control Panel ────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-sequence-control">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-white font-semibold text-sm">Sequence Control</h2>
            <div className="text-white/30 text-[10px]">Day 0 → 3 → 7 → 14</div>
          </div>
          <div className="p-4">
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3">Active Sequences</p>
            {outreachThreadsList?.threads && outreachThreadsList.threads.filter(t => t.status === "active").length > 0 ? (
              <div className="space-y-2">
                {outreachThreadsList.threads.filter(t => t.status === "active").slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] rounded-lg px-3 py-2">
                    <div>
                      <div className="text-white text-xs font-semibold">{t.companyName}</div>
                      <div className="text-white/30 text-[10px]">Stage {t.currentStage} · {t.outreachAngle?.replace(/_/g, " ") ?? "standard"}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => fetch("/api/outreach/pause", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: t.id }) }).then(() => refetchOutreach())}
                        className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded hover:bg-amber-500/20 transition-colors"
                        data-testid={`btn-pause-thread-${t.id}`}
                      >Pause</button>
                      <button
                        onClick={() => fetch("/api/outreach/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: t.id }) }).then(() => refetchOutreach())}
                        className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded hover:bg-red-500/20 transition-colors"
                        data-testid={`btn-stop-thread-${t.id}`}
                      >Stop</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-white/20 text-xs">No active sequences — generate outreach to begin</div>
            )}
          </div>
          <div className="border-t border-[rgba(255,255,255,0.04)] px-5 py-3 bg-[rgba(255,255,255,0.02)]">
            <p className="text-white/20 text-[10px]">Sequences auto-stop on reply, booking, or manual override. SAFE MODE = drafts only.</p>
          </div>
        </div>

        {/* ── Stripe Status Panel ──────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-stripe-status">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Stripe Status</h2>
            </div>
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${revenueStats?.safeMode ? "bg-amber-500/20 text-amber-400" : revenueStats?.testMode ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
              {revenueStats?.safeMode ? "SAFE MODE" : revenueStats?.testMode ? "TEST MODE" : "LIVE"}
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Stripe API</p>
              <div className="flex items-center gap-1.5">
                {revenueStats?.stripeEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                <span className="text-white text-xs font-semibold">{revenueStats?.stripeEnabled ? "Configured" : "Not Configured"}</span>
              </div>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Webhook Health</p>
              <div className="flex items-center gap-1.5">
                {revenueStats?.webhookHealthy ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                <span className="text-white text-xs font-semibold">{revenueStats?.webhookHealthy ? "Healthy" : "No recent events"}</span>
              </div>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Webhooks Processed</p>
              <p className="text-white text-lg font-bold">{revenueWebhooks?.processed ?? 0}</p>
              <p className="text-white/30 text-[10px]">of {revenueWebhooks?.total ?? 0} received</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Last Webhook</p>
              <p className="text-white text-xs font-semibold">{revenueStats?.lastWebhookAt ? new Date(revenueStats.lastWebhookAt).toLocaleDateString() : "Never"}</p>
            </div>
          </div>
          <div className="px-5 py-3 bg-[rgba(255,255,255,0.02)] border-t border-[rgba(255,255,255,0.04)]">
            <p className="text-white/20 text-[10px]">Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET to enable live payments. SAFE_MODE=false for production.</p>
          </div>
        </div>

        {/* ── Payment Operations Panel ─────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-payment-operations">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Payment Operations</h2>
            </div>
            <button onClick={() => refetchRevenue()} className="text-white/30 hover:text-white/60 transition-colors" data-testid="btn-refresh-revenue">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Links Created</p>
              <p className="text-white text-2xl font-bold">{revenuePayments?.total ?? 0}</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Awaiting Payment</p>
              <p className="text-amber-400 text-2xl font-bold">{revenueStats?.quotesAwaitingPayment ?? 0}</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Deposits Received</p>
              <p className="text-green-400 text-2xl font-bold">{revenueStats?.depositsReceived ?? 0}</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Full Payments</p>
              <p className="text-green-400 text-2xl font-bold">{revenueStats?.fullPaymentsReceived ?? 0}</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Expired Links</p>
              <p className="text-red-400 text-2xl font-bold">{revenueStats?.expiredLinks ?? 0}</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Outstanding ($)</p>
              <p className="text-amber-400 text-lg font-bold">${((revenueStats?.outstandingInvoices ?? 0) / 100).toLocaleString()}</p>
            </div>
          </div>
          <div className="px-5 py-3 bg-[rgba(255,255,255,0.02)] border-t border-[rgba(255,255,255,0.04)]">
            <p className="text-white/20 text-[10px]">Payment links are created from Quote Builder. Stripe webhooks update deal stages automatically.</p>
          </div>
        </div>

        {/* ── Revenue Monitoring Panel ─────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-revenue-monitoring">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Revenue Monitoring</h2>
            </div>
            <span className="text-white/30 text-[10px]">AUD (cents)</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Revenue Today</p>
              <p className="text-green-400 text-xl font-bold">${((revenueStats?.revenueToday ?? 0) / 100).toLocaleString()}</p>
            </div>
            <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Revenue This Week</p>
              <p className="text-green-400 text-xl font-bold">${((revenueStats?.revenueThisWeek ?? 0) / 100).toLocaleString()}</p>
            </div>
          </div>
          {revenuePayments?.payments && revenuePayments.payments.length > 0 ? (
            <div className="px-4 pb-4">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-2">Recent Payment Links</p>
              <div className="space-y-1.5">
                {revenuePayments.payments.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] rounded-lg px-3 py-2">
                    <div>
                      <div className="text-white text-xs font-semibold">${((p.amount || 0) / 100).toLocaleString()} {(p.currency || "aud").toUpperCase()}</div>
                      <div className="text-white/30 text-[10px]">{p.linkType || "full"} · {p.isTestMode ? "TEST" : "LIVE"}</div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-white/20 text-xs px-4 pb-4">No payment links yet — create one from Quote Builder</div>
          )}
          <div className="px-5 py-3 bg-[rgba(255,255,255,0.02)] border-t border-[rgba(255,255,255,0.04)]">
            <p className="text-white/20 text-[10px]">Revenue tracked via Stripe webhooks. Amounts in AUD cents. Test mode revenue excluded from live totals.</p>
          </div>
        </div>

        {/* ── Payment Controls Panel ───────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.15)] rounded-2xl overflow-hidden" data-testid="panel-payment-controls">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Payment Controls</h2>
            </div>
            <div className={`text-[10px] px-2 py-0.5 rounded-full ${revenueStats?.safeMode ? "bg-amber-500/20 text-amber-300" : "bg-green-500/10 text-green-400"}`}>
              {revenueStats?.safeMode ? "SAFE MODE — test actions only" : "Live mode active"}
            </div>
          </div>
          <div className="p-4 space-y-3">
            <button
              onClick={() => {
                const quoteId = prompt("Quote ID to simulate payment for:");
                const amount = prompt("Amount in cents (e.g. 500000 = $5,000):");
                if (quoteId && amount) {
                  fetch("/api/payments/simulate-webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "payment_intent.succeeded", quoteId, amount: parseInt(amount) }) })
                    .then(r => r.json()).then(d => { alert(d.message || "Webhook simulated"); refetchRevenue(); });
                }
              }}
              className="w-full text-left flex items-center gap-3 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 transition-colors"
              data-testid="btn-simulate-payment-webhook"
            >
              <Webhook className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-white text-xs font-semibold">Simulate Payment Webhook</p>
                <p className="text-white/30 text-[10px]">Test payment flow without Stripe</p>
              </div>
            </button>
            <button
              onClick={() => {
                const quoteId = prompt("Quote ID to reconcile:");
                const amount = prompt("Amount paid in cents:");
                if (quoteId && amount) {
                  fetch("/api/payments/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId, amount: parseInt(amount) }) })
                    .then(r => r.json()).then(d => { alert(d.message || "Reconciled"); refetchRevenue(); });
                }
              }}
              className="w-full text-left flex items-center gap-3 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 transition-colors"
              data-testid="btn-reconcile-payment"
            >
              <Receipt className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-white text-xs font-semibold">Reconcile Payment Manually</p>
                <p className="text-white/30 text-[10px]">Mark quote as paid — admin only</p>
              </div>
            </button>
            <button
              onClick={() => refetchRevenue()}
              className="w-full text-left flex items-center gap-3 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 transition-colors"
              data-testid="btn-refresh-revenue-stats"
            >
              <BarChart3 className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-white text-xs font-semibold">Refresh Revenue Stats</p>
                <p className="text-white/30 text-[10px]">Sync latest payment data from Stripe</p>
              </div>
            </button>
          </div>
          <div className="px-5 py-3 bg-[rgba(255,255,255,0.02)] border-t border-[rgba(255,255,255,0.04)]">
            <p className="text-white/20 text-[10px]">All payment actions are audit logged. SAFE MODE limits to test-mode operations only.</p>
          </div>
        </div>

        {/* ── Deal Closing System ───────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,220,150,0.18)] rounded-2xl overflow-hidden" data-testid="panel-deal-closing">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Deal Closing System</h2>
            </div>
            <button onClick={() => refetchDealClosing()} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[rgba(255,255,255,0.04)]">
            {[
              { label: "Proposals Sent", value: dealClosingStats?.proposals?.sent ?? "—", sub: `${dealClosingStats?.proposals?.viewed ?? 0} viewed`, color: "text-blue-400" },
              { label: "In Negotiation", value: dealClosingStats?.negotiation ?? "—", sub: "Active deals", color: "text-amber-400" },
              { label: "Awaiting Approval", value: dealClosingStats?.approvals?.pending ?? "—", sub: "Need sign-off", color: "text-orange-400" },
              { label: "Closing This Week", value: dealClosingStats?.closingThisWeek ?? "—", sub: "Approved + negotiation", color: "text-green-400" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-[hsl(220,18%,10%)] p-4">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <div className="p-4 space-y-2">
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Pipeline Stages</p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {["lead","qualified","meeting_booked","proposal_sent","negotiation","approved","won","lost"].map(stage => (
                <div key={stage} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-lg p-2 text-center">
                  <p className="text-white/60 text-[9px] capitalize">{stage.replace("_"," ")}</p>
                  <p className="text-white text-sm font-bold mt-0.5">{dealClosingStats?.pipeline?.[stage] ?? 0}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <Link href="/admin/proposal-engine">
              <button className="flex-1 flex items-center justify-center gap-2 bg-[rgba(100,220,150,0.08)] hover:bg-[rgba(100,220,150,0.14)] border border-[rgba(100,220,150,0.2)] rounded-xl px-4 py-2.5 text-green-400 text-xs font-semibold transition-colors" data-testid="btn-open-proposal-engine">
                <FileText className="w-3.5 h-3.5" /> Proposal Engine
              </button>
            </Link>
            <button
              onClick={() => { const id = prompt("Quote ID to generate proposal for:"); if(id) fetch("/api/proposals/generate", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quoteId:id})}).then(r=>r.json()).then(d=>{ alert(d.error || `Proposal generated: ${d.proposal?.id}`); refetchDealClosing(); }); }}
              className="flex-1 flex items-center justify-center gap-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-2.5 text-white/60 text-xs font-semibold transition-colors"
              data-testid="btn-generate-proposal"
            >
              <Zap className="w-3.5 h-3.5" /> Quick Generate
            </button>
          </div>
        </div>

        {/* ── Partner Commissions ───────────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl overflow-hidden" data-testid="panel-partner-commissions">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Partner Commissions</h2>
            </div>
            <button onClick={() => refetchCommissions()} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[rgba(255,255,255,0.04)]">
            {[
              { label: "Pending", value: commissionStats?.pending ?? "—", sub: "Awaiting approval", color: "text-amber-400" },
              { label: "Approved", value: commissionStats?.approved ?? "—", sub: "Ready to pay", color: "text-blue-400" },
              { label: "Paid", value: commissionStats?.paid ?? "—", sub: "Completed", color: "text-green-400" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-[hsl(220,18%,10%)] p-4">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-px bg-[rgba(255,255,255,0.04)] mt-px">
            <div className="bg-[hsl(220,18%,10%)] p-4">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Payable</p>
              <p className="text-2xl font-bold text-amber-300">${(commissionStats?.totalPayableAud ?? 0).toLocaleString("en-AU", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              <p className="text-white/30 text-[10px] mt-0.5">Pending + approved AUD</p>
            </div>
            <div className="bg-[hsl(220,18%,10%)] p-4">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-green-400">${(commissionStats?.totalPaidAud ?? 0).toLocaleString("en-AU", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              <p className="text-white/30 text-[10px] mt-0.5">Completed commissions AUD</p>
            </div>
          </div>
          <div className="p-4 flex gap-2">
            <button
              onClick={() => {
                const id = prompt("Commission ID to approve:");
                if(id) fetch(`/api/commissions/${id}/approve`, {method:"POST"}).then(r=>r.json()).then(d=>{ alert(d.error || "Commission approved"); refetchCommissions(); });
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[rgba(100,200,120,0.08)] hover:bg-[rgba(100,200,120,0.14)] border border-[rgba(100,200,120,0.2)] rounded-xl px-4 py-2.5 text-green-400 text-xs font-semibold transition-colors"
              data-testid="btn-approve-commission"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => {
                const id = prompt("Commission ID to mark paid:");
                const ref = prompt("Invoice reference (optional):");
                if(id) fetch(`/api/commissions/${id}/mark-paid`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({invoiceRef:ref})}).then(r=>r.json()).then(d=>{ alert(d.error || "Commission marked paid"); refetchCommissions(); });
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-2.5 text-white/60 text-xs font-semibold transition-colors"
              data-testid="btn-mark-commission-paid"
            >
              <DollarSign className="w-3.5 h-3.5" /> Mark Paid
            </button>
          </div>
          <Link href="/admin/partner-network">
            <div className="mx-4 mb-4 flex items-center justify-between bg-[rgba(201,168,76,0.06)] hover:bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.15)] rounded-xl px-4 py-2.5 cursor-pointer transition-colors">
              <span className="text-[hsl(43,78%,52%)] text-xs font-semibold">Partner Network Console</span>
              <ArrowRight className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
            </div>
          </Link>
        </div>

        {/* ── Building + Tenant Database ────────────────────────────────────── */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(180,100,255,0.18)] rounded-2xl overflow-hidden" data-testid="panel-building-database">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h2 className="text-white font-semibold text-sm">Building + Tenant Database</h2>
            </div>
            <button onClick={() => refetchBuildings()} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-[rgba(255,255,255,0.04)]">
            {[
              { label: "Buildings", value: buildingStats?.totalBuildings ?? "—", sub: `${buildingStats?.cities ?? 0} cities`, color: "text-purple-400" },
              { label: "Tenants", value: buildingStats?.totalTenants ?? "—", sub: "Tracked occupants", color: "text-blue-400" },
              { label: "Active Leases", value: buildingStats?.activeLeases ?? "—", sub: "In database", color: "text-green-400" },
              { label: "Expiring ≤12m", value: buildingStats?.expiringIn12Months ?? "—", sub: "Opportunity window", color: "text-amber-400" },
              { label: "Cities", value: buildingStats?.cities ?? "—", sub: "AU metro coverage", color: "text-cyan-400" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-[hsl(220,18%,10%)] p-4">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            <button
              onClick={() => fetch("/api/admin/buildings/seed", {method:"POST"}).then(r=>r.json()).then(d=>{ alert(`Seeded: ${d.inserted} buildings, ${d.skipped} skipped`); refetchBuildings(); })}
              className="flex items-center gap-2 bg-[rgba(180,100,255,0.08)] hover:bg-[rgba(180,100,255,0.14)] border border-[rgba(180,100,255,0.2)] rounded-xl px-4 py-2.5 text-purple-400 text-xs font-semibold transition-colors"
              data-testid="btn-seed-buildings"
            >
              <Layers className="w-3.5 h-3.5" /> Seed AU Buildings
            </button>
            <Link href="/admin/building-database">
              <button className="flex items-center gap-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-2.5 text-white/60 text-xs font-semibold transition-colors" data-testid="btn-open-building-database">
                <Eye className="w-3.5 h-3.5" /> Building Database
              </button>
            </Link>
            <Link href="/admin/market-map">
              <button className="flex items-center gap-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-2.5 text-white/60 text-xs font-semibold transition-colors" data-testid="btn-open-buildings-map">
                <MapPin className="w-3.5 h-3.5" /> View on Map
              </button>
            </Link>
          </div>
          <div className="px-5 py-3 bg-[rgba(255,255,255,0.02)] border-t border-[rgba(255,255,255,0.04)]">
            <p className="text-white/20 text-[10px]">Proprietary building intelligence — feeds lease expiry engine, relocation scoring, and demand forecasting.</p>
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
              { href: "/admin/market-map", icon: MapPin, label: "Workspace Intelligence Map", sub: "Signals, demand, risk layers" },
              { href: "/admin/proposal-engine", icon: FileText, label: "Proposal Engine", sub: `${dealClosingStats?.proposals?.total ?? 0} proposals` },
              { href: "/admin/building-database", icon: Building2, label: "Building Database", sub: `${buildingStats?.totalBuildings ?? 0} buildings tracked` },
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
