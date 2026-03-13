import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/Layout";
import { ArrowRight, Search, X, ChevronRight, Layers } from "lucide-react";
import { getSeriesDisplayName } from "@/lib/seriesDisplayNames";

interface CuratedProduct {
  sku: string;
  product_name: string;
  display_name: string;
  category: string;
  series: string;
  series_marketing_name: string;
  series_tagline: string;
  supplier: string;
  collection_name: string;
  materials: string;
  colors: string[];
  image: string;
  gallery: string[];
  has_variants: boolean;
  variant_count: number;
  sizes_available: string[];
  colours_available: string[];
  configurations_available: string[];
  short_description: string;
  price_from: string;
  price_from_num: number | null;
  featured: boolean;
}

const CATEGORIES = [
  "All",
  "Executive Desks",
  "Manager Desks",
  "Workstations",
  "Boardroom Tables",
  "Reception Desks",
  "Office Seating",
  "Storage",
  "Lounge Seating",
  "Occasional Tables",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Executive Desks":  "◈",
  "Manager Desks":    "◧",
  "Workstations":     "⊞",
  "Boardroom Tables": "⊟",
  "Reception Desks":  "⊙",
  "Office Seating":   "◉",
  "Storage":          "▣",
  "Lounge Seating":   "◎",
  "Occasional Tables":"◫",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Executive Desks":  "Command stations for leaders — L-desks, suite packages and CEO-scale configurations",
  "Manager Desks":    "Professional manager desks in straight and L-shape configurations",
  "Workstations":     "Open-plan, sit-stand and pod workstation systems for modern teams",
  "Boardroom Tables": "Premium conference and boardroom tables that seat 8 to 16",
  "Reception Desks":  "Feature reception counters that create a powerful first impression",
  "Office Seating":   "Executive chairs, visitor seating and commercial task chairs",
  "Storage":          "Credenzas, pedestals, storage walls and filing systems",
  "Lounge Seating":   "Executive lounge and reception seating with premium upholstery",
  "Occasional Tables":"Side tables, coffee tables and occasional pieces",
};

const PAGE_SIZE = 12;

function ProductCard({ product }: { product: CuratedProduct }) {
  const [imgError, setImgError] = useState(false);
  const FALLBACKS: Record<string, string> = {
    "Executive Desks": "/images/category-desks.png",
    "Manager Desks":   "/images/category-desks.png",
    "Boardroom Tables":"/images/category-boardroom.png",
    "Reception Desks": "/images/category-reception.png",
    "Office Seating":  "/images/category-seating.png",
    "Workstations":    "/images/category-fitout.png",
    "Storage":         "/images/category-fitout.png",
    "Lounge Seating":  "/images/category-reception.png",
    "Occasional Tables":"/images/category-reception.png",
  };
  const imgSrc = !imgError && product.image ? product.image : (FALLBACKS[product.category] || "/images/category-fitout.png");

  return (
    <div
      className="group flex flex-col bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.08)] rounded-2xl overflow-hidden hover:border-[rgba(201,168,76,0.22)] transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
      data-testid={`card-product-${product.sku.toLowerCase()}`}
    >
      <Link href={`/products/${product.sku}`} className="block relative overflow-hidden bg-[hsl(220,20%,7%)]" style={{ aspectRatio: "4/3" }}>
        <img
          src={imgSrc}
          alt={product.display_name}
          className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,18%,7%)]/60 via-transparent to-transparent" />

        {/* Featured badge */}
        {product.featured && (
          <div className="absolute top-3 left-3">
            <span className="bg-[rgba(201,168,76,0.9)] text-[hsl(220,20%,6%)] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Featured
            </span>
          </div>
        )}

        {/* Variant count */}
        {product.has_variants && product.variant_count > 1 && (
          <div className="absolute top-3 right-3">
            <span className="bg-[hsl(220,20%,6%)]/80 backdrop-blur-sm border border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] text-[10px] px-2 py-0.5 rounded-full">
              {product.variant_count} sizes
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="bg-[hsl(220,20%,6%)]/85 text-[hsl(43,78%,65%)] text-xs font-semibold px-5 py-2 rounded-full border border-[rgba(201,168,76,0.3)] backdrop-blur-sm flex items-center gap-1.5">
            View Details <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </Link>

      <div className="flex flex-col flex-1 p-5">
        {/* Series name */}
        <div className="text-[hsl(43,78%,52%)] text-[10px] font-bold tracking-widest uppercase mb-2">
          {product.series_marketing_name || getSeriesDisplayName(product.series)}
        </div>

        {/* Product name */}
        <Link href={`/products/${product.sku}`} data-testid={`link-product-${product.sku.toLowerCase()}`}>
          <h3 className="font-serif font-bold text-white text-base leading-tight mb-2 hover:text-[hsl(43,78%,65%)] transition-colors line-clamp-2">
            {product.display_name}
          </h3>
        </Link>

        {/* Short description */}
        {product.short_description && (
          <p className="text-white/40 text-xs leading-relaxed mb-3 line-clamp-2">{product.short_description}</p>
        )}

        {/* Colour swatches */}
        {product.colours_available && product.colours_available.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {product.colours_available.slice(0, 3).map(c => (
              <span key={c} className="text-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.1)] text-white/45 px-2 py-0.5 rounded">
                {c}
              </span>
            ))}
            {product.colours_available.length > 3 && (
              <span className="text-[10px] text-white/25">+{product.colours_available.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-[rgba(255,255,255,0.04)]">
          <span className="text-[hsl(43,78%,65%)] font-bold text-sm" data-testid={`text-price-${product.sku.toLowerCase()}`}>
            {product.price_from}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-white/40 hover:text-white/70 h-8 px-2 text-xs"
              data-testid={`button-product-detail-${product.sku.toLowerCase()}`}
            >
              <Link href={`/products/${product.sku}`}>Details</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="h-8 bg-transparent border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] text-xs font-medium hover:bg-[rgba(201,168,76,0.1)] px-3"
              data-testid={`button-product-quote-${product.sku.toLowerCase()}`}
            >
              <Link href={`/send-us-your-quote?sku=${product.sku}&name=${encodeURIComponent(product.product_name)}`}>
                Quote <ArrowRight className="ml-1 w-3 h-3" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  useEffect(() => {
    document.title = "Office Furniture Collections | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "Premium commercial office furniture — executive desks, boardroom tables, ergonomic seating, workstations and reception counters. Australian-owned, 6-year warranty.");
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);

  const { data: products = [], isLoading } = useQuery<CuratedProduct[]>({
    queryKey: ["/api/products/curated"],
    queryFn: () => fetch("/api/products/curated").then(r => r.json()),
  });

  const filtered = useMemo(() => {
    let result = products;
    if (activeCategory !== "All") result = result.filter(p => p.category === activeCategory);
    if (showFeaturedOnly) result = result.filter(p => p.featured);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.product_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.series_marketing_name || "").toLowerCase().includes(q) ||
        (p.short_description || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, activeCategory, search, showFeaturedOnly]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = paginated.length < filtered.length;

  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  }, [products]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearSearch = () => { setSearch(""); setSearchInput(""); setPage(1); };
  const handleCategoryChange = (cat: string) => { setActiveCategory(cat); setPage(1); };

  const isFiltered = activeCategory !== "All" || search.trim() !== "" || showFeaturedOnly;

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-28 sm:pt-40 pb-16 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[hsl(43,78%,52%)] opacity-[0.03] blur-[120px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-10">
            <div>
              <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-3">The Corporate Desk</div>
              <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-4">
                Premium Office<br />
                <span className="gold-text">Furniture</span>
              </h1>
              <p className="text-white/45 max-w-xl leading-relaxed text-sm">
                {products.length} curated models across {Object.keys(categoryCount).length} categories — executive desks, boardroom tables, sit-stand workstations, seating and reception systems. All available for specification and delivery Australia-wide.
              </p>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2 max-w-sm w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search by name, series…"
                  className="pl-9 bg-[rgba(255,255,255,0.06)] border-[rgba(201,168,76,0.2)] text-white placeholder:text-white/30 h-11 focus:border-[rgba(201,168,76,0.5)]"
                  data-testid="input-product-search"
                />
                {searchInput && (
                  <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button type="submit" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold h-11 px-5" data-testid="button-product-search">
                Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="sticky top-16 sm:top-20 z-30 bg-[hsl(220,20%,7%)]/97 backdrop-blur-md border-b border-[rgba(201,168,76,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto touch-scroll py-2 flex-nowrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                data-testid={`filter-${cat.toLowerCase().replace(/[\s&]+/g, "-")}`}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                    : "text-white/50 hover:text-white/80 border border-[rgba(201,168,76,0.1)] hover:border-[rgba(201,168,76,0.2)]"
                }`}
              >
                {cat !== "All" && <span className="text-[11px] opacity-70">{CATEGORY_ICONS[cat]}</span>}
                {cat}
                {cat !== "All" && categoryCount[cat] && (
                  <span className={`ml-0.5 text-[10px] ${activeCategory === cat ? "opacity-60" : "opacity-40"}`}>
                    ({categoryCount[cat]})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Category Description */}
      {activeCategory !== "All" && CATEGORY_DESCRIPTIONS[activeCategory] && (
        <div className="bg-[hsl(220,18%,9%)] border-b border-[rgba(255,255,255,0.04)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
            <span className="text-2xl text-[hsl(43,78%,52%)] opacity-60">{CATEGORY_ICONS[activeCategory]}</span>
            <div>
              <h2 className="text-white font-semibold text-sm">{activeCategory}</h2>
              <p className="text-white/40 text-xs">{CATEGORY_DESCRIPTIONS[activeCategory]}</p>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Filter bar */}
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {isFiltered && (
                <p className="text-white/40 text-sm">
                  Showing <span className="text-white font-medium">{paginated.length}</span> of <span className="text-white font-medium">{filtered.length}</span>
                  {activeCategory !== "All" && <> in <span className="text-white/60">{activeCategory}</span></>}
                </p>
              )}
              {search && (
                <Badge className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]">
                  "{search}"
                  <button onClick={clearSearch} className="ml-1.5" data-testid="button-clear-search">
                    <X className="w-3 h-3 inline" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShowFeaturedOnly(v => !v); setPage(1); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  showFeaturedOnly
                    ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)]"
                    : "border-[rgba(255,255,255,0.08)] text-white/40 hover:text-white/60"
                }`}
                data-testid="filter-featured-only"
              >
                <Layers className="w-3 h-3" />
                Featured only
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[hsl(220,18%,10%)] rounded-2xl overflow-hidden animate-pulse border border-[rgba(255,255,255,0.04)]">
                  <div className="bg-[rgba(255,255,255,0.03)]" style={{ aspectRatio: "4/3" }} />
                  <div className="p-5 space-y-2">
                    <div className="h-2.5 w-20 bg-[rgba(255,255,255,0.04)] rounded" />
                    <div className="h-4 w-full bg-[rgba(255,255,255,0.04)] rounded" />
                    <div className="h-3 w-3/4 bg-[rgba(255,255,255,0.03)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4 text-white/10">◈</div>
              <p className="text-white/30 text-sm mb-4">No products match your current filters</p>
              <Button
                variant="outline"
                onClick={() => { setActiveCategory("All"); clearSearch(); setShowFeaturedOnly(false); }}
                className="border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)]"
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {paginated.map(product => (
                  <ProductCard key={product.sku} product={product} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-10 text-center">
                  <Button
                    onClick={() => setPage(p => p + 1)}
                    variant="outline"
                    className="border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] px-10 min-h-[44px] hover:bg-[rgba(201,168,76,0.08)]"
                    data-testid="button-load-more"
                  >
                    Show more ({filtered.length - paginated.length} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[hsl(220,20%,6%)] border-t border-[rgba(201,168,76,0.08)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-4">Workspace Planning</div>
          <h2 className="text-3xl font-serif font-bold text-white mb-4">
            Planning a full office fitout?
          </h2>
          <p className="text-white/40 text-sm mb-8 leading-relaxed">
            Our workspace consultants can specify the complete fitout — from executive suites to open-plan workstations — matched to your headcount, space and brand.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold h-12 px-8 hover:bg-[hsl(43,78%,45%)]" data-testid="button-get-quote">
              <Link href="/send-us-your-quote">Get a Quote <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] h-12 px-8 hover:bg-[rgba(201,168,76,0.08)]" data-testid="button-workspace-planning">
              <Link href="/free-office-layout">Workspace Planning</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
