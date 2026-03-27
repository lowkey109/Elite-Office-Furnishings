import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Upload, Zap, CheckCircle, Eye, Edit3, Trash2, RefreshCw,
  Plus, Star, BarChart3, FolderOpen, Globe, AlertCircle, Clock, X,
  TrendingUp, Tag, Search, Filter, BookOpen, ChevronDown, ChevronUp
} from "lucide-react";


type Tab = "dashboard" | "upload" | "queue" | "review" | "published" | "categories" | "seo";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "text-white/60", bg: "bg-white/5" },
  processing: { label: "Processing", color: "text-blue-400", bg: "bg-blue-400/10" },
  ready: { label: "Ready to Publish", color: "text-green-400", bg: "bg-green-400/10" },
  review: { label: "Review", color: "text-amber-400", bg: "bg-amber-400/10" },
  needs_data: { label: "Needs Data", color: "text-orange-400", bg: "bg-orange-400/10" },
  hold_back: { label: "Hold Back", color: "text-red-400", bg: "bg-red-400/10" },
  published: { label: "Live", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  unpublished: { label: "Unpublished", color: "text-white/40", bg: "bg-white/5" },
  rejected: { label: "Rejected", color: "text-red-400/70", bg: "bg-red-400/5" },
};

const READINESS_CONFIG: Record<string, { label: string; band: string; color: string }> = {
  ready: { label: "Ready to Publish", band: "85–100", color: "text-green-400" },
  publish: { label: "Publish", band: "70–84", color: "text-emerald-400" },
  review: { label: "Review", band: "50–69", color: "text-amber-400" },
  hold_back: { label: "Hold Back", band: "<50", color: "text-red-400" },
};

type Product = {
  id: string; title: string; sku?: string; shortDescription?: string; fullDescription?: string;
  features?: string[]; tags?: string[]; categoryName?: string; subcategoryName?: string;
  style?: string; productType?: string; brand?: string; dimensions?: string; materials?: string;
  imageUrl?: string; seoTitle?: string; seoDescription?: string; imageAltText?: string;
  aiConfidenceScore?: number; marketAppealScore?: number; commercialRelevanceScore?: number;
  visualQualityScore?: number; brandFitScore?: number; overallAiScore?: number;
  publishReadiness?: string; status: string; reviewNotes?: string; isLive?: boolean;
  publishedAt?: string; createdAt: string; updatedAt: string;
};

type Category = {
  id: string; name: string; slug: string; parentId?: string; description?: string;
  seoTitle?: string; seoDescription?: string; introText?: string; sortOrder?: number; isActive?: boolean;
};

type UploadItem = {
  id: string; filename: string; originalName: string; mimeType: string; uploadType: string;
  uploadStatus: string; aiStatus: string; detectedSku?: string; errorMessage?: string; createdAt: string;
};

export default function AdminProductCommandCentre() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<Partial<Product>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadPreviews, setUploadPreviews] = useState<Array<{ name: string; type: string; url?: string }>>([]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: stats, refetch: refetchStats } = useQuery<{
    total: number; live: number; ready: number; review: number; needsData: number;
    holdBack: number; processing: number; avgScore: number;
    uploads: { total: number; processing: number; done: number };
  }>({ queryKey: ["/api/admin/products/stats"], refetchInterval: 15000 });

  const { data: products, refetch: refetchProducts, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products", statusFilter],
    queryFn: () => fetch(`/api/admin/products${statusFilter ? `?status=${statusFilter}` : ""}`).then(r => r.json()),
  });

  const { data: uploads, refetch: refetchUploads } = useQuery<UploadItem[]>({
    queryKey: ["/api/admin/uploads"],
    enabled: activeTab === "queue",
    refetchInterval: 5000,
  });

  const { data: categories, refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ["/api/admin/product-categories"],
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const publishMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/products/${id}/publish`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Product published ✓" }); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); refetchStats(); },
    onError: (e: any) => toast({ title: "Publish failed", description: e.message, variant: "destructive" }),
  });

  const unpublishMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/products/${id}/unpublish`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Product unpublished" }); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); refetchStats(); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/products/${id}/approve`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Approved ✓" }); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/products/${id}/reject`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Rejected" }); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); },
  });

  const regenMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/products/${id}/regenerate`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Regenerating content..." }); setTimeout(() => qc.invalidateQueries({ queryKey: ["/api/admin/products"] }), 3000); },
    onError: (e: any) => toast({ title: "Regen failed", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      apiRequest(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Saved ✓" }); setEditMode(false); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); },
  });

  const bulkPublishMut = useMutation({
    mutationFn: (ids: string[]) => apiRequest("/api/admin/products/bulk-publish", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: (d: any) => { toast({ title: `Published ${d.published} products` }); setSelectedIds(new Set()); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); refetchStats(); },
  });

  const createCatMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/product-categories", { method: "POST", body: JSON.stringify({ name: newCatName, slug: newCatSlug }) }),
    onSuccess: () => { toast({ title: "Category created" }); setNewCatName(""); setNewCatSlug(""); qc.invalidateQueries({ queryKey: ["/api/admin/product-categories"] }); },
  });

  const genCatSeoMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/product-categories/${id}/generate-seo`, { method: "POST" }),
    onSuccess: () => { toast({ title: "SEO generated ✓" }); qc.invalidateQueries({ queryKey: ["/api/admin/product-categories"] }); },
  });

  const manualCreateMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/products/create-manual", { method: "POST", body: JSON.stringify({ title: manualTitle, categoryName: manualCategory }) }),
    onSuccess: () => { toast({ title: "Product created — AI generating content..." }); setManualTitle(""); setManualCategory(""); qc.invalidateQueries({ queryKey: ["/api/admin/products"] }); setActiveTab("review"); },
    onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });

  const uploadRegisterMut = useMutation({
    mutationFn: (data: { filename: string; originalName: string; mimeType: string; sizeBytes?: number; fileUrl?: string; uploadType: string }) =>
      apiRequest("/api/admin/uploads/register", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Upload registered — AI processing started" });
      setUploadPreviews([]);
      qc.invalidateQueries({ queryKey: ["/api/admin/uploads"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      refetchStats();
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const previews = files.map(f => ({
      name: f.name,
      type: f.type,
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
    }));
    setUploadPreviews(previews);
  }

  async function submitUploads() {
    for (const p of uploadPreviews) {
      const uploadType = p.type.startsWith("image/") ? "image" : p.type.includes("pdf") ? "pdf" : p.type.includes("csv") ? "csv" : "xlsx";
      await uploadRegisterMut.mutateAsync({ filename: p.name, originalName: p.name, mimeType: p.type, uploadType, fileUrl: p.url });
    }
  }

  const filteredProducts = (products ?? []).filter(p => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.categoryName?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    }
    return true;
  });

  const TABS: Array<{ id: Tab; label: string; icon: any; count?: number }> = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "upload", label: "Upload Centre", icon: Upload },
    { id: "queue", label: "AI Queue", icon: Zap, count: stats?.uploads?.processing },
    { id: "review", label: "Draft Review", icon: Eye, count: stats?.review },
    { id: "published", label: "Published", icon: Globe, count: stats?.live },
    { id: "categories", label: "Categories", icon: FolderOpen },
    { id: "seo", label: "SEO Manager", icon: Search },
  ];

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[hsl(220,18%,7%)] text-white">
      {/* Top nav */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,9%)] sticky top-0 z-20">
        <div className="flex items-center gap-4 px-6 py-3">
          <div>
            <a href="/admin/command-centre" className="text-white/30 hover:text-white/60 text-[10px] transition-colors">← Admin</a>
            <h1 className="text-white font-bold text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-[hsl(43,78%,52%)]" /> AI Product Command Centre
            </h1>
          </div>
          <a
            href="/admin/catalog-staging"
            className="ml-3 px-3 py-1 border border-[hsl(43,78%,52%)]/30 text-[hsl(43,78%,52%)]/70 hover:text-[hsl(43,78%,52%)] text-xs flex items-center gap-1.5 whitespace-nowrap"
            data-testid="link-catalog-staging"
          >
            <Upload className="w-3 h-3" /> Catalog Staging
          </a>
          <div className="flex items-center gap-1 ml-auto overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? "bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,52%)] border border-[rgba(201,168,76,0.2)]" : "text-white/40 hover:text-white/70"}`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="bg-[hsl(43,78%,52%)] text-black text-[9px] font-bold px-1.5 rounded-full">{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6">

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Products", value: stats?.total ?? 0, color: "text-white", sub: "in system" },
                { label: "Live", value: stats?.live ?? 0, color: "text-green-400", sub: "published" },
                { label: "Ready to Publish", value: stats?.ready ?? 0, color: "text-emerald-400", sub: "approved" },
                { label: "In Review", value: stats?.review ?? 0, color: "text-amber-400", sub: "pending" },
                { label: "Needs Data", value: stats?.needsData ?? 0, color: "text-orange-400", sub: "" },
                { label: "Hold Back", value: stats?.holdBack ?? 0, color: "text-red-400", sub: "" },
                { label: "AI Queue", value: stats?.uploads?.processing ?? 0, color: "text-blue-400", sub: "processing" },
                { label: "Avg AI Score", value: stats?.avgScore ?? 0, color: "text-[hsl(43,78%,52%)]", sub: "/ 100" },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  {sub && <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>

            {/* Score bands legend */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mb-4">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-3">AI Score Bands</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(READINESS_CONFIG).map(([key, { label, band, color }]) => (
                  <div key={key} className="text-center p-3 bg-[rgba(255,255,255,0.03)] rounded-lg">
                    <p className={`text-lg font-bold ${color}`}>{band}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setActiveTab("upload")} className="flex items-center gap-2 p-4 bg-[rgba(201,168,76,0.08)] hover:bg-[rgba(201,168,76,0.14)] border border-[rgba(201,168,76,0.2)] rounded-xl text-[hsl(43,78%,52%)] text-sm font-semibold transition-colors" data-testid="btn-go-upload">
                <Upload className="w-4 h-4" /> Upload Products
              </button>
              <button onClick={() => setActiveTab("review")} className="flex items-center gap-2 p-4 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.07)] rounded-xl text-white/70 text-sm font-semibold transition-colors" data-testid="btn-go-review">
                <Eye className="w-4 h-4" /> Review Drafts
              </button>
              <button onClick={() => setActiveTab("categories")} className="flex items-center gap-2 p-4 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.07)] rounded-xl text-white/70 text-sm font-semibold transition-colors" data-testid="btn-go-categories">
                <FolderOpen className="w-4 h-4" /> Manage Categories
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOAD CENTRE ── */}
        {activeTab === "upload" && (
          <div className="max-w-2xl">
            <h2 className="text-white font-semibold mb-4">Upload Products</h2>

            {/* Manual create */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 mb-4">
              <h3 className="text-white/80 font-medium text-sm mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Create Product Manually</h3>
              <input
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm mb-2 outline-none focus:border-[rgba(201,168,76,0.4)]"
                placeholder="Product title (e.g. Executive Sit-Stand Desk)"
                data-testid="input-manual-title"
              />
              <select
                value={manualCategory}
                onChange={e => setManualCategory(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-[rgba(201,168,76,0.4)]"
                data-testid="select-manual-category"
              >
                <option value="">Select category...</option>
                {(categories ?? []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button
                onClick={() => { if (!manualTitle) return toast({ title: "Title required", variant: "destructive" }); manualCreateMut.mutate(); }}
                disabled={manualCreateMut.isPending}
                className="w-full flex items-center justify-center gap-2 bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.2)] border border-[rgba(201,168,76,0.2)] rounded-lg py-2 text-[hsl(43,78%,52%)] text-sm font-semibold transition-colors disabled:opacity-50"
                data-testid="btn-manual-create"
              >
                <Zap className="w-4 h-4" /> {manualCreateMut.isPending ? "AI Generating..." : "Create + AI Generate Content"}
              </button>
            </div>

            {/* File upload */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
              <h3 className="text-white/80 font-medium text-sm mb-3 flex items-center gap-2"><Upload className="w-4 h-4" /> File Upload</h3>
              <div
                className="border-2 border-dashed border-[rgba(255,255,255,0.1)] hover:border-[rgba(201,168,76,0.3)] rounded-xl p-8 text-center cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-dropzone"
              >
                <Upload className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/50 text-sm mb-1">Click to upload images, PDFs, CSV or XLSX</p>
                <p className="text-white/25 text-xs">Supports single, multi-image, and batch uploads</p>
                <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.csv,.xlsx" className="hidden" onChange={handleFileSelect} data-testid="input-file-upload" />
              </div>

              {uploadPreviews.length > 0 && (
                <div className="mt-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Selected ({uploadPreviews.length} files)</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {uploadPreviews.map((p, i) => (
                      <div key={i} className="bg-[rgba(255,255,255,0.04)] rounded-lg p-2 text-center">
                        {p.url ? (
                          <img src={p.url} alt={p.name} className="w-full h-20 object-cover rounded mb-1" />
                        ) : (
                          <div className="w-full h-20 flex items-center justify-center bg-[rgba(255,255,255,0.04)] rounded mb-1">
                            <FileIconComponent type={p.type} />
                          </div>
                        )}
                        <p className="text-white/50 text-[9px] truncate">{p.name}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={submitUploads}
                    disabled={uploadRegisterMut.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-[rgba(34,197,94,0.08)] hover:bg-[rgba(34,197,94,0.14)] border border-[rgba(34,197,94,0.2)] rounded-lg py-2 text-green-400 text-sm font-semibold transition-colors disabled:opacity-50"
                    data-testid="btn-submit-uploads"
                  >
                    <Zap className="w-4 h-4" /> {uploadRegisterMut.isPending ? "Processing..." : `Process ${uploadPreviews.length} Files with AI`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI QUEUE ── */}
        {activeTab === "queue" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">AI Processing Queue</h2>
              <button onClick={() => refetchUploads()} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {!uploads || uploads.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Zap className="w-8 h-8 mx-auto mb-2" />
                <p>No uploads yet — go to Upload Centre to add products</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uploads.map(u => (
                  <div key={u.id} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 flex items-center gap-4" data-testid={`upload-row-${u.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{u.originalName}</p>
                      <p className="text-white/30 text-[10px]">{u.uploadType} · {new Date(u.createdAt).toLocaleDateString("en-AU")} {u.detectedSku ? `· SKU: ${u.detectedSku}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <UploadStatusBadge status={u.uploadStatus} />
                      <AiStatusBadge status={u.aiStatus} />
                    </div>
                    {u.errorMessage && <p className="text-red-400 text-[10px] max-w-32 truncate" title={u.errorMessage}>{u.errorMessage}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DRAFT REVIEW ── */}
        {activeTab === "review" && (
          <div>
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-white font-semibold">Draft Review</h2>
              <div className="flex items-center gap-2 ml-auto">
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => bulkPublishMut.mutate(Array.from(selectedIds))}
                    disabled={bulkPublishMut.isPending}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-400/10 border border-green-400/20 text-green-400 rounded-lg font-semibold"
                    data-testid="btn-bulk-publish"
                  >
                    <Globe className="w-3 h-3" /> Bulk Publish ({selectedIds.size})
                  </button>
                )}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-1.5 text-white/60 text-xs outline-none" data-testid="select-status-filter">
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-1.5 text-white/60 text-xs outline-none w-36"
                  placeholder="Search products..."
                  data-testid="input-search-products"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-16 text-white/30"><Clock className="w-6 h-6 mx-auto mb-2 animate-spin" /> Loading...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Package className="w-8 h-8 mx-auto mb-2" />
                <p>No products yet — upload some or create manually</p>
                <button onClick={() => setActiveTab("upload")} className="mt-3 text-[hsl(43,78%,52%)] text-sm hover:text-[hsl(43,78%,65%)] transition-colors">Go to Upload Centre →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map(p => (
                  <ProductRow key={p.id} product={p} isSelected={selectedIds.has(p.id)}
                    onSelect={() => { const s = new Set(selectedIds); s.has(p.id) ? s.delete(p.id) : s.add(p.id); setSelectedIds(s); }}
                    onApprove={() => approveMut.mutate(p.id)}
                    onReject={() => rejectMut.mutate(p.id)}
                    onPublish={() => publishMut.mutate(p.id)}
                    onUnpublish={() => unpublishMut.mutate(p.id)}
                    onRegen={() => regenMut.mutate(p.id)}
                    onEdit={() => { setSelectedProduct(p); setEditFields({ title: p.title, shortDescription: p.shortDescription, fullDescription: p.fullDescription, categoryName: p.categoryName, sku: p.sku, seoTitle: p.seoTitle, seoDescription: p.seoDescription, brand: p.brand, dimensions: p.dimensions, materials: p.materials }); setEditMode(true); }}
                    onView={() => setSelectedProduct(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PUBLISHED ── */}
        {activeTab === "published" && (
          <div>
            <h2 className="text-white font-semibold mb-4">Published Products ({stats?.live ?? 0} live)</h2>
            <PublishedGrid products={(products ?? []).filter(p => p.isLive)} onUnpublish={id => unpublishMut.mutate(id)} />
          </div>
        )}

        {/* ── CATEGORIES ── */}
        {activeTab === "categories" && (
          <div className="max-w-2xl">
            <h2 className="text-white font-semibold mb-4">Category Manager</h2>

            {/* Add category */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 mb-4">
              <h3 className="text-white/70 text-sm font-medium mb-3">Add Category</h3>
              <div className="flex gap-2 mb-2">
                <input value={newCatName} onChange={e => { setNewCatName(e.target.value); setNewCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,168,76,0.4)]" placeholder="Category name" data-testid="input-cat-name" />
                <input value={newCatSlug} onChange={e => setNewCatSlug(e.target.value)} className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white/60 text-sm outline-none focus:border-[rgba(201,168,76,0.4)]" placeholder="slug" data-testid="input-cat-slug" />
              </div>
              <button onClick={() => { if (!newCatName || !newCatSlug) return; createCatMut.mutate(); }} disabled={createCatMut.isPending} className="w-full bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.2)] border border-[rgba(201,168,76,0.2)] rounded-lg py-2 text-[hsl(43,78%,52%)] text-sm font-semibold transition-colors disabled:opacity-50" data-testid="btn-create-category">
                {createCatMut.isPending ? "Creating..." : "+ Create Category"}
              </button>
            </div>

            <div className="space-y-2">
              {(categories ?? []).map(cat => (
                <div key={cat.id} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 flex items-center gap-3" data-testid={`cat-row-${cat.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{cat.name}</p>
                    <p className="text-white/30 text-[10px]">/{cat.slug} {cat.parentId ? "· subcategory" : "· root"}</p>
                    {cat.introText && <p className="text-white/40 text-[10px] mt-1 truncate">{cat.introText}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${cat.isActive ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"}`}>{cat.isActive ? "active" : "inactive"}</span>
                    <button onClick={() => genCatSeoMut.mutate(cat.id)} disabled={genCatSeoMut.isPending} className="text-[10px] px-2 py-1 bg-[rgba(201,168,76,0.08)] hover:bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.15)] text-[hsl(43,78%,52%)] rounded-lg font-medium transition-colors" data-testid={`btn-gen-seo-${cat.id}`}>Gen SEO</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEO MANAGER ── */}
        {activeTab === "seo" && (
          <div>
            <h2 className="text-white font-semibold mb-4">SEO Manager</h2>
            <div className="space-y-2">
              {(products ?? []).filter(p => p.isLive || p.status === "ready").map(p => (
                <div key={p.id} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4" data-testid={`seo-row-${p.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{p.title}</p>
                      <p className="text-[hsl(43,78%,52%)] text-xs mt-0.5 truncate">{p.seoTitle || "No SEO title"}</p>
                      <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{p.seoDescription || "No SEO description"}</p>
                      {p.imageAltText && <p className="text-white/30 text-[10px] mt-1">Alt: {p.imageAltText}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${p.seoTitle && p.seoDescription ? "text-green-400 bg-green-400/10" : "text-amber-400 bg-amber-400/10"}`}>
                        {p.seoTitle && p.seoDescription ? "✓ SEO Set" : "Incomplete"}
                      </span>
                      <button onClick={() => regenMut.mutate(p.id)} className="text-[10px] px-2 py-1 text-white/40 hover:text-[hsl(43,78%,52%)] transition-colors" data-testid={`btn-regen-seo-${p.id}`}>Regen</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Product Detail / Edit Modal ── */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-end" onClick={() => { setSelectedProduct(null); setEditMode(false); }}>
          <div className="w-full max-w-xl h-full bg-[hsl(220,18%,11%)] border-l border-[rgba(255,255,255,0.08)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <h3 className="text-white font-semibold text-sm truncate flex-1">{selectedProduct.title}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditMode(!editMode)} className="text-[10px] px-2.5 py-1 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] text-[hsl(43,78%,52%)] rounded-lg font-semibold" data-testid="btn-toggle-edit">{editMode ? "View" : "Edit"}</button>
                <button onClick={() => { setSelectedProduct(null); setEditMode(false); }} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* AI scores */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Overall AI Score", value: selectedProduct.overallAiScore ?? 0, mul: 1 },
                  { label: "Market Appeal", value: (selectedProduct.marketAppealScore ?? 0) * 100 },
                  { label: "Commercial", value: (selectedProduct.commercialRelevanceScore ?? 0) * 100 },
                  { label: "Brand Fit", value: (selectedProduct.brandFitScore ?? 0) * 100 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2.5">
                    <p className="text-white/40 text-[9px] uppercase tracking-wider">{label}</p>
                    <p className="text-white font-bold text-lg">{Math.round(value)}</p>
                    <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded-full mt-1"><div className="h-full bg-[hsl(43,78%,52%)] rounded-full" style={{ width: `${Math.min(100, value)}%` }} /></div>
                  </div>
                ))}
              </div>

              {editMode ? (
                <div className="space-y-3">
                  {[
                    { label: "Title", key: "title", type: "text" },
                    { label: "SKU", key: "sku", type: "text" },
                    { label: "Category", key: "categoryName", type: "text" },
                    { label: "Brand", key: "brand", type: "text" },
                    { label: "Dimensions", key: "dimensions", type: "text" },
                    { label: "Materials", key: "materials", type: "text" },
                    { label: "SEO Title", key: "seoTitle", type: "text" },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
                      <input value={(editFields as any)[key] ?? ""} onChange={e => setEditFields(f => ({ ...f, [key]: e.target.value }))} className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,168,76,0.3)]" data-testid={`input-edit-${key}`} />
                    </div>
                  ))}
                  {[
                    { label: "Short Description", key: "shortDescription" },
                    { label: "SEO Description", key: "seoDescription" },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
                      <textarea value={(editFields as any)[key] ?? ""} onChange={e => setEditFields(f => ({ ...f, [key]: e.target.value }))} rows={3} className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,168,76,0.3)] resize-none" data-testid={`input-edit-${key}`} />
                    </div>
                  ))}
                  <button onClick={() => updateMut.mutate({ id: selectedProduct.id, data: editFields })} disabled={updateMut.isPending} className="w-full bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-lg py-2 text-[hsl(43,78%,52%)] text-sm font-semibold transition-colors disabled:opacity-50" data-testid="btn-save-product">
                    {updateMut.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <DetailField label="Short Description" value={selectedProduct.shortDescription} />
                  <DetailField label="Full Description" value={selectedProduct.fullDescription} multiline />
                  {selectedProduct.features && selectedProduct.features.length > 0 && (
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Features</p>
                      <ul className="space-y-0.5">{selectedProduct.features.map((f, i) => <li key={i} className="text-white/70 text-xs flex items-start gap-1.5"><span className="text-[hsl(43,78%,52%)] mt-0.5">•</span>{f}</li>)}</ul>
                    </div>
                  )}
                  {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">{selectedProduct.tags.map((t, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[rgba(255,255,255,0.05)] text-white/50 rounded">{t}</span>)}</div>
                    </div>
                  )}
                  <DetailField label="SEO Title" value={selectedProduct.seoTitle} />
                  <DetailField label="SEO Description" value={selectedProduct.seoDescription} />
                  {selectedProduct.reviewNotes && <DetailField label="AI Notes" value={selectedProduct.reviewNotes} />}
                </div>
              )}

              {/* Action buttons */}
              {!editMode && (
                <div className="flex flex-col gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  {!selectedProduct.isLive ? (
                    <button onClick={() => { publishMut.mutate(selectedProduct.id); setSelectedProduct(null); }} className="w-full flex items-center justify-center gap-2 bg-green-400/10 border border-green-400/20 rounded-lg py-2 text-green-400 text-sm font-semibold" data-testid="btn-modal-publish"><Globe className="w-4 h-4" /> Publish Live</button>
                  ) : (
                    <button onClick={() => { unpublishMut.mutate(selectedProduct.id); setSelectedProduct(null); }} className="w-full flex items-center justify-center gap-2 bg-red-400/5 border border-red-400/15 rounded-lg py-2 text-red-400/70 text-sm font-semibold" data-testid="btn-modal-unpublish">Unpublish</button>
                  )}
                  <button onClick={() => { regenMut.mutate(selectedProduct.id); setSelectedProduct(null); }} className="w-full flex items-center justify-center gap-2 bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.15)] rounded-lg py-2 text-[hsl(43,78%,52%)] text-sm font-semibold" data-testid="btn-modal-regen"><Zap className="w-4 h-4" /> Regenerate AI Content</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FileIconComponent({ type }: { type: string }) {
  if (type.includes("pdf")) return <BookOpen className="w-6 h-6 text-red-400" />;
  if (type.includes("csv") || type.includes("sheet")) return <BarChart3 className="w-6 h-6 text-green-400" />;
  return <Package className="w-6 h-6 text-white/30" />;
}

function UploadStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { done: "text-green-400 bg-green-400/10", error: "text-red-400 bg-red-400/10", processing: "text-blue-400 bg-blue-400/10", pending: "text-white/40 bg-white/5" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[status] ?? "text-white/30"}`}>{status}</span>;
}

function AiStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { done: "text-emerald-400 bg-emerald-400/10", error: "text-red-400 bg-red-400/10", running: "text-blue-400 bg-blue-400/10 animate-pulse", pending: "text-white/30 bg-white/5" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[status] ?? "text-white/30"}`}>AI: {status}</span>;
}

function DetailField({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      {multiline ? <p className="text-white/70 text-xs leading-relaxed">{value}</p> : <p className="text-white/70 text-sm">{value}</p>}
    </div>
  );
}

function ProductRow({ product: p, isSelected, onSelect, onApprove, onReject, onPublish, onUnpublish, onRegen, onEdit, onView }: {
  product: Product; isSelected: boolean;
  onSelect: () => void; onApprove: () => void; onReject: () => void;
  onPublish: () => void; onUnpublish: () => void; onRegen: () => void;
  onEdit: () => void; onView: () => void;
}) {
  const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.new;
  const rc = p.publishReadiness ? READINESS_CONFIG[p.publishReadiness] : null;
  return (
    <div className={`bg-[hsl(220,18%,10%)] border rounded-xl px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? "border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.04)]" : "border-[rgba(255,255,255,0.06)]"}`} data-testid={`product-row-${p.id}`}>
      <input type="checkbox" checked={isSelected} onChange={onSelect} className="w-3.5 h-3.5 accent-[hsl(43,78%,52%)]" />
      {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="w-10 h-10 object-cover rounded-lg bg-[rgba(255,255,255,0.05)]" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{p.title}</p>
          {p.sku && <span className="text-[9px] text-white/30 font-mono">{p.sku}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {p.categoryName && <span className="text-white/40 text-[10px]">{p.categoryName}</span>}
          {p.style && <span className="text-white/30 text-[10px]">· {p.style}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {/* AI score pill */}
        {p.overallAiScore != null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.overallAiScore >= 70 ? "text-green-400 bg-green-400/10" : p.overallAiScore >= 50 ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10"}`}>
            {Math.round(p.overallAiScore)}
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sc.color} ${sc.bg}`}>{sc.label}</span>
      </div>
      <div className="flex items-center gap-1">
        <ActionBtn onClick={onView} title="View" icon={<Eye className="w-3 h-3" />} />
        <ActionBtn onClick={onEdit} title="Edit" icon={<Edit3 className="w-3 h-3" />} />
        {!p.isLive && p.status !== "published" && <ActionBtn onClick={onApprove} title="Approve" icon={<CheckCircle className="w-3 h-3" />} green />}
        {!p.isLive && (p.status === "ready" || p.publishReadiness === "ready" || p.publishReadiness === "publish") && <ActionBtn onClick={onPublish} title="Publish" icon={<Globe className="w-3 h-3" />} green />}
        {p.isLive && <ActionBtn onClick={onUnpublish} title="Unpublish" icon={<X className="w-3 h-3" />} red />}
        <ActionBtn onClick={onRegen} title="Regen AI" icon={<Zap className="w-3 h-3" />} gold />
      </div>
    </div>
  );
}

function ActionBtn({ onClick, title, icon, green, red, gold }: { onClick: () => void; title: string; icon: React.ReactNode; green?: boolean; red?: boolean; gold?: boolean }) {
  const cls = green ? "text-green-400 hover:bg-green-400/10" : red ? "text-red-400 hover:bg-red-400/10" : gold ? "text-[hsl(43,78%,52%)] hover:bg-[rgba(201,168,76,0.1)]" : "text-white/30 hover:text-white/60 hover:bg-[rgba(255,255,255,0.06)]";
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded-lg transition-colors ${cls}`} data-testid={`action-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      {icon}
    </button>
  );
}

function PublishedGrid({ products, onUnpublish }: { products: Product[]; onUnpublish: (id: string) => void }) {
  if (products.length === 0) return (
    <div className="text-center py-16 text-white/30">
      <Globe className="w-8 h-8 mx-auto mb-2" />
      <p>No published products yet</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {products.map(p => (
        <div key={p.id} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden group" data-testid={`published-card-${p.id}`}>
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.title} className="w-full h-40 object-cover" />
          ) : (
            <div className="w-full h-40 bg-[rgba(255,255,255,0.03)] flex items-center justify-center"><Package className="w-8 h-8 text-white/10" /></div>
          )}
          <div className="p-3">
            <p className="text-white text-xs font-medium truncate">{p.title}</p>
            <p className="text-white/30 text-[10px] truncate">{p.categoryName}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[9px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded font-bold">LIVE</span>
              <button onClick={() => onUnpublish(p.id)} className="text-[9px] text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" data-testid={`btn-unpublish-${p.id}`}>Unpublish</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
