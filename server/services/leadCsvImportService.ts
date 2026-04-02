import type { InsertLead, Lead } from "@shared/schema";

export type PreviewRow = {
  row: number;
  data: Partial<InsertLead>;
  status: "valid" | "invalid" | "duplicate";
  reason?: string;
};

export type PreviewResult = {
  valid: PreviewRow[];
  invalid: PreviewRow[];
  duplicates: PreviewRow[];
  totalRows: number;
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(csv: string): Array<{ row: number; obj: Record<string, string> }> {
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ""));
  return lines.slice(1).map((line, i) => {
    const values = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ""; });
    return { row: i + 1, obj };
  });
}

function safeInt(v: string | undefined): number | undefined {
  if (!v || v.trim() === "") return undefined;
  const n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? undefined : n;
}

function mapToLead(obj: Record<string, string>): Partial<InsertLead> {
  const email = (obj["email"] ?? "").trim().toLowerCase();
  const name = (obj["contactname"] || obj["contact"] || obj["name"] || "Unknown").trim();
  const company = (obj["companyname"] || obj["company"] || "").trim();
  const sourcePage = (obj["source"] || "csv_import").trim() || "csv_import";
  const estimatedValue = safeInt(obj["estimatedvalue"] || obj["estimated_value"]);

  return {
    type: "csv_import",
    name,
    email,
    company,
    phone: (obj["phone"] ?? "").trim(),
    officeLocation: (obj["city"] || obj["location"] || obj["officelocation"] || "").trim(),
    message: (obj["notes"] || obj["message"] || "").trim() || undefined,
    sourcePage,
    leadStatus: "new",
    staffCount: safeInt(obj["staffcount"] || obj["staff"]),
    budgetMin: safeInt(obj["budgetmin"] || obj["budget_min"]),
    budgetMax: safeInt(obj["budgetmax"] || obj["budget_max"]),
    estimatedValueMin: estimatedValue,
    estimatedValueMax: estimatedValue,
  };
}

export async function previewCSV(
  csv: string,
  findByEmail: (email: string) => Promise<Lead | undefined>,
  findByCompanyLocation: (company: string, location: string) => Promise<Lead | undefined>,
): Promise<PreviewResult> {
  const parsed = parseCSV(csv);
  const result: PreviewResult = { valid: [], invalid: [], duplicates: [], totalRows: parsed.length };
  const seenEmails = new Set<string>();

  for (const { row, obj } of parsed) {
    const lead = mapToLead(obj);
    const email = lead.email ?? "";
    const company = lead.company ?? "";
    const location = lead.officeLocation ?? "";

    if (!lead.name || !email) {
      result.invalid.push({ row, data: lead, status: "invalid", reason: "Missing name or email" });
      continue;
    }
    if (!email.includes("@") || !email.includes(".")) {
      result.invalid.push({ row, data: lead, status: "invalid", reason: "Invalid email format" });
      continue;
    }
    if (!company && !lead.officeLocation) {
      result.invalid.push({ row, data: lead, status: "invalid", reason: "Missing company name" });
      continue;
    }

    if (seenEmails.has(email)) {
      result.duplicates.push({ row, data: lead, status: "duplicate", reason: "Duplicate email within CSV" });
      continue;
    }

    const existsByEmail = await findByEmail(email);
    if (existsByEmail) {
      result.duplicates.push({ row, data: lead, status: "duplicate", reason: "Email already in database" });
      continue;
    }

    if (!email && company) {
      const existsByCompany = await findByCompanyLocation(company, location);
      if (existsByCompany) {
        result.duplicates.push({ row, data: lead, status: "duplicate", reason: "Company+location already in database" });
        continue;
      }
    }

    seenEmails.add(email);
    result.valid.push({ row, data: lead, status: "valid" });
  }

  return result;
}

export async function importCSV(
  csv: string,
  findByEmail: (email: string) => Promise<Lead | undefined>,
  findByCompanyLocation: (company: string, location: string) => Promise<Lead | undefined>,
  createLead: (lead: InsertLead) => Promise<Lead>,
): Promise<{ imported: number; duplicates: number; invalid: number }> {
  const preview = await previewCSV(csv, findByEmail, findByCompanyLocation);
  let imported = 0;

  for (const row of preview.valid) {
    await createLead(row.data as InsertLead);
    imported++;
  }

  return {
    imported,
    duplicates: preview.duplicates.length,
    invalid: preview.invalid.length,
  };
}
