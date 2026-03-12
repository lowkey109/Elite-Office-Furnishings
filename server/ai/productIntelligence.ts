import fs from "fs";
import path from "path";

const PRICE_BANDS: Record<string, { band: string; sell: string; gm: string }> = {
  "Executive Desks":   { band: "premium–executive", sell: "$2,200–$8,500 AUD", gm: "30–45%" },
  "Manager Desks":     { band: "mid–premium",        sell: "$1,200–$2,800 AUD", gm: "28–38%" },
  "Boardroom Tables":  { band: "executive",           sell: "$3,500–$18,000 AUD", gm: "30–45%" },
  "Workstations":      { band: "entry–mid",           sell: "$800–$2,200 AUD", gm: "25–35%" },
  "Reception Desks":   { band: "mid–premium",         sell: "$1,800–$6,500 AUD", gm: "35–50%" },
  "Office Seating":    { band: "entry–premium",       sell: "$350–$1,800 AUD", gm: "40–55%" },
  "Lounge Seating":    { band: "mid–premium",         sell: "$800–$4,500 AUD", gm: "35–50%" },
  "Storage":           { band: "entry–mid",           sell: "$400–$1,800 AUD", gm: "20–30%" },
  "Storage & Filing":  { band: "entry–mid",           sell: "$350–$1,200 AUD", gm: "20–30%" },
  "Occasional Tables": { band: "entry–mid",           sell: "$300–$1,200 AUD", gm: "25–35%" },
};

const PAIRING_RULES: Record<string, string[]> = {
  "Executive Desks":   ["Office Seating (executive chair)", "Storage (credenza/pedestal)", "Visitor chairs x2"],
  "Manager Desks":     ["Office Seating (task/ergonomic)", "Storage (pedestal)", "Visitor chairs"],
  "Workstations":      ["Office Seating (ergonomic/task)", "Storage (mobile pedestal)", "Workstation screens"],
  "Boardroom Tables":  ["Office Seating (meeting chairs x seats)", "AV credenza", "Presentation accessories"],
  "Reception Desks":   ["Lounge Seating (2–3 seats)", "Occasional Tables (coffee/side table)"],
  "Sit-Stand Desks":   ["Office Seating (ergonomic)", "Monitor arm", "Mobile pedestal"],
};

const DESIGN_NOTES: Record<string, string> = {
  "Executive Desks":   "Premium statement piece. Lead with matching executive chair + credenza to maximise sell value. Reception matching the executive range lifts the entire project.",
  "Workstations":      "Recommend sit-stand upgrade at quote stage — $400–$600 uplift per desk, 60-70% acceptance when framed as a health investment.",
  "Boardroom Tables":  "Always quote chairs at same time. Matching seating from same supplier range lifts margin and simplifies sourcing.",
  "Reception Desks":   "High-impression item — never let clients under-invest here. Pair with matching lounge seating for a cohesive entry statement.",
};

let _cached: string | null = null;
let _cachedAt: number | null = null;
const TTL_MS = 10 * 60 * 1000;

export function getProductIntelligence(): string {
  const now = Date.now();
  if (_cached && _cachedAt && now - _cachedAt < TTL_MS) return _cached;

  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "server/data/productCatalog.json"),
      "utf-8"
    );
    const catalog = JSON.parse(raw);
    const products: any[] = catalog.products || [];

    // Group by category and series
    const byCategory: Record<string, any[]> = {};
    const bySeries: Record<string, any[]> = {};
    for (const p of products) {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
      if (!bySeries[p.series]) bySeries[p.series] = [];
      bySeries[p.series].push(p);
    }

    const lines: string[] = [
      "## PRODUCT INTELLIGENCE — CATALOGUE, RANGES & COMMERCIAL LOGIC",
      "",
      "Use this to build coherent product packages, not random SKU lists.",
      "Always recommend products from the same series for visual coherence.",
      "",
      "### CATALOGUE OVERVIEW",
      `Total SKUs: ${products.length} | Categories: ${Object.keys(byCategory).length} | Series: ${Object.keys(bySeries).length}`,
      "",
      "### PRICE BANDS & GROSS MARGIN BY CATEGORY",
    ];

    for (const [cat, info] of Object.entries(PRICE_BANDS)) {
      const count = (byCategory[cat] || []).length;
      if (count > 0) {
        lines.push(`- **${cat}**: ${info.band} | Sell: ${info.sell} | GM: ${info.gm} | ${count} SKUs`);
      }
    }

    lines.push("", "### PRODUCT PAIRING RULES — Always cross-sell these:");
    for (const [cat, pairs] of Object.entries(PAIRING_RULES)) {
      lines.push(`- **${cat}** → pair with: ${pairs.join(", ")}`);
    }

    lines.push("", "### COMMERCIAL DESIGN NOTES:");
    for (const [cat, note] of Object.entries(DESIGN_NOTES)) {
      lines.push(`- **${cat}**: ${note}`);
    }

    lines.push("", "### PRODUCT SERIES FAMILIES (key ranges):");
    for (const [series, items] of Object.entries(bySeries)) {
      if (items.length < 2) continue;
      const cats = [...new Set(items.map((p: any) => p.category))];
      const colors = [...new Set(items.flatMap((p: any) => p.colors || []))].slice(0, 4);
      const supplier = items[0]?.supplier || "";
      lines.push(
        `- **${series}** | ${cats.join(", ")} | ${items.length} SKUs | Finishes: ${colors.join(", ")}${supplier ? " | Supplier: " + supplier : ""}`
      );
    }

    lines.push(
      "",
      "### SERIES COHERENCE RULE",
      "Products in the same series share design language, materials, and finish palette.",
      "When building a fit-out package, ALWAYS source products from the same series where possible.",
      "Size variants within a series = same product in different dimensions. Group them — don't list as unrelated items."
    );

    lines.push(
      "",
      "### PACKAGE LOGIC BY PROJECT TYPE",
      "- Startup/small (5–12 staff, 60–120 sqm): bench workstations + ergonomic chairs + shared meeting table + basic storage | $15k–$35k",
      "- Professional services (15–30 staff, 150–300 sqm): workstations/sit-stand + ergonomic chairs + 2 meeting rooms + reception + storage | $60k–$130k",
      "- Corporate executive (30–80 staff, 300–800 sqm): executive desks + ergonomic chairs + boardroom + reception area + lounge zones + storage | $120k–$400k",
      "- Per-person estimate: $1,500–$3,500 (entry/mid) | $3,500–$6,000 (premium) | $6,000–$12,000 (executive)"
    );

    _cached = lines.join("\n");
    _cachedAt = now;
    return _cached;
  } catch {
    return "";
  }
}
