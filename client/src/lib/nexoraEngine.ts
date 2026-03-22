export type NexoraIntent =
  | "EXPLORE"
  | "BUDGET"
  | "LAYOUT"
  | "QUOTE"
  | "STRATEGY"
  | "PROCUREMENT"
  | "FINANCE"
  | "PRODUCT_BROWSE"
  | "BOOKING";

export type JourneyStage = "exploring" | "qualifying" | "engaged" | "converting";

export interface NexoraProfile {
  sqm?: string;
  staff?: string;
  budget?: string;
  style?: string;
  location?: string;
  industry?: string;
  financeInterest?: boolean;
  sitStandInterest?: boolean;
  plannerStarted?: boolean;
  quoteStarted?: boolean;
  pagesVisited: string[];
}

export interface NexoraInput {
  currentRoute: string;
  previousRoute: string | null;
  pagesVisited: string[];
  messageText: string;
  messageCount: number;
  userProfile: NexoraProfile;
  conversationHistory: Array<{ role: string; content: string }>;
}

export interface NexoraAction {
  label: string;
  href: string;
  reason: string;
}

export interface NexoraDecision {
  intent: NexoraIntent;
  journeyStage: JourneyStage;
  nextAction: NexoraAction;
  urgency: "low" | "medium" | "high";
  systemContext: string;
  leadUpdate: {
    intent: string;
    service: string | null;
    notes: string;
    urgency: "low" | "medium" | "high";
  } | null;
}

const INTENT_ROUTE_MAP: Record<string, NexoraIntent> = {
  "/ai-office-planner": "LAYOUT",
  "/upload-your-floor-plan": "LAYOUT",
  "/free-layout-plan": "LAYOUT",
  "/3d-office-walkthrough": "LAYOUT",
  "/quote-builder": "QUOTE",
  "/request-a-quote": "QUOTE",
  "/send-us-your-quote": "QUOTE",
  "/finance-your-workspace": "FINANCE",
  "/trade-project-procurement": "PROCUREMENT",
  "/strategy-call": "STRATEGY",
  "/workplace-strategy": "STRATEGY",
  "/catalog": "PRODUCT_BROWSE",
  "/workplace-solutions": "EXPLORE",
};

function classifyIntent(text: string, route: string, pagesVisited: string[]): NexoraIntent {
  const lower = text.toLowerCase();

  if (/financ|lease|leas|monthly payment|repayment|cash flow/i.test(lower)) return "FINANCE";
  if (/trade|procurement|project manager|interior designer|architect|staged delivery/i.test(lower)) return "PROCUREMENT";
  if (/strategy|consultation|consultant|advice|help me plan|expert/i.test(lower)) return "STRATEGY";
  if (/book|appointment|call|schedule|meeting/i.test(lower)) return "BOOKING";
  if (/layout|floor plan|design|space plan|zone|3d|walkthrough|visualis/i.test(lower)) return "LAYOUT";
  if (/quote|pricing|how much|cost|budget|price|estimate|what does it cost/i.test(lower)) return "QUOTE";
  if (/\$[\d,]+|[\d]+k budget|budget of/i.test(lower)) return "BUDGET";
  if (/desk|chair|seat|workstation|furniture|cabinet|storage|range|product|catalogue|sofa|lounge/i.test(lower)) return "PRODUCT_BROWSE";

  const routeIntent = INTENT_ROUTE_MAP[route];
  if (routeIntent) return routeIntent;

  const visitedIntents = pagesVisited
    .map((p) => INTENT_ROUTE_MAP[p])
    .filter(Boolean);
  if (visitedIntents.length > 0) return visitedIntents[visitedIntents.length - 1];

  return "EXPLORE";
}

function calcJourneyStage(
  messageCount: number,
  pagesVisited: string[],
  profile: NexoraProfile
): JourneyStage {
  const hasProfileData = !!(profile.sqm || profile.staff || profile.budget || profile.location);
  const pageCount = pagesVisited.length;

  if (
    profile.quoteStarted ||
    pagesVisited.includes("/request-a-quote") ||
    pagesVisited.includes("/send-us-your-quote") ||
    (hasProfileData && messageCount >= 6)
  ) {
    return "converting";
  }
  if (
    profile.plannerStarted ||
    messageCount >= 5 ||
    pageCount >= 5 ||
    (hasProfileData && messageCount >= 3)
  ) {
    return "engaged";
  }
  if (messageCount >= 2 || pageCount >= 3 || hasProfileData) {
    return "qualifying";
  }
  return "exploring";
}

function calcUrgency(
  journeyStage: JourneyStage,
  intent: NexoraIntent,
  profile: NexoraProfile
): "low" | "medium" | "high" {
  if (journeyStage === "converting") return "high";
  if (journeyStage === "engaged" && (intent === "QUOTE" || intent === "STRATEGY" || intent === "BOOKING")) return "high";
  if (journeyStage === "engaged" || journeyStage === "qualifying") return "medium";
  return "low";
}

const INTENT_ACTIONS: Record<NexoraIntent, NexoraAction> = {
  EXPLORE: {
    label: "View Workplace Solutions",
    href: "/workplace-solutions",
    reason: "The visitor is exploring options — a solutions overview gives full context.",
  },
  BUDGET: {
    label: "Get a Quote",
    href: "/request-a-quote",
    reason: "Budget interest signals quote readiness — capture the opportunity.",
  },
  LAYOUT: {
    label: "Try AI Office Planner",
    href: "/ai-office-planner",
    reason: "Layout interest is best served by the AI Office Planner for instant output.",
  },
  QUOTE: {
    label: "Request a Quote",
    href: "/request-a-quote",
    reason: "Quote intent is high — route directly to quote submission.",
  },
  STRATEGY: {
    label: "Book a Strategy Call",
    href: "/strategy-call",
    reason: "Complex fitout signals require a strategy consultation.",
  },
  PROCUREMENT: {
    label: "Trade & Project Procurement",
    href: "/trade-project-procurement",
    reason: "Trade/project scope needs our dedicated procurement pathway.",
  },
  FINANCE: {
    label: "Finance Your Workspace",
    href: "/finance-your-workspace",
    reason: "Finance interest — show options and indicative repayments.",
  },
  PRODUCT_BROWSE: {
    label: "Browse the Full Catalogue",
    href: "/catalog",
    reason: "Product interest — guide to full 301-SKU catalogue.",
  },
  BOOKING: {
    label: "Book a Strategy Call",
    href: "/strategy-call",
    reason: "Booking intent — direct to strategy call scheduling.",
  },
};

function getServiceLabel(intent: NexoraIntent): string | null {
  const map: Partial<Record<NexoraIntent, string>> = {
    LAYOUT: "AI Office Planner",
    QUOTE: "Quote Request",
    STRATEGY: "Strategy Consultation",
    PROCUREMENT: "Trade Procurement",
    FINANCE: "Workspace Finance",
    PRODUCT_BROWSE: "Product Catalogue",
    BOOKING: "Strategy Consultation",
  };
  return map[intent] ?? null;
}

export function runNexoraEngine(input: NexoraInput): NexoraDecision {
  const intent = classifyIntent(input.messageText, input.currentRoute, input.pagesVisited);
  const journeyStage = calcJourneyStage(input.messageCount, input.pagesVisited, input.userProfile);
  const urgency = calcUrgency(journeyStage, intent, input.userProfile);
  const nextAction = INTENT_ACTIONS[intent];
  const service = getServiceLabel(intent);

  const profileParts: string[] = [];
  if (input.userProfile.staff) profileParts.push(`Team: ${input.userProfile.staff}`);
  if (input.userProfile.sqm) profileParts.push(`Size: ${input.userProfile.sqm}`);
  if (input.userProfile.budget) profileParts.push(`Budget: ${input.userProfile.budget}`);
  if (input.userProfile.location) profileParts.push(`Location: ${input.userProfile.location}`);
  if (input.userProfile.industry) profileParts.push(`Industry: ${input.userProfile.industry}`);
  if (input.userProfile.financeInterest) profileParts.push("Finance interest: yes");
  if (input.userProfile.sitStandInterest) profileParts.push("Sit-stand interest: yes");

  const systemContext = `
## NEXORA ENGINE — ACTIVE SESSION STATE
You are Nexora, The Corporate Desk's workspace intelligence engine. You are NOT a generic chatbot. You understand context, control flows, guide decisions, and update system state.

### Current Session
- Intent: ${intent}
- Journey Stage: ${journeyStage} (${urgency} urgency)
- Current page: ${input.currentRoute}
${input.previousRoute ? `- Came from: ${input.previousRoute}` : ""}
- Pages visited this session: ${input.pagesVisited.join(", ") || input.currentRoute}
${profileParts.length > 0 ? `- Known visitor data: ${profileParts.join(" · ")}` : ""}
- Messages exchanged: ${input.messageCount}

### Nexora Recommended Next Action
Route the user toward: **${nextAction.label}** (${nextAction.href})
Reason: ${nextAction.reason}

### Response Directives
1. Be decisive — give concrete guidance, not generic information
2. Mirror the user's journey stage: ${journeyStage === "exploring" ? "give an informative overview" : journeyStage === "qualifying" ? "ask clarifying questions to narrow scope" : journeyStage === "engaged" ? "focus on specifics and options" : "move toward commitment — offer clear next steps"}
3. When recommending a page navigation, embed it as [[route:${nextAction.href}|${nextAction.label}]] in your response — this renders as a clickable navigation button
4. Reference known visitor data naturally — do NOT ask for information already provided
5. Every response should advance the user's journey — never leave them at a dead end
`.trim();

  const leadUpdate =
    urgency === "high" || (urgency === "medium" && profileParts.length >= 2)
      ? {
          intent,
          service,
          urgency,
          notes: [
            `Intent: ${intent}`,
            `Journey: ${journeyStage}`,
            profileParts.join(", "),
            `Visited: ${input.pagesVisited.join(", ")}`,
            `Message: "${input.messageText.substring(0, 120)}"`,
          ]
            .filter(Boolean)
            .join(" | "),
        }
      : null;

  return { intent, journeyStage, nextAction, urgency, systemContext, leadUpdate };
}
