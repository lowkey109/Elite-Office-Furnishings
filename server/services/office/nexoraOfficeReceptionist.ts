type OfficeLead = {
  id: string;
  worker: "office_receptionist";
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  message: string;
  intent: string;
  urgency: string;
  estimatedValue: string;
  nextStep: string;
  createdAt: string;
};

const officeLeads: OfficeLead[] = [];

function detectIntent(message: string) {
  const m = message.toLowerCase();
  if (m.includes("fitout") || m.includes("new office") || m.includes("relocation")) return "office_fitout";
  if (m.includes("desk") || m.includes("chair") || m.includes("workstation")) return "furniture_quote";
  if (m.includes("floor plan") || m.includes("layout") || m.includes("design")) return "space_planning";
  if (m.includes("delivery") || m.includes("install")) return "delivery_install";
  if (m.includes("quote") || m.includes("price") || m.includes("cost")) return "quote_request";
  return "general_enquiry";
}

function detectUrgency(message: string) {
  const m = message.toLowerCase();
  if (m.includes("urgent") || m.includes("asap") || m.includes("this week")) return "high";
  if (m.includes("next month") || m.includes("soon")) return "medium";
  return "normal";
}

export function handleNexoraOfficeReceptionist(input: any = {}) {
  const message = String(input.message || "");
  const intent = detectIntent(message);
  const urgency = detectUrgency(message);

  const lead: OfficeLead = {
    id: `nexora_office_lead_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    worker: "office_receptionist",
    name: input.name,
    phone: input.phone,
    email: input.email,
    company: input.company,
    message,
    intent,
    urgency,
    estimatedValue: intent === "office_fitout" ? "high" : intent === "space_planning" ? "medium_high" : "medium",
    nextStep:
      intent === "office_fitout"
        ? "Book fitout discovery call and request floor plan."
        : intent === "space_planning"
        ? "Ask customer to upload floor plan."
        : intent === "furniture_quote"
        ? "Collect product type, quantity, delivery suburb, timeframe and budget."
        : "Capture details and route to sales.",
    createdAt: new Date().toISOString(),
  };

  officeLeads.unshift(lead);
  if (officeLeads.length > 300) officeLeads.length = 300;

  return {
    ok: true,
    service: "nexora_office_receptionist",
    nexoraBrain: true,
    worker: "office_receptionist",
    businessArea: "office_furniture_and_fitouts",
    tradingAffected: false,
    leadCaptured: true,
    lead,
    reply: "Thanks. Nexora has captured this for The Corporate Desk office furniture team. Please send suburb, timeframe, rough budget, and floor plan if available.",
    updatedAt: new Date().toISOString(),
  };
}

export function getNexoraOfficeReceptionistStatus() {
  return {
    ok: true,
    service: "nexora_office_receptionist",
    nexoraBrain: true,
    worker: "office_receptionist",
    businessArea: "office_furniture_and_fitouts",
    tradingAffected: false,
    leadCount: officeLeads.length,
    capabilities: [
      "24/7 enquiry capture",
      "fitout lead qualification",
      "furniture quote qualification",
      "floor plan request",
      "urgency detection",
      "sales next-step recommendation"
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function getNexoraOfficeLeads(limit = 100) {
  return {
    ok: true,
    service: "nexora_office_receptionist_leads",
    nexoraBrain: true,
    worker: "office_receptionist",
    count: officeLeads.length,
    rows: officeLeads.slice(0, Number(limit) || 100),
    updatedAt: new Date().toISOString(),
  };
}
