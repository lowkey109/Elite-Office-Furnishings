import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Tag } from "lucide-react";
import { Layout } from "@/components/Layout";

// ─── Supplier product type (from /api/products) ────────────────────────────
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

// ─── Product Card ──────────────────────────────────────────────────────────
function ProductCard({ product }: { product: SupplierProduct }) {
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = product.imageUrl || product.image || "";
  const name = product.name || product.product_name || "";

  return (
    <article
      data-testid={`card-product-${product.sku}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] hover:border-[#b8974a]/40 transition-all duration-200 flex flex-col"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
        {!imgErr && imgSrc ? (
          <img
            src={imgSrc}
            alt={product.imageAlt ?? `${name} — ${product.sku}`}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/15 text-xs text-center px-4 font-mono">
            {product.sku}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#b8974a]/80 font-medium truncate mb-0.5">
              {product.category}
            </div>
            <div className="text-[10px] text-white/30 font-mono">{product.sku}</div>
          </div>
          {product.series && (
            <span className="shrink-0 text-[9px] border border-[#b8974a]/25 rounded-full px-2 py-0.5 text-[#b8974a]/70 tracking-wide whitespace-nowrap">
              {product.series}
            </span>
          )}
        </div>

        <h3 className="text-sm leading-snug text-white font-medium line-clamp-2">{name}</h3>

        {product.dimensions && (
          <p className="text-[10px] text-white/35 leading-relaxed line-clamp-1">
            {product.dimensions}
          </p>
        )}

        {product.description && (
          <p className="text-[10px] text-white/45 leading-relaxed line-clamp-2 flex-1">
            {product.description.split('.').slice(0, 2).join('.') + '.'}
          </p>
        )}

        {/* Price */}
        <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between">
          {product.price_label ? (
            <span className="flex items-center gap-1 text-[#b8974a] text-xs font-semibold">
              <Tag className="w-3 h-3" />
              {product.price_label}
            </span>
          ) : (
            <span className="text-white/30 text-[10px]">Request Quote</span>
          )}
          {product.colors && product.colors.length > 0 && (
            <span className="text-[9px] text-white/30 truncate ml-2">
              {product.colors.slice(0,2).join(' · ')}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

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
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors duration-150 ${
        active
          ? "border-[#b8974a] bg-[#b8974a]/10 text-[#b8974a]"
          : "border-white/10 bg-white/5 text-white/60 hover:text-white/80 hover:border-white/20"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 text-[10px] ${active ? "text-[#b8974a]/70" : "text-white/30"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Main Catalog ──────────────────────────────────────────────────────────
export default function Catalog() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeSeries, setActiveSeries] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: rawProducts = [], isLoading } = useQuery<SupplierProduct[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Derive series options from the active category
  const seriesOptions = useMemo(() => {
    const src = activeCategory === "All" ? rawProducts : rawProducts.filter(p => p.category === activeCategory);
    const s = [...new Set(src.map(p => p.series).filter(Boolean) as string[])].sort();
    return s;
  }, [rawProducts, activeCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: rawProducts.length };
    rawProducts.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [rawProducts]);

  // Filtered products
  const filtered = useMemo(() => {
    let products = rawProducts;
    if (activeCategory !== "All") {
      products = products.filter(p => p.category === activeCategory);
    }
    if (activeSeries !== "all") {
      products = products.filter(p => p.series === activeSeries);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      products = products.filter(p => {
        const n = (p.name || p.product_name || "").toLowerCase();
        return (
          n.includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.series || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.materials || "").toLowerCase().includes(q) ||
          (p.supplier || "").toLowerCase().includes(q)
        );
      });
    }
    return products;
  }, [rawProducts, activeCategory, activeSeries, search]);

  // Group by category for "All" view
  const grouped = useMemo(() => {
    if (activeCategory !== "All") return [];
    const map = new Map<string, SupplierProduct[]>();
    filtered.forEach(p => {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    });
    const ordered: Array<{ cat: string; items: SupplierProduct[] }> = [];
    const orderedCats = CATEGORY_ORDER.filter(c => c !== "All");
    orderedCats.forEach(cat => {
      if (map.has(cat)) ordered.push({ cat, items: map.get(cat)! });
    });
    map.forEach((items, cat) => {
      if (!orderedCats.includes(cat)) ordered.push({ cat, items });
    });
    return ordered;
  }, [filtered, activeCategory]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setActiveSeries("all");
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#080808] text-white">
        {/* Header */}
        <div className="border-b border-white/5 bg-[#080808]">
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#b8974a]/70 mb-3">
              The Corporate Desk
            </p>
            <h1 className="text-3xl md:text-4xl font-light tracking-wide text-white mb-2">
              Product Catalogue
            </h1>
            <p className="text-white/40 text-sm">
              {rawProducts.length > 0
                ? `${rawProducts.length} products · Feisenzhuo, Gojo, HuaSheng & Aysa collections`
                : "Premium commercial furniture for the modern Australian workplace"}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
          {/* Search */}
          <div className="mb-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              data-testid="input-catalog-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, SKU, series, or material…"
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-10 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#b8974a]/40 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                data-testid="button-clear-search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div data-testid="filter-category-tabs" className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
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
            <div data-testid="filter-series-tabs" className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <FilterPill label="All Series" active={activeSeries === "all"} onClick={() => setActiveSeries("all")} />
              {seriesOptions.map(s => (
                <FilterPill key={s} label={s} active={activeSeries === s} onClick={() => setActiveSeries(s)} />
              ))}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-white/5 animate-pulse aspect-[4/3]" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-white/40 text-sm">No products found for this filter.</p>
              <button
                onClick={() => { setActiveCategory("All"); setActiveSeries("all"); setSearch(""); }}
                className="mt-4 text-[#b8974a] text-sm underline underline-offset-2"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Products */}
          {!isLoading && filtered.length > 0 && (
            <>
              {activeCategory === "All" ? (
                grouped.map(({ cat, items }) => (
                  <section key={cat} className="mb-12" data-testid={`section-${cat.toLowerCase().replace(/\s+/g,"-").replace(/[&]/g,"and")}`}>
                    <div className="flex items-baseline gap-3 mb-5">
                      <h2 className="text-xl font-light tracking-wide text-white">{cat}</h2>
                      <span className="text-sm text-white/30">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {items.map(product => (
                        <ProductCard key={product.sku} product={product} />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <section data-testid={`section-${activeCategory.toLowerCase().replace(/\s+/g,"-").replace(/[&]/g,"and")}`}>
                  <div className="mb-5 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-xl font-light tracking-wide text-white">{activeCategory}</h2>
                      <span className="text-sm text-white/30">{filtered.length} products</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {filtered.map(product => (
                      <ProductCard key={product.sku} product={product} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
