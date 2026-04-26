import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SpacePlanningEngine from "@/components/SpacePlanningEngine";
import WorkspaceLayout2D from "@/components/WorkspaceLayout2D";
import {
  Upload, CheckCircle2, Loader2, ArrowRight, ArrowLeft,
  Building2, Users, LayoutDashboard, Palette, FileText,
  MapPin, Phone, Mail, Star, Layers, Package, ChevronRight,
  Paperclip, X, DollarSign, Calendar, Zap, Lock, Sparkles, Monitor,
} from "lucide-react";

const STEPS = ["Contact", "Office Details", "Style & Budget", "Files & Submit"];

const PROJECT_TYPES = ["New Office", "Expansion", "Relocation", "Refurbishment", "Furniture Refresh"];
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
  "Minimal",
  "Corporate Prestige",
  "Warm Timber / Premium",
  "Mixed / Flexible",
];
const MEETING_ROOMS = ["0", "1", "2", "3", "4", "5", "6+"];

interface FileItem {
  field: string;
  label: string;
  file: File | null;
}

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

const inputClass = "w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-sm transition-colors";
const labelClass = "block text-sm text-white/60 mb-2";

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold transition-all flex-shrink-0 ${
              i < step
                ? "bg-[hsl(43,78%,52%)] border-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                : i === step
                ? "bg-[rgba(201,168,76,0.15)] border-[hsl(43,78%,52%)] text-[hsl(43,78%,65%)]"
                : "bg-transparent border-[rgba(255,255,255,0.1)] text-white/30"
            }`}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded transition-all ${i < step ? "bg-[hsl(43,78%,52%)]" : "bg-[rgba(255,255,255,0.08)]"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-[hsl(43,78%,65%)] text-sm font-medium">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>
    </div>
  );
}

export default function UploadFloorPlan() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiRec, setAiRec] = useState<AiRecommendation | null>(null);
  const [planningRequestId, setPlanningRequestId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"locked" | "verifying" | "paid">("paid");
  const [floorGeometry, setFloorGeometry] = useState<any | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Step 1: Contact
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  // Step 2: Office
  const [projectType, setProjectType] = useState("");
  const [squareMetres, setSquareMetres] = useState("");
  const [staffCount, setStaffCount] = useState("");
  const [meetingRooms, setMeetingRooms] = useState("1");
  const [receptionRequired, setReceptionRequired] = useState(false);
  const [breakoutRequired, setBreakoutRequired] = useState(false);
  const [executiveOfficeRequired, setExecutiveOfficeRequired] = useState(false);

  // Step 3: Style
  const [stylePreference, setStylePreference] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");

  // Step 4: Files
  const [files, setFiles] = useState<Record<string, File | null>>({
    floorPlan: null,
    floorPlanImage: null,
    inspirationImages: null,
    existingOfficePhotos: null,
  });

  const fileInputRefs = {
    floorPlan: useRef<HTMLInputElement>(null),
    floorPlanImage: useRef<HTMLInputElement>(null),
    inspirationImages: useRef<HTMLInputElement>(null),
    existingOfficePhotos: useRef<HTMLInputElement>(null),
  };

  const [draggingOver, setDraggingOver] = useState<string | null>(null);

  const fileFields: FileItem[] = [
    { field: "floorPlan", label: "Floor Plan (PDF)", file: files.floorPlan },
    { field: "floorPlanImage", label: "Floor Plan Image", file: files.floorPlanImage },
    { field: "inspirationImages", label: "Inspiration Images", file: files.inspirationImages },
    { field: "existingOfficePhotos", label: "Existing Office Photos", file: files.existingOfficePhotos },
  ];

  const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  const ACCEPTED_EXTS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  useEffect(() => {
    const stopBrowserDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("dragover", stopBrowserDefault);
    document.addEventListener("drop", stopBrowserDefault);
    return () => {
      document.removeEventListener("dragover", stopBrowserDefault);
      document.removeEventListener("drop", stopBrowserDefault);
    };
  }, []);

  function validateDroppedFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTS.includes(ext)) {
      return "Please upload a PDF, JPG, PNG, or WEBP floor plan up to 20MB.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File is too large. Maximum size is 20MB.";
    }
    return null;
  }

  function handleDragEnter(field: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(field);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(field: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDraggingOver(prev => prev === field ? null : prev);
  }

  function handleDrop(field: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const err = validateDroppedFile(file);
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setFiles(prev => ({ ...prev, [field]: file }));
  }

  function handleFileChange(field: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [field]: file }));
  }

  function removeFile(field: string) {
    setFiles(prev => ({ ...prev, [field]: null }));
    const ref = fileInputRefs[field as keyof typeof fileInputRefs];
    if (ref.current) ref.current.value = "";
  }

  function validateStep(): boolean {
    if (step === 0) {
      if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return false; }
      if (!email.trim() || !email.includes("@")) { toast({ title: "Valid email is required", variant: "destructive" }); return false; }
      if (!phone.trim()) { toast({ title: "Phone is required", variant: "destructive" }); return false; }
    }
    if (step === 1) {
      if (!projectType) { toast({ title: "Please select a project type", variant: "destructive" }); return false; }
    }
    if (step === 2) {
      if (!budgetRange) { toast({ title: "Please select a budget range", variant: "destructive" }); return false; }
    }
    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    setStep(s => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!validateStep()) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("company", company);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("city", city);
      formData.append("projectType", projectType);
      formData.append("squareMetres", squareMetres);
      formData.append("staffCount", staffCount);
      formData.append("meetingRooms", meetingRooms);
      formData.append("receptionRequired", String(receptionRequired));
      formData.append("breakoutRequired", String(breakoutRequired));
      formData.append("executiveOfficeRequired", String(executiveOfficeRequired));
      formData.append("budgetRange", budgetRange);
      formData.append("stylePreference", stylePreference);
      formData.append("specialRequirements", specialRequirements);

      if (files.floorPlan) formData.append("floorPlan", files.floorPlan);
      if (files.floorPlanImage) formData.append("floorPlanImage", files.floorPlanImage);
      if (files.inspirationImages) formData.append("inspirationImages", files.inspirationImages);
      if (files.existingOfficePhotos) formData.append("existingOfficePhotos", files.existingOfficePhotos);

      const res = await fetch("/api/planning-requests", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      if (data.aiRecommendations) {
        setAiRec(data.aiRecommendations);
      }
      if (data.floorGeometry) {
        setFloorGeometry(data.floorGeometry);
      }
      if (data.id) setPlanningRequestId(data.id);
      setPaymentStatus("locked");
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Please try again or call 1300 977 607.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function ToggleButton({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px] ${
          value
            ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.5)] text-[hsl(43,78%,65%)]"
            : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)] text-white/50 hover:border-[rgba(201,168,76,0.3)]"
        }`}
      >
        {value ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <div className="w-4 h-4 rounded-full border border-current flex-shrink-0" />}
        {label}
      </button>
    );
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const sessionId = params.get("session_id");
    const cancelled = params.get("cancelled");

    if (id && sessionId) {
      setPaymentStatus("verifying");
      fetch(`/api/planning-requests/${id}/verify-payment?session_id=${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.paid && data.planningRequest) {
            const pr = data.planningRequest;
            if (pr.aiRecommendations) setAiRec(pr.aiRecommendations);
            if (pr.squareMetres) setSquareMetres(pr.squareMetres);
            if (pr.staffCount) setStaffCount(pr.staffCount);
            if (pr.floorGeometryJson) {
              try { setFloorGeometry(JSON.parse(pr.floorGeometryJson)); } catch {}
            }
            setPlanningRequestId(id);
            setPaymentStatus("paid");
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
            window.history.replaceState({}, "", "/upload-your-floor-plan");
          } else {
            setPaymentStatus("locked");
            toast({ title: "Payment could not be verified.", description: "Please call 1300 977 607 if you believe this is an error.", variant: "destructive" });
          }
        })
        .catch(() => {
          setPaymentStatus("locked");
          toast({ title: "Connection error.", description: "Please try again.", variant: "destructive" });
        });
    } else if (id && cancelled === "true") {
      toast({ title: "Plan view cancelled.", description: "Your brief has been saved. Your free plan remains available.", variant: "default" });
      window.history.replaceState({}, "", "/upload-your-floor-plan");
    }
  }, []);

  async function handleUnlock() {
    setPaymentStatus("paid");
    setUnlocking(false);
    toast({
      title: "Free AI plan ready",
      description: "Your preliminary AI workspace plan is available now. No payment required.",
    });
  }

  async function handleContactUnlockRequest() {
    setContactSubmitting(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          email,
          phone,
          message: `Unlock request for planning report (ID: ${planningRequestId}). Estimated value: ${aiRec?.estimatedProjectValue || "not specified"}. Project type: ${projectType}. Size: ${squareMetres}sqm, ${staffCount} staff.`,
          type: "unlock-request",
        }),
      });
      setContactSubmitted(true);
    } catch {
      setContactSubmitted(true);
    } finally {
      setContactSubmitting(false);
    }
  }

  if (paymentStatus === "verifying") {
    return (
      <Layout>
        <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="animate-spin w-10 h-10 text-[hsl(43,78%,52%)] mx-auto mb-4" />
            <p className="text-white font-semibold text-lg">Verifying your payment…</p>
            <p className="text-white/40 text-sm mt-2">This only takes a moment.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (submitted) {
    return (
      <Layout>
        <div className="min-h-screen bg-[hsl(220,20%,6%)] pt-16 pb-24 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-[hsl(43,78%,52%)]" />
              </div>
              <h1 className="text-3xl font-serif font-bold text-white mb-2">Your Preliminary Workspace Recommendation</h1>
              <p className="text-white/50">Our AI has analysed your brief and prepared a preliminary fit-out direction using The Corporate Desk product range.</p>
            </div>

            {aiRec ? (
              <div className="space-y-5">
                {aiRec.clientBrief && (
                  <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                      <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Client Brief Summary</h3>
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">{aiRec.clientBrief}</p>
                    {aiRec.officeType && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-white/40 text-xs">Office Type:</span>
                        <span className="text-white/70 text-xs font-medium bg-[rgba(255,255,255,0.05)] px-2.5 py-1 rounded-full">{aiRec.officeType}</span>
                        {aiRec.estimatedProjectValue && (
                          <>
                            <span className="text-white/40 text-xs ml-2">Est. Value:</span>
                            <span className="text-[hsl(43,78%,65%)] text-xs font-bold">{aiRec.estimatedProjectValue}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {aiRec.workspaceZones && aiRec.workspaceZones.length > 0 && (
                  <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                        <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Zone Breakdown</h3>
                      </div>
                      <span className="text-white/40 text-xs">{aiRec.workspaceZones.length} zones identified</span>
                    </div>
                    <div className="flex h-5 rounded-lg overflow-hidden gap-0.5 mb-3">
                      {aiRec.workspaceZones.filter(z => z.percentage > 0).map((z, i) => (
                        <div key={i} style={{ width: `${z.percentage}%`, backgroundColor: z.color || "#B8960C" }} title={z.zone} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aiRec.workspaceZones.slice(0, 4).map((z, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: z.color || "#B8960C" }} />
                          {z.zone}
                        </span>
                      ))}
                      {aiRec.workspaceZones.length > 4 && (
                        <span className="text-xs text-white/30">+{aiRec.workspaceZones.length - 4} more in full report</span>
                      )}
                    </div>
                  </div>
                )}

                {false ? (
                  <div className="space-y-4">
                    {aiRec.workspaceZones && aiRec.workspaceZones.length > 0 && aiRec.workspaceZones.some(z => z.percentage > 0) && (
                      <WorkspaceLayout2D
                        zones={aiRec.workspaceZones}
                        squareMetres={squareMetres}
                        staffCount={staffCount}
                        officeType={aiRec.officeType}
                        isPaid={false}
                        onUnlockClick={handleUnlock}
                        unlocking={unlocking}
                      />
                    )}

                    {(aiRec.estimatedProjectValue || aiRec.implementationTimeline) && (
                      <div className="rounded-2xl overflow-hidden border border-[rgba(201,168,76,0.35)] bg-gradient-to-br from-[hsl(220,18%,11%)] to-[hsl(220,20%,8%)]">
                        <div className="px-5 py-3 border-b border-[rgba(201,168,76,0.15)] flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                          <span className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider">Project Intelligence</span>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {aiRec.estimatedProjectValue && (
                            <div className="sm:col-span-2">
                              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Estimated Project Value</p>
                              <p className="text-[hsl(43,78%,52%)] text-2xl sm:text-3xl font-bold font-serif leading-tight">{aiRec.estimatedProjectValue}</p>
                              <p className="text-white/35 text-xs mt-1.5">Based on {squareMetres}sqm · {staffCount} staff · {aiRec.officeType || projectType}</p>
                            </div>
                          )}
                          <div className="space-y-2.5">
                            {aiRec.implementationTimeline && (
                              <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.06)]">
                                <p className="text-white/35 text-xs mb-0.5">Timeline</p>
                                <p className="text-white/80 text-sm font-semibold">{aiRec.implementationTimeline}</p>
                              </div>
                            )}
                            {aiRec.workspaceZones && (
                              <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.06)]">
                                <p className="text-white/35 text-xs mb-0.5">Zones Planned</p>
                                <p className="text-white/80 text-sm font-semibold">{aiRec.workspaceZones.length} workspace zones</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="px-5 pb-4">
                          <p className="text-white/30 text-xs italic">Your full specification — including SKU-level furniture schedule, cost breakdown, and 2D layout — is ready to unlock.</p>
                        </div>
                      </div>
                    )}

                    <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.3)] rounded-2xl p-6 sm:p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-14 h-14 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] flex items-center justify-center mb-4">
                          <Lock className="w-6 h-6 text-[hsl(43,78%,52%)]" />
                        </div>
                        <p className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase mb-2">AI WORKSPACE CONCEPT READY</p>
                        <h3 className="text-white text-xl sm:text-2xl font-serif font-bold mb-2">Your full workspace specification is ready.</h3>
                        <p className="text-white/60 text-sm max-w-sm leading-relaxed">Unlock your personalised layout, furniture schedule, and cost estimate.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-7">
                        {[
                          { icon: LayoutDashboard, label: "Interactive 2D floor plan (PNG export)" },
                          { icon: Package, label: "Zone-by-zone furniture schedule" },
                          { icon: DollarSign, label: "Full cost estimate with GST breakdown" },
                          { icon: FileText, label: "Proposal-ready PDF report" },
                          { icon: Monitor, label: "3D walkthrough consultation access" },
                          { icon: Star, label: "Style direction & fit-out insights" },
                        ].map(({ icon: Icon, label }, i) => (
                          <div key={i} className="flex items-center gap-2.5 bg-[rgba(255,255,255,0.03)] rounded-xl px-3.5 py-2.5 border border-[rgba(255,255,255,0.06)]">
                            <Icon className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
                            <span className="text-xs text-white/70">{label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-center mb-5">
                        {aiRec.estimatedProjectValue && (
                          <p className="text-white/40 text-xs mb-3">
                            For a project estimated at{" "}
                            <span className="text-[hsl(43,78%,65%)] font-semibold">{aiRec.estimatedProjectValue}</span>
                            , this is less than 1% of your total investment.
                          </p>
                        )}
                        <div className="mb-1">
                          <span className="text-[hsl(43,78%,52%)] text-4xl font-bold">Free</span>
                          <span className="text-white/40 text-sm ml-1.5">AUD · one-time</span>
                        </div>
                        <p className="text-white/30 text-xs">Apple Pay · Google Pay · Card · Stripe Link · All major cards accepted</p>
                      </div>

                      <Button
                        onClick={handleUnlock}
                        disabled={unlocking}
                        className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[56px] text-base mb-3"
                        data-testid="button-unlock-report"
                      >
                        {unlocking
                          ? <><Loader2 className="animate-spin w-4 h-4 mr-2" />Processing…</>
                          : <><Sparkles className="w-4 h-4 mr-2" />View My Free AI Plan</>}
                      </Button>
                      <div className="flex flex-col items-center gap-1.5">
                        <p className="text-center text-white/30 text-xs">
                          Free AI plan · Questions?{" "}
                          <a href="tel:1300977607" className="text-[hsl(43,78%,52%)] underline">1300 977 607</a>
                        </p>
                        <button
                          onClick={() => setShowContactModal(true)}
                          className="text-white/25 text-xs hover:text-white/50 transition-colors underline"
                          data-testid="button-request-callback"
                        >
                          Prefer to speak with our team?
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ── PREMIUM REPORT HEADER ─────────────────────────────────────── */}
                    <div className="bg-[hsl(220,22%,7%)] border border-[rgba(201,168,76,0.25)] rounded-2xl p-6 mb-2" data-testid="section-report-header">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold tracking-[0.2em] text-[hsl(43,78%,52%)] uppercase">The Corporate Desk</span>
                            <span className="text-[rgba(201,168,76,0.3)] text-xs">·</span>
                            <span className="text-[10px] tracking-[0.15em] text-white/30 uppercase">Confidential</span>
                          </div>
                          <h2 className="text-white font-bold text-lg leading-tight mb-1">
                            {planningRequestId ? "AI Workspace Strategy Report" : "Workspace Strategy Report"}
                          </h2>
                          <p className="text-white/40 text-xs">Prepared for {company || "your organisation"} · {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {aiRec.leadScore && (
                            <div className={`text-xs font-bold px-3 py-1 rounded-full border ${
                              aiRec.leadScore >= 70
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : aiRec.leadScore >= 40
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-white/5 text-white/40 border-white/10"
                            }`}>
                              Lead Score {aiRec.leadScore}/100
                            </div>
                          )}
                          <span className="text-[10px] text-white/25 tracking-wider uppercase">{aiRec.officeType || "Office Project"}</span>
                        </div>
                      </div>
                      <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.05)] grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { label: "Office Area", value: squareMetres ? `${squareMetres}m²` : "—" },
                          { label: "Headcount", value: staffCount ? `${staffCount} staff` : "—" },
                          { label: "Est. Investment", value: aiRec.estimatedProjectValue || "—" },
                          { label: "Timeline", value: aiRec.implementationTimeline || "—" },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
                            <p className="text-white font-semibold text-sm">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {["§01 Summary", "§02 Floor Plan", "§03 Zone Analysis", "§04 Zone Breakdown", "§05 Furniture", "§06 Style", "§07 Finance", "§08 Next Steps"].map(s => (
                          <span key={s} className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded border border-white/5">{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* §01 — EXECUTIVE SUMMARY */}
                    {(aiRec.executiveSummary || aiRec.clientBrief) && (
                      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl p-6" data-testid="section-executive-summary">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§01</span>
                          <FileText className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                          <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Executive Summary</h3>
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed">{aiRec.executiveSummary || aiRec.clientBrief}</p>
                      </div>
                    )}

                    {aiRec.workspaceZones && aiRec.workspaceZones.length > 0 && aiRec.workspaceZones.some(z => z.percentage > 0) && (
                      <div className="space-y-5">
                        {/* §02 — FLOOR PLAN */}
                        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§02</span>
                            <LayoutDashboard className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">2D Workspace Layout Plan</h3>
                          </div>
                          <WorkspaceLayout2D
                            zones={aiRec.workspaceZones}
                            squareMetres={squareMetres}
                            staffCount={staffCount}
                            officeType={aiRec.officeType}
                            isPaid={true}
                          />
                        </div>
                        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§03</span>
                            <Layers className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Zone Analysis</h3>
                          </div>
                          <SpacePlanningEngine
                            zones={aiRec.workspaceZones}
                            recs={aiRec.productRecommendations}
                            sqm={squareMetres}
                            staffCount={staffCount}
                            costBreakdown={aiRec.costBreakdown}
                            estimatedValue={aiRec.estimatedProjectValue}
                            implementationTimeline={aiRec.implementationTimeline}
                            floorBoundary={floorGeometry}
                          />
                        </div>
                      </div>
                    )}

                    {aiRec.workspaceZones && aiRec.workspaceZones.length > 0 && (
                      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§04</span>
                          <Layers className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                          <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Recommended Workspace Zones</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {aiRec.workspaceZones.map((z, i) => (
                            <div key={i} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: z.color || "#B8960C" }} />
                                  <p className="text-white font-semibold text-sm truncate">{z.zone}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {z.percentage > 0 && <span className="text-white/30 text-xs">{z.percentage}%</span>}
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                    z.priority === "Essential" ? "bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]" :
                                    z.priority === "Recommended" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                    "bg-white/5 text-white/40 border-white/10"
                                  }`}>{z.priority}</span>
                                </div>
                              </div>
                              <p className="text-white/50 text-xs leading-relaxed">{z.description}</p>
                              {z.productivityNote && (
                                <p className="text-[hsl(43,78%,45%)] text-xs mt-2 leading-relaxed italic border-t border-[rgba(255,255,255,0.04)] pt-2">
                                  ↑ {z.productivityNote}
                                </p>
                              )}
                              {z.staffCapacity && z.staffCapacity > 0 && (
                                <p className="text-white/25 text-xs mt-1">Capacity: {z.staffCapacity} staff</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiRec.productRecommendations && aiRec.productRecommendations.length > 0 && (
                      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§05</span>
                            <Package className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                            <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Furniture Schedule</h3>
                          </div>
                          <span className="text-white/30 text-xs">{aiRec.productRecommendations.length} line items</span>
                        </div>
                        <div className="space-y-2.5">
                          {aiRec.productRecommendations.map((p, i) => (
                            <div key={i} className="rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
                              <div className="flex items-start gap-3 p-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)] mt-2 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <div className="min-w-0">
                                      <p className="text-white font-semibold text-sm leading-tight">{p.productName || p.category}</p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-white/40 text-xs">{p.category}</span>
                                        {p.seriesRecommendation && <span className="text-white/25 text-xs">· {p.seriesRecommendation}</span>}
                                        {p.zone && <span className="text-[hsl(43,78%,45%)] text-xs bg-[rgba(201,168,76,0.08)] px-1.5 py-0.5 rounded-full border border-[rgba(201,168,76,0.12)]">{p.zone}</span>}
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-[hsl(43,78%,65%)] text-sm font-bold">
                                        {p.totalCost > 0 ? `$${p.totalCost.toLocaleString("en-AU")}` : p.estimatedCost || "—"}
                                      </p>
                                      <p className="text-white/30 text-xs">
                                        {p.unitCost > 0 && p.quantity > 1 ? `$${p.unitCost.toLocaleString("en-AU")} × ${p.quantity}` : `Qty: ${p.quantity}`}
                                      </p>
                                    </div>
                                  </div>
                                  {p.rationale && <p className="text-white/45 text-xs leading-relaxed mt-1">{p.rationale}</p>}
                                  {p.sku && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-white/20 text-xs font-mono bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded border border-[rgba(255,255,255,0.06)]">
                                        SKU: {p.sku}
                                      </span>
                                      <Link href={`/products/${p.sku}`}>
                                        <span className="text-[hsl(43,78%,55%)] text-xs hover:text-[hsl(43,78%,70%)] cursor-pointer underline-offset-2 hover:underline transition-colors" data-testid={`link-product-rec-${i}`}>
                                          View Product →
                                        </span>
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {aiRec.costBreakdown && (
                          <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)] space-y-2">
                            <div className="flex justify-between text-xs text-white/40">
                              <span>Furniture subtotal</span>
                              <span>${aiRec.costBreakdown.furniture.toLocaleString("en-AU")}</span>
                            </div>
                            {aiRec.costBreakdown.installation > 0 && (
                              <div className="flex justify-between text-xs text-white/40">
                                <span>Installation & delivery</span>
                                <span>${(aiRec.costBreakdown.installation + (aiRec.costBreakdown.delivery || 0)).toLocaleString("en-AU")}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs text-white/40">
                              <span>GST (10%)</span>
                              <span>${Math.round(aiRec.costBreakdown.total * 0.1).toLocaleString("en-AU")}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold border-t border-[rgba(201,168,76,0.2)] pt-2 mt-1">
                              <span className="text-white/80">Total inc. GST</span>
                              <span className="text-[hsl(43,78%,65%)]">${Math.round(aiRec.costBreakdown.total * 1.1).toLocaleString("en-AU")}</span>
                            </div>
                            {aiRec.costBreakdown.perStaff && (
                              <p className="text-white/25 text-xs text-right">${aiRec.costBreakdown.perStaff.toLocaleString("en-AU")} per staff member (ex GST)</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* §06 — STYLE DIRECTION */}
                    {aiRec.styleDirection && (
                      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§06</span>
                          <Palette className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                          <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Style Direction & Key Considerations</h3>
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed mb-4">{aiRec.styleDirection}</p>
                        {aiRec.keyConsiderations && aiRec.keyConsiderations.length > 0 && (
                          <ul className="space-y-2 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                            {aiRec.keyConsiderations.map((c, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-white/65">
                                <ChevronRight className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* §07 — FINANCE OPTIONS */}
                    {aiRec.estimatedProjectValue && (
                      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6" data-testid="section-finance-options">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§07</span>
                          <DollarSign className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                          <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Finance Options</h3>
                        </div>
                        <p className="text-white/55 text-sm leading-relaxed mb-4">
                          For an investment of <span className="text-white font-semibold">{aiRec.estimatedProjectValue}</span>, The Corporate Desk offers three commercial finance pathways — allowing you to preserve cash flow and equip your workspace now.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            {
                              lender: "Stratton Finance",
                              type: "Equipment Finance",
                              note: "Preserve cash flow. Fixed repayments, 24–60 month terms. Our default partner for most office fit-outs.",
                              contact: "Katherine & Chris",
                              highlight: true,
                            },
                            {
                              lender: "QPF Finance",
                              type: "Commercial Lease",
                              note: "Ideal for projects $200k+. Full-service commercial leasing with competitive rates.",
                              contact: "Katelyn",
                              highlight: false,
                            },
                            {
                              lender: "Vestone Capital",
                              type: "Equipment Leasing",
                              note: "Structured as a true operating lease — suits companies with equipment-heavy fit-outs.",
                              contact: "Cassie",
                              highlight: false,
                            },
                          ].map((f) => (
                            <div
                              key={f.lender}
                              className={`rounded-xl p-4 border ${f.highlight
                                ? "bg-[rgba(201,168,76,0.06)] border-[rgba(201,168,76,0.2)]"
                                : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)]"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-white font-semibold text-sm">{f.lender}</p>
                                {f.highlight && <span className="text-[10px] text-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.12)] px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.2)]">Recommended</span>}
                              </div>
                              <p className="text-[hsl(43,78%,55%)] text-xs mb-2">{f.type}</p>
                              <p className="text-white/45 text-xs leading-relaxed mb-2">{f.note}</p>
                              <p className="text-white/25 text-xs">Contact: {f.contact}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-white/25 text-xs mt-4">Finance enquiries can be arranged by your Corporate Desk consultant. Subject to lender approval. Not financial advice.</p>
                      </div>
                    )}

                    {/* §08 — NEXT STEPS */}
                    {(aiRec.recommendedNextStep || aiRec.urgencyNote) && (
                      <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold text-[hsl(43,78%,40%)] tracking-widest">§08</span>
                          <ChevronRight className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                          <p className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">Recommended Next Steps</p>
                        </div>
                        {aiRec.recommendedNextStep && (
                          <p className="text-white/70 text-sm leading-relaxed">{aiRec.recommendedNextStep}</p>
                        )}
                        {aiRec.urgencyNote && (
                          <p className="text-white/50 text-xs mt-3 italic">{aiRec.urgencyNote}</p>
                        )}
                      </div>
                    )}

                    <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-2xl overflow-hidden" data-testid="section-3d-walkthrough">
                      <div className="p-6">
                        <div className="flex items-center gap-2.5 mb-4">
                          <Monitor className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                          <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm uppercase tracking-wider">3D Walkthrough Access</h3>
                          <span className="text-xs bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)]">Unlocked</span>
                        </div>
                        <p className="text-white/65 text-sm leading-relaxed mb-5">
                          Your report includes access to a live 3D walkthrough consultation session. Our design team will walk you through your AI-generated layout in a screen-share session — navigating each zone, reviewing furniture placement, and refining the concept before you commit to any procurement.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-xs">
                          {[
                            { label: "45-min live consultation", sub: "via Zoom or Teams" },
                            { label: "Zone-by-zone walkthrough", sub: "with your brief overlaid" },
                            { label: "Revision notes included", sub: "sent post-session" },
                          ].map((item, i) => (
                            <div key={i} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 border border-[rgba(255,255,255,0.06)]">
                              <p className="text-white/80 font-semibold mb-0.5">{item.label}</p>
                              <p className="text-white/35">{item.sub}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Link href={`/3d-office-walkthrough?id=${planningRequestId}`}>
                            <Button className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] px-6" data-testid="button-view-3d-walkthrough">
                              View 3D Walkthrough <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </Link>
                          <Link href="/contact">
                            <Button variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] min-h-[48px] px-6" data-testid="button-book-3d-walkthrough">
                              Book Consultation <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-[hsl(43,78%,52%)] mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Brief received successfully</p>
                <p className="text-white/50 text-sm">Our team will review your submission and prepare a personalised recommendation within 1 business day.</p>
              </div>
            )}

            <div className="mt-8 p-6 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl">
              <p className="text-white/50 text-xs mb-4 text-center">This is a preliminary AI-assisted concept. A senior workplace consultant can refine this into a full fit-out proposal.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link href="/send-us-your-quote">
                  <Button className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]" data-testid="button-request-quote">
                    Request Full Quote <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/workplace-strategy">
                  <Button variant="outline" className="w-full border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[48px]" data-testid="button-book-call">
                    Book Strategy Call
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="ghost" className="w-full text-white/50 hover:text-white min-h-[48px]" data-testid="button-speak-specialist">
                    Speak to a Specialist
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={showContactModal} onOpenChange={(open) => { setShowContactModal(open); if (!open) setContactSubmitted(false); }}>
          <DialogContent className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.25)] text-white max-w-md">
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center mb-3">
                <Phone className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              </div>
              <DialogTitle className="text-white font-serif text-xl">Speak with Our Team</DialogTitle>
              <p className="text-white/50 text-sm leading-relaxed mt-1">
                Our consultants will personally walk you through your workspace concept and send you the full layout report — no card required.
              </p>
            </DialogHeader>

            {contactSubmitted ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-[hsl(43,78%,52%)] mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Request received</p>
                <p className="text-white/50 text-sm">A consultant will contact you within 1 business day to discuss your workspace concept.</p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {aiRec?.estimatedProjectValue && (
                  <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl p-3.5 flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    <div>
                      <p className="text-white/40 text-xs">Your estimated project value</p>
                      <p className="text-[hsl(43,78%,65%)] font-bold text-sm">{aiRec.estimatedProjectValue}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <a href="tel:1300977607" className="flex items-center gap-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl p-3.5 hover:bg-[rgba(255,255,255,0.07)] transition-colors">
                    <Phone className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    <div>
                      <p className="text-white/40 text-xs">Call us now</p>
                      <p className="text-white font-semibold text-sm">1300 977 607</p>
                    </div>
                  </a>
                  <a href="mailto:service@thecorporatedesk.com.au" className="flex items-center gap-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl p-3.5 hover:bg-[rgba(255,255,255,0.07)] transition-colors">
                    <Mail className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    <div>
                      <p className="text-white/40 text-xs">Email us</p>
                      <p className="text-white font-semibold text-sm truncate">service@...</p>
                    </div>
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[rgba(255,255,255,0.08)]" /></div>
                  <div className="relative flex justify-center"><span className="bg-[hsl(220,18%,10%)] px-3 text-white/30 text-xs">or request a callback</span></div>
                </div>
                <Button
                  onClick={handleContactUnlockRequest}
                  disabled={contactSubmitting}
                  className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]"
                  data-testid="button-submit-callback"
                >
                  {contactSubmitting
                    ? <><Loader2 className="animate-spin w-4 h-4 mr-2" />Sending…</>
                    : <>Request Callback for {name || "My Project"}</>}
                </Button>
                <p className="text-white/25 text-xs text-center">We'll use your brief details to prepare before we call.</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[hsl(220,20%,6%)]">
        <section className="pt-16 pb-8 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-full mb-5">
              <Zap className="w-3 h-3 text-[hsl(43,78%,52%)]" />
              <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase">AI-Assisted Space Planning</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
              Upload Your Floor Plan or Office Brief
            </h1>
            <p className="text-white/55 text-base leading-relaxed mb-2">
              Get an AI-Assisted Preliminary Workspace Recommendation Using The Corporate Desk Product Range
            </p>
            <p className="text-white/35 text-sm">
              Submit your brief and receive a tailored fit-out concept, product direction, and workspace zones — before speaking with a specialist.
            </p>
          </div>
        </section>

        <div className="max-w-2xl mx-auto px-4 pb-24">
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.12)] rounded-2xl p-6 sm:p-8">
            <ProgressBar step={step} />

            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-white font-semibold text-lg flex items-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-[hsl(43,78%,52%)]" /> Contact Details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Full Name <span className="text-[hsl(43,78%,52%)]">*</span></label>
                    <input data-testid="input-name" className={inputClass} placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} style={{ fontSize: "16px" }} />
                  </div>
                  <div>
                    <label className={labelClass}>Company</label>
                    <input data-testid="input-company" className={inputClass} placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} style={{ fontSize: "16px" }} />
                  </div>
                  <div>
                    <label className={labelClass}>Email <span className="text-[hsl(43,78%,52%)]">*</span></label>
                    <input data-testid="input-email" type="email" autoComplete="email" className={inputClass} placeholder="jane@company.com" value={email} onChange={e => setEmail(e.target.value)} style={{ fontSize: "16px" }} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone <span className="text-[hsl(43,78%,52%)]">*</span></label>
                    <input data-testid="input-phone" type="tel" autoComplete="tel" className={inputClass} placeholder="0400 000 000" value={phone} onChange={e => setPhone(e.target.value)} style={{ fontSize: "16px" }} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>City / Location</label>
                    <input data-testid="input-city" className={inputClass} placeholder="e.g. Brisbane, Sydney, Melbourne" value={city} onChange={e => setCity(e.target.value)} style={{ fontSize: "16px" }} />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-white font-semibold text-lg flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-[hsl(43,78%,52%)]" /> Office Requirements
                </h2>

                <div>
                  <label className={labelClass}>Project Type <span className="text-[hsl(43,78%,52%)]">*</span></label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROJECT_TYPES.map(t => (
                      <button
                        key={t}
                        type="button"
                        data-testid={`select-project-type-${t.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => setProjectType(t)}
                        className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px] ${
                          projectType === t
                            ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.5)] text-[hsl(43,78%,65%)]"
                            : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Office Size (sqm)</label>
                    <input data-testid="input-square-metres" className={inputClass} placeholder="e.g. 350" value={squareMetres} onChange={e => setSquareMetres(e.target.value)} style={{ fontSize: "16px" }} />
                  </div>
                  <div>
                    <label className={labelClass}>Staff Count</label>
                    <input data-testid="input-staff-count" className={inputClass} placeholder="e.g. 25" value={staffCount} onChange={e => setStaffCount(e.target.value)} style={{ fontSize: "16px" }} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Meeting Rooms Needed</label>
                  <div className="flex gap-2 flex-wrap">
                    {MEETING_ROOMS.map(m => (
                      <button
                        key={m}
                        type="button"
                        data-testid={`select-meeting-rooms-${m}`}
                        onClick={() => setMeetingRooms(m)}
                        className={`w-12 h-10 rounded-lg border text-sm font-medium transition-all ${
                          meetingRooms === m
                            ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.5)] text-[hsl(43,78%,65%)]"
                            : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Spaces Required</label>
                  <div className="flex flex-wrap gap-2">
                    <ToggleButton label="Reception Area" value={receptionRequired} onChange={setReceptionRequired} />
                    <ToggleButton label="Breakout Area" value={breakoutRequired} onChange={setBreakoutRequired} />
                    <ToggleButton label="Executive Office" value={executiveOfficeRequired} onChange={setExecutiveOfficeRequired} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-white font-semibold text-lg flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-[hsl(43,78%,52%)]" /> Style & Budget
                </h2>

                <div>
                  <label className={labelClass}>Style Preference</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STYLE_PREFS.map(s => (
                      <button
                        key={s}
                        type="button"
                        data-testid={`select-style-${s.toLowerCase().replace(/[\s/]+/g, "-")}`}
                        onClick={() => setStylePreference(s)}
                        className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px] text-left ${
                          stylePreference === s
                            ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.5)] text-[hsl(43,78%,65%)]"
                            : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Budget Range <span className="text-[hsl(43,78%,52%)]">*</span></label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BUDGET_RANGES.map(b => (
                      <button
                        key={b}
                        type="button"
                        data-testid={`select-budget-${b.toLowerCase().replace(/[\s$,–+]+/g, "-")}`}
                        onClick={() => setBudgetRange(b)}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all min-h-[44px] ${
                          budgetRange === b
                            ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.5)] text-[hsl(43,78%,65%)]"
                            : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Special Requirements</label>
                  <textarea
                    data-testid="textarea-special-requirements"
                    className={`${inputClass} min-h-[120px] resize-none leading-relaxed`}
                    placeholder="Acoustics, storage, brand colours, visitor seating, boardroom requirements, timeline notes..."
                    value={specialRequirements}
                    onChange={e => setSpecialRequirements(e.target.value)}
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-white font-semibold text-lg flex items-center gap-2 mb-1">
                  <Upload className="w-5 h-5 text-[hsl(43,78%,52%)]" /> Upload Files (Optional)
                </h2>
                <p className="text-white/40 text-sm mb-4">Attach floor plans, inspiration images, or photos of your current space. Accepts PDF, PNG, JPG, JPEG, WEBP — up to 20MB each.</p>

                <div className="space-y-3">
                  {fileFields.map(({ field, label, file }) => (
                    <div key={field}>
                      <label className={labelClass}>{label}</label>
                      {file ? (
                        <div className="flex items-center gap-3 px-4 py-3 bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.3)] rounded-xl">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                          <span className="text-sm text-[hsl(43,78%,65%)] truncate flex-1">{file.name}</span>
                          <span className="text-white/30 text-xs">{(file.size / 1024).toFixed(0)}KB</span>
                          <button type="button" onClick={() => removeFile(field)} className="text-white/40 hover:text-white/70 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label
                          data-testid={`input-file-${field}`}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                            draggingOver === field
                              ? "bg-[rgba(201,168,76,0.12)] border-[hsl(43,78%,52%)] scale-[1.01] shadow-[0_0_0_2px_rgba(201,168,76,0.25)]"
                              : "bg-[rgba(255,255,255,0.03)] border-[rgba(201,168,76,0.15)] hover:border-[rgba(201,168,76,0.4)]"
                          }`}
                          onDragEnter={e => handleDragEnter(field, e)}
                          onDragOver={handleDragOver}
                          onDragLeave={e => handleDragLeave(field, e)}
                          onDrop={e => handleDrop(field, e)}
                        >
                          <Paperclip className={`w-4 h-4 flex-shrink-0 transition-colors ${draggingOver === field ? "text-[hsl(43,78%,52%)]" : "text-white/40"}`} />
                          <span className={`text-sm transition-colors ${draggingOver === field ? "text-[hsl(43,78%,65%)]" : "text-white/40"}`}>
                            {draggingOver === field ? "Drop to attach" : `Drag & drop or click to attach ${label}`}
                          </span>
                          <input
                            ref={fileInputRefs[field as keyof typeof fileInputRefs]}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            className="sr-only"
                            onChange={e => handleFileChange(field, e)}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.1)] rounded-xl mt-2">
                  <p className="text-white/45 text-xs leading-relaxed">
                    <strong className="text-white/60">What happens next:</strong> Our AI will analyse your brief and generate a preliminary workspace recommendation using The Corporate Desk product range. A senior workplace consultant will follow up to refine this into a full fit-out proposal.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              {step > 0 && (
                <Button
                  type="button"
                  onClick={prevStep}
                  variant="outline"
                  className="border-[rgba(255,255,255,0.15)] text-white/60 min-h-[52px] px-5"
                  data-testid="button-prev-step"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="flex-1 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] text-base"
                  data-testid="button-next-step"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] text-base"
                  data-testid="button-submit"
                >
                  {submitting
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating AI Recommendation...</>
                    : <><Zap className="w-5 h-5 mr-2" /> Get My Workspace Recommendation</>
                  }
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            {[
              { icon: CheckCircle2, text: "AI-powered concept in minutes" },
              { icon: Users, text: "Senior consultant follow-up" },
              { icon: Star, text: "6-year warranty on all furniture" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="text-center">
                <Icon className="w-4 h-4 text-[hsl(43,78%,52%)] mx-auto mb-1.5" />
                <p className="text-white/40 text-xs leading-tight">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
