import { useEffect } from "react";

const BASE_URL = "https://www.thecorporatedesk.au";
const DEFAULT_IMAGE = `${BASE_URL}/images/hero-office.png`;
const SITE_NAME = "The Corporate Desk";

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  schema?: object | object[];
  noIndex?: boolean;
  keywords?: string;
}

function setMeta(attr: string, attrValue: string, contentValue: string) {
  let el = document.querySelector(`meta[${attr}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, attrValue);
    document.head.appendChild(el);
  }
  el.content = contentValue;
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.href = href;
}

function setSchema(id: string, schema: object | object[]) {
  let el = document.querySelector(`script[data-schema-id="${id}"]`);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("data-schema-id", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(Array.isArray(schema) ? schema : [schema]);
}

function removeSchema(id: string) {
  document.querySelector(`script[data-schema-id="${id}"]`)?.remove();
}

export function useSEO({
  title,
  description,
  canonical,
  ogImage,
  ogType = "website",
  schema,
  noIndex = false,
  keywords,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalUrl = `${BASE_URL}${canonical ?? window.location.pathname.split("?")[0]}`;
    const image = ogImage ?? DEFAULT_IMAGE;
    const schemaId = "page-schema";

    document.title = fullTitle;

    setMeta("property", "og:title", fullTitle);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:image", image);
    setMeta("name", "robots", noIndex ? "noindex,nofollow" : "index,follow");

    setLink("canonical", canonicalUrl);

    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }

    if (keywords) {
      setMeta("name", "keywords", keywords);
    }

    if (schema) {
      setSchema(schemaId, schema);
    }

    return () => {
      if (schema) removeSchema(schemaId);
    };
  }, [title, description, canonical, ogImage, ogType, schema, noIndex, keywords]);
}

// ─── Breadcrumb helper ────────────────────────────────────────────────────────
export function buildBreadcrumbSchema(crumbs: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${BASE_URL}${c.url}`,
    })),
  };
}

// ─── Product schema helper ────────────────────────────────────────────────────
export function buildProductSchema(product: {
  name: string;
  description?: string;
  sku: string;
  imageUrl?: string;
  priceLabel?: string;
  category?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? `${product.name} — commercial office furniture available from The Corporate Desk Australia.`,
    sku: product.sku,
    image: product.imageUrl ? `${BASE_URL}${product.imageUrl}` : DEFAULT_IMAGE,
    category: product.category ?? "Office Furniture",
    brand: { "@type": "Brand", name: "The Corporate Desk" },
    offers: {
      "@type": "Offer",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "The Corporate Desk" },
      priceSpecification: product.priceLabel
        ? { "@type": "PriceSpecification", priceCurrency: "AUD", description: product.priceLabel }
        : undefined,
    },
  };
}
