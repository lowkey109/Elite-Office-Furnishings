import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Plus, Search, Printer, Send, Trash2, ChevronLeft, Eye,
  Save, X, CheckCircle2, Clock, AlertCircle, DollarSign, Package,
  User, Building2, Mail, Phone, Pencil, Copy, RefreshCw, Loader2
} from "lucide-react";
import type { Quote } from "@shared/schema";

const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";
const ADMIN_PASS = "Jaymin12!/";
const AUTH_KEY = "tcd_admin_auth";

interface QuoteLineItem {
  id: string;
  productName: string;
  sku?: string;
  category: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  supplier?: string;
  notes?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-white/5 text-white/50 border-white/10",
  Ready: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Accepted: "bg-green-500/10 text-green-400 border-green-500/20",
  Declined: "bg-red-500/10 text-red-400 border-red-500/20",
  Expired: "bg-white/5 text-white/30 border-white/10",
};
const STATUS_OPTIONS = ["Draft", "Ready", "Sent", "Accepted", "Declined", "Expired"];

const fmt = (n?: number | null) => n ? `$${Number(n).toLocaleString("en-AU")}` : "$0";
const fmtDate = (d?: string | Date | null) => d ? new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function newItem(): QuoteLineItem {
  return { id: crypto.randomUUID(), productName: "", category: "Furniture", quantity: 1, unitPrice: 0, lineTotal: 0 };
}

function calcTotals(items: QuoteLineItem[], freight: number, install: number, other: number, discount: number) {
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const beforeGst = subtotal + freight + install + other - discount;
  const gst = Math.round(beforeGst * 0.1);
  const totalIncGst = beforeGst + gst;
  const financeMonthlyEstimate = Math.round(totalIncGst / 60);
  return { subtotal, gst, total: beforeGst, totalIncGst, financeMonthlyEstimate };
}

// ─── Quote Editor ──────────────────────────────────────────────────────────────
function QuoteEditor({
  quote,
  onClose,
  onSaved,
  prefillRequest,
}: {
  quote: Quote | null;
  onClose: () => void;
  onSaved: (q: Quote) => void;
  prefillRequest?: any;
}) {
  const { toast } = useToast();
  const isNew = !quote;

  // Client fields
  const [clientName, setClientName] = useState(quote?.clientName ?? prefillRequest?.contactName ?? "");
  const [companyName, setCompanyName] = useState(quote?.companyName ?? prefillRequest?.businessName ?? "");
  const [email, setEmail] = useState(quote?.email ?? prefillRequest?.email ?? "");
  const [phone, setPhone] = useState(quote?.phone ?? prefillRequest?.phone ?? "");
  const [officeSizeSqm, setOfficeSizeSqm] = useState(String(quote?.officeSizeSqm ?? prefillRequest?.officeSizeSqm ?? ""));
  const [staffCount, setStaffCount] = useState(String(quote?.staffCount ?? prefillRequest?.staffCount ?? ""));
  const [projectSummary, setProjectSummary] = useState(quote?.projectSummary ?? "");
  const [status, setStatus] = useState<string>(quote?.status ?? "Draft");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [validityDays, setValidityDays] = useState(String(quote?.validityDays ?? 30));
  const [preparedBy, setPreparedBy] = useState(quote?.preparedBy ?? "The Corporate Desk");

  // Line items
  const [items, setItems] = useState<QuoteLineItem[]>(() => {
    if (quote?.quoteItems) {
      try { return JSON.parse(quote.quoteItems); } catch {}
    }
    // Pre-fill from planning request package if available
    if (prefillRequest?.packageJson) {
      try {
        const pkg = JSON.parse(prefillRequest.packageJson);
        if (Array.isArray(pkg.items)) {
          return pkg.items.slice(0, 20).map((it: any) => ({
            id: crypto.randomUUID(),
            productName: it.productName || it.name || "Item",
            category: it.category || "Furniture",
            variant: it.variant || it.finish || "",
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || it.pricePerUnit || 0,
            lineTotal: (it.quantity || 1) * (it.unitPrice || it.pricePerUnit || 0),
            supplier: it.supplier || "",
          }));
        }
      } catch {}
    }
    return [newItem()];
  });

  // Cost fields
  const [freight, setFreight] = useState(String(quote?.freightCost ?? 0));
  const [install, setInstall] = useState(String(quote?.installationCost ?? 0));
  const [other, setOther] = useState(String(quote?.otherCosts ?? 0));
  const [discount, setDiscount] = useState(String(quote?.discount ?? 0));

  const totals = calcTotals(
    items,
    Number(freight) || 0,
    Number(install) || 0,
    Number(other) || 0,
    Number(discount) || 0
  );

  const updateItem = useCallback((id: string, field: keyof QuoteLineItem, value: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        updated.lineTotal = Number(updated.quantity) * Number(updated.unitPrice);
      }
      return updated;
    }));
  }, []);

  const createMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/admin/quotes", body),
    onSuccess: async (res) => {
      const q: Quote = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
      toast({ title: "Quote created", description: q.quoteNumber });
      onSaved(q);
    },
    onError: () => toast({ title: "Error creating quote", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/admin/quotes/${quote!.id}`, body),
    onSuccess: async (res) => {
      const q: Quote = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
      toast({ title: "Quote saved" });
      onSaved(q);
    },
    onError: () => toast({ title: "Error saving quote", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/quotes/${quote!.id}/send`, {}),
    onSuccess: async (res) => {
      const q: Quote = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
      toast({ title: "Quote sent", description: `Emailed to ${q.email}` });
      onSaved(q);
    },
    onError: () => toast({ title: "Error sending quote", variant: "destructive" }),
  });

  const buildPayload = () => ({
    clientName,
    companyName: companyName || null,
    email,
    phone: phone || null,
    planningRequestId: quote?.planningRequestId ?? prefillRequest?.id ?? null,
    officeSizeSqm: officeSizeSqm ? Number(officeSizeSqm) : null,
    staffCount: staffCount ? Number(staffCount) : null,
    projectSummary: projectSummary || null,
    quoteItems: JSON.stringify(items),
    subtotal: totals.subtotal,
    freightCost: Number(freight) || 0,
    installationCost: Number(install) || 0,
    otherCosts: Number(other) || 0,
    discount: Number(discount) || 0,
    gst: totals.gst,
    total: totals.total,
    totalIncGst: totals.totalIncGst,
    financeMonthlyEstimate: totals.financeMonthlyEstimate,
    notes: notes || null,
    validityDays: Number(validityDays) || 30,
    preparedBy: preparedBy || "The Corporate Desk",
    status,
  });

  const handleSave = () => {
    if (!clientName || !email) {
      toast({ title: "Client name and email are required", variant: "destructive" });
      return;
    }
    if (isNew) {
      createMutation.mutate(buildPayload());
    } else {
      updateMutation.mutate(buildPayload());
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-white font-semibold text-base">
              {isNew ? "New Quote" : quote.quoteNumber}
            </h2>
            {!isNew && <p className="text-white/40 text-xs">{quote.clientName}{quote.companyName ? ` · ${quote.companyName}` : ""}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/admin/quotes/${quote.id}/print`, "_blank")}
                className="border-[rgba(255,255,255,0.1)] text-white/60 hover:text-white hover:bg-white/5 gap-1.5"
                data-testid="button-print-quote"
              >
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={sendMutation.isPending}
                onClick={() => { handleSave(); setTimeout(() => sendMutation.mutate(), 800); }}
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 gap-1.5"
                data-testid="button-send-quote"
              >
                {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send to Client
              </Button>
            </>
          )}
          <Button
            size="sm"
            disabled={isSaving}
            onClick={handleSave}
            className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[#0f0f13] font-semibold gap-1.5"
            data-testid="button-save-quote"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-0 h-full">

          {/* Left: Main editor */}
          <div className="p-6 space-y-7 border-r border-[rgba(255,255,255,0.04)]">

            {/* Client Details */}
            <section>
              <h3 className="text-[hsl(43,78%,52%)] text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Client Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Client Name *</label>
                  <Input
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="John Smith"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                    data-testid="input-client-name"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Company Name</label>
                  <Input
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Acme Corp Pty Ltd"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                    data-testid="input-company-name"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Email Address *</label>
                  <Input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="john@company.com.au"
                    type="email"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Phone</label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0400 000 000"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Office Size (m²)</label>
                  <Input
                    value={officeSizeSqm}
                    onChange={e => setOfficeSizeSqm(e.target.value)}
                    placeholder="200"
                    type="number"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                    data-testid="input-office-size"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Staff Count</label>
                  <Input
                    value={staffCount}
                    onChange={e => setStaffCount(e.target.value)}
                    placeholder="25"
                    type="number"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                    data-testid="input-staff-count"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs mb-1.5 block">Project Summary</label>
                  <Textarea
                    value={projectSummary}
                    onChange={e => setProjectSummary(e.target.value)}
                    placeholder="Brief project description for the client-facing quote..."
                    rows={2}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 resize-none"
                    data-testid="textarea-project-summary"
                  />
                </div>
              </div>
            </section>

            {/* Line Items */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[hsl(43,78%,52%)] text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Line Items
                </h3>
                <button
                  onClick={() => setItems(p => [...p, newItem()])}
                  className="flex items-center gap-1.5 text-xs text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,80%)] border border-[rgba(201,168,76,0.2)] hover:border-[rgba(201,168,76,0.4)] rounded-lg px-3 py-1.5 transition-colors"
                  data-testid="button-add-line-item"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[3fr_1fr_1fr_1fr_auto] gap-0 bg-[rgba(255,255,255,0.03)] border-b border-[rgba(255,255,255,0.06)]">
                  {["Product / Description", "Category", "Qty", "Unit Price", ""].map((h, i) => (
                    <div key={i} className="px-3 py-2.5 text-white/30 text-xs font-semibold uppercase tracking-wider">{h}</div>
                  ))}
                </div>
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[3fr_1fr_1fr_1fr_auto] gap-0 border-b border-[rgba(255,255,255,0.04)] last:border-b-0"
                    data-testid={`row-line-item-${idx}`}
                  >
                    <div className="px-2 py-1.5">
                      <Input
                        value={item.productName}
                        onChange={e => updateItem(item.id, "productName", e.target.value)}
                        placeholder="Product name..."
                        className="bg-transparent border-0 text-white text-sm placeholder:text-white/20 h-8 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                        data-testid={`input-item-name-${idx}`}
                      />
                      {item.variant !== undefined && (
                        <Input
                          value={item.variant}
                          onChange={e => updateItem(item.id, "variant", e.target.value)}
                          placeholder="Variant / finish..."
                          className="bg-transparent border-0 text-white/40 text-xs placeholder:text-white/15 h-6 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <Input
                        value={item.category}
                        onChange={e => updateItem(item.id, "category", e.target.value)}
                        className="bg-transparent border-0 text-white/60 text-sm h-8 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", Number(e.target.value))}
                        min={1}
                        className="bg-transparent border-0 text-white text-sm h-8 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                        data-testid={`input-item-qty-${idx}`}
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="flex items-center">
                        <span className="text-white/30 text-sm">$</span>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value))}
                          className="bg-transparent border-0 text-white text-sm h-8 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                          data-testid={`input-item-price-${idx}`}
                        />
                      </div>
                      <p className="text-white/40 text-xs px-1">{fmt(item.lineTotal)}</p>
                    </div>
                    <div className="flex items-center px-2">
                      <button
                        onClick={() => setItems(p => p.filter(i => i.id !== item.id))}
                        className="text-white/20 hover:text-red-400 transition-colors p-1"
                        data-testid={`button-remove-item-${idx}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-8 text-center text-white/30 text-sm">No items — click Add Item to begin</div>
                )}
              </div>
            </section>

            {/* Additional Costs */}
            <section>
              <h3 className="text-[hsl(43,78%,52%)] text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" /> Additional Costs & Adjustments
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Freight & Delivery", value: freight, set: setFreight, id: "freight" },
                  { label: "Installation", value: install, set: setInstall, id: "install" },
                  { label: "Other Costs", value: other, set: setOther, id: "other" },
                  { label: "Discount", value: discount, set: setDiscount, id: "discount" },
                ].map(f => (
                  <div key={f.id}>
                    <label className="text-white/50 text-xs mb-1.5 block">{f.label}</label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-md px-2">
                      <span className="text-white/30 text-sm mr-1">$</span>
                      <Input
                        type="number"
                        value={f.value}
                        onChange={e => f.set(e.target.value)}
                        min={0}
                        className="bg-transparent border-0 text-white text-sm h-9 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        data-testid={`input-${f.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Notes */}
            <section>
              <h3 className="text-[hsl(43,78%,52%)] text-xs font-bold uppercase tracking-widest mb-4">Notes / Terms</h3>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes, conditions or inclusions for the client..."
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 resize-none"
                data-testid="textarea-notes"
              />
            </section>
          </div>

          {/* Right: Summary panel */}
          <div className="p-6 space-y-6">

            {/* Status */}
            <section>
              <h3 className="text-[hsl(43,78%,52%)] text-xs font-bold uppercase tracking-widest mb-3">Quote Status</h3>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            {/* Quote Settings */}
            <section>
              <h3 className="text-[hsl(43,78%,52%)] text-xs font-bold uppercase tracking-widest mb-3">Quote Settings</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Valid For (days)</label>
                  <Input
                    type="number"
                    value={validityDays}
                    onChange={e => setValidityDays(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="input-validity-days"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Prepared By</label>
                  <Input
                    value={preparedBy}
                    onChange={e => setPreparedBy(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="input-prepared-by"
                  />
                </div>
              </div>
            </section>

            {/* Live Totals */}
            <section className="bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.15)] rounded-xl p-4">
              <h3 className="text-[hsl(43,78%,52%)] text-xs font-bold uppercase tracking-widest mb-4">Quote Summary</h3>
              <div className="space-y-2 text-sm" data-testid="section-totals">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
                </div>
                {Number(freight) > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Freight</span><span>{fmt(Number(freight))}</span>
                  </div>
                )}
                {Number(install) > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Installation</span><span>{fmt(Number(install))}</span>
                  </div>
                )}
                {Number(other) > 0 && (
                  <div className="flex justify-between text-white/60">
                    <span>Other</span><span>{fmt(Number(other))}</span>
                  </div>
                )}
                {Number(discount) > 0 && (
                  <div className="flex justify-between text-red-400/80">
                    <span>Discount</span><span>−{fmt(Number(discount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-white/60">
                  <span>GST (10%)</span><span>{fmt(totals.gst)}</span>
                </div>
                <div className="border-t border-[rgba(201,168,76,0.2)] pt-2 flex justify-between">
                  <span className="text-[hsl(43,78%,65%)] font-bold">Total inc. GST</span>
                  <span className="text-[hsl(43,78%,65%)] font-bold text-lg" data-testid="text-total-inc-gst">{fmt(totals.totalIncGst)}</span>
                </div>
                {totals.totalIncGst > 0 && (
                  <div className="text-white/30 text-xs mt-1">
                    Finance est. ~{fmt(totals.financeMonthlyEstimate)}/mo (60 months)
                  </div>
                )}
              </div>
            </section>

            {/* Quote info if existing */}
            {!isNew && (
              <section className="space-y-2 text-xs text-white/30">
                <div className="flex justify-between"><span>Quote #</span><span className="text-white/60 font-mono">{quote.quoteNumber}</span></div>
                <div className="flex justify-between"><span>Created</span><span>{fmtDate(quote.createdAt)}</span></div>
                {quote.sentAt && <div className="flex justify-between"><span>Sent</span><span>{fmtDate(quote.sentAt)}</span></div>}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quote List ─────────────────────────────────────────────────────────────────
export default function AdminQuotes() {
  const [authed, setAuthed] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authErr, setAuthErr] = useState(false);

  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null | "new">(null);
  const [prefillRequest, setPrefillRequest] = useState<any>(null);

  const { toast } = useToast();

  // Auth check
  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    if (stored === `${ADMIN_EMAIL}:${ADMIN_PASS}`) setAuthed(true);
  }, []);

  // Pre-fill from planning request query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planningRequestId = params.get("planningRequestId");
    if (planningRequestId && authed) {
      fetch(`/api/admin/planning-requests/${planningRequestId}`)
        .then(r => r.json())
        .then(req => {
          setPrefillRequest(req);
          setSelectedQuote("new");
        })
        .catch(() => {
          setSelectedQuote("new");
        });
    } else if (params.get("new") === "1" && authed) {
      setSelectedQuote("new");
    }
  }, [authed]);

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/admin/quotes"],
    enabled: authed,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/quotes/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
      toast({ title: "Quote deleted" });
    },
  });

  const handleLogin = () => {
    if (authEmail === ADMIN_EMAIL && authPw === ADMIN_PASS) {
      sessionStorage.setItem(AUTH_KEY, `${ADMIN_EMAIL}:${ADMIN_PASS}`);
      setAuthed(true);
    } else {
      setAuthErr(true);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,7%)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-2">The Corporate Desk</div>
            <h1 className="text-white font-serif text-xl font-bold">Admin Access</h1>
            <p className="text-white/40 text-sm mt-1">Formal Quotes</p>
          </div>
          <div className="space-y-3">
            <Input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Admin email" type="email" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            <Input value={authPw} onChange={e => setAuthPw(e.target.value)} placeholder="Password" type="password" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {authErr && <p className="text-red-400 text-xs">Invalid credentials</p>}
            <Button onClick={handleLogin} className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[#0f0f13] font-semibold">Sign In</Button>
          </div>
        </div>
      </div>
    );
  }

  // Stats
  const total = quotes.length;
  const sentCount = quotes.filter(q => q.status === "Sent").length;
  const acceptedCount = quotes.filter(q => q.status === "Accepted").length;
  const draftCount = quotes.filter(q => q.status === "Draft" || q.status === "Ready").length;
  const totalValue = quotes.reduce((s, q) => s + (q.totalIncGst ?? 0), 0);
  const acceptedValue = quotes.filter(q => q.status === "Accepted").reduce((s, q) => s + (q.totalIncGst ?? 0), 0);

  // Filtered list
  const filtered = quotes.filter(q => {
    const matchStatus = filterStatus === "All" || q.status === filterStatus;
    const matchSearch = !search || [q.clientName, q.companyName, q.email, q.quoteNumber].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  // Show editor if a quote is selected
  if (selectedQuote !== null) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,7%)] flex flex-col" data-testid="page-quote-editor">
        {/* Top nav */}
        <div className="bg-[hsl(220,18%,10%)] border-b border-[rgba(255,255,255,0.06)] px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase">TCD Admin</div>
          <div className="text-white/20">·</div>
          <a href="/admin/quotes" className="text-white/40 hover:text-white/70 text-sm transition-colors">Formal Quotes</a>
          <div className="text-white/20">·</div>
          <span className="text-white/60 text-sm">{selectedQuote === "new" ? "New Quote" : (selectedQuote as Quote).quoteNumber}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <QuoteEditor
            quote={selectedQuote === "new" ? null : selectedQuote as Quote}
            prefillRequest={prefillRequest}
            onClose={() => { setSelectedQuote(null); setPrefillRequest(null); window.history.pushState({}, "", "/admin/quotes"); }}
            onSaved={(q) => setSelectedQuote(q)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-white" data-testid="page-admin-quotes">
      {/* Top nav */}
      <div className="bg-[hsl(220,18%,10%)] border-b border-[rgba(255,255,255,0.06)] px-6 py-3 flex items-center gap-4">
        <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase">TCD Admin</div>
        <div className="text-white/20">·</div>
        <a href="/admin/dashboard" className="text-white/40 hover:text-white/70 text-sm transition-colors">Dashboard</a>
        <div className="text-white/20">·</div>
        <span className="text-white text-sm font-medium">Formal Quotes</span>
        <div className="ml-auto flex items-center gap-2">
          <a href="/admin/dashboard" className="text-white/40 hover:text-white text-xs border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 transition-colors">← Dashboard</a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page title + create button */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-white font-serif text-2xl font-bold">Formal Quotes</h1>
            <p className="text-white/40 text-sm mt-1">Manage, send and track client-facing formal quotes</p>
          </div>
          <Button
            onClick={() => setSelectedQuote("new")}
            className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[#0f0f13] font-semibold gap-2"
            data-testid="button-new-quote"
          >
            <Plus className="w-4 h-4" /> New Quote
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Quotes", value: String(total), icon: FileText, color: "text-white/70" },
            { label: "Draft / Ready", value: String(draftCount), icon: Clock, color: "text-amber-400" },
            { label: "Sent", value: String(sentCount), icon: Send, color: "text-blue-400" },
            { label: "Accepted", value: String(acceptedCount), icon: CheckCircle2, color: "text-green-400" },
            { label: "Pipeline Value", value: fmt(totalValue), icon: DollarSign, color: "text-[hsl(43,78%,65%)]" },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                  <p className="text-white/40 text-xs">{kpi.label}</p>
                </div>
                <p className={`text-xl font-bold font-serif ${kpi.color}`} data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, company, email, quote #..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25"
              data-testid="input-search-quotes"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["All", ...STATUS_OPTIONS].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterStatus === s ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]" : "border-[rgba(255,255,255,0.08)] text-white/40 hover:text-white/70"}`}
                data-testid={`button-filter-${s.toLowerCase()}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Quote Table */}
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,78%,52%)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <FileText className="w-10 h-10 text-white/15" />
              <div>
                <p className="text-white/40 font-medium">No quotes found</p>
                <p className="text-white/20 text-sm mt-1">
                  {total === 0 ? "Create your first formal quote to get started." : "Try adjusting your search or filter."}
                </p>
              </div>
              {total === 0 && (
                <Button onClick={() => setSelectedQuote("new")} size="sm" className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[#0f0f13] font-semibold mt-2">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Quote
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[1.5fr_2fr_1.2fr_1fr_1fr_auto] gap-0 bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.06)]">
                {["Quote #", "Client", "Status", "Total inc GST", "Date", ""].map((h, i) => (
                  <div key={i} className="px-4 py-3 text-white/30 text-xs font-semibold uppercase tracking-wider">{h}</div>
                ))}
              </div>
              {filtered.map(q => (
                <div
                  key={q.id}
                  className="grid grid-cols-[1.5fr_2fr_1.2fr_1fr_1fr_auto] gap-0 border-b border-[rgba(255,255,255,0.04)] last:border-b-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  data-testid={`row-quote-${q.id}`}
                >
                  <div className="px-4 py-4 flex items-center">
                    <span className="text-white font-mono text-sm font-semibold">{q.quoteNumber}</span>
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-white text-sm font-medium">{q.clientName}</p>
                    {q.companyName && <p className="text-white/40 text-xs mt-0.5">{q.companyName}</p>}
                    <p className="text-white/30 text-xs">{q.email}</p>
                  </div>
                  <div className="px-4 py-4 flex items-center">
                    <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium ${STATUS_COLORS[q.status] ?? STATUS_COLORS.Draft}`}>
                      {q.status}
                    </span>
                  </div>
                  <div className="px-4 py-4 flex items-center">
                    <span className="text-[hsl(43,78%,65%)] font-bold text-sm">{fmt(q.totalIncGst)}</span>
                  </div>
                  <div className="px-4 py-4 flex items-center">
                    <span className="text-white/40 text-sm">{fmtDate(q.createdAt)}</span>
                  </div>
                  <div className="px-4 py-4 flex items-center gap-2">
                    <button
                      title="Edit"
                      onClick={() => setSelectedQuote(q)}
                      className="p-1.5 text-white/30 hover:text-white transition-colors rounded"
                      data-testid={`button-edit-quote-${q.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Print / PDF"
                      onClick={() => window.open(`/admin/quotes/${q.id}/print`, "_blank")}
                      className="p-1.5 text-white/30 hover:text-white transition-colors rounded"
                      data-testid={`button-print-quote-${q.id}`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => { if (confirm(`Delete quote ${q.quoteNumber}?`)) deleteMutation.mutate(q.id); }}
                      className="p-1.5 text-white/20 hover:text-red-400 transition-colors rounded"
                      data-testid={`button-delete-quote-${q.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accepted value footer */}
        {acceptedCount > 0 && (
          <div className="mt-4 text-right text-sm text-white/40">
            Accepted revenue: <span className="text-green-400 font-semibold">{fmt(acceptedValue)}</span> across {acceptedCount} quote{acceptedCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
