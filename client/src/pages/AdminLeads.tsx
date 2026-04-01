
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Zap,
  Target,
  TrendingUp,
  Copy,
  Trash2,
  ChevronDown,
  Building2,
  Users,
  DollarSign,
  Mail,
  Globe,
  BarChart3,
  CheckCircle2,
  Loader2,
  LayoutDashboard,
  RefreshCw,
  Star,
  AlertCircle,
  Clock,
  Briefcase,
  Linkedin,
  FileText,
  Newspaper,
  Layers,
  Play,
  SkipForward,
  X,
  Plus,
  AlertTriangle,
  XCircle,
} from "lucide-react";

type LeadStatus =
  | "New"
  | "Contacted"
  | "Responded"
  | "Qualified"
  | "Closed"
  | "Lead Detected"
  | "Planning"
  | "Quoted"
  | "Negotiation"
  | "Won"
  | "Lost";

type SourceType =
  | "manual"
  | "job_ad"
  | "linkedin"
  | "hiring_page"
  | "announcement"
  | "article"
  | "website";

interface ProspectedLead {
  id: string;
  company: string;
  domain: string | null;
  website: string | null;
  location: string;
  industry: string;
  estimatedTeamSize: string;
  likelyOfficeNeed: string | null;
  signalsDetected: string[];
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  decisionMakers: string;
  outreachMessage: string;
  reasoning: string;
  rawInput: string;
  status: LeadStatus;
  sourceType: string | null;
  sourceUrl: string | null;
  createdAt: string;
}

interface AuthCheckResponse {
  authenticated: boolean;
}

interface ProspectAnalyseResponse {
  lead?: ProspectedLead;
  message?: string;
  existingLead?: ProspectedLead;
  error?: string;
}

interface BatchScanResponse {
  results?: Array<{
    status: "saved" | "duplicate" | "error";
    lead?: ProspectedLead;
    existingLead?: ProspectedLead;
    error?: string;
  }>;
  summary?: {
    saved: number;
    duplicates: number;
    errors: number;
  };
}

type DuplicateError = {
  isDuplicate: true;
  message: string;
  existingLead: ProspectedLead;
};

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; icon: any }
> = {
  New: {
    label: "New",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Star,
  },
  Contacted: {
    label: "Contacted",
    color:
      "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]",
    icon: Mail,
  },
  Responded: {
    label: "Responded",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: RefreshCw,
  },
  Qualified: {
    label: "Qualified",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: CheckCircle2,
  },
  Closed: {
    label: "Closed",
    color: "bg-white/10 text-white/40 border-white/10",
    icon: AlertCircle,
  },
  "Lead Detected": {
    label: "Lead Detected",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Target,
  },
  Planning: {
    label: "Planning",
    color:
      "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]",
    icon: RefreshCw,
  },
  Quoted: {
    label: "Quoted",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: FileText,
  },
  Negotiation: {
    label: "Negotiation",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    icon: AlertCircle,
  },
  Won: {
    label: "Won",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: CheckCircle2,
  },
  Lost: {
    label: "Lost",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: XCircle,
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  High: "text-red-400 bg-red-500/10 border-red-500/20",
  Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Low: "text-white/50 bg-white/5 border-white/10",
};

const SOURCE_TYPE_CONFIG: Record<
  SourceType,
  {
    label: string;
    icon: any;
    color: string;
    urlLabel: string | null;
    placeholder: string;
    status: "live" | "manual_only";
  }
> = {
  manual: {
    label: "General Signals",
    icon: Layers,
    color: "text-[hsl(43,78%,65%)] bg-[rgba(201,168,76,0.1)]",
    urlLabel: null,
    placeholder: `Paste any mix of company intelligence here:

Company: NovaPay Financial
- Announced $25M Series B funding
- Hiring 40+ staff in Brisbane including Office Manager and EA
- LinkedIn shows team grew from 35 to 80 in 6 months
- Moving from coworking to private offices in Fortitude Valley
- CEO mentioned "building a world-class Brisbane HQ"`,
    status: "live",
  },
  job_ad: {
    label: "Job Advertisement",
    icon: Briefcase,
    color: "text-purple-400 bg-purple-500/10",
    urlLabel: "Job Ad URL (optional)",
    placeholder: `Paste the full job advertisement text here...

Example:
Office Manager — Brisbane CBD
We are a fast-growing fintech scaling to 80 staff. You'll manage our new 500sqm Fortitude Valley office as we transition from co-working...`,
    status: "live",
  },
  linkedin: {
    label: "LinkedIn Post",
    icon: Linkedin,
    color: "text-blue-400 bg-blue-500/10",
    urlLabel: "LinkedIn URL (optional)",
    placeholder: `Paste LinkedIn post or company update here...

Example:
Excited to announce we've just signed our new Brisbane HQ — 1,200sqm right in the heart of the CBD...`,
    status: "live",
  },
  hiring_page: {
    label: "Hiring Page",
    icon: Search,
    color: "text-orange-400 bg-orange-500/10",
    urlLabel: "Careers Page URL (optional)",
    placeholder: `Paste the careers/jobs page content here...

Example:
We're hiring across all departments as we prepare to open our new Sydney HQ...`,
    status: "live",
  },
  announcement: {
    label: "Announcement",
    icon: Newspaper,
    color: "text-green-400 bg-green-500/10",
    urlLabel: "Announcement URL (optional)",
    placeholder: `Paste the company announcement or press release here...

Example:
ACME Corp today announced a $40M Series C funding round...`,
    status: "live",
  },
  article: {
    label: "News Article",
    icon: FileText,
    color: "text-cyan-400 bg-cyan-500/10",
    urlLabel: "Article URL (optional)",
    placeholder: `Paste the news article or blog post here...

Example:
Brisbane startup closes $15M raise as it prepares for national expansion...`,
    status: "live",
  },
  website: {
    label: "Company Website",
    icon: Globe,
    color: "text-white/50 bg-white/5",
    urlLabel: "Website URL",
    placeholder: `Paste the company website URL and relevant text from their About, Team, or Contact pages...

Note: Auto-scraping coming soon. For now, copy and paste the relevant content.`,
    status: "manual_only",
  },
};

const BATCH_DELIMITER = "--- NEXT COMPANY ---";

const SCORE_COLOR = (score: number) => {
  if (score >= 8) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  return "text-white/50";
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.error || "Request failed");
  }

  return data as T;
}

async function mutationJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ data: T; status: number }> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  return { data: data as T, status: res.status };
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`h-3 w-2 rounded-sm transition-all ${
              i < score
                ? score >= 8
                  ? "bg-green-400"
                  : score >= 5
                    ? "bg-yellow-400"
                    : "bg-white/30"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <span className={`text-sm font-bold ${SCORE_COLOR(score)}`}>
        {score}/10
      </span>
    </div>
  );
}

function SourceBadge({ sourceType }: { sourceType: string | null }) {
  const config =
    SOURCE_TYPE_CONFIG[sourceType as SourceType] || SOURCE_TYPE_CONFIG.manual;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${config.color} border-current/20`}
    >
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}

interface BatchScanDialogProps {
  onClose: () => void;
  onComplete: () => void;
}

function BatchScanDialog({ onClose, onComplete }: BatchScanDialogProps) {
  const [batchText, setBatchText] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [skipDedupe, setSkipDedupe] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    results: BatchScanResponse["results"];
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const blocks = useMemo(
    () =>
      batchText
        .split(BATCH_DELIMITER)
        .map((b) => b.trim())
        .filter((b) => b.length >= 10)
        .slice(0, 20),
    [batchText]
  );

  async function runScan() {
    if (blocks.length === 0) return;

    setRunning(true);
    setProgress({ current: 0, total: blocks.length, results: [] });

    const items = blocks.map((block) => ({
      sourceType,
      sourceText: block,
    }));

    try {
      const { data } = await mutationJson<BatchScanResponse>(
        "/api/admin/prospects/batch-scan",
        "POST",
        { items, skipDedupe }
      );

      setProgress({
        current: blocks.length,
        total: blocks.length,
        results: data.results || [],
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });

      toast({
        title: "Batch scan complete",
        description: `${data.summary?.saved || 0} saved · ${data.summary?.duplicates || 0} duplicates · ${data.summary?.errors || 0} errors`,
      });

      onComplete();
    } catch (err: any) {
      toast({
        title: "Batch scan failed",
        description: err?.message || "Could not complete batch scan",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      data-testid="batch-scan-dialog"
    >
      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Play className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              Run Signal Scan
            </h2>
            <p className="text-white/40 text-xs mt-1">
              Paste multiple company signals — one per block, separated by the
              delimiter
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-white/40 mb-1.5">
                Source Type
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                data-testid="select-batch-source-type"
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
              >
                {(Object.keys(SOURCE_TYPE_CONFIG) as SourceType[])
                  .filter((k) => k !== "website")
                  .map((key) => (
                    <option key={key} value={key}>
                      {SOURCE_TYPE_CONFIG[key].label}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="skip-dedupe"
                checked={skipDedupe}
                onChange={(e) => setSkipDedupe(e.target.checked)}
                data-testid="checkbox-skip-dedupe"
                className="w-4 h-4 rounded accent-[hsl(43,78%,52%)]"
              />
              <label
                htmlFor="skip-dedupe"
                className="text-xs text-white/50 whitespace-nowrap"
              >
                Skip dedupe check
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-white/40">
                Company signals — one per block
              </label>
              {blocks.length > 0 && (
                <span className="text-xs text-[hsl(43,78%,65%)]">
                  {blocks.length} block{blocks.length !== 1 ? "s" : ""} detected
                </span>
              )}
            </div>

            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={`Paste company 1 signals here...\n\n${BATCH_DELIMITER}\n\nPaste company 2 signals here...\n\n${BATCH_DELIMITER}\n\nPaste company 3 signals here...`}
              data-testid="textarea-batch-signals"
              rows={14}
              className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[rgba(201,168,76,0.3)] text-sm leading-relaxed resize-none font-mono"
            />

            <p className="text-white/25 text-xs mt-1">
              Separate each company's signals with:{" "}
              <code className="text-white/40">{BATCH_DELIMITER}</code>
            </p>
          </div>

          {progress && (progress.results?.length || 0) > 0 && (
            <div className="space-y-2">
              <p className="text-white/40 text-xs font-medium">Results</p>

              {progress.results?.map((r: any, i: number) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${
                    r.status === "saved"
                      ? "border-green-500/20 bg-green-500/5 text-green-400"
                      : r.status === "duplicate"
                        ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
                        : "border-red-500/20 bg-red-500/5 text-red-400"
                  }`}
                >
                  {r.status === "saved" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : r.status === "duplicate" ? (
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 flex-shrink-0" />
                  )}

                  <span>
                    Block {i + 1}:{" "}
                    {r.status === "saved"
                      ? `Saved — ${r.lead?.company} (${r.lead?.score}/10)`
                      : r.status === "duplicate"
                        ? `Duplicate — ${r.existingLead?.company} already in pipeline`
                        : `Error — ${r.error}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3">
          <p className="text-white/30 text-xs">
            Max 20 companies per scan · Duplicates skipped by default
          </p>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-[rgba(255,255,255,0.1)] text-white/50 min-h-[44px]"
            >
              Close
            </Button>

            <Button
              onClick={runScan}
              disabled={running || blocks.length === 0}
              data-testid="button-start-batch-scan"
              className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[44px] px-6"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning {progress?.current}/{progress?.total}...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Scan {blocks.length} {blocks.length === 1 ? "Company" : "Companies"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLeads() {
  const [activeSourceType, setActiveSourceType] = useState<SourceType>("manual");
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [companyHint, setCompanyHint] = useState("");
  const [analysisResult, setAnalysisResult] = useState<ProspectedLead | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    message: string;
    existingLead: ProspectedLead;
  } | null>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [showOutreach, setShowOutreach] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showBatchScan, setShowBatchScan] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Lead Intelligence Engine | The Corporate Desk Admin";
  }, []);

  const {
    data: authData,
    isLoading: authLoading,
    error: authError,
  } = useQuery<AuthCheckResponse>({
    queryKey: ["/api/admin/auth/check"],
    queryFn: () => fetchJson<AuthCheckResponse>("/api/admin/auth/check"),
    retry: false,
    staleTime: 30_000,
  });

  const authed = authData?.authenticated === true;

  const {
    data: prospects = [],
    isLoading: prospectsLoading,
    refetch: refetchProspects,
  } = useQuery<ProspectedLead[]>({
    queryKey: ["/api/admin/prospects"],
    queryFn: () => fetchJson<ProspectedLead[]>("/api/admin/prospects"),
    enabled: authed,
    refetchInterval: authed ? 30_000 : false,
  });

  const analyseMutation = useMutation({
    mutationFn: async (payload: {
      sourceType: SourceType;
      sourceText: string;
      sourceUrl?: string;
      companyHint?: string;
      skipDedupe?: boolean;
    }) => {
      const { data, status } = await mutationJson<ProspectAnalyseResponse>(
        "/api/admin/prospect",
        "POST",
        payload
      );

      if (status === 409 && data.existingLead) {
        throw {
          isDuplicate: true,
          message: data.message || "Duplicate lead detected",
          existingLead: data.existingLead,
        } satisfies DuplicateError;
      }

      if (!data.lead) {
        throw new Error(data.error || "Analysis failed");
      }

      return data;
    },
    onSuccess: async (data) => {
      if (data.lead) {
        setAnalysisResult(data.lead);
        setDuplicateWarning(null);
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });

        toast({
          title: "Lead analysed",
          description: `${data.lead.company} — Score ${data.lead.score}/10 · ${data.lead.priority} priority`,
        });
      }
    },
    onError: (err: any) => {
      if (err?.isDuplicate && err?.existingLead) {
        setDuplicateWarning({
          message: err.message,
          existingLead: err.existingLead,
        });
        return;
      }

      toast({
        title: "Analysis failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const forceAddMutation = useMutation({
    mutationFn: async (payload: {
      sourceType: SourceType;
      sourceText: string;
      sourceUrl?: string;
      companyHint?: string;
      skipDedupe?: boolean;
    }) => {
      const { data } = await mutationJson<ProspectAnalyseResponse>(
        "/api/admin/prospect",
        "POST",
        { ...payload, skipDedupe: true }
      );

      if (!data.lead) {
        throw new Error(data.error || "Analysis failed");
      }

      return data;
    },
    onSuccess: async (data) => {
      if (data.lead) {
        setAnalysisResult(data.lead);
        setDuplicateWarning(null);
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
        toast({ title: "Lead added", description: "Duplicate override applied" });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add lead",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { data } = await mutationJson(
        `/api/admin/prospects/${id}/status`,
        "PATCH",
        { status }
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
    },
    onError: (err: any) => {
      toast({
        title: "Status update failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await mutationJson(
        `/api/admin/prospects/${id}`,
        "DELETE"
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/prospects"] });
      toast({ title: "Lead removed from pipeline" });
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied to clipboard" });
    });
  }

  function handleAnalyse(skipDedupe = false) {
    if (!sourceText.trim() || sourceText.trim().length < 10) {
      toast({
        title: "Add more content to analyse",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      sourceType: activeSourceType,
      sourceText: sourceText.trim(),
      sourceUrl: sourceUrl.trim() || undefined,
      companyHint: companyHint.trim() || undefined,
      ...(skipDedupe ? { skipDedupe: true } : {}),
    };

    if (skipDedupe) {
      forceAddMutation.mutate(payload);
    } else {
      analyseMutation.mutate(payload);
    }
  }

  function clearInput() {
    setSourceText("");
    setSourceUrl("");
    setCompanyHint("");
    setAnalysisResult(null);
    setDuplicateWarning(null);
    setShowOutreach(null);
  }

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      if (filterPriority !== "All" && p.priority !== filterPriority) return false;
      if (filterStatus !== "All" && p.status !== filterStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.company.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.industry.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [prospects, filterPriority, filterStatus, searchQuery]);

  const highCount = prospects.filter((p) => p.priority === "High").length;
  const newCount = prospects.filter((p) => p.status === "New").length;
  const avgScore =
    prospects.length > 0
      ? (prospects.reduce((s, p) => s + p.score, 0) / prospects.length).toFixed(1)
      : "—";

  const sourceConfig = SOURCE_TYPE_CONFIG[activeSourceType];
  const SourceIcon = sourceConfig.icon;
  const isPending = analyseMutation.isPending || forceAddMutation.isPending;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/70">
          <Loader2 className="w-5 h-5 animate-spin" />
          Checking authentication...
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-[hsl(220,18%,10%)] border border-red-500/20 rounded-2xl p-6 text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h1 className="text-white text-xl font-semibold mb-2">
            Admin authentication required
          </h1>
          <p className="text-white/50 text-sm mb-5">
            This page now uses real backend auth. Your current session is not authenticated.
          </p>
          {authError && (
            <p className="text-red-400/80 text-xs mb-4">
              {(authError as Error)?.message || "Auth check failed"}
            </p>
          )}
          <Button
            asChild
            className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold"
          >
            <Link href="/admin/login">Go to Admin Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">
      {showBatchScan && (
        <BatchScanDialog
          onClose={() => setShowBatchScan(false)}
          onComplete={() => setShowBatchScan(false)}
        />
      )}

      <header className="bg-[hsl(220,18%,8%)] border-b border-[rgba(201,168,76,0.1)] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="flex flex-col cursor-pointer">
                <span className="text-base font-serif font-bold text-white leading-tight">
                  THE CORPORATE
                </span>
                <span className="text-xs font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">
                  DESK
                </span>
              </div>
            </Link>

            <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />

            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <span className="text-white/60 text-sm font-medium">
                Lead Intelligence Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setShowBatchScan(true)}
              className="bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.18)] min-h-[40px]"
              data-testid="button-run-signal-scan"
            >
              <Play className="w-4 h-4 mr-1.5" />
              Run Signal Scan
            </Button>

            <Button
              onClick={() => refetchProspects()}
              size="sm"
              variant="outline"
              className="border-[rgba(255,255,255,0.1)] text-white/50 min-h-[40px]"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh
            </Button>

            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-[rgba(255,255,255,0.1)] text-white/50 min-h-[40px]"
              data-testid="button-leads-dashboard"
            >
              <Link href="/admin/dashboard">
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                Dashboard
              </Link>
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
          <p className="text-white/40 text-sm">
            Paste company signals from any source — AI extracts intelligence,
            scores the opportunity, and generates personalised outreach.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Prospects",
              value: prospects.length,
              icon: Target,
              color: "text-[hsl(43,78%,65%)]",
              testId: "stat-total-prospects",
            },
            {
              label: "High Priority",
              value: highCount,
              icon: TrendingUp,
              color: "text-red-400",
              testId: "stat-high-priority",
            },
            {
              label: "New",
              value: newCount,
              icon: Star,
              color: "text-blue-400",
              testId: "stat-new",
            },
            {
              label: "Avg Score",
              value: avgScore,
              icon: BarChart3,
              color: "text-green-400",
              testId: "stat-avg-score",
            },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/50 text-sm">{kpi.label}</p>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p
                  className={`text-3xl font-serif font-bold ${kpi.color}`}
                  data-testid={kpi.testId}
                >
                  {kpi.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8">
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[rgba(201,168,76,0.1)] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">
                    Ingest Company Signal
                  </h2>
                  <p className="text-white/40 text-xs">
                    Choose source type, paste content, get AI analysis
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-white/40 mb-2">
                  Signal source type
                </label>

                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {(Object.keys(SOURCE_TYPE_CONFIG) as SourceType[]).map((key) => {
                    const cfg = SOURCE_TYPE_CONFIG[key];
                    const Icon = cfg.icon;
                    const isActive = activeSourceType === key;

                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setActiveSourceType(key);
                          setDuplicateWarning(null);
                          setAnalysisResult(null);
                        }}
                        data-testid={`tab-source-${key}`}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs border transition-all min-h-[56px] ${
                          isActive
                            ? "bg-[rgba(201,168,76,0.1)] border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]"
                            : "border-[rgba(255,255,255,0.06)] text-white/40 hover:text-white/60 hover:border-[rgba(255,255,255,0.1)]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="leading-tight text-center">
                          {cfg.label.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {sourceConfig.urlLabel && (
                <div className="mb-3">
                  <label className="block text-xs text-white/40 mb-1.5">
                    {sourceConfig.urlLabel}
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                    data-testid="input-source-url"
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,168,76,0.3)] text-sm"
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="block text-xs text-white/40 mb-1.5">
                  Company name hint (optional)
                </label>
                <input
                  type="text"
                  value={companyHint}
                  onChange={(e) => setCompanyHint(e.target.value)}
                  placeholder="e.g. NovaPay Financial"
                  data-testid="input-company-hint"
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,168,76,0.3)] text-sm"
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-white/40 flex items-center gap-1.5">
                    <SourceIcon className="w-3 h-3" />
                    {sourceConfig.label} content
                  </label>

                  {sourceConfig.status === "manual_only" && (
                    <span className="text-xs text-orange-400/70 bg-orange-500/10 border border-orange-500/15 px-2 py-0.5 rounded-full">
                      Manual — auto-scrape coming soon
                    </span>
                  )}
                </div>

                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder={sourceConfig.placeholder}
                  data-testid="textarea-signals"
                  rows={11}
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.12)] rounded-xl px-4 py-3 text-white placeholder:text-white/15 focus:outline-none focus:border-[rgba(201,168,76,0.35)] text-sm leading-relaxed resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={clearInput}
                  variant="outline"
                  className="border-[rgba(255,255,255,0.1)] text-white/50 min-h-[48px] px-4"
                  disabled={isPending}
                  data-testid="button-clear-signals"
                >
                  Clear
                </Button>

                <Button
                  onClick={() => handleAnalyse()}
                  disabled={isPending || sourceText.trim().length < 10}
                  data-testid="button-analyse"
                  className="flex-1 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analysing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Analyse with AI
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                <p className="text-white/25 text-xs leading-relaxed">
                  <strong className="text-white/40">For batch processing:</strong>{" "}
                  use "Run Signal Scan" in the top bar to process multiple
                  companies at once, separated by{" "}
                  <code className="text-white/35">{BATCH_DELIMITER}</code>
                </p>
              </div>
            </div>

            {duplicateWarning && (
              <div
                className="bg-[rgba(234,179,8,0.06)] border border-[rgba(234,179,8,0.25)] rounded-2xl p-5"
                data-testid="duplicate-warning"
              >
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-300 font-semibold text-sm mb-1">
                      Duplicate Detected
                    </p>
                    <p className="text-yellow-300/70 text-xs leading-relaxed">
                      {duplicateWarning.message}
                    </p>
                  </div>
                </div>

                <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3 mb-4 text-xs">
                  <p className="text-white/80 font-semibold">
                    {duplicateWarning.existingLead.company}
                  </p>
                  <p className="text-white/40 mt-0.5">
                    {duplicateWarning.existingLead.industry} ·{" "}
                    {duplicateWarning.existingLead.location} · Score{" "}
                    {duplicateWarning.existingLead.score}/10
                  </p>
                  <Badge
                    className={`mt-2 text-xs border ${
                      STATUS_CONFIG[duplicateWarning.existingLead.status]?.color
                    }`}
                  >
                    {duplicateWarning.existingLead.status}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setDuplicateWarning(null)}
                    variant="outline"
                    className="flex-1 border-[rgba(255,255,255,0.1)] text-white/50 min-h-[40px] text-xs"
                  >
                    <SkipForward className="w-3.5 h-3.5 mr-1.5" />
                    Skip
                  </Button>

                  <Button
                    onClick={() => handleAnalyse(true)}
                    disabled={isPending}
                    className="flex-1 bg-yellow-600/80 hover:bg-yellow-600 text-white font-semibold min-h-[40px] text-xs"
                    data-testid="button-force-add"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Anyway
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {analysisResult && !duplicateWarning && (
              <div
                className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-6"
                data-testid="analysis-result"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[hsl(43,78%,65%)] font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Analysis Complete
                  </h3>

                  <Badge
                    className={`text-xs border ${PRIORITY_COLOR[analysisResult.priority]}`}
                  >
                    {analysisResult.priority} Priority
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-white font-serif font-bold text-xl">
                      {analysisResult.company}
                    </p>
                    <p className="text-white/50 text-sm">
                      {analysisResult.industry} · {analysisResult.location}
                    </p>
                    {analysisResult.domain && (
                      <p className="text-white/30 text-xs mt-0.5 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {analysisResult.domain}
                      </p>
                    )}
                  </div>

                  <ScoreBar score={analysisResult.score} />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                      <p className="text-white/40 mb-1">Est. Team Size</p>
                      <p className="text-white font-medium">
                        {analysisResult.estimatedTeamSize}
                      </p>
                    </div>
                    <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                      <p className="text-white/40 mb-1">Project Value</p>
                      <p className="text-[hsl(43,78%,65%)] font-medium">
                        {analysisResult.estimatedProjectValue}
                      </p>
                    </div>
                  </div>

                  {analysisResult.likelyOfficeNeed && (
                    <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 text-xs">
                      <p className="text-white/40 mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Likely Office Need
                      </p>
                      <p className="text-white/70 leading-relaxed">
                        {analysisResult.likelyOfficeNeed}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-white/40 text-xs mb-2">Signals Detected</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.signalsDetected.map((s, i) => (
                        <span
                          key={i}
                          className="bg-[rgba(255,255,255,0.06)] text-white/60 text-xs px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.08)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-white/40 text-xs mb-1">Reasoning</p>
                    <p className="text-white/60 text-xs leading-relaxed">
                      {analysisResult.reasoning}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setShowOutreach(showOutreach === "new" ? null : "new")
                    }
                    className="w-full text-left flex items-center justify-between py-2 text-sm text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,75%)] min-h-[44px]"
                    data-testid="button-toggle-outreach-new"
                  >
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4" />
                      View Outreach Message
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showOutreach === "new" ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showOutreach === "new" && (
                    <div className="relative">
                      <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-4 text-sm text-white/70 leading-relaxed whitespace-pre-wrap border border-[rgba(255,255,255,0.06)]">
                        {analysisResult.outreachMessage}
                      </div>

                      <button
                        onClick={() =>
                          copyText(analysisResult.outreachMessage, "new-outreach")
                        }
                        className="absolute top-3 right-3 p-2 rounded-lg bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.2)] transition-all"
                        data-testid="button-copy-outreach-new"
                      >
                        {copiedId === "new-outreach" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
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
                  <Target className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  Prospect Pipeline
                  <span className="text-white/30 font-normal text-sm">
                    ({filteredProspects.length})
                  </span>
                </h2>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      data-testid="input-search-prospects"
                      className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-white/60 text-xs rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-[rgba(201,168,76,0.25)] w-28"
                    />
                  </div>

                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    data-testid="select-filter-priority"
                    className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-white/60 text-xs rounded-lg px-3 py-2 focus:outline-none"
                  >
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    data-testid="select-filter-status"
                    className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-white/60 text-xs rounded-lg px-3 py-2 focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    {Object.keys(STATUS_CONFIG).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {prospectsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-20 bg-[rgba(255,255,255,0.03)] rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredProspects.length === 0 ? (
                <div className="text-center py-16">
                  <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/40 text-sm mb-2">
                    {prospects.length === 0
                      ? "No prospects yet"
                      : "No prospects match filters"}
                  </p>
                  <p className="text-white/25 text-xs">
                    {prospects.length === 0
                      ? 'Paste company signals on the left and click "Analyse with AI" to identify opportunities.'
                      : "Try adjusting the search or filters above."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {filteredProspects.map((lead) => {
                    const statusConf =
                      STATUS_CONFIG[lead.status as LeadStatus] || STATUS_CONFIG.New;
                    const StatusIcon = statusConf.icon;
                    const isExpanded = expandedLead === lead.id;

                    return (
                      <div key={lead.id} data-testid={`prospect-card-${lead.id}`}>
                        <button
                          onClick={() =>
                            setExpandedLead(isExpanded ? null : lead.id)
                          }
                          className="w-full text-left p-4 rounded-xl border border-[rgba(255,255,255,0.05)] hover:border-[rgba(201,168,76,0.15)] transition-all bg-[rgba(255,255,255,0.02)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.12)] flex items-center justify-center flex-shrink-0 text-[hsl(43,78%,52%)] font-bold text-sm">
                                {lead.company.charAt(0)}
                              </div>

                              <div className="min-w-0">
                                <p className="text-white font-semibold text-sm truncate">
                                  {lead.company}
                                </p>
                                <p className="text-white/40 text-xs mt-0.5 truncate">
                                  {lead.industry} · {lead.location}
                                </p>

                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <Badge
                                    className={`text-xs border ${PRIORITY_COLOR[lead.priority]}`}
                                  >
                                    {lead.priority}
                                  </Badge>

                                  <Badge
                                    className={`text-xs border ${statusConf.color}`}
                                  >
                                    <StatusIcon className="w-2.5 h-2.5 mr-1" />
                                    {lead.status}
                                  </Badge>

                                  {lead.sourceType && (
                                    <SourceBadge sourceType={lead.sourceType} />
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right hidden sm:block">
                                <p
                                  className={`text-sm font-bold ${SCORE_COLOR(lead.score)}`}
                                >
                                  {lead.score}/10
                                </p>
                                <p className="text-white/30 text-xs">
                                  {lead.estimatedProjectValue}
                                </p>
                              </div>

                              <ChevronDown
                                className={`w-4 h-4 text-white/30 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="mx-2 mb-2 p-5 rounded-b-xl border border-t-0 border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] space-y-4">
                            <ScoreBar score={lead.score} />

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                <p className="text-white/40 mb-1 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  Team Size
                                </p>
                                <p className="text-white font-medium">
                                  {lead.estimatedTeamSize}
                                </p>
                              </div>

                              <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                <p className="text-white/40 mb-1 flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  Project Value
                                </p>
                                <p className="text-[hsl(43,78%,65%)] font-medium">
                                  {lead.estimatedProjectValue}
                                </p>
                              </div>

                              <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                <p className="text-white/40 mb-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Decision Makers
                                </p>
                                <p className="text-white/70 font-medium">
                                  {lead.decisionMakers}
                                </p>
                              </div>
                            </div>

                            {lead.likelyOfficeNeed && (
                              <div className="bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.1)] rounded-lg p-3 text-xs">
                                <p className="text-white/40 mb-1 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  Likely Office Need
                                </p>
                                <p className="text-white/70 leading-relaxed">
                                  {lead.likelyOfficeNeed}
                                </p>
                              </div>
                            )}

                            <div>
                              <p className="text-white/40 text-xs mb-2">
                                Signals Detected
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {lead.signalsDetected.map((s, i) => (
                                  <span
                                    key={i}
                                    className="bg-[rgba(255,255,255,0.06)] text-white/60 text-xs px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.08)]"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-white/40 text-xs mb-1">
                                AI Reasoning
                              </p>
                              <p className="text-white/60 text-xs leading-relaxed">
                                {lead.reasoning}
                              </p>
                            </div>

                            {lead.website && (
                              <a
                                href={
                                  lead.website.startsWith("http")
                                    ? lead.website
                                    : `https://${lead.website}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,75%)]"
                              >
                                <Globe className="w-3 h-3" />
                                {lead.domain || lead.website}
                              </a>
                            )}

                            <button
                              onClick={() =>
                                setShowOutreach(
                                  showOutreach === lead.id ? null : lead.id
                                )
                              }
                              className="w-full text-left flex items-center justify-between py-2 text-sm text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,75%)] min-h-[44px]"
                              data-testid={`button-toggle-outreach-${lead.id}`}
                            >
                              <span className="flex items-center gap-1.5">
                                <Mail className="w-4 h-4" />
                                Outreach Message
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                  showOutreach === lead.id ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {showOutreach === lead.id && (
                              <div className="relative">
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-4 text-sm text-white/70 leading-relaxed whitespace-pre-wrap border border-[rgba(255,255,255,0.06)]">
                                  {lead.outreachMessage}
                                </div>

                                <button
                                  onClick={() =>
                                    copyText(
                                      lead.outreachMessage,
                                      `${lead.id}-outreach`
                                    )
                                  }
                                  className="absolute top-3 right-3 p-2 rounded-lg bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.2)] transition-all"
                                  data-testid={`button-copy-outreach-${lead.id}`}
                                >
                                  {copiedId === `${lead.id}-outreach` ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                              <select
                                value={lead.status}
                                onChange={(e) =>
                                  statusMutation.mutate({
                                    id: lead.id,
                                    status: e.target.value as LeadStatus,
                                  })
                                }
                                data-testid={`select-status-${lead.id}`}
                                className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none min-h-[36px]"
                              >
                                {Object.keys(STATUS_CONFIG).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={() => deleteMutation.mutate(lead.id)}
                                className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                                data-testid={`button-delete-${lead.id}`}
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
      </main>
    </div>
  );
}
