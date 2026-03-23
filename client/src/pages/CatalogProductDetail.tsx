import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import {
  ChevronLeft, Tag, Ruler, Layers, Palette, Shield, Award, CheckCircle2,
  Package, MessageSquare, Send, X, ChevronRight, Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────
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

// ─── Enquiry Modal ──────────────────────────────────────────────────────────
function EnquiryModal({ product, onClose }: { product: SupplierProduct; onClose: () => void }) {
  const { toast } = useToast();
  const name_ = product.name || product.product_name || "";
  const productUrl = typeof window !== "undefined" ? window.location.href : "";

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    message: `I'm interested in the ${name_} (${product.sku}). Please send more information, pricing, lead time, and finish options.`,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          message: `${form.message}${form.company ? `\n\nCompany: ${form.company}` : ""}\n\nProduct: ${name_}\nSKU: ${product.sku}\nSeries: ${product.series || "—"}\nURL: ${productUrl}`,
          source: "catalog-product-enquiry",
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        toast({ title: "Error", description: "Could not send enquiry. Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full md:max-w-lg bg-[#0e0e0f] border border-white/10 rounded-t-3xl md:rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#b8974a]/70 mb-0.5">Enquire</p>
            <h3 className="text-base font-medium text-white line-clamp-1">{name_}</h3>
            <p className="text-[10px] text-white/35 font-mono mt-0.5">{product.sku}</p>
          </div>
          <button
            onClick={onClose}
            data-testid="button-close-enquiry"
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#b8974a]/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-[#b8974a]" />
            </div>
            <h4 className="text-white font-medium mb-2">Enquiry Sent</h4>
            <p className="text-white/45 text-sm">Our team will be in touch within one business day.</p>
            <button
              onClick={onClose}
              className="mt-6 rounded-full border border-white/15 px-6 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1">Name *</label>
                <input
                  data-testid="input-enquiry-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#b8974a]/40 transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1">Company</label>
                <input
                  data-testid="input-enquiry-company"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#b8974a]/40 transition-colors"
                  placeholder="Company name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1">Email *</label>
                <input
                  data-testid="input-enquiry-email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#b8974a]/40 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1">Phone</label>
                <input
                  data-testid="input-enquiry-phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#b8974a]/40 transition-colors"
                  placeholder="04xx xxx xxx"
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-1">Message</label>
              <textarea
                data-testid="input-enquiry-message"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#b8974a]/40 transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              data-testid="button-submit-enquiry"
              disabled={submitting || !form.name || !form.email}
              className="w-full rounded-xl bg-[#b8974a] hover:bg-[#cfa955] disabled:opacity-50 py-3.5 text-sm font-semibold text-[#080808] transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-[#080808]/40 border-t-[#080808] rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? "Sending…" : "Send Enquiry"}
            </button>
            <p className="text-center text-[9px] text-white/25">
              We respond within one business day · No spam · No commitments
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Warranty Badges ────────────────────────────────────────────────────────
const BADGES = [
  { icon: Shield, label: "6-Year Warranty" },
  { icon: Award, label: "AFRDI Certified" },
  { icon: CheckCircle2, label: "White-Glove Delivery" },
  { icon: Package, label: "Made to Order" },
];

// ─── Related Card (mini) ────────────────────────────────────────────────────
function RelatedCard({ product }: { product: SupplierProduct }) {
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = product.imageUrl || product.image || "";
  const name = product.name || product.product_name || "";
  return (
    <Link
      href={`/catalog/product/${product.sku}`}
      data-testid={`card-related-${product.sku}`}
      className="group block rounded-xl border border-white/8 bg-[#0b0b0c] hover:border-[#b8974a]/40 overflow-hidden transition-all"
    >
      <div className="bg-[#111] aspect-[4/3] overflow-hidden relative">
        {!imgErr && imgSrc ? (
          <img
            src={imgSrc}
            alt={name}
            className="absolute inset-0 h-full w-full object-contain p-2 group-hover:scale-[1.04] transition-transform duration-300"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/10 text-[9px] font-mono">{product.sku}</div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[9px] text-[#b8974a]/60 uppercase tracking-wider mb-0.5 truncate">{product.series}</p>
        <p className="text-[11px] text-white line-clamp-2 leading-snug">{name}</p>
        {product.price_label && (
          <p className="text-[10px] text-[#b8974a] mt-1 font-semibold">{product.price_label}</p>
        )}
      </div>
    </Link>
  );
}

// ─── Main Product Detail ─────────────────────────────────────────────────────
export default function CatalogProductDetail() {
  const { sku } = useParams<{ sku: string }>();
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const { data: allProducts = [], isLoading } = useQuery<SupplierProduct[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const product = allProducts.find(p => p.sku === sku);

  const related = product
    ? allProducts.filter(p =>
        p.sku !== sku &&
        (p.series === product.series || p.category === product.category)
      ).slice(0, 6)
    : [];

  const imgSrc = product ? (product.imageUrl || product.image || "") : "";
  const name = product ? (product.name || product.product_name || "") : "";

  // ── SEO: title + JSON-LD product schema ────────────────────────────────
  useEffect(() => {
    if (!product) return;
    const pName = name || product.sku;
    document.title = `${pName} | The Corporate Desk`;

    const setMeta = (prop: string, val: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${prop}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, prop); document.head.appendChild(el); }
      el.content = val;
    };
    const desc = product.description
      ? product.description.slice(0, 160)
      : `${pName} — premium commercial office furniture by The Corporate Desk. ${product.series ? `Part of the ${product.series} series.` : ""} ISO 9001 certified, 6-year warranty.`;
    setMeta("description", desc);
    setMeta("og:title", `${pName} | The Corporate Desk`, "property");
    setMeta("og:description", desc, "property");
    setMeta("og:url", `https://www.thecorporatedesk.com.au/catalog/product/${product.sku}`, "property");
    if (imgSrc) setMeta("og:image", imgSrc.startsWith("http") ? imgSrc : `https://www.thecorporatedesk.com.au${imgSrc}`, "property");

    const schemaId = "product-jsonld";
    document.getElementById(schemaId)?.remove();
    const script = document.createElement("script");
    script.id = schemaId;
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": pName,
      "sku": product.sku,
      "description": desc,
      "image": imgSrc ? (imgSrc.startsWith("http") ? imgSrc : `https://www.thecorporatedesk.com.au${imgSrc}`) : undefined,
      "brand": { "@type": "Brand", "name": "The Corporate Desk" },
      "category": product.category,
      ...(product.series ? { "productLine": product.series } : {}),
      "offers": {
        "@type": "Offer",
        "url": `https://www.thecorporatedesk.com.au/catalog/product/${product.sku}`,
        "priceCurrency": "AUD",
        ...(product.price_aud ? { "price": product.price_aud, "priceValidUntil": new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0] } : { "price": "0" }),
        "availability": "https://schema.org/InStock",
        "seller": { "@type": "Organization", "name": "The Corporate Desk", "url": "https://www.thecorporatedesk.com.au" },
      },
    });
    document.head.appendChild(script);

    return () => { document.getElementById(schemaId)?.remove(); };
  }, [product, name, imgSrc]);

  // ── Skeleton while loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#080808] text-white">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
            <div className="h-4 bg-white/5 rounded w-32 mb-8 animate-pulse" />
            <div className="grid md:grid-cols-2 gap-10">
              <div className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
              <div className="space-y-4">
                <div className="h-3 bg-white/5 rounded w-20 animate-pulse" />
                <div className="h-8 bg-white/5 rounded w-3/4 animate-pulse" />
                <div className="h-6 bg-white/5 rounded w-24 animate-pulse" />
                <div className="h-24 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── 404 ─────────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-white/30 text-sm mb-4">Product not found</p>
            <Link href="/catalog" className="text-[#b8974a] text-sm underline underline-offset-2">
              Return to Catalogue
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#080808] text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">

          {/* Back link */}
          <Link
            href={`/catalog/${encodeURIComponent(product.category)}`}
            data-testid="link-back-to-catalog"
            className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-8 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {product.category}
          </Link>

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-8 lg:gap-14 mb-14">

            {/* Image */}
            <div className="rounded-2xl bg-[#111] border border-white/8 overflow-hidden flex items-center justify-center"
              style={{ aspectRatio: "1/1" }}>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={`${name} — ${product.sku}`}
                  data-testid="img-product-hero"
                  className="w-full h-full object-contain p-8"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/15 text-sm font-mono">{product.sku}</div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col">
              {/* Breadcrumb meta */}
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-white/30 mb-3">
                <span>{product.category}</span>
                {product.series && (
                  <>
                    <ChevronRight className="w-2.5 h-2.5" />
                    <span className="text-[#b8974a]/60">{product.series}</span>
                  </>
                )}
              </div>

              <h1 data-testid="text-product-name" className="text-2xl md:text-3xl font-light tracking-wide text-white mb-2 leading-tight">
                {name}
              </h1>

              <p className="text-[10px] text-white/30 font-mono mb-4">SKU: {product.sku}</p>

              {/* Price */}
              {product.price_label && (
                <div className="flex items-center gap-2 mb-5">
                  <Tag className="w-4 h-4 text-[#b8974a]" />
                  <span data-testid="text-product-price" className="text-xl font-semibold text-[#b8974a]">
                    {product.price_label}
                  </span>
                  <span className="text-white/25 text-xs">AUD, ex GST</span>
                </div>
              )}

              {/* Description */}
              {product.description && (
                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  {product.description}
                </p>
              )}

              {/* Specs grid */}
              <div className="grid grid-cols-1 gap-3 mb-6">
                {product.dimensions && (
                  <div className="flex items-start gap-3 rounded-xl bg-white/3 border border-white/6 p-3.5">
                    <Ruler className="w-4 h-4 text-[#b8974a]/60 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Dimensions</p>
                      <p className="text-sm text-white">{product.dimensions}</p>
                    </div>
                  </div>
                )}
                {product.materials && (
                  <div className="flex items-start gap-3 rounded-xl bg-white/3 border border-white/6 p-3.5">
                    <Layers className="w-4 h-4 text-[#b8974a]/60 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Materials</p>
                      <p className="text-sm text-white">{product.materials}</p>
                    </div>
                  </div>
                )}
                {product.colors && product.colors.length > 0 && (
                  <div className="flex items-start gap-3 rounded-xl bg-white/3 border border-white/6 p-3.5">
                    <Palette className="w-4 h-4 text-[#b8974a]/60 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Finishes / Colourways</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {product.colors.map(c => (
                          <span key={c} className="text-[10px] rounded-full border border-white/10 px-2 py-0.5 text-white/60">{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {product.supplier && (
                  <div className="flex items-start gap-3 rounded-xl bg-white/3 border border-white/6 p-3.5">
                    <Package className="w-4 h-4 text-[#b8974a]/60 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Manufacturer</p>
                      <p className="text-sm text-white">{product.supplier}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                <button
                  data-testid="button-enquire-product"
                  onClick={() => setEnquiryOpen(true)}
                  className="flex-1 rounded-xl bg-[#b8974a] hover:bg-[#cfa955] py-4 text-sm font-semibold text-[#080808] transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Enquire About This Product
                </button>
                <Link
                  href="/catalog"
                  className="rounded-xl border border-white/12 px-5 py-4 text-sm text-white/50 hover:text-white hover:border-white/25 transition-colors flex items-center justify-center gap-2"
                >
                  View Catalogue
                </Link>
              </div>
            </div>
          </div>

          {/* ── Warranty Badges ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
            {BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-xl bg-white/3 border border-white/6 p-4 flex items-center gap-3">
                <Icon className="w-5 h-5 text-[#b8974a]/70 shrink-0" />
                <span className="text-xs text-white/55">{label}</span>
              </div>
            ))}
          </div>

          {/* ── Reviews Section ─────────────────────────────────────────── */}
          <div className="mb-14 border-t border-white/6 pt-10">
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-5 h-5 text-[#b8974a]/60" />
              <h2 className="text-xl font-light tracking-wide text-white">Reviews</h2>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/2 p-8 text-center">
              <p className="text-white/35 text-sm mb-2">No reviews yet for this product.</p>
              <p className="text-white/20 text-xs">
                Be the first to enquire — our team will follow up with full product information.
              </p>
              <button
                onClick={() => setEnquiryOpen(true)}
                data-testid="button-enquire-from-reviews"
                className="mt-5 rounded-full border border-[#b8974a]/30 px-6 py-2.5 text-xs text-[#b8974a]/80 hover:border-[#b8974a]/60 hover:text-[#b8974a] transition-colors"
              >
                Enquire About This Product
              </button>
            </div>
          </div>

          {/* ── Related Products ───────────────────────────────────────── */}
          {related.length > 0 && (
            <div className="mb-10 border-t border-white/6 pt-10">
              <h2 className="text-xl font-light tracking-wide text-white mb-6">
                {product.series ? `More from ${product.series}` : `More ${product.category}`}
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {related.map(p => <RelatedCard key={p.sku} product={p} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enquiry Modal */}
      {enquiryOpen && <EnquiryModal product={product} onClose={() => setEnquiryOpen(false)} />}
    </Layout>
  );
}
