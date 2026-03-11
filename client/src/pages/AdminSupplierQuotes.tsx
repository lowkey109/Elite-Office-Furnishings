import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Users, Plus, Search, ChevronLeft, X, Check,
  Truck, ClipboardList, Phone, Mail, Calendar, DollarSign,
  ArrowRight, Pencil, Trash2, User,
} from "lucide-react";

import { validateAdminLogin } from "@/lib/adminAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplierQuote {
  id: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  productName: string;
  sku: string;
  quantity: number;
  colourFinish?: string;
  unitPrice: string;
  freightCost?: string;
  leadTime?: string;
  quoteDate: string;
  projectReference?: string;
  status: "Requested" | "Received" | "Approved" | "Ordered" | "Shipped" | "Delivered";
  notes?: string;
  createdAt?: string;
}

interface Referral {
  id: string;
  referrerName: string;
  company?: string;
  contactEmail?: string;
  contactPhone?: string;
  leadSource: string;
  clientName?: string;
  clientCompany?: string;
  estimatedValue?: string;
  notes?: string;
  status: "New" | "Contacted" | "Qualified" | "Won" | "Lost";
  createdAt?: string;
}

// ─── Status configs ───────────────────────────────────────────────────────────

const QUOTE_STATUSES: SupplierQuote["status"][] = ["Requested", "Received", "Approved", "Ordered", "Shipped", "Delivered"];

const QUOTE_STATUS_STYLE: Record<string, string> = {
  Requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Received: "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]",
  Approved: "bg-green-500/10 text-green-400 border-green-500/20",
  Ordered: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Shipped: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const REFERRAL_STATUSES: Referral["status"][] = ["New", "Contacted", "Qualified", "Won", "Lost"];

const REFERRAL_STATUS_STYLE: Record<string, string> = {
  New: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Contacted: "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]",
  Qualified: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Won: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Lost: "bg-red-500/10 text-red-400 border-red-500/20",
};

const LEAD_SOURCES = [
  "Real Estate Agent", "Architect", "Interior Designer",
  "Project Manager", "Builder", "Workplace Consultant", "Other",
];

function formatDate(str?: string) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Add Quote Form ───────────────────────────────────────────────────────────

function AddQuotePanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    supplierName: "", supplierPhone: "", supplierEmail: "",
    productName: "", sku: "", quantity: "1", colourFinish: "",
    unitPrice: "", freightCost: "", leadTime: "",
    quoteDate: new Date().toISOString().slice(0, 10),
    projectReference: "", status: "Received" as SupplierQuote["status"], notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/admin/supplier-quotes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/supplier-quotes"] });
      toast({ title: "Quote saved", description: "Supplier quote has been logged." });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Could not save quote.", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-[hsl(220,20%,8%)] border-l border-[rgba(201,168,76,0.15)] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.06)]">
          <h3 className="text-white font-semibold font-serif">Log Supplier Quote</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <fieldset className="space-y-3">
            <legend className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Supplier</legend>
            <Field label="Supplier Name *" value={form.supplierName} onChange={v => set("supplierName", v)} placeholder="e.g. Actiu Australia" />
            <Field label="Phone" value={form.supplierPhone} onChange={v => set("supplierPhone", v)} placeholder="+61 2 1234 5678" />
            <Field label="Email" value={form.supplierEmail} onChange={v => set("supplierEmail", v)} placeholder="sales@supplier.com.au" />
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Product</legend>
            <Field label="Product Name *" value={form.productName} onChange={v => set("productName", v)} placeholder="e.g. Executive Sit-Stand Desk" />
            <Field label="SKU *" value={form.sku} onChange={v => set("sku", v)} placeholder="e.g. TCD-EX-SS-1800" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" value={form.quantity} onChange={v => set("quantity", v)} placeholder="1" type="number" />
              <Field label="Colour / Finish" value={form.colourFinish} onChange={v => set("colourFinish", v)} placeholder="e.g. White Oak" />
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Pricing</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit Price (ex GST) *" value={form.unitPrice} onChange={v => set("unitPrice", v)} placeholder="$1,250.00" />
              <Field label="Freight Cost" value={form.freightCost} onChange={v => set("freightCost", v)} placeholder="$180.00" />
            </div>
            <Field label="Lead Time" value={form.leadTime} onChange={v => set("leadTime", v)} placeholder="e.g. 3–4 weeks" />
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Project</legend>
            <Field label="Quote Date *" value={form.quoteDate} onChange={v => set("quoteDate", v)} type="date" />
            <Field label="Project / Client Reference" value={form.projectReference} onChange={v => set("projectReference", v)} placeholder="e.g. Crestfield Capital – Level 12 Fitout" />
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Status</label>
              <select
                value={form.status}
                onChange={e => set("status", e.target.value)}
                data-testid="select-quote-status"
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[rgba(201,168,76,0.4)]"
              >
                {QUOTE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </fieldset>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={3}
              data-testid="textarea-quote-notes"
              placeholder="Any additional notes about this quote..."
              className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-[rgba(201,168,76,0.4)] placeholder:text-white/20"
            />
          </div>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            data-testid="button-save-quote"
            className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold"
          >
            {mutation.isPending ? "Saving..." : "Save Quote"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Referral Form ────────────────────────────────────────────────────────

function AddReferralPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    referrerName: "", company: "", contactEmail: "", contactPhone: "",
    leadSource: "Real Estate Agent" as Referral["leadSource"],
    clientName: "", clientCompany: "", estimatedValue: "", notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/admin/referrals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({ title: "Referral logged", description: "Referral partner has been saved." });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Could not save referral.", variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-[hsl(220,20%,8%)] border-l border-[rgba(201,168,76,0.15)] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.06)]">
          <h3 className="text-white font-semibold font-serif">Log Referral Partner</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <fieldset className="space-y-3">
            <legend className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Referrer</legend>
            <Field label="Referrer Name *" value={form.referrerName} onChange={v => set("referrerName", v)} placeholder="e.g. James Mitchell" />
            <Field label="Company" value={form.company} onChange={v => set("company", v)} placeholder="e.g. Mitchell Realty Group" />
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Lead Source *</label>
              <select
                value={form.leadSource}
                onChange={e => set("leadSource", e.target.value)}
                data-testid="select-referral-source"
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[rgba(201,168,76,0.4)]"
              >
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" value={form.contactPhone} onChange={v => set("contactPhone", v)} placeholder="+61 4xx xxx xxx" />
              <Field label="Email" value={form.contactEmail} onChange={v => set("contactEmail", v)} placeholder="james@realty.com.au" />
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2">Client / Lead</legend>
            <Field label="Client Name" value={form.clientName} onChange={v => set("clientName", v)} placeholder="e.g. Sarah Chen" />
            <Field label="Client Company" value={form.clientCompany} onChange={v => set("clientCompany", v)} placeholder="e.g. NovaTech Solutions" />
            <Field label="Estimated Project Value" value={form.estimatedValue} onChange={v => set("estimatedValue", v)} placeholder="e.g. $85,000" />
          </fieldset>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={3}
              data-testid="textarea-referral-notes"
              placeholder="Context about this referral..."
              className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-[rgba(201,168,76,0.4)] placeholder:text-white/20"
            />
          </div>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            data-testid="button-save-referral"
            className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold"
          >
            {mutation.isPending ? "Saving..." : "Save Referral"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Field ─────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder = "", type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-white/50 text-xs mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[rgba(201,168,76,0.4)] placeholder:text-white/20"
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSupplierQuotes() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<"quotes" | "referrals">("quotes");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [showAddReferral, setShowAddReferral] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Supplier Quotes | The Corporate Desk Admin";
    if (sessionStorage.getItem("tcd_admin_auth") === "true") setAuthed(true);
  }, []);

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<SupplierQuote[]>({
    queryKey: ["/api/admin/supplier-quotes"],
    enabled: authed,
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery<Referral[]>({
    queryKey: ["/api/admin/referrals"],
    enabled: authed,
  });

  const updateQuoteStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/supplier-quotes/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/supplier-quotes"] }),
    onError: () => toast({ title: "Error", description: "Could not update status.", variant: "destructive" }),
  });

  const deleteQuote = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/supplier-quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/supplier-quotes"] });
      toast({ title: "Deleted", description: "Quote removed." });
    },
  });

  const updateReferralStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/referrals/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] }),
    onError: () => toast({ title: "Error", description: "Could not update status.", variant: "destructive" }),
  });

  const deleteReferral = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/referrals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({ title: "Deleted", description: "Referral removed." });
    },
  });

  function handleLogin() {
    if (validateAdminLogin(email, pw)) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  const filteredQuotes = quotes.filter(q => {
    const matchSearch = !search ||
      q.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      q.productName.toLowerCase().includes(search.toLowerCase()) ||
      q.sku.toLowerCase().includes(search.toLowerCase()) ||
      (q.projectReference ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredReferrals = referrals.filter(r => {
    const matchSearch = !search ||
      r.referrerName.toLowerCase().includes(search.toLowerCase()) ||
      (r.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.clientCompany ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-2xl font-serif font-bold text-white">THE CORPORATE</span>
            <div className="text-sm font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase">DESK</div>
          </div>
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4 text-center">Admin Access</h2>
            <label className="block text-sm text-white/60 mb-2">Admin Email</label>
            <Input
              type="email"
              placeholder="admin@thecorporatedesk.com.au"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              data-testid="input-supplier-email"
              className="bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-white placeholder:text-white/30 mb-3"
            />
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <Input
              type="password"
              placeholder="Enter password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              data-testid="input-admin-password"
              className="bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-white placeholder:text-white/30 mb-3"
            />
            {pwError && <p className="text-red-400 text-sm mb-3">Incorrect credentials. Please try again.</p>}
            <Button
              onClick={handleLogin}
              data-testid="button-admin-login"
              className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold"
            >
              Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const nextQuoteStatus = (current: SupplierQuote["status"]) => {
    const idx = QUOTE_STATUSES.indexOf(current);
    return idx < QUOTE_STATUSES.length - 1 ? QUOTE_STATUSES[idx + 1] : null;
  };

  const nextReferralStatus = (current: Referral["status"]) => {
    const idx = REFERRAL_STATUSES.indexOf(current);
    return idx < REFERRAL_STATUSES.length - 1 ? REFERRAL_STATUSES[idx + 1] : null;
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">
      {showAddQuote && <AddQuotePanel onClose={() => setShowAddQuote(false)} />}
      {showAddReferral && <AddReferralPanel onClose={() => setShowAddReferral(false)} />}

      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <button data-testid="link-back-dashboard" className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
                <ChevronLeft className="w-4 h-4" /> Dashboard
              </button>
            </Link>
            <span className="text-white/20">|</span>
            <div>
              <span className="text-white font-semibold text-sm">Supplier & Referral Hub</span>
            </div>
          </div>
          <div className="flex gap-2">
            {tab === "quotes" ? (
              <Button
                size="sm"
                onClick={() => setShowAddQuote(true)}
                data-testid="button-add-quote"
                className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Quote
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowAddReferral(true)}
                data-testid="button-add-referral"
                className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Referral
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Quotes", value: quotes.length, icon: ClipboardList },
            { label: "Active (Not Delivered)", value: quotes.filter(q => q.status !== "Delivered").length, icon: Package },
            { label: "Approved / Ordered", value: quotes.filter(q => ["Approved", "Ordered", "Shipped"].includes(q.status)).length, icon: Check },
            { label: "Referral Partners", value: referrals.length, icon: Users },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`} className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  <span className="text-white/40 text-xs uppercase tracking-wide">{kpi.label}</span>
                </div>
                <div className="text-3xl font-serif font-bold text-white">{kpi.value}</div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[rgba(255,255,255,0.02)] rounded-xl p-1 w-fit">
          {(["quotes", "referrals"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); setStatusFilter("All"); }}
              data-testid={`tab-${t}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t
                  ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {t === "quotes" ? `Supplier Quotes (${quotes.length})` : `Referrals (${referrals.length})`}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
              placeholder={tab === "quotes" ? "Search by supplier, product, SKU..." : "Search by referrer, company..."}
              className="w-full pl-9 pr-4 py-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg text-white text-sm focus:outline-none focus:border-[rgba(201,168,76,0.4)] placeholder:text-white/25"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(tab === "quotes" ? ["All", ...QUOTE_STATUSES] : ["All", ...REFERRAL_STATUSES]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                data-testid={`filter-${s.toLowerCase()}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  statusFilter === s
                    ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)]"
                    : "border-[rgba(255,255,255,0.07)] text-white/40 hover:text-white/70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Supplier Quotes Table ── */}
        {tab === "quotes" && (
          <div className="space-y-3">
            {quotesLoading ? (
              <div className="text-white/40 text-sm py-8 text-center">Loading quotes...</div>
            ) : filteredQuotes.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-[rgba(255,255,255,0.06)] rounded-2xl">
                <Package className="w-10 h-10 text-white/15 mx-auto mb-3" />
                <p className="text-white/30 text-sm">
                  {search || statusFilter !== "All" ? "No quotes match your search." : "No supplier quotes yet. Log your first quote."}
                </p>
                {!search && statusFilter === "All" && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddQuote(true)}
                    className="mt-4 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Log First Quote
                  </Button>
                )}
              </div>
            ) : filteredQuotes.map(q => {
              const next = nextQuoteStatus(q.status);
              return (
                <div
                  key={q.id}
                  data-testid={`card-quote-${q.id}`}
                  className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,168,76,0.15)] rounded-xl p-5 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-white font-semibold text-sm">{q.productName}</h3>
                        <Badge className={`text-xs border ${QUOTE_STATUS_STYLE[q.status]}`}>{q.status}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45 mb-3">
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {q.supplierName}</span>
                        <span>SKU: {q.sku}</span>
                        <span>Qty: {q.quantity}</span>
                        {q.colourFinish && <span>{q.colourFinish}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45 mb-3">
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {q.unitPrice} ex GST</span>
                        {q.freightCost && <span><Truck className="w-3 h-3 inline mr-0.5" /> {q.freightCost} freight</span>}
                        {q.leadTime && <span><Calendar className="w-3 h-3 inline mr-0.5" /> {q.leadTime}</span>}
                      </div>
                      {q.projectReference && (
                        <p className="text-xs text-[hsl(43,78%,55%)] mb-1">Project: {q.projectReference}</p>
                      )}
                      {q.notes && <p className="text-xs text-white/30 italic">{q.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <span className="text-white/25 text-xs">{formatDate(q.quoteDate)}</span>
                      <div className="flex gap-2">
                        {next && (
                          <button
                            onClick={() => updateQuoteStatus.mutate({ id: q.id, status: next })}
                            data-testid={`button-advance-${q.id}`}
                            disabled={updateQuoteStatus.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] text-xs hover:bg-[rgba(201,168,76,0.15)] transition-all"
                          >
                            <ArrowRight className="w-3 h-3" /> {next}
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm("Delete this quote?")) deleteQuote.mutate(q.id); }}
                          data-testid={`button-delete-${q.id}`}
                          className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {q.supplierPhone && (
                        <a href={`tel:${q.supplierPhone}`} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                          <Phone className="w-3 h-3" /> {q.supplierPhone}
                        </a>
                      )}
                      {q.supplierEmail && (
                        <a href={`mailto:${q.supplierEmail}`} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                          <Mail className="w-3 h-3" /> {q.supplierEmail}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Referrals Table ── */}
        {tab === "referrals" && (
          <div className="space-y-3">
            {referralsLoading ? (
              <div className="text-white/40 text-sm py-8 text-center">Loading referrals...</div>
            ) : filteredReferrals.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-[rgba(255,255,255,0.06)] rounded-2xl">
                <Users className="w-10 h-10 text-white/15 mx-auto mb-3" />
                <p className="text-white/30 text-sm">
                  {search || statusFilter !== "All" ? "No referrals match your search." : "No referrals yet. Add your first referral partner."}
                </p>
                {!search && statusFilter === "All" && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddReferral(true)}
                    className="mt-4 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Referral Partner
                  </Button>
                )}
              </div>
            ) : filteredReferrals.map(r => {
              const next = nextReferralStatus(r.status);
              return (
                <div
                  key={r.id}
                  data-testid={`card-referral-${r.id}`}
                  className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,168,76,0.15)] rounded-xl p-5 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-white font-semibold text-sm">{r.referrerName}</h3>
                        {r.company && <span className="text-white/40 text-xs">— {r.company}</span>}
                        <Badge className={`text-xs border ${REFERRAL_STATUS_STYLE[r.status]}`}>{r.status}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45 mb-3">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {r.leadSource}</span>
                        {r.clientCompany && <span>Client: {r.clientCompany}</span>}
                        {r.clientName && <span>{r.clientName}</span>}
                      </div>
                      {r.estimatedValue && (
                        <p className="text-xs text-[hsl(43,78%,55%)] mb-1">
                          <DollarSign className="w-3 h-3 inline mr-0.5" /> Est. value: {r.estimatedValue}
                        </p>
                      )}
                      {r.notes && <p className="text-xs text-white/30 italic">{r.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <span className="text-white/25 text-xs">{formatDate(r.createdAt)}</span>
                      <div className="flex gap-2">
                        {next && next !== "Lost" && (
                          <button
                            onClick={() => updateReferralStatus.mutate({ id: r.id, status: next })}
                            data-testid={`button-advance-referral-${r.id}`}
                            disabled={updateReferralStatus.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] text-xs hover:bg-[rgba(201,168,76,0.15)] transition-all"
                          >
                            <ArrowRight className="w-3 h-3" /> {next}
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm("Delete this referral?")) deleteReferral.mutate(r.id); }}
                          data-testid={`button-delete-referral-${r.id}`}
                          className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {r.contactPhone && (
                        <a href={`tel:${r.contactPhone}`} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                          <Phone className="w-3 h-3" /> {r.contactPhone}
                        </a>
                      )}
                      {r.contactEmail && (
                        <a href={`mailto:${r.contactEmail}`} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                          <Mail className="w-3 h-3" /> {r.contactEmail}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
