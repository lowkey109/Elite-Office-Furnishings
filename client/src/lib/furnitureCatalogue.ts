export interface CatalogueProduct {
  sku: string;
  name: string;
  category: string;
  series: string | null;
  description: string;
  priceLabel: string;
  priceFrom: number | null;
  image: string;
}

export const CATALOGUE: CatalogueProduct[] = [
  {
    sku: "LY-QF-01A",
    name: "Luxury Modern Office Manager's Desk – Breeze Series",
    category: "Manager Desks",
    series: "Breeze Series",
    description: "Premium wood veneer surfaces, integrated cable management, and coordinated storage unit.",
    priceLabel: "From $2,890",
    priceFrom: 2890,
    image: "/images/category-desks.png",
  },
  {
    sku: "LY-MD-8019",
    name: "Modern Manager's Office Desk – Minimalist Design",
    category: "Manager Desks",
    series: null,
    description: "Clean lines, intelligent storage, and premium finishes.",
    priceLabel: "From $1,990",
    priceFrom: 1990,
    image: "/images/category-desks.png",
  },
  {
    sku: "LY-ED-B09",
    name: "Modern Office Desk For Executives – Minimalist Design",
    category: "Executive Desks",
    series: null,
    description: "An executive desk designed to command authority. Premium materials, expansive workspace.",
    priceLabel: "From $3,490",
    priceFrom: 3490,
    image: "/images/category-desks.png",
  },
  {
    sku: "LY-AM-01",
    name: "Luxury Executive Office Desk – Aimu Series",
    category: "Executive Desks",
    series: "Aimu Series",
    description: "The pinnacle of executive desk design. Part of our coordinated Aimu Series.",
    priceLabel: "From $4,999",
    priceFrom: 4999,
    image: "/images/category-desks.png",
  },
  {
    sku: "A-522-1",
    name: "Executive Office Desk – Premium",
    category: "Executive Desks",
    series: "Aimu Series",
    description: "Premium veneer top, integrated cable spine, and coordinating credenza unit.",
    priceLabel: "$4,999",
    priceFrom: 4999,
    image: "/images/category-desks.png",
  },
  {
    sku: "LY-MG-06",
    name: "Spacious Professional Office Conference Table",
    category: "Boardroom Tables",
    series: null,
    description: "Seats up to 16 people. Premium veneer top with powder-coated steel base.",
    priceLabel: "From $5,490",
    priceFrom: 5490,
    image: "/images/category-boardroom.png",
  },
  {
    sku: "LY-BT-H-05",
    name: "Modern Elegant Office Boardroom Table",
    category: "Boardroom Tables",
    series: null,
    description: "Bold design meets practical function. Cable management trunking and premium finish options.",
    priceLabel: "From $3,990",
    priceFrom: 3990,
    image: "/images/category-boardroom.png",
  },
  {
    sku: "LY-RC-01",
    name: "Premium Reception Counter with Feature Wall",
    category: "Reception Desks",
    series: null,
    description: "Full-height reception counter with integrated lighting options.",
    priceLabel: "POA",
    priceFrom: null,
    image: "/images/category-reception.png",
  },
  {
    sku: "LY-CH-E01",
    name: "Ergonomic Executive Task Chair",
    category: "Office Seating",
    series: null,
    description: "Full lumbar support, adjustable armrests, premium mesh or leather upholstery. AFRDI certified.",
    priceLabel: "From $890",
    priceFrom: 890,
    image: "/images/category-seating.png",
  },
  {
    sku: "LY-WS-04",
    name: "Hot Desk Workstation – Open Plan",
    category: "Workstations",
    series: null,
    description: "Configurable open-plan workstation pods. Available in 4, 6, and 8-person configurations with privacy screens.",
    priceLabel: "From $590 pp",
    priceFrom: 590,
    image: "/images/category-fitout.png",
  },
  {
    sku: "LY-ST-P01",
    name: "Premium Mobile Storage Pedestal",
    category: "Storage",
    series: null,
    description: "Mobile 3-drawer pedestal with soft-close drawers. Available in all desk-coordinated finishes.",
    priceLabel: "From $490",
    priceFrom: 490,
    image: "/images/category-fitout.png",
  },
  {
    sku: "LY-OP-S1",
    name: "Acoustic Office Pod – Single",
    category: "Office Pods",
    series: null,
    description: "Create private focus zones within open-plan offices. Acoustic rated, ventilated, with integrated power.",
    priceLabel: "From $4,200",
    priceFrom: 4200,
    image: "/images/category-fitout.png",
  },
  {
    sku: "LY-QF-PKG",
    name: "Coordinated Total Office Package – Breeze Series",
    category: "Executive Desks",
    series: "Breeze Series",
    description: "Complete office furniture package: executive desk, credenza, boardroom table, and visitor chairs — colour-coordinated.",
    priceLabel: "POA",
    priceFrom: null,
    image: "/images/category-fitout.png",
  },
];

export const CATALOGUE_BY_CATEGORY: Record<string, CatalogueProduct[]> = CATALOGUE.reduce(
  (acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  },
  {} as Record<string, CatalogueProduct[]>
);

export function getProductBySku(sku: string): CatalogueProduct | undefined {
  return CATALOGUE.find(p => p.sku === sku);
}

export function getProductsByCategory(category: string): CatalogueProduct[] {
  return CATALOGUE_BY_CATEGORY[category] ?? [];
}

export const CATALOGUE_SUMMARY_FOR_AI = CATALOGUE.map(
  p => `${p.sku} | ${p.category} | ${p.name} | ${p.priceLabel}`
).join("\n");
