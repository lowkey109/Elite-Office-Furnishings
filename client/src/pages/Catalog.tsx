import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, X, Tag, ArrowRight, ChevronRight } from "lucide-react";
import { Layout } from "@/components/Layout";

// ─── Types ─────────────────────────────────────────────────────────────────
interface SupplierProduct {
  sku: string;
  name: string;
  product_name?: string;
  category: string;
  series: string | null;
  supplier?: string;
  dimensions?: string;
  materials?: string;
  colors?: string[];
  imageUrl: string;
  imageAlt?: string;
  image?: string;
  price_aud?: number | null;
  price_label?: string | null;
  description?: string;
}

// ─── Category config ───────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  "All",
  "Executive Desks",
  "Manager Desks",
  "Workstations",
  "Boardroom Tables",
  "Reception Desks",
  "Office Seating",
  "Lounge Seating",
  "Storage",
  "Storage & Filing",
  "Occasional Tables",
  "Office Pods",
];

const ALL_VIEW_PREVIEW = 8;   // items shown per section in All view
const PAGE_SIZE_INITIAL = 24; // initial page size in category view
const PAGE_SIZE_MORE = 12;    // load-more batch

// ─── Product Card ──────────────────────────────────────────────────────────
const ProductCard = ({ product }: { product: SupplierProduct }) => {
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = product.imageUrl || product.image || "";
  const name = product.name || product.product_name || "";
  const slug = product.sku;

  return (
    <Link
      href={`/catalog/product/${slug}`}
      data-testid={`card-product-${product.sku}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] hover:border-[#b8974a]/50 transition-all duration-200 flex flex-col cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b8974a]"
    >
      {/* Image */}
      <div className="relative bg-[#111] overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {!imgErr && imgSrc ? (
          <img
            src={imgSrc}
            alt={product.imageAlt ?? `${name} — ${product.sku}`}
            className="absolute inset-0 h-full w-full object-contain p-3 group-hover:scale-[1.04] transition-transform duration-300"
            loading="lazy"
            decoding="async"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/15 text-[10px] text-center px-4 font-mono">
            {product.sku}
          </div>
        )}
        {/* Tap indicator overlay */}
        <div className="absolute inset-0 bg-[#b8974a]/0 group-hover:bg-[#b8974a]/5 transition-colors duration-200 pointer-events-none" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#b8974a]/75 font-medium truncate mb-0.5">
              {product.category}
            </div>
            <div className="text-[9px] text-white/25 font-mono">{product.sku}</div>
          </div>
          {product.series && (
            <span className="shrink-0 text-[8px] border border-[#b8974a]/20 rounded-full px-1.5 py-0.5 text-[#b8974a]/60 tracking-wide whitespace-nowrap">
              {product.series}
            </span>
          )}
        </div>

        <h3 className="text-xs leading-snug text-white font-medium line-clamp-2">{name}</h3>

        {product.dimensions && (
          <p className="text-[9px] text-white/30 leading-relaxed line-clamp-1">
            {product.dimensions}
          </p>
        )}

        {/* Price row */}
        <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between">
          {product.price_label ? (
            <span className="flex items-center gap-1 text-[#b8974a] text-[11px] font-semibold">
              <Tag className="w-2.5 h-2.5" />
              {product.price_label}
            </span>
          ) : (
            <span className="text-white/30 text-[9px]">Request Quote</span>
          )}
          <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-[#b8974a]/60 transition-colors shrink-0" />
        </div>
      </div>
    </Link>
  );
};

// ─── Filter Pill ───────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick, count }: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`filter-category-${label.toLowerCase().replace(/\s+/g, "-").replace(/[&]/g, "and")}`}
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-[11px] transition-colors duration-150 ${
        active
          ? "border-[#b8974a] bg-[#b8974a]/10 text-[#b8974a]"
          : "border-white/10 bg-white/5 text-white/55 hover:text-white/75 hover:border-white/20"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 text-[9px] ${active ? "text-[#b8974a]/70" : "text-white/25"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Skeleton Card ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-white/5" />
      <div className="p-3 space-y-2">
        <div className="h-2 bg-white/5 rounded w-2/3" />
        <div className="h-3 bg-white/5 rounded w-full" />
        <div className="h-2 bg-white/5 rounded w-1/2" />
      </div>
    </div>
  );
}

// ─── Main Catalog ──────────────────────────────────────────────────────────
export default function Catalog() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeSeries, setActiveSeries] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_INITIAL);

  const { data: rawProducts = [], isLoading } = useQuery<SupplierProduct[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const seriesOptions = useMemo(() => {
    const src = activeCategory === "All" ? rawProducts : rawProducts.filter(p => p.category === activeCategory);
    return [...new Set(src.map(p => p.series).filter(Boolean) as string[])].sort();
  }, [rawProducts, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: rawProducts.length };
    rawProducts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }, [rawProducts]);

  const filtered = useMemo(() => {
    let products = rawProducts;
    if (activeCategory !== "All") products = products.filter(p => p.category === activeCategory);
    if (activeSeries !== "all") products = products.filter(p => p.series === activeSeries);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      products = products.filter(p => {
        const n = (p.name || p.product_name || "").toLowerCase();
        return n.includes(q) || p.sku.toLowerCase().includes(q) ||
          (p.series || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q) ||
          (p.materials || "").toLowerCase().includes(q) || (p.supplier || "").toLowerCase().includes(q);
      });
    }
    return products;
  }, [rawProducts, activeCategory, activeSeries, search]);

  // "All" view — groups with preview limit per section
  const grouped = useMemo(() => {
    if (activeCategory !== "All") return [];
    const map = new Map<string, SupplierProduct[]>();
    filtered.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    });
    const orderedCats = CATEGORY_ORDER.filter(c => c !== "All");
    const ordered: Array<{ cat: string; items: SupplierProduct[] }> = [];
    orderedCats.forEach(cat => { if (map.has(cat)) ordered.push({ cat, items: map.get(cat)! }); });
    map.forEach((items, cat) => { if (!orderedCats.includes(cat)) ordered.push({ cat, items }); });
    return ordered;
  }, [filtered, activeCategory]);

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
    setActiveSeries("all");
    setVisibleCount(PAGE_SIZE_INITIAL);
  }, []);

  const visibleFiltered = filtered.slice(0, visibleCount);
  const hasMore = activeCategory !== "All" && visibleCount < filtered.length;

  return (
    <Layout>
      <div className="min-h-screen bg-[#080808] text-white">
        {/* Header */}
        <div className="border-b border-white/5 bg-[#080808]">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
            <p className="text-[9px] uppercase tracking-[0.3em] text-[#b8974a]/70 mb-2">
              The Corporate Desk
            </p>
            <h1 className="text-2xl md:text-4xl font-light tracking-wide text-white mb-1.5">
              Product Catalogue
            </h1>
            <p className="text-white/35 text-xs md:text-sm">
              {rawProducts.length > 0
                ? `${rawProducts.length} products · Feisenzhuo, Gojo, HuaSheng & Aysa collections`
                : "Premium commercial furniture for the modern Australian workplace"}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-5 md:px-8">
          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              data-testid="input-catalog-search"
              value={search}
              onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE_INITIAL); }}
              placeholder="Search by name, SKU, series…"
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-9 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#b8974a]/40 transition-colors"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setVisibleCount(PAGE_SIZE_INITIAL); }}
                data-testid="button-clear-search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div data-testid="filter-category-tabs" className="mb-2 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORY_ORDER.map(cat => (
              <FilterPill
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onClick={() => handleCategoryChange(cat)}
                count={cat === "All" ? undefined : categoryCounts[cat]}
              />
            ))}
          </div>

          {/* Series Filter */}
          {seriesOptions.length > 1 && (
            <div data-testid="filter-series-tabs" className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <FilterPill label="All Series" active={activeSeries === "all"} onClick={() => setActiveSeries("all")} />
              {seriesOptions.map(s => (
                <FilterPill key={s} label={s} active={activeSeries === s} onClick={() => setActiveSeries(s)} />
              ))}
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-white/40 text-sm">No products match your search.</p>
              <button
                onClick={() => { setActiveCategory("All"); setActiveSeries("all"); setSearch(""); setVisibleCount(PAGE_SIZE_INITIAL); }}
                className="mt-4 text-[#b8974a] text-sm underline underline-offset-2"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* ── All view: category sections with preview limit ─────────────── */}
          {!isLoading && activeCategory === "All" && !search.trim() && filtered.length > 0 && (
            grouped.map(({ cat, items }) => {
              const preview = items.slice(0, ALL_VIEW_PREVIEW);
              const remaining = items.length - ALL_VIEW_PREVIEW;
              return (
                <section
                  key={cat}
                  className="mb-10"
                  data-testid={`section-${cat.toLowerCase().replace(/\s+/g, "-").replace(/[&]/g, "and")}`}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-4">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-lg md:text-xl font-light tracking-wide text-white">{cat}</h2>
                      <span className="text-xs text-white/25">{items.length}</span>
                    </div>
                    {remaining > 0 && (
                      <button
                        onClick={() => handleCategoryChange(cat)}
                        className="flex items-center gap-1 text-[#b8974a] text-xs hover:underline underline-offset-2 shrink-0"
                      >
                        View all {items.length} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {preview.map(product => (
                      <ProductCard key={product.sku} product={product} />
                    ))}
                  </div>
                  {remaining > 0 && (
                    <button
                      onClick={() => handleCategoryChange(cat)}
                      className="mt-4 w-full rounded-xl border border-white/8 bg-white/3 py-3 text-xs text-white/40 hover:text-white/60 hover:border-white/15 transition-colors"
                    >
                      + {remaining} more {cat.toLowerCase()} — tap to view all
                    </button>
                  )}
                </section>
              );
            })
          )}

          {/* ── Category / search / series view: paginated grid ───────────── */}
          {!isLoading && activeCategory !== "All" && filtered.length > 0 && (
            <section data-testid={`section-${activeCategory.toLowerCase().replace(/\s+/g, "-").replace(/[&]/g, "and")}`}>
              <div className="mb-4 flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg md:text-xl font-light tracking-wide text-white">{activeCategory}</h2>
                  <span className="text-xs text-white/25">{filtered.length} products</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {visibleFiltered.map(product => (
                  <ProductCard key={product.sku} product={product} />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    data-testid="button-load-more"
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE_MORE)}
                    className="rounded-full border border-white/15 bg-white/5 px-8 py-3 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all duration-150"
                  >
                    Load more ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Search result pagination */}
          {!isLoading && search.trim() && activeCategory === "All" && filtered.length > 0 && (
            <section>
              <div className="mb-4">
                <p className="text-xs text-white/40">{filtered.length} results for "{search}"</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {filtered.slice(0, visibleCount).map(product => (
                  <ProductCard key={product.sku} product={product} />
                ))}
              </div>
              {visibleCount < filtered.length && (
                <div className="mt-8 text-center">
                  <button
                    data-testid="button-load-more-search"
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE_MORE)}
                    className="rounded-full border border-white/15 bg-white/5 px-8 py-3 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all"
                  >
                    Load more ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
