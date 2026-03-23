import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, DollarSign, TrendingUp, Settings, RefreshCw, CheckCircle2,
  ChevronRight, BarChart3, Loader2, Star, AlertTriangle, Zap, Clock,
  FileText, Send, ShieldCheck, Copy, Trophy, Award, ArrowUpRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function getUrgency(r: any): { label: string; color: string } | null {
  if (!r.createdAt) return null;
  const ageH = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
  if (r.status === "submitted" && ageH >= 48) return { label: "URGENT", color: "bg-red-500/15 text-red-300 border-red-500/25" };
  if (["submitted", "reviewing"].includes(r.status) && ageH >= 72) return { label: "STALE", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" };
  if ((r.estimatedValue || 0) >= 200000 && !r.aiFitScore) return { label: "UNSCORED HIGH-VALUE", color: "bg-orange-500/15 text-orange-300 border-orange-500/25" };
  return null;
}

type Tab = "partners" | "referrals" | "commissions" | "settings" | "leaderboard";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  reviewing: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  qualified: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  quoted: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  won: "bg-green-500/10 text-green-300 border-green-500/20",
  lost: "bg-red-500/10 text-red-300 border-red-500/20",
  paid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  pending: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  approved: "bg-green-500/10 text-green-300 border-green-500/20",
  invoiced: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-300 border-red-500/20",
  active: "bg-green-500/10 text-green-300 border-green-500/20",
  lead: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  paused: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  rejected: "bg-red-500/10 text-red-300 border-red-500/20",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${STATUS_COLORS[status] || "bg-white/10 text-white/50 border-white/10"} capitalize`}>
      {status}
    </Badge>
  );
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function AdminPartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("referrals");
  const [selectedReferral, setSelectedReferral] = useState<string | null>(null);

  const [lbTierFilter, setLbTierFilter] = useState<string>("all");
  const [lbCityFilter, setLbCityFilter] = useState<string>("");
  const [scoringAll, setScoringAll] = useState(false);

  const { data: stats } = useQuery<any>({ queryKey: ["/api/admin/partners/stats"] });
  const { data: partners = [], isLoading: partnersLoading } = useQuery<any[]>({ queryKey: ["/api/admin/partners"], enabled: activeTab === "partners" });
  const { data: referralsRaw = [], isLoading: referralsLoading } = useQuery<any[]>({ queryKey: ["/api/admin/partners/referrals"], enabled: activeTab === "referrals" });
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery<any[]>({ queryKey: ["/api/admin/partners/commissions"], enabled: activeTab === "commissions" });
  const { data: settings } = useQuery<any>({ queryKey: ["/api/admin/partners/settings"], enabled: activeTab === "settings" });
  const { data: leaderboardRaw = [], isLoading: lbLoading, refetch: refetchLb } = useQuery<any[]>({
    queryKey: ["/api/admin/partners/leaderboard"],
    enabled: activeTab === "leaderboard",
  });

  const leaderboard = useMemo(() => {
    return leaderboardRaw.filter(({ partner, score }) => {
      if (lbTierFilter !== "all" && score.tier !== lbTierFilter) return false;
      if (lbCityFilter && !(partner.city || "").toLowerCase().includes(lbCityFilter.toLowerCase())) return false;
      return true;
    });
  }, [leaderboardRaw, lbTierFilter, lbCityFilter]);

  // Sort referrals: URGENT first, then by AI score descending, then by creation date
  const referrals = useMemo(() => {
    return [...referralsRaw].sort((a, b) => {
      const urgA = getUrgency(a);
      const urgB = getUrgency(b);
      if (urgA?.label === "URGENT" && urgB?.label !== "URGENT") return -1;
      if (urgB?.label === "URGENT" && urgA?.label !== "URGENT") return 1;
      if (urgA && !urgB) return -1;
      if (urgB && !urgA) return 1;
      const scoreA = a.aiFitScore ?? 0;
      const scoreB = b.aiFitScore ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [referralsRaw]);

  const urgentCount = useMemo(() => referrals.filter(r => getUrgency(r)?.label === "URGENT").length, [referrals]);
  const staleCount = useMemo(() => referrals.filter(r => getUrgency(r)?.label === "STALE").length, [referrals]);

  const scoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/referrals/${id}/score`),
    onSuccess: () => {
      toast({ title: "AI scoring complete" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/referrals"] });
    },
    onError: () => toast({ title: "Scoring failed", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("POST", `/api/referrals/${id}/status`, { status }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/referrals"] });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const markWonMutation = useMutation({
    mutationFn: ({ id, dealValue }: { id: string; dealValue: number }) => apiRequest("POST", `/api/referrals/${id}/mark-won`, { dealValue }),
    onSuccess: (_, vars) => {
      toast({ title: "Deal marked won — commission created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/commissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/stats"] });
    },
    onError: () => toast({ title: "Failed to mark won", variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/referrals/${id}/mark-paid`),
    onSuccess: () => {
      toast({ title: "Commission marked as paid" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/commissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/stats"] });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const sendAgreementMutation = useMutation({
    mutationFn: (partnerId: string) => apiRequest("POST", `/api/admin/partners/${partnerId}/agreement/send`),
    onSuccess: async (res: any) => {
      const body = await res.json();
      toast({ title: "Agreement sent", description: `Signing link: ${body.signingUrl}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
    },
    onError: () => toast({ title: "Failed to send agreement", variant: "destructive" }),
  });

  const overrideAgreementMutation = useMutation({
    mutationFn: ({ partnerId, status }: { partnerId: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/partners/${partnerId}/agreement/override`, { status, signedByName: "Admin Override" }),
    onSuccess: () => {
      toast({ title: "Agreement status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
    },
    onError: () => toast({ title: "Override failed", variant: "destructive" }),
  });

  const TIER_LABELS: Record<string, { label: string; color: string }> = {
    tier1: { label: "Tier 1",                color: "text-white/50" },
    tier2: { label: "Tier 2 — Preferred",    color: "text-[hsl(43,78%,52%)]" },
    tier3: { label: "Tier 3 — Strategic",    color: "text-emerald-400" },
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "referrals",   label: "Referrals",   icon: TrendingUp },
    { id: "partners",    label: "Partners",    icon: Users },
    { id: "commissions", label: "Commissions", icon: DollarSign },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "settings",    label: "Settings",    icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-light text-white mb-1">Partner Network</h1>
          <p className="text-white/40 text-sm">Manage referral partners, submitted deals, and commissions</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: "Total Partners", value: stats.totalPartners, icon: Users },
              { label: "Total Referrals", value: stats.totalReferrals, icon: TrendingUp },
              { label: "Commission Pipeline", value: `$${(stats.totalCommissionValue || 0).toLocaleString()}`, icon: DollarSign },
              { label: "Commissions Paid", value: `$${(stats.paidCommissions || 0).toLocaleString()}`, icon: CheckCircle2 },
              { label: "Pending Payout", value: `$${(stats.pendingCommissions || 0).toLocaleString()}`, icon: AlertTriangle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="p-4 border border-white/8 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-xs text-white/40">{label}</span>
                </div>
                <div className="text-xl font-light text-white" data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>{value ?? "—"}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/8 mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              data-testid={`tab-${id}`}
              className={`flex items-center gap-2 px-5 py-3 text-sm transition-colors border-b-2 ${activeTab === id ? "text-[hsl(43,78%,52%)] border-[hsl(43,78%,52%)]" : "text-white/40 border-transparent hover:text-white/60"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Referrals Tab ────────────────────────────────────────────── */}
        {activeTab === "referrals" && (
          <div>
            {/* Urgency alert banner */}
            {(urgentCount > 0 || staleCount > 0) && (
              <div className="mb-4 p-3 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
                <Zap className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-white/70">
                  {urgentCount > 0 && <><span className="text-red-300 font-semibold">{urgentCount} urgent</span> (submitted &gt;48h){staleCount > 0 && " · "}</>}
                  {staleCount > 0 && <><span className="text-yellow-300 font-semibold">{staleCount} stale</span> (3+ days unactioned)</>}
                  {" "}<span className="text-white/35">— prioritised at top, sorted by AI score</span>
                </span>
              </div>
            )}
            {referralsLoading ? (
              <div className="p-8 text-center text-white/30"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : referrals.length === 0 ? (
              <div className="p-12 text-center border border-white/8 text-white/30">No referrals submitted yet.</div>
            ) : (
              <div className="space-y-3">
                {referrals.map((r: any) => {
                  const urgency = getUrgency(r);
                  return (
                  <div key={r.id} data-testid={`card-referral-${r.id}`} className={`border bg-white/[0.02] hover:bg-white/[0.04] transition-colors ${urgency?.label === "URGENT" ? "border-red-500/25" : urgency ? "border-yellow-500/20" : "border-white/8"}`}>
                    <div className="p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                          <span className="font-medium text-white">{r.clientCompany || r.clientName || "Unknown Company"}</span>
                          <StatusBadge status={r.status} />
                          {r.aiFitScore && (
                            <span className="flex items-center gap-1 text-xs text-[hsl(43,78%,52%)]">
                              <Star className="w-3 h-3" /> {r.aiFitScore}
                            </span>
                          )}
                          {urgency && (
                            <span className={`text-[10px] px-1.5 py-0.5 border font-semibold tracking-wide ${urgency.color}`}>
                              {urgency.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/40 space-x-3">
                          {r.officeLocation && <span>{r.officeLocation}</span>}
                          {r.projectType && <span>· {r.projectType}</span>}
                          {r.estimatedValue && <span>· ${Number(r.estimatedValue).toLocaleString()}</span>}
                          <span>· {timeAgo(r.createdAt)}</span>
                        </div>
                        {r.aiSummary && (
                          <p className="text-xs text-white/40 mt-2 leading-relaxed line-clamp-2">{r.aiSummary}</p>
                        )}
                        {r.aiNextBestAction && (
                          <p className="text-xs text-[hsl(43,78%,52%)]/70 mt-1.5">↳ {r.aiNextBestAction}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col gap-2 items-end">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => scoreMutation.mutate(r.id)}
                            disabled={scoreMutation.isPending}
                            data-testid={`button-score-${r.id}`}
                            variant="outline"
                            className="border-white/15 text-white/50 hover:bg-white/5 rounded-none h-7 text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> AI Score
                          </Button>
                          {r.status !== "won" && r.status !== "lost" && r.status !== "paid" && (
                            <select
                              onChange={e => { if (e.target.value) statusMutation.mutate({ id: r.id, status: e.target.value }); e.target.value = ""; }}
                              data-testid={`select-status-${r.id}`}
                              className="bg-white/5 border border-white/10 text-white/60 rounded-none px-2 py-1 text-xs focus:outline-none"
                            >
                              <option value="">Update status...</option>
                              {["reviewing", "qualified", "quoted"].map(s => (
                                <option key={s} value={s} className="bg-zinc-900">{s}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        {r.status === "qualified" || r.status === "quoted" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              const val = prompt(`Deal value for ${r.clientCompany}? (numbers only)`);
                              if (val) markWonMutation.mutate({ id: r.id, dealValue: parseInt(val.replace(/\D/g, ""), 10) });
                            }}
                            disabled={markWonMutation.isPending}
                            data-testid={`button-mark-won-${r.id}`}
                            className="bg-green-700/30 hover:bg-green-700/50 text-green-300 border border-green-700/40 rounded-none h-7 text-xs"
                          >
                            Mark Won + Create Commission
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {r.aiRiskFlagsJson?.length > 0 && (
                      <div className="px-4 pb-3 flex gap-2 flex-wrap">
                        {r.aiRiskFlagsJson.map((flag: string) => (
                          <span key={flag} className="text-xs px-2 py-0.5 bg-red-500/10 text-red-300 border border-red-500/20">{flag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Partners Tab ─────────────────────────────────────────────── */}
        {activeTab === "partners" && (
          <div>
            {partnersLoading ? (
              <div className="p-8 text-center text-white/30"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : partners.length === 0 ? (
              <div className="p-12 text-center border border-white/8 text-white/30">No partners yet. Share <strong>/partners</strong> to start recruiting.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-white/40 text-xs uppercase tracking-wide">
                      <th className="text-left py-3 pr-4">Name / Company</th>
                      <th className="text-left py-3 pr-4">Type</th>
                      <th className="text-left py-3 pr-4">Location</th>
                      <th className="text-left py-3 pr-4">Status</th>
                      <th className="text-left py-3 pr-4">Commission</th>
                      <th className="text-left py-3 pr-4">Agreement</th>
                      <th className="text-left py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p: any) => {
                      const agStatus = p.agreementStatus || "pending";
                      const agColor = agStatus === "signed" ? "text-emerald-400" : agStatus === "sent" ? "text-[hsl(43,78%,52%)]" : agStatus === "rejected" ? "text-red-400" : "text-white/30";
                      const agIcon = agStatus === "signed" ? <ShieldCheck className="w-3.5 h-3.5" /> : agStatus === "sent" ? <Send className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />;
                      const isSending = sendAgreementMutation.isPending;
                      return (
                        <tr key={p.id} data-testid={`row-partner-${p.id}`} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 pr-4">
                            <div className="text-white font-medium">{p.contactName}</div>
                            <div className="text-white/40 text-xs">{p.companyName} · {p.email}</div>
                          </td>
                          <td className="py-3 pr-4 text-white/50 text-xs">{p.partnerType}</td>
                          <td className="py-3 pr-4 text-white/50 text-xs">{p.city}, {p.state}</td>
                          <td className="py-3 pr-4"><StatusBadge status={p.onboardingStatus || p.activeStatus} /></td>
                          <td className="py-3 pr-4 text-white/50 text-xs">{((p.referralRate || 0.075) * 100).toFixed(1)}%</td>
                          <td className="py-3 pr-4">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${agColor}`} data-testid={`status-agreement-${p.id}`}>
                              {agIcon}
                              <span className="capitalize">{agStatus}</span>
                            </span>
                            {p.agreementSignedAt && (
                              <div className="text-white/25 text-[10px] mt-0.5">{timeAgo(p.agreementSignedAt)}</div>
                            )}
                            {p.agreementSentAt && agStatus === "sent" && (
                              <div className="text-white/25 text-[10px] mt-0.5">Sent {timeAgo(p.agreementSentAt)}</div>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {agStatus !== "signed" && (
                                <Button
                                  size="sm"
                                  onClick={() => sendAgreementMutation.mutate(p.id)}
                                  disabled={isSending}
                                  data-testid={`button-send-agreement-${p.id}`}
                                  className="h-7 px-2.5 text-xs bg-[hsl(43,78%,52%)]/15 hover:bg-[hsl(43,78%,52%)]/25 text-[hsl(43,78%,52%)] border border-[hsl(43,78%,52%)]/20 rounded-none font-normal"
                                  variant="ghost"
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  {agStatus === "sent" ? "Resend" : "Send"}
                                </Button>
                              )}
                              {agStatus !== "signed" && (
                                <Button
                                  size="sm"
                                  onClick={() => overrideAgreementMutation.mutate({ partnerId: p.id, status: "signed" })}
                                  data-testid={`button-override-signed-${p.id}`}
                                  className="h-7 px-2.5 text-xs bg-white/5 hover:bg-white/10 text-white/40 border border-white/8 rounded-none font-normal"
                                  variant="ghost"
                                >
                                  <ShieldCheck className="w-3 h-3 mr-1" />
                                  Mark Signed
                                </Button>
                              )}
                              {agStatus === "signed" && (
                                <Button
                                  size="sm"
                                  onClick={() => overrideAgreementMutation.mutate({ partnerId: p.id, status: "pending" })}
                                  data-testid={`button-override-reset-${p.id}`}
                                  className="h-7 px-2.5 text-xs bg-white/3 hover:bg-white/8 text-white/25 border border-white/6 rounded-none font-normal"
                                  variant="ghost"
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Commissions Tab ──────────────────────────────────────────── */}
        {activeTab === "commissions" && (
          <div>
            {commissionsLoading ? (
              <div className="p-8 text-center text-white/30"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : commissions.length === 0 ? (
              <div className="p-12 text-center border border-white/8 text-white/30">No commissions yet. Commissions are created automatically when a deal is marked won.</div>
            ) : (
              <div className="space-y-3">
                {commissions.map((c: any) => (
                  <div key={c.id} data-testid={`card-commission-${c.id}`} className="flex items-center gap-4 p-4 border border-white/8 bg-white/[0.02]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-white">${Number(c.commissionAmount).toLocaleString()} commission</span>
                        <StatusBadge status={c.paymentStatus} />
                      </div>
                      <div className="text-xs text-white/40">
                        Deal value: ${Number(c.dealValue).toLocaleString()} · Rate: {(Number(c.commissionRate) * 100).toFixed(1)}% · {timeAgo(c.createdAt)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {c.paymentStatus !== "paid" && (
                        <Button
                          size="sm"
                          onClick={() => markPaidMutation.mutate(c.referralId)}
                          disabled={markPaidMutation.isPending}
                          data-testid={`button-mark-commission-paid-${c.id}`}
                          className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black rounded-none h-7 text-xs"
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Leaderboard Tab ──────────────────────────────────────────── */}
        {activeTab === "leaderboard" && (
          <div>
            {/* Header + Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-white font-light text-lg">Partner Performance Leaderboard</h2>
                <p className="text-white/35 text-xs mt-0.5">Scored on volume · conversion · revenue · consistency · recency</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-score-all"
                  disabled={scoringAll}
                  className="border-white/10 text-white/60 hover:text-white bg-transparent rounded-none text-xs"
                  onClick={async () => {
                    setScoringAll(true);
                    try {
                      await apiRequest("POST", "/api/admin/partners/score-all", {});
                      await refetchLb();
                      toast({ title: "All partner scores updated" });
                    } catch { toast({ title: "Score sync failed", variant: "destructive" }); }
                    finally { setScoringAll(false); }
                  }}
                >
                  {scoringAll ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Sync All Scores
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <Select value={lbTierFilter} onValueChange={setLbTierFilter}>
                <SelectTrigger data-testid="select-tier-filter" className="w-48 bg-white/5 border-white/10 text-white/70 rounded-none text-xs h-8">
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="tier1">Tier 1 (Default)</SelectItem>
                  <SelectItem value="tier2">Tier 2 — Preferred</SelectItem>
                  <SelectItem value="tier3">Tier 3 — Strategic</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Filter by city..."
                value={lbCityFilter}
                onChange={e => setLbCityFilter(e.target.value)}
                data-testid="input-city-filter"
                className="w-40 h-8 bg-white/5 border-white/10 text-white text-xs rounded-none placeholder:text-white/30"
              />
            </div>

            {/* Table */}
            {lbLoading ? (
              <div className="flex items-center gap-2 text-white/30 text-sm py-12">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading leaderboard...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center text-white/25 text-sm border border-white/8">
                No signed partners found. Partners must have a signed agreement to appear.
              </div>
            ) : (
              <div className="border border-white/8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/[0.02]">
                      <th className="text-left px-4 py-3 text-xs text-white/35 font-normal w-10">#</th>
                      <th className="text-left px-4 py-3 text-xs text-white/35 font-normal">Partner</th>
                      <th className="text-left px-4 py-3 text-xs text-white/35 font-normal">Tier</th>
                      <th className="text-right px-4 py-3 text-xs text-white/35 font-normal">Score</th>
                      <th className="text-right px-4 py-3 text-xs text-white/35 font-normal">Referrals</th>
                      <th className="text-right px-4 py-3 text-xs text-white/35 font-normal">Won</th>
                      <th className="text-right px-4 py-3 text-xs text-white/35 font-normal">Conv.</th>
                      <th className="text-right px-4 py-3 text-xs text-white/35 font-normal">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs text-white/35 font-normal">Recency</th>
                      <th className="px-4 py-3 text-xs text-white/35 font-normal"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map(({ partner, score }, idx) => {
                      const tierInfo = TIER_LABELS[score.tier] || TIER_LABELS.tier1;
                      const rankBadge = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
                      return (
                        <tr key={partner.id} data-testid={`leaderboard-row-${partner.id}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-white/40 text-xs">{rankBadge}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white text-sm">{partner.companyName || "—"}</div>
                            <div className="text-white/35 text-xs">{partner.contactName}{partner.city ? ` · ${partner.city}` : ""}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs ${tierInfo.color}`}>{tierInfo.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-[hsl(43,78%,52%)] font-semibold text-sm">{score.rawScore}</span>
                            <span className="text-white/20 text-xs">/100</span>
                          </td>
                          <td className="px-4 py-3 text-right text-white/70 text-xs">{score.referralCount}</td>
                          <td className="px-4 py-3 text-right text-white/70 text-xs">{score.wonCount}</td>
                          <td className="px-4 py-3 text-right text-white/50 text-xs">{(score.conversionRate * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-right text-white/70 text-xs">${(score.totalRevenue || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white/40 text-xs">
                            {score.recencyDays >= 999 ? "Never" : score.recencyDays === 0 ? "Today" : `${score.recencyDays}d ago`}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              data-testid={`button-sync-score-${partner.id}`}
                              className="text-white/20 hover:text-white/60 transition-colors"
                              title="Sync score"
                              onClick={async () => {
                                try {
                                  await apiRequest("POST", `/api/admin/partners/${partner.id}/score`, {});
                                  await refetchLb();
                                  toast({ title: `Score updated: ${partner.companyName}` });
                                } catch { toast({ title: "Score sync failed", variant: "destructive" }); }
                              }}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary stats */}
            {leaderboard.length > 0 && (
              <div className="mt-4 flex gap-6 text-xs text-white/30">
                <span>{leaderboard.length} partners shown</span>
                <span>Avg score: {Math.round(leaderboard.reduce((s, r) => s + r.score.rawScore, 0) / leaderboard.length)}/100</span>
                <span>Tier 3: {leaderboard.filter(r => r.score.tier === "tier3").length} · Tier 2: {leaderboard.filter(r => r.score.tier === "tier2").length} · Tier 1: {leaderboard.filter(r => r.score.tier === "tier1").length}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Settings Tab ─────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="max-w-xl">
            <div className="p-6 border border-white/8 bg-white/[0.02]">
              <h2 className="font-medium text-white mb-5">Partner Network Settings</h2>
              {settings ? (
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget as HTMLFormElement);
                    try {
                      await apiRequest("PATCH", "/api/admin/partners/settings", {
                        defaultReferralRate: parseFloat(String(fd.get("defaultReferralRate"))) / 100,
                        payoutRuleText: String(fd.get("payoutRuleText")),
                        agreementTemplateVersion: String(fd.get("agreementTemplateVersion")),
                      });
                      toast({ title: "Settings saved" });
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners/settings"] });
                    } catch {
                      toast({ title: "Save failed", variant: "destructive" });
                    }
                  }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Default Commission Rate (%)</label>
                    <Input name="defaultReferralRate" type="number" step="0.1" min="0" max="100" defaultValue={((settings.defaultReferralRate || 0.075) * 100).toFixed(1)} data-testid="input-commission-rate" className="bg-white/5 border-white/10 text-white rounded-none w-32" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Payout Policy (shown to partners)</label>
                    <textarea name="payoutRuleText" defaultValue={settings.payoutRuleText} data-testid="textarea-payout-policy" className="w-full bg-white/5 border border-white/10 text-white rounded-none px-3 py-2 text-sm focus:outline-none h-24 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Agreement Template Version</label>
                    <Input name="agreementTemplateVersion" defaultValue={settings.agreementTemplateVersion} data-testid="input-agreement-version" className="bg-white/5 border-white/10 text-white rounded-none w-32" />
                  </div>
                  <Button type="submit" data-testid="button-save-settings" className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none">
                    Save Settings
                  </Button>
                </form>
              ) : (
                <div className="text-white/30 text-sm">Loading settings...</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
