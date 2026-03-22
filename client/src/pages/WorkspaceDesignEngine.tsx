import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import WorkspaceLayout2D from "@/components/WorkspaceLayout2D";
import SpacePlanningEngine from "@/components/SpacePlanningEngine";
import {
  Upload, Loader2, ArrowRight, Building2, Users, LayoutDashboard,
  DollarSign, Package, FileText, Zap, Sparkles, CheckCircle2,
  MapPin, BarChart3, X, ChevronRight, Monitor, Star, AlertTriangle,
  Shield, TrendingUp, Layers,
} from "lucide-react";

const BUDGET_RANGES = [
  "Under $30,000",
  "$30,000 – $60,000",
  "$60,000 – $100,000",
  "$100,000 – $180,000",
  "$180,000 – $300,000",
  "$300,000+",
];

const STYLE_PREFS = [
  "Luxury Executive",
  "Modern Open Plan",
  "Corporate Prestige",
  "Minimal",
  "Warm Timber / Premium",
  "Mixed / Flexible",
];

const PROJECT_TYPES = [
  "New Office",
  "Relocation",
  "Expansion",
  "Refurbishment",
  "Furniture Refresh",
];

const CONFIDENCE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  "canny-contour": { label: "High — Real Floor Detected", color: "text-green-400", desc: "Full boundary trace from uploaded plan" },
  "pixel-silhouette": { label: "High — Silhouette Detected", color: "text-green-400", desc: "Pixel-level floor outline extracted" },
  "convex-hull": { label: "Medium — Convex Geometry", color: "text-amber-400", desc: "Approximate shape from floor plan" },
  "pdf-dimensions": { label: "Medium — PDF Dimensions", color: "text-amber-400", desc: "Aspect ratio from PDF page size" },
  "fallback-rectangle": { label: "Low — Default Rectangle", color: "text-white/40", desc: "Using planner inputs (no geometry extracted)" },
};

interface AiWorkspaceZone {
  zone: string;
  color: string;
  percentage: number;
  description: string;
  priority: string;
  staffCapacity?: number;
  keyFurniture?: string[];
  productivityNote?: string;
}

interface AiProductRec {
  zone: string;
  sku: string;
  category: string;
  productName: string;
  seriesRecommendation?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  rationale?: string;
  estimatedCost?: string;
}

interface AiCostBreakdown {
  furniture: number;
  installation: number;
  delivery: number;
  total: number;
  perStaff?: number;
}

interface AiRecommendation {
  clientBrief?: string;
  executiveSummary?: string;
  officeType?: string;
  estimatedProjectValue?: string;
  leadScore?: number;
  implementationTimeline?: string;
  workspaceZones?: AiWorkspaceZone[];
  productRecommendations?: AiProductRec[];
  costBreakdown?: AiCostBreakdown;
  styleDirection?: string;
  keyConsiderations?: string[];
  recommendedNextStep?: string;
  urgencyNote?: string;
}

interface FloorGeometry {
  boundary: { x: number; y: number }[];
  aspectRatio: number;
  confidence: number;
  source: string;
  detectedShape?: string;
  fallback: boolean;
  internalWalls?: unknown[];
}

interface EngineResult {
  planningRequestId: string;
  aiRec: AiRecommendation;
  geometry: FloorGeometry | null;
}

const inp = "w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-sm transition-colors";
const lbl = "block text-sm text-white/60 mb-1.5";

function GeometryBadge({ geometry }: { geometry: FloorGeometry | null }) {
  if (!geometry) return null;
  const pct = Math.round(geometry.confidence * 100);
  const cfg = CONFIDENCE_LABELS[geometry.source] || CONFIDENCE_LABELS["fallback-rectangle"];
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${geometry.fallback ? "border-white/10 bg-white/[0.02]" : "border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)]"}`}>
      <Shield className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.color}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-xs font-semibold ${cfg.color}`}>Floor Plan Intelligence: {cfg.label}</span>
          {!geometry.fallback && <span className="text-white/30 text-xs">{pct}% confidence</span>}
        </div>
        <p className="text-white/40 text-xs">{cfg.desc}{geometry.detectedShape ? ` · ${geometry.detectedShape} shape detected` : ""}{(geometry.internalWalls?.length ?? 0) > 0 ? ` · ${geometry.internalWalls!.length} internal walls` : ""}</p>
      </div>
    </div>
  );
}

function FinanceOverlay({ totalCost }: { totalCost: number }) {
  const totalIncGst = Math.round(totalCost * 1.1);
  const r = 0.039 / 12;
  const n = 60;
  const factor = r / (1 - Math.pow(1 + r, -n));
  const monthly = Math.round(totalIncGst * factor);
  const monthlyLow = Math.round(monthly * 0.92).toLocaleString("en-AU");
  const monthlyHigh = Math.round(monthly * 1.08).toLocaleString("en-AU");
  return (
    <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl p-6" data-testid="design-engine-finance-overlay">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§08</span>
        <DollarSign className="w-4 h-4 text-[hsl(43,78%,52%)]" />
        <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Finance Your Workspace</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
        <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(255,255,255,0.06)]">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Est. Investment</p>
          <p className="text-white font-bold text-base">${totalIncGst.toLocaleString("en-AU")}</p>
          <p className="text-white/25 text-xs mt-0.5">Inc. GST</p>
        </div>
        <div className="bg-[rgba(201,168,76,0.06)] rounded-xl p-4 border border-[rgba(201,168,76,0.15)]">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Indicative Monthly</p>
          <p className="text-[hsl(43,78%,65%)] font-bold text-base">${monthlyLow} – ${monthlyHigh}</p>
          <p className="text-white/25 text-xs mt-0.5">3.9% p.a. / 60 months</p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-[rgba(255,255,255,0.02)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)] flex flex-col justify-between">
          <p className="text-white/45 text-xs leading-relaxed">Commercial finance available — chattel mortgage, lease-to-own, and rental options. Speak with our team to explore.</p>
          <Link href="/finance-your-workspace">
            <span className="text-[hsl(43,78%,52%)] text-xs font-semibold flex items-center gap-1 mt-3" data-testid="link-finance-workspace">
              Explore finance <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
      <p className="text-white/20 text-[10px]">Finance indicative only. Subject to lender approval, final specification and credit assessment.</p>
    </div>
  );
}

export default function WorkspaceDesignEngine() {
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [result, setResult] = useState<EngineResult | null>(null);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [sqm, setSqm] = useState("");
  const [staff, setStaff] = useState("");
  const [budget, setBudget] = useState("");
  const [style, setStyle] = useState("");
  const [projectType, setProjectType] = useState("");
  const [reception, setReception] = useState(false);
  const [breakout, setBreakout] = useState(false);
  const [executive, setExecutive] = useState(false);
  const [meetingRooms, setMeetingRooms] = useState("0");

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && ["image/png", "image/jpeg", "application/pdf"].includes(file.type)) {
      setFloorPlanFile(file);
    } else if (file) {
      toast({ title: "Invalid file type", description: "Please upload PNG, JPG, or PDF.", variant: "destructive" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !sqm.trim() || !staff.trim() || !budget) {
      toast({ title: "Please fill in required fields", description: "Name, email, office size, staff count, and budget are required.", variant: "destructive" });
      return;
    }

    setStep("loading");

    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("email", email.trim());
      fd.append("company", company.trim() || "");
      fd.append("phone", phone.trim() || "N/A");
      fd.append("city", city.trim() || "");
      fd.append("squareMetres", sqm.trim());
      fd.append("staffCount", staff.trim());
      fd.append("budgetRange", budget);
      fd.append("stylePreference", style || "");
      fd.append("projectType", projectType || "New Office");
      fd.append("receptionRequired", String(reception));
      fd.append("breakoutRequired", String(breakout));
      fd.append("executiveOfficeRequired", String(executive));
      fd.append("meetingRooms", meetingRooms);
      fd.append("source", "design-engine");
      if (floorPlanFile) fd.append("floorPlan", floorPlanFile);

      const res = await fetch("/api/planning-requests", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate workspace design");

      const aiRec: AiRecommendation = data.aiRecommendations || {};
      setResult({
        planningRequestId: data.id,
        aiRec,
        geometry: data.floorGeometry || null,
      });
      setStep("result");
    } catch (err: any) {
      console.error("[DesignEngine]", err);
      toast({ title: "Generation failed", description: err.message || "Please try again.", variant: "destructive" });
      setStep("form");
    }
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[hsl(220,20%,5%)] text-white">
        {step === "form" && <FormView
          name={name} setName={setName}
          email={email} setEmail={setEmail}
          company={company} setCompany={setCompany}
          phone={phone} setPhone={setPhone}
          city={city} setCity={setCity}
          sqm={sqm} setSqm={setSqm}
          staff={staff} setStaff={setStaff}
          budget={budget} setBudget={setBudget}
          style={style} setStyle={setStyle}
          projectType={projectType} setProjectType={setProjectType}
          reception={reception} setReception={setReception}
          breakout={breakout} setBreakout={setBreakout}
          executive={executive} setExecutive={setExecutive}
          meetingRooms={meetingRooms} setMeetingRooms={setMeetingRooms}
          floorPlanFile={floorPlanFile}
          setFloorPlanFile={setFloorPlanFile}
          dragging={dragging}
          setDragging={setDragging}
          fileRef={fileRef}
          handleFileDrop={handleFileDrop}
          handleSubmit={handleSubmit}
        />}
        {step === "loading" && <LoadingView />}
        {step === "result" && result && <ResultView result={result} name={name} company={company} sqm={sqm} staff={staff} />}
      </div>
    </Layout>
  );
}

function FormView(props: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  company: string; setCompany: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  city: string; setCity: (v: string) => void;
  sqm: string; setSqm: (v: string) => void;
  staff: string; setStaff: (v: string) => void;
  budget: string; setBudget: (v: string) => void;
  style: string; setStyle: (v: string) => void;
  projectType: string; setProjectType: (v: string) => void;
  reception: boolean; setReception: (v: boolean) => void;
  breakout: boolean; setBreakout: (v: boolean) => void;
  executive: boolean; setExecutive: (v: boolean) => void;
  meetingRooms: string; setMeetingRooms: (v: string) => void;
  floorPlanFile: File | null;
  setFloorPlanFile: (f: File | null) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  handleFileDrop: (e: React.DragEvent) => void;
  handleSubmit: (e: React.FormEvent) => void;
}) {
  const { toast } = useToast();
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)] rounded-full px-4 py-1.5 mb-5">
          <Sparkles className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
          <span className="text-[hsl(43,78%,65%)] text-xs font-semibold tracking-wider uppercase">AI Workspace Design Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3 leading-tight">
          Upload your floor plan.<br />
          <span className="text-[hsl(43,78%,52%)]">Get an instant office concept.</span>
        </h1>
        <p className="text-white/50 text-base max-w-lg mx-auto leading-relaxed">
          Our AI analyses your floor plan geometry and generates a complete workspace layout, furniture package, and budget estimate in under 60 seconds.
        </p>
      </div>

      {/* Value Props */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: LayoutDashboard, label: "Instant 2D concept" },
          { icon: Package, label: "Furniture package" },
          { icon: DollarSign, label: "Budget estimate" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-center">
            <Icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <span className="text-white/60 text-xs">{label}</span>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={props.handleSubmit} className="space-y-5">
        {/* Contact */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 space-y-4">
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Your Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Full Name <span className="text-[hsl(43,78%,52%)]">*</span></label>
              <input className={inp} placeholder="Jane Smith" value={props.name} onChange={e => props.setName(e.target.value)} required data-testid="input-design-name" />
            </div>
            <div>
              <label className={lbl}>Email <span className="text-[hsl(43,78%,52%)]">*</span></label>
              <input className={inp} type="email" placeholder="jane@company.com.au" value={props.email} onChange={e => props.setEmail(e.target.value)} required data-testid="input-design-email" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Company</label>
              <input className={inp} placeholder="Acme Group" value={props.company} onChange={e => props.setCompany(e.target.value)} data-testid="input-design-company" />
            </div>
            <div>
              <label className={lbl}>Phone <span className="text-white/30 text-xs">(optional)</span></label>
              <input className={inp} type="tel" placeholder="02 9000 0000" value={props.phone} onChange={e => props.setPhone(e.target.value)} data-testid="input-design-phone" />
            </div>
          </div>
          <div>
            <label className={lbl}>City / Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input className={inp + " pl-9"} placeholder="Sydney, Melbourne, Brisbane…" value={props.city} onChange={e => props.setCity(e.target.value)} data-testid="input-design-city" />
            </div>
          </div>
        </div>

        {/* Office Details */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 space-y-4">
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Office Details
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Office Size (m²) <span className="text-[hsl(43,78%,52%)]">*</span></label>
              <input className={inp} type="number" min="20" max="10000" placeholder="250" value={props.sqm} onChange={e => props.setSqm(e.target.value)} required data-testid="input-design-sqm" />
            </div>
            <div>
              <label className={lbl}>Staff Count <span className="text-[hsl(43,78%,52%)]">*</span></label>
              <input className={inp} type="number" min="1" max="2000" placeholder="30" value={props.staff} onChange={e => props.setStaff(e.target.value)} required data-testid="input-design-staff" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Project Type</label>
              <select className={inp} value={props.projectType} onChange={e => props.setProjectType(e.target.value)} data-testid="select-design-project-type">
                <option value="">Select…</option>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Meeting Rooms</label>
              <select className={inp} value={props.meetingRooms} onChange={e => props.setMeetingRooms(e.target.value)} data-testid="select-design-meeting-rooms">
                {["0", "1", "2", "3", "4", "5", "6+"].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Workspace Style</label>
            <select className={inp} value={props.style} onChange={e => props.setStyle(e.target.value)} data-testid="select-design-style">
              <option value="">Select style…</option>
              {STYLE_PREFS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Zone toggles */}
          <div>
            <label className={lbl}>Required Zones</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { label: "Reception", value: props.reception, set: props.setReception },
                { label: "Breakout", value: props.breakout, set: props.setBreakout },
                { label: "Executive Office", value: props.executive, set: props.setExecutive },
              ].map(({ label, value, set }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => set(!value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${value ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.4)] text-[hsl(43,78%,65%)]" : "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/60"}`}
                  data-testid={`toggle-zone-${label.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {value && <span className="mr-1">✓</span>}{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 space-y-3">
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Budget Range <span className="text-[hsl(43,78%,52%)]">*</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BUDGET_RANGES.map(b => (
              <button
                key={b}
                type="button"
                onClick={() => props.setBudget(b)}
                className={`text-xs px-3 py-2.5 rounded-xl border text-left transition-all ${props.budget === b ? "bg-[rgba(201,168,76,0.12)] border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)]" : "bg-white/[0.02] border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"}`}
                data-testid={`btn-budget-${b.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Floor Plan Upload */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 space-y-3">
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Floor Plan <span className="text-white/30 text-xs font-normal normal-case tracking-normal ml-1">(optional but strongly recommended)</span>
          </p>
          {!props.floorPlanFile ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${props.dragging ? "border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.05)]" : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(201,168,76,0.3)] hover:bg-[rgba(255,255,255,0.02)]"}`}
              onDragOver={e => { e.preventDefault(); props.setDragging(true); }}
              onDragLeave={() => props.setDragging(false)}
              onDrop={props.handleFileDrop}
              onClick={() => props.fileRef.current?.click()}
              data-testid="dropzone-floor-plan"
            >
              <Upload className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm font-medium mb-1">Drag & drop your floor plan here</p>
              <p className="text-white/30 text-xs">PNG, JPG, or PDF · Max 20MB</p>
              <p className="text-[hsl(43,78%,52%)] text-xs mt-3">or click to browse files</p>
              <input
                ref={props.fileRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) props.setFloorPlanFile(f);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{props.floorPlanFile.name}</p>
                  <p className="text-white/40 text-xs">{(props.floorPlanFile.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button type="button" onClick={() => props.setFloorPlanFile(null)} className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 ml-2" data-testid="button-remove-file">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-white/25 text-xs leading-relaxed">
            Uploading a floor plan allows our AI to trace the real boundary, detect internal walls, and generate a layout that fits your actual space — not just a generic template.
          </p>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold text-base min-h-[56px]"
          data-testid="button-design-engine-submit"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate My Workspace Concept
        </Button>
        <p className="text-center text-white/25 text-xs">Free · No credit card · Results in ~30 seconds</p>
      </form>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border border-[rgba(201,168,76,0.2)] flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[hsl(43,78%,52%)] animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full border border-[rgba(201,168,76,0.08)] animate-ping" />
      </div>
      <div>
        <h2 className="text-white font-serif font-bold text-xl mb-2">Analysing your workspace…</h2>
        <p className="text-white/40 text-sm max-w-xs leading-relaxed">Our AI is parsing your floor plan geometry, generating zone concepts, and calculating your furniture package.</p>
      </div>
      <div className="space-y-2 w-full max-w-xs">
        {[
          { label: "Parsing floor plan geometry", done: true },
          { label: "Generating workspace zones", done: true },
          { label: "Selecting furniture package", done: false },
          { label: "Calculating budget estimate", done: false },
        ].map(({ label, done }, i) => (
          <div key={i} className="flex items-center gap-2.5 text-xs text-left">
            {done
              ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
              : <Loader2 className="w-3.5 h-3.5 text-white/20 animate-spin flex-shrink-0" />}
            <span className={done ? "text-white/60" : "text-white/30"}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultView({ result, name, company, sqm, staff }: {
  result: EngineResult;
  name: string;
  company: string;
  sqm: string;
  staff: string;
}) {
  const { aiRec, geometry, planningRequestId } = result;
  const zones = aiRec.workspaceZones || [];
  const products = aiRec.productRecommendations || [];
  const cost = aiRec.costBreakdown;
  const hasRealGeometry = geometry && !geometry.fallback;

  const totalIncGst = cost ? Math.round(cost.total * 1.1) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-5">
      {/* Report Header */}
      <div className="bg-[hsl(220,22%,7%)] border border-[rgba(201,168,76,0.25)] rounded-2xl p-6" data-testid="design-engine-result-header">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold tracking-[0.2em] text-[hsl(43,78%,52%)] uppercase">The Corporate Desk</span>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-[10px] tracking-wider text-white/30 uppercase">AI Design Engine</span>
            </div>
            <h2 className="text-white font-serif font-bold text-xl leading-tight">
              Workspace Concept for {company || name}
            </h2>
            <p className="text-white/40 text-xs mt-1">{aiRec.officeType || "Office Concept"} · Generated {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          {aiRec.leadScore && (
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 ${aiRec.leadScore >= 70 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : aiRec.leadScore >= 40 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-white/40 border-white/10"}`}>
              Opportunity Score {aiRec.leadScore}/100
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
          {[
            { label: "Office Area", value: sqm ? `${sqm}m²` : "—" },
            { label: "Headcount", value: staff ? `${staff} staff` : "—" },
            { label: "Est. Investment", value: aiRec.estimatedProjectValue || "—" },
            { label: "Timeline", value: aiRec.implementationTimeline || "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-white font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Geometry Intelligence Badge */}
      <GeometryBadge geometry={geometry} />

      {/* Floor Plan Intelligence Note */}
      {hasRealGeometry && (
        <div className="flex items-start gap-3 bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.12)] rounded-xl px-4 py-3">
          <Zap className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
          <p className="text-white/60 text-xs leading-relaxed">
            Your floor plan geometry influenced this layout. Zone proportions and placement reflect the <strong className="text-white/80">{geometry.detectedShape || "detected shape"}</strong> of your actual space{(geometry.internalWalls?.length ?? 0) > 0 ? ` with ${geometry.internalWalls!.length} internal walls` : ""}.
          </p>
        </div>
      )}

      {/* §01 — Executive Summary */}
      {(aiRec.executiveSummary || aiRec.clientBrief) && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl p-6" data-testid="design-engine-summary">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§01</span>
            <FileText className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Workspace Overview</h3>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">{aiRec.executiveSummary || aiRec.clientBrief}</p>
        </div>
      )}

      {/* §02 — 2D Zone Plan */}
      {zones.length > 0 && zones.some(z => z.percentage > 0) && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl p-5" data-testid="design-engine-zone-plan">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§02</span>
            <LayoutDashboard className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">2D Workspace Layout</h3>
          </div>
          <WorkspaceLayout2D
            zones={zones}
            squareMetres={sqm}
            staffCount={staff}
            officeType={aiRec.officeType}
            isPaid={true}
          />
        </div>
      )}

      {/* §03 — Zone Analysis */}
      {zones.length > 0 && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6" data-testid="design-engine-zone-analysis">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§03</span>
            <Layers className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Zone Breakdown</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {zones.map((z, i) => (
              <div key={i} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: z.color || "#B8960C" }} />
                    <p className="text-white font-semibold text-sm truncate">{z.zone}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {z.percentage > 0 && <span className="text-white/30 text-xs">{z.percentage}%</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${z.priority === "Essential" ? "bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]" : z.priority === "Recommended" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-white/5 text-white/40 border-white/10"}`}>{z.priority}</span>
                  </div>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">{z.description}</p>
                {z.staffCapacity && z.staffCapacity > 0 && <p className="text-white/25 text-xs mt-1">Capacity: {z.staffCapacity} staff</p>}
                {z.keyFurniture && z.keyFurniture.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {z.keyFurniture.slice(0, 3).map((f, j) => (
                      <span key={j} className="text-[10px] text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* §04 — Furniture Highlights */}
      {products.length > 0 && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6" data-testid="design-engine-furniture">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§04</span>
              <Package className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Furniture Selection</h3>
            </div>
            <span className="text-white/30 text-xs">{products.length} items</span>
          </div>
          <div className="space-y-2">
            {products.map((p, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)] mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/80 font-medium text-sm leading-tight">{p.productName || p.category}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-white/40 text-xs">{p.category}</span>
                        {p.zone && <span className="text-[hsl(43,78%,45%)] text-xs bg-[rgba(201,168,76,0.08)] px-1.5 py-0.5 rounded-full border border-[rgba(201,168,76,0.12)]">{p.zone}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[hsl(43,78%,65%)] text-sm font-bold">
                        {p.totalCost > 0 ? `$${p.totalCost.toLocaleString("en-AU")}` : p.estimatedCost || "—"}
                      </p>
                      <p className="text-white/30 text-xs">Qty: {p.quantity}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cost summary */}
          {cost && (
            <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)] space-y-1.5" data-testid="design-engine-cost-summary">
              {[
                { label: "Furniture subtotal", value: cost.furniture },
                { label: "Installation", value: cost.installation },
                { label: "Delivery & logistics", value: cost.delivery },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-xs text-white/40">
                  <span>{row.label}</span>
                  <span>${row.value.toLocaleString("en-AU")}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs text-white/30 pt-1">
                <span>GST (10%)</span>
                <span>${Math.round(cost.total * 0.1).toLocaleString("en-AU")}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-[rgba(201,168,76,0.2)] pt-2 mt-1">
                <span className="text-white/80 text-sm">Total inc. GST</span>
                <span className="text-[hsl(43,78%,65%)] text-base">${totalIncGst?.toLocaleString("en-AU")}</span>
              </div>
              <p className="text-white/20 text-xs pt-1">Indicative estimate · subject to supplier pricing</p>
            </div>
          )}
        </div>
      )}

      {/* §05 — Style Direction */}
      {aiRec.styleDirection && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§05</span>
            <Star className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Style Direction</h3>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">{aiRec.styleDirection}</p>
        </div>
      )}

      {/* §06 — Key Considerations */}
      {aiRec.keyConsiderations && aiRec.keyConsiderations.length > 0 && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§06</span>
            <BarChart3 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Key Considerations</h3>
          </div>
          <ul className="space-y-2">
            {aiRec.keyConsiderations.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-white/60 text-sm">
                <ChevronRight className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* §07 — Workspace Strategy */}
      {zones.some(z => z.productivityNote) && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6" data-testid="design-engine-workspace-strategy">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§07</span>
            <Shield className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Workspace Strategy</h3>
          </div>
          <div className="space-y-3">
            {zones.filter(z => z.productivityNote).map((z, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: z.color || "#B8960C" }} />
                <div>
                  <p className="text-white/70 font-medium text-sm">{z.zone}</p>
                  <p className="text-white/45 text-xs leading-relaxed mt-0.5">{z.productivityNote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* §08 — Finance Overlay */}
      {cost && cost.total > 0 && (
        <FinanceOverlay totalCost={cost.total} />
      )}

      {/* CTAs */}
      <div className="bg-[hsl(220,22%,7%)] border border-[rgba(201,168,76,0.25)] rounded-2xl p-6 space-y-4" data-testid="design-engine-cta">
        <div className="text-center mb-2">
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-1">Your concept is ready</p>
          <h3 className="text-white font-serif font-bold text-lg">Take the next step</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Unlock Full Report */}
          <Link href="/upload-your-floor-plan">
            <div className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] transition-colors rounded-xl p-4 cursor-pointer" data-testid="cta-unlock-full-report">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-[hsl(220,20%,6%)]" />
                <span className="text-[hsl(220,20%,6%)] font-bold text-sm">Full Specification Report</span>
              </div>
              <p className="text-[hsl(220,20%,10%)] text-xs leading-relaxed">Detailed PDF report · Product BOQ · Finance options · 3D walkthrough access</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[hsl(220,20%,8%)] font-bold text-lg">$399 AUD</span>
                <ArrowRight className="w-4 h-4 text-[hsl(220,20%,8%)]" />
              </div>
            </div>
          </Link>

          {/* 3D Walkthrough */}
          {planningRequestId && (
            <a href={`/3d-office-walkthrough?id=${planningRequestId}`}>
              <div className="bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] transition-colors border border-[rgba(255,255,255,0.08)] rounded-xl p-4 cursor-pointer h-full" data-testid="cta-3d-walkthrough">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  <span className="text-white font-bold text-sm">3D Office Walkthrough</span>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">Explore your concept in an interactive 3D environment</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-white/40 text-xs">Open walkthrough</span>
                  <ArrowRight className="w-3 h-3 text-white/30" />
                </div>
              </div>
            </a>
          )}
        </div>

        {/* Contact CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
          <p className="text-white/40 text-xs text-center sm:text-left">
            Prefer to speak with our team? We review every submission personally.
          </p>
          <Link href="/contact">
            <button className="text-[hsl(43,78%,52%)] text-xs font-semibold underline underline-offset-2 whitespace-nowrap hover:text-[hsl(43,78%,65%)] transition-colors" data-testid="cta-contact">
              Contact us →
            </button>
          </Link>
        </div>
      </div>

      {/* Next Step Banner */}
      {aiRec.recommendedNextStep && (
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
          <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Recommended Next Step
          </p>
          <p className="text-white/70 text-sm">{aiRec.recommendedNextStep}</p>
          {aiRec.urgencyNote && <p className="text-amber-400/70 text-xs mt-2 italic">{aiRec.urgencyNote}</p>}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-center text-white/20 text-xs pb-6">
        This concept is generated by AI using your inputs and floor plan geometry. All costs are indicative estimates. Pricing subject to final specification, supplier confirmation, and site conditions.
      </p>
    </div>
  );
}
