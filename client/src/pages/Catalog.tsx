import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import type { CatalogProduct } from "@shared/schema";

// ─── Category display config ─────────────────────────────────────────────────
const CATEGORY_ORDER: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "executive-desks", label: "Executive Desks" },
  { key: "manager-desks", label: "Manager Desks" },
  { key: "workstations", label: "Workstations" },
  { key: "boardroom-tables", label: "Boardroom Tables" },
  { key: "reception-desks", label: "Reception Desks" },
  { key: "office-seating", label: "Office Seating" },
  { key: "storage-cabinets", label: "Storage & Cabinets" },
  { key: "office-pods", label: "Office Pods" },
];

const CATEGORY_LABELS: Record<string, string> = {
  "executive-desks": "Executive Desks",
  "manager-desks": "Manager Desks",
  "workstations": "Workstations",
  "boardroom-tables": "Boardroom Tables",
  "reception-desks": "Reception Desks",
  "office-seating": "Office Seating",
  "storage-cabinets": "Storage & Cabinets",
  "office-pods": "Office Pods",
  "uncategorised": "Uncategorised",
};

function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: CatalogProduct }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <article
      data-testid={`card-product-${product.sku}`}
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] hover:border-[#b8974a]/40 transition-colors duration-200"
    >
      <div className="aspect-[4/5] bg-black flex items-center justify-center p-6">
        {!imgErr ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? `${product.name} — ${product.sku}`}
            className="h-full w-full object-contain"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs text-center px-4">
            {product.sku}
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#b8974a]/80 font-medium">
          {getCategoryLabel(product.category)}
        </div>
        <div className="text-xs text-white/40 font-mono">{product.sku}</div>
        <h3 className="text-sm leading-snug text-white font-medium">{product.name}</h3>
        {(product as any).series ? (
          <div className="inline-flex rounded-full border border-[#b8974a]/25 px-2.5 py-0.5 text-[10px] text-[#b8974a]/80 tracking-wide">
            {(product as any).series}
          </div>
        ) : null}
      </div>
    </article>
  );
}

// ─── Category Filter Pill ─────────────────────────────────────────────────────
function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`filter-category-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors duration-150 ${
        active
          ? "border-[#b8974a] bg-[#b8974a]/10 text-[#b8974a]"
          : "border-white/10 bg-white/5 text-white/60 hover:text-white/80 hover:border-white/20"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Group products by category preserving order ──────────────────────────────
function groupByCategory(
  products: CatalogProduct[]
): Array<{ key: string; label: string; items: CatalogProduct[] }> {
  const order = CATEGORY_ORDER.filter(c => c.key !== "all").map(c => c.key);
  const map = new Map<string, CatalogProduct[]>();

  for (const p of products) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }

  const result: Array<{ key: string; label: string; items: CatalogProduct[] }> = [];
  for (const key of order) {
    if (map.has(key)) {
      result.push({ key, label: getCategoryLabel(key), items: map.get(key)! });
    }
  }
  // Any categories not in our ordered list
  for (const [key, items] of map) {
    if (!order.includes(key)) {
      result.push({ key, label: getCategoryLabel(key), items });
    }
  }
  return result;
}

// ─── Main Catalog Page ────────────────────────────────────────────────────────
export default function Catalog() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSeries, setActiveSeries] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Fetch all active products once
  const { data, isLoading } = useQuery<{ products: CatalogProduct[]; total: number }>({
    queryKey: ["/api/catalog/products"],
    queryFn: async () => {
      const res = await fetch("/api/catalog/products?limit=500");
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch series options
  const { data: seriesOptions = [] } = useQuery<string[]>({
    queryKey: ["/api/catalog/series"],
    staleTime: 5 * 60 * 1000,
  });

  const allProducts = data?.products ?? [];

  // Client-side filtering for instant response
  const filtered = useMemo(() => {
    let products = allProducts;
    if (activeCategory !== "all") {
      products = products.filter(p => p.category === activeCategory);
    }
    if (activeSeries !== "all") {
      products = products.filter(p => (p as any).series === activeSeries);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      products = products.filter(p => {
        const st = (p as any).searchableText ?? "";
        return (
          st.includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
        );
      });
    }
    return products;
  }, [allProducts, activeCategory, activeSeries, search]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  // Active category count for tab badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allProducts.length };
    for (const p of allProducts) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [allProducts]);

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    setActiveSeries("all");
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#080808] text-white">
        {/* ── Page Header ── */}
        <div className="border-b border-white/5 bg-[#080808]">
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#b8974a]/70 mb-3">
              The Corporate Desk
            </p>
            <h1 className="text-3xl md:text-4xl font-light tracking-wide text-white mb-2">
              Product Catalog
            </h1>
            <p className="text-white/40 text-sm">
              {allProducts.length > 0
                ? `${allProducts.length} products across ${Object.keys(categoryCounts).length - 1} categories`
                : "Premium commercial furniture for the modern workplace"}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
          {/* ── Search ── */}
          <div className="mb-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              data-testid="input-catalog-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by SKU, product name, or category…"
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

          {/* ── Category Tabs ── */}
          <div
            data-testid="filter-category-tabs"
            className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none"
          >
            {CATEGORY_ORDER.map(item => (
              <FilterPill
                key={item.key}
                label={item.label}
                active={activeCategory === item.key}
                onClick={() => handleCategoryChange(item.key)}
              />
            ))}
          </div>

          {/* ── Series Filter ── */}
          {seriesOptions.length > 0 && (
            <div
              data-testid="filter-series-tabs"
              className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-none"
            >
              <FilterPill
                label="All Series"
                active={activeSeries === "all"}
                onClick={() => setActiveSeries("all")}
              />
              {seriesOptions.map(s => (
                <FilterPill
                  key={s}
                  label={s}
                  active={activeSeries === s}
                  onClick={() => setActiveSeries(s)}
                />
              ))}
            </div>
          )}

          {/* ── Loading State ── */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/5 bg-white/5 animate-pulse aspect-[4/5]"
                />
              ))}
            </div>
          )}

          {/* ── Empty State ── */}
          {!isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-white/40 text-sm">No products found for this filter.</p>
              <button
                onClick={() => {
                  setActiveCategory("all");
                  setActiveSeries("all");
                  setSearch("");
                }}
                className="mt-4 text-[#b8974a] text-sm underline underline-offset-2"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* ── Products ── */}
          {!isLoading && filtered.length > 0 && (
            <>
              {activeCategory === "all" ? (
                /* Grouped view when "All" is selected */
                grouped.map(group => (
                  <section key={group.key} className="mb-12" data-testid={`section-${group.key}`}>
                    <div className="flex items-baseline gap-3 mb-5">
                      <h2 className="text-xl font-light tracking-wide text-white">
                        {group.label}
                      </h2>
                      <span className="text-sm text-white/30">{group.items.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {group.items.map(product => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                /* Single category view */
                <section data-testid={`section-${activeCategory}`}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {filtered.map(product => (
                      <ProductCard key={product.id} product={product} />
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
