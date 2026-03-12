import fs from "fs";
import path from "path";

let _cached: string | null = null;
let _cachedAt: number | null = null;
const TTL_MS = 5 * 60 * 1000;

export function getSupplierRoutingRules(): string {
  const now = Date.now();
  if (_cached && _cachedAt && now - _cachedAt < TTL_MS) return _cached;

  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "server/data/supplierDatabase.json"),
      "utf-8"
    );
    const db = JSON.parse(raw);
    const suppliers: any[] = db.suppliers || [];
    const routing = db.routing_logic || {};

    const lines: string[] = [
      "## MANUFACTURER & SUPPLIER ROUTING INTELLIGENCE",
      "",
      "These are The Corporate Desk's LIVE manufacturing contacts and sourcing rules.",
      "Apply these rules EVERY TIME you recommend products, estimate lead times, or discuss sourcing.",
      "",
      "### SUPPLIER DIRECTORY",
    ];

    for (const s of suppliers) {
      const cats = (s.category_specialization || s.product_categories || []).join(", ");
      const noSend = (s.routing_rules?.do_not_contact_for || []).join(", ");
      const waStatus = s.whatsapp_enabled
        ? `WhatsApp: ${s.whatsapp_number}`
        : s.whatsapp_pending_confirmation
        ? "WhatsApp: PENDING CONFIRMATION"
        : "No direct WhatsApp";

      lines.push("");
      lines.push(`**${s.name}** (${s.id})`);
      if (s.contact_name) lines.push(`  Contact: ${s.contact_name} | ${waStatus}`);
      lines.push(`  Specialises in: ${cats}`);
      if (s.routing_rules?.note) lines.push(`  RULE: ${s.routing_rules.note}`);
      if (noSend) lines.push(`  NEVER contact for: ${noSend}`);
      if (s.routing_rules?.relationship) lines.push(`  Relationship: ${s.routing_rules.relationship}`);
      if (s.admin_action_required) lines.push(`  ⚠ Action required: ${s.admin_action_required}`);
    }

    lines.push("", "### CATEGORY ROUTING RULES — Who to contact for what:");

    const rules: any[] = routing.rules || [];
    for (const rule of rules) {
      const line = `- **${rule.category}** → ${rule.primary_supplier}${
        rule.secondary_supplier ? ` (also: ${rule.secondary_supplier})` : ""
      }${rule.note ? `. ${rule.note}` : ""}`;
      lines.push(line);
    }

    lines.push(
      "",
      "### SOURCING DECISION PROTOCOL",
      "1. Identify product category",
      "2. Check routing rules above — contact ONLY suppliers that specialise in that category",
      "3. For desks/workstations: contact Asya (Meiyi) first; if large project, also request from Ruby (Xitian)",
      "4. For seating: ONLY Boke Furniture — never send desk/workstation requests to Boke",
      "5. For custom/large projects: Xitian (Ruby) is priority",
      "6. Compare price, lead time, and reliability before committing"
    );

    _cached = lines.join("\n");
    _cachedAt = now;
    return _cached;
  } catch {
    return "";
  }
}
