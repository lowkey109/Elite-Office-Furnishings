import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight, ChevronLeft, Star, Tag, Package, CheckCircle2,
  Ruler, Layers, Palette, Clock, Shield, Award, Phone, FileText, Cpu
} from "lucide-react";
import { getSeriesDisplayName } from "@/lib/seriesDisplayNames";

interface Product {
  product_name: string;
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
}

interface Review {
  id: string;
  productSku: string;
  reviewerName: string;
  reviewerCompany?: string;
  reviewerRole?: string;
  rating: number;
  title?: string;
  body: string;
  status: string;
  createdAt: string;
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

const SUPPLIER_COLLECTION_NAMES: Record<string, string> = {
  "Foshan Feisenzhuo Furniture Co., Ltd.": "Fessenz Collection",
  "Huasheng Furniture Group — Gaozhuo Division": "Gaozhuo Executive Collection",
  "Huasheng Furniture Group — GOJO Division": "GOJO Executive Collection",
  "Huasheng Furniture Group — Lounge & Seating Division": "GOJO Lounge & Seating",
  "Foshan Bohua Furniture Co., Ltd. (GAOJIN)": "The Corporate Desk Collection",
};

const SUPPLIER_PREFIXES_STRIP = ["GOJO", "Weiyi", "Ruige", "Blister", "Vic", "Zhuoya", "Dynamic", "Dell", "Yashang", "Fei"];

function cleanProductName(name: string): string {
  let n = name;
  for (const prefix of SUPPLIER_PREFIXES_STRIP) {
    if (n.startsWith(prefix + " ")) { n = n.slice(prefix.length + 1); break; }
  }
  n = n.replace(/^([A-Z][A-Z0-9]{2,8}[A-Z0-9\-]*)\s+(?=[A-Z])/, "");
  n = n.replace(/^(\d[0-9A-Z\-]+)\s+(?=[A-Z])/, "");
  return n.trim();
}

function cleanBaseName(name: string): string {
  return cleanProductName(name).replace(/\s+\d{3,4}\s*$/, "").trim();
}

interface SizeVariantInfo {
  sku: string;
  sizeLabel: string;
  dimensions: string;
  isCurrent: boolean;
}

const PACKAGE_COMPATIBILITY: Record<string, { name: string; slug: string }[]> = {
  "Weiyi": [{ name: "The Executive Suite", slug: "executive-suite" }],
  "Red Cliff": [{ name: "The Director Package", slug: "director-package" }],
  "Ruige": [{ name: "The Executive Suite", slug: "executive-suite" }],
  "Blister": [{ name: "The Manager Collection", slug: "manager-collection" }],
  "Aimu": [{ name: "The Prestige Office", slug: "prestige-office" }],
  "JN": [{ name: "The Heritage Director Suite", slug: "heritage-director" }],
  "YOM": [{ name: "The Heritage Director Suite", slug: "heritage-director" }],
  "HXM": [{ name: "The Heritage Director Suite", slug: "heritage-director" }],
  "LRU": [{ name: "The Executive Suite", slug: "executive-suite" }],
  "K01": [{ name: "The Reception Lounge Package", slug: "reception-lounge" }],
  "K02": [{ name: "The Reception Lounge Package", slug: "reception-lounge" }],
  "K03": [{ name: "The Premium Reception Suite", slug: "reception-lounge" }],
  "G01": [{ name: "The Training Room Package", slug: "training-package" }],
  "G02": [{ name: "The Training Room Package", slug: "training-package" }],
  "G03": [{ name: "The Collaboration Hub Package", slug: "training-package" }],
  "G04": [{ name: "The Training Room Package", slug: "training-package" }],
};

function generateDescription(product: Product): string {
  const { product_name, category, series, materials, dimensions } = product;
  const matNote = materials ? ` Crafted from ${materials.toLowerCase()},` : "";

  const categoryDescs: Record<string, string> = {
    "Executive Desks": `The ${product_name} is a statement of authority for the modern C-suite. Designed for executives who understand that their environment reflects their standard,${matNote} this piece delivers expansive working surface with intelligent space planning. Ideal for corner offices and private executive suites, it anchors a premium workspace and projects confidence to visiting clients and stakeholders.`,
    "Manager Desks": `The ${product_name} is engineered for mid-to-senior level professionals who demand performance and presentation in equal measure.${matNote} it offers a refined working environment that supports productivity while maintaining a polished, commercial aesthetic. Best suited for open-plan offices, private offices, and managerial hubs.`,
    "Boardroom Tables": `The ${product_name} commands attention in any corporate boardroom. Designed to accommodate leadership meetings, client presentations, and strategic discussions,${matNote} it balances visual gravitas with functional workspace. Its scale and finish project a powerful message about your organisation's values and standards.`,
    "Reception Desks": `The ${product_name} is the first physical statement your organisation makes to every visitor.${matNote} this reception piece creates an immediate impression of professionalism and investment. Designed for front-of-house environments where brand and welcome combine, it sets the tone for the entire workplace experience.`,
    "Office Seating": `The ${product_name} supports the most important element of any productive workplace — your people. Engineered for commercial environments requiring sustained comfort and stylistic consistency,${matNote} it complements both individual offices and multi-seat installations. Suitable across training rooms, collaborative spaces, private offices, and executive suites.`,
    "Workstations": `The ${product_name} is built for organisations that understand the direct link between workspace quality and team performance.${matNote} this workstation system supports both focused individual work and collaborative team environments. Designed to scale with your business and adapt to evolving hybrid work models.`,
    "Storage": `The ${product_name} brings order and elegance to commercial storage requirements.${matNote} it integrates seamlessly with any premium office fitout, providing secure, accessible storage for documents, equipment, and personal items. Suitable for open-plan and private office environments.`,
    "Storage & Filing": `The ${product_name} is a precision storage solution for document-intensive organisations — law firms, financial services, government departments, and consulting practices.${matNote} it delivers organised, secure file management without compromising the aesthetic integrity of the workspace.`,
    "Lounge Seating": `The ${product_name} transforms break-out areas, reception spaces, and collaboration zones into genuinely inviting environments.${matNote} it delivers commercial durability alongside a premium visual presence — appropriate for client-facing lounges, executive waiting areas, and collaborative hubs where first impressions matter.`,
    "Occasional Tables": `The ${product_name} completes the lounge and break-out environment with considered design.${matNote} it provides a refined surface for client meetings, informal discussions, and collaborative moments — the kind of detail that signals a workplace with genuine attention to quality.`,
  };

  const base = categoryDescs[category] || `The ${product_name} is a commercial-grade furniture piece designed for modern office environments.${matNote} it delivers quality, durability, and aesthetic consistency appropriate for professional corporate fitouts.`;

  const seriesNote = series ? ` Part of the ${series} collection, it coordinates effortlessly with companion pieces for a coherent, specification-matched fitout.` : "";

  return base + seriesNote;
}

function getRecommendedUse(product: Product): string[] {
  const uses: Record<string, string[]> = {
    "Executive Desks": ["Private executive offices", "C-suite environments", "Corner office configurations", "Senior leadership suites"],
    "Manager Desks": ["Private manager offices", "Mid-level professional suites", "Open-plan premium zones", "Team leader stations"],
    "Boardroom Tables": ["Board meetings and AGMs", "Client presentations", "Leadership strategy sessions", "Formal meeting rooms"],
    "Reception Desks": ["Corporate reception areas", "Front-of-house welcome zones", "Client-facing entrances", "Professional services lobbies"],
    "Office Seating": ["Training and education rooms", "Collaborative work zones", "Executive visitor chairs", "Multi-purpose meeting rooms", "Open-plan breakout areas"],
    "Workstations": ["Open-plan team floors", "Call centre environments", "Shared desk hot-desking", "Activity-based working layouts"],
    "Storage": ["Executive suites", "Manager offices", "Open-plan filing zones", "Document management areas"],
    "Storage & Filing": ["Law firms and legal offices", "Financial services firms", "Document-intensive operations", "Government and compliance departments"],
    "Lounge Seating": ["Reception waiting areas", "Breakout and collaboration zones", "Executive lounges", "Client hospitality areas"],
    "Occasional Tables": ["Reception and lounge areas", "Client meeting zones", "Collaborative break-out spaces", "Premium hospitality environments"],
  };
  return uses[product.category] || ["Commercial office environments", "Professional workplaces"];
}

function StarRating({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${sz} ${i <= rating ? "text-[hsl(43,78%,52%)] fill-[hsl(43,78%,52%)]" : "text-white/20"}`}
        />
      ))}
    </div>
  );
}

function InteractiveStarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          data-testid={`star-${i}`}
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              i <= (hovered || value)
                ? "text-[hsl(43,78%,52%)] fill-[hsl(43,78%,52%)]"
                : "text-white/25"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-white/50">
          {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][value]}
        </span>
      )}
    </div>
  );
}

const reviewFormSchema = z.object({
  reviewerName: z.string().min(2, "Name must be at least 2 characters"),
  reviewerCompany: z.string().optional(),
  reviewerRole: z.string().optional(),
  rating: z.number().min(1, "Please select a rating").max(5),
  title: z.string().optional(),
  body: z.string().min(20, "Review must be at least 20 characters"),
});
type ReviewFormData = z.infer<typeof reviewFormSchema>;

function RelatedProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = (!imgError && product.image) ? product.image : (CATEGORY_IMAGES[product.category] || "/images/category-fitout.png");
  const price = CATEGORY_PRICE_RANGES[product.category] || "POA";
  const slug = product.sku.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return (
    <Link href={`/products/${product.sku}`} className="luxury-card rounded-md overflow-hidden group hover-elevate flex flex-col" data-testid={`card-related-${slug}`}>
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <img src={imgSrc} alt={product.product_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={() => setImgError(true)} />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,18%,10%)]/70 to-transparent" />
        <div className="absolute top-2 left-2">
          <Badge className="bg-[rgba(201,168,76,0.85)] text-[hsl(220,20%,6%)] text-xs font-semibold">{getSeriesDisplayName(product.series)}</Badge>
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-serif font-bold text-white text-sm leading-snug mb-2 line-clamp-2">{cleanBaseName(product.product_name)}</h4>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-[hsl(43,78%,65%)] text-xs font-bold">{price}</span>
          <span className="text-white/40 text-xs flex items-center gap-1 group-hover:text-[hsl(43,78%,52%)] transition-colors">
            View <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ProductDetail() {
  const { sku } = useParams<{ sku: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [imgError, setImgError] = useState(false);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["/api/products/sku", sku],
    queryFn: () => fetch(`/api/products/sku/${sku}`).then(r => r.json()),
    enabled: !!sku,
  });

  const { data: reviewData } = useQuery<{ reviews: Review[]; count: number; averageRating: number | null }>({
    queryKey: ["/api/products", sku, "reviews"],
    queryFn: () => fetch(`/api/products/${sku}/reviews`).then(r => r.json()),
    enabled: !!sku,
  });

  const { data: relatedData } = useQuery<{ products: Product[] }>({
    queryKey: ["/api/products/series", product?.series],
    queryFn: () => fetch(`/api/products/series/${encodeURIComponent(product!.series)}`).then(r => r.json()),
    enabled: !!product?.series,
  });

  const { data: sizeVariantData } = useQuery<{ baseName: string; cleanedName: string; variants: SizeVariantInfo[] }>({
    queryKey: ["/api/products", sku, "size-variants"],
    queryFn: () => fetch(`/api/products/${sku}/size-variants`).then(r => r.json()),
    enabled: !!sku,
  });

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { reviewerName: "", reviewerCompany: "", reviewerRole: "", rating: 0, title: "", body: "" },
  });

  const submitReview = useMutation({
    mutationFn: (data: ReviewFormData) =>
      fetch(`/api/products/${sku}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => { if (!r.ok) throw new Error("Submit failed"); return r.json(); }),
    onSuccess: () => {
      setReviewSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/products", sku, "reviews"] });
      toast({ title: "Review submitted", description: "Thank you — your review is pending moderation." });
    },
    onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white/40 text-lg">Loading product...</div>
        </div>
      </Layout>
    );
  }

  if (!product || (product as any).error) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <div className="text-[hsl(43,78%,52%)] text-4xl font-serif">Product Not Found</div>
          <p className="text-white/50">The product you are looking for does not exist or has been removed.</p>
          <Button asChild className="bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]">
            <Link href="/products">← Back to Products</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const imgSrc = (!imgError && product.image) ? product.image : (CATEGORY_IMAGES[product.category] || "/images/category-fitout.png");
  const price = CATEGORY_PRICE_RANGES[product.category] || "POA";
  const collectionName = SUPPLIER_COLLECTION_NAMES[product.supplier] || "The Corporate Desk Collection";
  const description = generateDescription(product);
  const recommendedUses = getRecommendedUse(product);
  const packages = PACKAGE_COMPATIBILITY[product.series] || [];
  const cleanedName = sizeVariantData?.baseName || cleanBaseName(product.product_name);
  const hasMultipleSizes = (sizeVariantData?.variants?.length ?? 0) > 1;
  const sizeVariants = sizeVariantData?.variants || [];
  const relatedProducts = (relatedData?.products || [])
    .filter(p => p.sku !== product.sku)
    .slice(0, 4);

  const reviews = reviewData?.reviews || [];
  const avgRating = reviewData?.averageRating;

  return (
    <Layout>
      <div className="min-h-screen" style={{ backgroundColor: "hsl(220,20%,6%)" }}>

        {/* Breadcrumb */}
        <div className="border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <nav className="flex items-center gap-2 text-sm text-white/40" data-testid="breadcrumb-nav">
              <Link href="/" className="hover:text-[hsl(43,78%,52%)] transition-colors">Home</Link>
              <span>/</span>
              <Link href="/products" className="hover:text-[hsl(43,78%,52%)] transition-colors">Products</Link>
              <span>/</span>
              <span className="text-white/60">{product.category}</span>
              <span>/</span>
              <span className="text-white/80 truncate max-w-[200px]">{cleanedName}</span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 py-10 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

            {/* Image */}
            <div className="relative">
              <div
                className="rounded-lg overflow-hidden border border-white/8"
                style={{ aspectRatio: "4/3", background: "hsl(220,18%,9%)" }}
                data-testid="product-image-container"
              >
                <img
                  src={imgSrc}
                  alt={product.product_name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                  data-testid="product-main-image"
                />
              </div>
              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <Badge className="bg-[rgba(201,168,76,0.9)] text-[hsl(220,20%,6%)] text-xs font-bold px-3 py-1">
                  {getSeriesDisplayName(product.series)}
                </Badge>
                <Badge className="bg-[hsl(220,20%,10%)]/90 text-white/60 text-[10px] border border-white/10 px-2 py-1">
                  {collectionName}
                </Badge>
              </div>
            </div>

            {/* Product Info */}
            <div className="flex flex-col gap-5" data-testid="product-info">

              <div>
                <h1 className="font-serif font-bold text-white text-3xl md:text-4xl leading-tight mb-2" data-testid="text-product-name">
                  {cleanedName}
                </h1>
                <div className="text-white/50 text-sm mb-4">{product.category} · {collectionName}</div>

                {/* Size Variant Selector */}
                {hasMultipleSizes && (
                  <div className="mb-5 p-4 rounded-lg bg-[hsl(220,20%,8%)] border border-[rgba(201,168,76,0.15)]" data-testid="size-variant-selector">
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-3">Choose Size</div>
                    <div className="flex flex-wrap gap-2">
                      {sizeVariants.map(variant => (
                        <Link
                          key={variant.sku}
                          href={`/products/${variant.sku}`}
                          data-testid={`size-option-${variant.sku.toLowerCase()}`}
                          className={`px-4 py-2 rounded text-sm font-medium border transition-all ${
                            variant.isCurrent
                              ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] border-[hsl(43,78%,52%)]"
                              : "bg-transparent border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.1)]"
                          }`}
                        >
                          {variant.sizeLabel}
                        </Link>
                      ))}
                    </div>
                    {product.dimensions && (
                      <div className="mt-2 text-white/30 text-xs font-mono">{product.dimensions}</div>
                    )}
                  </div>
                )}

                {/* Rating Summary */}
                {avgRating !== null && avgRating !== undefined && reviews.length > 0 && (
                  <div className="flex items-center gap-3 mb-4" data-testid="product-rating-summary">
                    <StarRating rating={Math.round(avgRating)} size="md" />
                    <span className="text-[hsl(43,78%,65%)] font-bold">{avgRating.toFixed(1)}</span>
                    <span className="text-white/40 text-sm">({reviews.length} {reviews.length === 1 ? "review" : "reviews"})</span>
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="flex items-center gap-3 py-4 border-y border-white/8">
                <Tag className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                <span className="text-[hsl(43,78%,65%)] text-xl font-bold" data-testid="text-product-price">{price}</span>
                <span className="text-white/30 text-sm">AUD + GST | POA for custom configs</span>
              </div>

              {/* Quick Specs */}
              <div className="grid grid-cols-1 gap-3">
                {product.dimensions && (
                  <div className="flex items-start gap-3">
                    <Ruler className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Dimensions</div>
                      <div className="text-white text-sm font-mono" data-testid="text-product-dimensions">{product.dimensions}</div>
                    </div>
                  </div>
                )}
                {product.materials && (
                  <div className="flex items-start gap-3">
                    <Layers className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Materials</div>
                      <div className="text-white/80 text-sm" data-testid="text-product-materials">{product.materials}</div>
                    </div>
                  </div>
                )}
                {product.colors && product.colors.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Palette className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Colour Options</div>
                      <div className="flex flex-wrap gap-1.5" data-testid="product-colors">
                        {product.colors.map(c => (
                          <span key={c} className="text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.15)] text-white/60 px-2 py-0.5 rounded">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Lead Time</div>
                    <div className="text-white/80 text-sm">Standard 4–6 weeks | Custom 8–14 weeks</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Warranty</div>
                    <div className="text-white/80 text-sm">6-Year Manufacturer Warranty</div>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2" data-testid="product-ctas">
                <Button asChild className="flex-1 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] hover:bg-[hsl(43,78%,60%)] font-bold" data-testid="button-request-quote">
                  <Link href={`/send-us-your-quote?sku=${product.sku}&name=${encodeURIComponent(product.product_name)}`}>
                    <FileText className="mr-2 w-4 h-4" /> Request Quote
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)]" data-testid="button-office-plan">
                  <Link href="/upload-your-floor-plan">
                    <Cpu className="mr-2 w-4 h-4" /> Add to Office Plan
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 border-white/10 text-white/60 hover:bg-white/5 hover:text-white" data-testid="button-specialist">
                  <Link href="/contact">
                    <Phone className="mr-2 w-4 h-4" /> Talk to a Specialist
                  </Link>
                </Button>
              </div>

              {/* Collection */}
              <div className="pt-2 border-t border-white/5 text-xs text-white/30">
                Collection: <span className="text-white/50">{collectionName}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Body Content */}
        <section className="max-w-7xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* Left column — Description + Specs + Reviews */}
            <div className="lg:col-span-2 flex flex-col gap-10">

              {/* Description */}
              <div className="luxury-card rounded-lg p-8" data-testid="product-description">
                <h2 className="font-serif font-bold text-white text-2xl mb-5">About This Product</h2>
                <p className="text-white/65 leading-relaxed text-base">{description}</p>

                {product.features && product.features.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-[hsl(43,78%,52%)] text-sm font-semibold uppercase tracking-wider mb-4">Key Features</h3>
                    <ul className="flex flex-col gap-2.5">
                      {product.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-white/65 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Specifications */}
              <div className="luxury-card rounded-lg p-8" data-testid="product-specifications">
                <h2 className="font-serif font-bold text-white text-2xl mb-6">Technical Specifications</h2>
                <div className="divide-y divide-white/5">
                  {[
                    { label: "Product Name", value: product.product_name },
                    { label: "SKU", value: product.sku },
                    { label: "Series / Collection", value: getSeriesDisplayName(product.series) },
                    { label: "Category", value: product.category },
                    product.dimensions && { label: "Dimensions", value: product.dimensions },
                    product.materials && { label: "Materials & Construction", value: product.materials },
                    product.colors?.length ? { label: "Available Finishes", value: product.colors.join(", ") } : null,
                    { label: "Lead Time", value: "4–6 weeks standard | 8–14 weeks custom" },
                    { label: "Warranty", value: "6 years — commercial use" },
                    { label: "Compliance", value: "ISO 9001:2015 certified production" },
                    { label: "Shipping", value: "Nationwide Australia — Brisbane, Sydney, Melbourne & regional" },
                  ].filter(Boolean).map((row: any) => (
                    <div key={row.label} className="flex flex-col sm:flex-row sm:items-center gap-1 py-3.5">
                      <div className="text-white/40 text-sm w-full sm:w-48 flex-shrink-0">{row.label}</div>
                      <div className="text-white/80 text-sm font-medium" data-testid={`spec-${row.label.toLowerCase().replace(/\s+/g, "-")}`}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              <div className="luxury-card rounded-lg p-8" id="reviews" data-testid="product-reviews">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif font-bold text-white text-2xl">Client Reviews</h2>
                  {avgRating !== null && avgRating !== undefined && reviews.length > 0 && (
                    <div className="flex flex-col items-end">
                      <div className="text-[hsl(43,78%,52%)] text-3xl font-bold">{avgRating.toFixed(1)}</div>
                      <StarRating rating={Math.round(avgRating)} size="sm" />
                      <div className="text-white/30 text-xs mt-0.5">{reviews.length} verified {reviews.length === 1 ? "review" : "reviews"}</div>
                    </div>
                  )}
                </div>

                {/* Review List */}
                {reviews.length === 0 ? (
                  <div className="text-center py-8 text-white/30">
                    <Award className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>No verified reviews yet. Be the first to share your experience.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 mb-8">
                    {reviews.map(review => (
                      <div key={review.id} className="border border-white/6 rounded-lg p-5" data-testid={`review-${review.id}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-white font-semibold text-sm">{review.reviewerName}</div>
                            {(review.reviewerRole || review.reviewerCompany) && (
                              <div className="text-white/40 text-xs mt-0.5">
                                {[review.reviewerRole, review.reviewerCompany].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                          <StarRating rating={review.rating} size="sm" />
                        </div>
                        {review.title && <div className="text-white/80 font-semibold text-sm mb-1">{review.title}</div>}
                        <p className="text-white/55 text-sm leading-relaxed">{review.body}</p>
                        <div className="text-white/25 text-xs mt-3">
                          {new Date(review.createdAt).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Review Form */}
                <div className="border-t border-white/8 pt-8">
                  <h3 className="font-serif font-semibold text-white text-xl mb-5">Share Your Experience</h3>
                  {reviewSubmitted ? (
                    <div className="flex items-center gap-3 text-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)] rounded-lg p-4">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm">Your review has been submitted and is pending moderation. Thank you for your feedback.</p>
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(d => submitReview.mutate(d))} className="flex flex-col gap-4" data-testid="review-form">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField control={form.control} name="reviewerName" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white/60 text-sm">Your Name *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Jane Smith" className="bg-white/4 border-white/10 text-white placeholder:text-white/25" data-testid="input-reviewer-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="reviewerCompany" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white/60 text-sm">Company (optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Acme Corporation" className="bg-white/4 border-white/10 text-white placeholder:text-white/25" data-testid="input-reviewer-company" />
                              </FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="reviewerRole" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/60 text-sm">Your Role (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Office Manager, Procurement, Director..." className="bg-white/4 border-white/10 text-white placeholder:text-white/25" data-testid="input-reviewer-role" />
                            </FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="rating" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/60 text-sm">Your Rating *</FormLabel>
                            <FormControl>
                              <InteractiveStarRating value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="title" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/60 text-sm">Review Title (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Excellent quality for our boardroom..." className="bg-white/4 border-white/10 text-white placeholder:text-white/25" data-testid="input-review-title" />
                            </FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="body" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/60 text-sm">Your Review *</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Share your experience with this product — quality, delivery, suitability for your office environment..." className="bg-white/4 border-white/10 text-white placeholder:text-white/25 min-h-[120px]" data-testid="textarea-review-body" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" disabled={submitReview.isPending} className="self-start bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.25)]" data-testid="button-submit-review">
                          {submitReview.isPending ? "Submitting..." : "Submit Review"}
                        </Button>
                        <p className="text-white/25 text-xs">Reviews are moderated before publication. Only genuine client experiences are published.</p>
                      </form>
                    </Form>
                  )}
                </div>
              </div>
            </div>

            {/* Right column — sidebar */}
            <div className="flex flex-col gap-6">

              {/* Recommended Use */}
              <div className="luxury-card rounded-lg p-6" data-testid="recommended-use">
                <h3 className="font-serif font-semibold text-white text-lg mb-4">Recommended For</h3>
                <ul className="flex flex-col gap-2.5">
                  {recommendedUses.map(use => (
                    <li key={use} className="flex items-center gap-2.5 text-white/65 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                      {use}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Package Compatibility */}
              {packages.length > 0 && (
                <div className="luxury-card rounded-lg p-6" data-testid="package-compatibility">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                    <h3 className="font-serif font-semibold text-white text-lg">Office Package Compatibility</h3>
                  </div>
                  <p className="text-white/45 text-sm mb-4">This product is included in the following curated office packages:</p>
                  <div className="flex flex-col gap-3">
                    {packages.map(pkg => (
                      <div key={pkg.slug} className="flex items-center gap-2.5 bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-lg p-3">
                        <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                        <div>
                          <div className="text-white/80 text-sm font-medium">Included in {pkg.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collection & Provenance Card */}
              <div className="luxury-card rounded-lg p-6" data-testid="supplier-info">
                <h3 className="font-serif font-semibold text-white text-lg mb-4">Collection & Provenance</h3>
                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Collection</div>
                    <div className="text-white/75">{collectionName}</div>
                  </div>
                  <div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Manufacturing</div>
                    <div className="text-white/75">ISO 9001:2015 &amp; ISO 14001:2015 Certified Facilities</div>
                  </div>
                  <div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Distribution</div>
                    <div className="text-white/75">Exclusive Australian distribution — The Corporate Desk</div>
                  </div>
                  <div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Warranty</div>
                    <div className="text-white/75">6 years — commercial use</div>
                  </div>
                </div>
              </div>

              {/* Contact CTA */}
              <div className="luxury-card rounded-lg p-6 border border-[rgba(201,168,76,0.15)]">
                <h3 className="font-serif font-semibold text-white text-lg mb-2">Need Expert Advice?</h3>
                <p className="text-white/50 text-sm mb-4">Our commercial furniture specialists can help you specify the right product, quantity, and finish for your project.</p>
                <Button asChild className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] hover:bg-[hsl(43,78%,60%)] font-bold" data-testid="button-specialist-sidebar">
                  <Link href="/contact">
                    <Phone className="mr-2 w-4 h-4" /> Speak to a Specialist
                  </Link>
                </Button>
                <div className="text-center text-white/30 text-xs mt-3">1300 977 607 · Mon–Fri 8am–5pm AEST</div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-16" data-testid="related-products">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif font-bold text-white text-2xl">From the {product.series} Collection</h2>
                <Link href={`/products?series=${encodeURIComponent(product.series)}`} className="text-[hsl(43,78%,52%)] text-sm flex items-center gap-1 hover:text-[hsl(43,78%,65%)] transition-colors">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relatedProducts.map(rp => <RelatedProductCard key={rp.sku} product={rp} />)}
              </div>
            </div>
          )}

          {/* Back to products */}
          <div className="mt-12 text-center">
            <Button asChild variant="outline" className="border-white/10 text-white/50 hover:bg-white/5 hover:text-white" data-testid="button-back-products">
              <Link href="/products">
                <ChevronLeft className="mr-1.5 w-4 h-4" /> Back to All Products
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </Layout>
  );
}
