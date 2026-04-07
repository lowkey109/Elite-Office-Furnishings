/**
 * NEXORA EXECUTIVE OPERATING SYSTEM
 * The Corporate Desk — Platform Intelligence Brain
 *
 * Nexora is not a chatbot. It is the decision-making, workflow-routing,
 * lead-scoring, and journey-orchestration engine that runs the platform.
 *
 * The UI displays the system. Nexora runs the system.
 */

// ─── Intent Classification ───────────────────────────────────────────────────

export type NexoraIntent =
  | "EXPLORE"
  | "PRODUCT_BROWSE"
  | "LAYOUT_PLANNING"
  | "QUOTE_REQUEST"
  | "BUDGET_INQUIRY"
  | "STRATEGY_NEEDED"
  | "PROCUREMENT"
  | "FINANCE_INQUIRY"
  | "BOOKING_REQUEST"
  | "PARTNER_REFERRAL"
  | "SUPPORT_ISSUE"
  | "ADMIN_ACTION";

// ─── Journey Stage ───────────────────────────────────────────────────────────

export type JourneyStage =
  | "exploring"    // First contact — browsing, no intent signal
  | "qualifying"   // Some intent — asking questions, viewing services
  | "engaged"      // Clear need — using planner/builder, providing data
  | "converting";  // Ready to act — on quote/call/form pages

// ─── Signal Types ────────────────────────────────────────────────────────────

export type NexoraSignalType =
  | "PAGE_VIEW"
  | "CTA_CLICK"
  | "FORM_START"
  | "FORM_SUBMIT"
  | "FILE_UPLOAD"
  | "ASSISTANT_MESSAGE"
  | "QUICK_REPLY"
  | "PLANNER_START"
  | "QUOTE_START"
  | "PRODUCT_VIEW"
  | "PRICE_VIEW"
  | "FINANCE_VIEW"
  | "STRATEGY_VIEW"
  | "PARTNER_VIEW"
  | "TRADE_VIEW";

export interface NexoraSignal {
  type: NexoraSignalType;
  route: string;
  payload?: Record<string, string | number | boolean | null>;
  timestamp: number;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface NexoraProfile {
  sqm?: string;
  staff?: string;
  budget?: string;
  style?: string;
  location?: string;
  industry?: string;
  company?: string;
  email?: string;
  financeInterest?: boolean;
  sitStandInterest?: boolean;
  plannerStarted?: boolean;
  quoteStarted?: boolean;
  pagesVisited: string[];
}

// ─── Decision Output ──────────────────────────────────────────────────────────

export interface NexoraAction {
  label: string;
  href: string;
  reason: string;
}

export interface NexoraLeadUpdate {
  intent: string;
  service: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  confidence: number;
  notes: string;
  estimatedDealBand: string | null;
}

export interface NexoraDecision {
  intent: NexoraIntent;
  journeyStage: JourneyStage;
  urgency: "low" | "medium" | "high" | "critical";
  confidence: number;
  closerMode: boolean;
  problemSolverMode: boolean;
  nextAction: NexoraAction;
  alternateActions: NexoraAction[];
  blockers: string[];
  opportunities: string[];
  escalationRequired: boolean;
  adminSummary: string;
  systemContext: string;
  leadUpdate: NexoraLeadUpdate | null;
}

// ─── Engine Input ─────────────────────────────────────────────────────────────

export interface NexoraInput {
  currentRoute: string;
  previousRoute: string | null;
  pagesVisited: string[];
  signalLog: NexoraSignal[];
  messageText: string;
  messageCount: number;
  userProfile: NexoraProfile;
  conversationHistory: Array<{ role: string; content: string }>;
  formData?: Record<string, string>;
}

// ─── Route Intent Mapping ─────────────────────────────────────────────────────

const ROUTE_INTENT_MAP: Record<string, NexoraIntent> = {
  "/ai-office-planner": "LAYOUT_PLANNING",
  "/upload-your-floor-plan": "LAYOUT_PLANNING",
  "/free-layout-plan": "LAYOUT_PLANNING",
  "/3d-office-walkthrough": "LAYOUT_PLANNING",
  "/quote-builder": "QUOTE_REQUEST",
  "/request-a-quote": "QUOTE_REQUEST",
  "/send-us-your-quote": "QUOTE_REQUEST",
  "/finance-your-workspace": "FINANCE_INQUIRY",
  "/trade-project-procurement": "PROCUREMENT",
  "/strategy-call": "STRATEGY_NEEDED",
  "/workplace-strategy": "STRATEGY_NEEDED",
  "/catalog": "PRODUCT_BROWSE",
  "/workplace-solutions": "EXPLORE",
  "/partners": "PARTNER_REFERRAL",
};

const INTENT_SIGNALS: Record<NexoraSignalType, NexoraIntent | null> = {
  PAGE_VIEW: null,
  CTA_CLICK: null,
  FORM_START: "QUOTE_REQUEST",
  FORM_SUBMIT: "QUOTE_REQUEST",
  FILE_UPLOAD: "LAYOUT_PLANNING",
  ASSISTANT_MESSAGE: null,
  QUICK_REPLY: null,
  PLANNER_START: "LAYOUT_PLANNING",
  QUOTE_START: "QUOTE_REQUEST",
  PRODUCT_VIEW: "PRODUCT_BROWSE",
  PRICE_VIEW: "BUDGET_INQUIRY",
  FINANCE_VIEW: "FINANCE_INQUIRY",
  STRATEGY_VIEW: "STRATEGY_NEEDED",
  PARTNER_VIEW: "PARTNER_REFERRAL",
  TRADE_VIEW: "PROCUREMENT",
};

// ─── Intent Classification ────────────────────────────────────────────────────

function classifyIntent(
  text: string,
  route: string,
  pagesVisited: string[],
  signalLog: NexoraSignal[]
): NexoraIntent {
  const lower = text.toLowerCase();

  // Text-based classification (highest precision — direct user expression)
  if (/partner|referral|commission|refer\s*a\s*client/i.test(lower)) return "PARTNER_REFERRAL";
  if (/support|broken|not working|issue|problem|error/i.test(lower)) return "SUPPORT_ISSUE";
  if (/trade|procurement|project manager|interior designer|architect|contractor|staged delivery/i.test(lower)) return "PROCUREMENT";
  if (/financ|lease|leas|monthly payment|repayment|cash flow|interest rate/i.test(lower)) return "FINANCE_INQUIRY";
  if (/book|appointment|call|schedule|meeting|consultation/i.test(lower)) return "BOOKING_REQUEST";
  if (/strategy|consultation|consultant|expert|advice|help me plan|recommend/i.test(lower)) return "STRATEGY_NEEDED";
  if (/layout|floor plan|design plan|space plan|zone|3d|walkthrough|visualis|render/i.test(lower)) return "LAYOUT_PLANNING";
  if (/quote|get a price|how much|what does it cost|budget for|estimate|invoice|price\s*list/i.test(lower)) return "QUOTE_REQUEST";
  if (/\$[\d,]+|[\d]+k\s*budget|budget of|budget is|spend of/i.test(lower)) return "BUDGET_INQUIRY";
  if (/desk|chair|seat|workstation|furniture|cabinet|storage|sofa|lounge|table|range|product|catalogue|sku/i.test(lower)) return "PRODUCT_BROWSE";

  // Recent signal log intent
  const recentSignals = signalLog.slice(-5);
  for (const sig of recentSignals.reverse()) {
    const sigIntent = INTENT_SIGNALS[sig.type];
    if (sigIntent) return sigIntent;
  }

  // Current route intent
  const routeIntent = ROUTE_INTENT_MAP[route];
  if (routeIntent) return routeIntent;

  // Pages visited — most commercially advanced page wins
  const intentPriority: NexoraIntent[] = [
    "QUOTE_REQUEST", "LAYOUT_PLANNING", "STRATEGY_NEEDED",
    "PROCUREMENT", "FINANCE_INQUIRY", "BOOKING_REQUEST",
    "BUDGET_INQUIRY", "PRODUCT_BROWSE", "PARTNER_REFERRAL",
  ];
  for (const intent of intentPriority) {
    const intentRoute = Object.entries(ROUTE_INTENT_MAP).find(([, i]) => i === intent);
    if (intentRoute && pagesVisited.includes(intentRoute[0])) return intent;
  }

  return "EXPLORE";
}

// ─── Journey Stage Calculation ────────────────────────────────────────────────

function calcJourneyStage(
  messageCount: number,
  pagesVisited: string[],
  profile: NexoraProfile,
  signalLog: NexoraSignal[],
  intent: NexoraIntent
): JourneyStage {
  const hasProfile = !!(profile.sqm || profile.staff || profile.budget || profile.email || profile.company);
  const hasHighValueSignal = signalLog.some(s => ["FORM_START", "FORM_SUBMIT", "FILE_UPLOAD", "PLANNER_START", "QUOTE_START"].includes(s.type));
  const onConversionPage = ["/request-a-quote", "/send-us-your-quote", "/strategy-call", "/quote-builder"].some(p => pagesVisited.includes(p));

  if (profile.quoteStarted || onConversionPage && hasProfile) return "converting";
  if (profile.plannerStarted || hasHighValueSignal || (hasProfile && messageCount >= 3) || pagesVisited.length >= 5) return "engaged";
  if (messageCount >= 2 || pagesVisited.length >= 3 || hasProfile || intent !== "EXPLORE") return "qualifying";
  return "exploring";
}

// ─── Confidence Score ─────────────────────────────────────────────────────────

function calcConfidence(
  profile: NexoraProfile,
  signalLog: NexoraSignal[],
  messageCount: number
): number {
  let score = 20;
  if (profile.staff) score += 15;
  if (profile.sqm) score += 15;
  if (profile.budget) score += 20;
  if (profile.location) score += 10;
  if (profile.industry) score += 5;
  if (profile.email) score += 15;
  if (signalLog.some(s => s.type === "FORM_SUBMIT")) score += 20;
  if (signalLog.some(s => s.type === "FILE_UPLOAD")) score += 15;
  if (messageCount >= 3) score += Math.min(messageCount * 3, 15);
  return Math.min(score, 99);
}

// ─── Urgency Scoring ──────────────────────────────────────────────────────────

function calcUrgency(
  journeyStage: JourneyStage,
  intent: NexoraIntent,
  profile: NexoraProfile,
  signalLog: NexoraSignal[],
  confidence: number
): "low" | "medium" | "high" | "critical" {
  const hasFormSubmit = signalLog.some(s => s.type === "FORM_SUBMIT");
  if (hasFormSubmit || (journeyStage === "converting" && confidence >= 60)) return "critical";
  if (journeyStage === "converting") return "high";
  if (journeyStage === "engaged" && ["QUOTE_REQUEST", "STRATEGY_NEEDED", "BOOKING_REQUEST", "PROCUREMENT"].includes(intent)) return "high";
  if (journeyStage === "engaged" || (journeyStage === "qualifying" && confidence >= 50)) return "medium";
  return "low";
}

// ─── Deal Value Estimation ────────────────────────────────────────────────────

function estimateDealBand(profile: NexoraProfile, intent: NexoraIntent): string | null {
  if (!profile.staff && !profile.sqm && !profile.budget) return null;
  const staff = parseInt(profile.staff || "0");
  const sqm = parseInt(profile.sqm || "0");
  if (profile.budget) return `~${profile.budget} (self-reported)`;
  if (intent === "PROCUREMENT") return "$150,000–$500,000+";
  if (staff >= 50 || sqm >= 500) return "$80,000–$250,000";
  if (staff >= 20 || sqm >= 200) return "$30,000–$80,000";
  if (staff >= 10 || sqm >= 100) return "$15,000–$35,000";
  if (staff > 0 || sqm > 0) return "$5,000–$20,000";
  return null;
}

// ─── Next Action Routing ──────────────────────────────────────────────────────

const PRIMARY_ACTIONS: Record<NexoraIntent, NexoraAction> = {
  EXPLORE: { label: "View Workplace Solutions", href: "/workplace-solutions", reason: "Visitor is exploring — a structured solutions overview accelerates qualification." },
  PRODUCT_BROWSE: { label: "Browse Full Catalogue", href: "/catalog", reason: "Product interest detected — direct to full 301-SKU catalogue." },
  LAYOUT_PLANNING: { label: "Try AI Office Planner", href: "/ai-office-planner", reason: "Layout intent detected — AI Planner produces instant zone layout, SKU package, and budget." },
  QUOTE_REQUEST: { label: "Request a Quote", href: "/request-a-quote", reason: "Quote intent is clear — capture the opportunity immediately." },
  BUDGET_INQUIRY: { label: "Build Your Quote", href: "/quote-builder", reason: "Budget awareness signals readiness — route to Quote Builder." },
  STRATEGY_NEEDED: { label: "Book a Strategy Call", href: "/strategy-call", reason: "Complex project signals require expert consultation." },
  PROCUREMENT: { label: "Trade & Project Procurement", href: "/trade-project-procurement", reason: "Trade/project scope needs dedicated procurement pathway." },
  FINANCE_INQUIRY: { label: "Finance Your Workspace", href: "/finance-your-workspace", reason: "Finance interest — show options and indicative repayments." },
  BOOKING_REQUEST: { label: "Book a Strategy Call", href: "/strategy-call", reason: "Booking intent — direct to strategy call." },
  PARTNER_REFERRAL: { label: "Partner Network", href: "/partners", reason: "Referral or partner intent — route to partner program." },
  SUPPORT_ISSUE: { label: "Contact Our Team", href: "/contact", reason: "Support issue detected — connect with a human." },
  ADMIN_ACTION: { label: "Admin Command Centre", href: "/admin", reason: "Admin action required — route to command centre." },
};

const ALTERNATE_ACTIONS: Record<NexoraIntent, NexoraAction[]> = {
  EXPLORE: [
    { label: "Free Layout Plan", href: "/free-layout-plan", reason: "Low-friction entry to get a workspace concept." },
    { label: "Book Strategy Call", href: "/strategy-call", reason: "Expert-led exploration for complex projects." },
  ],
  PRODUCT_BROWSE: [
    { label: "Request a Quote", href: "/request-a-quote", reason: "Convert browsing into a formal enquiry." },
    { label: "Finance Options", href: "/finance-your-workspace", reason: "Finance makes the purchase accessible." },
  ],
  LAYOUT_PLANNING: [
    { label: "Free Layout Plan", href: "/free-layout-plan", reason: "No-obligation alternative to AI Planner." },
    { label: "Request a Quote", href: "/request-a-quote", reason: "Convert planning intent into a formal quote." },
  ],
  QUOTE_REQUEST: [
    { label: "Book Strategy Call", href: "/strategy-call", reason: "Strategy call produces a better-scoped quote." },
    { label: "Finance Your Workspace", href: "/finance-your-workspace", reason: "Finance can unlock higher-value projects." },
  ],
  BUDGET_INQUIRY: [
    { label: "Request a Quote", href: "/request-a-quote", reason: "Formalise the budget enquiry into a quote." },
    { label: "Finance Options", href: "/finance-your-workspace", reason: "Finance expands accessible budget range." },
  ],
  STRATEGY_NEEDED: [
    { label: "Free Layout Plan", href: "/free-layout-plan", reason: "A layout plan helps scope strategy discussions." },
    { label: "Trade Procurement", href: "/trade-project-procurement", reason: "Large-scale projects need procurement routing." },
  ],
  PROCUREMENT: [
    { label: "Book Strategy Call", href: "/strategy-call", reason: "Strategy call qualifies procurement scope." },
    { label: "Request a Quote", href: "/request-a-quote", reason: "Direct quote path for procurement teams." },
  ],
  FINANCE_INQUIRY: [
    { label: "Request a Quote", href: "/request-a-quote", reason: "Finance is applied to a confirmed quote." },
    { label: "Book Strategy Call", href: "/strategy-call", reason: "Strategy session helps scope finance needs." },
  ],
  BOOKING_REQUEST: [
    { label: "Request a Quote", href: "/request-a-quote", reason: "Quote can be prepared ahead of the call." },
    { label: "AI Office Planner", href: "/ai-office-planner", reason: "Plan ahead of the strategy session." },
  ],
  PARTNER_REFERRAL: [
    { label: "Contact Our Team", href: "/contact", reason: "Speak directly about partnership terms." },
    { label: "Request a Quote", href: "/request-a-quote", reason: "Submit a quote on behalf of a client." },
  ],
  SUPPORT_ISSUE: [
    { label: "Call Us: 1300 977 607", href: "tel:1300977607", reason: "Direct phone support for urgent issues." },
  ],
  ADMIN_ACTION: [],
};

// ─── Closer Mode Logic ────────────────────────────────────────────────────────

function isCloserMode(
  intent: NexoraIntent,
  journeyStage: JourneyStage,
  text: string,
  profile: NexoraProfile
): boolean {
  if (["QUOTE_REQUEST", "STRATEGY_NEEDED", "PROCUREMENT", "BOOKING_REQUEST"].includes(intent)) return true;
  if (journeyStage === "converting") return true;
  if (journeyStage === "engaged" && (profile.staff || profile.budget || profile.sqm)) return true;
  if (/how much|price|cost|quote|desks for|fit.?out|delivery|urgent|asap|fast/i.test(text)) return true;
  return false;
}

// ─── Problem Solver Mode Logic ────────────────────────────────────────────────

function isProblemSolverMode(
  route: string,
  pagesVisited: string[],
  signalLog: NexoraSignal[],
  messageCount: number
): boolean {
  const repeatedRoute = pagesVisited.filter(p => p === route).length > 1;
  const abandonedConversion = pagesVisited.some(p => ["/request-a-quote", "/quote-builder"].includes(p))
    && !signalLog.some(s => s.type === "FORM_SUBMIT");
  const lowSignalsHighMessages = messageCount >= 5 && !signalLog.some(s => ["FORM_SUBMIT", "FILE_UPLOAD", "PLANNER_START"].includes(s.type));
  return repeatedRoute || abandonedConversion || lowSignalsHighMessages;
}

// ─── Blocker Detection ────────────────────────────────────────────────────────

function detectBlockers(
  route: string,
  profile: NexoraProfile,
  signalLog: NexoraSignal[],
  messageCount: number
): string[] {
  const blockers: string[] = [];
  if (!profile.staff && !profile.sqm && messageCount >= 3) blockers.push("Missing project scope — no staff count or office size provided");
  if (!profile.email && signalLog.some(s => ["FORM_START", "FORM_SUBMIT"].includes(s.type))) blockers.push("Form started but no email captured");
  if (signalLog.filter(s => s.route === route && s.type === "PAGE_VIEW").length > 2) blockers.push("User revisiting same page — possible navigation confusion");
  if (signalLog.some(s => s.type === "FILE_UPLOAD") && !signalLog.some(s => s.type === "FORM_SUBMIT")) blockers.push("File uploaded but no form submitted — journey stalled");
  return blockers;
}

// ─── Opportunity Detection ────────────────────────────────────────────────────

function detectOpportunities(
  profile: NexoraProfile,
  intent: NexoraIntent,
  journeyStage: JourneyStage,
  pagesVisited: string[]
): string[] {
  const opps: string[] = [];
  if (profile.staff && parseInt(profile.staff) >= 20) opps.push(`Large team (${profile.staff}) — high-value fitout opportunity`);
  if (profile.financeInterest) opps.push("Finance interest signals — offer lease calculator");
  if (pagesVisited.includes("/3d-office-walkthrough") && !pagesVisited.includes("/request-a-quote")) opps.push("Viewed 3D walkthrough but not yet quoted — prime conversion opportunity");
  if (intent === "PROCUREMENT") opps.push("Trade/procurement buyer — high deal value, priority routing");
  if (journeyStage === "converting") opps.push("User is conversion-ready — human escalation may close the deal");
  if (profile.industry === "legal" || profile.industry === "financial services") opps.push(`${profile.industry} industry — premium fitout buyer profile`);
  return opps;
}

// ─── Admin Summary Generation ─────────────────────────────────────────────────

function buildAdminSummary(
  intent: NexoraIntent,
  journeyStage: JourneyStage,
  urgency: "low" | "medium" | "high" | "critical",
  profile: NexoraProfile,
  dealBand: string | null,
  blockers: string[],
  opportunities: string[]
): string {
  const lines: string[] = [];
  lines.push(`[${urgency.toUpperCase()}] ${intent.replace(/_/g, " ")} · ${journeyStage}`);
  if (profile.staff) lines.push(`Team: ${profile.staff}`);
  if (profile.sqm) lines.push(`Space: ${profile.sqm}`);
  if (profile.budget) lines.push(`Budget: ${profile.budget}`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  if (profile.industry) lines.push(`Industry: ${profile.industry}`);
  if (dealBand) lines.push(`Est. deal: ${dealBand}`);
  if (opportunities.length > 0) lines.push(`Opportunities: ${opportunities.slice(0, 2).join("; ")}`);
  if (blockers.length > 0) lines.push(`Blockers: ${blockers.slice(0, 2).join("; ")}`);
  return lines.join(" | ");
}

// ─── System Context Builder ────────────────────────────────────────────────────

function buildSystemContext(decision: Omit<NexoraDecision, "systemContext">): string {
  const profile = ""; // profile lines built inline below
  return `## NEXORA EXECUTIVE OPERATING SYSTEM — ACTIVE SESSION
You are Nexora, the executive intelligence engine for The Corporate Desk. You are NOT a chat assistant. You are the platform's decision-maker, workflow controller, and commercial closer.

### Session State
- Intent: ${decision.intent.replace(/_/g, " ")}
- Journey: ${decision.journeyStage} | Urgency: ${decision.urgency} | Confidence: ${decision.confidence}%
- Closer Mode: ${decision.closerMode ? "ACTIVE — steer toward commitment" : "OFF"}
- Problem Solver Mode: ${decision.problemSolverMode ? "ACTIVE — detect and resolve friction" : "OFF"}
- Escalation Required: ${decision.escalationRequired ? "YES — suggest human contact" : "NO"}

### Next Best Action
Route user to: **${decision.nextAction.label}** (${decision.nextAction.href})
Reason: ${decision.nextAction.reason}

### Nexora Response Rules
1. Be decisive — give one clear recommendation, not a menu of vague options
2. In Closer Mode: move toward quote, planner, or call booking — every response must advance commitment
3. In Problem Solver Mode: diagnose friction, offer the clearest alternative path, never let the journey die
4. When recommending navigation: embed [[route:${decision.nextAction.href}|${decision.nextAction.label}]] in your response
5. Reference known user data naturally — never re-ask for information already provided
6. Escalation signal: if the user has high urgency and a clear project, suggest speaking to the team directly
7. You output structured guidance, not generic chat replies
${decision.blockers.length > 0 ? `\n### Active Blockers\n${decision.blockers.map(b => `- ${b}`).join("\n")}` : ""}
${decision.opportunities.length > 0 ? `\n### Opportunities Detected\n${decision.opportunities.map(o => `- ${o}`).join("\n")}` : ""}`.trim();
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export function runNexoraEngine(input: NexoraInput): NexoraDecision {
  const intent = classifyIntent(input.messageText, input.currentRoute, input.pagesVisited, input.signalLog);
  const journeyStage = calcJourneyStage(input.messageCount, input.pagesVisited, input.userProfile, input.signalLog, intent);
  const confidence = calcConfidence(input.userProfile, input.signalLog, input.messageCount);
  const urgency = calcUrgency(journeyStage, intent, input.userProfile, input.signalLog, confidence);
  const closerMode = isCloserMode(intent, journeyStage, input.messageText, input.userProfile);
  const problemSolverMode = isProblemSolverMode(input.currentRoute, input.pagesVisited, input.signalLog, input.messageCount);
  const escalationRequired = urgency === "critical" || (urgency === "high" && confidence >= 70 && journeyStage === "converting");
  const dealBand = estimateDealBand(input.userProfile, intent);
  const blockers = detectBlockers(input.currentRoute, input.userProfile, input.signalLog, input.messageCount);
  const opportunities = detectOpportunities(input.userProfile, intent, journeyStage, input.pagesVisited);
  const nextAction = PRIMARY_ACTIONS[intent];
  const alternateActions = ALTERNATE_ACTIONS[intent] ?? [];
  const adminSummary = buildAdminSummary(intent, journeyStage, urgency, input.userProfile, dealBand, blockers, opportunities);

  const service = {
    LAYOUT_PLANNING: "AI Office Planner",
    QUOTE_REQUEST: "Quote Request",
    STRATEGY_NEEDED: "Strategy Consultation",
    PROCUREMENT: "Trade Procurement",
    FINANCE_INQUIRY: "Workspace Finance",
    ADMIN_ACTION: "Strategy Consultation",
    EXPLORE: "Product Catalogue",
    SUPPORT_ISSUE: "Support",
    PRODUCT_BROWSE: "Product Catalogue",
    BOOKING_REQUEST: "Strategy Consultation",
    PARTNER_REFERRAL: "Partner Network",
    BUDGET_INQUIRY: "Quote Builder",
  }[intent] ?? null;

  const profileParts: string[] = [];
  if (input.userProfile.staff) profileParts.push(`Team: ${input.userProfile.staff}`);
  if (input.userProfile.sqm) profileParts.push(`Space: ${input.userProfile.sqm}`);
  if (input.userProfile.budget) profileParts.push(`Budget: ${input.userProfile.budget}`);
  if (input.userProfile.location) profileParts.push(`Location: ${input.userProfile.location}`);
  if (input.userProfile.industry) profileParts.push(`Industry: ${input.userProfile.industry}`);

  const leadUpdate: NexoraLeadUpdate | null =
    urgency === "critical" || (urgency !== "low" && (confidence >= 40 || profileParts.length >= 2))
      ? {
          intent,
          service,
          urgency,
          confidence,
          estimatedDealBand: dealBand,
          notes: [
            `Intent: ${intent.replace(/_/g, " ")}`,
            `Journey: ${journeyStage}`,
            `Confidence: ${confidence}%`,
            profileParts.join(", "),
            input.pagesVisited.length > 0 ? `Visited: ${input.pagesVisited.join(", ")}` : null,
            input.messageText ? `Query: "${input.messageText.substring(0, 120)}"` : null,
            adminSummary,
          ]
            .filter(Boolean)
            .join(" | "),
        }
      : null;

  const partialDecision = {
    intent, journeyStage, urgency, confidence, closerMode, problemSolverMode,
    nextAction, alternateActions, blockers, opportunities, escalationRequired, adminSummary, leadUpdate,
  };

  return {
    ...partialDecision,
    systemContext: buildSystemContext(partialDecision),
  };
}
