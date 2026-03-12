import { useState, useEffect } from "react";
import { Link } from "wouter";
import { validateAdminLogin } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PlanningReport from "@/components/PlanningReport";
import SpacePlanningEngine from "@/components/SpacePlanningEngine";
import WorkspaceLayout2D from "@/components/WorkspaceLayout2D";
import { CATALOGUE } from "@/lib/furnitureCatalogue";
import {
  ShieldCheck, LayoutDashboard, Target, Megaphone, Upload,
  ChevronDown, ChevronRight, Building2, MapPin, Mail, Phone,
  Loader2, Trash2, RefreshCw, Package, FileText, Palette,
  Star, DollarSign, Users, Layers, CheckCircle2, Calendar,
  ExternalLink, Paperclip, TrendingUp, Briefcase, BarChart3,
  Zap, Clock, Table2, TrendingDown, ShieldAlert, Award,
} from "lucide-react";


type PlanningStatus = "New" | "In Review" | "Quoted" | "Converted" | "Archived";
type ActiveTab = "overview" | "zones" | "furniture" | "cost" | "report" | "package" | "profit";

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
  packageJson?: string;
  quoteJson?: string;
  quoteStatus?: string;
  floorGeometryJson?: string;
  geometrySource?: string;
  source?: string;
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

interface PackageItem {
  sku: string;
  productName: string;
  category: string;
  series: string;
  zone: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  rationale: string;
}

interface FurniturePackage {
  packageName: string;
  packageTier: string;
  workspaceType: string;
  totalItems: number;
  furnitureSubtotal: number;
  installationEstimate: number;
  deliveryEstimate: number;
  projectTotal: number;
  projectTotalRange: string;
  perStaffCost?: number;
  monthlyFinanceEstimate: string;
  financeNote: string;
  items: PackageItem[];
  upsellOpportunities: string[];
  whyThisPackage: string;
  generatedAt: string;
}

interface QuoteSummary {
  quoteReference: string;
  status: string;
  clientBrief: string;
  workspaceType: string;
  packageTier: string;
  packageName: string;
  productSchedule: PackageItem[];
  costSummary: {
    furnitureSubtotal: number;
    installation: number;
    delivery: number;
    projectTotal: number;
    projectTotalRange: string;
    gst: number;
    totalIncGst: number;
  };
  financeOption: {
    monthlyEstimate: string;
    term: string;
    note: string;
  };
  addOnOpportunities: string[];
  recommendedNextStep: string;
  urgencyNote?: string;
  implementationTimeline?: string;
  styleDirection?: string;
  preparedFor: string;
  generatedAt: string;
}

const TIER_COLORS: Record<string, string> = {
  Foundation: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Professional: "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]",
  Executive: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

// ─── Profit Intelligence Panel ────────────────────────────────────────────────

interface CostStackTier {
  packageTier: string;
  packageName: string;
  totalLandedCost: number;
  installationCost: number;
  totalLandedWithInstall: number;
  quotedPrice: number;
  grossProfit: number;
  marginPercent: number;
  confidenceLevel: string;
  supplierMix: Record<string, string[]>;
  keyStrengths: string[];
}
interface ProfitComparison {
  officeSqm: number;
  staffCount: number;
  premium: CostStackTier;
  balanced: CostStackTier;
  value: CostStackTier;
  recommendation: string;
  bestMarginTier: string;
}

function marginHealthConfig(m: number): { label: string; color: string; bg: string; icon: any } {
  if (m >= 55) return { label: "Excellent Margin", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: Award };
  if (m >= 48) return { label: "Strong Margin", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: TrendingUp };
  if (m >= 40) return { label: "Acceptable Margin", color: "text-[hsl(43,78%,65%)]", bg: "bg-[rgba(201,168,76,0.1)] border-[rgba(201,168,76,0.2)]", icon: BarChart3 };
  if (m >= 32) return { label: "Margin Watch", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: ShieldAlert };
  return { label: "Low Margin", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: TrendingDown };
}

function ProfitIntelligencePanel({ request }: { request: PlanningRequest }) {
  const [data, setData] = useState<ProfitComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  const sqm = Number(request.squareMetres) || 0;
  const staff = Number(request.staffCount) || 0;

  async function loadAnalysis() {
    if (!sqm || !staff) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/profit/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officeSqm: sqm, staffCount: staff }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json);
      setLoaded(true);
    } catch (e: any) {
      toast({ title: "Profit analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (!sqm || !staff) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <DollarSign className="w-10 h-10 text-white/20" />
        <div>
          <p className="text-white/50 text-sm font-medium mb-1">Workspace dimensions required</p>
          <p className="text-white/25 text-xs max-w-xs">Office size (sqm) and staff count must be set on this submission before profit analysis can run.</p>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.15)] flex items-center justify-center">
          <DollarSign className="w-7 h-7 text-[hsl(43,78%,52%)]" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm mb-1">Package Profit Intelligence</p>
          <p className="text-white/40 text-xs max-w-xs leading-relaxed">Run a full cost stack analysis for this {sqm} sqm / {staff}-person workspace. See Premium, Balanced, and Value package margins with supplier mix recommendations.</p>
        </div>
        <Button
          size="sm"
          onClick={loadAnalysis}
          disabled={loading}
          className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.3)] hover:bg-[rgba(201,168,76,0.25)] min-h-[36px]"
          data-testid={`button-profit-analyse-${request.id}`}
        >
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Analysing...</> : <><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Run Profit Analysis</>}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const tiers = [
    { key: "premium", stack: data.premium, label: "Premium", color: "border-[rgba(201,168,76,0.3)]", labelColor: "text-[hsl(43,78%,65%)]" },
    { key: "balanced", stack: data.balanced, label: "Balanced", color: "border-blue-500/20", labelColor: "text-blue-400" },
    { key: "value", stack: data.value, label: "Value", color: "border-white/10", labelColor: "text-white/50" },
  ] as const;

  return (
    <div className="space-y-6" data-testid={`panel-profit-${request.id}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Profit Intelligence
          </p>
          <p className="text-white/40 text-xs">{sqm} sqm · {staff} staff · Indicative cost stack</p>
        </div>
        <Button
          size="sm"
          onClick={loadAnalysis}
          disabled={loading}
          variant="ghost"
          className="text-white/40 hover:text-white text-xs min-h-[32px]"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />} Refresh
        </Button>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiers.map(({ key, stack, label, color, labelColor }) => {
          const health = marginHealthConfig(stack.marginPercent);
          const HealthIcon = health.icon;
          const isBest = data.bestMarginTier === key;
          return (
            <div
              key={key}
              className={`bg-[rgba(255,255,255,0.02)] border rounded-xl p-4 space-y-3 ${isBest ? "border-green-500/30 ring-1 ring-green-500/10" : color}`}
              data-testid={`card-profit-tier-${key}-${request.id}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${labelColor}`}>{label}</span>
                {isBest && <span className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5 font-medium">Best Margin</span>}
              </div>
              <div>
                <p className="text-white font-serif font-bold text-xl">${Math.round(stack.quotedPrice / 1000)}k</p>
                <p className="text-white/30 text-xs">quoted · ${Math.round(stack.totalLandedWithInstall / 1000)}k landed</p>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${health.bg} ${health.color}`}>
                <HealthIcon className="w-3 h-3" />
                <span>{Math.round(stack.marginPercent)}% · {health.label}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Landed cost</span>
                  <span className="text-white/60">${Math.round(stack.totalLandedCost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Installation</span>
                  <span className="text-white/60">${Math.round(stack.installationCost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold border-t border-[rgba(255,255,255,0.05)] pt-1.5 mt-1.5">
                  <span className="text-white/50">Gross Profit</span>
                  <span className="text-green-400">${Math.round(stack.grossProfit).toLocaleString()}</span>
                </div>
              </div>
              {stack.keyStrengths?.length > 0 && (
                <p className="text-white/30 text-xs leading-relaxed">{stack.keyStrengths[0]}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendation */}
      {data.recommendation && (
        <div className="bg-[rgba(34,197,94,0.05)] border border-green-500/15 rounded-xl p-4">
          <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> AI Profit Recommendation
          </p>
          <p className="text-white/70 text-sm leading-relaxed">{data.recommendation}</p>
        </div>
      )}

      {/* Supplier Mix */}
      {data.balanced?.supplierMix && Object.keys(data.balanced.supplierMix).length > 0 && (
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Recommended Supplier Mix (Balanced)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(data.balanced.supplierMix).map(([supplier, categories]) => (
              <div key={supplier} className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5">
                <p className="text-white/70 text-xs font-semibold mb-1">{supplier}</p>
                <p className="text-white/35 text-xs leading-relaxed">{(categories as string[]).join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finance framing */}
      <div className="bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.12)] rounded-xl p-4">
        <p className="text-[hsl(43,78%,65%)] text-xs font-semibold mb-2 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" /> Finance Framing
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {tiers.map(({ key, stack, label }) => {
            const monthly = Math.round(stack.quotedPrice / 60);
            return (
              <div key={key}>
                <p className="text-white/30 text-xs mb-0.5">{label}</p>
                <p className="text-white font-semibold text-sm">${monthly.toLocaleString()}/mo</p>
                <p className="text-white/25 text-xs">60-mo est.</p>
              </div>
            );
          })}
        </div>
        <p className="text-white/25 text-xs mt-3 text-center">Indicative finance estimate — actual rates subject to lender approval</p>
      </div>

      <p className="text-white/20 text-xs text-right">Confidence: {data.balanced?.confidenceLevel ?? "medium"} · Supplier pricing data</p>
    </div>
  );
}

// ─── Package Quote Panel ──────────────────────────────────────────────────────

function PackageQuotePanel({ request, onRegenerateClick, revisingId }: {
  request: PlanningRequest;
  onRegenerateClick: () => void;
  revisingId: string | null;
}) {
  const pkg: FurniturePackage | null = (() => { try { return request.packageJson ? JSON.parse(request.packageJson) : null; } catch { return null; } })();
  const quote: QuoteSummary | null = (() => { try { return request.quoteJson ? JSON.parse(request.quoteJson) : null; } catch { return null; } })();

  if (!pkg || !quote) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <Briefcase className="w-10 h-10 text-white/20" />
        <div>
          <p className="text-white/50 text-sm font-medium mb-1">No package generated yet</p>
          <p className="text-white/25 text-xs max-w-xs">Use the Regenerate AI Plan button below to generate a furniture package and quote summary for this submission.</p>
        </div>
        <Button
          size="sm"
          onClick={onRegenerateClick}
          disabled={revisingId === request.id}
          variant="outline"
          className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.1)] min-h-[36px]"
          data-testid={`button-gen-package-${request.id}`}
        >
          {revisingId === request.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Generating...</> : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Generate Package & Quote</>}
        </Button>
      </div>
    );
  }

  const tierColor = TIER_COLORS[pkg.packageTier] || TIER_COLORS.Professional;
  const cs = quote.costSummary;

  return (
    <div className="space-y-6" data-testid={`panel-package-${request.id}`}>

      {/* Package Header */}
      <div className="bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.15)] rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-bold border rounded-full px-2.5 py-0.5 ${tierColor}`}>{pkg.packageTier} Tier</span>
              <span className="text-white/30 text-xs">·</span>
              <span className="text-white/50 text-xs">{quote.quoteReference}</span>
              <span className={`text-xs border rounded-full px-2 py-0.5 ${quote.status === "issued" ? "bg-green-500/10 text-green-400 border-green-500/20" : quote.status === "ready" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-white/30 border-white/10"}`}>
                {quote.status === "issued" ? "Issued" : quote.status === "ready" ? "Ready to Issue" : "Draft"}
              </span>
            </div>
            <h3 className="text-white font-serif font-bold text-lg leading-tight">{pkg.packageName}</h3>
            <p className="text-white/40 text-sm mt-1">{pkg.workspaceType} · {pkg.totalItems} items total</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs mb-0.5">Estimated Project Range</p>
            <p className="text-[hsl(43,78%,65%)] font-serif font-bold text-xl">{pkg.projectTotalRange}</p>
            {pkg.perStaffCost && <p className="text-white/30 text-xs mt-0.5">{fmt(pkg.perStaffCost)} per staff</p>}
          </div>
        </div>
        {pkg.whyThisPackage && (
          <p className="text-white/50 text-sm mt-4 leading-relaxed border-t border-[rgba(255,255,255,0.05)] pt-4">{pkg.whyThisPackage}</p>
        )}
      </div>

      {/* Product Schedule */}
      <div>
        <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Table2 className="w-3.5 h-3.5" /> Product Schedule
        </p>
        <div className="bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="text-left text-white/30 font-medium text-xs px-4 py-3">Zone</th>
                  <th className="text-left text-white/30 font-medium text-xs px-4 py-3">Product</th>
                  <th className="text-left text-white/30 font-medium text-xs px-4 py-3">SKU</th>
                  <th className="text-center text-white/30 font-medium text-xs px-4 py-3">Qty</th>
                  <th className="text-right text-white/30 font-medium text-xs px-4 py-3">Unit</th>
                  <th className="text-right text-white/30 font-medium text-xs px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {pkg.items.map((item, i) => (
                  <tr key={i} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors" data-testid={`pkg-item-${i}`}>
                    <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{item.zone}</td>
                    <td className="px-4 py-3">
                      <p className="text-white/80 font-medium text-xs leading-tight">{item.productName}</p>
                      {item.series && <p className="text-white/30 text-xs mt-0.5">{item.series}</p>}
                    </td>
                    <td className="px-4 py-3 text-[hsl(43,78%,52%)] text-xs font-mono whitespace-nowrap">{item.sku}</td>
                    <td className="px-4 py-3 text-center text-white/70 text-xs font-bold">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-white/50 text-xs">{fmt(item.unitCost)}</td>
                    <td className="px-4 py-3 text-right text-white font-bold text-xs">{fmt(item.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cost Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Cost Summary (ex. GST)
          </p>
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 space-y-2">
            {[
              { label: "Furniture Subtotal", value: cs.furnitureSubtotal },
              { label: "Installation", value: cs.installation },
              { label: "Delivery & Logistics", value: cs.delivery },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-white/40">{row.label}</span>
                <span className="text-white/70">{fmt(row.value)}</span>
              </div>
            ))}
            <div className="border-t border-[rgba(255,255,255,0.08)] pt-2 flex justify-between text-sm">
              <span className="text-white/60 font-medium">Project Total</span>
              <span className="text-white font-bold">{fmt(cs.projectTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/30">GST (10%)</span>
              <span className="text-white/40">{fmt(cs.gst)}</span>
            </div>
            <div className="bg-[rgba(201,168,76,0.08)] rounded-lg p-2.5 flex justify-between">
              <span className="text-[hsl(43,78%,65%)] text-sm font-bold">Total inc. GST</span>
              <span className="text-[hsl(43,78%,65%)] text-sm font-bold">{fmt(cs.totalIncGst)}</span>
            </div>
            <p className="text-white/25 text-xs pt-1">Range: {cs.projectTotalRange}</p>
          </div>
        </div>

        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Finance Option
          </p>
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
            <div className="text-center py-3">
              <p className="text-[hsl(43,78%,65%)] font-serif font-bold text-2xl">{pkg.monthlyFinanceEstimate}</p>
              <p className="text-white/40 text-xs mt-1">{quote.financeOption.term} commercial finance estimate</p>
            </div>
            <p className="text-white/25 text-xs leading-relaxed border-t border-[rgba(255,255,255,0.06)] pt-3 mt-3">{pkg.financeNote}</p>
          </div>

          {quote.implementationTimeline && (
            <div className="mt-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
              <p className="text-white/40 text-xs mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Implementation Timeline</p>
              <p className="text-white font-bold text-sm">{quote.implementationTimeline}</p>
            </div>
          )}
        </div>
      </div>

      {/* Upsell Opportunities */}
      {pkg.upsellOpportunities.length > 0 && (
        <div>
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Upsell / Add-on Opportunities
          </p>
          <div className="space-y-2">
            {pkg.upsellOpportunities.map((u, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3">
                <Zap className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                <span className="text-white/60 text-sm">{u}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Step */}
      {quote.recommendedNextStep && (
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
          <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Recommended Next Step
          </p>
          <p className="text-white/70 text-sm">{quote.recommendedNextStep}</p>
          {quote.urgencyNote && <p className="text-amber-400/70 text-xs mt-2 italic">{quote.urgencyNote}</p>}
        </div>
      )}

      {/* Prepared For */}
      <p className="text-white/20 text-xs text-right">
        Prepared for: {quote.preparedFor} · Generated {new Date(pkg.generatedAt).toLocaleDateString("en-AU")}
      </p>

      {/* Create Formal Quote CTA */}
      <div className="border-t border-[rgba(255,255,255,0.06)] pt-4 flex justify-end">
        <button
          data-testid={`button-create-formal-quote-${request.id}`}
          onClick={() => {
            window.location.href = `/admin/quotes?planningRequestId=${request.id}`;
          }}
          className="flex items-center gap-2 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[#0f0f13] text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4" />
          Create Formal Quote
        </button>
      </div>
    </div>
  );
}

export default function AdminPlanningRequests() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
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
    if (validateAdminLogin(email, pw)) {
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
            <label className="block text-sm text-white/60 mb-2">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="admin@thecorporatedesk.com.au"
              data-testid="input-planning-email"
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
              data-testid="input-planning-password"
              className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-1 ${pwError ? "border-red-500/50" : "border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)]"}`}
              style={{ minHeight: "48px" }}
            />
            {pwError && <p className="text-red-400 text-xs mb-3">Incorrect credentials. Please try again.</p>}
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
    { key: "package", label: "Package & Quote", icon: <Briefcase className="w-3.5 h-3.5" /> },
    { key: "profit", label: "Profit Intelligence", icon: <DollarSign className="w-3.5 h-3.5" /> },
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
                              {req.source === "design-engine" && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.25)] flex items-center gap-1" data-testid={`badge-design-engine-${req.id}`}>
                                  <Zap className="w-2.5 h-2.5" /> AI Engine
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

                              {/* Floor Plan Intelligence Panel */}
                              {req.geometrySource && (
                                <div className={`border rounded-xl p-4 ${req.geometrySource === "fallback-rectangle" ? "border-white/10 bg-white/[0.02]" : "border-[rgba(201,168,76,0.18)] bg-[rgba(201,168,76,0.03)]"}`} data-testid={`geometry-panel-${req.id}`}>
                                  <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5" /> Floor Plan Intelligence
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <p className="text-white/30 mb-0.5 uppercase tracking-wider text-[10px]">Detection Method</p>
                                      <p className={`font-semibold ${req.geometrySource === "canny-contour" || req.geometrySource === "pixel-silhouette" ? "text-green-400" : req.geometrySource === "convex-hull" || req.geometrySource === "pdf-dimensions" ? "text-amber-400" : "text-white/40"}`}>
                                        {req.geometrySource === "canny-contour" ? "Canny Edge (High)" : req.geometrySource === "pixel-silhouette" ? "Pixel Silhouette (High)" : req.geometrySource === "convex-hull" ? "Convex Hull (Med)" : req.geometrySource === "pdf-dimensions" ? "PDF Dimensions (Med)" : "Fallback Rectangle"}
                                      </p>
                                    </div>
                                    {(() => {
                                      const geom = (() => { try { return req.floorGeometryJson ? JSON.parse(req.floorGeometryJson) : null; } catch { return null; } })();
                                      return (
                                        <>
                                          {geom?.detectedShape && (
                                            <div>
                                              <p className="text-white/30 mb-0.5 uppercase tracking-wider text-[10px]">Detected Shape</p>
                                              <p className="text-white/70 font-semibold">{geom.detectedShape}</p>
                                            </div>
                                          )}
                                          {geom?.confidence != null && (
                                            <div>
                                              <p className="text-white/30 mb-0.5 uppercase tracking-wider text-[10px]">Confidence</p>
                                              <p className="text-white/70 font-semibold">{Math.round(geom.confidence * 100)}%</p>
                                            </div>
                                          )}
                                          {geom?.internalWalls != null && (
                                            <div>
                                              <p className="text-white/30 mb-0.5 uppercase tracking-wider text-[10px]">Internal Walls</p>
                                              <p className="text-white/70 font-semibold">{geom.internalWalls.length} detected</p>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                  {req.geometrySource !== "fallback-rectangle" && (
                                    <p className="text-white/30 text-xs mt-2 border-t border-[rgba(255,255,255,0.05)] pt-2">
                                      ✓ Real floor plan geometry influenced zone placement in the AI recommendation above.
                                    </p>
                                  )}
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
                            <div className="space-y-6">
                              {zones.length > 0 && zones.some(z => z.percentage > 0) && (
                                <div className="space-y-5">
                                  <div>
                                    <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <LayoutDashboard className="w-3.5 h-3.5" /> 2D Workspace Layout
                                    </p>
                                    <WorkspaceLayout2D
                                      zones={zones}
                                      squareMetres={req.squareMetres}
                                      staffCount={req.staffCount}
                                      officeType={aiRec?.officeType}
                                      isPaid={true}
                                    />
                                  </div>
                                  <SpacePlanningEngine
                                    zones={zones}
                                    recs={recs}
                                    sqm={req.squareMetres}
                                    staffCount={req.staffCount}
                                    costBreakdown={cost ?? undefined}
                                    estimatedValue={req.estimatedValue}
                                    implementationTimeline={timeline}
                                  />
                                </div>
                              )}
                              <ZoneVisualization zones={zones} />
                            </div>
                          )}

                          {activeTab === "furniture" && (
                            <FurnitureRecsPanel recs={recs} />
                          )}

                          {activeTab === "cost" && (
                            <CostTimeline cost={cost} timeline={timeline} aiRec={aiRec} leadScore={leadScore} request={req} />
                          )}

                          {activeTab === "package" && (
                            <PackageQuotePanel
                              request={req}
                              onRegenerateClick={() => revisePlan(req.id)}
                              revisingId={revisingId}
                            />
                          )}

                          {activeTab === "profit" && (
                            <ProfitIntelligencePanel request={req} />
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
