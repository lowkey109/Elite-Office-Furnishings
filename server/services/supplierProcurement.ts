import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// ─── Furniture categories by headcount and layout ────────────────────────────

const ZONE_RATIOS: Record<string, number> = {
  "Meeting Tables (6-pax)": 0.15,   // every 6–7 staff get 1 meeting table
  "Meeting Chairs": 0.6,            // ~60% of headcount as meeting seating
  "Boardroom Table (12-pax)": 0.025,// 1 boardroom per ~40 staff
  "Boardroom Chairs": 0.2,          // 20% of headcount as boardroom seating
  "Breakout Furniture (Lounge)": 0.25, // 25% headcount in breakout seating
  "Visitor Chairs": 0.15,           // reception + visitor areas
};

export interface FurnitureItem {
  category: string;
  quantity: number;
  notes?: string;
}

export function autoGenerateFurnitureList(headcount: number, hasReception?: boolean, hasBoardroom?: boolean): FurnitureItem[] {
  const items: FurnitureItem[] = [
    { category: "Workstations", quantity: headcount, notes: "1 per staff member" },
    { category: "Ergonomic Task Chairs", quantity: headcount, notes: "1 per workstation" },
    {
      category: "Meeting Tables",
      quantity: Math.max(1, Math.round(headcount * ZONE_RATIOS["Meeting Tables (6-pax)"])),
      notes: "6-person meeting tables",
    },
    {
      category: "Meeting Chairs",
      quantity: Math.round(headcount * ZONE_RATIOS["Meeting Chairs"]),
      notes: "For meeting rooms",
    },
    {
      category: "Breakout / Lounge Seating",
      quantity: Math.max(2, Math.round(headcount * ZONE_RATIOS["Breakout Furniture (Lounge)"])),
      notes: "Collaborative and breakout zones",
    },
    {
      category: "Storage Units",
      quantity: Math.max(2, Math.round(headcount / 5)),
      notes: "Pedestals, lockers, and shelving",
    },
  ];

  if (hasBoardroom !== false) {
    items.push({
      category: "Boardroom Table",
      quantity: Math.max(1, Math.round(headcount * ZONE_RATIOS["Boardroom Table (12-pax)"])),
      notes: "12-person boardroom configuration",
    });
    items.push({
      category: "Boardroom Chairs",
      quantity: Math.max(12, Math.round(headcount * ZONE_RATIOS["Boardroom Chairs"])),
      notes: "Executive boardroom seating",
    });
  }

  if (hasReception !== false) {
    items.push({ category: "Reception Desk", quantity: 1, notes: "Front of house" });
    items.push({
      category: "Visitor / Reception Chairs",
      quantity: Math.max(2, Math.round(headcount * ZONE_RATIOS["Visitor Chairs"])),
      notes: "Reception and waiting area",
    });
  }

  return items;
}

// ─── Supplier capability matrix ───────────────────────────────────────────────
// Reflects actual supplier routing rules from supplierDatabase.json

export interface SupplierMatch {
  supplierName: string;
  supplierId: string;
  contactName?: string;
  categories: string[];
  reason: string;
  routingNote?: string;
}

const CATEGORY_ROUTING: Record<string, { supplierId: string; name: string; contact?: string; note?: string }> = {
  "Ergonomic Task Chairs":          { supplierId: "BOKE", name: "Boke Furniture", contact: "Boke Team", note: "Seating specialist — do NOT send desk or table requests here" },
  "Meeting Chairs":                 { supplierId: "BOKE", name: "Boke Furniture", contact: "Boke Team" },
  "Boardroom Chairs":               { supplierId: "BOKE", name: "Boke Furniture", contact: "Boke Team" },
  "Visitor / Reception Chairs":     { supplierId: "BOKE", name: "Boke Furniture", contact: "Boke Team" },
  "Breakout / Lounge Seating":      { supplierId: "BOKE", name: "Boke Furniture", contact: "Boke Team" },
  "Workstations":                   { supplierId: "MEIYI", name: "Guangzhou Meiyi Furniture", contact: "Asya" },
  "Meeting Tables":                 { supplierId: "MEIYI", name: "Guangzhou Meiyi Furniture", contact: "Asya" },
  "Storage Units":                  { supplierId: "MEIYI", name: "Guangzhou Meiyi Furniture", contact: "Asya" },
  "Reception Desk":                 { supplierId: "XITIAN", name: "Xitian Furniture", contact: "Ruby", note: "Custom/executive pieces — WhatsApp number pending confirmation" },
  "Boardroom Table":                { supplierId: "FSZ", name: "Feisenzhuo Furniture", contact: "FSZ Team" },
  "Executive Desks":                { supplierId: "FSZ", name: "Feisenzhuo Furniture", contact: "FSZ Team" },
};

export function routeFurnitureToSuppliers(items: FurnitureItem[]): SupplierMatch[] {
  const bySupplier: Record<string, SupplierMatch> = {};

  for (const item of items) {
    const routing = CATEGORY_ROUTING[item.category] ?? {
      supplierId: "GENERAL",
      name: "General Supplier",
      contact: "Denny",
      note: "Route through Denny for sourcing support",
    };

    if (!bySupplier[routing.supplierId]) {
      bySupplier[routing.supplierId] = {
        supplierName: routing.name,
        supplierId: routing.supplierId,
        contactName: routing.contact,
        categories: [],
        reason: `Specialises in: ${item.category}`,
        routingNote: routing.note,
      };
    }
    bySupplier[routing.supplierId].categories.push(item.category);
  }

  return Object.values(bySupplier);
}

// ─── RFQ email generator ─────────────────────────────────────────────────────

export interface RfqEmailDraft {
  supplierName: string;
  contactName: string;
  to: string | null;
  subject: string;
  body: string;
  categories: string[];
}

export function generateRfqEmail(
  supplierMatch: SupplierMatch,
  items: FurnitureItem[],
  project: {
    projectName: string;
    clientCompany?: string | null;
    city?: string | null;
    timeline?: string | null;
    headcount?: number | null;
  }
): RfqEmailDraft {
  const relevantItems = items.filter(i => supplierMatch.categories.includes(i.category));

  const itemList = relevantItems
    .map(i => `  • ${i.quantity}x ${i.category}${i.notes ? ` (${i.notes})` : ""}`)
    .join("\n");

  const body = `Hi ${supplierMatch.contactName ?? supplierMatch.supplierName},

We are currently planning a workspace project and would like to request pricing and availability for the following items.

Project Details:
  Project: ${project.projectName}
  Client: ${project.clientCompany ?? "Confidential"}
  Location: ${project.city ?? "TBD"}
  Staff Count: ${project.headcount ?? "TBD"}
  Required Timeline: ${project.timeline ?? "TBD"}

Furniture Required:
${itemList}

Could you please provide:
  1. Unit pricing (FOB and landed cost if possible)
  2. Lead times for production and delivery to Australia
  3. Stock availability (or lead time to manufacture)
  4. Any product alternatives or upgrades worth considering
  5. MOQ requirements (if applicable)

Please reply with your best pricing and we can discuss further.

Thank you,
The Corporate Desk Team
thecorporatedesk.com.au`;

  return {
    supplierName: supplierMatch.supplierName,
    contactName: supplierMatch.contactName ?? supplierMatch.supplierName,
    to: null, // email addresses are in supplier DB
    subject: `RFQ – ${project.projectName}${project.city ? ` (${project.city})` : ""}`,
    body,
    categories: supplierMatch.categories,
  };
}

// ─── Supplier recommendation scorer ──────────────────────────────────────────

export interface SupplierScore {
  supplierId: string;
  supplierName: string;
  totalScore: number;
  breakdown: {
    pricing: number;
    delivery: number;
    reliability: number;
    quality: number;
    responsiveness: number;
  };
  recommendation: "preferred" | "acceptable" | "avoid";
}

export function computeSupplierScore(profile: {
  pricingScore?: number | null;
  deliveryScore?: number | null;
  reliabilityScore?: number | null;
  qualityScore?: number | null;
  responsivenessScore?: number | null;
}): number {
  // Weighted average: reliability (30%), quality (25%), pricing (20%), delivery (15%), responsiveness (10%)
  const p = profile.pricingScore ?? 3;
  const d = profile.deliveryScore ?? 3;
  const r = profile.reliabilityScore ?? 3;
  const q = profile.qualityScore ?? 3;
  const rs = profile.responsivenessScore ?? 3;
  return Math.round((r * 0.30 + q * 0.25 + p * 0.20 + d * 0.15 + rs * 0.10) * 20); // 0–100
}
