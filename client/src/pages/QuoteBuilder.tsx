import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useNexoraSignal } from "@/hooks/useNexoraSignal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, ArrowLeft, CheckCircle2, Building2, Users,
  LayoutDashboard, DollarSign, MessageSquare, Loader2,
  TrendingUp, Package, MapPin, Clock, Star, Phone, Mail,
  ChevronRight, Zap, FileText, Calendar, Sofa, BarChart2,
} from "lucide-react";
import { FinancePanel } from "@/components/FinancePanel";

// ─── Quote Confidence Score ───────────────────────────────────────────────────
function QuoteConfidenceScore({ inputs }: { inputs: WorkspaceInputs }) {
  const { score, label, color, bgColor, borderColor, factors } = useMemo(() => {
    let total = 0;
    const factors: { label: string; scored: boolean }[] = [];

    const check = (condition: boolean, label: string, pts: number) => {
      factors.push({ label, scored: condition });
      if (condition) total += pts;
    };

    check(!!inputs.staffCount, "Staff count provided", 20);
    check(!!inputs.squareMetres && Number(inputs.squareMetres) > 0, "Office size provided", 20);
    check(!!inputs.city, "City/location provided", 10);
    check(!!inputs.budgetRange, "Budget range provided", 20);
    check(!!inputs.stylePreference, "Style preference selected", 10);
    check(inputs.meetingRooms > 0, "Meeting room count specified", 10);
    check(inputs.boardroom || inputs.reception || inputs.breakout || inputs.executiveOffice, "Zone requirements selected", 10);

    let label = "Low Confidence";
    let color = "text-red-400";
    let bgColor = "bg-red-400";
    let borderColor = "border-red-400/20";

    if (total >= 80) {
      label = "High Confidence";
      color = "text-green-400";
      bgColor = "bg-green-400";
      borderColor = "border-green-400/20";
    } else if (total >= 60) {
      label = "Good Confidence";
      color = "text-[hsl(43,78%,65%)]";
      bgColor = "bg-[hsl(43,78%,52%)]";
      borderColor = "border-[rgba(201,168,76,0.2)]";
    } else if (total >= 40) {
      label = "Moderate Confidence";
      color = "text-yellow-400";
      bgColor = "bg-yellow-400";
      borderColor = "border-yellow-400/20";
    }

    return { score: total, label, color, bgColor, borderColor, factors };
  }, [inputs]);

  return (
    <div className={`bg-[hsl(220,18%,10%)] border ${borderColor} rounded-xl p-6 mb-10`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-white/40" />
          <h3 className="font-semibold text-white">Quote Confidence Score</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold font-serif ${color}`}>{score}</span>
          <span className="text-white/30 text-sm">/100</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color} bg-white/5 border ${borderColor}`}>{label}</span>
        </div>
      </div>

      <div className="w-full bg-white/5 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${bgColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {factors.map((f) => (
          <div key={f.label} className={`flex items-center gap-1.5 text-xs ${f.scored ? "text-white/60" : "text-white/25"}`}>
            <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${f.scored ? "text-green-400" : "text-white/15"}`} />
            {f.label}
          </div>
        ))}
      </div>

      {score < 60 && (
        <p className="text-white/35 text-xs mt-3 italic">
          Add more project details above to improve estimate accuracy. Our team will contact you to confirm specifics before issuing a formal quote.
        </p>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceInputs {
  projectType: string;
  squareMetres: string;
  staffCount: string;
  city: string;
  meetingRooms: number;
  boardroom: boolean;
  reception: boolean;
  breakout: boolean;
  executiveOffice: boolean;
  storageLevel: string;
  budgetRange: string;
  stylePreference: string;
  notes: string;
}

interface ContactInfo {
  name: string;
  company: string;
  email: string;
  phone: string;
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
  preparedBy: string;
  generatedAt: string;
}

interface EstimateResult {
  quote: QuoteSummary | null;
  aiSummary: string | null;
  officeType: string | null;
  workspaceZones: Array<{
    zone: string;
    color: string;
    percentage: number;
    description: string;
    priority: string;
    staffCapacity: number;
    keyFurniture: string[];
    productivityNote?: string;
  }>;
  estimatedProjectValue: string | null;
  implementationTimeline: string | null;
  styleDirection: string | null;
  keyConsiderations: string[];
  recommendedNextStep: string | null;
  leadId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["Project", "Requirements", "Budget & Style", "Unlock Estimate"];

const PROJECT_TYPES = [
  { id: "full-fitout", label: "Full Office Fitout", desc: "Complete workspace from scratch", icon: Building2 },
  { id: "expansion", label: "Office Expansion", desc: "Adding staff or new areas", icon: Users },
  { id: "refurbishment", label: "Refurbishment", desc: "Upgrading existing furniture", icon: LayoutDashboard },
  { id: "specific", label: "Specific Items", desc: "Targeted product purchases", icon: DollarSign },
];

const STYLE_OPTIONS = [
  { id: "fessenz", label: "Fessenz Design Collection", desc: "Executive dark veneer, prestige aesthetic", tag: "Most Popular" },
  { id: "milan", label: "Milan Premium Series", desc: "Contemporary light timber, modern workplaces" },
  { id: "presidia", label: "Presidia Executive", desc: "Dark stained oak, boardroom presence" },
  { id: "mixed", label: "Mixed / Open to Recommendations", desc: "Our team will curate the best fit" },
];

const BUDGET_RANGES = [
  "$30,000 – $60,000",
  "$60,000 – $100,000",
  "$100,000 – $200,000",
  "$200,000 – $300,000",
  "$300,000+",
];

const STORAGE_LEVELS = [
  { id: "light", label: "Light", desc: "Under-desk pedestals only" },
  { id: "medium", label: "Medium", desc: "Pedestals + wall storage" },
  { id: "heavy", label: "Heavy", desc: "Full filing systems + credenzas" },
];

const CITIES = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Gold Coast", "Other"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString("en-AU")}`;
}

function GoldInput({
  label, value, onChange, type = "text", placeholder = "", required = false, testId = "",
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; testId?: string }) {
  return (
    <div>
      <label className="block text-sm text-white/60 mb-1.5">
        {label}{required && <span className="text-[hsl(43,78%,52%)] ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base"
        style={{ minHeight: "48px" }}
      />
    </div>
  );
}

function Toggle({ active, onToggle, label, sub, testId }: { active: boolean; onToggle: () => void; label: string; sub?: string; testId?: string }) {
  return (
    <button
      onClick={onToggle}
      data-testid={testId}
      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between min-h-[64px] ${
        active
          ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)]"
          : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,168,76,0.3)]"
      }`}
    >
      <div>
        <p className="font-medium text-white text-sm">{label}</p>
        {sub && <p className="text-white/40 text-xs mt-0.5">{sub}</p>}
      </div>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
        active ? "bg-[hsl(43,78%,52%)]" : "border border-white/20"
      }`}>
        {active && <CheckCircle2 className="w-4 h-4 text-[hsl(220,20%,6%)]" />}
      </div>
    </button>
  );
}

// ─── Tier badge ──────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    Executive: { label: "Executive Tier", cls: "bg-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.4)]" },
    Professional: { label: "Professional Tier", cls: "bg-[rgba(59,130,246,0.15)] text-blue-300 border-blue-500/30" },
    Foundation: { label: "Foundation Tier", cls: "bg-[rgba(255,255,255,0.06)] text-white/60 border-white/15" },
  };
  const t = map[tier] || map.Foundation;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${t.cls}`}>{t.label}</span>
  );
}

// ─── Premium Results Page ─────────────────────────────────────────────────────

function EstimateResultsPage({
  result,
  contact,
  inputs,
}: {
  result: EstimateResult;
  contact: ContactInfo;
  inputs: WorkspaceInputs;
}) {
  const { quote, aiSummary, officeType, workspaceZones, estimatedProjectValue, implementationTimeline, styleDirection, keyConsiderations, recommendedNextStep } = result;
  const cs = quote?.costSummary;
  const tier = quote?.packageTier || "Professional";
  const [phone, setPhone] = useState(contact.phone || "");
  const [phoneSaved, setPhoneSaved] = useState(!!contact.phone);
  const { toast } = useToast();

  async function savePhone() {
    if (!phone.trim()) return toast({ title: "Please enter your phone number", variant: "destructive" });
    try {
      await fetch("/api/estimate/contact-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contact.email, phone: phone.trim(), name: contact.name }),
      });
    } catch { /* best-effort */ }
    setPhoneSaved(true);
    toast({ title: "Details saved — we'll be in touch within 24 hours" });
  }

  return (
    <Layout>
      <div className="min-h-screen pt-20 pb-24 px-4 bg-background">
        <div className="max-w-5xl mx-auto">

          {/* ── Header ── */}
          <div className="pt-10 pb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.25)] rounded-full px-4 py-2 text-[hsl(43,78%,65%)] text-sm font-medium mb-6">
              <CheckCircle2 className="w-4 h-4" />
              Workspace Estimate Generated
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
              Your Workspace <span className="gold-text">Estimate</span>
            </h1>
            <div className="section-divider mb-4" />
            <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
              <TierBadge tier={tier} />
              {officeType && (
                <span className="text-xs text-white/50 bg-[rgba(255,255,255,0.05)] border border-white/10 px-2.5 py-1 rounded-full">
                  {officeType}
                </span>
              )}
              {quote?.quoteReference && (
                <span className="text-xs text-white/40 font-mono">Ref: {quote.quoteReference}</span>
              )}
            </div>
            {aiSummary && (
              <p className="text-white/60 max-w-2xl mx-auto leading-relaxed text-base mt-3">{aiSummary}</p>
            )}
          </div>

          {/* ── 3-column summary cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              {
                icon: DollarSign,
                label: "Estimated Investment",
                value: cs ? fmt(cs.totalIncGst) : estimatedProjectValue || "Contact us",
                sub: cs ? "inc GST" : "ex GST (indicative)",
                gold: true,
              },
              {
                icon: Clock,
                label: "Implementation",
                value: implementationTimeline || quote?.implementationTimeline || "8–12 weeks",
                sub: "estimated timeline",
                gold: false,
              },
              {
                icon: Calendar,
                label: "Finance Option",
                value: quote?.financeOption.monthlyEstimate || "Contact us",
                sub: "est. monthly repayment",
                gold: false,
              },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`rounded-xl border p-5 ${card.gold ? "bg-[rgba(201,168,76,0.07)] border-[rgba(201,168,76,0.25)]" : "bg-[hsl(220,18%,10%)] border-[rgba(255,255,255,0.07)]"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${card.gold ? "text-[hsl(43,78%,52%)]" : "text-white/40"}`} />
                    <span className="text-xs text-white/40 uppercase tracking-wide">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold font-serif ${card.gold ? "text-[hsl(43,78%,65%)]" : "text-white"}`}>{card.value}</p>
                  <p className="text-xs text-white/40 mt-1">{card.sub}</p>
                </div>
              );
            })}
          </div>

          {/* ── Workspace Zones ── */}
          {workspaceZones && workspaceZones.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-serif font-bold text-white mb-1">Recommended Workspace Layout</h2>
              <p className="text-white/40 text-sm mb-5">Activity-based zone allocation for {inputs.staffCount ? `${inputs.staffCount} staff` : "your team"}{inputs.squareMetres ? ` across ${inputs.squareMetres} sqm` : ""}.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {workspaceZones.map((zone, i) => (
                  <div key={i} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color || "#B8960C" }} />
                        <h3 className="font-semibold text-white text-sm">{zone.zone}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">{zone.percentage}%</span>
                        {zone.priority === "Essential" && (
                          <span className="text-xs bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.2)] px-1.5 py-0.5 rounded-full">Essential</span>
                        )}
                      </div>
                    </div>
                    <p className="text-white/55 text-xs leading-relaxed mb-3">{zone.description}</p>
                    {zone.keyFurniture && zone.keyFurniture.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {zone.keyFurniture.slice(0, 4).map((item, j) => (
                          <span key={j} className="text-xs bg-[rgba(255,255,255,0.04)] border border-white/10 rounded px-2 py-0.5 text-white/50">{item}</span>
                        ))}
                      </div>
                    )}
                    {zone.productivityNote && (
                      <p className="text-xs text-[hsl(43,78%,55%)] mt-3 italic">{zone.productivityNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Bill of Quantities ── */}
          {quote?.productSchedule && quote.productSchedule.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-serif font-bold text-white mb-1">Estimated Bill of Quantities</h2>
              <p className="text-white/40 text-sm mb-5">Indicative product selection from The Corporate Desk catalogue. Final specification confirmed at formal quotation stage.</p>
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)]">
                        <th className="text-left px-5 py-3 text-white/40 font-medium text-xs uppercase tracking-wide">Product</th>
                        <th className="text-left px-5 py-3 text-white/40 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Zone</th>
                        <th className="text-right px-5 py-3 text-white/40 font-medium text-xs uppercase tracking-wide">Qty</th>
                        <th className="text-right px-5 py-3 text-white/40 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Unit</th>
                        <th className="text-right px-5 py-3 text-white/40 font-medium text-xs uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.productSchedule.map((item, i) => (
                        <tr key={i} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-white font-medium">{item.productName}</p>
                            <p className="text-white/35 text-xs mt-0.5">{item.category}{item.series && item.series !== item.category ? ` · ${item.series}` : ""}</p>
                            {item.sku && item.sku !== "TBD" && (
                              <Link href={`/products/${item.sku}`} className="text-[hsl(43,78%,52%)] text-xs hover:underline mt-0.5 inline-block">
                                {item.sku} →
                              </Link>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-white/50 text-xs hidden sm:table-cell">{item.zone}</td>
                          <td className="px-5 py-3.5 text-right text-white font-medium">{item.quantity}</td>
                          <td className="px-5 py-3.5 text-right text-white/50 hidden md:table-cell">{fmt(item.unitCost)}</td>
                          <td className="px-5 py-3.5 text-right text-[hsl(43,78%,65%)] font-semibold">{fmt(item.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ── Investment Summary ── */}
          {cs && (
            <section className="mb-10">
              <h2 className="text-xl font-serif font-bold text-white mb-1">Estimated Investment Summary</h2>
              <p className="text-white/40 text-sm mb-5">All figures are indicative. Formal quote issued within 24 hours with exact pricing and lead times.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.07)] rounded-xl p-6 space-y-3">
                  {[
                    { label: "Furniture Subtotal", value: fmt(cs.furnitureSubtotal), muted: false },
                    { label: "Delivery Allowance", value: fmt(cs.delivery), muted: true },
                    { label: "Installation Allowance", value: fmt(cs.installation), muted: true },
                    { label: "Project Total Ex-GST", value: fmt(cs.projectTotal), muted: false },
                    { label: "GST (10%)", value: fmt(cs.gst), muted: true },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-sm">
                      <span className={row.muted ? "text-white/40" : "text-white/70"}>{row.label}</span>
                      <span className={row.muted ? "text-white/40" : "text-white"}>{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-[rgba(201,168,76,0.15)] pt-3 flex justify-between font-bold text-base">
                    <span className="text-white">Total Inc GST</span>
                    <span className="text-[hsl(43,78%,65%)]">{fmt(cs.totalIncGst)}</span>
                  </div>
                  {cs.projectTotalRange && (
                    <p className="text-white/30 text-xs">Indicative range: {cs.projectTotalRange}</p>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Finance option */}
                  {cs.totalIncGst >= 15000 && (
                    <FinancePanel
                      projectValue={cs.totalIncGst}
                      sourcePage="Advanced Estimator"
                      compact
                    />
                  )}
                  {/* Style direction */}
                  {(styleDirection || quote.styleDirection) && (
                    <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-white/40" />
                        <span className="text-sm font-semibold text-white">Aesthetic Direction</span>
                      </div>
                      <p className="text-white/50 text-sm leading-relaxed">{styleDirection || quote.styleDirection}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Add-on Opportunities ── */}
          {quote?.addOnOpportunities && quote.addOnOpportunities.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-serif font-bold text-white mb-1">Recommended Additions</h2>
              <p className="text-white/40 text-sm mb-5">Enhancements often added at specification stage by comparable projects.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quote.addOnOpportunities.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                    <Zap className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                    <p className="text-white/65 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Key Considerations ── */}
          {keyConsiderations && keyConsiderations.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-serif font-bold text-white mb-1">Key Project Considerations</h2>
              <p className="text-white/40 text-sm mb-5">Our workspace strategy team notes the following for your project.</p>
              <ul className="space-y-2">
                {keyConsiderations.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-white/60 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Recommended Next Step ── */}
          {(recommendedNextStep || quote?.recommendedNextStep) && (
            <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-xl p-6 mb-10">
              <h3 className="font-semibold text-white mb-2">Recommended Next Step</h3>
              <p className="text-white/60 text-sm leading-relaxed">{recommendedNextStep || quote?.recommendedNextStep}</p>
            </div>
          )}

          {/* ── Phone capture panel (shown after estimate when phone not yet provided) ── */}
          {!phoneSaved && (
            <section className="mb-10">
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-6 sm:p-8 text-center max-w-xl mx-auto">
                <div className="w-12 h-12 rounded-full bg-[rgba(201,168,76,0.1)] flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-5 h-5 text-[hsl(43,78%,52%)]" />
                </div>
                <h3 className="text-lg font-serif font-bold text-white mb-2">Get Your Formal Quote in 24 Hours</h3>
                <p className="text-white/45 text-sm mb-5">Add your phone number and our workspace strategy team will call to confirm your requirements and issue a formal quotation.</p>
                <div className="flex gap-3">
                  <input
                    data-testid="input-phone-capture"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="04xx xxx xxx"
                    className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] focus:border-[hsl(43,78%,52%)] rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none transition-colors"
                    onKeyDown={e => e.key === "Enter" && savePhone()}
                  />
                  <button
                    data-testid="button-save-phone"
                    onClick={savePhone}
                    className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,60%)] text-[hsl(220,20%,6%)] font-bold rounded-xl px-5 py-3 text-sm transition-all whitespace-nowrap flex-shrink-0"
                  >
                    Send My Quote
                  </button>
                </div>
                <p className="text-white/20 text-[11px] mt-3">We call within business hours. No obligation.</p>
              </div>
            </section>
          )}

          {phoneSaved && (
            <section className="mb-10">
              <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-5 text-center max-w-xl mx-auto flex items-center gap-4">
                <CheckCircle2 className="w-6 h-6 text-[hsl(43,78%,52%)] flex-shrink-0" />
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">Consultation request received</p>
                  <p className="text-white/45 text-xs mt-0.5">A member of our workspace strategy team will call you within 24 hours.</p>
                </div>
              </div>
            </section>
          )}

          {/* ── Quote Confidence Score ── */}
          <QuoteConfidenceScore inputs={inputs} />

          {/* ── CTAs ── */}
          <section className="mb-12">
            <h2 className="text-xl font-serif font-bold text-white mb-2 text-center">Ready to Move Forward?</h2>
            <p className="text-white/40 text-sm mb-6 text-center max-w-xl mx-auto">Our workspace strategy team is ready to turn this estimate into a formal, line-item quotation — typically issued within 24 hours.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/send-us-your-quote">
                <button
                  data-testid="button-cta-request-quote"
                  className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,60%)] text-[hsl(220,20%,6%)] font-bold rounded-xl px-6 py-4 flex items-center justify-center gap-2 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Request Detailed Quote
                </button>
              </Link>
              <a href="https://calendly.com/thecorporatedesk/strategy-call" target="_blank" rel="noopener noreferrer">
                <button
                  data-testid="button-cta-strategy-call"
                  className="w-full border border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.07)] font-bold rounded-xl px-6 py-4 flex items-center justify-center gap-2 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  Book Strategy Call
                </button>
              </a>
              <Link href="/upload-floor-plan">
                <button
                  data-testid="button-cta-ai-planner"
                  className="w-full border border-[rgba(255,255,255,0.12)] text-white/70 hover:border-[rgba(201,168,76,0.3)] hover:text-white font-bold rounded-xl px-6 py-4 flex items-center justify-center gap-2 transition-all"
                >
                  <MapPin className="w-4 h-4" />
                  Upload Floor Plan → AI Layout
                </button>
              </Link>
            </div>
            <p className="text-center text-white/30 text-xs mt-4">Or call us directly: <a href="tel:1300977607" className="text-[hsl(43,78%,52%)] hover:underline">1300 977 607</a></p>
          </section>

          {/* ── Prepared by footer ── */}
          <div className="border-t border-[rgba(255,255,255,0.06)] pt-6 text-center">
            <p className="text-white/25 text-xs">
              {quote?.preparedFor && `Prepared for ${quote.preparedFor} · `}
              {quote?.preparedBy || "The Corporate Desk — Workplace Design Team"} ·{" "}
              {new Date(quote?.generatedAt || Date.now()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-white/20 text-xs mt-1">
              Indicative estimate only. Formal quote required for contractual purposes. All prices ex-GST unless stated. Subject to product availability and site conditions.
            </p>
          </div>

        </div>
      </div>
    </Layout>
  );
}

// ─── Main QuoteBuilder Component ──────────────────────────────────────────────

export default function QuoteBuilder() {
  const { emit } = useNexoraSignal();
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<WorkspaceInputs>({
    projectType: "",
    squareMetres: "",
    staffCount: "",
    city: "",
    meetingRooms: 0,
    boardroom: false,
    reception: false,
    breakout: false,
    executiveOffice: false,
    storageLevel: "medium",
    budgetRange: "",
    stylePreference: "",
    notes: "",
  });
  const [contact, setContact] = useState<ContactInfo>({ name: "", company: "", email: "", phone: "" });
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Commercial Workspace Estimator — Office Fitout Budgeting | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Generate a professional commercial office fitout estimate with AI-powered product recommendations, bill of quantities, and investment summary. Free — no obligation.");
    emit("QUOTE_START", { context: "quote-builder" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // ── AI Chat ─────────────────────────────────────────────────────────────────

  async function sendAiMessage(userMsg?: string) {
    const msg = userMsg || aiInput;
    if (!msg.trim()) return;
    const newMessages = [...aiMessages, { role: "user" as const, content: msg }];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);

    const context = `The user is using the Commercial Workspace Estimator. Current selections:
- Project type: ${inputs.projectType || "not selected"}
- Staff count: ${inputs.staffCount || "not entered"}
- Office size: ${inputs.squareMetres || "not entered"} sqm
- City: ${inputs.city || "not selected"}
- Meeting rooms: ${inputs.meetingRooms}
- Boardroom: ${inputs.boardroom ? "Yes" : "No"} | Reception: ${inputs.reception ? "Yes" : "No"} | Breakout: ${inputs.breakout ? "Yes" : "No"}
- Executive office: ${inputs.executiveOffice ? "Yes" : "No"} | Storage: ${inputs.storageLevel}
- Budget: ${inputs.budgetRange || "not selected"} | Style: ${inputs.stylePreference || "not selected"}

You are an AI Workplace Strategy Advisor for The Corporate Desk. Answer concisely and commercially.`;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: context },
            { role: "assistant", content: "Understood. I'm reviewing your workspace brief and ready to advise." },
            ...newMessages,
          ],
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";
      setAiMessages(prev => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  assistantMsg += data.content;
                  setAiMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: assistantMsg };
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch {
      toast({ title: "AI unavailable", description: "Call 1300 977 607 for expert advice.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  // ── Step advance ─────────────────────────────────────────────────────────────

  function handleStepAdvance() {
    if (step === 0) {
      if (!inputs.projectType) return toast({ title: "Please select a project type", variant: "destructive" });
      if (!inputs.staffCount) return toast({ title: "Please enter your staff count", variant: "destructive" });
    }
    if (step === 2 && !inputs.budgetRange) {
      return toast({ title: "Please select a budget range", variant: "destructive" });
    }
    const prompts: Record<number, string> = {
      0: `I'm planning a "${inputs.projectType}" project for ${inputs.staffCount || "our"} staff${inputs.squareMetres ? ` in a ${inputs.squareMetres} sqm office` : ""} in ${inputs.city || "Australia"}. What are the key considerations I should factor into my estimate?`,
      1: `We need: ${inputs.meetingRooms} meeting room(s)${inputs.boardroom ? ", a boardroom" : ""}${inputs.reception ? ", reception area" : ""}${inputs.breakout ? ", breakout zone" : ""}${inputs.executiveOffice ? ", executive office(s)" : ""}. Does this sound like a typical setup for a company of our size?`,
      2: `Our budget is ${inputs.budgetRange || "flexible"} and we prefer the ${inputs.stylePreference || "mixed"} aesthetic. What style direction and product families would you recommend?`,
    };
    if (prompts[step]) {
      setTimeout(() => sendAiMessage(prompts[step]), 300);
    }
    setStep(s => s + 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!contact.email || !emailRegex.test(contact.email)) {
      return toast({ title: "Please enter a valid email address", variant: "destructive" });
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inputs,
          ...contact,
          meetingRooms: inputs.meetingRooms || 0,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Estimation failed");
      }
      setEstimateResult(data as EstimateResult);
    } catch (err) {
      toast({
        title: "Estimation failed",
        description: "Please try again or call 1300 977 607.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Show premium results ──────────────────────────────────────────────────────

  if (estimateResult) {
    return <EstimateResultsPage result={estimateResult} contact={contact} inputs={inputs} />;
  }

  // ── Generating loading screen ─────────────────────────────────────────────────

  if (isGenerating) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center px-4 pt-24">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-[rgba(201,168,76,0.12)] flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-[hsl(43,78%,52%)] animate-spin" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-3">Analysing Your Workspace</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Our AI workspace strategy engine is generating your commercial estimate — mapping your requirements to real product specifications, calculating quantities, and building your bill of quantities.
            </p>
            <p className="text-white/25 text-xs mt-4">This usually takes 15–30 seconds.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Step wizard ───────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="min-h-screen pt-20 pb-16 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="text-center pt-10 pb-8">
            <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] mb-4">
              Advanced Commercial Estimator
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
              Workspace <span className="gold-text">Estimate Builder</span>
            </h1>
            <p className="text-white/50 max-w-xl mx-auto text-sm leading-relaxed">
              Answer a few questions to receive a real AI-generated commercial estimate — including product recommendations, a bill of quantities, and investment summary.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center mb-10 gap-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex flex-col items-center ${i <= step ? "opacity-100" : "opacity-40"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]" :
                    i === step ? "border-2 border-[hsl(43,78%,52%)] text-[hsl(43,78%,65%)]" :
                    "border border-white/20 text-white/40"
                  }`}>
                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-xs mt-1 hidden sm:block text-white/50">{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-16 h-px mx-1 transition-all ${i < step ? "bg-[hsl(43,78%,52%)]" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Main layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">

            {/* ── Form panel ── */}
            <div className="xl:col-span-2 bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(201,168,76,0.12)] p-6 sm:p-8">

              {/* STEP 0 — Project + Space */}
              {step === 0 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">Project & Workspace</h2>
                  <p className="text-white/50 text-sm mb-6">Tell us about your project and the scale of the workspace.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {PROJECT_TYPES.map(pt => {
                      const Icon = pt.icon;
                      return (
                        <button
                          key={pt.id}
                          data-testid={`button-project-type-${pt.id}`}
                          onClick={() => setInputs(s => ({ ...s, projectType: pt.id }))}
                          className={`text-left p-5 rounded-xl border transition-all min-h-[80px] ${
                            inputs.projectType === pt.id
                              ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)]"
                              : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,168,76,0.3)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${inputs.projectType === pt.id ? "text-[hsl(43,78%,52%)]" : "text-white/40"}`} />
                            <div>
                              <p className="font-semibold text-white text-sm">{pt.label}</p>
                              <p className="text-white/50 text-xs mt-0.5">{pt.desc}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">
                        Number of Staff <span className="text-[hsl(43,78%,52%)]">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={inputs.staffCount}
                        onChange={e => setInputs(s => ({ ...s, staffCount: e.target.value }))}
                        placeholder="e.g. 25"
                        data-testid="input-staff-count"
                        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base"
                        style={{ minHeight: "48px" }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Office Size (sqm)</label>
                      <input
                        type="number"
                        min="0"
                        value={inputs.squareMetres}
                        onChange={e => setInputs(s => ({ ...s, squareMetres: e.target.value }))}
                        placeholder="e.g. 350"
                        data-testid="input-square-metres"
                        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base"
                        style={{ minHeight: "48px" }}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-white/60 mb-1.5">City</label>
                      <select
                        value={inputs.city}
                        onChange={e => setInputs(s => ({ ...s, city: e.target.value }))}
                        data-testid="select-city"
                        className="w-full bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base"
                        style={{ minHeight: "48px" }}
                      >
                        <option value="">Select city</option>
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1 — Space Requirements */}
              {step === 1 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">Space Requirements</h2>
                  <p className="text-white/50 text-sm mb-6">Select all the zones and spaces you require. This shapes your estimate and product recommendations.</p>

                  {/* Meeting rooms */}
                  <div className="mb-5">
                    <label className="block text-sm text-white/60 mb-2">Meeting Rooms</label>
                    <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">Number of Meeting Rooms</p>
                        <p className="text-white/40 text-xs mt-0.5">Small to medium meeting rooms (4–8 person)</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          data-testid="button-decrement-meeting-rooms"
                          onClick={() => setInputs(s => ({ ...s, meetingRooms: Math.max(0, s.meetingRooms - 1) }))}
                          className="w-9 h-9 rounded-md border border-[rgba(201,168,76,0.25)] text-white/60 flex items-center justify-center text-lg font-bold hover:border-[rgba(201,168,76,0.5)] transition-colors"
                        >−</button>
                        <span className="w-10 text-center text-white font-bold text-lg" data-testid="text-meeting-rooms">{inputs.meetingRooms}</span>
                        <button
                          data-testid="button-increment-meeting-rooms"
                          onClick={() => setInputs(s => ({ ...s, meetingRooms: s.meetingRooms + 1 }))}
                          className="w-9 h-9 rounded-md border border-[rgba(201,168,76,0.25)] text-white/60 flex items-center justify-center text-lg font-bold hover:border-[rgba(201,168,76,0.5)] transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  {/* Zone toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    <Toggle
                      active={inputs.boardroom}
                      onToggle={() => setInputs(s => ({ ...s, boardroom: !s.boardroom }))}
                      label="Boardroom"
                      sub="Large table, executive chairs, AV setup"
                      testId="toggle-boardroom"
                    />
                    <Toggle
                      active={inputs.reception}
                      onToggle={() => setInputs(s => ({ ...s, reception: !s.reception }))}
                      label="Reception Area"
                      sub="Reception desk, visitor seating, brand presence"
                      testId="toggle-reception"
                    />
                    <Toggle
                      active={inputs.breakout}
                      onToggle={() => setInputs(s => ({ ...s, breakout: !s.breakout }))}
                      label="Breakout / Social Zone"
                      sub="Lounge seating, café tables, collaboration"
                      testId="toggle-breakout"
                    />
                    <Toggle
                      active={inputs.executiveOffice}
                      onToggle={() => setInputs(s => ({ ...s, executiveOffice: !s.executiveOffice }))}
                      label="Executive Office(s)"
                      sub="Private offices for directors / C-suite"
                      testId="toggle-executive-office"
                    />
                  </div>

                  {/* Storage level */}
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Storage Requirement</label>
                    <div className="grid grid-cols-3 gap-2">
                      {STORAGE_LEVELS.map(s => (
                        <button
                          key={s.id}
                          data-testid={`button-storage-${s.id}`}
                          onClick={() => setInputs(inp => ({ ...inp, storageLevel: s.id }))}
                          className={`p-3 rounded-xl border text-sm transition-all text-left min-h-[60px] ${
                            inputs.storageLevel === s.id
                              ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)] text-white"
                              : "border-[rgba(255,255,255,0.08)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                          }`}
                        >
                          <p className="font-semibold text-sm">{s.label}</p>
                          <p className="text-xs mt-0.5 opacity-60">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 — Budget & Style */}
              {step === 2 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">Budget & Style</h2>
                  <p className="text-white/50 text-sm mb-6">This shapes your product recommendations and estimate confidence level.</p>

                  <div className="mb-6">
                    <label className="block text-sm text-white/60 mb-2">Project Budget Range <span className="text-[hsl(43,78%,52%)]">*</span></label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {BUDGET_RANGES.map(b => (
                        <button
                          key={b}
                          data-testid={`button-budget-${b}`}
                          onClick={() => setInputs(s => ({ ...s, budgetRange: b }))}
                          className={`p-4 rounded-xl border text-sm transition-all text-left min-h-[52px] flex items-center gap-2 ${
                            inputs.budgetRange === b
                              ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)] text-white"
                              : "border-[rgba(255,255,255,0.08)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                          }`}
                        >
                          <DollarSign className={`w-4 h-4 flex-shrink-0 ${inputs.budgetRange === b ? "text-[hsl(43,78%,52%)]" : "text-white/30"}`} />
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-sm text-white/60 mb-2">Style / Collection Preference</label>
                    <div className="space-y-2">
                      {STYLE_OPTIONS.map(s => (
                        <button
                          key={s.id}
                          data-testid={`button-style-${s.id}`}
                          onClick={() => setInputs(inp => ({ ...inp, stylePreference: s.id }))}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between min-h-[64px] ${
                            inputs.stylePreference === s.id
                              ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)]"
                              : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,168,76,0.3)]"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-sm">{s.label}</span>
                              {s.tag && <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-0 text-xs">{s.tag}</Badge>}
                            </div>
                            <p className="text-white/50 text-xs mt-0.5">{s.desc}</p>
                          </div>
                          {inputs.stylePreference === s.id && <CheckCircle2 className="w-5 h-5 text-[hsl(43,78%,52%)] flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Additional Notes (Optional)</label>
                    <textarea
                      value={inputs.notes}
                      onChange={e => setInputs(s => ({ ...s, notes: e.target.value }))}
                      placeholder="Any special requirements, existing furniture to retain, brand guidelines, or access constraints..."
                      data-testid="textarea-notes"
                      rows={3}
                      className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base resize-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3 — Email Gate: Unlock Your Estimate */}
              {step === 3 && (
                <div>
                  {/* Hero unlock heading */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-[rgba(201,168,76,0.12)] flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-[hsl(43,78%,52%)]" />
                    </div>
                    <h2 className="text-xl font-serif font-bold text-white">Unlock Your Estimate</h2>
                  </div>
                  <p className="text-white/50 text-sm mb-6 ml-[52px]">
                    Enter your work email to instantly generate your AI-powered commercial estimate — including product recommendations, a bill of quantities, and full investment summary.
                  </p>

                  {/* What you'll receive preview */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { icon: Package, label: "Product BOQ", desc: "Full spec list with SKUs" },
                      { icon: DollarSign, label: "Investment Summary", desc: "Total cost breakdown ex-GST" },
                      { icon: FileText, label: "Formal Quote", desc: "Sent within 24 hours" },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center">
                        <Icon className="w-5 h-5 text-[hsl(43,78%,52%)] mx-auto mb-2" />
                        <p className="text-white text-xs font-semibold mb-0.5">{label}</p>
                        <p className="text-white/35 text-[11px]">{desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Email capture form */}
                  <div className="space-y-4 mb-5">
                    <GoldInput
                      label="Work Email Address *"
                      value={contact.email}
                      onChange={v => setContact(c => ({ ...c, email: v }))}
                      type="email"
                      required
                      testId="input-contact-email"
                      placeholder="jane@smithco.com.au"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <GoldInput
                        label="Full Name"
                        value={contact.name}
                        onChange={v => setContact(c => ({ ...c, name: v }))}
                        testId="input-contact-name"
                        placeholder="Jane Smith"
                      />
                      <GoldInput
                        label="Company Name"
                        value={contact.company}
                        onChange={v => setContact(c => ({ ...c, company: v }))}
                        testId="input-contact-company"
                        placeholder="Smith & Co."
                      />
                    </div>
                  </div>

                  {/* Project brief summary */}
                  <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.12)] rounded-xl p-4">
                    <h4 className="text-[hsl(43,78%,65%)] font-semibold text-xs uppercase tracking-wider mb-3">Your Estimate Brief</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {[
                        { label: "Project Type", value: PROJECT_TYPES.find(p => p.id === inputs.projectType)?.label || "—" },
                        { label: "Staff Count", value: inputs.staffCount ? `${inputs.staffCount} people` : "—" },
                        { label: "Office Size", value: inputs.squareMetres ? `${inputs.squareMetres} sqm` : "—" },
                        { label: "City", value: inputs.city || "—" },
                        { label: "Budget Range", value: inputs.budgetRange || "—" },
                        { label: "Style", value: STYLE_OPTIONS.find(s => s.id === inputs.stylePreference)?.label || "Mixed" },
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-white/35">{item.label}</p>
                          <p className="text-white/75 font-medium mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Privacy reassurance */}
                  <p className="text-white/25 text-[11px] mt-3 text-center">
                    No spam. No sales pressure. Your details are used only to prepare and send your estimate.
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-[rgba(255,255,255,0.06)]">
                {step > 0 ? (
                  <Button
                    onClick={() => setStep(s => s - 1)}
                    variant="outline"
                    className="border-[rgba(255,255,255,0.15)] text-white/70 min-h-[48px] px-5"
                    data-testid="button-step-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                ) : <div />}

                {step < 3 ? (
                  <Button
                    onClick={handleStepAdvance}
                    className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] px-6"
                    data-testid="button-step-next"
                  >
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isGenerating}
                    className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] px-8"
                    data-testid="button-generate-estimate"
                  >
                    {isGenerating
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Estimate...</>
                      : <><Zap className="w-4 h-4 mr-2" /> Generate My Estimate</>
                    }
                  </Button>
                )}
              </div>
            </div>

            {/* ── Right column: AI advisor + trust signals ── */}
            <div className="flex flex-col gap-4">

              {/* AI Chat */}
              <div className="bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(201,168,76,0.12)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[rgba(201,168,76,0.12)] flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">AI Strategy Advisor</p>
                    <p className="text-white/40 text-xs">Expert workspace guidance</p>
                  </div>
                </div>

                <div className="min-h-[180px] max-h-[320px] overflow-y-auto space-y-3 mb-4 pr-1">
                  {aiMessages.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-white/40 text-sm">Complete the form steps and I'll guide you with expert workspace advice along the way.</p>
                    </div>
                  )}
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[rgba(201,168,76,0.12)] text-white"
                          : "bg-[rgba(255,255,255,0.04)] text-white/80 border border-[rgba(255,255,255,0.06)]"
                      }`}>
                        {msg.content || (aiLoading && i === aiMessages.length - 1 ? <span className="animate-pulse">●●●</span> : null)}
                      </div>
                    </div>
                  ))}
                  <div ref={aiEndRef} />
                </div>

                <div className="flex gap-2">
                  <input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                    placeholder="Ask about product types, costs, layout..."
                    data-testid="input-ai-chat"
                    className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.15)] rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.4)] text-sm"
                    style={{ minHeight: "44px" }}
                  />
                  <Button
                    onClick={() => sendAiMessage()}
                    disabled={aiLoading || !aiInput.trim()}
                    className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] min-h-[44px] min-w-[44px] px-3"
                    data-testid="button-send-ai"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* What you'll receive */}
              <div className="bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(255,255,255,0.06)] p-5">
                <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  What You'll Receive
                </h4>
                <ul className="space-y-2">
                  {[
                    "AI-generated workspace zone analysis",
                    "Recommended product categories & series",
                    "Indicative bill of quantities",
                    "Investment range with GST breakdown",
                    "Commercial finance estimate",
                    "Implementation timeline",
                    "Formal quote follow-up within 24 hrs",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Social proof */}
              <div className="bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.12)] rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex text-[hsl(43,78%,52%)] text-sm">{"★★★★★"}</div>
                </div>
                <p className="text-white/60 text-sm italic leading-relaxed">"The estimate was incredibly accurate — within 8% of the final project cost. The team's knowledge of commercial projects is exceptional."</p>
                <p className="text-white/35 text-xs mt-3">— Operations Director, ASX-listed firm, Sydney</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
