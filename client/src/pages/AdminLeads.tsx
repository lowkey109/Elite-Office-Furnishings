import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Zap, Target, TrendingUp, Copy, Trash2, ChevronDown,
  ChevronRight, ArrowLeft, Building2, MapPin, Users, DollarSign,
  Mail, Globe, BarChart3, CheckCircle2, Loader2, Plus, ShieldCheck,
  Megaphone, LayoutDashboard, RefreshCw, Star, AlertCircle, Clock,
} from "lucide-react";

const ADMIN_PASSWORD = "tcd2024admin";

type LeadStatus = "New" | "Contacted" | "Responded" | "Qualified" | "Closed";

interface ProspectedLead {
  id: string;
  company: string;
  website: string | null;
  location: string;
  industry: string;
  estimatedTeamSize: string;
  signalsDetected: string[];
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  decisionMakers: string;
  outreachMessage: string;
  reasoning: string;
  rawInput: string;
  status: LeadStatus;
  createdAt: string;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; icon: any }> = {
  New: { label: "New", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Star },
  Contacted: { label: "Contacted", color: "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]", icon: Mail },
  Responded: { label: "Responded", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: RefreshCw },
  Qualified: { label: "Qualified", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  Closed: { label: "Closed", color: "bg-white/10 text-white/40 border-white/10", icon: AlertCircle },
};

const PRIORITY_COLOR: Record<string, string> = {
  High: "text-red-400 bg-red-500/10 border-red-500/20",
  Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Low: "text-white/50 bg-white/5 border-white/10",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 8) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  return "text-white/50";
};

const EXAMPLE_SIGNALS = `Example signals to paste here:

Company: NovaPay Financial
- Just announced $25M Series B funding round (TechCrunch, March 2026)
- Currently hiring 40+ staff in Brisbane including office manager and executive assistant
- LinkedIn shows team grew from 35 to 80 people in 6 months
- Moving out of River City Labs coworking to private offices in Fortitude Valley
- CEO mentioned "building a world-class Brisbane HQ" in press interview`;

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`h-3 w-2 rounded-sm transition-all ${
              i < score
                ? score >= 8 ? "bg-green-400" : score >= 5 ? "bg-yellow-400" : "bg-white/30"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <span className={`text-sm font-bold ${SCORE_COLOR(score)}`}>{score}/10</span>
    </div>
  );
}

export default function AdminLeads() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [signals, setSignals] = useState("");
  const [analysisResult, setAnalysisResult] = useState<ProspectedLead | null>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [showOutreach, setShowOutreach] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Lead Intelligence — Prospecting Engine | The Corporate Desk";
    if (sessionStorage.getItem("tcd_admin_auth") === "true") setAuthed(true);
  }, []);

  const { data: prospects = [], isLoading } = useQuery<ProspectedLead[]>({
    queryKey: ["/api/admin/prospects"],
    enabled: authed,
    refetchInterval: 30000,
  });

  const analyseMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await apiRequest("POST", "/api/admin/prospect", { signals: input });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.lead) {
        setAnalysisResult(data.lead);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
        toast({ title: "Lead analysed successfully", description: `${data.lead.company} scored ${data.lead.score}/10 — ${data.lead.priority} priority.` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Analysis failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const res = await apiRequest("PATCH", `/api/admin/prospects/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/prospects/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      toast({ title: "Lead removed from pipeline" });
    },
  });

  function handleLogin() {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied to clipboard" });
    });
  }

  const filteredProspects = prospects.filter(p => {
    if (filterPriority !== "All" && p.priority !== filterPriority) return false;
    if (filterStatus !== "All" && p.status !== filterStatus) return false;
    return true;
  });

  const highCount = prospects.filter(p => p.priority === "High").length;
  const newCount = prospects.filter(p => p.status === "New").length;
  const qualifiedCount = prospects.filter(p => p.status === "Qualified").length;
  const avgScore = prospects.length > 0 ? (prospects.reduce((s, p) => s + p.score, 0) / prospects.length).toFixed(1) : "—";

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-4">
              <span className="text-2xl font-serif font-bold text-white">THE CORPORATE</span>
              <span className="text-sm font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
            </div>
            <h1 className="text-xl font-semibold text-white">Lead Intelligence Engine</h1>
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
              data-testid="input-leads-password"
              className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-1 ${pwError ? "border-red-500/50" : "border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)]"}`}
              style={{ minHeight: "48px" }}
            />
            {pwError && <p className="text-red-400 text-xs mb-3">Incorrect password</p>}
            <Button onClick={handleLogin} className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] mt-3" data-testid="button-leads-login">
              <ShieldCheck className="w-4 h-4 mr-2" /> Access Engine
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
              <div className="flex flex-col cursor-pointer">
                <span className="text-base font-serif font-bold text-white leading-tight">THE CORPORATE</span>
                <span className="text-xs font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
              </div>
            </Link>
            <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <span className="text-white/60 text-sm font-medium">Lead Intelligence Engine</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[40px]" data-testid="button-leads-dashboard">
              <Link href="/admin/dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-white/50 hover:text-white min-h-[40px]" data-testid="button-leads-marketing">
              <Link href="/admin/marketing"><Megaphone className="w-4 h-4 mr-1.5" /> Marketing</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-white mb-1 flex items-center gap-3">
            <Target className="w-6 h-6 text-[hsl(43,78%,52%)]" />
            Lead Intelligence & Prospecting Engine
          </h1>
          <p className="text-white/40 text-sm">Paste company signals — AI analyses expansion indicators, scores the opportunity, and generates personalised outreach.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Prospects", value: prospects.length, icon: Target, color: "text-[hsl(43,78%,65%)]" },
            { label: "High Priority", value: highCount, icon: TrendingUp, color: "text-red-400" },
            { label: "New (Uncontacted)", value: newCount, icon: Star, color: "text-blue-400" },
            { label: "Avg Score", value: avgScore, icon: BarChart3, color: "text-green-400" },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/50 text-sm">{kpi.label}</p>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p className={`text-3xl font-serif font-bold ${kpi.color}`} data-testid={`stat-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8">
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[rgba(201,168,76,0.1)] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">Analyse Company Signals</h2>
                  <p className="text-white/40 text-xs">Paste news, LinkedIn data, hiring info, funding announcements</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-white/40 mb-2">Company signals / expansion indicators</label>
                <textarea
                  value={signals}
                  onChange={e => setSignals(e.target.value)}
                  placeholder={EXAMPLE_SIGNALS}
                  data-testid="textarea-signals"
                  rows={12}
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.15)] rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,168,76,0.4)] text-sm leading-relaxed resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => { setSignals(""); setAnalysisResult(null); }}
                  variant="outline"
                  className="border-[rgba(255,255,255,0.1)] text-white/50 min-h-[48px] px-4"
                  disabled={analyseMutation.isPending}
                  data-testid="button-clear-signals"
                >
                  Clear
                </Button>
                <Button
                  onClick={() => {
                    if (!signals.trim() || signals.trim().length < 10) return toast({ title: "Add company signals first", variant: "destructive" });
                    analyseMutation.mutate(signals);
                  }}
                  disabled={analyseMutation.isPending || !signals.trim()}
                  className="flex-1 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]"
                  data-testid="button-analyse"
                >
                  {analyseMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing...</>
                    : <><Zap className="w-4 h-4 mr-2" /> Analyse with AI</>
                  }
                </Button>
              </div>

              <div className="mt-4 p-3 bg-[rgba(255,255,255,0.02)] rounded-lg border border-[rgba(255,255,255,0.05)]">
                <p className="text-white/30 text-xs leading-relaxed">
                  <strong className="text-white/50">What to paste:</strong> News articles, LinkedIn posts, funding announcements, job ad descriptions, press releases, company blog posts, commercial real estate leasing news, or any text describing a company's growth.
                </p>
              </div>
            </div>

            {analysisResult && (
              <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-6" data-testid="analysis-result">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[hsl(43,78%,65%)] font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Analysis Complete
                  </h3>
                  <Badge className={`text-xs border ${PRIORITY_COLOR[analysisResult.priority]}`}>
                    {analysisResult.priority} Priority
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-white font-serif font-bold text-xl">{analysisResult.company}</p>
                    <p className="text-white/50 text-sm">{analysisResult.industry} · {analysisResult.location}</p>
                  </div>

                  <ScoreBar score={analysisResult.score} />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                      <p className="text-white/40 mb-1">Est. Team Size</p>
                      <p className="text-white font-medium">{analysisResult.estimatedTeamSize}</p>
                    </div>
                    <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                      <p className="text-white/40 mb-1">Project Value</p>
                      <p className="text-[hsl(43,78%,65%)] font-medium">{analysisResult.estimatedProjectValue}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-white/40 text-xs mb-2">Signals Detected</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.signalsDetected.map((s, i) => (
                        <span key={i} className="bg-[rgba(255,255,255,0.06)] text-white/60 text-xs px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.08)]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-white/40 text-xs mb-1">Reasoning</p>
                    <p className="text-white/60 text-xs leading-relaxed">{analysisResult.reasoning}</p>
                  </div>

                  <button
                    onClick={() => setShowOutreach(showOutreach === "new" ? null : "new")}
                    className="w-full text-left flex items-center justify-between py-2 text-sm text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,75%)] min-h-[44px]"
                    data-testid="button-toggle-outreach-new"
                  >
                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> View Outreach Message</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showOutreach === "new" ? "rotate-180" : ""}`} />
                  </button>
                  {showOutreach === "new" && (
                    <div className="relative">
                      <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-4 text-sm text-white/70 leading-relaxed whitespace-pre-wrap border border-[rgba(255,255,255,0.06)]">
                        {analysisResult.outreachMessage}
                      </div>
                      <button
                        onClick={() => copyText(analysisResult.outreachMessage, "new-outreach")}
                        className="absolute top-3 right-3 p-2 rounded-lg bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.2)] transition-all"
                        data-testid="button-copy-outreach-new"
                      >
                        {copiedId === "new-outreach" ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-3">
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Prospect Pipeline
                  <span className="text-white/30 font-normal text-sm">({filteredProspects.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={filterPriority}
                    onChange={e => setFilterPriority(e.target.value)}
                    data-testid="select-filter-priority"
                    className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.1)] text-white/60 text-xs rounded-lg px-3 py-2 focus:outline-none min-h-[36px]"
                  >
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    data-testid="select-filter-status"
                    className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.1)] text-white/60 text-xs rounded-lg px-3 py-2 focus:outline-none min-h-[36px]"
                  >
                    <option value="All">All Statuses</option>
                    {Object.keys(STATUS_CONFIG).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[rgba(255,255,255,0.03)] rounded-xl animate-pulse" />)}
                </div>
              ) : filteredProspects.length === 0 ? (
                <div className="text-center py-16">
                  <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/40 text-sm mb-2">No prospects in pipeline yet</p>
                  <p className="text-white/25 text-xs">Paste company signals on the left and click "Analyse with AI" to identify opportunities.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {filteredProspects.map(lead => {
                    const statusConf = STATUS_CONFIG[lead.status];
                    const StatusIcon = statusConf.icon;
                    return (
                      <div key={lead.id} data-testid={`prospect-card-${lead.id}`}>
                        <button
                          onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                          className="w-full text-left p-4 rounded-xl border border-[rgba(255,255,255,0.05)] hover:border-[rgba(201,168,76,0.15)] transition-all bg-[rgba(255,255,255,0.02)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.12)] flex items-center justify-center flex-shrink-0 text-[hsl(43,78%,52%)] font-bold text-sm">
                                {lead.company.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-white font-semibold text-sm truncate">{lead.company}</p>
                                <p className="text-white/40 text-xs mt-0.5 truncate">{lead.industry} · {lead.location}</p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <Badge className={`text-xs border ${PRIORITY_COLOR[lead.priority]}`}>{lead.priority}</Badge>
                                  <Badge className={`text-xs border ${statusConf.color}`}><StatusIcon className="w-2.5 h-2.5 mr-1" />{lead.status}</Badge>
                                  <span className={`text-xs font-bold ${SCORE_COLOR(lead.score)}`}>{lead.score}/10</span>
                                  <span className="text-xs text-[hsl(43,78%,65%)]">{lead.estimatedProjectValue}</span>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-white/30 flex-shrink-0 mt-1 transition-transform ${expandedLead === lead.id ? "rotate-90" : ""}`} />
                          </div>
                        </button>

                        {expandedLead === lead.id && (
                          <div className="mx-1 mb-1 bg-[rgba(201,168,76,0.03)] border border-[rgba(201,168,76,0.1)] border-t-0 rounded-b-xl p-5 space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { icon: Building2, label: "Industry", value: lead.industry },
                                { icon: MapPin, label: "Location", value: lead.location },
                                { icon: Users, label: "Team Size", value: lead.estimatedTeamSize },
                                { icon: DollarSign, label: "Est. Value", value: lead.estimatedProjectValue },
                                { icon: Mail, label: "Decision Makers", value: lead.decisionMakers },
                                ...(lead.website ? [{ icon: Globe, label: "Website", value: lead.website }] : []),
                              ].map(item => {
                                const Icon = item.icon;
                                return (
                                  <div key={item.label} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <Icon className="w-3 h-3 text-[hsl(43,78%,52%)]" />
                                      <p className="text-white/30 text-xs">{item.label}</p>
                                    </div>
                                    <p className="text-white/80 text-xs font-medium">{item.value}</p>
                                  </div>
                                );
                              })}
                            </div>

                            <div>
                              <p className="text-white/30 text-xs mb-2">Signals Detected</p>
                              <div className="flex flex-wrap gap-1.5">
                                {lead.signalsDetected.map((s, i) => (
                                  <span key={i} className="bg-[rgba(255,255,255,0.06)] text-white/60 text-xs px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.06)]">{s}</span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-white/30 text-xs mb-1">Lead Score</p>
                              <ScoreBar score={lead.score} />
                            </div>

                            <div>
                              <p className="text-white/30 text-xs mb-1">AI Reasoning</p>
                              <p className="text-white/60 text-xs leading-relaxed">{lead.reasoning}</p>
                            </div>

                            <div>
                              <button
                                onClick={() => setShowOutreach(showOutreach === lead.id ? null : lead.id)}
                                className="flex items-center gap-1.5 text-sm text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,75%)] min-h-[44px]"
                                data-testid={`button-toggle-outreach-${lead.id}`}
                              >
                                <Mail className="w-4 h-4" />
                                {showOutreach === lead.id ? "Hide outreach message" : "Show outreach message"}
                                <ChevronDown className={`w-4 h-4 transition-transform ${showOutreach === lead.id ? "rotate-180" : ""}`} />
                              </button>
                              {showOutreach === lead.id && (
                                <div className="relative mt-2">
                                  <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-4 text-xs text-white/70 leading-relaxed whitespace-pre-wrap border border-[rgba(255,255,255,0.06)] max-h-60 overflow-y-auto">
                                    {lead.outreachMessage}
                                  </div>
                                  <button
                                    onClick={() => copyText(lead.outreachMessage, `outreach-${lead.id}`)}
                                    className="absolute top-3 right-3 p-2 rounded-lg bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.2)] transition-all"
                                    data-testid={`button-copy-outreach-${lead.id}`}
                                  >
                                    {copiedId === `outreach-${lead.id}` ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white/40 text-xs mr-1">Status:</span>
                                {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => (
                                  <button
                                    key={s}
                                    data-testid={`button-status-${lead.id}-${s.toLowerCase()}`}
                                    onClick={() => statusMutation.mutate({ id: lead.id, status: s })}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[32px] ${
                                      lead.status === s
                                        ? STATUS_CONFIG[s].color + " opacity-100"
                                        : "border-[rgba(255,255,255,0.1)] text-white/40 hover:text-white/70"
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${lead.company} from pipeline?`)) {
                                    deleteMutation.mutate(lead.id);
                                    setExpandedLead(null);
                                  }
                                }}
                                className="p-2 text-white/30 hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                data-testid={`button-delete-prospect-${lead.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
            <Search className="w-4 h-4 text-[hsl(43,78%,52%)]" /> What to Look For — Signal Guide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Funding Signals", items: ["Series A/B/C announcements", "Seed funding rounds", "Private equity backing", "Government grants for expansion"] },
              { title: "Growth Signals", items: ["LinkedIn headcount increase", "Multiple job ads open", "New city/state expansion", "Moving from coworking"] },
              { title: "Real Estate Signals", items: ["Commercial lease signed", "New HQ announced", "Fitout permit applied", "Building completion news"] },
              { title: "Industry Targets", items: ["Tech & SaaS companies", "Law & financial firms", "Consulting & architecture", "Healthcare administration"] },
            ].map(section => (
              <div key={section.title}>
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">{section.title}</p>
                <ul className="space-y-1">
                  {section.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-white/40">
                      <ChevronRight className="w-3 h-3 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
