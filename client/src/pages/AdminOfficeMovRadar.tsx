import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Radar, ArrowLeft, Plus, Search, RefreshCw, TrendingUp,
  Building2, MapPin, Zap, AlertCircle, CheckCircle,
  ExternalLink, ArrowRight, Trash2, Mail, Target, BarChart3, Eye,
  Radio, Crosshair, Activity, Sparkles, X, Linkedin, Newspaper, Briefcase,
  Brain, DollarSign, Layers,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function useAdminAuth() {
  return sessionStorage.getItem("tcd_admin_auth") === "true" ||
    localStorage.getItem("tcd_admin_auth") === "true";
}

const SIGNAL_TYPES = [
  { value: "office_move", label: "Office Move" },
  { value: "new_lease", label: "New Lease" },
  { value: "office_expansion", label: "Office Expansion" },
  { value: "new_office_opening", label: "New Office Opening" },
  { value: "startup_expansion", label: "Startup Expansion" },
  { value: "refurbishment", label: "Refurbishment" },
  { value: "hiring_surge", label: "Hiring Surge" },
  { value: "hiring_spike", label: "Hiring Spike" },
  { value: "funding_growth", label: "Funding / Growth" },
  { value: "funding", label: "Funding Round" },
  { value: "workplace_role", label: "Workplace Role" },
  { value: "growth_news", label: "Growth News" },
  { value: "territory_alert", label: "Territory Alert" },
  { value: "tenant_move_in", label: "Tenant Move In" },
  { value: "tenant_move_out", label: "Tenant Move Out" },
  { value: "lease_expiry", label: "Lease Expiry" },
  { value: "manual", label: "Manual Entry" },
];

const SIGNAL_COLORS: Record<string, string> = {
  office_move: "bg-red-500/20 text-red-300 border-red-500/30",
  new_lease: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  office_expansion: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  new_office_opening: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  startup_expansion: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  refurbishment: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  hiring_surge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  hiring_spike: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
  funding_growth: "bg-green-500/20 text-green-300 border-green-500/30",
  funding: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  workplace_role: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  growth_news: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  territory_alert: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  tenant_move_in: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  tenant_move_out: "bg-zinc-500/20 text-zinc-300 border-zinc-600/30",
  lease_expiry: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  manual: "bg-zinc-600/30 text-zinc-400 border-zinc-600/40",
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-500/20 text-red-300 border-red-500/30",
  Medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Low: "bg-zinc-600/30 text-zinc-400 border-zinc-600/40",
};

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500/20 text-blue-300",
  Reviewing: "bg-amber-500/20 text-amber-300",
  "Outreach Sent": "bg-purple-500/20 text-purple-300",
  "In Pipeline": "bg-emerald-500/20 text-emerald-300",
  Dismissed: "bg-zinc-600/30 text-zinc-400",
};

const CITIES = [
  "Brisbane", "Sydney", "Melbourne", "Perth", "Adelaide",
  "Gold Coast", "Canberra", "Newcastle", "Wollongong", "Hobart",
  "Darwin", "Sunshine Coast", "Geelong", "Townsville", "Cairns",
];
const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["New", "Reviewing", "Outreach Sent", "In Pipeline", "Dismissed"];

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  linkedin: {
    label: "LinkedIn",
    color: "bg-blue-600/20 text-blue-300 border-blue-600/30",
    icon: <Linkedin className="w-2.5 h-2.5" />,
  },
  news_rss: {
    label: "News Feed",
    color: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    icon: <Newspaper className="w-2.5 h-2.5" />,
  },
  job_signal: {
    label: "Job Signal",
    color: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    icon: <Briefcase className="w-2.5 h-2.5" />,
  },
  predictive: {
    label: "Predictive",
    color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    icon: <Brain className="w-2.5 h-2.5" />,
  },
  ai_generated: {
    label: "AI Scan",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    icon: <Sparkles className="w-2.5 h-2.5" />,
  },
  manual: {
    label: "Manual",
    color: "bg-zinc-600/30 text-zinc-400 border-zinc-600/40",
    icon: <Plus className="w-2.5 h-2.5" />,
  },
};

interface RadarRecord {
  id: string;
  companyName: string;
  industry: string | null;
  city: string;
  state: string | null;
  signalType: string;
  signalSubtype: string | null;
  signalSource: string | null;
  sourceUrl: string | null;
  dateDetected: string;
  confidenceLevel: string;
  estimatedHeadcount: string | null;
  estimatedOfficeSizeSqm: string | null;
  estimatedProjectValue: string | null;
  radarScore: number;
  priority: string;
  recommendedOutreachAngle: string | null;
  recommendedOffer: string | null;
  recommendedNextAction: string | null;
  outreachSubject: string | null;
  outreachEmailDraft: string | null;
  outreachFollowUp: string | null;
  outreachCta: string | null;
  linkedProspectId: string | null;
  status: string;
  notes: string | null;
  sourceType: string | null;
  verificationStatus: string | null;
  evidenceExcerpt: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  high: number;
  medium: number;
  low: number;
  newCount: number;
  inPipeline: number;
  avgScore: number;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-red-500" : score >= 50 ? "bg-amber-500" : "bg-zinc-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-300 w-6 text-right">{score}</span>
    </div>
  );
}

function SourceBadge({ sourceType }: { sourceType: string | null }) {
  if (!sourceType || sourceType === "manual") return null;
  const cfg = SOURCE_TYPE_CONFIG[sourceType];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function LinkedInIntakeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    postUrl: "",
    postText: "",
    companyName: "",
    city: "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/admin/office-move-radar/linkedin-intake", data),
    onSuccess: (data: any) => {
      toast({
        title: "Signal created from LinkedIn",
        description: `${data.record?.companyName ?? "Record"} added with radar score ${data.record?.radarScore ?? "—"}.`,
      });
      onSaved();
      onClose();
    },
    onError: (err: any) =>
      toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2">
              <Linkedin className="w-5 h-5 text-blue-400" />
              LinkedIn Signal Intake
            </h2>
            <p className="text-zinc-500 text-xs mt-0.5">Paste a real LinkedIn post URL and text — GPT will classify and score it</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-zinc-400 text-xs font-medium block mb-1.5">LinkedIn Post URL *</label>
            <input
              data-testid="input-linkedin-url"
              value={form.postUrl}
              onChange={e => setForm(f => ({ ...f, postUrl: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
              placeholder="https://www.linkedin.com/posts/..."
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs font-medium block mb-1.5">Post Text (paste full text) *</label>
            <textarea
              data-testid="input-linkedin-text"
              value={form.postText}
              onChange={e => setForm(f => ({ ...f, postText: e.target.value }))}
              rows={6}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-none"
              placeholder="Paste the full LinkedIn post text here..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Company Name (optional hint)</label>
              <input
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                placeholder="e.g. Atlassian"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">City (optional hint)</label>
              <select
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="">Auto-detect</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
            GPT will extract: company name · city · signal type · confidence · evidence excerpt.
            Only real office signals from named companies will be saved.
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="button-linkedin-submit"
              onClick={() => mutation.mutate(form)}
              disabled={!form.postUrl || !form.postText || mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
              {mutation.isPending ? "Analysing..." : "Import Signal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddRecordModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    companyName: "", industry: "", city: "Brisbane", state: "",
    signalType: "office_move", signalSubtype: "", signalSource: "",
    sourceUrl: "", confidenceLevel: "medium", estimatedHeadcount: "30–60",
    notes: "", status: "New",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/admin/office-move-radar", data),
    onSuccess: () => {
      toast({ title: "Radar record created", description: `${form.companyName} added to Office Move Radar.` });
      onSaved();
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Add Radar Signal</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Company Name *</label>
              <input
                data-testid="input-company-name"
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="e.g. Accenture Australia"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Industry</label>
              <input
                value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="e.g. Consulting"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">City *</label>
              <select
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Signal Type *</label>
              <select
                value={form.signalType}
                onChange={e => setForm(f => ({ ...f, signalType: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                {SIGNAL_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Confidence</label>
              <select
                value={form.confidenceLevel}
                onChange={e => setForm(f => ({ ...f, confidenceLevel: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Est. Headcount</label>
              <select
                value={form.estimatedHeadcount}
                onChange={e => setForm(f => ({ ...f, estimatedHeadcount: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              >
                {["5–15", "15–30", "30–60", "60–120", "120–250", "250+"].map(h => (
                  <option key={h} value={h}>{h} staff</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Signal Source</label>
              <input
                value={form.signalSource}
                onChange={e => setForm(f => ({ ...f, signalSource: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="e.g. LinkedIn, AFR"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Source URL</label>
              <input
                value={form.sourceUrl}
                onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="https://..."
              />
            </div>
            <div className="col-span-2">
              <label className="text-zinc-400 text-xs font-medium block mb-1.5">Signal Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none"
                placeholder="Describe the signal detected..."
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="button-save-radar"
              onClick={() => mutation.mutate(form)}
              disabled={!form.companyName || !form.city || mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Saving..." : "Add Signal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordDetailPanel({
  record,
  onClose,
  onRefresh,
}: {
  record: RadarRecord;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const pushMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/office-move-radar/${record.id}/push-to-pipeline`, {}),
    onSuccess: () => {
      toast({ title: "Pushed to pipeline", description: `${record.companyName} is now a prospected lead.` });
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const outreachMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/office-move-radar/${record.id}/generate-outreach`, {}),
    onSuccess: () => {
      toast({ title: "Outreach draft generated", description: "Email draft is ready below." });
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/admin/office-move-radar/${record.id}`, { status }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/office-move-radar/${record.id}`),
    onSuccess: () => {
      toast({ title: "Record deleted" });
      onClose();
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-800 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[record.priority] ?? ""}`}>
                {record.priority} Priority
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[record.status] ?? "bg-zinc-700 text-zinc-300"}`}>
                {record.status}
              </span>
            </div>
            <h2 className="text-white font-bold text-xl">{record.companyName}</h2>
            <p className="text-zinc-400 text-sm mt-0.5">{record.city}{record.industry ? ` · ${record.industry}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white mt-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <p className="text-zinc-500 text-xs mb-1">Radar Score</p>
              <p className="text-2xl font-bold text-white mb-2">{record.radarScore}<span className="text-zinc-500 text-sm font-normal">/100</span></p>
              <ScoreBar score={record.radarScore} />
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <p className="text-zinc-500 text-xs mb-1">Estimated Project</p>
              <p className="text-lg font-bold text-amber-400">{record.estimatedProjectValue ?? "Unknown"}</p>
              <p className="text-zinc-500 text-xs mt-1">{record.estimatedOfficeSizeSqm ?? "—"}</p>
            </div>
          </div>

          <div className="bg-zinc-800/30 rounded-xl p-4 space-y-2.5">
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${SIGNAL_COLORS[record.signalType] ?? "bg-zinc-700 text-zinc-300"}`}>
                {SIGNAL_TYPES.find(s => s.value === record.signalType)?.label ?? record.signalType}
              </span>
              <span className="text-xs text-zinc-500">{record.confidenceLevel} confidence</span>
              <SourceBadge sourceType={record.sourceType} />
              {record.verificationStatus === "source_post" && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />Verified from source
                </span>
              )}
            </div>
            {record.evidenceExcerpt && (
              <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2">
                <p className="text-zinc-500 text-xs mb-0.5">Evidence excerpt</p>
                <p className="text-xs text-zinc-300 italic">"{record.evidenceExcerpt}"</p>
              </div>
            )}
            {record.notes && !record.evidenceExcerpt && <p className="text-sm text-zinc-300">{record.notes}</p>}
            {record.signalSource && (
              <p className="text-xs text-zinc-500">
                Source: {record.signalSource}
                {record.sourceUrl && (
                  <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-amber-400 hover:text-amber-300">
                    <ExternalLink className="w-3 h-3 inline" /> View original
                  </a>
                )}
              </p>
            )}
          </div>

          {record.recommendedOutreachAngle && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />OUTREACH ANGLE
              </p>
              <p className="text-sm text-zinc-200">{record.recommendedOutreachAngle}</p>
              {record.recommendedOffer && (
                <p className="text-xs text-zinc-400 mt-1.5">Offer: {record.recommendedOffer}</p>
              )}
            </div>
          )}

          {record.recommendedNextAction && (
            <div className="bg-zinc-800/30 rounded-xl p-4">
              <p className="text-zinc-500 text-xs font-semibold mb-1">NEXT ACTION</p>
              <p className="text-sm text-zinc-300">{record.recommendedNextAction}</p>
            </div>
          )}

          {record.outreachEmailDraft && (
            <div className="space-y-3">
              <p className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />OUTREACH DRAFT
              </p>
              {record.outreachSubject && (
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                  <p className="text-zinc-500 text-xs mb-0.5">Subject</p>
                  <p className="text-sm text-white">{record.outreachSubject}</p>
                </div>
              )}
              <div className="bg-zinc-800/50 rounded-lg px-3 py-3">
                <p className="text-zinc-500 text-xs mb-1">First email</p>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{record.outreachEmailDraft}</p>
              </div>
              {record.outreachFollowUp && (
                <div className="bg-zinc-800/30 rounded-lg px-3 py-3">
                  <p className="text-zinc-500 text-xs mb-1">Follow-up (Day 5)</p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{record.outreachFollowUp}</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-zinc-500 text-xs font-semibold">UPDATE STATUS</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending || record.status === s}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    record.status === s
                      ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-zinc-800">
            {!record.outreachEmailDraft && (
              <button
                data-testid="button-generate-outreach"
                onClick={() => outreachMutation.mutate()}
                disabled={outreachMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-sm font-medium transition-colors"
              >
                {outreachMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Outreach
              </button>
            )}
            {!record.linkedProspectId && record.status !== "Dismissed" && (
              <button
                data-testid="button-push-pipeline"
                onClick={() => pushMutation.mutate()}
                disabled={pushMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-colors"
              >
                {pushMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Push to Pipeline
              </button>
            )}
            {record.linkedProspectId && (
              <Link href="/admin/deal-pipeline">
                <a className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />In Pipeline
                </a>
              </Link>
            )}
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="ml-auto flex items-center gap-2 px-3 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOfficeMovRadar() {
  const isAuth = useAdminAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterSignal, setFilterSignal] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState<"radarScore" | "estimatedProjectValue" | "dateDetected">("radarScore");
  const [showAdd, setShowAdd] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RadarRecord | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanningNews, setScanningNews] = useState(false);
  const [scanningJobs, setScanningJobs] = useState(false);
  const [scanningPredictive, setScanningPredictive] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);

  const { data: records = [], isLoading, refetch } = useQuery<RadarRecord[]>({
    queryKey: ["/api/admin/office-move-radar", filterCity, filterSignal, filterPriority, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterCity) params.set("city", filterCity);
      if (filterSignal) params.set("signalType", filterSignal);
      if (filterPriority) params.set("priority", filterPriority);
      if (filterStatus) params.set("status", filterStatus);
      return fetch(`/api/admin/office-move-radar?${params}`).then(r => r.json());
    },
    enabled: isAuth,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/admin/office-move-radar/stats"],
    enabled: isAuth,
    refetchInterval: 30000,
  });

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/office-move-radar/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      });
      const data = await res.json();
      if (data.saved !== undefined) {
        toast({ title: "AI radar scan complete", description: `${data.saved} new opportunities detected.` });
        refetch();
        qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
      } else {
        toast({ title: "Scan error", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Scan failed", description: "Could not connect to scanner", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleScanNews = async () => {
    setScanningNews(true);
    try {
      const res = await fetch("/api/admin/office-move-radar/scan-news", { method: "POST" });
      const data = await res.json();
      if (data.saved !== undefined) {
        toast({ title: "News feed scan complete", description: `${data.saved} new signals from ${data.processed} articles.` });
        refetch();
        qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
      } else {
        toast({ title: "News scan error", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "News scan failed", description: "Could not reach news feed scanner", variant: "destructive" });
    } finally {
      setScanningNews(false);
    }
  };

  const handleScanJobs = async () => {
    setScanningJobs(true);
    try {
      const res = await fetch("/api/admin/office-move-radar/scan-jobs", { method: "POST" });
      const data = await res.json();
      if (data.saved !== undefined) {
        toast({ title: "Job signal scan complete", description: `${data.saved} new signals from ${data.processed} articles.` });
        refetch();
        qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
      } else {
        toast({ title: "Job scan error", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Job scan failed", description: "Could not reach job signal scanner", variant: "destructive" });
    } finally {
      setScanningJobs(false);
    }
  };

  const handleScanPredictive = async () => {
    setScanningPredictive(true);
    try {
      const res = await fetch("/api/admin/office-move-radar/scan-predictive", { method: "POST" });
      const data = await res.json();
      if (data.saved !== undefined) {
        toast({ title: "Predictive scan complete", description: `${data.saved} new signals from ${data.processed} articles — funding, hiring spikes, startup expansion.` });
        refetch();
        qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
      } else {
        toast({ title: "Predictive scan error", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Predictive scan failed", description: "Could not reach predictive scanner", variant: "destructive" });
    } finally {
      setScanningPredictive(false);
    }
  };

  const handleScanAll = async () => {
    setScanningAll(true);
    try {
      const res = await fetch("/api/admin/office-move-radar/scan-all", { method: "POST" });
      const data = await res.json();
      if (data.saved !== undefined) {
        const { breakdown } = data;
        const detail = breakdown
          ? `News: ${breakdown.news} · Jobs: ${breakdown.jobs} · Predictive: ${breakdown.predictive}`
          : `${data.processed} articles processed`;
        toast({ title: `Full scan: ${data.saved} new signals`, description: detail });
        refetch();
        qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
      } else {
        toast({ title: "Full scan error", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Full scan failed", description: "Could not reach radar scanners", variant: "destructive" });
    } finally {
      setScanningAll(false);
    }
  };

  const filtered = records
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.companyName.toLowerCase().includes(q)
        || (r.industry ?? "").toLowerCase().includes(q)
        || r.city.toLowerCase().includes(q)
        || (r.notes ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "radarScore") return b.radarScore - a.radarScore;
      if (sortBy === "dateDetected") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "estimatedProjectValue") {
        const parse = (v: string | null) => {
          if (!v) return 0;
          const m = v.replace(/,/g, "").match(/\$?([\d]+)/);
          return m ? parseInt(m[1]) : 0;
        };
        return parse(b.estimatedProjectValue) - parse(a.estimatedProjectValue);
      }
      return 0;
    });

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Admin authentication required.</p>
          <Link href="/admin/dashboard"><a className="text-amber-400 hover:text-amber-300 text-sm">Go to dashboard</a></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {showAdd && (
        <AddRecordModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            refetch();
            qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
          }}
        />
      )}
      {showLinkedIn && (
        <LinkedInIntakeModal
          onClose={() => setShowLinkedIn(false)}
          onSaved={() => {
            refetch();
            qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
          }}
        />
      )}
      {selectedRecord && (
        <RecordDetailPanel
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onRefresh={() => {
            refetch();
            qc.invalidateQueries({ queryKey: ["/api/admin/office-move-radar/stats"] });
            setSelectedRecord(null);
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin/dashboard">
            <a className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </a>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Radio className="w-6 h-6 text-amber-400" />
              Office Move Radar
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Detect companies relocating, expanding, or fitting out — before they shop elsewhere</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              data-testid="button-scan-news"
              onClick={handleScanNews}
              disabled={scanningNews}
              title="Scan Google News RSS for real office move signals"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium transition-colors"
            >
              {scanningNews ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Newspaper className="w-3.5 h-3.5" />}
              {scanningNews ? "Scanning..." : "News Feed"}
            </button>
            <button
              data-testid="button-scan-jobs"
              onClick={handleScanJobs}
              disabled={scanningJobs}
              title="Scan job postings for hiring/facilities signals"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-xs font-medium transition-colors"
            >
              {scanningJobs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
              {scanningJobs ? "Scanning..." : "Job Signals"}
            </button>
            <button
              data-testid="button-linkedin-intake"
              onClick={() => setShowLinkedIn(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-medium transition-colors"
            >
              <Linkedin className="w-3.5 h-3.5" />LinkedIn
            </button>
            <button
              data-testid="button-scan-predictive"
              onClick={handleScanPredictive}
              disabled={scanningPredictive}
              title="Scan for predictive signals: funding rounds, hiring spikes, startup expansion"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors"
            >
              {scanningPredictive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {scanningPredictive ? "Scanning..." : "Predictive"}
            </button>
            <button
              data-testid="button-scan-all"
              onClick={handleScanAll}
              disabled={scanningAll}
              title="Run all three scanners: news, jobs, and predictive signals"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
            >
              {scanningAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              {scanningAll ? "Scanning..." : "Scan All"}
            </button>
            <button
              data-testid="button-scan-radar"
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
              {scanning ? "Scanning..." : "AI Scan"}
            </button>
            <button
              data-testid="button-add-radar"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />Add Signal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[
            { label: "Total Signals", value: stats?.total ?? 0, icon: <Radio className="w-4 h-4 text-amber-400" />, color: "text-white" },
            { label: "High Priority", value: stats?.high ?? 0, icon: <AlertCircle className="w-4 h-4 text-red-400" />, color: "text-red-400" },
            { label: "Medium", value: stats?.medium ?? 0, icon: <Activity className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
            { label: "Low", value: stats?.low ?? 0, icon: <BarChart3 className="w-4 h-4 text-zinc-400" />, color: "text-zinc-400" },
            { label: "New / Unreviewed", value: stats?.newCount ?? 0, icon: <Zap className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
            { label: "In Pipeline", value: stats?.inPipeline ?? 0, icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
            { label: "Avg Score", value: stats?.avgScore ?? 0, icon: <Target className="w-4 h-4 text-purple-400" />, color: "text-purple-400" },
          ].map((kpi, i) => (
            <div key={i} className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">{kpi.icon}<span className="text-zinc-500 text-xs">{kpi.label}</span></div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800/50 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                data-testid="input-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search companies, cities, notes..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <select
              data-testid="filter-city"
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Cities</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              data-testid="filter-signal"
              value={filterSignal}
              onChange={e => setFilterSignal(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Signals</option>
              {SIGNAL_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              data-testid="filter-priority"
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              data-testid="filter-status"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="radarScore">Sort: Score</option>
              <option value="estimatedProjectValue">Sort: Project Value</option>
              <option value="dateDetected">Sort: Newest</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Radio className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-sm font-medium mb-2">No radar signals yet</p>
              <p className="text-zinc-600 text-xs mb-6">Run a scan or add a signal manually to get started</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  {scanning ? "Scanning..." : "Run AI Scan"}
                </button>
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />Add Manually
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {filtered.map(record => (
                <div
                  key={record.id}
                  data-testid={`row-radar-${record.id}`}
                  className="p-4 hover:bg-zinc-800/20 transition-colors cursor-pointer group"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-white text-sm">{record.companyName}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[record.priority] ?? ""}`}>
                          {record.priority}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${SIGNAL_COLORS[record.signalType] ?? "bg-zinc-700 text-zinc-300"}`}>
                          {SIGNAL_TYPES.find(s => s.value === record.signalType)?.label ?? record.signalType}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[record.status] ?? "bg-zinc-700 text-zinc-300"}`}>
                          {record.status}
                        </span>
                        <SourceBadge sourceType={record.sourceType} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{record.city}</span>
                        {record.industry && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{record.industry}</span>}
                        {record.estimatedHeadcount && <span>{record.estimatedHeadcount} staff</span>}
                        {record.signalSource && <span>via {record.signalSource}</span>}
                      </div>
                      {record.notes && (
                        <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">{record.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 min-w-36">
                      <div className="text-right">
                        <p className="text-amber-400 font-semibold text-sm">{record.estimatedProjectValue ?? "Unknown"}</p>
                        <p className="text-zinc-500 text-xs">{record.estimatedOfficeSizeSqm ?? "—"}</p>
                      </div>
                      <div className="w-28">
                        <ScoreBar score={record.radarScore} />
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="p-3 border-t border-zinc-800/50 text-center text-xs text-zinc-500">
              {filtered.length} signal{filtered.length !== 1 ? "s" : ""} · click any row for full detail and actions
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
