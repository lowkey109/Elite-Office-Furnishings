import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  RefreshCw,
  Zap,
  Building2,
  TrendingUp,
  Target,
  LayoutDashboard,
  ChevronRight,
  Eye,
  Radio,
  GitMerge,
  X,
  MapPin,
  Users,
  DollarSign,
  Clock,
  CheckCircle2,
  Loader2,
  Crosshair,
  AlertTriangle,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Send,
} from "lucide-react";

function resolveOutreachChannel(signal: {
  estimatedProjectValue?: number | null;
  employeeEstimate?: number | null;
  signalType?: string | null;
  relocationProbability?: number | null;
  probabilityTier?: string | null;
}): { channel: "email" | "whatsapp" | "call"; reason: string } {
  const value = signal.estimatedProjectValue ?? 0;
  const employees = signal.employeeEstimate ?? 0;
  const isRelocation = (signal.relocationProbability ?? 0) >= 60 || signal.signalType === "office_relocation";
  const isHighValue = value >= 200_000;
  const isEnterprise = employees >= 200;
  const tier = signal.probabilityTier ?? "medium";

  if (isHighValue || isEnterprise || isRelocation) {
    return {
      channel: "email",
      reason: isRelocation
        ? "Relocation signals warrant formal email"
        : isHighValue
        ? `High-value ($${Math.round(value / 1000)}k) — email preferred`
        : "Enterprise size — email preferred",
    };
  }
  if (tier === "high" && employees > 0 && employees < 200) {
    return { channel: "whatsapp", reason: "High-confidence SMB — WhatsApp most effective" };
  }
  if (tier === "medium" && employees > 0 && employees < 100) {
    return { channel: "whatsapp", reason: "Mid-tier SMB — WhatsApp for quick engagement" };
  }
  return { channel: "email", reason: "Default channel — email for initial contact" };
}

function ChannelBadge({ channel }: { channel: "email" | "whatsapp" | "call" }) {
  if (channel === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-500/15 border border-green-500/25 text-green-400 rounded-lg font-medium">
        <MessageSquare className="w-3 h-3" />
        WhatsApp
      </span>
    );
  }
  if (channel === "call") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-500/15 border border-blue-500/25 text-blue-400 rounded-lg font-medium">
        <Phone className="w-3 h-3" />
        Call
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#C9A84C]/15 border border-[#C9A84C]/25 text-[#C9A84C] rounded-lg font-medium">
      <Mail className="w-3 h-3" />
      Email
    </span>
  );
}

interface DealHunterSignal {
  id: string;
  companyName: string;
  companyDomain: string | null;
  city: string;
  state: string | null;
  country: string | null;
  industry: string;
  employeeEstimate: number | null;
  growthRateEstimate: number | null;
  signalType: string;
  signalSubtype: string | null;
  signalSource: string;
  sourceUrl: string | null;
  rawPayloadSummary: string | null;
  signalStrengthScore: number;
  signalConfidence: number;
  reasoningSummary: string | null;
  estimatedWorkspaceSqm: number | null;
  estimatedProjectValue: number | null;
  relocationProbability: number | null;
  officeChangeProbability: number | null;
  probabilityTier: string;
  projectType: string | null;
  estimatedTimeline: string | null;
  recommendedAction: string | null;
  recommendedOutreachAngle: string | null;
  recommendedContactRolesJson: string | null;
  outreachDraft: string | null;
  isReviewed: boolean;
  pushedToPipeline: boolean;
  pushedToRadar: boolean;
  isDuplicate: boolean;
  status: string;
  createdAt: string;
}

interface Stats {
  total: number;
  newCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  pushedCount: number;
  dismissedCount: number;
  totalPipelineValue: number;
}

interface RunResult {
  success?: boolean;
  created?: number;
  deduplicated?: number;
  signals?: DealHunterSignal[];
  error?: string;
  message?: string;
}

interface AuthCheckResponse {
  authenticated: boolean;
}

interface RecommendedRolesPayload {
  best?: {
    role?: string;
    fullName?: string;
    email?: string;
    source?: string;
    publiclyListedEmail?: boolean;
  } | null;
  all?: Array<{
    role?: string;
    fullName?: string;
    email?: string;
    source?: string;
    publiclyListedEmail?: boolean;
  }>;
}

type SortBy = "score" | "value" | "recency" | "confidence";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let data: any = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
  }

  return data as T;
}

function tierColor(tier: string) {
  if (tier === "high") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (tier === "medium") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
}

function tierDot(tier: string) {
  if (tier === "high") return "bg-green-400";
  if (tier === "medium") return "bg-yellow-400";
  return "bg-zinc-500";
}

function signalTypeLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtValue(v: number | null) {
  if (!v || v <= 0) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

function parseRecommendedRoles(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as RecommendedRolesPayload | string[];

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => Boolean(item && typeof item === "string"));
    }

    const roles = new Set<string>();

    if (parsed?.best?.role) roles.add(parsed.best.role);

    for (const item of parsed?.all ?? []) {
      if (item?.role) roles.add(item.role);
    }

    return Array.from(roles);
  } catch {
    return [];
  }
}

function compactText(value: string | null | undefined, max = 140) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function AdminDealHunter() {
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [queuedSignalIds, setQueuedSignalIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "AI Deal Hunter | The Corporate Desk Admin";
  }, []);

  const authQuery = useQuery<AuthCheckResponse>({
    queryKey: ["/api/admin/auth/check"],
    queryFn: () => fetchJson<AuthCheckResponse>("/api/admin/auth/check"),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const isAuthed = authQuery.data?.authenticated === true;

  const statsQuery = useQuery<Stats>({
    queryKey: ["/api/admin/deal-hunter/stats"],
    queryFn: () => fetchJson<Stats>("/api/admin/deal-hunter/stats"),
    enabled: isAuthed,
    refetchOnWindowFocus: false,
  });

  const signalsQuery = useQuery<DealHunterSignal[]>({
    queryKey: [
      "/api/admin/deal-hunter/signals",
      cityFilter,
      industryFilter,
      tierFilter,
      typeFilter,
      statusFilter,
    ],
    queryFn: () => {
      const params = new URLSearchParams();

      if (cityFilter) params.set("city", cityFilter);
      if (industryFilter) params.set("industry", industryFilter);
      if (tierFilter) params.set("probabilityTier", tierFilter);
      if (typeFilter) params.set("signalType", typeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const suffix = params.toString() ? `?${params.toString()}` : "";
      return fetchJson<DealHunterSignal[]>(`/api/admin/deal-hunter/signals${suffix}`);
    },
    enabled: isAuthed,
    refetchOnWindowFocus: false,
  });

  const stats = statsQuery.data;
  const signals = signalsQuery.data ?? [];

  const refreshAll = async () => {
    await qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/signals"] });
    await qc.invalidateQueries({ queryKey: ["/api/admin/deal-hunter/stats"] });
    await signalsQuery.refetch();
    await statsQuery.refetch();
  };

  const runScanMutation = useMutation({
    mutationFn: async (count: number) =>
      fetchJson<RunResult>("/api/admin/deal-hunter/run", {
        method: "POST",
        body: JSON.stringify({ count }),
      }),
    onSuccess: async (data) => {
      await refreshAll();

      toast({
        title: "Deal Hunter complete",
        description:
          data.error ||
          `${data.created ?? 0} signals discovered, ${data.deduplicated ?? 0} deduplicated`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Scan failed",
        description: error?.message || "Could not run Deal Hunter.",
        variant: "destructive",
      });
    },
  });

  const pushPipelineMutation = useMutation({
    mutationFn: async (id: string) =>
      fetchJson(`/api/admin/deal-hunter/signals/${id}/push-to-pipeline`, {
        method: "POST",
      }),
    onMutate: (id) => setActiveActionId(id),
    onSuccess: async () => {
      setSelectedSignalId(null);
      await refreshAll();
      toast({ title: "Pushed to pipeline" });
    },
    onError: (error: any) => {
      toast({
        title: "Push failed",
        description: error?.message || "Could not push to pipeline.",
        variant: "destructive",
      });
    },
    onSettled: () => setActiveActionId(null),
  });

  const pushRadarMutation = useMutation({
    mutationFn: async (id: string) =>
      fetchJson(`/api/admin/deal-hunter/signals/${id}/push-to-radar`, {
        method: "POST",
      }),
    onMutate: (id) => setActiveActionId(id),
    onSuccess: async () => {
      setSelectedSignalId(null);
      await refreshAll();
      toast({ title: "Pushed to Office Move Radar" });
    },
    onError: (error: any) => {
      toast({
        title: "Push failed",
        description: error?.message || "Could not push to radar.",
        variant: "destructive",
      });
    },
    onSettled: () => setActiveActionId(null),
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: string) =>
      fetchJson(`/api/admin/deal-hunter/signals/${id}/review`, {
        method: "POST",
      }),
    onMutate: (id) => setActiveActionId(id),
    onSuccess: async () => {
      await refreshAll();
      toast({ title: "Marked as reviewed" });
    },
    onError: (error: any) => {
      toast({
        title: "Review failed",
        description: error?.message || "Could not mark as reviewed.",
        variant: "destructive",
      });
    },
    onSettled: () => setActiveActionId(null),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) =>
      fetchJson(`/api/admin/deal-hunter/signals/${id}/dismiss`, {
        method: "POST",
      }),
    onMutate: (id) => setActiveActionId(id),
    onSuccess: async () => {
      setSelectedSignalId(null);
      await refreshAll();
      toast({ title: "Signal dismissed" });
    },
    onError: (error: any) => {
      toast({
        title: "Dismiss failed",
        description: error?.message || "Could not dismiss signal.",
        variant: "destructive",
      });
    },
    onSettled: () => setActiveActionId(null),
  });

  const dupeMutation = useMutation({
    mutationFn: async (id: string) =>
      fetchJson(`/api/admin/deal-hunter/signals/${id}/mark-duplicate`, {
        method: "PATCH",
      }),
    onMutate: (id) => setActiveActionId(id),
    onSuccess: async () => {
      setSelectedSignalId(null);
      await refreshAll();
      toast({ title: "Marked as duplicate" });
    },
    onError: (error: any) => {
      toast({
        title: "Duplicate mark failed",
        description: error?.message || "Could not mark duplicate.",
        variant: "destructive",
      });
    },
    onSettled: () => setActiveActionId(null),
  });

  const queueOutreachMutation = useMutation({
    mutationFn: async (id: string) =>
      fetchJson<{
        ok: boolean;
        outreachMessageId: string;
        channel: string;
        autoApproved: boolean;
        riskLevel: "low" | "high";
        riskJustification: string;
        deliveryStatus: string;
      }>(
        `/api/admin/deal-hunter/signals/${id}/queue-outreach`,
        { method: "POST" }
      ),
    onMutate: (id) => setActiveActionId(id),
    onSuccess: (data, id) => {
      setQueuedSignalIds((prev) => new Set([...prev, id]));
      if (data.autoApproved) {
        toast({
          title: "Outreach auto-approved",
          description: `Nexora approved and queued ${data.channel} outreach automatically. Low-risk signal — no human review needed.`,
        });
      } else {
        toast({
          title: "Submitted for review",
          description: `High-risk outreach (${data.channel}) queued in Nexora Command Centre for human approval.`,
        });
      }
    },
    onError: (error: any) => {
      const msg = error?.message ?? "";
      if (msg.includes("Already auto-approved") || msg.includes("Already queued")) {
        toast({ title: "Already processed", description: "This outreach was already submitted." });
      } else {
        toast({ title: "Outreach failed", description: msg || "Could not submit outreach.", variant: "destructive" });
      }
    },
    onSettled: () => setActiveActionId(null),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...signals]
      .filter((signal) => {
        if (!q) return true;

        return (
          signal.companyName.toLowerCase().includes(q) ||
          signal.city.toLowerCase().includes(q) ||
          signal.industry.toLowerCase().includes(q) ||
          String(signal.signalSource ?? "").toLowerCase().includes(q) ||
          String(signal.rawPayloadSummary ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === "score") return b.signalStrengthScore - a.signalStrengthScore;
        if (sortBy === "value") return (b.estimatedProjectValue ?? 0) - (a.estimatedProjectValue ?? 0);
        if (sortBy === "confidence") return b.signalConfidence - a.signalConfidence;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [signals, search, sortBy]);

  const selectedSignal =
    filtered.find((signal) => signal.id === selectedSignalId) ??
    signals.find((signal) => signal.id === selectedSignalId) ??
    null;

  const kpiTiles = [
    {
      label: "Total Signals",
      value: stats?.total ?? 0,
      icon: Target,
      color: "text-blue-400",
      sub: `${stats?.newCount ?? 0} unreviewed`,
    },
    {
      label: "High Probability",
      value: stats?.highCount ?? 0,
      icon: TrendingUp,
      color: "text-green-400",
      sub: "Priority opportunities",
    },
    {
      label: "Medium Probability",
      value: stats?.mediumCount ?? 0,
      icon: Zap,
      color: "text-yellow-400",
      sub: "Nurture pipeline",
    },
    {
      label: "Pushed to Pipeline",
      value: stats?.pushedCount ?? 0,
      icon: CheckCircle2,
      color: "text-violet-400",
      sub: `${stats?.dismissedCount ?? 0} dismissed`,
    },
    {
      label: "Total Pipeline Value",
      value: fmtValue(stats?.totalPipelineValue ?? null),
      icon: DollarSign,
      color: "text-[hsl(43,78%,52%)]",
      sub: "From discovered signals",
    },
  ];

  const allCities = useMemo(() => [...new Set(signals.map((s) => s.city))].sort(), [signals]);
  const allIndustries = useMemo(() => [...new Set(signals.map((s) => s.industry))].sort(), [signals]);
  const allTypes = useMemo(() => [...new Set(signals.map((s) => s.signalType))].sort(), [signals]);

  const isBusy =
    runScanMutation.isPending ||
    pushPipelineMutation.isPending ||
    pushRadarMutation.isPending ||
    reviewMutation.isPending ||
    dismissMutation.isPending ||
    dupeMutation.isPending;

  if (authQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Checking admin access...
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-[hsl(43,78%,52%)]" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Admin authentication required</h1>
          <p className="text-zinc-400 text-sm mb-5">
            You are not currently authenticated for this admin area, so the Deal Hunter API is returning 401.
          </p>
          <Link href="/admin/dashboard">
            <button className="inline-flex items-center gap-2 bg-[hsl(43,78%,52%)] text-black px-4 py-2 rounded-xl font-semibold">
              <LayoutDashboard className="w-4 h-4" />
              Go to Admin Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] text-white">
      <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin/dashboard">
              <div className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm cursor-pointer">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </div>
            </Link>

            <ChevronRight className="w-3 h-3 text-zinc-700" />

            <div className="flex items-center gap-2 min-w-0">
              <Crosshair className="w-4 h-4 text-[hsl(43,78%,52%)]" />
              <span className="text-white font-semibold text-sm">AI Deal Hunter</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={statsQuery.isFetching || signalsQuery.isFetching}
              className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              data-testid="button-refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  statsQuery.isFetching || signalsQuery.isFetching ? "animate-spin" : ""
                }`}
              />
            </button>

            <button
              onClick={() => runScanMutation.mutate(10)}
              disabled={runScanMutation.isPending}
              className="flex items-center gap-2 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] disabled:opacity-50 text-black px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              data-testid="button-run-deal-hunter"
            >
              {runScanMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Hunting...
                </>
              ) : (
                <>
                  <Crosshair className="w-4 h-4" />
                  Run Deal Hunter
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {kpiTiles.map((tile) => (
            <div
              key={tile.label}
              className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-500 text-xs font-medium">{tile.label}</span>
                <tile.icon className={`w-4 h-4 ${tile.color}`} />
              </div>
              <p className={`text-2xl font-bold ${tile.color}`}>{tile.value}</p>
              <p className="text-zinc-600 text-xs mt-1">{tile.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, city, industry, source..."
                className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-zinc-600"
              />
            </div>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All Cities</option>
              {allCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All Industries</option>
              {allIndustries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All Tiers</option>
              <option value="high">High Probability</option>
              <option value="medium">Medium Probability</option>
              <option value="low">Low Probability</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All Signal Types</option>
              {allTypes.map((type) => (
                <option key={type} value={type}>
                  {signalTypeLabel(type)}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="pushed">Pushed</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {(["score", "value", "recency", "confidence"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sortBy === option ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {option === "score"
                    ? "Score"
                    : option === "value"
                    ? "Value"
                    : option === "recency"
                    ? "Recent"
                    : "Confidence"}
                </button>
              ))}
            </div>

            {(cityFilter || industryFilter || tierFilter || typeFilter || statusFilter || search) && (
              <button
                onClick={() => {
                  setCityFilter("");
                  setIndustryFilter("");
                  setTierFilter("");
                  setTypeFilter("");
                  setStatusFilter("");
                  setSearch("");
                }}
                className="flex items-center gap-1 text-zinc-500 hover:text-white text-xs"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          <p className="text-zinc-600 text-xs mt-3">
            {filtered.length} signal{filtered.length !== 1 ? "s" : ""} shown
          </p>
        </div>

        {signalsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Crosshair className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-lg font-medium">No signals found</p>
            <p className="text-zinc-700 text-sm mt-1">
              Run the Deal Hunter to discover opportunities
            </p>
            <button
              onClick={() => runScanMutation.mutate(10)}
              disabled={runScanMutation.isPending}
              className="mt-6 flex items-center gap-2 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black px-6 py-3 rounded-xl text-sm font-semibold mx-auto"
            >
              <Crosshair className="w-4 h-4" />
              Run Deal Hunter
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((signal) => {
              const parsedRoles = parseRecommendedRoles(signal.recommendedContactRolesJson);
              const isExpanded = selectedSignal?.id === signal.id;
              const isRowBusy = activeActionId === signal.id;

              return (
                <div
                  key={signal.id}
                  className={`bg-[hsl(220,18%,10%)] border rounded-2xl p-5 cursor-pointer hover:border-[rgba(201,168,76,0.25)] transition-all ${
                    isExpanded
                      ? "border-[rgba(201,168,76,0.4)]"
                      : "border-[rgba(255,255,255,0.06)]"
                  }`}
                  onClick={() => setSelectedSignalId(isExpanded ? null : signal.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-white leading-none">
                        {signal.signalStrengthScore}
                      </span>
                      <span className="text-zinc-600 text-[10px]">score</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-bold text-base">{signal.companyName}</span>

                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tierColor(
                            signal.probabilityTier
                          )}`}
                        >
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${tierDot(
                              signal.probabilityTier
                            )}`}
                          />
                          {signal.probabilityTier} probability
                        </span>

                        {signal.pushedToPipeline && (
                          <span className="text-xs px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-full">
                            In Pipeline
                          </span>
                        )}

                        {signal.pushedToRadar && (
                          <span className="text-xs px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full">
                            In Radar
                          </span>
                        )}

                        {signal.isReviewed && !signal.pushedToPipeline && signal.status !== "dismissed" && (
                          <span className="text-xs px-2 py-0.5 bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 rounded-full">
                            Reviewed
                          </span>
                        )}

                        {signal.status === "dismissed" && (
                          <span className="text-xs px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                            Dismissed
                          </span>
                        )}

                        {signal.isDuplicate && (
                          <span className="text-xs px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full">
                            Duplicate
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-zinc-500 text-xs mb-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {signal.city}
                          {signal.state ? `, ${signal.state}` : ""}
                        </span>

                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {signal.industry}
                        </span>

                        {signal.employeeEstimate ? (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {signal.employeeEstimate.toLocaleString()} staff
                          </span>
                        ) : null}

                        {signal.estimatedProjectValue ? (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {fmtValue(signal.estimatedProjectValue)}
                          </span>
                        ) : null}

                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {signal.estimatedTimeline ?? "—"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-lg">
                          {signalTypeLabel(signal.signalType)}
                        </span>
                        <span className="text-xs text-zinc-600">via {signal.signalSource}</span>
                      </div>

                      {signal.rawPayloadSummary && (
                        <p className="text-zinc-400 text-xs line-clamp-2">
                          {compactText(signal.rawPayloadSummary, 160)}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex flex-col gap-2 items-end">
                      {!signal.pushedToPipeline && signal.status !== "dismissed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            pushPipelineMutation.mutate(signal.id);
                          }}
                          disabled={isBusy}
                          className="text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg font-medium min-w-[100px]"
                        >
                          {isRowBusy && pushPipelineMutation.isPending ? "Working..." : "→ Pipeline"}
                        </button>
                      )}

                      {!signal.pushedToRadar && signal.status !== "dismissed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            pushRadarMutation.mutate(signal.id);
                          }}
                          disabled={isBusy}
                          className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium min-w-[100px]"
                        >
                          {isRowBusy && pushRadarMutation.isPending ? "Working..." : "→ Radar"}
                        </button>
                      )}

                      {!signal.isReviewed && signal.status !== "dismissed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reviewMutation.mutate(signal.id);
                          }}
                          disabled={isBusy}
                          className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg min-w-[100px]"
                        >
                          {isRowBusy && reviewMutation.isPending ? "Working..." : "Mark Reviewed"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.06)] grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">
                            Signal Intelligence
                          </p>

                          <div className="space-y-1.5">
                            {(signal.reasoningSummary?.split(" | ") ?? []).filter(Boolean).map((reason, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-green-400 mt-0.5">+</span>
                                <span className="text-zinc-300">{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">
                            Opportunity Summary
                          </p>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                              {
                                label: "Project Type",
                                value: signal.projectType?.replace(/_/g, " ") ?? "—",
                              },
                              {
                                label: "Office Size",
                                value: signal.estimatedWorkspaceSqm
                                  ? `${signal.estimatedWorkspaceSqm} sqm`
                                  : "—",
                              },
                              {
                                label: "Timeline",
                                value: signal.estimatedTimeline ?? "—",
                              },
                              {
                                label: "Est. Value",
                                value: fmtValue(signal.estimatedProjectValue),
                              },
                              {
                                label: "Relocation Prob.",
                                value: signal.relocationProbability != null
                                  ? `${signal.relocationProbability}%`
                                  : "—",
                              },
                              {
                                label: "Change Prob.",
                                value: signal.officeChangeProbability != null
                                  ? `${signal.officeChangeProbability}%`
                                  : "—",
                              },
                              {
                                label: "Confidence",
                                value: `${signal.signalConfidence}%`,
                              },
                              {
                                label: "Growth Rate",
                                value: signal.growthRateEstimate != null
                                  ? `+${signal.growthRateEstimate}%`
                                  : "—",
                              },
                            ].map((item) => (
                              <div key={item.label} className="bg-zinc-900 rounded-xl p-2.5">
                                <p className="text-zinc-600 text-[10px] mb-0.5">{item.label}</p>
                                <p className="text-white font-medium">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {parsedRoles.length > 0 && (
                          <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">
                              Recommended Contact Roles
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {parsedRoles.map((role) => (
                                <span
                                  key={role}
                                  className="text-xs px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg"
                                >
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {signal.sourceUrl && (
                          <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">
                              Source URL
                            </p>
                            <a
                              href={signal.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 break-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {signal.sourceUrl}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {signal.recommendedAction && (
                          <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">
                              Recommended Action
                            </p>
                            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                              <p className="text-zinc-200 text-xs leading-relaxed">
                                {signal.recommendedAction}
                              </p>
                            </div>
                          </div>
                        )}

                        {signal.recommendedOutreachAngle && (
                          <div>
                            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2 font-medium">
                              Outreach Angle
                            </p>
                            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                              <p className="text-zinc-200 text-xs leading-relaxed">
                                {signal.recommendedOutreachAngle}
                              </p>
                            </div>
                          </div>
                        )}

                        {signal.outreachDraft && (() => {
                          const channelRec = resolveOutreachChannel(signal);
                          const isQueued = queuedSignalIds.has(signal.id);
                          const isQueueBusy = activeActionId === signal.id && queueOutreachMutation.isPending;

                          // Client-side risk pre-classification (mirrors server-side classifyOutreachRisk).
                          // This determines the button label before the server responds.
                          const value = signal.estimatedProjectValue ?? 0;
                          const isHighRiskChannel = channelRec.channel === "whatsapp" || channelRec.channel === "call";
                          const isHighRiskValue = value >= 500_000;
                          const isHighRisk = isHighRiskChannel || isHighRiskValue || !signal.companyName;

                          return (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                                  Outreach Draft
                                </p>
                                <div className="flex items-center gap-2">
                                  {isHighRisk ? (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded-lg font-medium">
                                      <Lock className="w-3 h-3" />
                                      Review Required
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-lg font-medium">
                                      <Zap className="w-3 h-3" />
                                      Auto-Approved
                                    </span>
                                  )}
                                  <ChannelBadge channel={channelRec.channel} />
                                </div>
                              </div>

                              <p className="text-zinc-600 text-[11px] mb-2 italic">{channelRec.reason}</p>

                              <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 max-h-40 overflow-y-auto mb-3">
                                <pre className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                                  {signal.outreachDraft}
                                </pre>
                              </div>

                              {isQueued ? (
                                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-2.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                  {isHighRisk
                                    ? "Submitted for human review — check Nexora Command Centre"
                                    : "Auto-approved by Nexora — outreach queued for delivery"}
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    queueOutreachMutation.mutate(signal.id);
                                  }}
                                  disabled={isBusy}
                                  data-testid={`btn-queue-outreach-${signal.id}`}
                                  className={`w-full flex items-center justify-center gap-2 border disabled:opacity-50 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                                    isHighRisk
                                      ? "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-400"
                                      : "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400"
                                  }`}
                                >
                                  {isQueueBusy ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : isHighRisk ? (
                                    <Lock className="w-4 h-4" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                  {isHighRisk ? "Submit for Review" : "Send Now (Auto-Approved)"}
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        <div className="space-y-2 pt-2">
                          {!signal.pushedToPipeline && signal.status !== "dismissed" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                pushPipelineMutation.mutate(signal.id);
                              }}
                              disabled={isBusy}
                              className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium"
                            >
                              {isRowBusy && pushPipelineMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Target className="w-4 h-4" />
                              )}
                              Push to Pipeline
                            </button>
                          )}

                          {!signal.pushedToRadar && signal.status !== "dismissed" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                pushRadarMutation.mutate(signal.id);
                              }}
                              disabled={isBusy}
                              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium"
                            >
                              {isRowBusy && pushRadarMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Radio className="w-4 h-4" />
                              )}
                              Push to Office Move Radar
                            </button>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {signal.pushedToPipeline && (
                              <Link href="/admin/leads">
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2 text-xs font-medium"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View Lead
                                </button>
                              </Link>
                            )}

                            {signal.pushedToRadar && (
                              <Link href="/admin/office-move-radar">
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-2 text-xs font-medium"
                                >
                                  <Radio className="w-3.5 h-3.5" />
                                  View Radar
                                </button>
                              </Link>
                            )}

                            {signal.status !== "dismissed" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissMutation.mutate(signal.id);
                                }}
                                disabled={isBusy}
                                className="flex items-center justify-center gap-1 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 text-red-400 rounded-xl py-2 text-xs font-medium"
                              >
                                {isRowBusy && dismissMutation.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                                Dismiss
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                dupeMutation.mutate(signal.id);
                              }}
                              disabled={isBusy}
                              className="flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-400 rounded-xl py-2 text-xs font-medium"
                            >
                              {isRowBusy && dupeMutation.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <GitMerge className="w-3.5 h-3.5" />
                              )}
                              Duplicate
                            </button>
                          </div>

                          {signal.signalConfidence < 60 && (
                            <div className="flex items-start gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <span>
                                Lower-confidence signal. Verify the source before sales action.
                              </span>
                            </div>
                          )}
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
    </div>
  );
}