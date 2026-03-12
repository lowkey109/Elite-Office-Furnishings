import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Handshake, Search, CheckCircle, XCircle, Building2, MapPin,
  DollarSign, Calendar, Eye, TrendingUp, Award, Briefcase,
  Clock, ArrowRight, Target, Zap, RefreshCw, Mail, X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Partner = {
  id: string; companyName: string; partnerType: string; contactName: string;
  email: string; phone?: string; city?: string; state?: string;
  activeStatus: string; totalOpportunitiesReceived?: number; totalProjectsWon?: number;
};
type Opportunity = {
  id: string; opportunityTitle: string; companyName?: string; city?: string;
  industry?: string; projectType?: string; officeSizeSqm?: string;
  staffCount?: string; estimatedProjectValue?: number; relocationScore?: number;
  sourceType?: string; routingReason?: string; status: string;
  createdAt: string; viewedAt?: string; notes?: string;
};

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  viewed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  accepted: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  declined: "bg-red-500/20 text-red-300 border-red-500/30",
  won: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  lost: "bg-zinc-600/30 text-zinc-400 border-zinc-600/40",
};
const PROJECT_TYPE_LABELS: Record<string, string> = {
  relocation: "Office Relocation", expansion: "Office Expansion",
  refit: "Office Refit", new_office: "New Office",
};

function formatCurrency(v?: number) {
  if (!v) return "N/A";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(v);
}

export default function PartnerDashboard() {
  const [email, setEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [responseNote, setResponseNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ partner: Partner; opportunities: Opportunity[]; referrals: any[] }>({
    queryKey: ["/api/partner-dashboard", email],
    enabled: !!email,
    queryFn: () => fetch(`/api/partner-dashboard/${encodeURIComponent(email)}`).then(r => {
      if (!r.ok) throw new Error("Partner not found");
      return r.json();
    }),
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

  if (!email) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><Handshake className="w-5 h-5 text-blue-400" /></div>
            <div>
              <div className="text-white font-semibold">Partner Dashboard</div>
              <div className="text-zinc-500 text-sm">The Corporate Desk Partner Network</div>
            </div>
          </div>
          <p className="text-zinc-400 text-sm mb-5">Enter your partner email address to access your dashboard and view assigned opportunities.</p>
          <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && emailInput) setEmail(emailInput); }} placeholder="Your partner email address" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm mb-3 outline-none focus:border-zinc-600" data-testid="input-partner-email" />
          <button onClick={() => emailInput && setEmail(emailInput)} disabled={!emailInput} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-medium transition-colors" data-testid="button-partner-login">Access My Dashboard</button>
          <p className="text-zinc-600 text-xs mt-4 text-center">Not yet a partner? <a href="/partner-onboarding" className="text-blue-400 hover:underline">Apply here</a></p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading your dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <div className="text-white font-medium mb-2">Partner not found</div>
          <p className="text-zinc-400 text-sm mb-5">No partner account found for <strong>{email}</strong>. Please check your email or apply to join the network.</p>
          <button onClick={() => setEmail("")} className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-5 py-2.5 text-sm">Try Again</button>
        </div>
      </div>
    );
  }

  const { partner, opportunities } = data;
  const pending = opportunities.filter(o => o.status === "invited");
  const active = opportunities.filter(o => ["viewed", "accepted"].includes(o.status));
  const closed = opportunities.filter(o => ["won", "lost", "declined"].includes(o.status));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center"><Handshake className="w-5 h-5 text-blue-400" /></div>
            <div>
              <div className="text-white font-semibold">Partner Dashboard</div>
              <div className="text-zinc-500 text-xs">The Corporate Desk Partner Network</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white text-sm font-medium">{partner.companyName}</div>
              <div className="text-zinc-500 text-xs">{partner.contactName}</div>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-xs border ${partner.activeStatus === "active" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>{partner.activeStatus}</div>
            <button onClick={() => setEmail("")} className="text-zinc-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "New Opportunities", value: pending.length, icon: Zap, color: "amber" },
            { label: "Active Engagements", value: active.length, icon: Target, color: "blue" },
            { label: "Total Received", value: partner.totalOpportunitiesReceived ?? 0, icon: Briefcase, color: "violet" },
            { label: "Projects Won", value: partner.totalProjectsWon ?? 0, icon: Award, color: "emerald" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-${color}-500/20 transition-all`}>
              <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center mb-3`}><Icon className={`w-4 h-4 text-${color}-400`} /></div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-zinc-500 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Pending Opportunities */}
        {pending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-semibold">New Opportunities <span className="text-amber-400">({pending.length})</span></h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {pending.map(opp => (
                <div key={opp.id} className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-5 hover:border-amber-500/50 transition-all" data-testid={`card-opportunity-${opp.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{opp.opportunityTitle}</div>
                      {opp.companyName && <div className="text-zinc-400 text-xs mt-0.5">{opp.companyName}</div>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[opp.status]}`}>{opp.status}</span>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {opp.city && <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><MapPin className="w-3 h-3" />{opp.city}</div>}
                    {opp.industry && <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><Briefcase className="w-3 h-3" />{opp.industry}</div>}
                    {opp.projectType && <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><Target className="w-3 h-3" />{PROJECT_TYPE_LABELS[opp.projectType] ?? opp.projectType}</div>}
                    {opp.estimatedProjectValue && <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium"><DollarSign className="w-3 h-3" />{formatCurrency(opp.estimatedProjectValue)}</div>}
                    {opp.officeSizeSqm && <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><Building2 className="w-3 h-3" />{opp.officeSizeSqm} sqm</div>}
                    {opp.relocationScore && <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><TrendingUp className="w-3 h-3" />{opp.relocationScore}% relocation probability</div>}
                  </div>
                  {opp.routingReason && <p className="text-zinc-500 text-xs mb-3 italic">{opp.routingReason}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedOpp(opp); respondMutation.mutate({ id: opp.id, status: "viewed" }); }} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-xl py-2 text-xs font-medium transition-colors" data-testid={`button-view-${opp.id}`}><Eye className="w-3.5 h-3.5" /> View Details</button>
                    <button onClick={() => respondMutation.mutate({ id: opp.id, status: "accepted" })} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-xl py-2 text-xs font-medium transition-colors" data-testid={`button-accept-${opp.id}`}><CheckCircle className="w-3.5 h-3.5" /> Accept</button>
                    <button onClick={() => { setSelectedOpp(opp); }} className="flex items-center justify-center p-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-xl transition-colors" data-testid={`button-decline-${opp.id}`}><XCircle className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active */}
        {active.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold">Active Engagements ({active.length})</h2>
            </div>
            <div className="space-y-3">
              {active.map(opp => (
                <div key={opp.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{opp.opportunityTitle}</div>
                    <div className="flex items-center gap-3 mt-1">
                      {opp.city && <span className="text-zinc-500 text-xs">{opp.city}</span>}
                      {opp.estimatedProjectValue && <span className="text-emerald-400 text-xs font-medium">{formatCurrency(opp.estimatedProjectValue)}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[opp.status]}`}>{opp.status}</span>
                  {opp.status === "accepted" && (
                    <button onClick={() => respondMutation.mutate({ id: opp.id, status: "won" })} className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 rounded-xl px-3 py-1.5 text-xs font-medium">Mark Won</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {opportunities.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
            <Briefcase className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <div className="text-zinc-400 font-medium">No opportunities yet</div>
            <p className="text-zinc-600 text-sm mt-1">Our team will route relevant opportunities to you based on your coverage and specialties.</p>
          </div>
        )}
      </div>

      {/* Opportunity Detail Modal */}
      {selectedOpp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-white font-medium">Opportunity Details</span>
              <button onClick={() => setSelectedOpp(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <h3 className="text-white font-semibold">{selectedOpp.opportunityTitle}</h3>
              <div className="grid grid-cols-2 gap-3">
                {selectedOpp.city && <div className="bg-zinc-800 rounded-xl p-3"><div className="text-zinc-500 text-xs">Location</div><div className="text-white text-sm">{selectedOpp.city}</div></div>}
                {selectedOpp.industry && <div className="bg-zinc-800 rounded-xl p-3"><div className="text-zinc-500 text-xs">Industry</div><div className="text-white text-sm">{selectedOpp.industry}</div></div>}
                {selectedOpp.officeSizeSqm && <div className="bg-zinc-800 rounded-xl p-3"><div className="text-zinc-500 text-xs">Office Size</div><div className="text-white text-sm">{selectedOpp.officeSizeSqm} sqm</div></div>}
                {selectedOpp.staffCount && <div className="bg-zinc-800 rounded-xl p-3"><div className="text-zinc-500 text-xs">Staff Count</div><div className="text-white text-sm">{selectedOpp.staffCount}</div></div>}
                {selectedOpp.estimatedProjectValue && <div className="bg-zinc-800 rounded-xl p-3"><div className="text-zinc-500 text-xs">Est. Value</div><div className="text-emerald-400 font-medium text-sm">{formatCurrency(selectedOpp.estimatedProjectValue)}</div></div>}
                {selectedOpp.relocationScore && <div className="bg-zinc-800 rounded-xl p-3"><div className="text-zinc-500 text-xs">Probability</div><div className="text-white text-sm">{selectedOpp.relocationScore}%</div></div>}
              </div>
              {selectedOpp.routingReason && <div className="bg-zinc-800/60 rounded-xl p-3 border border-zinc-700"><div className="text-zinc-500 text-xs mb-1">Why you were matched</div><p className="text-zinc-300 text-sm">{selectedOpp.routingReason}</p></div>}
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Notes (optional)</label>
                <textarea value={responseNote} onChange={e => setResponseNote(e.target.value)} rows={3} placeholder="Any questions or notes for the team..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => respondMutation.mutate({ id: selectedOpp.id, status: "accepted", notes: responseNote })} disabled={respondMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 inline mr-1" /> Accept</button>
                <button onClick={() => respondMutation.mutate({ id: selectedOpp.id, status: "declined", notes: responseNote })} disabled={respondMutation.isPending} className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl py-2.5 text-sm font-medium"><XCircle className="w-4 h-4 inline mr-1" /> Decline</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
