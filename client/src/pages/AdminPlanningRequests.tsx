import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, LayoutDashboard, Target, Megaphone, Upload,
  ChevronDown, ChevronRight, Building2, MapPin, Mail, Phone,
  Loader2, Trash2, RefreshCw, Package, FileText, Palette,
  Star, DollarSign, Users, Layers, CheckCircle2, Calendar,
  ExternalLink, Paperclip,
} from "lucide-react";

const ADMIN_PASSWORD = "tcd2024admin";

type PlanningStatus = "New" | "In Review" | "Quoted" | "Converted" | "Archived";

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

interface AiRec {
  clientBrief?: string;
  officeType?: string;
  estimatedProjectValue?: string;
  workspaceZones?: { zone: string; description: string; priority: string }[];
  productRecommendations?: { category: string; seriesRecommendation: string; quantity: string; rationale: string; estimatedCost: string }[];
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
  status: string;
  adminNotes?: string;
  createdAt?: string;
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

export default function AdminPlanningRequests() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAi, setShowAi] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Planning Requests — Space Planner | The Corporate Desk";
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

  const filtered = requests.filter(r => filterStatus === "All" || r.status === filterStatus);
  const totalCount = requests.length;
  const newCount = requests.filter(r => r.status === "New").length;
  const todayCount = requests.filter(r => isToday(r.createdAt)).length;
  const weekCount = requests.filter(r => isThisWeek(r.createdAt)).length;

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
              <span className="text-white/60 text-sm font-medium">Planning Requests</span>
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
            Floor Plan & Space Planning Requests
          </h1>
          <p className="text-white/40 text-sm">AI-analysed office fit-out planning submissions from the public upload form.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Requests", value: totalCount, color: "text-[hsl(43,78%,65%)]" },
            { label: "New (Unreviewed)", value: newCount, color: "text-blue-400" },
            { label: "Today", value: todayCount, color: "text-green-400" },
            { label: "This Week", value: weekCount, color: "text-purple-400" },
          ].map(stat => (
            <div key={stat.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
              <p className="text-white/50 text-sm mb-2">{stat.label}</p>
              <p className={`text-3xl font-serif font-bold ${stat.color}`} data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Submissions
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

                return (
                  <div key={req.id} data-testid={`planning-card-${req.id}`} className="border border-[rgba(255,255,255,0.05)] rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="w-full text-left p-4 hover:bg-[rgba(255,255,255,0.02)] transition-all"
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
                              {req.budgetRange && <span className="text-[hsl(43,78%,65%)] text-xs font-medium">{req.budgetRange}</span>}
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
                      <div className="border-t border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] p-5 space-y-5">
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

                        {req.aiSummary && (
                          <div>
                            <button
                              onClick={() => setShowAi(showAi === req.id ? null : req.id)}
                              className="flex items-center gap-2 text-[hsl(43,78%,65%)] text-sm hover:text-[hsl(43,78%,75%)] transition-colors min-h-[36px]"
                              data-testid={`button-toggle-ai-${req.id}`}
                            >
                              <Star className="w-4 h-4" />
                              {showAi === req.id ? "Hide AI Recommendation" : "View AI Recommendation"}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAi === req.id ? "rotate-180" : ""}`} />
                            </button>

                            {showAi === req.id && aiRec && (
                              <div className="mt-3 bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.12)] rounded-xl p-5 space-y-4">
                                {aiRec.clientBrief && (
                                  <div>
                                    <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-1.5">Client Brief</p>
                                    <p className="text-white/70 text-sm leading-relaxed">{aiRec.clientBrief}</p>
                                    {aiRec.estimatedProjectValue && (
                                      <p className="text-[hsl(43,78%,65%)] text-sm font-bold mt-2">Est. Value: {aiRec.estimatedProjectValue}</p>
                                    )}
                                  </div>
                                )}
                                {aiRec.workspaceZones && aiRec.workspaceZones.length > 0 && (
                                  <div>
                                    <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Workspace Zones</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {aiRec.workspaceZones.map((z, i) => (
                                        <div key={i} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-white text-xs font-semibold">{z.zone}</span>
                                            <span className="text-white/40 text-xs">{z.priority}</span>
                                          </div>
                                          <p className="text-white/50 text-xs leading-relaxed">{z.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {aiRec.productRecommendations && aiRec.productRecommendations.length > 0 && (
                                  <div>
                                    <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Product Recommendations</p>
                                    <div className="space-y-2">
                                      {aiRec.productRecommendations.map((p, i) => (
                                        <div key={i} className="flex items-start gap-3 text-xs">
                                          <span className="text-[hsl(43,78%,52%)] mt-0.5">•</span>
                                          <div>
                                            <span className="text-white font-medium">{p.category}</span>
                                            <span className="text-white/40 mx-1">·</span>
                                            <span className="text-white/50">{p.seriesRecommendation}</span>
                                            <span className="text-white/40 mx-1">·</span>
                                            <span className="text-[hsl(43,78%,65%)]">{p.estimatedCost}</span>
                                            <p className="text-white/40 mt-0.5">{p.rationale}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {aiRec.styleDirection && (
                                  <div>
                                    <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-1.5">Style Direction</p>
                                    <p className="text-white/65 text-sm leading-relaxed">{aiRec.styleDirection}</p>
                                  </div>
                                )}
                                {aiRec.recommendedNextStep && (
                                  <div className="pt-3 border-t border-[rgba(255,255,255,0.06)]">
                                    <p className="text-[hsl(43,78%,65%)] text-xs font-semibold mb-1">Recommended Next Step</p>
                                    <p className="text-white/60 text-sm">{aiRec.recommendedNextStep}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {showAi === req.id && !aiRec && req.aiSummary && (
                              <div className="mt-3 bg-[rgba(255,255,255,0.03)] rounded-xl p-4">
                                <p className="text-white/60 text-sm">{req.aiSummary}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
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
