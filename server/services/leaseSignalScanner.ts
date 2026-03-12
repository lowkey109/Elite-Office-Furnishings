import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type SignalType =
  | "new_lease"
  | "relocation"
  | "office_expansion"
  | "refurbishment"
  | "hiring_signals"
  | "funding_growth"
  | "new_office_opening"
  | "territory_signal";

export interface ScannedLead {
  company: string;
  city: string;
  suburb: string;
  industry: string;
  signalType: SignalType;
  signalSummary: string;
  signalSource: string;
  estimatedHeadcount: string;
  estimatedOfficeSqm: string;
  estimatedProjectValue: string;
  dealProbability: number;
  priority: "High" | "Medium" | "Low";
  score: number;
  contactRole: string;
  contactName: string;
  outreachSubject: string;
  outreachEmail: string;
  recommendedNextAction: string;
  reasoning: string;
  signalsDetected: string[];
}

const OFFICE_SQMS_BY_HEADCOUNT: Record<string, string> = {
  "10-20": "120-200 sqm",
  "20-40": "200-400 sqm",
  "40-80": "400-700 sqm",
  "80-150": "700-1,200 sqm",
  "150-300": "1,200-2,500 sqm",
  "300+": "2,500+ sqm",
};

const PROJECT_VALUE_BY_SQM: Record<string, string> = {
  "120-200 sqm": "$15,000–$35,000",
  "200-400 sqm": "$35,000–$80,000",
  "400-700 sqm": "$80,000–$160,000",
  "700-1,200 sqm": "$160,000–$320,000",
  "1,200-2,500 sqm": "$320,000–$700,000",
  "2,500+ sqm": "$700,000+",
};

const SIGNAL_CONTEXT: Record<SignalType, string> = {
  new_lease: "signed a new commercial office lease in the past 30 days",
  relocation: "is relocating its head office or a major office to a new building",
  office_expansion: "is expanding into a larger office floor or adding a new floor to its current tenancy",
  refurbishment: "has announced or begun a commercial office refurbishment project",
  hiring_signals: "has posted 3+ office manager, facilities, or workplace roles — indicating active workspace growth",
  funding_growth: "has received new funding and has signalled headcount growth requiring workspace",
  new_office_opening: "is opening a brand new office in this city for the first time",
  territory_signal: "is occupying or about to occupy office space in a tracked target building",
};

export async function runLeaseSignalScan(opts: {
  cities?: string[];
  signalTypes?: SignalType[];
  count?: number;
}): Promise<ScannedLead[]> {
  const cities = opts.cities?.length ? opts.cities : ["Brisbane", "Melbourne", "Sydney"];
  const signalTypes = opts.signalTypes?.length
    ? opts.signalTypes
    : ["new_lease", "relocation", "office_expansion", "hiring_signals", "funding_growth", "new_office_opening"];
  const count = Math.min(opts.count || 6, 10);

  const prompt = `You are a senior commercial real estate intelligence analyst specialising in the Australian office furniture market.

Your task is to generate ${count} realistic, high-quality lease signal leads for The Corporate Desk — an Australian premium commercial office furniture company based in Brisbane.

These leads represent companies that are genuinely likely to require commercial office furniture, workstation fitouts, executive seating, boardroom tables, reception furniture, acoustic pods, or workspace planning services.

TARGET CITIES: ${cities.join(", ")}

SIGNAL TYPES TO DETECT (pick the most realistic for each lead):
${signalTypes.map(s => `- ${s}: company that ${SIGNAL_CONTEXT[s as SignalType]}`).join("\n")}

IMPORTANT RULES:
- Use REAL Australian company names (actual companies that exist — technology, finance, engineering, healthcare, consulting, professional services, legal, accounting, mining, resources, construction sectors)
- Use REAL Australian office precincts and suburbs (e.g. Brisbane CBD, Fortitude Valley, South Brisbane, Newstead; Melbourne CBD, Docklands, Southbank, Cremorne; Sydney CBD, Pyrmont, North Sydney, Parramatta, Surry Hills)
- Make each lead unique — different companies, different industries, different signal types
- Scoring should be realistic (7-10 for high intent lease signals, 5-7 for hiring signals)
- Deal probability: new_lease=75-90%, relocation=70-85%, expansion=65-80%, refurbishment=60-75%, hiring=40-60%, funding=55-70%, new_office=75-85%
- Outreach emails must sound COMPLETELY HUMAN — like a real person who noticed the signal, not AI-generated
- Outreach emails should be SHORT (3-4 sentences max), warm, confident, and reference the specific signal
- The contact role should be realistic (Office Manager, Head of Operations, Facilities Director, COO, CEO, CFO for small companies)
- Project values based on realistic Australian commercial furniture pricing (workstations $800-1,500 each, chairs $400-1,200, meeting tables $2,000-15,000, etc.)

Respond ONLY with a JSON array. No markdown, no explanation. Just the JSON array.

Each object must have these exact keys:
{
  "company": "string — actual company name",
  "city": "string — Brisbane/Melbourne/Sydney",
  "suburb": "string — specific suburb or precinct",
  "industry": "string — industry sector",
  "signalType": "string — one of: new_lease, relocation, office_expansion, refurbishment, hiring_signals, funding_growth, new_office_opening, territory_signal",
  "signalSummary": "string — 1-2 sentences describing what the signal is (natural language, as if a human researcher wrote it)",
  "signalSource": "string — where this signal was observed (e.g. 'LinkedIn company post', 'SEEK job listing', 'AFR article', 'Domain Commercial', 'company website', 'press release')",
  "estimatedHeadcount": "string — e.g. '40-60 staff'",
  "estimatedOfficeSqm": "string — e.g. '400-600 sqm'",
  "estimatedProjectValue": "string — e.g. '$80,000–$160,000 AUD'",
  "dealProbability": "number — 0-100 integer",
  "priority": "string — High/Medium/Low",
  "score": "number — 1-10 integer",
  "contactRole": "string — e.g. 'Office Manager', 'Head of Operations'",
  "contactName": "string — realistic Australian first name for this role",
  "outreachSubject": "string — natural email subject, e.g. 'Quick thought on your new Brisbane office'",
  "outreachEmail": "string — full email body, 3-4 sentences, human and warm",
  "recommendedNextAction": "string — what The Corporate Desk should do next",
  "reasoning": "string — why this is a strong or medium lead",
  "signalsDetected": ["array", "of", "signal", "keywords", "detected"]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4000,
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "{}";

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  // GPT json_object mode wraps arrays in an object — find the first array value
  let arr: any[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val)) { arr = val; break; }
    }
  }

  return arr
    .filter(l => l && l.company && l.city)
    .map(l => ({
      company: l.company || "Unknown",
      city: l.city || cities[0],
      suburb: l.suburb || "",
      industry: l.industry || "Commercial",
      signalType: l.signalType || "new_lease",
      signalSummary: l.signalSummary || "",
      signalSource: l.signalSource || "Market intelligence",
      estimatedHeadcount: l.estimatedHeadcount || "20-40 staff",
      estimatedOfficeSqm: l.estimatedOfficeSqm || "200-400 sqm",
      estimatedProjectValue: l.estimatedProjectValue || "$35,000–$80,000",
      dealProbability: parseInt(l.dealProbability) || 60,
      priority: l.priority || "Medium",
      score: parseInt(l.score) || 6,
      contactRole: l.contactRole || "Office Manager",
      contactName: l.contactName || "Alex",
      outreachSubject: l.outreachSubject || "Quick thought on your new office",
      outreachEmail: l.outreachEmail || "",
      recommendedNextAction: l.recommendedNextAction || "Send outreach email",
      reasoning: l.reasoning || "",
      signalsDetected: Array.isArray(l.signalsDetected) ? l.signalsDetected : [],
    }))
    .slice(0, count);
}

export async function generateTerritoryLead(buildingName: string, city: string, suburb: string): Promise<ScannedLead | null> {
  try {
    const leads = await runLeaseSignalScan({
      cities: [city],
      signalTypes: ["territory_signal", "new_lease", "relocation"],
      count: 1,
    });
    if (!leads.length) return null;
    return { ...leads[0], signalType: "territory_signal", signalSource: `Territory scan — ${buildingName}, ${suburb}` };
  } catch {
    return null;
  }
}

// ─── Procurement Intelligence ─────────────────────────────────────────────────

export interface ProcurementRecommendation {
  category: string;
  quantity: number;
  unitEstimate: string;
  totalEstimate: string;
  recommendedSupplier: string;
  supplierContact: string;
  leadTime: string;
  marginBand: string;
  notes: string;
}

const SUPPLIER_ROUTING: Record<string, { supplier: string; contact: string; leadTime: string }> = {
  chairs:             { supplier: "Boke Furniture",           contact: "Boke (+86 133 9279 8732)",    leadTime: "45–60 days" },
  "task chairs":      { supplier: "Boke Furniture",           contact: "Boke (+86 133 9279 8732)",    leadTime: "45–60 days" },
  "executive seating":{ supplier: "Boke Furniture",           contact: "Boke (+86 133 9279 8732)",    leadTime: "45–60 days" },
  desks:              { supplier: "Guangzhou Meiyi Furniture", contact: "Asya (+86 134 2216 1319)",    leadTime: "35–50 days" },
  workstations:       { supplier: "Guangzhou Meiyi Furniture", contact: "Asya (+86 134 2216 1319)",    leadTime: "35–50 days" },
  "meeting tables":   { supplier: "Guangzhou Meiyi Furniture", contact: "Asya (+86 134 2216 1319)",    leadTime: "40–55 days" },
  "reception desks":  { supplier: "Xitian Furniture (Ruby)",   contact: "Ruby (confirm number)",       leadTime: "50–70 days" },
  "executive desks":  { supplier: "Xitian Furniture (Ruby)",   contact: "Ruby (confirm number)",       leadTime: "50–70 days" },
  "boardroom tables": { supplier: "Xitian Furniture (Ruby)",   contact: "Ruby (confirm number)",       leadTime: "55–75 days" },
  "acoustic pods":    { supplier: "Guangzhou Meiyi Furniture", contact: "Asya (+86 134 2216 1319)",    leadTime: "55–70 days" },
  "storage":          { supplier: "Guangzhou Meiyi Furniture", contact: "Asya (+86 134 2216 1319)",    leadTime: "35–50 days" },
  "lounge":           { supplier: "General Supplier",          contact: "Denny (+86 131 2796 8208)",   leadTime: "40–55 days" },
  "breakout seating": { supplier: "General Supplier",          contact: "Denny (+86 131 2796 8208)",   leadTime: "40–55 days" },
};

const UNIT_PRICES: Record<string, [number, number]> = {
  chairs: [420, 1200],
  "task chairs": [420, 900],
  "executive seating": [800, 2200],
  desks: [650, 1500],
  workstations: [750, 1800],
  "meeting tables": [1800, 12000],
  "reception desks": [2500, 15000],
  "executive desks": [1200, 4500],
  "boardroom tables": [3500, 25000],
  "acoustic pods": [8000, 22000],
  storage: [400, 1200],
  lounge: [1200, 4500],
  "breakout seating": [900, 3500],
};

export function computeProcurementRecommendations(
  categories: Array<{ category: string; quantity: number }>
): ProcurementRecommendation[] {
  return categories.map(({ category, quantity }) => {
    const key = category.toLowerCase().trim();
    const routing = SUPPLIER_ROUTING[key] || {
      supplier: "Denny (Sourcing)",
      contact: "Denny (+86 131 2796 8208)",
      leadTime: "45–60 days",
    };
    const [minUnit, maxUnit] = UNIT_PRICES[key] || [500, 2000];
    const minTotal = quantity * minUnit;
    const maxTotal = quantity * maxUnit;
    const marginBand = maxTotal > 50000 ? "28–38%" : maxTotal > 20000 ? "32–42%" : "38–52%";

    return {
      category: category,
      quantity,
      unitEstimate: `$${minUnit.toLocaleString()}–$${maxUnit.toLocaleString()} AUD landed`,
      totalEstimate: `$${minTotal.toLocaleString()}–$${maxTotal.toLocaleString()} AUD`,
      recommendedSupplier: routing.supplier,
      supplierContact: routing.contact,
      leadTime: routing.leadTime,
      marginBand,
      notes: key.includes("boke") || key === "chairs" || key === "task chairs" || key === "executive seating"
        ? "Boke specialises in seating — do not send desk/workstation requests."
        : key.includes("desk") || key === "workstations"
        ? "Meiyi is primary for desk/workstation supply. Contact Ruby for premium executive or custom pieces."
        : "",
    };
  });
}
