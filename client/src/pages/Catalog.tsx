import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Search, X, ArrowLeft, ChevronRight, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/Layout";
import type { CatalogProduct } from "@shared/schema";

// ─── Category display config ────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; description: string }> = {
  "office-furniture": {
    label: "Modern Office Furniture",
    description: "Contemporary commercial workstations, desks, and office systems for the modern workplace.",
  },
  "traditional-series": {
    label: "Traditional Executive Series",
    description: "Premium executive and boardroom furniture with timeless, authoritative design.",
  },
  "reception-seating": {
    label: "Reception & Seating",
    description: "Commercial reception desks, lounge seating, and collaborative seating solutions.",
  },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { label: cat.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()), description: "" };
}

// ─── Holding State ───────────────────────────────────────────────────────────
function CatalogHolding() {
  return (
    <Layout>
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-full border border-[#b8974a]/30 flex items-center justify-center mx-auto mb-8">
            <Package className="w-7 h-7 text-[#b8974a]/60" />
          </div>
          <h1 className="text-3xl font-light tracking-wide text-white mb-4">
            Catalog Updating
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed">
            We are currently updating our catalog with our latest commercial range.
            The full product collection will be available shortly.
          </p>
          <div className="mt-10 flex gap-3 justify-center">
            <div className="h-1 w-12 bg-[#b8974a]/60 rounded-full animate-pulse" />
            <div className="h-1 w-8 bg-[#b8974a]/30 rounded-full animate-pulse delay-150" />
            <div className="h-1 w-6 bg-[#b8974a]/20 rounded-full animate-pulse delay-300" />
          </div>
          <div className="mt-12 pt-8 border-t border-white/5">
            <p className="text-zinc-500 text-sm">
              For immediate enquiries, contact{" "}
              <a href="mailto:sales@thecorporatedesk.com.au" className="text-[#b8974a] hover:underline">
                sales@thecorporatedesk.com.au
              </a>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Product Card ────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: CatalogProduct;
  onClick: (p: CatalogProduct) => void;
}

function ProductCard({ product, onClick }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const meta = getCategoryMeta(product.category);

  return (
    <button
      data-testid={`card-product-${product.sku}`}
      onClick={() => onClick(product)}
      className="group text-left block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8974a]/50 rounded-lg"
    >
      <div className="bg-[#111111] border border-white/5 rounded-lg overflow-hidden transition-all duration-300 group-hover:border-[#b8974a]/25 group-hover:shadow-[0_8px_40px_rgba(0,0,0,0.6)] group-hover:-translate-y-0.5">
        {/* Image */}
        <div className="aspect-square overflow-hidden bg-[#0d0d0d] relative">
          {!imgError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-zinc-700" />
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <span className="text-xs text-white/80 font-medium tracking-wider uppercase">View Details →</span>
          </div>
        </div>
        {/* Info */}
        <div className="p-4 border-t border-white/5">
          <p className="text-[10px] text-[#b8974a]/70 tracking-widest uppercase font-medium mb-1">
            {meta.label}
          </p>
          <p className="text-xs font-mono text-zinc-400 mb-1">{product.sku}</p>
          <p className="text-sm text-zinc-200 font-light leading-tight line-clamp-2 group-hover:text-white transition-colors">
            {product.name.split(" — ")[1] ?? product.name}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Product Detail Modal ────────────────────────────────────────────────────
interface ProductModalProps {
  product: CatalogProduct;
  onClose: () => void;
}

function ProductModal({ product, onClose }: ProductModalProps) {
  const [imgError, setImgError] = useState(false);
  const meta = getCategoryMeta(product.category);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative bg-[#111111] border border-white/10 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
        data-testid="modal-product-detail"
      >
        {/* Close */}
        <button
          onClick={onClose}
          data-testid="button-modal-close"
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image */}
        <div className="md:w-1/2 bg-[#0d0d0d] flex items-center justify-center aspect-square md:aspect-auto min-h-[280px]">
          {!imgError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-8"
              onError={() => setImgError(true)}
            />
          ) : (
            <Package className="w-16 h-16 text-zinc-700" />
          )}
        </div>

        {/* Info */}
        <div className="md:w-1/2 p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            <p className="text-[10px] text-[#b8974a] tracking-widest uppercase font-medium mb-4">
              {meta.label}
            </p>
            <h2 className="text-xl font-light text-white mb-2 leading-snug">
              {product.name.split(" — ")[1] ?? product.name}
            </h2>
            <p className="font-mono text-sm text-zinc-400 mb-6">SKU: {product.sku}</p>

            <div className="space-y-3 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#b8974a]/50 flex-shrink-0" />
                Commercial grade construction
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#b8974a]/50 flex-shrink-0" />
                Australian commercial standards
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#b8974a]/50 flex-shrink-0" />
                Dimensions available on enquiry
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <a
              href="/start"
              data-testid="link-enquire-product"
              className="block w-full text-center py-3 px-6 bg-[#b8974a] hover:bg-[#c9a854] text-black font-medium text-sm rounded transition-colors"
            >
              Enquire About This Product
            </a>
            <button
              onClick={onClose}
              className="block w-full text-center py-3 px-6 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white text-sm rounded transition-colors"
            >
              Back to Catalog
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Catalog Page ───────────────────────────────────────────────────────
export default function Catalog() {
  const [, params] = useRoute("/catalog/:category");
  const [, navigate] = useLocation();
  const categoryParam = params?.category ?? null;

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(categoryParam);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  // Sync URL category param
  useEffect(() => {
    setActiveCategory(categoryParam);
  }, [categoryParam]);

  // Config query (catalogReady flag)
  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ["/api/catalog/config"],
  });

  // Categories
  const { data: categories = [] } = useQuery<{ category: string; count: number }[]>({
    queryKey: ["/api/catalog/categories"],
    enabled: config?.catalogReady === "true",
  });

  // Products
  const { data: productsData, isLoading } = useQuery<{ products: CatalogProduct[]; total: number }>({
    queryKey: ["/api/catalog/products", activeCategory, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeCategory) params.set("category", activeCategory);
      if (search) params.set("search", search);
      params.set("limit", "500");
      const res = await fetch(`/api/catalog/products?${params}`);
      return res.json();
    },
    enabled: config?.catalogReady === "true",
  });

  const handleCategoryClick = useCallback((cat: string | null) => {
    setActiveCategory(cat);
    setSearch("");
    if (cat) navigate(`/catalog/${cat}`);
    else navigate("/catalog");
  }, [navigate]);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (val) setActiveCategory(null);
  }, []);

  // Holding state
  if (config && config.catalogReady !== "true") return <CatalogHolding />;

  const products = productsData?.products ?? [];
  const total = productsData?.total ?? 0;
  const activeMeta = activeCategory ? getCategoryMeta(activeCategory) : null;

  return (
    <Layout>
      <div className="min-h-screen bg-[#0a0a0a]">

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-12 px-6 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            {activeCategory && (
              <button
                onClick={() => handleCategoryClick(null)}
                data-testid="button-catalog-back"
                className="flex items-center gap-2 text-zinc-500 hover:text-[#b8974a] text-sm mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                All Categories
              </button>
            )}

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="text-[#b8974a] text-xs tracking-widest uppercase font-medium mb-3">
                  The Corporate Desk
                </p>
                <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight">
                  {activeMeta ? activeMeta.label : "Product Catalog"}
                </h1>
                {activeMeta?.description && (
                  <p className="text-zinc-400 mt-3 text-base max-w-xl leading-relaxed">
                    {activeMeta.description}
                  </p>
                )}
                {!activeCategory && (
                  <p className="text-zinc-400 mt-3 text-base max-w-xl leading-relaxed">
                    Commercial-grade office furniture for enterprise workplaces, executive suites, and commercial fitouts across Australia.
                  </p>
                )}
              </div>
              <div className="text-right hidden md:block">
                <p className="text-3xl font-light text-white">{total}</p>
                <p className="text-zinc-500 text-sm mt-1">Products</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Filter Bar ─────────────────────────────────────────────────── */}
        <section className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/5 py-4 px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Categories */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                data-testid="filter-all-categories"
                onClick={() => handleCategoryClick(null)}
                className={`px-4 py-1.5 text-xs rounded-full border transition-all font-medium tracking-wide ${
                  !activeCategory && !search
                    ? "bg-[#b8974a] border-[#b8974a] text-black"
                    : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                }`}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.category}
                  data-testid={`filter-category-${c.category}`}
                  onClick={() => handleCategoryClick(c.category)}
                  className={`px-4 py-1.5 text-xs rounded-full border transition-all font-medium tracking-wide ${
                    activeCategory === c.category
                      ? "bg-[#b8974a] border-[#b8974a] text-black"
                      : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {getCategoryMeta(c.category).label}
                  <span className="ml-1.5 opacity-60">({c.count})</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                data-testid="input-catalog-search"
                placeholder="Search by SKU or name..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm bg-[#111] border-white/10 text-zinc-300 placeholder:text-zinc-600 focus:border-[#b8974a]/40"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Product Grid ────────────────────────────────────────────────── */}
        <section className="px-6 py-12">
          <div className="max-w-7xl mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="bg-[#111] border border-white/5 rounded-lg overflow-hidden animate-pulse">
                    <div className="aspect-square bg-[#1a1a1a]" />
                    <div className="p-4 space-y-2">
                      <div className="h-2 bg-[#1a1a1a] rounded w-1/2" />
                      <div className="h-3 bg-[#1a1a1a] rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-zinc-500 text-sm">No products found</p>
                {search && (
                  <button onClick={() => setSearch("")} className="mt-3 text-[#b8974a] text-sm hover:underline">
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Category section headers when showing all */}
                {!activeCategory && !search ? (
                  categories.map(cat => {
                    const catProducts = products.filter(p => p.category === cat.category);
                    if (!catProducts.length) return null;
                    const meta = getCategoryMeta(cat.category);
                    return (
                      <div key={cat.category} className="mb-16">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h2 className="text-xl font-light text-white">{meta.label}</h2>
                            <p className="text-zinc-500 text-sm mt-1">{cat.count} products</p>
                          </div>
                          <button
                            data-testid={`link-view-all-${cat.category}`}
                            onClick={() => handleCategoryClick(cat.category)}
                            className="flex items-center gap-1 text-[#b8974a] text-sm hover:underline"
                          >
                            View all <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                          {catProducts.slice(0, 10).map(p => (
                            <ProductCard key={p.sku} product={p} onClick={setSelectedProduct} />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {products.map(p => (
                      <ProductCard key={p.sku} product={p} onClick={setSelectedProduct} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Footer CTA ──────────────────────────────────────────────────── */}
        <section className="border-t border-white/5 py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl font-light text-white mb-3">Need a Custom Configuration?</h3>
            <p className="text-zinc-400 text-base mb-8 leading-relaxed max-w-xl mx-auto">
              Our commercial team works with you on workspace planning, volume pricing, and end-to-end project delivery.
            </p>
            <a
              href="/start"
              data-testid="link-catalog-enquire"
              className="inline-block px-8 py-3.5 bg-[#b8974a] hover:bg-[#c9a854] text-black font-medium text-sm tracking-wide rounded transition-colors"
            >
              Start a Project Enquiry
            </a>
          </div>
        </section>
      </div>

      {/* ── Product Modal ────────────────────────────────────────────────── */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </Layout>
  );
}
