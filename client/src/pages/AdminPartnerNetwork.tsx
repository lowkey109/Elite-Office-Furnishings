import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users, ArrowLeft, Search, CheckCircle, XCircle, Building2, MapPin,
  Globe, Phone, Mail, Star, TrendingUp, Award, Briefcase, Send,
  BarChart3, DollarSign, Network, Filter, RefreshCw, ChevronRight,
  AlertCircle, Zap, Target, Eye, Handshake, UserCheck, UserX,
  Plus, X, ArrowRight, Clock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";
const ADMIN_PASS = "Jaymin12!/";
const AUTH_KEY = "tcd_admin_auth";

type Partner = {
  id: string; companyName: string; partnerType: string; contactName: string;
  email: string; phone?: string; website?: string; city?: string; state?: string;
  serviceRegions?: string[]; industrySpecialties?: string[]; servicesOffered?: string[];
  companySize?: string; bio?: string; activeStatus: string; rating?: number;
  totalOpportunitiesReceived?: number; totalProjectsWon?: number; totalRevenueGenerated?: number;
  adminNotes?: string; approvedAt?: string; createdAt: string;
};
type PartnerOpportunity = {
  id: string; partnerId: string; opportunityTitle: string; companyName?: string;
  city?: string; industry?: string; projectType?: string; estimatedProjectValue?: number;
  relocationScore?: number; sourceType?: string; status: string; createdAt: string;
};
type NetworkSummary = {
  totalPartners: number; activePartners: number; pendingPartners: number;
  totalOpportunitiesRouted: number; totalProjectsWon: number; totalNetworkRevenue: number;
  conversionRate: number;
  partnerTypeBreakdown: Record<string, number>;
  topPerformers: Array<{ id: string; companyName: string; type: string; won: number; revenue: number }>;
};

const PARTNER_TYPE_LABELS: Record<string, string> = {
  broker: "Property Broker", tenant_rep: "Tenant Rep", architect: "Architect",
  designer: "Interior Designer", builder: "Builder / Fitout", furniture_supplier: "Furniture Supplier",
  mover: "Office Mover", finance_partner: "Finance Partner", technology_partner: "Technology Partner",
};
const PARTNER_TYPE_COLORS: Record<string, string> = {
  broker: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  tenant_rep: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  architect: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  designer: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  builder: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  furniture_supplier: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  mover: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  finance_partner: "bg-green-500/20 text-green-300 border-green-500/30",
  technology_partner: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  suspended: "bg-red-500/20 text-red-300 border-red-500/30",
};

function formatCurrency(v?: number) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(v);
}

export default function AdminPartnerNetwork() {
  const [authed, setAuthed] = useState(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    return stored === `${ADMIN_EMAIL}:${ADMIN_PASS}` || stored === "true";
  });
  const [pw, setPw] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeForm, setRouteForm] = useState({ opportunityTitle: "", companyName: "", city: "", industry: "", projectType: "relocation", estimatedProjectValue: "" });
  const [activeTab, setActiveTab] = useState<"partners" | "opportunities" | "commissions">("partners");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: partners = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["/api/admin/partners"],
    enabled: authed,
  });
  const { data: summary } = useQuery<NetworkSummary>({
    queryKey: ["/api/admin/partners/summary"],
    enabled: authed,
  });
  const { data: selectedDetail } = useQuery<{ partner: Partner; opportunities: PartnerOpportunity[]; referrals: any[]; revenue: any[] }>({
    queryKey: ["/api/admin/partners", selectedPartner?.id],
    enabled: !!selectedPartner,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/partners/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] }); toast({ title: "Partner approved" }); },
  });
  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/partners/${id}/suspend`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] }); toast({ title: "Partner suspended" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/partners/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] }); setSelectedPartner(null); toast({ title: "Partner removed" }); },
  });
  const routeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/partners/route-opportunity", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      setShowRouteModal(false);
      toast({ title: `Routed to ${data.routed} partner${data.routed !== 1 ? "s" : ""}` });
    },
  });

  const { data: commissionList, isLoading: commissionsLoading, refetch: refetchCommissions } = useQuery<{
    total: number; pending: number; approved: number; paid: number;
    totalPayableAud: number; totalPaidAud: number;
    commissions: Array<{
      id: string; partnerId: string; partnerName?: string; dealId?: string;
      dealExecutionId?: string; type: string; status: string; amount: number;
      invoiceRef?: string; notes?: string; createdAt: string;
    }>;
  }>({
    queryKey: ["/api/commissions"],
    enabled: authed && activeTab === "commissions",
    refetchInterval: activeTab === "commissions" ? 30000 : false,
  });

  const approveCommissionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/commissions/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/commissions"] }); toast({ title: "Commission approved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const markPaidMutation = useMutation({
    mutationFn: ({ id, invoiceRef }: { id: string; invoiceRef?: string }) => apiRequest("POST", `/api/commissions/${id}/mark-paid`, { invoiceRef }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/commissions"] }); toast({ title: "Commission marked paid" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><Network className="w-5 h-5 text-blue-400" /></div>
            <div><div className="text-white font-semibold">Partner Network</div><div className="text-zinc-500 text-sm">Admin access required</div></div>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Admin password" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm mb-3 outline-none" onKeyDown={e => { if (e.key === "Enter") { if (pw === ADMIN_PASS) { sessionStorage.setItem(AUTH_KEY, `${ADMIN_EMAIL}:${pw}`); setAuthed(true); } } }} />
          <button onClick={() => { if (pw === ADMIN_PASS) { sessionStorage.setItem(AUTH_KEY, `${ADMIN_EMAIL}:${pw}`); setAuthed(true); } }} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-medium">Access Partner Network</button>
        </div>
      </div>
    );
  }

  const filtered = partners.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.companyName.toLowerCase().includes(q) || p.contactName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.city ?? "").toLowerCase().includes(q);
    const matchType = typeFilter === "all" || p.partnerType === typeFilter;
    const matchStatus = statusFilter === "all" || p.activeStatus === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/command-centre" className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center"><Network className="w-5 h-5 text-blue-400" /></div>
              <div><div className="text-white font-semibold text-lg">Partner Network</div><div className="text-zinc-500 text-xs">Manage ecosystem partners and opportunity routing</div></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowRouteModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors">
              <Send className="w-4 h-4" /> Route Opportunity
            </button>
            <Link href="/partner-onboarding" className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Partner Onboarding Link
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Tiles */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: "Total Partners", value: summary.totalPartners, icon: Users, color: "blue" },
              { label: "Active Partners", value: summary.activePartners, icon: CheckCircle, color: "emerald" },
              { label: "Pending Approval", value: summary.pendingPartners, icon: Clock, color: "amber" },
              { label: "Opportunities Sent", value: summary.totalOpportunitiesRouted, icon: Send, color: "violet" },
              { label: "Projects Won", value: summary.totalProjectsWon, icon: Award, color: "green" },
              { label: "Conversion Rate", value: `${summary.conversionRate}%`, icon: TrendingUp, color: "cyan" },
              { label: "Network Revenue", value: formatCurrency(summary.totalNetworkRevenue), icon: DollarSign, color: "yellow" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-${color}-500/30 transition-all`}>
                <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center mb-3`}><Icon className={`w-4 h-4 text-${color}-400`} /></div>
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-zinc-500 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-zinc-800 pb-0">
          {(["partners", "opportunities", "commissions"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors capitalize ${activeTab === tab ? "bg-zinc-900 text-white border border-b-0 border-zinc-800" : "text-zinc-500 hover:text-white"}`}
              data-testid={`tab-${tab}`}
            >
              {tab === "partners" && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{tab}</span>}
              {tab === "opportunities" && <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{tab}</span>}
              {tab === "commissions" && <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />{tab}</span>}
            </button>
          ))}
        </div>

        {/* Commissions Tab */}
        {activeTab === "commissions" && (
          <div className="space-y-6">
            {/* Commission KPI Row */}
            {commissionList && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Pending", value: commissionList.pending, color: "text-amber-400" },
                  { label: "Approved", value: commissionList.approved, color: "text-blue-400" },
                  { label: "Paid", value: commissionList.paid, color: "text-green-400" },
                  { label: "Total Payable", value: `$${(commissionList.totalPayableAud ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-amber-300" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">All Commissions</h3>
              <button onClick={() => refetchCommissions()} className="p-2 text-zinc-500 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {commissionsLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-16 animate-pulse" />)}</div>
            ) : !commissionList?.commissions?.length ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <DollarSign className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <div className="text-zinc-400 font-medium">No commissions yet</div>
                <div className="text-zinc-600 text-sm mt-1">Commissions are auto-created when deals are marked won</div>
              </div>
            ) : (
              <div className="space-y-2">
                {commissionList.commissions.map(c => (
                  <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">{c.partnerName ?? c.partnerId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${c.status === "paid" ? "bg-green-500/20 text-green-300 border-green-500/30" : c.status === "approved" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>{c.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-zinc-500 text-xs">{c.type}</span>
                        {c.dealId && <span className="text-zinc-600 text-xs">Deal: {c.dealId.slice(0, 8)}</span>}
                        {c.invoiceRef && <span className="text-zinc-600 text-xs">Ref: {c.invoiceRef}</span>}
                        <span className="text-zinc-600 text-xs">{new Date(c.createdAt).toLocaleDateString("en-AU")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-amber-400 font-semibold">${(c.amount / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                      {c.status === "pending" && (
                        <button onClick={() => approveCommissionMutation.mutate(c.id)} disabled={approveCommissionMutation.isPending} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" data-testid={`button-approve-commission-${c.id}`}>Approve</button>
                      )}
                      {c.status === "approved" && (
                        <button onClick={() => { const ref = prompt("Invoice reference (optional):") ?? undefined; markPaidMutation.mutate({ id: c.id, invoiceRef: ref }); }} disabled={markPaidMutation.isPending} className="bg-green-600/20 hover:bg-green-600/40 text-green-300 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" data-testid={`button-mark-paid-commission-${c.id}`}>Mark Paid</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab !== "commissions" && <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Partner Table */}
          <div className="xl:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search partners..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-600" data-testid="input-partner-search" />
              </div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none" data-testid="select-partner-type">
                <option value="all">All Types</option>
                {Object.entries(PARTNER_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none" data-testid="select-partner-status">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] })} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-20 animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <Network className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <div className="text-zinc-400 font-medium">No partners found</div>
                <div className="text-zinc-600 text-sm mt-1">Use the onboarding form to invite partners</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(partner => (
                  <div key={partner.id} onClick={() => setSelectedPartner(partner)} className={`bg-zinc-900 border rounded-2xl p-4 cursor-pointer transition-all hover:border-zinc-600 ${selectedPartner?.id === partner.id ? "border-blue-500/50 bg-zinc-800/50" : "border-zinc-800"}`} data-testid={`card-partner-${partner.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium truncate">{partner.companyName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${PARTNER_TYPE_COLORS[partner.partnerType] ?? "bg-zinc-700 text-zinc-300"}`}>{PARTNER_TYPE_LABELS[partner.partnerType] ?? partner.partnerType}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[partner.activeStatus] ?? "bg-zinc-700 text-zinc-300"}`}>{partner.activeStatus}</span>
                          </div>
                          <div className="text-zinc-400 text-sm mt-0.5">{partner.contactName} · {partner.email}</div>
                          <div className="flex items-center gap-4 mt-1">
                            {partner.city && <span className="flex items-center gap-1 text-zinc-500 text-xs"><MapPin className="w-3 h-3" />{partner.city}{partner.state ? `, ${partner.state}` : ""}</span>}
                            <span className="text-zinc-500 text-xs">{partner.totalOpportunitiesReceived ?? 0} opportunities · {partner.totalProjectsWon ?? 0} won</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {partner.activeStatus === "pending" && (
                          <>
                            <button onClick={e => { e.stopPropagation(); approveMutation.mutate(partner.id); }} className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" data-testid={`button-approve-${partner.id}`}><CheckCircle className="w-3 h-3" /> Approve</button>
                            <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(partner.id); }} className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"><XCircle className="w-3 h-3" /> Decline</button>
                          </>
                        )}
                        {partner.activeStatus === "active" && (
                          <button onClick={e => { e.stopPropagation(); suspendMutation.mutate(partner.id); }} className="flex items-center gap-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" data-testid={`button-suspend-${partner.id}`}><UserX className="w-3 h-3" /> Suspend</button>
                        )}
                        {partner.activeStatus === "suspended" && (
                          <button onClick={e => { e.stopPropagation(); approveMutation.mutate(partner.id); }} className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"><UserCheck className="w-3 h-3" /> Reactivate</button>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar — Partner Detail / Network Stats */}
          <div className="space-y-4">
            {selectedPartner && selectedDetail ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-white font-medium">Partner Detail</span>
                  <button onClick={() => setSelectedPartner(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-white font-semibold text-lg">{selectedDetail.partner.companyName}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${PARTNER_TYPE_COLORS[selectedDetail.partner.partnerType] ?? ""}`}>{PARTNER_TYPE_LABELS[selectedDetail.partner.partnerType] ?? selectedDetail.partner.partnerType}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[selectedDetail.partner.activeStatus] ?? ""}`}>{selectedDetail.partner.activeStatus}</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-zinc-400"><Mail className="w-3.5 h-3.5" />{selectedDetail.partner.email}</div>
                    {selectedDetail.partner.phone && <div className="flex items-center gap-2 text-zinc-400"><Phone className="w-3.5 h-3.5" />{selectedDetail.partner.phone}</div>}
                    {selectedDetail.partner.city && <div className="flex items-center gap-2 text-zinc-400"><MapPin className="w-3.5 h-3.5" />{selectedDetail.partner.city}{selectedDetail.partner.state ? `, ${selectedDetail.partner.state}` : ""}</div>}
                    {selectedDetail.partner.website && <div className="flex items-center gap-2 text-zinc-400"><Globe className="w-3.5 h-3.5" /><a href={selectedDetail.partner.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{selectedDetail.partner.website}</a></div>}
                  </div>
                  {selectedDetail.partner.bio && <p className="text-zinc-400 text-xs leading-relaxed">{selectedDetail.partner.bio}</p>}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800">
                    {[
                      { label: "Opportunities", value: selectedDetail.partner.totalOpportunitiesReceived ?? 0 },
                      { label: "Won", value: selectedDetail.partner.totalProjectsWon ?? 0 },
                      { label: "Revenue", value: formatCurrency(selectedDetail.partner.totalRevenueGenerated) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-zinc-800 rounded-xl p-3 text-center">
                        <div className="text-white font-semibold text-sm">{value}</div>
                        <div className="text-zinc-500 text-xs">{label}</div>
                      </div>
                    ))}
                  </div>
                  {selectedDetail.partner.serviceRegions && selectedDetail.partner.serviceRegions.length > 0 && (
                    <div><div className="text-zinc-500 text-xs mb-2">Service Regions</div><div className="flex flex-wrap gap-1">{selectedDetail.partner.serviceRegions.map(r => <span key={r} className="bg-zinc-800 text-zinc-300 rounded-lg px-2 py-0.5 text-xs">{r}</span>)}</div></div>
                  )}
                  {/* Opportunities list */}
                  {selectedDetail.opportunities.length > 0 && (
                    <div>
                      <div className="text-zinc-500 text-xs mb-2">Recent Opportunities ({selectedDetail.opportunities.length})</div>
                      <div className="space-y-2">
                        {selectedDetail.opportunities.slice(0, 5).map(op => (
                          <div key={op.id} className="bg-zinc-800 rounded-xl p-2.5">
                            <div className="text-white text-xs font-medium truncate">{op.opportunityTitle}</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-zinc-500 text-xs">{op.city ?? "AU"} · {op.projectType ?? "—"}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${op.status === "accepted" ? "bg-emerald-500/20 text-emerald-300" : op.status === "won" ? "bg-blue-500/20 text-blue-300" : op.status === "declined" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>{op.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-zinc-800">
                    {selectedDetail.partner.activeStatus === "pending" && <button onClick={() => approveMutation.mutate(selectedDetail.partner.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 text-xs font-medium">Approve</button>}
                    {selectedDetail.partner.activeStatus === "active" && <button onClick={() => suspendMutation.mutate(selectedDetail.partner.id)} className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 rounded-xl py-2 text-xs font-medium">Suspend</button>}
                    <button onClick={() => deleteMutation.mutate(selectedDetail.partner.id)} className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl py-2 text-xs font-medium">Remove</button>
                  </div>
                </div>
              </div>
            ) : (
              /* Network Stats Panel */
              summary && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-800"><span className="text-white font-medium">Network Breakdown</span></div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-zinc-500 text-xs mb-2">Partner Types</div>
                      <div className="space-y-2">
                        {Object.entries(summary.partnerTypeBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-zinc-300 text-sm">{PARTNER_TYPE_LABELS[type] ?? type}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${PARTNER_TYPE_COLORS[type] ?? "bg-zinc-700 text-zinc-300"}`}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {summary.topPerformers.length > 0 && (
                      <div>
                        <div className="text-zinc-500 text-xs mb-2">Top Performers</div>
                        <div className="space-y-2">
                          {summary.topPerformers.map((p, i) => (
                            <div key={p.id} className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold">{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-medium truncate">{p.companyName}</div>
                                <div className="text-zinc-500 text-xs">{p.won} projects won</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>}
      </div>

      {/* Route Opportunity Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2"><Send className="w-5 h-5 text-blue-400" /><span className="text-white font-medium">Route Opportunity to Partners</span></div>
              <button onClick={() => setShowRouteModal(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Opportunity Title *</label>
                <input value={routeForm.opportunityTitle} onChange={e => setRouteForm(f => ({ ...f, opportunityTitle: e.target.value }))} placeholder="e.g. Acme Corp — Office Relocation" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-zinc-500" data-testid="input-route-title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Company Name</label>
                  <input value={routeForm.companyName} onChange={e => setRouteForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Company name" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">City</label>
                  <input value={routeForm.city} onChange={e => setRouteForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Sydney" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-zinc-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Industry</label>
                  <input value={routeForm.industry} onChange={e => setRouteForm(f => ({ ...f, industry: e.target.value }))} placeholder="e.g. Technology" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Project Type</label>
                  <select value={routeForm.projectType} onChange={e => setRouteForm(f => ({ ...f, projectType: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                    <option value="relocation">Relocation</option>
                    <option value="expansion">Expansion</option>
                    <option value="refit">Refit</option>
                    <option value="new_office">New Office</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Estimated Project Value ($)</label>
                <input value={routeForm.estimatedProjectValue} onChange={e => setRouteForm(f => ({ ...f, estimatedProjectValue: e.target.value }))} placeholder="e.g. 150000" type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-zinc-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowRouteModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-2.5 text-sm">Cancel</button>
                <button onClick={() => { if (!routeForm.opportunityTitle) return; routeMutation.mutate({ ...routeForm, estimatedProjectValue: routeForm.estimatedProjectValue ? parseInt(routeForm.estimatedProjectValue) : undefined }); }} disabled={routeMutation.isPending || !routeForm.opportunityTitle} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium" data-testid="button-submit-route">
                  {routeMutation.isPending ? "Routing..." : "Route to Partners"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
