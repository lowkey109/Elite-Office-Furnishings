import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PlanningReport from "@/components/PlanningReport";
import { CATALOGUE } from "@/lib/furnitureCatalogue";
import {
  ShieldCheck, LayoutDashboard, Target, Megaphone, Upload,
  ChevronDown, ChevronRight, Building2, MapPin, Mail, Phone,
  Loader2, Trash2, RefreshCw, Package, FileText, Palette,
  Star, DollarSign, Users, Layers, CheckCircle2, Calendar,
  ExternalLink, Paperclip, TrendingUp, Briefcase, BarChart3,
  Zap, Clock, Table2,
} from "lucide-react";

const ADMIN_PASSWORD = "tcd2024admin";

type PlanningStatus = "New" | "In Review" | "Quoted" | "Converted" | "Archived";
type ActiveTab = "overview" | "zones" | "furniture" | "cost" | "report";

const STATUS_CONFIG: Record<PlanningStatus, { color: string }> = {
  New: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "In Review": { color: "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]" },
  Quoted: { color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  Converted: { color: "bg-green-500/10 text-green-400 border-green-500/20" },
  Archived: { color: "bg-white/5 text-white/30 border-white/10" },
};

interface UploadedFile {
  field: string;
  originalName: string;
  filename: string;
  url: string;
  size: number;
}

interface WorkspaceZone {
  zone: string;
  color: string;
  percentage: number;
  description: string;
  priority: string;
  staffCapacity?: number;
  keyFurniture?: string[];
}

interface ProductRec {
  zone: string;
  sku: string;
  category: string;
  productName: string;
  seriesRecommendation: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  rationale: string;
}

interface CostBreakdown {
  furniture: number;
  installation: number;
  delivery: number;
  total: number;
  perStaff?: number;
}

interface LeadScoreBreakdown {
  companySize?: number;
  projectValue?: number;
  expansionSignals?: number;
  budgetClarity?: number;
  zonesRequired?: number;
  reasoning?: string;
}

interface AiRec {
  clientBrief?: string;
  officeType?: string;
  estimatedProjectValue?: string;
  leadScore?: number;
  leadScoreBreakdown?: LeadScoreBreakdown;
  implementationTimeline?: string;
  workspaceZones?: WorkspaceZone[];
  productRecommendations?: ProductRec[];
  costBreakdown?: CostBreakdown;
  styleDirection?: string;
  keyConsiderations?: string[];
  recommendedNextStep?: string;
  urgencyNote?: string;
}

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
  uploadedFilesJson?: string;
  aiSummary?: string;
  aiRecommendations?: string;
  leadScore?: number;
  estimatedValue?: string;
  implementationTimeline?: string;
  status: string;
  adminNotes?: string;
  createdAt?: string;
}

function fmt(n?: number) {
  if (!n) return "—";
  return "$" + n.toLocaleString("en-AU");
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isToday(d?: string) {
  if (!d) return false;
  const now = new Date();
  const date = new Date(d);
  return date.toDateString() === now.toDateString();
}

function isThisWeek(d?: string) {
  if (!d) return false;
  const date = new Date(d);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
}

function LeadScoreBadge({ score }: { score?: number }) {
  if (score == null) return null;
  const color = score >= 70
    ? "bg-green-500/15 text-green-400 border-green-500/30"
    : score >= 40
    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 font-bold ${color}`} data-testid={`badge-lead-score`}>
      <TrendingUp className="w-3 h-3" />{score}
    </span>
  );
}

function ZoneVisualization({ zones }: { zones: WorkspaceZone[] }) {
  if (!zones.length) return <p className="text-white/30 text-sm">No zone data available. Regenerate the AI plan.</p>;

  const hasPercentages = zones.some(z => z.percentage);

  return (
    <div className="space-y-4">
      {hasPercentages && (
        <div>
          <p className="text-white/40 text-xs mb-2">Space Allocation</p>
          <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
            {zones.filter(z => z.percentage > 0).map((z, i) => (
              <div
                key={i}
                style={{ width: `${z.percentage}%`, backgroundColor: z.color || "#B8960C" }}
                className="flex items-center justify-center overflow-hidden transition-all"
                title={`${z.zone}: ${z.percentage}%`}
                data-testid={`zone-bar-${i}`}
              >
                {z.percentage >= 12 && (
                  <span className="text-white text-xs font-bold drop-shadow px-1 truncate">{z.percentage}%</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {zones.map((z, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: z.color || "#B8960C" }} />
                <span className="text-white/50 text-xs">{z.zone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        {zones.map((z, i) => (
          <div
            key={i}
            data-testid={`zone-card-${i}`}
            className="rounded-xl p-4 border"
            style={{ borderColor: `${z.color || "#B8960C"}40`, background: `${z.color || "#B8960C"}08` }}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: z.color || "#B8960C" }} />
                  <span className="text-white font-semibold text-sm">{z.zone}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${z.priority === "Essential" ? "bg-green-500/10 text-green-400 border-green-500/20" : z.priority === "Recommended" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-white/40 border-white/10"}`}>
                    {z.priority}
                  </span>
                  {z.percentage > 0 && <span className="text-white/30 text-xs">{z.percentage}% of floor</span>}
                  {z.staffCapacity && <span className="text-white/30 text-xs">{z.staffCapacity} staff</span>}
                </div>
              </div>
            </div>
            <p className="text-white/55 text-xs leading-relaxed mb-2">{z.description}</p>
            {z.keyFurniture && z.keyFurniture.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {z.keyFurniture.map((f, j) => (
                  <span key={j} className="text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.12)] text-white/40 px-2 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FurnitureRecsPanel({ recs }: { recs: ProductRec[] }) {
  if (!recs.length) return <p className="text-white/30 text-sm">No furniture recommendations available. Regenerate the AI plan.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="table-furniture-recs">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <th className="text-left text-white/40 font-medium py-2 pr-3">SKU</th>
              <th className="text-left text-white/40 font-medium py-2 pr-3">Product</th>
              <th className="text-left text-white/40 font-medium py-2 pr-3">Zone</th>
              <th className="text-right text-white/40 font-medium py-2 pr-3">Qty</th>
              <th className="text-right text-white/40 font-medium py-2 pr-3">Unit</th>
              <th className="text-right text-white/40 font-medium py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((p, i) => {
              const catalogueItem = CATALOGUE.find(c => c.sku === p.sku);
              return (
                <tr key={i} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]" data-testid={`row-furniture-${i}`}>
                  <td className="py-2.5 pr-3 text-[hsl(43,78%,52%)] font-mono">{p.sku}</td>
                  <td className="py-2.5 pr-3">
                    <p className="text-white font-medium">{catalogueItem?.name || p.productName || p.category}</p>
                    {p.seriesRecommendation && <p className="text-white/30 text-xs">{p.seriesRecommendation}</p>}
                    {p.rationale && <p className="text-white/40 text-xs mt-0.5 max-w-xs">{p.rationale}</p>}
                  </td>
                  <td className="py-2.5 pr-3 text-white/50">{p.zone}</td>
                  <td className="py-2.5 pr-3 text-right text-white">{p.quantity}</td>
                  <td className="py-2.5 pr-3 text-right text-white/60">{p.unitCost ? fmt(p.unitCost) : catalogueItem?.priceLabel || "POA"}</td>
                  <td className="py-2.5 text-right text-[hsl(43,78%,65%)] font-semibold">{p.totalCost ? fmt(p.totalCost) : "POA"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-white/25 text-xs pt-1">Prices are indicative estimates. Final pricing subject to specification and supplier confirmation.</p>
    </div>
  );
}

function CostTimeline({ cost, timeline, aiRec, leadScore, request }: { cost?: CostBreakdown; timeline?: string; aiRec?: AiRec | null; leadScore?: number; request: PlanningRequest }) {
  const score = leadScore ?? aiRec?.leadScore;
  const breakdown = aiRec?.leadScoreBreakdown;
  const scoreColor = !score ? "text-white/40" : score >= 70 ? "text-green-400" : score >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-5">
      {cost && (
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Cost Breakdown
          </p>
          <div className="bg-[rgba(255,255,255,0.02)] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.05)]" data-testid="table-cost-breakdown">
            {[
              { label: "Furniture Supply", value: cost.furniture },
              { label: "Installation & Labour", value: cost.installation },
              { label: "Delivery & Logistics", value: cost.delivery },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
                <span className="text-white/55 text-sm">{row.label}</span>
                <span className="text-white text-sm font-medium">{fmt(row.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-[rgba(201,168,76,0.06)]">
              <span className="text-white font-bold text-sm">Total Estimate (inc. GST)</span>
              <span className="text-[hsl(43,78%,65%)] font-bold text-base">{fmt(cost.total)}</span>
            </div>
            {cost.perStaff && (
              <div className="flex items-center justify-between px-4 py-2 bg-[rgba(255,255,255,0.01)]">
                <span className="text-white/30 text-xs">Per-staff cost</span>
                <span className="text-white/50 text-xs">{fmt(cost.perStaff)}/person</span>
              </div>
            )}
          </div>
          <p className="text-white/20 text-xs mt-2">Preliminary estimate only — final pricing subject to detailed specification.</p>
        </div>
      )}

      {timeline && (
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Implementation Timeline
          </p>
          <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-4 flex items-center gap-3" data-testid="text-timeline">
            <div className="w-10 h-10 rounded-xl bg-[rgba(201,168,76,0.1)] flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-[hsl(43,78%,52%)]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">{timeline}</p>
              <p className="text-white/40 text-xs">Estimated from brief submission to fit-out completion</p>
            </div>
          </div>
        </div>
      )}

      {score != null && (
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Lead Qualification Score
          </p>
          <div className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]" data-testid="section-lead-score">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-5xl font-serif font-bold">
                <span className={scoreColor}>{score}</span>
                <span className="text-white/20 text-2xl">/100</span>
              </div>
              <div>
                <p className={`font-bold text-lg ${scoreColor}`}>
                  {score >= 70 ? "High Priority" : score >= 40 ? "Medium Priority" : "Low Priority"}
                </p>
                <p className="text-white/40 text-xs">{score >= 70 ? "Fast-track this lead" : score >= 40 ? "Nurture and qualify further" : "Requires more information"}</p>
              </div>
            </div>
            <div className="w-full bg-[rgba(255,255,255,0.05)] rounded-full h-2 mb-3">
              <div className={`h-2 rounded-full transition-all ${score >= 70 ? "bg-green-400" : score >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${score}%` }} />
            </div>
            {breakdown && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {[
                  { label: "Company Size", value: breakdown.companySize, max: 30 },
                  { label: "Project Value", value: breakdown.projectValue, max: 25 },
                  { label: "Expansion Signals", value: breakdown.expansionSignals, max: 20 },
                  { label: "Budget Clarity", value: breakdown.budgetClarity, max: 15 },
                  { label: "Zones Required", value: breakdown.zonesRequired, max: 10 },
                ].filter(s => s.value != null).map(s => (
                  <div key={s.label} className="bg-[rgba(255,255,255,0.02)] rounded-lg p-2.5">
                    <p className="text-white/40 text-xs mb-1">{s.label}</p>
                    <p className="text-white font-bold text-sm">{s.value}<span className="text-white/25 font-normal">/{s.max}</span></p>
                  </div>
                ))}
              </div>
            )}
            {breakdown?.reasoning && <p className="text-white/40 text-xs mt-3 italic">{breakdown.reasoning}</p>}
          </div>
        </div>
      )}

      {aiRec?.keyConsiderations && aiRec.keyConsiderations.length > 0 && (
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Key Considerations
          </p>
          <div className="space-y-1.5">
            {aiRec.keyConsiderations.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-white/55">
                <span className="text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0">•</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPlanningRequests() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTabs, setActiveTabs] = useState<Record<string, ActiveTab>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Planning Requests — Workspace Planner | The Corporate Desk";
    if (sessionStorage.getItem("tcd_admin_auth") === "true") setAuthed(true);
  }, []);

  const { data: requests = [], isLoading } = useQuery<PlanningRequest[]>({
    queryKey: ["/api/admin/planning-requests"],
    enabled: authed,
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/planning-requests/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/planning-requests"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/planning-requests/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/planning-requests"] });
      toast({ title: "Planning request deleted" });
    },
  });

  async function saveNotes(id: string) {
    setSavingNotes(id);
    try {
      await apiRequest("PATCH", `/api/admin/planning-requests/${id}`, { adminNotes: adminNotes[id] || "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/planning-requests"] });
      toast({ title: "Notes saved" });
    } catch {
      toast({ title: "Failed to save notes", variant: "destructive" });
    } finally {
      setSavingNotes(null);
    }
  }

  async function revisePlan(id: string) {
    setRevisingId(id);
    try {
      const res = await apiRequest("POST", `/api/admin/planning-requests/${id}/revise`, {
        adminNotes: adminNotes[id] || "",
      });
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/planning-requests"] });
        toast({ title: "AI plan regenerated successfully" });
      }
    } catch {
      toast({ title: "Failed to regenerate plan", variant: "destructive" });
    } finally {
      setRevisingId(null);
    }
  }

  function handleLogin() {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  function getTab(id: string): ActiveTab {
    return activeTabs[id] || "overview";
  }

  function setTab(id: string, tab: ActiveTab) {
    setActiveTabs(prev => ({ ...prev, [id]: tab }));
  }

  const filtered = requests.filter(r => filterStatus === "All" || r.status === filterStatus);
  const totalCount = requests.length;
  const newCount = requests.filter(r => r.status === "New").length;
  const todayCount = requests.filter(r => isToday(r.createdAt)).length;
  const weekCount = requests.filter(r => isThisWeek(r.createdAt)).length;

  const scoredRequests = requests.filter(r => r.leadScore != null);
  const avgLeadScore = scoredRequests.length > 0
    ? Math.round(scoredRequests.reduce((s, r) => s + (r.leadScore ?? 0), 0) / scoredRequests.length)
    : null;

  const highPriorityCount = requests.filter(r => (r.leadScore ?? 0) >= 70).length;

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-4">
              <span className="text-2xl font-serif font-bold text-white">THE CORPORATE</span>
              <span className="text-sm font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
            </div>
            <h1 className="text-xl font-semibold text-white">Planning Requests</h1>
            <p className="text-white/40 text-sm mt-1">Authorised access only</p>
          </div>
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-6">
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin password"
              data-testid="input-planning-password"
              className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-1 ${pwError ? "border-red-500/50" : "border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)]"}`}
              style={{ minHeight: "48px" }}
            />
            {pwError && <p className="text-red-400 text-xs mb-3">Incorrect password</p>}
            <Button onClick={handleLogin} className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] mt-3" data-testid="button-planning-login">
              <ShieldCheck className="w-4 h-4 mr-2" /> Access Planning Requests
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { key: "zones", label: "Workspace Zones", icon: <Layers className="w-3.5 h-3.5" /> },
    { key: "furniture", label: "Furniture Recs", icon: <Package className="w-3.5 h-3.5" /> },
    { key: "cost", label: "Cost & Timeline", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: "report", label: "Report", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">
      <header className="bg-[hsl(220,18%,8%)] border-b border-[rgba(201,168,76,0.1)] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="flex flex-col cursor-pointer">
                <span className="text-base font-serif font-bold text-white leading-tight">THE CORPORATE</span>
                <span className="text-xs font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
              </div>
            </Link>
            <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <span className="text-white/60 text-sm font-medium">Workspace Planning</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild size="sm" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[40px]" data-testid="button-planning-dashboard">
              <Link href="/admin/dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-white/50 hover:text-white min-h-[40px]" data-testid="button-planning-leads">
              <Link href="/admin/leads"><Target className="w-4 h-4 mr-1.5" /> Lead Intelligence</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-white/50 hover:text-white min-h-[40px]" data-testid="button-planning-marketing">
              <Link href="/admin/marketing"><Megaphone className="w-4 h-4 mr-1.5" /> Marketing</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-white mb-1 flex items-center gap-3">
            <Upload className="w-6 h-6 text-[hsl(43,78%,52%)]" />
            AI Workspace Planning Intelligence
          </h1>
          <p className="text-white/40 text-sm">AI-analysed office fit-out planning submissions with zone layouts, furniture recommendations, cost estimates and lead scores.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Total Requests", value: totalCount, color: "text-[hsl(43,78%,65%)]", testId: "total-requests" },
            { label: "New", value: newCount, color: "text-blue-400", testId: "new-unreviewed" },
            { label: "Today", value: todayCount, color: "text-green-400", testId: "today" },
            { label: "This Week", value: weekCount, color: "text-purple-400", testId: "this-week" },
            { label: "Avg Lead Score", value: avgLeadScore != null ? `${avgLeadScore}/100` : "—", color: "text-amber-400", testId: "avg-lead-score" },
            { label: "High Priority", value: highPriorityCount, color: "text-[hsl(43,78%,65%)]", testId: "high-priority" },
          ].map(stat => (
            <div key={stat.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
              <p className="text-white/50 text-xs mb-1.5">{stat.label}</p>
              <p className={`text-2xl font-serif font-bold ${stat.color}`} data-testid={`stat-${stat.testId}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Workspace Planning Submissions
              <span className="text-white/30 font-normal text-sm">({filtered.length})</span>
            </h2>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              data-testid="select-filter-status"
              className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.1)] text-white/60 text-xs rounded-lg px-3 py-2 focus:outline-none min-h-[36px]"
            >
              <option value="All">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[rgba(255,255,255,0.03)] rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Upload className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40 text-sm mb-2">No planning requests yet</p>
              <p className="text-white/25 text-xs">They'll appear here when visitors submit the floor plan upload form.</p>
              <Button asChild size="sm" className="mt-4 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold">
                <Link href="/upload-your-floor-plan">View Upload Page</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(req => {
                const statusConf = STATUS_CONFIG[req.status as PlanningStatus] || STATUS_CONFIG["New"];
                const uploadedFiles: UploadedFile[] = (() => {
                  try { return JSON.parse(req.uploadedFilesJson || "[]"); } catch { return []; }
                })();
                const aiRec: AiRec | null = (() => {
                  try { return req.aiRecommendations ? JSON.parse(req.aiRecommendations) : null; } catch { return null; }
                })();
                const isExpanded = expandedId === req.id;
                const activeTab = getTab(req.id);
                const zones = aiRec?.workspaceZones ?? [];
                const recs = aiRec?.productRecommendations ?? [];
                const cost = aiRec?.costBreakdown;
                const timeline = req.implementationTimeline ?? aiRec?.implementationTimeline;
                const estimatedValue = req.estimatedValue ?? aiRec?.estimatedProjectValue;
                const leadScore = req.leadScore ?? aiRec?.leadScore;

                return (
                  <div key={req.id} data-testid={`planning-card-${req.id}`} className="border border-[rgba(255,255,255,0.05)] rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="w-full text-left p-4 hover:bg-[rgba(255,255,255,0.02)] transition-all"
                      data-testid={`button-expand-${req.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.12)] flex items-center justify-center flex-shrink-0 text-[hsl(43,78%,52%)] font-bold text-sm">
                            {req.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-semibold text-sm">{req.name}</p>
                            <p className="text-white/40 text-xs mt-0.5">
                              {req.company || "No company"} · {req.city || "Location not given"}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge className={`text-xs border ${statusConf.color}`}>{req.status}</Badge>
                              {req.projectType && <span className="text-white/40 text-xs">{req.projectType}</span>}
                              {estimatedValue && (
                                <span className="text-[hsl(43,78%,65%)] text-xs font-semibold flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />{estimatedValue}
                                </span>
                              )}
                              {leadScore != null && <LeadScoreBadge score={leadScore} />}
                              {timeline && (
                                <span className="text-white/30 text-xs flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{timeline}
                                </span>
                              )}
                              {uploadedFiles.length > 0 && (
                                <span className="text-white/30 text-xs flex items-center gap-1">
                                  <Paperclip className="w-3 h-3" />{uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-white/30 text-xs hidden sm:block">{formatDate(req.createdAt)}</span>
                          <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)]">
                        <div className="flex overflow-x-auto gap-0 border-b border-[rgba(255,255,255,0.05)] px-4">
                          {TABS.map(tab => (
                            <button
                              key={tab.key}
                              onClick={() => setTab(req.id, tab.key)}
                              data-testid={`tab-${tab.key}-${req.id}`}
                              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                                activeTab === tab.key
                                  ? "border-[hsl(43,78%,52%)] text-[hsl(43,78%,65%)]"
                                  : "border-transparent text-white/40 hover:text-white/70"
                              }`}
                            >
                              {tab.icon}{tab.label}
                            </button>
                          ))}
                        </div>

                        <div className="p-5">
                          {activeTab === "overview" && (
                            <div className="space-y-5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                <div className="flex items-center gap-2 text-white/60">
                                  <Mail className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                                  <a href={`mailto:${req.email}`} className="hover:text-white transition-colors truncate">{req.email}</a>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                  <Phone className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                                  <a href={`tel:${req.phone}`} className="hover:text-white transition-colors">{req.phone}</a>
                                </div>
                                {req.staffCount && (
                                  <div className="flex items-center gap-2 text-white/60">
                                    <Users className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                                    <span>{req.staffCount} staff</span>
                                  </div>
                                )}
                                {req.squareMetres && (
                                  <div className="flex items-center gap-2 text-white/60">
                                    <LayoutDashboard className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                                    <span>{req.squareMetres} sqm</span>
                                  </div>
                                )}
                                {req.stylePreference && (
                                  <div className="flex items-center gap-2 text-white/60">
                                    <Palette className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                                    <span>{req.stylePreference}</span>
                                  </div>
                                )}
                                {req.meetingRooms && req.meetingRooms !== "0" && (
                                  <div className="flex items-center gap-2 text-white/60">
                                    <Building2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                                    <span>{req.meetingRooms} meeting room{parseInt(req.meetingRooms) > 1 ? "s" : ""}</span>
                                  </div>
                                )}
                              </div>

                              {(req.receptionRequired || req.breakoutRequired || req.executiveOfficeRequired) && (
                                <div className="flex flex-wrap gap-2">
                                  {req.receptionRequired && <span className="text-xs px-2.5 py-1 rounded-full bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.2)]">Reception</span>}
                                  {req.breakoutRequired && <span className="text-xs px-2.5 py-1 rounded-full bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.2)]">Breakout Area</span>}
                                  {req.executiveOfficeRequired && <span className="text-xs px-2.5 py-1 rounded-full bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.2)]">Executive Office</span>}
                                </div>
                              )}

                              {req.specialRequirements && (
                                <div>
                                  <p className="text-white/40 text-xs mb-1.5">Special Requirements</p>
                                  <p className="text-white/65 text-sm leading-relaxed bg-[rgba(255,255,255,0.03)] rounded-lg p-3">{req.specialRequirements}</p>
                                </div>
                              )}

                              {uploadedFiles.length > 0 && (
                                <div>
                                  <p className="text-white/40 text-xs mb-2 flex items-center gap-1.5"><Paperclip className="w-3 h-3" /> Uploaded Files</p>
                                  <div className="flex flex-wrap gap-2">
                                    {uploadedFiles.map((f, i) => (
                                      <a
                                        key={i}
                                        href={f.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid={`link-file-${i}`}
                                        className="flex items-center gap-2 px-3 py-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,168,76,0.3)] rounded-lg text-xs text-white/60 hover:text-[hsl(43,78%,65%)] transition-all"
                                      >
                                        <Paperclip className="w-3 h-3" />
                                        {f.originalName}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {aiRec?.clientBrief && (
                                <div className="bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.1)] rounded-xl p-4">
                                  <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">AI Brief</p>
                                  <p className="text-white/70 text-sm leading-relaxed">{aiRec.clientBrief}</p>
                                  {aiRec.officeType && <p className="text-white/40 text-xs mt-2">{aiRec.officeType}</p>}
                                  {aiRec.urgencyNote && (
                                    <div className="mt-3 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                                      <p className="text-amber-400 text-xs"><span className="font-semibold">Note:</span> {aiRec.urgencyNote}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {aiRec?.styleDirection && (
                                <div>
                                  <p className="text-white/40 text-xs mb-1.5 flex items-center gap-1.5"><Palette className="w-3 h-3" /> Style Direction</p>
                                  <p className="text-white/60 text-sm leading-relaxed">{aiRec.styleDirection}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === "zones" && (
                            <ZoneVisualization zones={zones} />
                          )}

                          {activeTab === "furniture" && (
                            <FurnitureRecsPanel recs={recs} />
                          )}

                          {activeTab === "cost" && (
                            <CostTimeline cost={cost} timeline={timeline} aiRec={aiRec} leadScore={leadScore} request={req} />
                          )}

                          {activeTab === "report" && (
                            <PlanningReport request={req} />
                          )}
                        </div>

                        <div className="border-t border-[rgba(255,255,255,0.05)] p-5 space-y-4">
                          <div className="space-y-2">
                            <p className="text-white/40 text-xs">Admin Notes</p>
                            <textarea
                              value={adminNotes[req.id] !== undefined ? adminNotes[req.id] : req.adminNotes || ""}
                              onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                              placeholder="Internal notes, follow-up actions, quote references..."
                              data-testid={`textarea-admin-notes-${req.id}`}
                              rows={3}
                              className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.15)] rounded-xl px-4 py-3 text-white/70 placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,168,76,0.4)] text-sm resize-none"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={req.status}
                              onChange={e => statusMutation.mutate({ id: req.id, status: e.target.value })}
                              data-testid={`select-status-${req.id}`}
                              className="bg-[hsl(220,18%,12%)] border border-[rgba(201,168,76,0.2)] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none min-h-[36px]"
                            >
                              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <Button
                              size="sm"
                              onClick={() => saveNotes(req.id)}
                              disabled={savingNotes === req.id}
                              className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.3)] hover:bg-[rgba(201,168,76,0.25)] min-h-[36px]"
                              data-testid={`button-save-notes-${req.id}`}
                            >
                              {savingNotes === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                              Save Notes
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => revisePlan(req.id)}
                              disabled={revisingId === req.id}
                              variant="outline"
                              className="border-[rgba(255,255,255,0.15)] text-white/60 hover:text-white min-h-[36px]"
                              data-testid={`button-revise-${req.id}`}
                            >
                              {revisingId === req.id
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Regenerating...</>
                                : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate AI Plan</>
                              }
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => deleteMutation.mutate(req.id)}
                              disabled={deleteMutation.isPending}
                              variant="ghost"
                              className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 min-h-[36px] ml-auto"
                              data-testid={`button-delete-${req.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
