export const ROUTES = {
  home: "/",
  catalog: "/catalog",
  catalogCategory: (cat: string) => `/catalog/${cat}`,
  capability: "/capability",
  partners: "/partners",
  start: "/start",

  workplaceSolutions: "/workplace-solutions",
  aiOfficePlanner: "/ai-office-planner",
  officeWalkthrough: "/3d-office-walkthrough",
  freeLayoutPlan: "/free-layout-plan",
  quoteBuilder: "/quote-builder",
  requestQuote: "/request-a-quote",
  financeWorkspace: "/finance-your-workspace",
  tradeProcurement: "/trade-project-procurement",
  strategyCall: "/strategy-call",
  uploadFloorPlan: "/upload-your-floor-plan",

  about: "/about",
  contact: "/contact",
  caseStudies: "/case-studies",
  blog: "/blog",
  blogPost: (slug: string) => `/blog/${slug}`,
  testimonials: "/testimonials",

  thankYouLayoutPlan: "/thank-you-layout-plan",
  thankYouQuote: "/thank-you-quote",
  thankYouStrategy: "/thank-you-strategy",
} as const;

export const SERVICE_NAV = [
  { label: "Workplace Solutions", href: ROUTES.workplaceSolutions },
  { label: "AI Office Planner", href: ROUTES.aiOfficePlanner },
  { label: "3D Office Walkthrough", href: ROUTES.officeWalkthrough },
  { label: "Free Layout Plan", href: ROUTES.freeLayoutPlan },
  { label: "Quote Builder", href: ROUTES.quoteBuilder },
  { label: "Request a Quote", href: ROUTES.requestQuote },
  { label: "Finance Your Workspace", href: ROUTES.financeWorkspace },
  { label: "Trade & Project Procurement", href: ROUTES.tradeProcurement },
  { label: "Strategy Call", href: ROUTES.strategyCall },
];

export const PRODUCT_NAV = [
  { label: "Executive Desks", href: ROUTES.catalogCategory("executive-desks") },
  { label: "Manager Desks", href: ROUTES.catalogCategory("manager-desks") },
  { label: "Boardroom Tables", href: ROUTES.catalogCategory("boardroom-tables") },
  { label: "Reception Desks", href: ROUTES.catalogCategory("reception-desks") },
  { label: "Office Seating", href: ROUTES.catalogCategory("office-seating") },
  { label: "Workstations", href: ROUTES.catalogCategory("workstations") },
  { label: "Storage & Cabinets", href: ROUTES.catalogCategory("storage-cabinets") },
  { label: "Office Pods", href: ROUTES.catalogCategory("office-pods") },
];

export const COMPANY_NAV = [
  { label: "Case Studies", href: ROUTES.caseStudies },
  { label: "Blog", href: ROUTES.blog },
  { label: "About Us", href: ROUTES.about },
  { label: "Contact", href: ROUTES.contact },
];
