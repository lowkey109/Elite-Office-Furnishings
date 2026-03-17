import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, FileText, Eye, Send, CheckCircle2, XCircle,
  RefreshCw, Plus, ChevronRight, AlertTriangle, Clock, Loader2,
  DollarSign, Zap, BarChart3, Edit3,
} from "lucide-react";

const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";
const ADMIN_PASS = "Jaymin12!/";
const AUTH_KEY = "tcd_admin_auth";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-300",
  sent: "bg-blue-500/20 text-blue-300",
  viewed: "bg-amber-500/20 text-amber-300",
  approved: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
};

const PIPELINE_STAGES = ["lead", "qualified", "meeting_booked", "proposal_sent", "negotiation", "approved", "won", "lost"];

export default function ProposalEngine() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(() => {
    const s = sessionStorage.getItem(AUTH_KEY);
    return s === "true" || s === `${ADMIN_EMAIL}:${ADMIN_PASS}`;
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [showPricingCalc, setShowPricingCalc] = useState(false);
  const [pricingInput, setPricingInput] = useState({ costPrice: 0, sellPrice: 0, discountPercent: 0 });
  const [pricingResult, setPricingResult] = useState<any>(null);

  const { data: proposals = [], refetch, isLoading } = useQuery<any[]>({
    queryKey: ["/api/proposals"],
    queryFn: () => fetch(`/api/proposals${filterStatus ? `?status=${filterStatus}` : ""}`).then(r => r.json()),
    enabled: authed,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/proposals/stats"],
    enabled: authed,
  });

  const { data: quotes = [] } = useQuery<any[]>({
    queryKey: ["/api/quotes"],
    enabled: authed,
  });

  const { data: pendingApprovals = [] } = useQuery<any[]>({
    queryKey: ["/api/approvals"],
    queryFn: () => fetch("/api/approvals?status=pending").then(r => r.json()),
    enabled: authed,
  });

  const generateMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const r = await fetch("/api/proposals/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId }) });
      return r.json();
    },
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Proposal Generated", description: `Draft proposal created for quote.` });
      qc.invalidateQueries({ queryKey: ["/api/proposals"] });
      qc.invalidateQueries({ queryKey: ["/api/proposals/stats"] });
    },
    onError: () => toast({ title: "Generation failed", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/proposals/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      return r.json();
    },
    onSuccess: () => { toast({ title: "Status Updated" }); qc.invalidateQueries({ queryKey: ["/api/proposals"] }); },
  });

  const approveDealMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      const r = await fetch(`/api/approvals/${approvalId}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvedBy: "admin@thecorporatedesk.com.au" }) });
      return r.json();
    },
    onSuccess: () => { toast({ title: "Deal Approved" }); qc.invalidateQueries({ queryKey: ["/api/approvals"] }); qc.invalidateQueries({ queryKey: ["/api/admin/deal-closing/stats"] }); },
  });

  const calcPricing = async () => {
    const r = await fetch("/api/pricing/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ costPrice: pricingInput.costPrice * 100, sellPrice: pricingInput.sellPrice * 100, discountPercent: pricingInput.discountPercent }) });
    const data = await r.json();
    setPricingResult(data.pricing);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,18%,7%)] flex items-center justify-center">
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-[hsl(43,78%,52%)]" />
            <span className="text-white font-bold">Proposal Engine</span>
          </div>
          <p className="text-white/40 text-xs mb-4">Admin access required</p>
          <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Admin email" className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm mb-3 placeholder-white/20" data-testid="input-login-email" />
          <input type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} placeholder="Password" className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm mb-4 placeholder-white/20" data-testid="input-login-password" />
          <button onClick={() => { if (loginEmail === ADMIN_EMAIL && loginPw === ADMIN_PASS) { sessionStorage.setItem(AUTH_KEY, "true"); setAuthed(true); } else { toast({ title: "Incorrect credentials", variant: "destructive" }); } }} className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,18%,7%)] font-bold py-2.5 rounded-xl transition-colors" data-testid="btn-admin-login">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,18%,7%)] text-white">
      <header className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4 flex items-center gap-4">
        <Link href="/admin/command-centre">
          <button className="text-white/40 hover:text-white transition-colors" data-testid="btn-back-acc">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[hsl(43,78%,52%)]" />
          <h1 className="text-white font-bold text-lg">Proposal Engine</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowPricingCalc(!showPricingCalc)} className="flex items-center gap-2 bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.2)] rounded-xl px-3 py-2 text-[hsl(43,78%,52%)] text-xs font-semibold transition-colors" data-testid="btn-toggle-pricing-calc">
            <DollarSign className="w-3.5 h-3.5" /> Pricing Calculator
          </button>
          <button onClick={() => refetch()} className="text-white/30 hover:text-white/60 transition-colors p-2" data-testid="btn-refresh-proposals">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Draft", value: stats?.draft ?? 0, color: "text-gray-400" },
            { label: "Sent", value: stats?.sent ?? 0, color: "text-blue-400" },
            { label: "Viewed", value: stats?.viewed ?? 0, color: "text-amber-400" },
            { label: "Approved", value: stats?.approved ?? 0, color: "text-green-400" },
            { label: "Rejected", value: stats?.rejected ?? 0, color: "text-red-400" },
            { label: "Total", value: stats?.total ?? 0, color: "text-white" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-white/40 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Pricing Calculator */}
        {showPricingCalc && (
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.18)] rounded-2xl p-5">
            <h2 className="text-[hsl(43,78%,52%)] font-semibold text-sm mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Pricing Engine Calculator</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: "Cost Price ($)", key: "costPrice" },
                { label: "Sell Price ($)", key: "sellPrice" },
                { label: "Discount (%)", key: "discountPercent" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-white/40 text-xs mb-1 block">{label}</label>
                  <input
                    type="number"
                    value={(pricingInput as any)[key]}
                    onChange={e => setPricingInput(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm"
                    data-testid={`input-pricing-${key}`}
                  />
                </div>
              ))}
            </div>
            <button onClick={calcPricing} className="bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.2)] rounded-xl px-4 py-2 text-[hsl(43,78%,52%)] text-xs font-semibold transition-colors" data-testid="btn-calculate-pricing">
              Calculate
            </button>
            {pricingResult && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Margin %", value: `${pricingResult.marginPercent}%`, color: pricingResult.marginPercent >= 15 ? "text-green-400" : "text-red-400" },
                  { label: "Margin $", value: `$${(pricingResult.marginAmount / 100).toFixed(2)}`, color: "text-white" },
                  { label: "Discount $", value: `$${(pricingResult.discountAmount / 100).toFixed(2)}`, color: "text-amber-400" },
                  { label: "Final Price", value: `$${(pricingResult.discountedSellPrice / 100).toFixed(2)}`, color: "text-blue-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3">
                    <p className="text-white/40 text-[10px] uppercase">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                  </div>
                ))}
                {pricingResult.requiresApproval && (
                  <div className="col-span-full flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-amber-300 text-sm">{pricingResult.approvalReason}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,180,50,0.25)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-semibold text-sm">Deals Awaiting Approval ({pendingApprovals.length})</h2>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {pendingApprovals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-white text-sm font-semibold">{a.triggerReason || "Approval Required"}</p>
                    <p className="text-white/40 text-xs">Quote: {a.quoteId} · Margin: {a.marginAtApproval ? `${(a.marginAtApproval / 10).toFixed(1)}%` : "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveDealMutation.mutate(a.id)} className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg px-3 py-1.5 text-green-400 text-xs font-semibold transition-colors" data-testid={`btn-approve-deal-${a.id}`}>
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => { const note = prompt("Rejection reason:"); if(note) fetch(`/api/approvals/${a.id}/reject`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({note,approvedBy:"admin@thecorporatedesk.com.au"})}).then(()=>qc.invalidateQueries({queryKey:["/api/approvals"]})); }} className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-3 py-1.5 text-red-400 text-xs font-semibold transition-colors" data-testid={`btn-reject-deal-${a.id}`}>
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Proposals List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Proposals</h2>
              <div className="flex items-center gap-2">
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); qc.invalidateQueries({ queryKey: ["/api/proposals"] }); }}
                  className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-white/60 text-xs"
                  data-testid="select-filter-status"
                >
                  <option value="">All Statuses</option>
                  {["draft","sent","viewed","approved","rejected"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
                <select
                  onChange={e => { if(e.target.value) generateMutation.mutate(e.target.value); e.target.value = ""; }}
                  className="bg-[rgba(100,220,150,0.08)] border border-[rgba(100,220,150,0.2)] rounded-lg px-2 py-1.5 text-green-400 text-xs"
                  data-testid="select-generate-from-quote"
                >
                  <option value="">+ Generate from Quote</option>
                  {quotes.map((q: any) => <option key={q.id} value={q.id}>{q.quoteNumber} – {q.clientName}</option>)}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[hsl(43,78%,52%)] animate-spin" /></div>
            ) : proposals.length === 0 ? (
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl py-16 text-center">
                <FileText className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No proposals yet</p>
                <p className="text-white/20 text-xs mt-1">Generate a proposal from a Quote Builder quote</p>
              </div>
            ) : (
              <div className="space-y-2">
                {proposals.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProposal(p)}
                    className={`bg-[hsl(220,18%,10%)] border rounded-xl px-5 py-4 cursor-pointer transition-all ${selectedProposal?.id === p.id ? "border-[rgba(201,168,76,0.4)]" : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"}`}
                    data-testid={`card-proposal-${p.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-semibold text-sm">{p.title || `Proposal – ${p.clientName}`}</p>
                        <p className="text-white/40 text-xs mt-0.5">{p.companyName || p.clientName} · v{p.version}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[p.status] || "bg-gray-500/20 text-gray-300"}`}>{p.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={e => { e.stopPropagation(); window.open(`/api/proposals/${p.id}/html`, "_blank"); }} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors" data-testid={`btn-preview-proposal-${p.id}`}>
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                      {p.status === "draft" && (
                        <button onClick={e => { e.stopPropagation(); updateStatusMutation.mutate({ id: p.id, status: "sent" }); }} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors" data-testid={`btn-mark-sent-${p.id}`}>
                          <Send className="w-3 h-3" /> Mark Sent
                        </button>
                      )}
                      {(p.status === "sent" || p.status === "viewed") && (
                        <>
                          <button onClick={e => { e.stopPropagation(); updateStatusMutation.mutate({ id: p.id, status: "approved" }); }} className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs transition-colors" data-testid={`btn-mark-approved-${p.id}`}>
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </button>
                          <button onClick={e => { e.stopPropagation(); updateStatusMutation.mutate({ id: p.id, status: "rejected" }); }} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs transition-colors" data-testid={`btn-mark-rejected-${p.id}`}>
                            <XCircle className="w-3 h-3" /> Rejected
                          </button>
                        </>
                      )}
                      <span className="text-white/20 text-[10px] ml-auto">{new Date(p.createdAt).toLocaleDateString("en-AU")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Proposal Preview */}
          <div className="space-y-4">
            {selectedProposal ? (
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">Proposal Detail</h3>
                  <button onClick={() => setSelectedProposal(null)} className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none">×</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">Client</p>
                    <p className="text-white text-sm font-semibold">{selectedProposal.clientName}</p>
                    {selectedProposal.companyName && <p className="text-white/50 text-xs">{selectedProposal.companyName}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Status", value: selectedProposal.status },
                      { label: "Version", value: `v${selectedProposal.version}` },
                      { label: "Valid Until", value: selectedProposal.validUntil ? new Date(selectedProposal.validUntil).toLocaleDateString("en-AU") : "—" },
                      { label: "Sent", value: selectedProposal.sentAt ? new Date(selectedProposal.sentAt).toLocaleDateString("en-AU") : "Not sent" },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2.5">
                        <p className="text-white/40 text-[10px]">{label}</p>
                        <p className="text-white text-xs font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => window.open(`/api/proposals/${selectedProposal.id}/html`, "_blank")} className="flex-1 flex items-center justify-center gap-2 bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.2)] rounded-xl py-2.5 text-[hsl(43,78%,52%)] text-xs font-semibold transition-colors" data-testid="btn-open-proposal-preview">
                      <Eye className="w-3.5 h-3.5" /> Open Preview
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider">Change Status</p>
                    {["draft","sent","viewed","approved","rejected"].map(s => (
                      <button key={s} onClick={() => updateStatusMutation.mutate({ id: selectedProposal.id, status: s })} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${selectedProposal.status === s ? STATUS_COLORS[s] : "bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] text-white/40"}`} data-testid={`btn-set-status-${s}`}>
                        {s.charAt(0).toUpperCase()+s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl py-12 text-center">
                <Eye className="w-6 h-6 text-white/20 mx-auto mb-2" />
                <p className="text-white/30 text-xs">Select a proposal to view details</p>
              </div>
            )}

            {/* Pipeline Stage Manager */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Pipeline Stages</h3>
              </div>
              <div className="p-4 space-y-1.5">
                {PIPELINE_STAGES.map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-[rgba(201,168,76,0.3)] flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)]" />
                    </div>
                    <p className="text-white/60 text-xs capitalize flex-1">{stage.replace(/_/g, " ")}</p>
                    {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-white/20" />}
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <p className="text-white/20 text-[10px]">Use quote pricing endpoint to set pipeline stage on any quote</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
