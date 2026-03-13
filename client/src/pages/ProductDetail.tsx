import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import {
  ChevronLeft, ArrowRight, Shield, Award, CheckCircle2,
  Ruler, Layers, Palette, ChevronRight, Phone, FileText, Package
} from "lucide-react";
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
  features: string[];
  dimensions: string;
  image: string;
  gallery: string[];
  has_variants: boolean;
  variant_count: number;
  size_variants: { sku: string; sizeLabel: string; dimensions: string }[];
  sizes_available: string[];
  colours_available: string[];
  configurations_available: string[];
  short_description: string;
  price_from: string;
  price_from_num: number | null;
  featured: boolean;
}

const FALLBACK_IMAGES: Record<string, string> = {
  "Executive Desks":  "/images/category-desks.png",
  "Manager Desks":    "/images/category-desks.png",
  "Boardroom Tables": "/images/category-boardroom.png",
  "Reception Desks":  "/images/category-reception.png",
  "Office Seating":   "/images/category-seating.png",
  "Workstations":     "/images/category-fitout.png",
  "Storage":          "/images/category-fitout.png",
  "Lounge Seating":   "/images/category-reception.png",
  "Occasional Tables":"/images/category-reception.png",
};

const WARRANTY_FEATURES = [
  { icon: Shield, label: "6-Year Warranty", desc: "Commercial-grade quality backed by a 6-year structural warranty" },
  { icon: Award, label: "AFRDI / BIFMA Certified", desc: "Meets or exceeds Australian and international commercial standards" },
  { icon: CheckCircle2, label: "White-Glove Delivery", desc: "Professional installation and assembly throughout Australia" },
  { icon: Package, label: "Made to Order", desc: "Most products configured and shipped within 8–12 weeks" },
];

function ImageGallery({ images, productName, category }: { images: string[]; productName: string; category: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});

  const fallback = FALLBACK_IMAGES[category] || "/images/category-fitout.png";
  const gallery = images && images.length > 0 ? images : [fallback];
  const activeSrc = imgError[activeIdx] ? fallback : gallery[activeIdx];

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div
        className="relative rounded-2xl overflow-hidden bg-[hsl(220,20%,7%)] border border-[rgba(201,168,76,0.08)]"
        style={{ aspectRatio: "4/3" }}
      >
        <img
          src={activeSrc}
          alt={productName}
          className="w-full h-full object-cover object-center"
          onError={() => setImgError(prev => ({ ...prev, [activeIdx]: true }))}
        />
        {gallery.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx(i => (i - 1 + gallery.length) % gallery.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
              data-testid="button-gallery-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveIdx(i => (i + 1) % gallery.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
              data-testid="button-gallery-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? "bg-[hsl(43,78%,60%)] scale-125" : "bg-white/30"}`}
                  data-testid={`button-gallery-dot-${i}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {gallery.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {gallery.slice(0, 8).map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border transition-all ${
                i === activeIdx
                  ? "border-[hsl(43,78%,52%)] shadow-[0_0_0_1px_hsl(43,78%,52%)]"
                  : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,168,76,0.2)]"
              }`}
              style={{ width: 72, height: 54 }}
              data-testid={`button-gallery-thumb-${i}`}
            >
              <img
                src={imgError[i] ? fallback : img}
                alt={`View ${i + 1}`}
                className="w-full h-full object-cover"
                onError={() => setImgError(prev => ({ ...prev, [i]: true }))}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VariationSelector({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
  testPrefix,
}: {
  label: string;
  icon: React.ElementType;
  options: string[];
  selected: string;
  onChange: (v: string) => void;
  testPrefix: string;
}) {
  if (!options || options.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-white/40">{label}</span>
        {selected && <span className="text-[11px] text-white/60 ml-auto">{selected}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`text-xs px-3.5 py-2 rounded-lg border font-medium transition-all ${
              selected === opt
                ? "bg-[rgba(201,168,76,0.15)] border-[hsl(43,78%,52%)] text-[hsl(43,78%,65%)]"
                : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-white/50 hover:border-[rgba(201,168,76,0.25)] hover:text-white/70"
            }`}
            data-testid={`${testPrefix}-${opt.toLowerCase().replace(/[\s/,&]+/g, "-").slice(0, 30)}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { sku } = useParams<{ sku: string }>();

  const { data: product, isLoading, error } = useQuery<CuratedProduct>({
    queryKey: ["/api/products/curated", sku],
    queryFn: () =>
      fetch(`/api/products/curated/${sku}`)
        .then(r => {
          if (!r.ok) throw new Error("Product not found");
          return r.json();
        }),
    retry: false,
  });

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [selectedConfig, setSelectedConfig] = useState("");

  useEffect(() => {
    if (product) {
      document.title = `${product.display_name} | The Corporate Desk`;
      const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
      meta.setAttribute("name", "description");
      meta.setAttribute("content", product.short_description || `${product.display_name} — premium commercial office furniture by The Corporate Desk.`);
      if (!meta.parentNode) document.head.appendChild(meta);

      if (product.sizes_available?.length) setSelectedSize(product.sizes_available[0]);
      if (product.colours_available?.length) setSelectedColour(product.colours_available[0]);
      if (product.configurations_available?.length) setSelectedConfig(product.configurations_available[0]);
    }
  }, [product]);

  const quoteUrl = product
    ? `/send-us-your-quote?sku=${product.sku}&name=${encodeURIComponent(product.display_name)}${selectedSize ? `&size=${encodeURIComponent(selectedSize)}` : ""}${selectedColour ? `&colour=${encodeURIComponent(selectedColour)}` : ""}${selectedConfig ? `&config=${encodeURIComponent(selectedConfig)}` : ""}`
    : "/send-us-your-quote";

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 animate-pulse">
          <div className="grid lg:grid-cols-2 gap-16">
            <div className="aspect-[4/3] bg-[hsl(220,18%,10%)] rounded-2xl" />
            <div className="space-y-4">
              <div className="h-3 w-24 bg-[rgba(255,255,255,0.05)] rounded" />
              <div className="h-8 w-3/4 bg-[rgba(255,255,255,0.07)] rounded" />
              <div className="h-4 w-full bg-[rgba(255,255,255,0.04)] rounded" />
              <div className="h-4 w-2/3 bg-[rgba(255,255,255,0.04)] rounded" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-20 text-center">
          <div className="text-5xl mb-6 text-white/10">◈</div>
          <h2 className="text-2xl font-serif font-bold text-white mb-3">Product Not Found</h2>
          <p className="text-white/40 mb-8">This product may have been discontinued or the link is incorrect.</p>
          <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold">
            <Link href="/products">Browse All Products</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-20">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/30 mb-10 flex-wrap">
          <Link href="/" className="hover:text-white/60 transition-colors" data-testid="link-breadcrumb-home">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/products" className="hover:text-white/60 transition-colors" data-testid="link-breadcrumb-products">Products</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-white/60 transition-colors" data-testid="link-breadcrumb-category">
            {product.category}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/50 line-clamp-1 max-w-[200px]">{product.display_name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 mb-20">
          {/* Left — Gallery */}
          <div>
            <ImageGallery images={product.gallery} productName={product.display_name} category={product.category} />
          </div>

          {/* Right — Info */}
          <div className="flex flex-col">
            {/* Collection + Series */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[hsl(43,78%,52%)]">
                {product.series_marketing_name || getSeriesDisplayName(product.series)}
              </span>
              <span className="text-[rgba(255,255,255,0.12)]">·</span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">{product.category}</span>
              {product.featured && (
                <Badge className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] text-[10px] py-0">
                  Featured
                </Badge>
              )}
            </div>

            {/* Name */}
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-white leading-tight mb-2" data-testid="text-product-name">
              {product.display_name}
            </h1>

            {/* Tagline */}
            {product.series_tagline && (
              <p className="text-[hsl(43,78%,52%)] text-sm italic mb-4">{product.series_tagline}</p>
            )}

            {/* SKU */}
            <div className="text-[10px] font-mono text-white/20 mb-6 uppercase tracking-widest">SKU: {product.sku}</div>

            {/* Description */}
            <p className="text-white/55 text-sm leading-relaxed mb-8 border-l-2 border-[rgba(201,168,76,0.2)] pl-4">
              {product.short_description}
            </p>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-3xl font-bold text-[hsl(43,78%,65%)]" data-testid="text-product-price">
                {product.price_from}
              </span>
              <span className="text-xs text-white/25">ex. GST · includes delivery & assembly</span>
            </div>

            {/* Variations */}
            <div className="space-y-6 mb-8">
              {product.sizes_available && product.sizes_available.length > 0 && (
                <VariationSelector
                  label="Size"
                  icon={Ruler}
                  options={product.sizes_available}
                  selected={selectedSize}
                  onChange={setSelectedSize}
                  testPrefix="size-option"
                />
              )}
              {product.colours_available && product.colours_available.length > 0 && (
                <VariationSelector
                  label="Colour / Finish"
                  icon={Palette}
                  options={product.colours_available}
                  selected={selectedColour}
                  onChange={setSelectedColour}
                  testPrefix="colour-option"
                />
              )}
              {product.configurations_available && product.configurations_available.length > 0 && (
                <VariationSelector
                  label="Configuration"
                  icon={Layers}
                  options={product.configurations_available}
                  selected={selectedConfig}
                  onChange={setSelectedConfig}
                  testPrefix="config-option"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Button
                asChild
                className="flex-1 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold h-12 text-sm"
                data-testid="button-request-quote"
              >
                <Link href={quoteUrl}>
                  Request a Quote <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="flex-1 border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] h-12 text-sm hover:bg-[rgba(201,168,76,0.08)]"
                data-testid="button-workspace-planning"
              >
                <Link href="/free-office-layout">
                  <FileText className="mr-2 w-4 h-4" />
                  Workspace Planning
                </Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
              {WARRANTY_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
                  <span className="text-[11px] text-white/45">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details Tabs */}
        <ProductDetailTabs product={product} />

        {/* Back link */}
        <div className="mt-16 pt-8 border-t border-[rgba(255,255,255,0.05)]">
          <Button
            asChild
            variant="ghost"
            className="text-white/40 hover:text-white/70 pl-0"
            data-testid="button-back-to-products"
          >
            <Link href="/products">
              <ChevronLeft className="mr-1.5 w-4 h-4" />
              Back to Products
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function ProductDetailTabs({ product }: { product: CuratedProduct }) {
  const [activeTab, setActiveTab] = useState<"overview" | "specs" | "delivery">("overview");

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "specs" as const, label: "Specifications" },
    { id: "delivery" as const, label: "Delivery & Warranty" },
  ];

  return (
    <div className="border-t border-[rgba(255,255,255,0.06)]">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.06)] mb-10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[hsl(43,78%,52%)] text-white"
                : "border-transparent text-white/35 hover:text-white/60"
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-lg font-serif font-bold text-white mb-4">About This Product</h3>
            <p className="text-white/50 text-sm leading-relaxed mb-6">{product.short_description}</p>
            {product.series_tagline && (
              <p className="text-[hsl(43,78%,52%)] italic text-sm border-l-2 border-[rgba(201,168,76,0.3)] pl-4">
                "{product.series_tagline}"
              </p>
            )}
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-white mb-4">Key Features</h3>
            <ul className="space-y-2.5">
              {[
                "Commercial-grade materials with 6-year structural warranty",
                "Professional delivery, assembly and installation included",
                `Available in ${product.colours_available?.length || 1} colour / finish options`,
                `${product.sizes_available?.length || 1} size configurations available`,
                product.configurations_available?.length > 1 ? `${product.configurations_available.length} layout configurations` : null,
                "Custom finishes and configurations available on request",
                "Coordinates with full matching range",
              ].filter(Boolean).map((feat, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/50">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === "specs" && (
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-lg font-serif font-bold text-white mb-5">Available Specifications</h3>
            <div className="space-y-4">
              {product.sizes_available?.length > 0 && (
                <SpecRow label="Sizes Available" value={product.sizes_available.join(" · ")} />
              )}
              {product.colours_available?.length > 0 && (
                <SpecRow label="Colours / Finishes" value={product.colours_available.join(" · ")} />
              )}
              {product.configurations_available?.length > 0 && (
                <SpecRow label="Configurations" value={product.configurations_available.join(" · ")} />
              )}
              {product.materials && (
                <SpecRow label="Materials" value={product.materials} />
              )}
              <SpecRow label="Category" value={product.category} />
              <SpecRow label="Collection" value={product.series_marketing_name || product.series} />
              <SpecRow label="SKU" value={product.sku} mono />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-white mb-5">Standards & Certifications</h3>
            <div className="space-y-3">
              {[
                "AFRDI Level 6 — Commercial (exceeds Australian Standard)",
                "BIFMA x5.5 — Office Chairs",
                "AS/NZS 4600 — Cold-formed steel structural compliance",
                "E1 Board Emission Standard — indoor air quality",
                "6-Year Structural Warranty",
                "Environmentally Responsible Sourcing Policy",
              ].map((cert, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-white/45">
                  <Award className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                  {cert}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "delivery" && (
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-lg font-serif font-bold text-white mb-5">Delivery & Installation</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.1)]">
                <div className="text-[hsl(43,78%,65%)] text-sm font-semibold mb-1">White-Glove Delivery Included</div>
                <p className="text-white/40 text-xs leading-relaxed">Professional delivery and full assembly is included with every order. Our installation team will place, assemble and position all furniture to your specification.</p>
              </div>
              {[
                ["Lead Time", "8–12 weeks from order confirmation (standard). Rush available on select items."],
                ["Coverage", "Australia-wide. Metropolitan same-week assessment available."],
                ["Site Requirements", "Clear access to installation area required. Lifts must accommodate standard pallet widths."],
                ["Floor Protection", "Professional floor protection included during installation."],
              ].map(([k, v]) => (
                <SpecRow key={k} label={k} value={v} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-white mb-5">Warranty Details</h3>
            <div className="space-y-3">
              {[
                ["Structural Frame", "6 years — covers all welding, jointing and structural connections"],
                ["Surface & Finish", "3 years — covers delamination, edge banding and finish degradation"],
                ["Mechanisms", "3 years — covers all moving parts, adjusters and gas lifts"],
                ["Upholstery", "2 years — covers stitching and foam integrity"],
                ["Electrical", "2 years — covers all motors, controllers and wiring"],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-[rgba(255,255,255,0.04)] pb-3 last:border-0 last:pb-0">
                  <div className="text-[11px] font-bold text-[hsl(43,78%,52%)] uppercase tracking-wider mb-1">{k}</div>
                  <div className="text-xs text-white/40">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
      <span className="text-[11px] font-bold text-white/30 uppercase tracking-widest min-w-[130px] flex-shrink-0 pt-px">{label}</span>
      <span className={`text-sm text-white/60 leading-relaxed ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
