import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, Wand2, ChevronLeft, Phone, Globe, Tag,
  AlertCircle, CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronRight,
  Sparkles, Package, Briefcase, MessageCircle,
} from "lucide-react";
import { validateAdminLogin } from "@/lib/adminAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Manufacturer {
  id: string;
  name: string;
  contactName: string | null;
  whatsappNumber: string | null;
  whatsappEnabled: boolean;
  whatsappPendingConfirmation: boolean;
  country: string;
  website: string | null;
  categorySpecialization: string[];
  routingRules: {
    contact_for?: string[];
    do_not_contact_for?: string[];
    note?: string;
    priority?: string;
    relationship?: string;
  } | null;
  notes: string | null;
  active: boolean;
  adminActionRequired: string | null;
}

interface ManufacturerMessage {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  contactName: string | null;
  whatsappNumber: string | null;
  messageType: string;
  messageContent: string;
  relatedSku: string | null;
  relatedProject: string | null;
  requestType: string | null;
  status: string;
  wapiMessageId: string | null;
  adminUser: string | null;
  sentAt: string;
}

const REQUEST_TYPES = [
  "Request latest pricing",
  "Request MOQ (minimum order quantity)",
  "Request lead time",
  "Request finish / colour options",
  "Request dimension confirmation",
  "Request packaging details",
  "Request availability",
  "Request custom manufacturing feasibility",
  "Request updated catalog / images",
  "Request freight / shipping clarification",
  "General inquiry",
];

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const PRIORITY_LABEL: Record<string, string> = {
  primary_for_seating: "Primary — Seating",
  primary_for_desks: "Primary — Desks",
  priority_for_large_custom: "Priority — Large/Custom",
  sourcing: "Sourcing",
  standard: "Standard",
};

export default function AdminManufacturerMessaging() {
  const { toast } = useToast();
  const isAdmin = validateAdminLogin();

  const [selectedMfr, setSelectedMfr] = useState<Manufacturer | null>(null);
  const [requestType, setRequestType] = useState(REQUEST_TYPES[0]);
  const [message, setMessage] = useState("");
  const [relatedSku, setRelatedSku] = useState("");
  const [relatedProject, setRelatedProject] = useState("");
  const [quantity, setQuantity] = useState("");
  const [finishNeeded, setFinishNeeded] = useState("");
  const [projectValue, setProjectValue] = useState("");
  const [logExpanded, setLogExpanded] = useState(false);

  const { data: mfrData, isLoading: mfrLoading } = useQuery<{
    manufacturers: Manufacturer[];
    routingLogic: any;
    whatsappConfigured: boolean;
  }>({ queryKey: ["/api/manufacturers"] });

  const { data: messageLog = [], isLoading: logLoading, refetch: refetchLog } = useQuery<ManufacturerMessage[]>({
    queryKey: ["/api/manufacturer-messages"],
  });

  const draftMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("POST", "/api/ai/draft-manufacturer-message", payload).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.draft) {
        setMessage(data.draft);
        toast({ title: "Message drafted", description: "Review and edit before sending." });
      }
    },
    onError: () => toast({ title: "Draft failed", description: "Could not generate message.", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("POST", "/api/whatsapp/send", payload).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Message sent", description: `WhatsApp message delivered. ID: ${data.messageId || "—"}` });
        setMessage("");
        setRelatedSku("");
        setRelatedProject("");
        setQuantity("");
        setFinishNeeded("");
        setProjectValue("");
        queryClient.invalidateQueries({ queryKey: ["/api/manufacturer-messages"] });
      } else {
        toast({ title: "Send failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    },
    onError: (err: any) =>
      toast({ title: "Send failed", description: err.message || "Network error", variant: "destructive" }),
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white/50">Access denied.</p>
      </div>
    );
  }

  const manufacturers = mfrData?.manufacturers || [];
  const whatsappConfigured = mfrData?.whatsappConfigured ?? false;

  const whatsappReady = manufacturers.filter((m) => m.whatsappEnabled && m.active);
  const pendingConfirm = manufacturers.filter((m) => m.whatsappPendingConfirmation && m.active);
  const noWhatsapp = manufacturers.filter((m) => !m.whatsappEnabled && !m.whatsappPendingConfirmation && m.active);

  function handleDraft() {
    if (!selectedMfr) return;
    draftMutation.mutate({
      requestType,
      manufacturerName: selectedMfr.name,
      contactName: selectedMfr.contactName,
      categories: selectedMfr.categorySpecialization,
      relatedSku: relatedSku || undefined,
      relatedProject: relatedProject || undefined,
      quantity: quantity || undefined,
      finishNeeded: finishNeeded || undefined,
      projectValue: projectValue || undefined,
    });
  }

  function handleSend() {
    if (!selectedMfr) return;
    if (!message.trim()) {
      toast({ title: "No message", description: "Please compose or draft a message first.", variant: "destructive" });
      return;
    }
    if (!selectedMfr.whatsappEnabled) {
      toast({ title: "Cannot send", description: "WhatsApp number not confirmed for this contact.", variant: "destructive" });
      return;
    }
    sendMutation.mutate({
      manufacturerId: selectedMfr.id,
      whatsappNumber: selectedMfr.whatsappNumber,
      message: message.trim(),
      relatedSku: relatedSku || undefined,
      relatedProject: relatedProject || undefined,
      requestType,
      adminUser: "admin",
    });
  }

  const filteredLog = selectedMfr
    ? messageLog.filter((m) => m.manufacturerId === selectedMfr.id)
    : messageLog;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white/90">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#111] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard">
              <button className="text-white/50 hover:text-white flex items-center gap-1 text-sm transition-colors">
                <ChevronLeft size={16} /> Dashboard
              </button>
            </Link>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-[hsl(43,78%,55%)]" />
              <h1 className="text-white font-semibold">Manufacturer Messaging</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {whatsappConfigured ? (
              <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs">
                <CheckCircle2 size={10} className="mr-1" /> WhatsApp Connected
              </Badge>
            ) : (
              <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs">
                <AlertCircle size={10} className="mr-1" /> WhatsApp Not Configured
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {!whatsappConfigured && (
          <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium text-sm">WhatsApp API not configured</p>
              <p className="text-white/50 text-xs mt-1">
                Set <code className="text-yellow-300">WHATSAPP_ACCESS_TOKEN</code> and{" "}
                <code className="text-yellow-300">WHATSAPP_PHONE_NUMBER_ID</code> environment variables to enable live sending.
                You can still compose and log messages in test mode.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Manufacturer List ── */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Manufacturers</h2>

            {mfrLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* WhatsApp ready */}
                {whatsappReady.length > 0 && (
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-2">WhatsApp Ready</p>
                    {whatsappReady.map((mfr) => (
                      <ManufacturerCard
                        key={mfr.id}
                        mfr={mfr}
                        selected={selectedMfr?.id === mfr.id}
                        onClick={() => setSelectedMfr(mfr)}
                      />
                    ))}
                  </div>
                )}

                {/* Pending confirmation */}
                {pendingConfirm.length > 0 && (
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Pending Confirmation</p>
                    {pendingConfirm.map((mfr) => (
                      <ManufacturerCard
                        key={mfr.id}
                        mfr={mfr}
                        selected={selectedMfr?.id === mfr.id}
                        onClick={() => setSelectedMfr(mfr)}
                      />
                    ))}
                  </div>
                )}

                {/* No WhatsApp (existing internal suppliers) */}
                {noWhatsapp.length > 0 && (
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Internal (No Direct WhatsApp)</p>
                    {noWhatsapp.map((mfr) => (
                      <ManufacturerCard
                        key={mfr.id}
                        mfr={mfr}
                        selected={selectedMfr?.id === mfr.id}
                        onClick={() => setSelectedMfr(mfr)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Compose + Log ── */}
          <div className="lg:col-span-2 space-y-5">
            {!selectedMfr ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
                <MessageSquare size={32} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Select a manufacturer to compose a message</p>
              </div>
            ) : (
              <>
                {/* Manufacturer detail card */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-base" data-testid="text-mfr-name">{selectedMfr.name}</h3>
                        {selectedMfr.whatsappEnabled && (
                          <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs">
                            <Phone size={10} className="mr-1" /> WhatsApp
                          </Badge>
                        )}
                        {selectedMfr.whatsappPendingConfirmation && (
                          <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs">
                            <Clock size={10} className="mr-1" /> Number Unconfirmed
                          </Badge>
                        )}
                      </div>
                      {selectedMfr.contactName && (
                        <p className="text-white/50 text-sm mt-1">Contact: <span className="text-white/70">{selectedMfr.contactName}</span></p>
                      )}
                      {selectedMfr.whatsappNumber && selectedMfr.whatsappNumber !== "UNKNOWN" && (
                        <p className="text-white/40 text-xs mt-1 font-mono">{selectedMfr.whatsappNumber}</p>
                      )}
                    </div>
                    {selectedMfr.routingRules?.priority && (
                      <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.2)] text-xs shrink-0">
                        {PRIORITY_LABEL[selectedMfr.routingRules.priority] || selectedMfr.routingRules.priority}
                      </Badge>
                    )}
                  </div>

                  {selectedMfr.categorySpecialization.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {selectedMfr.categorySpecialization.map((cat) => (
                        <span key={cat} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs capitalize">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedMfr.routingRules?.note && (
                    <p className="mt-3 text-white/40 text-xs leading-relaxed border-t border-white/5 pt-3">
                      {selectedMfr.routingRules.note}
                    </p>
                  )}

                  {selectedMfr.adminActionRequired && (
                    <div className="mt-3 flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                      <AlertCircle size={12} className="shrink-0" />
                      <span><strong>Action required:</strong> {selectedMfr.adminActionRequired}</span>
                    </div>
                  )}
                </div>

                {/* Compose panel */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                  <h3 className="text-white/80 font-semibold text-sm flex items-center gap-2">
                    <Wand2 size={15} className="text-[hsl(43,78%,55%)]" />
                    Compose Message
                  </h3>

                  {/* Request type */}
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">Request Type</label>
                    <div className="relative">
                      <select
                        value={requestType}
                        onChange={(e) => setRequestType(e.target.value)}
                        data-testid="select-request-type"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 appearance-none focus:outline-none focus:border-white/20"
                      >
                        {REQUEST_TYPES.map((rt) => (
                          <option key={rt} value={rt} className="bg-[#111]">{rt}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    </div>
                  </div>

                  {/* Optional context */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Product SKU (optional)</label>
                      <Input
                        value={relatedSku}
                        onChange={(e) => setRelatedSku(e.target.value)}
                        placeholder="e.g. FSZ-001"
                        data-testid="input-related-sku"
                        className="bg-white/5 border-white/10 text-white/80 placeholder:text-white/20 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Project Ref (optional)</label>
                      <Input
                        value={relatedProject}
                        onChange={(e) => setRelatedProject(e.target.value)}
                        placeholder="e.g. SYD-2026-04"
                        data-testid="input-related-project"
                        className="bg-white/5 border-white/10 text-white/80 placeholder:text-white/20 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Quantity (optional)</label>
                      <Input
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g. 50 units"
                        data-testid="input-quantity"
                        className="bg-white/5 border-white/10 text-white/80 placeholder:text-white/20 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Finish / Colour (optional)</label>
                      <Input
                        value={finishNeeded}
                        onChange={(e) => setFinishNeeded(e.target.value)}
                        placeholder="e.g. Black oak veneer"
                        data-testid="input-finish"
                        className="bg-white/5 border-white/10 text-white/80 placeholder:text-white/20 text-sm"
                      />
                    </div>
                  </div>

                  {/* AI Draft button */}
                  <Button
                    onClick={handleDraft}
                    disabled={draftMutation.isPending}
                    variant="outline"
                    data-testid="button-draft-message"
                    className="w-full border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] bg-transparent text-sm"
                  >
                    {draftMutation.isPending ? (
                      <><RefreshCw size={13} className="mr-2 animate-spin" /> Drafting with AI...</>
                    ) : (
                      <><Sparkles size={13} className="mr-2" /> AI Draft Message</>
                    )}
                  </Button>

                  {/* Message textarea */}
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider mb-1.5 block">Message</label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type or AI-draft your message here…"
                      data-testid="textarea-message"
                      rows={6}
                      className="bg-white/5 border-white/10 text-white/80 placeholder:text-white/20 text-sm resize-none"
                    />
                    <p className="text-white/20 text-xs mt-1 text-right">{message.length} chars</p>
                  </div>

                  {/* Send button */}
                  <Button
                    onClick={handleSend}
                    disabled={sendMutation.isPending || !message.trim() || !selectedMfr.whatsappEnabled}
                    data-testid="button-send-message"
                    className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
                  >
                    {sendMutation.isPending ? (
                      <><RefreshCw size={13} className="mr-2 animate-spin" /> Sending…</>
                    ) : (
                      <><Send size={13} className="mr-2" /> Send via WhatsApp to {selectedMfr.contactName || selectedMfr.name}</>
                    )}
                  </Button>

                  {!selectedMfr.whatsappEnabled && (
                    <p className="text-yellow-400/70 text-xs text-center">
                      {selectedMfr.whatsappPendingConfirmation
                        ? "Confirm this contact's WhatsApp number before sending."
                        : "This supplier does not have direct WhatsApp configured."}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Message Log */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => setLogExpanded(!logExpanded)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                data-testid="button-toggle-log"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} className="text-white/40" />
                  <span className="text-white/70 font-semibold text-sm">Message Log</span>
                  {filteredLog.length > 0 && (
                    <Badge className="bg-white/10 text-white/50 border-0 text-xs">{filteredLog.length}</Badge>
                  )}
                </div>
                {logExpanded ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
              </button>

              {logExpanded && (
                <div className="border-t border-white/5">
                  {logLoading ? (
                    <div className="p-5 space-y-3">
                      {[1, 2].map((i) => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />)}
                    </div>
                  ) : filteredLog.length === 0 ? (
                    <div className="px-5 py-8 text-center text-white/30 text-sm">No messages sent yet</div>
                  ) : (
                    <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                      {filteredLog.map((msg) => (
                        <div key={msg.id} className="px-5 py-4" data-testid={`log-entry-${msg.id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white/70 text-xs font-medium">{msg.manufacturerName}</span>
                                {msg.contactName && (
                                  <span className="text-white/40 text-xs">→ {msg.contactName}</span>
                                )}
                                {msg.requestType && (
                                  <span className="text-white/30 text-xs truncate">{msg.requestType}</span>
                                )}
                              </div>
                              <p className="text-white/50 text-xs mt-1.5 leading-relaxed line-clamp-2">{msg.messageContent}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                {msg.relatedSku && (
                                  <span className="text-white/30 text-xs flex items-center gap-1">
                                    <Package size={10} /> {msg.relatedSku}
                                  </span>
                                )}
                                {msg.relatedProject && (
                                  <span className="text-white/30 text-xs flex items-center gap-1">
                                    <Briefcase size={10} /> {msg.relatedProject}
                                  </span>
                                )}
                                <span className="text-white/20 text-xs">
                                  {new Date(msg.sentAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              </div>
                            </div>
                            <Badge
                              className={`text-xs border shrink-0 ${STATUS_STYLE[msg.status] || "bg-white/5 text-white/40 border-white/10"}`}
                            >
                              {msg.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Routing Logic Reference */}
            {mfrData?.routingLogic && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                  <Tag size={13} /> Supplier Routing Rules
                </h3>
                <div className="space-y-2">
                  {(mfrData.routingLogic.rules || []).map((rule: any, i: number) => (
                    <div key={i} className="text-xs text-white/40 leading-relaxed border-l-2 border-white/5 pl-3">
                      <span className="text-white/60 font-medium capitalize">{rule.category}</span>
                      {" → "}
                      <span className="text-[hsl(43,78%,65%)]">{rule.primary_supplier}</span>
                      {rule.secondary_supplier && <span className="text-white/30"> / {rule.secondary_supplier}</span>}
                      {rule.note && <span className="block text-white/25 mt-0.5">{rule.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Manufacturer Card ────────────────────────────────────────────────────────

function ManufacturerCard({
  mfr,
  selected,
  onClick,
}: {
  mfr: Manufacturer;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`card-manufacturer-${mfr.id}`}
      className={`w-full text-left rounded-xl border p-4 mb-2 transition-all ${
        selected
          ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.06)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white/80 font-medium text-sm truncate">{mfr.name}</p>
          {mfr.contactName && (
            <p className="text-white/40 text-xs mt-0.5">{mfr.contactName}</p>
          )}
          {mfr.categorySpecialization.slice(0, 2).map((cat) => (
            <span key={cat} className="inline-block mr-1 mt-1 text-white/30 text-xs capitalize">{cat}</span>
          ))}
          {mfr.categorySpecialization.length > 2 && (
            <span className="text-white/20 text-xs">+{mfr.categorySpecialization.length - 2}</span>
          )}
        </div>
        <div className="shrink-0">
          {mfr.whatsappEnabled ? (
            <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5" title="WhatsApp ready" />
          ) : mfr.whatsappPendingConfirmation ? (
            <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5" title="Number unconfirmed" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-white/20 mt-1.5" title="No WhatsApp" />
          )}
        </div>
      </div>
    </button>
  );
}
