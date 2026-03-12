import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/Layout";
import { ArrowRight, Tag, Search, SlidersHorizontal, X, Package, ChevronDown, ChevronRight } from "lucide-react";
import { getSeriesDisplayName } from "@/lib/seriesDisplayNames";

interface SizeVariant {
  sku: string;
  sizeLabel: string;
  dimensions: string;
}

interface Product {
  product_name: string;
  display_name?: string;
  sku: string;
  supplier: string;
  category: string;
  series: string;
  dimensions?: string;
  materials?: string;
  colors?: string[];
  features?: string[];
  image?: string;
  needs_manual_review?: boolean;
  has_variants?: boolean;
  variant_count?: number;
  size_variants?: SizeVariant[];
}

const CATEGORY_IMAGES: Record<string, string> = {
  "Executive Desks": "/images/category-desks.png",
  "Manager Desks": "/images/category-desks.png",
  "Boardroom Tables": "/images/category-boardroom.png",
  "Reception Desks": "/images/category-reception.png",
  "Office Seating": "/images/category-seating.png",
  "Workstations": "/images/category-fitout.png",
  "Storage": "/images/category-fitout.png",
  "Storage & Filing": "/images/category-fitout.png",
  "Lounge Seating": "/images/category-reception.png",
  "Occasional Tables": "/images/category-reception.png",
};

const CATEGORY_PRICE_RANGES: Record<string, string> = {
  "Executive Desks": "From $2,500",
  "Manager Desks": "From $1,200",
  "Boardroom Tables": "From $3,200",
  "Reception Desks": "From $2,800",
  "Office Seating": "From $450",
  "Workstations": "From $890",
  "Storage": "From $350",
  "Storage & Filing": "From $280",
  "Lounge Seating": "From $1,400",
  "Occasional Tables": "From $320",
};

interface CollectionConfig {
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  badgeLabel: string;
  order: number;
}

const SUPPLIER_COLLECTIONS: Record<string, CollectionConfig> = {
  "Foshan Feisenzhuo Furniture Co., Ltd.": {
    name: "Fessenz Design Collection",
    tagline: "Bold executive aesthetics meets commercial-grade engineering",
    description: "Our most expansive collection — executive desks, boardroom tables, workstations and storage systems spanning six distinct design series. From sweeping L-shaped command stations to modular open-plan fit-outs.",
    accentColor: "hsl(43,78%,52%)",
    badgeLabel: "Fessenz",
    order: 1,
  },
  "Huasheng Furniture Group — GOJO Division": {
    name: "Presidia Executive Collection",
    tagline: "Prestige executive furniture for board-level interiors",
    description: "Crafted from Zingana African ebony hardwood with pure copper hardware. The Presidia range spans executive desks, conference tables and full office suites — built to command the room.",
    accentColor: "hsl(43,78%,52%)",
    badgeLabel: "Presidia",
    order: 2,
  },
  "Huasheng Furniture Group — Lounge & Seating Division": {
    name: "Presidia Lounge & Seating Collection",
    tagline: "Neo-Chinese design language for executive reception and lounge spaces",
    description: "Mortise-and-tenon joinery, moon gate motifs, and imported ebony hardwood — the Presidia Lounge range brings architectural gravitas to reception areas and executive break-out zones.",
    accentColor: "hsl(43,78%,52%)",
    badgeLabel: "Presidia Lounge",
    order: 3,
  },
  "Huasheng Furniture Group — Gaozhuo Division": {
    name: "Milan Premium Workspace Collection",
    tagline: "Sit-stand engineering with refined Scandinavian-inspired aesthetics",
    description: "Electric height-adjustable desks, ergonomic workstations, and premium manager suites with oak veneer, teal accent panels and solid timber legs. Built for the modern high-performance workplace.",
    accentColor: "hsl(43,78%,52%)",
    badgeLabel: "Milan",
    order: 4,
  },
  "Foshan Bohua Furniture Co., Ltd. (GAOJIN)": {
    name: "Commercial Seating & Storage Collection",
    tagline: "Commercial-grade seating and filing for every office environment",
    description: "A comprehensive range of task chairs, visitor seating, training chairs, public seating and steel filing systems. Engineered to perform in high-traffic commercial environments across reception, training and open-plan workspaces.",
    accentColor: "hsl(43,78%,52%)",
    badgeLabel: "Seating & Storage",
    order: 5,
  },
};

const ALL_CATEGORIES = [
  "All",
  "Executive Desks",
  "Manager Desks",
  "Boardroom Tables",
  "Reception Desks",
  "Office Seating",
  "Workstations",
  "Storage",
  "Storage & Filing",
  "Lounge Seating",
  "Occasional Tables",
];

const PAGE_SIZE = 12;

function ProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = (!imgError && product.image) ? product.image : (CATEGORY_IMAGES[product.category] || "/images/category-fitout.png");
  const price = CATEGORY_PRICE_RANGES[product.category] || "POA";
  const slug = product.sku.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return (
    <div
      className="luxury-card rounded-md overflow-hidden group hover-elevate flex flex-col"
      data-testid={`card-product-${slug}`}
    >
      <Link href={`/products/${product.sku}`} className="block">
        <div className="relative overflow-hidden bg-[hsl(220,20%,8%)]" style={{ aspectRatio: "1/1" }}>
          <img
            src={imgSrc}
            alt={product.product_name}
            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
            style={{ transformOrigin: "center center" }}
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,18%,6%)]/70 via-transparent to-transparent opacity-80" />
          <div className="absolute top-3 left-3">
            <Badge className="bg-[rgba(201,168,76,0.85)] text-[hsl(220,20%,6%)] text-xs font-semibold">
              {getSeriesDisplayName(product.series)}
            </Badge>
          </div>
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1.5 bg-[hsl(220,20%,6%)]/90 backdrop-blur-sm border border-[rgba(201,168,76,0.3)] rounded-full px-3 py-1">
              <Tag className="w-3 h-3 text-[hsl(43,78%,52%)]" />
              <span className="text-[hsl(43,78%,65%)] text-xs font-bold" data-testid={`text-price-${product.sku.toLowerCase()}`}>{price}</span>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="bg-[hsl(220,20%,6%)]/80 text-[hsl(43,78%,65%)] text-xs font-semibold px-4 py-2 rounded-full border border-[rgba(201,168,76,0.3)] backdrop-blur-sm">
              View Details →
            </span>
          </div>
        </div>
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <Link href={`/products/${product.sku}`} className="block" data-testid={`link-product-${slug}`}>
          {product.has_variants && product.variant_count && product.variant_count > 1 && (
            <div className="text-xs text-[hsl(43,78%,52%)] mb-2 tracking-wider flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)]" />
              Available in {product.variant_count} sizes
            </div>
          )}
          <h3 className="font-serif font-bold text-white text-base leading-snug mb-3 line-clamp-2 hover:text-[hsl(43,78%,65%)] transition-colors">{product.display_name || product.product_name}</h3>
        </Link>
        {product.materials && (
          <p className="text-white/45 text-sm leading-relaxed mb-3 line-clamp-2">{product.materials}</p>
        )}
        {product.colors && product.colors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.colors.slice(0, 3).map(color => (
              <span key={color} className="text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.12)] text-white/50 px-2 py-0.5 rounded">
                {color}
              </span>
            ))}
            {product.colors.length > 3 && (
              <span className="text-xs text-white/30">+{product.colors.length - 3} more</span>
            )}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="text-[hsl(43,78%,65%)] font-bold text-sm">{price}</span>
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-white/40 hover:text-white/70 h-8 px-2 text-xs"
              data-testid={`button-product-detail-${slug}`}
            >
              <Link href={`/products/${product.sku}`}>
                Details
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-transparent border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] font-medium hover:bg-[rgba(201,168,76,0.1)]"
              data-testid={`button-product-quote-${slug}`}
            >
              <Link href={`/send-us-your-quote?sku=${product.sku}&name=${encodeURIComponent(product.product_name)}`}>
                Quote <ArrowRight className="ml-1 w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectionSection({
  supplierKey,
  collection,
  products,
}: {
  supplierKey: string;
  collection: CollectionConfig;
  products: Product[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [page, setPage] = useState(1);
  const [activeSeries, setActiveSeries] = useState<string>("All");

  const seriesOptions = useMemo(() => {
    const unique = Array.from(new Set(products.map(p => p.series).filter(Boolean))).sort();
    return unique;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeSeries === "All") return products;
    return products.filter(p => p.series === activeSeries);
  }, [products, activeSeries]);

  const visible = filteredProducts.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filteredProducts.length;

  const handleSeriesChange = (series: string) => {
    setActiveSeries(series);
    setPage(1);
  };

  if (products.length === 0) return null;

  return (
    <section className="mb-20" data-testid={`section-collection-${collection.badgeLabel.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-[rgba(201,168,76,0.35)] bg-[rgba(201,168,76,0.08)] text-[hsl(43,78%,65%)] tracking-wider uppercase">
              {collection.badgeLabel}
            </span>
            <span className="text-white/25 text-xs">{products.length} products</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-2">
            {collection.name}
          </h2>
          <p className="text-[hsl(43,78%,60%)] text-sm font-medium italic mb-3">{collection.tagline}</p>
          <div className="w-16 h-px bg-[rgba(201,168,76,0.4)] mb-4" />
          <p className="text-white/45 text-sm leading-relaxed max-w-2xl">{collection.description}</p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-white/40 text-xs hover:text-white/70 border border-white/10 px-3 py-2 rounded mt-1 flex-shrink-0"
          data-testid={`button-toggle-collection-${collection.badgeLabel.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {expanded ? "Collapse" : "Expand"}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Series sub-filter tabs */}
      {expanded && seriesOptions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 touch-scroll flex-nowrap border-b border-[rgba(201,168,76,0.08)]" data-testid={`series-filter-${supplierKey.slice(0,8)}`}>
          <button
            onClick={() => handleSeriesChange("All")}
            className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap ${
              activeSeries === "All"
                ? "bg-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.4)]"
                : "text-white/40 hover:text-white/70 border border-transparent hover:border-white/10"
            }`}
            data-testid={`series-tab-all-${supplierKey.slice(0,8)}`}
          >
            All Ranges
          </button>
          {seriesOptions.map(series => (
            <button
              key={series}
              onClick={() => handleSeriesChange(series)}
              className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap ${
                activeSeries === series
                  ? "bg-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.4)]"
                  : "text-white/40 hover:text-white/70 border border-transparent hover:border-white/10"
              }`}
              data-testid={`series-tab-${series.toLowerCase().replace(/[\s&\/]+/g, "-")}`}
            >
              {getSeriesDisplayName(series)}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <>
          {filteredProducts.length === 0 ? (
            <p className="text-white/30 text-sm italic py-8 text-center">No products found in this range.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {visible.map(product => (
                  <ProductCard key={product.sku} product={product} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <Button
                    onClick={() => setPage(p => p + 1)}
                    variant="outline"
                    className="border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] px-8 min-h-[44px] hover:bg-[rgba(201,168,76,0.08)]"
                    data-testid={`button-load-more-${collection.badgeLabel.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    Show more ({filteredProducts.length - visible.length} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!expanded && (
        <p className="text-white/25 text-sm italic">{products.length} products hidden — click Expand to view</p>
      )}
    </section>
  );
}

export default function Products() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [showSeriesFilter, setShowSeriesFilter] = useState(false);

  useEffect(() => {
    document.title = "Office Furniture Collections | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "Browse premium commercial office furniture collections: executive desks, boardroom tables, ergonomic seating, workstations, reception areas and storage. Australian-owned. 6-year warranty.");
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/grouped"],
  });

  const publicProducts = useMemo(() => products.filter(p => !p.needs_manual_review), [products]);

  const isFiltered = activeCategory !== "All" || search.trim() !== "";

  const filtered = useMemo(() => {
    let result = publicProducts;
    if (activeCategory !== "All") result = result.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.product_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.series || "").toLowerCase().includes(q) ||
        getSeriesDisplayName(p.series || "").toLowerCase().includes(q) ||
        (p.materials || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [publicProducts, activeCategory, search]);

  const byCollection = useMemo(() => {
    if (isFiltered) return null;
    const groups: Record<string, Product[]> = {};
    publicProducts.forEach(p => {
      const key = p.supplier || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [publicProducts, isFiltered]);

  const sortedCollections = useMemo(() => {
    if (!byCollection) return [];
    return Object.entries(byCollection)
      .map(([key, prods]) => ({ key, config: SUPPLIER_COLLECTIONS[key], prods }))
      .filter(({ config }) => !!config)
      .sort((a, b) => a.config.order - b.config.order);
  }, [byCollection]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = paginated.length < filtered.length;

  const seriesInView = useMemo(() => Array.from(new Set(filtered.map(p => p.series).filter(Boolean))).sort(), [filtered]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearch("");
    setSearchInput("");
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setPage(1);
  };

  return (
    <Layout>
      <section className="relative pt-28 sm:pt-40 pb-16 sm:pb-20 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
            {publicProducts.length} Products — 5 Premium Collections
          </Badge>
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-4">
            Our Furniture<br />
            <span className="gold-text">Collections</span>
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-white/55 max-w-xl leading-relaxed mb-8">
            Five curated collections spanning executive desks, boardroom tables, sit-stand workstations, lounge seating, and commercial storage — all engineered to commercial grade and available for specification Australia-wide.
          </p>

          <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name, SKU, series, material…"
                className="pl-9 bg-[rgba(255,255,255,0.06)] border-[rgba(201,168,76,0.2)] text-white placeholder:text-white/30 focus:border-[rgba(201,168,76,0.5)] h-11"
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
      </section>

      <section className="sticky top-16 sm:top-20 z-30 bg-[hsl(220,20%,7%)]/97 backdrop-blur-md border-b border-[rgba(201,168,76,0.1)] py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto touch-scroll pb-1 flex-nowrap">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                data-testid={`filter-${cat.toLowerCase().replace(/[\s&]+/g, "-")}`}
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                className={`flex-shrink-0 px-4 min-h-[44px] rounded-md text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                    : "bg-[rgba(255,255,255,0.04)] text-white/60 active:text-white active:bg-[rgba(255,255,255,0.1)] border border-[rgba(201,168,76,0.15)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="luxury-card rounded-md overflow-hidden animate-pulse">
                  <div className="bg-[rgba(255,255,255,0.04)]" style={{ aspectRatio: "1/1" }} />
                  <div className="p-5">
                    <div className="h-3 w-24 bg-[rgba(255,255,255,0.06)] rounded mb-3" />
                    <div className="h-5 w-full bg-[rgba(255,255,255,0.04)] rounded mb-2" />
                    <div className="h-4 w-3/4 bg-[rgba(255,255,255,0.04)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : isFiltered ? (
            <>
              <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-white/40 text-sm">
                    Showing <span className="text-white">{paginated.length}</span> of <span className="text-white">{filtered.length}</span> products
                    {activeCategory !== "All" && <span className="text-white/30"> in <span className="text-white/60">{activeCategory}</span></span>}
                  </p>
                  {search && (
                    <Badge className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]">
                      Search: "{search}"
                      <button onClick={clearSearch} className="ml-1.5 hover:text-white" data-testid="button-clear-search">
                        <X className="w-3 h-3 inline" />
                      </button>
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {seriesInView.length > 0 && (
                    <button
                      onClick={() => setShowSeriesFilter(s => !s)}
                      className="flex items-center gap-1.5 text-white/50 text-xs hover:text-white/80 border border-white/10 px-3 py-1.5 rounded"
                      data-testid="button-toggle-series"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {seriesInView.length} Series
                      <ChevronDown className={`w-3 h-3 transition-transform ${showSeriesFilter ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {showSeriesFilter && seriesInView.length > 0 && (
                <div className="mb-6 p-4 bg-[hsl(220,20%,7%)] border border-[rgba(201,168,76,0.12)] rounded-md">
                  <p className="text-white/40 text-xs mb-3 uppercase tracking-wider">Filter by series</p>
                  <div className="flex flex-wrap gap-2">
                    {seriesInView.map(series => (
                      <button
                        key={series}
                        onClick={() => { setSearchInput(getSeriesDisplayName(series)); setSearch(getSeriesDisplayName(series)); setPage(1); }}
                        className="text-xs px-3 py-1 bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)] text-[hsl(43,78%,60%)] rounded hover:bg-[rgba(201,168,76,0.15)] transition-colors"
                        data-testid={`filter-series-${series.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {getSeriesDisplayName(series)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="text-center py-24">
                  <Package className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <h3 className="text-white/60 font-serif text-xl mb-2">No products found</h3>
                  <p className="text-white/30 text-sm mb-6">Try a different search term or category filter.</p>
                  <Button onClick={clearSearch} variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]" data-testid="button-clear-search-empty">
                    Clear filters
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
                    <div className="mt-12 text-center">
                      <Button
                        onClick={() => setPage(p => p + 1)}
                        variant="outline"
                        size="lg"
                        className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] px-10 min-h-[52px] hover:bg-[rgba(201,168,76,0.08)]"
                        data-testid="button-load-more"
                      >
                        Load More ({filtered.length - paginated.length} remaining)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {sortedCollections.map(({ key, config, prods }) => (
                <div key={key}>
                  <CollectionSection supplierKey={key} collection={config} products={prods} />
                  <div className="border-t border-[rgba(201,168,76,0.08)] mb-20" />
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <section className="py-16 bg-[hsl(220,20%,5%)] border-t border-[rgba(201,168,76,0.1)]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-2xl border border-[rgba(201,168,76,0.3)] bg-gradient-to-br from-[hsl(220,18%,10%)] to-[hsl(220,20%,7%)] p-8 sm:p-10 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-full mb-4">
                <Search className="w-3 h-3 text-[hsl(43,78%,52%)]" />
                <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase">AI-Powered</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-3">
                Not Sure Which Products Suit Your Space?
              </h2>
              <p className="text-white/55 leading-relaxed">
                Upload your floor plan and let our AI analyse your space, recommend the right products from our catalogue, and generate an estimated project cost — before you speak to anyone.
              </p>
            </div>
            <div className="flex flex-col gap-3 flex-shrink-0 w-full md:w-auto">
              <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-8 min-h-[52px] whitespace-nowrap" data-testid="button-products-ai-planner">
                <Link href="/upload-your-floor-plan">AI Office Planner <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] px-8 min-h-[52px] whitespace-nowrap" data-testid="button-products-cta-quote">
                <Link href="/send-us-your-quote">Send Us Your Quote</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[hsl(220,20%,5%)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
            Can't Find What You're Looking For?
          </h2>
          <p className="text-white/55 mb-8 leading-relaxed">
            Our full catalogue spans executive, manager, boardroom, sit-stand, storage and lounge categories. Speak to a specialist who knows every product.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-8" data-testid="button-products-cta-contact">
              <Link href="/contact">Speak to a Specialist</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] px-8" data-testid="button-products-cta-solutions">
              <Link href="/workplace-solutions">View Workplace Solutions</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
