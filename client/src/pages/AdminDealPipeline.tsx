/**
 * Admin Deal Pipeline — inbound leads from enquiry form
 * Covers: pipeline status, qualification, outreach message templates + approval
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, MessageSquare, Check, Copy, RefreshCw,
  Clock, BarChart3, CheckCircle2, Zap,
} from "lucide-react";

const PIPELINE_STATUSES = [
  { value: "new",          label: "New",         color: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
  { value: "contacted",    label: "Contacted",   color: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" },
  { value: "qualified",    label: "Qualified",   color: "bg-purple-500/10 text-purple-300 border-purple-500/20" },
  { value: "proposal",     label: "Proposal",    color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" },
  { value: "negotiating",  label: "Negotiating", color: "bg-orange-500/10 text-orange-300 border-orange-500/20" },
  { value: "won",          label: "Won",         color: "bg-green-500/10 text-green-300 border-green-500/20" },
  { value: "lost",         label: "Lost",        color: "bg-red-500/10 text-red-300 border-red-500/20" },
];

const STATUS_MAP = Object.fromEntries(PIPELINE_STATUSES.map(s => [s.value, s]));

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, color: "bg-white/10 text-white/50 border-white/10" };
  return <Badge className={`${s.color} capitalize`}>{s.label}</Badge>;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function getFollowUpFlag(lead: any): { label: string; color: string } | null {
  const status = lead.leadStatus || "new";
  if (status === "won" || status === "lost") return null;
  if (!lead.createdAt) return null;
  const ageH = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60);
  if (ageH >= 72 && status === "new") return { label: "STALE 3d+", color: "bg-red-500/15 text-red-300 border-red-500/25" };
  if (ageH >= 24 && status === "new") return { label: "FOLLOW UP", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" };
  return null;
}

type ActivePanel = "pipeline" | "templates";

export default function AdminDealPipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activePanel, setActivePanel] = useState<ActivePanel>("pipeline");
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: leads = [], isLoading: leadsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/leads/pipeline"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/lead-templates"],
    enabled: activePanel === "templates",
  });

  const { data: outreachLog = [], isLoading: outreachLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/leads", selectedLead, "outreach"],
    queryFn: async () => {
      if (!selectedLead) return [];
      const res = await apiRequest("GET", `/api/admin/leads/${selectedLead}/outreach`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedLead,
  });

  // ── Filtered leads ────────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    return leads.filter((l: any) => {
      if (statusFilter !== "all" && (l.leadStatus || "new") !== statusFilter) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        if (!(l.name || "").toLowerCase().includes(q) && !(l.company || "").toLowerCase().includes(q) && !(l.email || "").toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a: any, b: any) => {
      const flagA = getFollowUpFlag(a);
      const flagB = getFollowUpFlag(b);
      if (flagA && !flagB) return -1;
      if (!flagA && flagB) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leads, statusFilter, searchFilter]);

  const selectedLeadData = leads.find((l: any) => l.id === selectedLead);

  // ── Pipeline update mutation ──────────────────────────────────────────────
  const pipelineMutation = useMutation({
    mutationFn: (data: { id: string; fields: Record<string, any> }) =>
      apiRequest("PATCH", `/api/admin/leads/${data.id}/pipeline`, data.fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/pipeline"] });
      toast({ title: "Lead updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  // ── Compose outreach ──────────────────────────────────────────────────────
  const [composing, setComposing] = useState(false);
  const [composeTemplate, setComposeTemplate] = useState("initial_contact");
  const [customMessage, setCustomMessage] = useState("");
  const [composeNotes, setComposeNotes] = useState("");

  const composeMutation = useMutation({
    mutationFn: (data: { leadId: string; templateType: string; customMessage?: string; notes?: string }) =>
      apiRequest("POST", `/api/admin/leads/${data.leadId}/outreach/compose`, {
        templateType: data.templateType,
        customMessage: data.customMessage || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads", selectedLead, "outreach"] });
      toast({ title: "Message drafted — awaiting approval" });
      setComposing(false);
      setCustomMessage("");
      setComposeNotes("");
    },
    onError: () => toast({ title: "Compose failed", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (data: { leadId: string; outreachId: string }) =>
      apiRequest("PATCH", `/api/admin/leads/${data.leadId}/outreach/${data.outreachId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads", selectedLead, "outreach"] });
      toast({ title: "Message approved ✓" });
    },
    onError: () => toast({ title: "Approval failed", variant: "destructive" }),
  });

  // ── Template edit state ───────────────────────────────────────────────────
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateBody, setTemplateBody] = useState<string>("");

  const templateSaveMutation = useMutation({
    mutationFn: (data: { type: string; body: string; label: string }) =>
      apiRequest("PUT", `/api/admin/lead-templates/${data.type}`, { body: data.body, label: data.label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lead-templates"] });
      toast({ title: "Template saved" });
      setEditingTemplate(null);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  // ── Pipeline stats ────────────────────────────────────────────────────────
  const pipelineStats = useMemo(() => ({
    total: leads.length,
    new: leads.filter((l: any) => (l.leadStatus || "new") === "new").length,
    contacted: leads.filter((l: any) => l.leadStatus === "contacted").length,
    qualified: leads.filter((l: any) => l.leadStatus === "qualified").length,
    won: leads.filter((l: any) => l.leadStatus === "won").length,
    followUp: leads.filter((l: any) => getFollowUpFlag(l)).length,
  }), [leads]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light text-white mb-1">Deal Closing Pipeline</h1>
            <p className="text-white/40 text-sm">Inbound enquiries · pipeline qualification · outreach management</p>
          </div>
          <div className="flex gap-1 border-b border-white/8">
            <button
              onClick={() => setActivePanel("pipeline")}
              data-testid="tab-pipeline"
              className={`px-5 py-3 text-sm border-b-2 transition-colors -mb-px ${activePanel === "pipeline" ? "text-[hsl(43,78%,52%)] border-[hsl(43,78%,52%)]" : "text-white/40 border-transparent hover:text-white/60"}`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setActivePanel("templates")}
              data-testid="tab-templates"
              className={`px-5 py-3 text-sm border-b-2 transition-colors -mb-px ${activePanel === "templates" ? "text-[hsl(43,78%,52%)] border-[hsl(43,78%,52%)]" : "text-white/40 border-transparent hover:text-white/60"}`}
            >
              Message Templates
            </button>
          </div>
        </div>

        {/* ── Pipeline Panel ───────────────────────────────────────────────── */}
        {activePanel === "pipeline" && (
          <div>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
              {([
                { label: "Total Leads",    value: pipelineStats.total,     icon: BarChart3 },
                { label: "New",            value: pipelineStats.new,        icon: Zap },
                { label: "Contacted",      value: pipelineStats.contacted,  icon: MessageSquare },
                { label: "Qualified",      value: pipelineStats.qualified,  icon: CheckCircle2 },
                { label: "Won",            value: pipelineStats.won,        icon: Check },
                { label: "Need Follow-up", value: pipelineStats.followUp,   icon: Clock },
              ] as const).map(({ label, value, icon: Icon }) => (
                <div key={label} className="p-3 border border-white/8 bg-white/[0.02]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3 h-3 text-white/30" />
                    <span className="text-xs text-white/40">{label}</span>
                  </div>
                  <div className="text-xl font-light text-white" data-testid={`stat-pipeline-${label.toLowerCase().replace(/ /g, "-")}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Follow-up banner */}
            {pipelineStats.followUp > 0 && (
              <div className="mb-4 p-3 border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-3">
                <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-sm text-white/70">
                  <span className="text-yellow-300 font-semibold">{pipelineStats.followUp} lead{pipelineStats.followUp !== 1 ? "s" : ""}</span> need follow-up action — sorted to top
                </span>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter" className="w-44 bg-white/5 border-white/10 text-white/70 rounded-none text-xs h-8">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">All Statuses</SelectItem>
                  {PIPELINE_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search name, company, email..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                data-testid="input-search-leads"
                className="w-56 h-8 bg-white/5 border-white/10 text-white text-xs rounded-none placeholder:text-white/30"
              />
            </div>

            {/* Lead list + detail panel */}
            <div className="flex gap-5">
              {/* Lead list */}
              <div className="flex-1 min-w-0">
                {leadsLoading ? (
                  <div className="flex items-center gap-2 text-white/30 text-sm py-12">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading leads...
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="py-12 text-center text-white/25 text-sm border border-white/8">
                    No leads found matching your filters.
                  </div>
                ) : (
                  <div className="border border-white/8 divide-y divide-white/5">
                    {filteredLeads.map((lead: any) => {
                      const flag = getFollowUpFlag(lead);
                      const isSelected = selectedLead === lead.id;
                      return (
                        <div
                          key={lead.id}
                          data-testid={`lead-row-${lead.id}`}
                          className={`p-4 cursor-pointer transition-colors hover:bg-white/[0.025] ${isSelected ? "bg-white/[0.04] border-l-2 border-l-[hsl(43,78%,52%)]" : "border-l-2 border-l-transparent"}`}
                          onClick={() => setSelectedLead(isSelected ? null : lead.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-white text-sm">{lead.name || "Unknown"}</span>
                                {lead.company && <span className="text-white/40 text-xs">· {lead.company}</span>}
                                {flag && (
                                  <Badge className={`${flag.color} text-[10px] px-1.5 py-0`}>{flag.label}</Badge>
                                )}
                              </div>
                              <div className="text-white/35 text-xs mt-0.5">{lead.email || "—"}{lead.phone ? ` · ${lead.phone}` : ""}</div>
                              {lead.message && (
                                <div className="text-white/30 text-xs mt-1.5 line-clamp-1">{lead.message}</div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <StatusBadge status={lead.leadStatus || "new"} />
                              <span className="text-white/25 text-xs">{timeAgo(lead.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selectedLeadData && (
                <div className="w-96 shrink-0 border border-white/8 bg-white/[0.02] p-5 space-y-5 max-h-[80vh] overflow-y-auto">
                  <div>
                    <h3 className="font-medium text-white text-base">{selectedLeadData.name || "—"}</h3>
                    <p className="text-white/40 text-xs mt-0.5">{selectedLeadData.email}{selectedLeadData.phone ? ` · ${selectedLeadData.phone}` : ""}</p>
                    {selectedLeadData.company && <p className="text-white/50 text-xs mt-1">{selectedLeadData.company}</p>}
                  </div>

                  {/* Enquiry message */}
                  {selectedLeadData.message && (
                    <div>
                      <div className="text-xs text-white/35 uppercase tracking-wide mb-2">Enquiry</div>
                      <p className="text-white/60 text-xs leading-relaxed">{selectedLeadData.message}</p>
                    </div>
                  )}

                  {/* Pipeline status update */}
                  <div>
                    <div className="text-xs text-white/35 uppercase tracking-wide mb-2">Pipeline Status</div>
                    <Select
                      value={selectedLeadData.leadStatus || "new"}
                      onValueChange={val => pipelineMutation.mutate({ id: selectedLeadData.id, fields: { leadStatus: val } })}
                    >
                      <SelectTrigger data-testid="select-lead-status" className="w-full bg-white/5 border-white/10 text-white rounded-none text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-white/10">
                        {PIPELINE_STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Qualification fields */}
                  <div className="space-y-3">
                    <div className="text-xs text-white/35 uppercase tracking-wide">Qualification</div>
                    <div>
                      <label className="block text-xs text-white/30 mb-1">Budget Range</label>
                      <Input
                        key={`budget-${selectedLeadData.id}`}
                        defaultValue={selectedLeadData.budgetRange || ""}
                        placeholder="e.g. $50k–$100k"
                        data-testid="input-budget-range"
                        className="bg-white/5 border-white/10 text-white rounded-none text-xs h-7"
                        onBlur={e => {
                          if (e.target.value !== (selectedLeadData.budgetRange || "")) {
                            pipelineMutation.mutate({ id: selectedLeadData.id, fields: { budgetRange: e.target.value } });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-1">Next Action</label>
                      <Input
                        key={`action-${selectedLeadData.id}`}
                        defaultValue={selectedLeadData.nextAction || ""}
                        placeholder="e.g. Send quote by Friday"
                        data-testid="input-next-action"
                        className="bg-white/5 border-white/10 text-white rounded-none text-xs h-7"
                        onBlur={e => {
                          if (e.target.value !== (selectedLeadData.nextAction || "")) {
                            pipelineMutation.mutate({ id: selectedLeadData.id, fields: { nextAction: e.target.value } });
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-white/30">Has Floorplan?</label>
                      <input
                        type="checkbox"
                        data-testid="checkbox-has-floorplan"
                        defaultChecked={selectedLeadData.hasFloorplan}
                        className="accent-[hsl(43,78%,52%)]"
                        onChange={e => pipelineMutation.mutate({ id: selectedLeadData.id, fields: { hasFloorplan: e.target.checked } })}
                      />
                    </div>
                  </div>

                  {/* Outreach log */}
                  <div>
                    <div className="text-xs text-white/35 uppercase tracking-wide mb-3">Outreach Messages</div>

                    {!composing && (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="button-compose-message"
                        className="border-white/10 text-white/60 hover:text-white bg-transparent rounded-none text-xs mb-3 w-full"
                        onClick={() => setComposing(true)}
                      >
                        <MessageSquare className="w-3 h-3 mr-1" /> Compose Message
                      </Button>
                    )}

                    {/* Compose panel */}
                    {composing && (
                      <div className="mb-4 p-3 border border-white/10 bg-white/[0.02] space-y-3">
                        <div>
                          <label className="block text-xs text-white/30 mb-1">Template</label>
                          <Select value={composeTemplate} onValueChange={setComposeTemplate}>
                            <SelectTrigger data-testid="select-compose-template" className="bg-white/5 border-white/10 text-white rounded-none text-xs h-7">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-white/10">
                              <SelectItem value="initial_contact">Initial Contact</SelectItem>
                              <SelectItem value="follow_up_1">Follow-up #1 (24h)</SelectItem>
                              <SelectItem value="follow_up_2">Follow-up #2 (3 days)</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {composeTemplate === "custom" && (
                          <textarea
                            value={customMessage}
                            onChange={e => setCustomMessage(e.target.value)}
                            data-testid="textarea-custom-message"
                            placeholder="Write your custom message..."
                            className="w-full bg-white/5 border border-white/10 text-white rounded-none px-3 py-2 text-xs focus:outline-none h-24 resize-none placeholder:text-white/25"
                          />
                        )}
                        <div>
                          <label className="block text-xs text-white/30 mb-1">Notes (internal)</label>
                          <Input
                            value={composeNotes}
                            onChange={e => setComposeNotes(e.target.value)}
                            placeholder="Internal notes..."
                            data-testid="input-compose-notes"
                            className="bg-white/5 border-white/10 text-white rounded-none text-xs h-7"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            data-testid="button-submit-compose"
                            className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black rounded-none text-xs flex-1"
                            disabled={composeMutation.isPending || (composeTemplate === "custom" && !customMessage.trim())}
                            onClick={() => composeMutation.mutate({
                              leadId: selectedLeadData.id,
                              templateType: composeTemplate,
                              customMessage: composeTemplate === "custom" ? customMessage : undefined,
                              notes: composeNotes || undefined,
                            })}
                          >
                            {composeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Draft Message
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid="button-cancel-compose"
                            className="border-white/10 text-white/50 bg-transparent rounded-none text-xs"
                            onClick={() => setComposing(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Outreach history */}
                    {outreachLoading ? (
                      <div className="text-white/25 text-xs flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
                    ) : outreachLog.length === 0 ? (
                      <div className="text-white/20 text-xs">No outreach messages yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {outreachLog.map((o: any) => (
                          <div key={o.id} data-testid={`outreach-row-${o.id}`} className="p-3 border border-white/8 bg-white/[0.015]">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="text-white/50 text-xs capitalize">{(o.templateType || "").replace(/_/g, " ")}</span>
                              <div className="flex items-center gap-2">
                                {o.adminApproved ? (
                                  <Badge className="bg-green-500/10 text-green-300 border-green-500/20 text-[10px]">Approved</Badge>
                                ) : (
                                  <Badge className="bg-yellow-500/10 text-yellow-300 border-yellow-500/20 text-[10px]">Pending</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-white/60 text-xs leading-relaxed whitespace-pre-wrap mb-2">{o.renderedMessage}</p>
                            <div className="flex items-center gap-3">
                              <button
                                data-testid={`button-copy-${o.id}`}
                                className="text-white/25 hover:text-white/60 text-xs flex items-center gap-1 transition-colors"
                                onClick={() => {
                                  navigator.clipboard.writeText(o.renderedMessage);
                                  toast({ title: "Copied to clipboard" });
                                }}
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                              {!o.adminApproved && (
                                <button
                                  data-testid={`button-approve-${o.id}`}
                                  className="text-green-400/60 hover:text-green-400 text-xs flex items-center gap-1 transition-colors"
                                  onClick={() => approveMutation.mutate({ leadId: selectedLeadData.id, outreachId: o.id })}
                                >
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                              )}
                            </div>
                            {o.notes && <p className="text-white/25 text-xs mt-1 italic">{o.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Templates Panel ──────────────────────────────────────────────── */}
        {activePanel === "templates" && (
          <div className="max-w-3xl space-y-4">
            <p className="text-white/40 text-sm mb-6">
              These templates are auto-personalised with the lead's first name via{" "}
              <code className="text-white/30 bg-white/5 px-1 py-0.5 rounded">{`{{name}}`}</code>.
              {" "}Admin must approve each composed message before use.
            </p>

            {templatesLoading ? (
              <div className="flex items-center gap-2 text-white/30 text-sm py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading templates...
              </div>
            ) : templates.map((tmpl: any) => (
              <div key={tmpl.id} data-testid={`template-card-${tmpl.type}`} className="border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-white font-medium text-sm">{tmpl.label}</h3>
                    <span className="text-white/30 text-xs font-mono">{tmpl.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      data-testid={`button-copy-template-${tmpl.type}`}
                      className="text-white/25 hover:text-white/60 text-xs flex items-center gap-1 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(tmpl.body);
                        toast({ title: "Template copied" });
                      }}
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button
                      data-testid={`button-edit-template-${tmpl.type}`}
                      className="text-white/25 hover:text-white/60 text-xs transition-colors"
                      onClick={() => {
                        setEditingTemplate(tmpl.type);
                        setTemplateBody(tmpl.body);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {editingTemplate === tmpl.type ? (
                  <div className="space-y-3">
                    <textarea
                      value={templateBody}
                      onChange={e => setTemplateBody(e.target.value)}
                      data-testid={`textarea-template-body-${tmpl.type}`}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-none px-3 py-2 text-sm focus:outline-none h-36 resize-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        data-testid={`button-save-template-${tmpl.type}`}
                        className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black rounded-none text-xs"
                        disabled={templateSaveMutation.isPending}
                        onClick={() => templateSaveMutation.mutate({ type: tmpl.type, body: templateBody, label: tmpl.label })}
                      >
                        {templateSaveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Save Template
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-cancel-template-${tmpl.type}`}
                        className="border-white/10 text-white/50 bg-transparent rounded-none text-xs"
                        onClick={() => setEditingTemplate(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="text-white/50 text-xs whitespace-pre-wrap font-sans leading-relaxed">{tmpl.body}</pre>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
