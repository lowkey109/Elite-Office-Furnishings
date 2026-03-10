import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { ArrowRight, Filter } from "lucide-react";

const categories = ["All", "Executive Desks", "Manager Desks", "Boardroom Tables", "Reception Desks", "Office Seating", "Workstations", "Storage", "Office Pods"];

const products = [
  {
    name: "Luxury Modern Office Manager's Desk – Breeze Series",
    code: "LY-QF-01A",
    category: "Manager Desks",
    series: "Breeze Series",
    image: "/images/category-desks.png",
    description: "A statement piece for senior managers. Features premium wood veneer surfaces, integrated cable management, and coordinated storage unit.",
    sizes: ["1600 × 800", "1800 × 900", "2000 × 1000"],
  },
  {
    name: "Modern Manager's Office Desk – Minimalist Design",
    code: "LY-MD-8019",
    category: "Manager Desks",
    series: null,
    image: "/images/category-desks.png",
    description: "Clean lines, intelligent storage, and premium finishes define this highly functional manager's desk.",
    sizes: ["1600 × 800", "1800 × 900"],
  },
  {
    name: "Modern Office Desk For Executives – Minimalist Design",
    code: "LY-ED-B09",
    category: "Executive Desks",
    series: null,
    image: "/images/category-desks.png",
    description: "An executive desk designed to command authority. Premium materials, expansive workspace, and sophisticated styling.",
    sizes: ["2000 × 1000", "2200 × 1100"],
  },
  {
    name: "Luxury Executive Office Desk – Aimu Series",
    code: "LY-AM-01",
    category: "Executive Desks",
    series: "Aimu Series",
    image: "/images/category-desks.png",
    description: "The pinnacle of executive desk design. Part of our coordinated Aimu Series for a completely unified office look.",
    sizes: ["2000 × 1000", "2200 × 1100", "2400 × 1200"],
  },
  {
    name: "Spacious Professional Office Conference Table",
    code: "LY-MG-06",
    category: "Boardroom Tables",
    series: null,
    image: "/images/category-boardroom.png",
    description: "Seats up to 16 people. Designed for serious business. Premium veneer top with powder-coated steel base.",
    sizes: ["3000 × 1200", "3600 × 1200", "4200 × 1300"],
  },
  {
    name: "Modern Elegant Office Boardroom Table",
    code: "LY-BT-H-05",
    category: "Boardroom Tables",
    series: null,
    image: "/images/category-boardroom.png",
    description: "Where bold design meets practical function. Cable management trunking and premium finish options.",
    sizes: ["2400 × 1100", "3000 × 1200", "3600 × 1200"],
  },
  {
    name: "Premium Reception Counter with Feature Wall",
    code: "LY-RC-01",
    category: "Reception Desks",
    series: null,
    image: "/images/category-reception.png",
    description: "Make an unforgettable first impression. Full-height reception counter with integrated lighting options.",
    sizes: ["Custom to specification"],
  },
  {
    name: "Ergonomic Executive Task Chair",
    code: "LY-CH-E01",
    category: "Office Seating",
    series: null,
    image: "/images/category-seating.png",
    description: "Full lumbar support, adjustable armrests, premium mesh or leather upholstery. AFRDI certified.",
    sizes: ["Standard", "High-Back", "Extra-Wide"],
  },
  {
    name: "Hot Desk Workstation – Open Plan",
    code: "LY-WS-04",
    category: "Workstations",
    series: null,
    image: "/images/category-fitout.png",
    description: "Configurable open-plan workstation pods. Available in 4, 6, and 8-person configurations with privacy screens.",
    sizes: ["4-person", "6-person", "8-person"],
  },
  {
    name: "Premium Mobile Storage Pedestal",
    code: "LY-ST-P01",
    category: "Storage",
    series: null,
    image: "/images/category-fitout.png",
    description: "Mobile 3-drawer pedestal with soft-close drawers. Available in all desk-coordinated finishes.",
    sizes: ["Standard 3-drawer", "High 4-drawer"],
  },
  {
    name: "Acoustic Office Pod – Single",
    code: "LY-OP-S1",
    category: "Office Pods",
    series: null,
    image: "/images/category-fitout.png",
    description: "Create private focus zones within open-plan offices. Acoustic rated, ventilated, with integrated power.",
    sizes: ["Single (1 person)", "Double (2 person)"],
  },
  {
    name: "Coordinated Total Office Package – Breeze Series",
    code: "LY-QF-PKG",
    category: "Executive Desks",
    series: "Breeze Series",
    image: "/images/category-fitout.png",
    description: "Complete office furniture package with matching executive desk, credenza, boardroom table, and visitor chairs — all colour-coordinated.",
    sizes: ["Custom configuration"],
  },
];

export default function Products() {
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    document.title = "Office Furniture Products — Desks, Chairs, Boardrooms | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "Browse premium commercial office furniture: executive desks, boardroom tables, ergonomic seating, workstations, reception areas, storage and office pods. Aimu and Breeze series.");
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);

  const filtered = activeCategory === "All"
    ? products
    : products.filter(p => p.category === activeCategory);

  return (
    <Layout>
      <section className="relative pt-28 sm:pt-40 pb-16 sm:pb-20 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
            Product Collection
          </Badge>
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-4">
            Our Furniture<br />
            <span className="gold-text">Collections</span>
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-white/55 max-w-xl leading-relaxed">
            Meticulously curated furniture for the modern corporate environment. Every piece designed for those who demand excellence.
          </p>
        </div>
      </section>

      <section className="sticky top-16 sm:top-20 z-30 bg-[hsl(220,20%,7%)]/97 backdrop-blur-md border-b border-[rgba(201,168,76,0.1)] py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto touch-scroll pb-1 flex-nowrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
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
          <div className="mb-8 flex items-center justify-between">
            <p className="text-white/40 text-sm">
              Showing <span className="text-white">{filtered.length}</span> products
            </p>
            <Badge className="bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]">
              Quote available for all products
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <div
                key={product.code}
                className="luxury-card rounded-md overflow-hidden group hover-elevate"
                data-testid={`card-product-${product.code.toLowerCase()}`}
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,18%,10%)]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {product.series && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-[rgba(201,168,76,0.8)] text-[hsl(220,20%,6%)] text-xs font-semibold">
                        {product.series}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="text-xs text-[hsl(43,78%,52%)] font-mono mb-2 tracking-wider">{product.code}</div>
                  <h3 className="font-serif font-bold text-white text-base leading-snug mb-3">{product.name}</h3>
                  <p className="text-white/45 text-sm leading-relaxed mb-4 line-clamp-2">{product.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {product.sizes.map(size => (
                      <span key={size} className="text-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.12)] text-white/50 px-2 py-0.5 rounded">
                        {size}
                      </span>
                    ))}
                  </div>
                  <Button asChild size="sm" className="w-full bg-transparent border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] font-medium" data-testid={`button-product-quote-${product.code.toLowerCase()}`}>
                    <Link href="/send-us-your-quote">
                      Request Quote <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[hsl(220,20%,5%)] border-t border-[rgba(201,168,76,0.1)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
            Can't Find What You're Looking For?
          </h2>
          <p className="text-white/55 mb-8 leading-relaxed">
            Our catalogue contains hundreds of products. Contact us with your specifications and we'll find the perfect solution for your office.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-8" data-testid="button-products-cta-quote">
              <Link href="/send-us-your-quote">Send Us Your Quote <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] px-8" data-testid="button-products-cta-contact">
              <Link href="/contact">Speak to a Specialist</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
