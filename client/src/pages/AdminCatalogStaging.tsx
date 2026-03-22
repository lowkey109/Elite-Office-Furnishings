import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Image, Upload, CheckCircle, Clock, Globe, AlertCircle, Star, Zap, Search,
  ChevronDown, ChevronUp, RefreshCw, Tag, Package, Layers, X, Edit3, Eye,
  Copy, Filter, MoreHorizontal, FolderOpen, Plus
} from "lucide-react";

const AUTH_KEY = "tcd_admin_auth";

const STATUS_CFG: Record<string, { label: string; color: string; border: string; dot: string }> = {
  uploaded:          { label: "Uploaded",             color: "text-white/50",   border: "border-white/15",    dot: "bg-white/30" },
  needs_review:      { label: "Needs Review",         color: "text-amber-400",  border: "border-amber-500/30", dot: "bg-amber-400" },
  approved:          { label: "Approved",             color: "text-emerald-400",border: "border-emerald-500/25",dot: "bg-emerald-400" },
  ready_for_website: { label: "Ready for Website",   color: "text-blue-400",   border: "border-blue-500/25", dot: "bg-blue-400" },
  live:              { label: "Live",                 color: "text-green-400",  border: "border-green-500/25",dot: "bg-green-400" },
};

const STATUS_FLOW = ["uploaded","needs_review","approved","ready_for_website","live"];

type StagingBatch = {
  id: string; name: string; notes?: string; status: string;
  totalImages: number; uploadedCount: number; needsReviewCount: number;
  approvedCount: number; readyCount: number; liveCount: number;
  createdAt: string;
};

type StagingItem = {
  id: string; batchId: string; filename: string; imageUrl: string;
  sku?: string; productName?: string; category?: string; subcategory?: string;
  dimensions?: string; materials?: string; priceAud?: string;
  notes?: string; adminNotes?: string;
  isDuplicate?: boolean; status: string;
  aiSuggestions?: { productName?: string; category?: string; sku?: string; priceAud?: string; dimensions?: string };
  uploadedAt: string; createdAt: string;
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.uploaded;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 border ${cfg.border} ${cfg.color} font-semibold tracking-wide`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ItemCard({ item, onUpdate, onStatusChange, onAiSuggest }: {
  item: StagingItem;
  onUpdate: (id: string, fields: Partial<StagingItem>) => void;
  onStatusChange: (id: string, status: string) => void;
  onAiSuggest: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    sku: item.sku || "",
    productName: item.productName || "",
    category: item.category || "",
    subcategory: item.subcategory || "",
    dimensions: item.dimensions || "",
    materials: item.materials || "",
    priceAud: item.priceAud || "",
    notes: item.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(item.id, fields);
    setSaving(false);
    setEditing(false);
  };

  const applyAiSuggestion = () => {
    if (!item.aiSuggestions) return;
    setFields(f => ({
      ...f,
      productName: item.aiSuggestions?.productName || f.productName,
      category: item.aiSuggestions?.category || f.category,
      sku: item.aiSuggestions?.sku || f.sku,
      priceAud: item.aiSuggestions?.priceAud || f.priceAud,
      dimensions: item.aiSuggestions?.dimensions || f.dimensions,
    }));
    setEditing(true);
  };

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(item.status) + 1];
  const prevStatus = STATUS_FLOW[STATUS_FLOW.indexOf(item.status) - 1];

  return (
    <div data-testid={`card-staging-item-${item.id}`} className={`border bg-[hsl(220,18%,6%)] ${item.isDuplicate ? "border-orange-500/25" : (STATUS_CFG[item.status]?.border || "border-white/8")}`}>
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
        <img
          src={item.imageUrl}
          alt={item.productName || item.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {item.isDuplicate && (
          <div className="absolute top-2 left-2 bg-orange-500/90 text-white text-[10px] px-1.5 py-0.5 font-bold">
            DUPLICATE
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={item.status} />
        </div>
        <div className="absolute bottom-2 left-2 text-[10px] text-white/40 bg-black/50 px-1.5 py-0.5">
          {item.filename}
        </div>
      </div>

      {/* Meta */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-tight truncate">
              {item.productName || <span className="text-white/30 italic">Unnamed product</span>}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {item.category || <span className="text-white/20">No category</span>}
              {item.sku && <span className="ml-2 text-[hsl(43,78%,52%)]">#{item.sku}</span>}
            </p>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-white/30 hover:text-white/60 flex-shrink-0 mt-0.5"
            data-testid={`button-expand-item-${item.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick info row */}
        <div className="flex gap-2 text-[10px] text-white/30 mb-3">
          {item.dimensions && <span className="flex items-center gap-1"><Package className="w-3 h-3" />{item.dimensions}</span>}
          {item.priceAud && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />A${item.priceAud}</span>}
        </div>

        {/* AI suggestion strip */}
        {item.aiSuggestions && (
          <div className="mb-3 p-2 border border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[hsl(43,78%,52%)] font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" /> AI SUGGESTED
              </span>
              <button onClick={applyAiSuggestion} className="text-[10px] text-[hsl(43,78%,52%)] hover:underline">Apply</button>
            </div>
            <p className="text-[11px] text-white/60 truncate">{item.aiSuggestions.productName}</p>
            <p className="text-[10px] text-white/30">{item.aiSuggestions.category} · {item.aiSuggestions.sku}</p>
          </div>
        )}

        {/* Expanded edit panel */}
        {expanded && (
          <div className="border-t border-white/8 pt-3 mt-1 space-y-2">
            {editing ? (
              <>
                {[
                  { label: "Product Name", key: "productName", placeholder: "e.g. Executive Director Desk..." },
                  { label: "SKU", key: "sku", placeholder: "e.g. TCD-EXEC-2400-WN" },
                  { label: "Category", key: "category", placeholder: "e.g. Executive Desks" },
                  { label: "Subcategory", key: "subcategory", placeholder: "e.g. L-Shape" },
                  { label: "Dimensions", key: "dimensions", placeholder: "e.g. 2400 × 1200 × 750mm" },
                  { label: "Materials", key: "materials", placeholder: "e.g. Walnut veneer, Powder-coat steel" },
                  { label: "Price (AUD)", key: "priceAud", placeholder: "e.g. 3,800–5,200" },
                  { label: "Notes", key: "notes", placeholder: "Internal staging notes..." },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-white/40 block mb-0.5">{f.label}</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 text-white text-xs px-2 py-1.5 outline-none focus:border-white/25"
                      value={(fields as any)[f.key]}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      data-testid={`input-staging-${f.key}-${item.id}`}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    data-testid={`button-save-staging-${item.id}`}
                    className="flex-1 bg-[hsl(43,78%,52%)] text-black text-xs py-1.5 font-semibold disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 border border-white/15 text-white/50 text-xs py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-1 text-[11px] text-white/50">
                {item.productName && <p><span className="text-white/25">Name</span> · {item.productName}</p>}
                {item.sku && <p><span className="text-white/25">SKU</span> · {item.sku}</p>}
                {item.category && <p><span className="text-white/25">Cat</span> · {item.category}</p>}
                {item.dimensions && <p><span className="text-white/25">Size</span> · {item.dimensions}</p>}
                {item.materials && <p><span className="text-white/25">Materials</span> · {item.materials}</p>}
                {item.notes && <p className="italic text-white/30">{item.notes}</p>}
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {!editing && (
            <button
              onClick={() => { setExpanded(true); setEditing(true); }}
              className="text-[10px] px-2 py-1 border border-white/15 text-white/50 hover:text-white hover:border-white/30 flex items-center gap-1"
              data-testid={`button-edit-staging-${item.id}`}
            >
              <Edit3 className="w-2.5 h-2.5" /> Edit
            </button>
          )}
          <button
            onClick={() => onAiSuggest(item.id)}
            className="text-[10px] px-2 py-1 border border-[hsl(43,78%,52%)]/30 text-[hsl(43,78%,52%)]/70 hover:text-[hsl(43,78%,52%)] flex items-center gap-1"
            data-testid={`button-ai-suggest-${item.id}`}
          >
            <Zap className="w-2.5 h-2.5" /> AI Suggest
          </button>
          {nextStatus && (
            <button
              onClick={() => onStatusChange(item.id, nextStatus)}
              className="text-[10px] px-2 py-1 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1 ml-auto"
              data-testid={`button-advance-staging-${item.id}`}
            >
              <CheckCircle className="w-2.5 h-2.5" /> {STATUS_CFG[nextStatus]?.label || nextStatus}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminCatalogStaging() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [authed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "true");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [newBatchName, setNewBatchName] = useState("");
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { data: batches = [], isLoading: batchesLoading } = useQuery<StagingBatch[]>({
    queryKey: ["/api/admin/catalog-staging/batches"],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<StagingItem[]>({
    queryKey: ["/api/admin/catalog-staging/items", activeBatchId],
    queryFn: () => {
      const url = activeBatchId
        ? `/api/admin/catalog-staging/items?batchId=${activeBatchId}`
        : `/api/admin/catalog-staging/items`;
      return fetch(url).then(r => r.json());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<StagingItem> }) =>
      apiRequest("PATCH", `/api/admin/catalog-staging/items/${id}`, fields).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/items"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/batches"] });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("POST", `/api/admin/catalog-staging/items/${id}/status`, { status }).then(r => r.json()),
    onSuccess: (_d, v) => {
      toast({ title: `Status → ${STATUS_CFG[v.status]?.label || v.status}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/items"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/batches"] });
    },
    onError: () => toast({ title: "Status update failed", variant: "destructive" }),
  });

  const aiSuggestMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/admin/catalog-staging/items/${id}/ai-suggest`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "AI suggestions generated" });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/items"] });
    },
    onError: () => toast({ title: "AI suggestion failed", variant: "destructive" }),
  });

  const approveAllMutation = useMutation({
    mutationFn: (batchId: string) =>
      apiRequest("POST", `/api/admin/catalog-staging/batch/${batchId}/approve-all`).then(r => r.json()),
    onSuccess: (d: any) => {
      toast({ title: `${d.approved} of ${d.total} images approved` });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/items"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/batches"] });
    },
    onError: () => toast({ title: "Approve all failed", variant: "destructive" }),
  });

  const detectDupsMutation = useMutation({
    mutationFn: (batchId: string) =>
      apiRequest("POST", `/api/admin/catalog-staging/batch/${batchId}/detect-duplicates`).then(r => r.json()),
    onSuccess: (d: any) => {
      toast({ title: d.duplicatesFound > 0 ? `${d.duplicatesFound} duplicates detected` : "No duplicates found" });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/items"] });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: ({ name, notes }: { name: string; notes?: string }) =>
      apiRequest("POST", `/api/admin/catalog-staging/batches`, { name, notes }).then(r => r.json()),
    onSuccess: (b: any) => {
      toast({ title: `Batch "${b.name}" created` });
      qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/batches"] });
      setActiveBatchId(b.id);
      setNewBatchName("");
      setShowNewBatch(false);
    },
  });

  const handleSeedBatch = async () => {
    setSeeding(true);
    try {
      const r = await apiRequest("POST", "/api/admin/catalog-staging/seed-batch", { batchName: "Batch 1 — March 2026 Upload" });
      const data = r as any;
      if (data.alreadyExists) {
        toast({ title: "Batch already exists", description: "Opening existing batch" });
        setActiveBatchId(data.batchId);
      } else {
        toast({ title: `Batch created — ${data.inserted} images staged` });
        qc.invalidateQueries({ queryKey: ["/api/admin/catalog-staging/batches"] });
        setActiveBatchId(data.batch.id);
      }
    } catch {
      toast({ title: "Failed to seed batch", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,18%,7%)] flex items-center justify-center">
        <div className="text-white/50 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Admin access required</p>
          <a href="/admin" className="text-[hsl(43,78%,52%)] text-sm mt-2 block">Go to Admin Login</a>
        </div>
      </div>
    );
  }

  const activeBatch = batches.find(b => b.id === activeBatchId);

  const filteredItems = items.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        item.productName?.toLowerCase().includes(q) ||
        item.filename.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusCounts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[hsl(220,18%,7%)] text-white">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin/products" className="text-white/30 hover:text-white/60 text-sm">
            ← Product Command Centre
          </a>
          <span className="text-white/15">/</span>
          <span className="text-white/60 text-sm">Catalog Staging</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30 border border-white/10 px-2 py-0.5">STAGING — NOT LIVE</span>
        </div>
      </div>

      <div className="p-6 max-w-screen-2xl mx-auto">
        {/* Title + seed */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-light text-white tracking-wide mb-1">Catalog Staging</h1>
            <p className="text-sm text-white/35">
              Safe holding area for uploaded images. Nothing goes live until you approve it.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSeedBatch}
              disabled={seeding}
              data-testid="button-seed-march-batch"
              className="px-4 py-2 border border-[hsl(43,78%,52%)]/40 text-[hsl(43,78%,52%)] text-sm hover:bg-[hsl(43,78%,52%)]/10 flex items-center gap-2 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {seeding ? "Loading..." : "Load March 2026 Upload"}
            </button>
            <button
              onClick={() => setShowNewBatch(true)}
              data-testid="button-new-batch"
              className="px-4 py-2 bg-white/8 border border-white/15 text-white/70 text-sm hover:bg-white/12 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Batch
            </button>
          </div>
        </div>

        {/* New batch form */}
        {showNewBatch && (
          <div className="mb-6 p-4 border border-white/12 bg-white/[0.02] flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-white/40 block mb-1">Batch Name</label>
              <input
                className="w-full bg-white/5 border border-white/15 text-white text-sm px-3 py-2 outline-none focus:border-white/30"
                value={newBatchName}
                onChange={e => setNewBatchName(e.target.value)}
                placeholder="e.g. April 2026 Upload — Executive Series"
                data-testid="input-new-batch-name"
              />
            </div>
            <button
              onClick={() => createBatchMutation.mutate({ name: newBatchName })}
              disabled={!newBatchName || createBatchMutation.isPending}
              className="px-4 py-2 bg-white/10 border border-white/20 text-white text-sm disabled:opacity-40"
              data-testid="button-create-batch"
            >
              Create Batch
            </button>
            <button onClick={() => setShowNewBatch(false)} className="text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Batch list */}
        {batches.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-white/30 mb-3 uppercase tracking-wider">Upload Batches</p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setActiveBatchId(null)}
                className={`px-4 py-2 text-sm border transition-colors ${!activeBatchId ? "border-white/30 bg-white/8 text-white" : "border-white/10 text-white/40 hover:text-white/60"}`}
                data-testid="button-batch-all"
              >
                All Batches ({items.length})
              </button>
              {batches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setActiveBatchId(b.id)}
                  className={`px-4 py-2 text-sm border transition-colors text-left ${activeBatchId === b.id ? "border-[hsl(43,78%,52%)]/50 bg-[hsl(43,78%,52%)]/8 text-white" : "border-white/10 text-white/40 hover:text-white/60"}`}
                  data-testid={`button-batch-${b.id}`}
                >
                  <span className="block font-medium">{b.name}</span>
                  <span className="text-[10px] text-white/30">
                    {b.totalImages} images · {b.approvedCount} approved · {b.liveCount} live
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Batch actions */}
        {activeBatchId && activeBatch && (
          <div className="mb-6 p-4 border border-white/8 bg-white/[0.02] flex items-center gap-4 flex-wrap">
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{activeBatch.name}</p>
              {activeBatch.notes && <p className="text-xs text-white/35 mt-0.5 max-w-2xl">{activeBatch.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => detectDupsMutation.mutate(activeBatchId)}
                disabled={detectDupsMutation.isPending}
                data-testid="button-detect-duplicates"
                className="px-3 py-1.5 text-xs border border-orange-500/25 text-orange-400 hover:bg-orange-500/10 flex items-center gap-1.5"
              >
                <Copy className="w-3 h-3" /> Detect Duplicates
              </button>
              <button
                onClick={() => approveAllMutation.mutate(activeBatchId)}
                disabled={approveAllMutation.isPending}
                data-testid="button-approve-all"
                className="px-3 py-1.5 text-xs border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
              >
                <CheckCircle className="w-3 h-3" /> Approve All
              </button>
            </div>
          </div>
        )}

        {/* Status filter bar */}
        {items.length > 0 && (
          <div className="mb-5 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5">
              {["all", ...STATUS_FLOW].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1 border transition-colors ${statusFilter === s ? "border-white/30 text-white bg-white/8" : "border-white/8 text-white/35 hover:text-white/60"}`}
                  data-testid={`filter-staging-${s}`}
                >
                  {s === "all" ? `All (${items.length})` : `${STATUS_CFG[s]?.label} (${statusCounts[s] || 0})`}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                className="bg-white/5 border border-white/10 text-white text-xs pl-8 pr-3 py-1.5 outline-none focus:border-white/25 w-52"
                placeholder="Search name, SKU, category..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                data-testid="input-staging-search"
              />
            </div>
          </div>
        )}

        {/* Status guide */}
        <div className="mb-5 flex items-center gap-1.5 text-[10px] text-white/25">
          <span>Status flow:</span>
          {STATUS_FLOW.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`${STATUS_CFG[s]?.color} font-medium`}>{STATUS_CFG[s]?.label}</span>
              {i < STATUS_FLOW.length - 1 && <span>→</span>}
            </span>
          ))}
          <span className="ml-3 text-white/15">Nothing goes live until you approve it.</span>
        </div>

        {/* Empty state */}
        {!itemsLoading && items.length === 0 && (
          <div className="py-20 text-center border border-white/8 bg-white/[0.02]">
            <FolderOpen className="w-10 h-10 mx-auto mb-4 text-white/15" />
            <p className="text-white/40 mb-2">No images in staging yet</p>
            <p className="text-sm text-white/25 mb-6">
              Click "Load March 2026 Upload" to stage your 20 uploaded product images.
            </p>
            <button
              onClick={handleSeedBatch}
              disabled={seeding}
              className="px-6 py-3 border border-[hsl(43,78%,52%)]/40 text-[hsl(43,78%,52%)] text-sm hover:bg-[hsl(43,78%,52%)]/10"
            >
              {seeding ? "Loading..." : "Load Uploaded Images (20 images)"}
            </button>
          </div>
        )}

        {itemsLoading && (
          <div className="py-16 text-center text-white/25">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
            Loading staged images...
          </div>
        )}

        {/* Image grid */}
        {filteredItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onUpdate={(id, fields) => updateMutation.mutate({ id, fields })}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onAiSuggest={(id) => aiSuggestMutation.mutate(id)}
              />
            ))}
          </div>
        )}

        {filteredItems.length === 0 && items.length > 0 && (
          <div className="py-10 text-center text-white/30 border border-white/8">
            No images match the current filter.
          </div>
        )}

        {/* Bottom summary */}
        {items.length > 0 && (
          <div className="mt-8 p-4 border-t border-white/8 flex gap-6 text-xs text-white/35 flex-wrap">
            <span><span className="text-white/60 font-medium">{items.length}</span> total in staging</span>
            {Object.entries(statusCounts).map(([s, n]) => (
              <span key={s}><span className={`font-medium ${STATUS_CFG[s]?.color}`}>{n}</span> {STATUS_CFG[s]?.label}</span>
            ))}
            <span className="ml-auto text-[hsl(43,78%,52%)]/50">
              Nothing goes live until status = Live. You control when.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
