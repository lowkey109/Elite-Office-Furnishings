import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Handshake, XCircle, Building2, MapPin, DollarSign, Calendar,
  TrendingUp, Award, Briefcase, Zap, X, CheckCircle2, Clock,
  Star, ArrowRight, Target, AlertTriangle, FileText, Lock,
} from "lucide-react";
import { Link } from "wouter";

type Partner = {
  id: string; companyName: string; partnerType: string; contactName: string;
  email: string; phone?: string; city?: string; state?: string;
  activeStatus: string; onboardingStatus?: string; referralRate?: number;
  totalOpportunitiesReceived?: number; totalProjectsWon?: number;
  agreementStatus?: string; agreementSentAt?: string; agreementSignedAt?: string;
};

type Opportunity = {
  id: string; opportunityTitle: string; companyName?: string; city?: string;
  industry?: string; projectType?: string; officeSizeSqm?: string;
  staffCount?: string; estimatedProjectValue?: number; relocationScore?: number;
  sourceType?: string; routingReason?: string; status: string;
  createdAt: string; viewedAt?: string; notes?: string;
};

type Referral = {
  id: string; clientCompany?: string; contactName?: string;
  officeLocation?: string; projectType?: string; estimatedValue?: number;
  status: string; aiFitScore?: number; aiSummary?: string;
  aiNextBestAction?: string; createdAt: string;
};

type Commission = {
  id: string; dealValue: number; commissionAmount: number; commissionRate: number;
  paymentStatus: string; createdAt: string; paidAt?: string;
};

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-[hsl(43,78%,52%)]/10 text-[hsl(43,78%,65%)] border-[hsl(43,78%,52%)]/20",
  viewed: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  accepted: "bg-green-500/10 text-green-300 border-green-500/20",
  declined: "bg-red-500/10 text-red-300 border-red-500/20",
  won: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  lost: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
  submitted: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  reviewing: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  qualified: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  quoted: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  paid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  pending: "bg-white/10 text-white/40 border-white/10",
  active: "bg-green-500/10 text-green-300 border-green-500/20",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge className={`${STATUS_COLORS[status] || "bg-white/10 text-white/40 border-white/10"} capitalize text-xs`}>{status}</Badge>;
}

function formatCurrency(v?: number) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(v);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function PartnerDashboard() {
  const [email, setEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [activeTab, setActiveTab] = useState<"referrals" | "opportunities" | "commissions">("referrals");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [responseNote, setResponseNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ partner: Partner; opportunities: Opportunity[]; referrals: Referral[] }>({
    queryKey: ["/api/partner-dashboard", email],
    enabled: !!email,
    queryFn: () => fetch(`/api/partner-dashboard/${encodeURIComponent(email)}`).then(r => {
      if (!r.ok) throw new Error("Partner not found");
      return r.json();
    }),
  });

  const { data: commissions = [] } = useQuery<Commission[]>({
    queryKey: ["/api/partners", data?.partner?.id, "commissions"],
    enabled: !!data?.partner?.id && activeTab === "commissions",
    queryFn: () => fetch(`/api/partners/${data!.partner.id}/commissions`).then(r => r.json()),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/partner-opportunities/${id}/respond`, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-dashboard", email] });
      setSelectedOpp(null);
      setResponseNote("");
      toast({ title: "Response submitted" });
    },
  });

  // ── Unauthenticated state ────────────────────────────────────────────────────
  if (!email) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 border border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/5 mb-5">
              <Handshake className="w-5 h-5 text-[hsl(43,78%,52%)]" />
            </div>
            <h1 className="text-2xl font-light text-white mb-2">Partner Dashboard</h1>
            <p className="text-white/40 text-sm">The Corporate Desk Partner Network</p>
          </div>
          <div className="border border-white/8 bg-white/[0.02] p-8">
            <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Your Partner Email</label>
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && emailInput) setEmail(emailInput); }}
              placeholder="your@email.com"
              data-testid="input-partner-email"
              className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm mb-4 outline-none focus:border-white/20 placeholder:text-white/20"
            />
            <Button
              onClick={() => emailInput && setEmail(emailInput)}
              disabled={!emailInput}
              data-testid="button-partner-login"
              className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none"
            >
              Access My Dashboard
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <p className="text-white/25 text-xs mt-4 text-center">
              Not yet a partner?{" "}
              <Link href="/partners" className="text-[hsl(43,78%,52%)] hover:underline">Apply to join</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-white/30 text-sm">Loading your dashboard...</div>
      </div>
    );
  }

  // ── Error / Not Found ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
        <div className="border border-white/8 bg-white/[0.02] p-8 max-w-md w-full text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-medium mb-2">Partner not found</h2>
          <p className="text-white/40 text-sm mb-6">
            No partner account found for <strong className="text-white/60">{email}</strong>. Check your email or apply to join the network.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setEmail("")} variant="outline" className="border-white/20 text-white hover:bg-white/5 rounded-none" data-testid="button-partner-retry">Try Again</Button>
            <Button asChild className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black rounded-none" data-testid="button-partner-apply">
              <Link href="/partners">Apply to Join</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { partner, opportunities = [], referrals = [] } = data;

  // ── Agreement Gate ──────────────────────────────────────────────────────────
  if (partner.agreementStatus !== "signed") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white">
        <div className="border-b border-white/8 bg-[#0f0f0f]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex flex-col cursor-pointer">
                <span className="text-sm font-serif font-bold text-white leading-tight">THE CORPORATE</span>
                <span className="text-[9px] font-serif tracking-[0.3em] text-[hsl(43,78%,52%)] uppercase">DESK</span>
              </Link>
              <div className="w-px h-6 bg-white/10 mx-1" />
              <div className="text-white/50 text-sm">Partner Dashboard</div>
            </div>
            <button onClick={() => setEmail("")} className="text-white/30 hover:text-white/70 p-1" data-testid="button-partner-logout">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 border border-amber-500/20 bg-amber-500/5 mb-6">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-2xl font-light text-white mb-3">Agreement Required</h2>
          <p className="text-white/50 leading-relaxed mb-8">
            Hi {partner.contactName} — your account is approved, but you need to sign your Partner Referral Agreement before accessing your dashboard and submitting referrals.
          </p>

          {partner.agreementStatus === "sent" && (
            <div className="border border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/4 p-5 mb-8 text-left">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/80 font-medium mb-1">Your agreement is ready to sign</p>
                  <p className="text-xs text-white/45 leading-relaxed">
                    Check your inbox at <span className="text-white/65">{partner.email}</span> for the agreement email from The Corporate Desk. The email contains a direct link to review and sign.
                  </p>
                </div>
              </div>
            </div>
          )}

          {partner.agreementStatus === "pending" && (
            <div className="border border-white/8 bg-white/[0.02] p-5 mb-8 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/80 font-medium mb-1">Agreement not yet sent</p>
                  <p className="text-xs text-white/45 leading-relaxed">
                    Your application is under review. Once approved, you will receive an agreement email. Contact us to expedite.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-white/30 text-sm mb-6">
            Need help? Call <span className="text-white/55">1300 977 607</span> or email{" "}
            <a href="mailto:service@thecorporatedesk.com.au" className="text-[hsl(43,78%,52%)] hover:underline">
              service@thecorporatedesk.com.au
            </a>
          </p>

          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => setEmail("")}
              variant="outline"
              className="border-white/15 text-white/50 hover:bg-white/5 rounded-none"
              data-testid="button-agreement-back"
            >
              Back
            </Button>
            <Button asChild className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none" data-testid="button-agreement-contact">
              <a href="mailto:service@thecorporatedesk.com.au?subject=Partner Agreement Request">Contact Us</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  const pendingOpps = opportunities.filter(o => o.status === "invited");
  const activeOpps = opportunities.filter(o => ["viewed", "accepted"].includes(o.status));
  const paidComms = commissions.filter(c => c.paymentStatus === "paid");
  const pendingComms = commissions.filter(c => c.paymentStatus !== "paid");
  const totalEarned = paidComms.reduce((s, c) => s + (c.commissionAmount || 0), 0);
  const pipelineValue = pendingComms.reduce((s, c) => s + (c.commissionAmount || 0), 0);

  const referralRate = (partner.referralRate || 0.075) * 100;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">

      {/* ── Dashboard Header ─────────────────────────────────────────────── */}
      <div className="border-b border-white/8 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex flex-col cursor-pointer">
              <span className="text-sm font-serif font-bold text-white leading-tight">THE CORPORATE</span>
              <span className="text-[9px] font-serif tracking-[0.3em] text-[hsl(43,78%,52%)] uppercase">DESK</span>
            </Link>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <div>
              <div className="text-white/70 text-sm">Partner Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-white text-sm font-medium">{partner.companyName}</div>
              <div className="text-white/40 text-xs">{partner.contactName}</div>
            </div>
            <StatusBadge status={partner.onboardingStatus || partner.activeStatus} />
            <button onClick={() => setEmail("")} className="text-white/30 hover:text-white/70 p-1" data-testid="button-partner-logout">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "New Opportunities", value: pendingOpps.length, icon: Zap, highlight: pendingOpps.length > 0 },
            { label: "Active Referrals", value: referrals.length, icon: Target, highlight: false },
            { label: "Commission Earned", value: formatCurrency(totalEarned), icon: DollarSign, highlight: false },
            { label: "Commission Rate", value: `${referralRate.toFixed(1)}%`, icon: Award, highlight: false },
          ].map(({ label, value, icon: Icon, highlight }) => (
            <div key={label} data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`} className={`p-4 border ${highlight ? "border-[hsl(43,78%,52%)]/30 bg-[hsl(43,78%,52%)]/5" : "border-white/8 bg-white/[0.02]"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${highlight ? "text-[hsl(43,78%,52%)]" : "text-white/30"}`} />
                <span className="text-xs text-white/40">{label}</span>
              </div>
              <div className="text-xl font-light text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex border-b border-white/8">
          {([
            { id: "referrals", label: `My Referrals (${referrals.length})` },
            { id: "opportunities", label: `Opportunities (${opportunities.length})` },
            { id: "commissions", label: "Commissions" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              data-testid={`tab-partner-${id}`}
              className={`px-5 py-3 text-sm transition-colors border-b-2 ${activeTab === id ? "text-[hsl(43,78%,52%)] border-[hsl(43,78%,52%)]" : "text-white/40 border-transparent hover:text-white/60"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Referrals Tab ─────────────────────────────────────────────── */}
        {activeTab === "referrals" && (
          <div>
            {referrals.length === 0 ? (
              <div className="p-12 text-center border border-white/8">
                <Target className="w-8 h-8 text-white/20 mx-auto mb-4" />
                <p className="text-white/40 text-sm mb-2">No referrals submitted yet</p>
                <p className="text-white/25 text-xs mb-6">Have a client considering a workspace project? Submit a deal and earn 7.5% on every won deal.</p>
                <Button asChild className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black rounded-none" data-testid="button-partner-submit-deal">
                  <Link href="/submit-deal">Submit a Deal</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((r: Referral) => (
                  <div key={r.id} data-testid={`card-referral-${r.id}`} className="p-4 border border-white/8 bg-white/[0.02] hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="font-medium text-white text-sm truncate">{r.clientCompany || r.contactName || "Unnamed"}</span>
                          <StatusBadge status={r.status} />
                          {r.aiFitScore && (
                            <span className="flex items-center gap-1 text-xs text-[hsl(43,78%,52%)]">
                              <Star className="w-3 h-3" /> {r.aiFitScore}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/40 space-x-3">
                          {r.officeLocation && <span>{r.officeLocation}</span>}
                          {r.projectType && <span>· {r.projectType}</span>}
                          {r.estimatedValue && <span>· {formatCurrency(r.estimatedValue)}</span>}
                          <span>· {timeAgo(r.createdAt)}</span>
                        </div>
                        {r.aiSummary && <p className="text-xs text-white/30 mt-2 leading-relaxed">{r.aiSummary}</p>}
                        {r.aiNextBestAction && (
                          <p className="text-xs text-[hsl(43,78%,52%)]/60 mt-1.5 flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3" /> {r.aiNextBestAction}
                          </p>
                        )}
                      </div>
                      {r.estimatedValue && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-white/30 mb-0.5">Potential commission</div>
                          <div className="text-sm font-medium text-[hsl(43,78%,52%)]">
                            {formatCurrency(r.estimatedValue * (partner.referralRate || 0.075))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Button asChild variant="outline" className="border-white/15 text-white/50 hover:bg-white/5 rounded-none" data-testid="button-submit-another">
                    <Link href="/submit-deal">Submit Another Deal</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Opportunities Tab ─────────────────────────────────────────── */}
        {activeTab === "opportunities" && (
          <div>
            {opportunities.length === 0 ? (
              <div className="p-12 text-center border border-white/8">
                <Briefcase className="w-8 h-8 text-white/20 mx-auto mb-4" />
                <p className="text-white/40 text-sm">No opportunities assigned yet</p>
                <p className="text-white/25 text-xs mt-2">Opportunities from our deal hunting engine will appear here as they match your profile.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp: Opportunity) => (
                  <div key={opp.id} data-testid={`card-opportunity-${opp.id}`} className={`p-4 border ${opp.status === "invited" ? "border-[hsl(43,78%,52%)]/25 bg-[hsl(43,78%,52%)]/3" : "border-white/8 bg-white/[0.02]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="font-medium text-white text-sm truncate">{opp.opportunityTitle || opp.companyName}</span>
                          <StatusBadge status={opp.status} />
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-white/40 mt-1">
                          {opp.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {opp.city}</span>}
                          {opp.projectType && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {opp.projectType}</span>}
                          {opp.estimatedProjectValue && <span className="flex items-center gap-1 text-[hsl(43,78%,52%)]"><DollarSign className="w-3 h-3" /> {formatCurrency(opp.estimatedProjectValue)}</span>}
                          {opp.officeSizeSqm && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {opp.officeSizeSqm} sqm</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(opp.createdAt)}</span>
                        </div>
                        {opp.routingReason && <p className="text-xs text-white/30 mt-2">{opp.routingReason}</p>}
                      </div>
                      {opp.status === "invited" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <Button size="sm" onClick={() => respondMutation.mutate({ id: opp.id, status: "accepted" })} disabled={respondMutation.isPending} data-testid={`button-accept-opp-${opp.id}`} className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black rounded-none h-7 text-xs">Accept</Button>
                          <Button size="sm" onClick={() => respondMutation.mutate({ id: opp.id, status: "declined" })} disabled={respondMutation.isPending} variant="outline" data-testid={`button-decline-opp-${opp.id}`} className="border-white/15 text-white/50 hover:bg-white/5 rounded-none h-7 text-xs">Decline</Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Commissions Tab ───────────────────────────────────────────── */}
        {activeTab === "commissions" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Earned", value: formatCurrency(totalEarned), highlight: true },
                { label: "In Pipeline", value: formatCurrency(pipelineValue), highlight: false },
                { label: "Commission Rate", value: `${referralRate.toFixed(1)}%`, highlight: false },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`p-4 border ${highlight ? "border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/5" : "border-white/8 bg-white/[0.02]"}`}>
                  <div className="text-xs text-white/40 mb-1">{label}</div>
                  <div className={`text-lg font-light ${highlight ? "text-[hsl(43,78%,52%)]" : "text-white"}`}>{value}</div>
                </div>
              ))}
            </div>

            {commissions.length === 0 ? (
              <div className="p-12 text-center border border-white/8 text-white/30">
                <DollarSign className="w-8 h-8 mx-auto mb-4 text-white/20" />
                <p className="text-sm">No commissions yet — commissions are created when a referred deal is marked won.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {commissions.map((c: Commission) => (
                  <div key={c.id} data-testid={`card-commission-${c.id}`} className="flex items-center gap-4 p-4 border border-white/8 bg-white/[0.02]">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-white">{formatCurrency(c.commissionAmount)}</span>
                        <StatusBadge status={c.paymentStatus} />
                      </div>
                      <div className="text-xs text-white/40">
                        Deal value: {formatCurrency(c.dealValue)} · Rate: {(c.commissionRate * 100).toFixed(1)}% · {timeAgo(c.createdAt)}
                      </div>
                    </div>
                    {c.paymentStatus === "paid" && c.paidAt && (
                      <div className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Paid {timeAgo(c.paidAt)}
                      </div>
                    )}
                    {c.paymentStatus === "pending" && (
                      <div className="text-xs text-white/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Awaiting payment
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
