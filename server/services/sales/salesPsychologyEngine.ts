export type DealStage =
  | "new_lead"
  | "qualified_lead"
  | "discovery_started"
  | "requirements_received"
  | "floor_plan_received"
  | "supplier_rfqs_requested"
  | "supplier_pricing_received"
  | "installer_quote_requested"
  | "installer_quote_received"
  | "customer_quote_drafted"
  | "customer_quote_sent"
  | "follow_up_1"
  | "follow_up_2"
  | "follow_up_3"
  | "finance_offered"
  | "deposit_requested"
  | "deposit_paid"
  | "supplier_order_started"
  | "shipping_booked"
  | "install_scheduled"
  | "completed"
  | "review_referral_requested"
  | "lost_or_paused";

export type CustomerIntent =
  | "browse"
  | "quote"
  | "layout_help"
  | "finance"
  | "price_objection"
  | "timing_objection"
  | "quality_concern"
  | "delivery_install_question"
  | "ready_to_buy"
  | "unknown";

export type SalesTone = {
  warmth: number;
  humour: "none" | "light" | "moderate";
  confidence: "soft" | "balanced" | "direct";
  pressure: "none";
};

export type QuoteReadinessInput = {
  manufacturerCost?: number | null;
  shippingCost?: number | null;
  installerCost?: number | null;
  gstKnown?: boolean;
  marginKnown?: boolean;
  depositKnown?: boolean;
  leadTimeKnown?: boolean;
  quoteValidityKnown?: boolean;
  riskNotesKnown?: boolean;
};

export type SupplierReplyParseResult = {
  ok: boolean;
  detectedCurrency?: "AUD" | "USD" | "CNY" | "UNKNOWN";
  unitCost?: number;
  totalCost?: number;
  leadTimeDays?: number;
  cbm?: number;
  warranty?: string;
  customisation?: string;
  shippingNotes?: string;
  rawText: string;
  needsHumanReview: boolean;
};

export const DEAL_STAGES: { stage: DealStage; label: string; customerMeaning: string; internalAction: string }[] = [
  {
    stage: "new_lead",
    label: "New Lead",
    customerMeaning: "A new customer has shown interest.",
    internalAction: "Qualify the customer before any serious automation."
  },
  {
    stage: "qualified_lead",
    label: "Qualified Lead",
    customerMeaning: "The customer appears relevant and worth helping.",
    internalAction: "Start discovery and collect requirements."
  },
  {
    stage: "discovery_started",
    label: "Discovery Started",
    customerMeaning: "The customer is being guided through what they need.",
    internalAction: "Ask budget, timeline, size, location, style and install needs."
  },
  {
    stage: "requirements_received",
    label: "Requirements Received",
    customerMeaning: "The customer has given enough detail to start planning.",
    internalAction: "Prepare product/layout options and identify supplier needs."
  },
  {
    stage: "floor_plan_received",
    label: "Floor Plan Received",
    customerMeaning: "The customer has uploaded or provided a floor plan.",
    internalAction: "Use floor plan/layout details to improve the quote."
  },
  {
    stage: "supplier_rfqs_requested",
    label: "Supplier RFQs Requested",
    customerMeaning: "Internal supplier pricing is being collected.",
    internalAction: "Ask approved manufacturers for Chinese-first RFQs."
  },
  {
    stage: "supplier_pricing_received",
    label: "Supplier Pricing Received",
    customerMeaning: "Supplier pricing is available internally.",
    internalAction: "Parse supplier replies and calculate landed cost."
  },
  {
    stage: "installer_quote_requested",
    label: "Installer Quote Requested",
    customerMeaning: "Install pricing is being checked.",
    internalAction: "Email installer with scope and location."
  },
  {
    stage: "installer_quote_received",
    label: "Installer Quote Received",
    customerMeaning: "Install pricing is available internally.",
    internalAction: "Add install cost into internal quote model."
  },
  {
    stage: "customer_quote_drafted",
    label: "Customer Quote Drafted",
    customerMeaning: "A clean customer quote is ready for review.",
    internalAction: "Check profit, GST, validity, risk and finance options."
  },
  {
    stage: "customer_quote_sent",
    label: "Customer Quote Sent",
    customerMeaning: "The customer has received the quote.",
    internalAction: "Begin helpful follow-up sequence."
  },
  {
    stage: "finance_offered",
    label: "Finance Offered",
    customerMeaning: "Finance/staged payment has been offered.",
    internalAction: "Position finance as reducing upfront pressure."
  },
  {
    stage: "deposit_requested",
    label: "Deposit Requested",
    customerMeaning: "The next step is deposit/payment.",
    internalAction: "Provide checkout/payment link and next steps."
  },
  {
    stage: "deposit_paid",
    label: "Deposit Paid",
    customerMeaning: "The project can move into fulfilment.",
    internalAction: "Confirm supplier order, shipping and install timing."
  },
  {
    stage: "completed",
    label: "Completed",
    customerMeaning: "The project has been delivered/completed.",
    internalAction: "Ask for review, referral and future work."
  },
  {
    stage: "lost_or_paused",
    label: "Lost or Paused",
    customerMeaning: "The customer is not proceeding right now.",
    internalAction: "Record reason and avoid annoying follow-up."
  }
];

export const ETHICAL_SALES_RULES = [
  "Never lie, pressure, shame, manipulate, fake urgency or fake discounts.",
  "Never pretend a supplier, installer or customer said something they did not say.",
  "Never claim a deal is closed without acceptance, deposit or payment evidence.",
  "Never expose supplier cost, internal margin or manufacturer details in customer-facing quotes.",
  "Use humour only lightly and naturally; never mock the customer.",
  "Reduce decision stress by giving two or three strong options, not a wall of choices.",
  "If the customer is confused, simplify. If they are worried, reassure with facts.",
  "If price is the blocker, offer finance, staged rollout or adjusted scope.",
  "If timing is the blocker, explain lead times and identify faster options.",
  "Always move toward a clear next step."
];

export const SALES_PSYCHOLOGY_PLAYBOOK = {
  mission:
    "Help the customer feel understood, reduce buying stress, explain value clearly and guide them toward the right next step without pressure.",
  tone: {
    warmth: 9,
    humour: "light",
    confidence: "balanced",
    pressure: "none"
  } satisfies SalesTone,
  principles: [
    "Mirror the customer’s goal in plain English.",
    "Make the buying process feel simple and safe.",
    "Use one small human line where appropriate to make the customer smile.",
    "Ask smart discovery questions before recommending.",
    "Recommend a small number of strong options.",
    "Frame value around reduced stress, better appearance, staff comfort, fewer mistakes and smoother delivery.",
    "Close softly with a clear next step."
  ],
  safeHumourExamples: [
    "Office furniture quotes can turn into a spreadsheet horror movie pretty quickly — let’s keep this simple.",
    "No one wakes up excited to compare 47 chair options. I’ll narrow it down to the few that actually make sense.",
    "Let’s avoid the classic office fitout trap: beautiful furniture, mystery budget, and chaos on delivery day."
  ],
  softCloseExamples: [
    "Want me to turn this into a proper quote?",
    "Would you like me to show the finance option as well?",
    "Want me to check delivery and install before we finalise it?",
    "Do you want the practical option, the premium option, or a balanced middle option?"
  ],
  objectionHandling: {
    price:
      "Acknowledge the concern, explain what drives the cost, then offer finance, staged rollout, alternate products or scope adjustment.",
    timing:
      "Clarify deadline, explain lead time honestly, then identify faster options or staged delivery.",
    uncertainty:
      "Reduce choices, summarise the recommended path and offer a simple next step.",
    quality:
      "Explain warranty, materials, supplier confidence and why the recommendation fits the use case."
  }
};

export function detectCustomerIntent(input: string): CustomerIntent {
  const text = input.toLowerCase();

  if (/(finance|payment plan|lease|monthly|can't pay upfront|upfront|cash flow)/i.test(text)) return "finance";
  if (/(too expensive|price|cost|cheaper|budget|discount)/i.test(text)) return "price_objection";
  if (/(urgent|fast|quick|timeline|lead time|when can|how long)/i.test(text)) return "timing_objection";
  if (/(quality|warranty|last|durable|material|cheap looking)/i.test(text)) return "quality_concern";
  if (/(delivery|install|assembly|installer|shipping|freight)/i.test(text)) return "delivery_install_question";
  if (/(quote|price me|send.*quote|proposal|estimate)/i.test(text)) return "quote";
  if (/(layout|floor plan|design|space plan|fitout plan)/i.test(text)) return "layout_help";
  if (/(buy|go ahead|pay|deposit|approve|accept)/i.test(text)) return "ready_to_buy";
  if (/(desk|chair|reception|boardroom|workstation|furniture)/i.test(text)) return "browse";

  return "unknown";
}

export function buildPsychologyGuidance(input: {
  customerMessage?: string;
  stage?: DealStage;
  customerIntent?: CustomerIntent;
}) {
  const intent = input.customerIntent || detectCustomerIntent(input.customerMessage || "");
  const stage = input.stage || "new_lead";

  const base = [
    "Be warm, useful and commercially sharp.",
    "Make the customer feel understood before recommending.",
    "Use light humour only if it feels natural.",
    "Ask for missing buying information: budget, timeline, delivery suburb, quantity, style and install needs.",
    "Recommend two or three options maximum.",
    "Use soft next-step closes.",
    "Never pressure, fake scarcity or invent facts."
  ];

  const intentGuidance: Record<CustomerIntent, string[]> = {
    browse: [
      "Help the customer narrow the range.",
      "Ask what look, budget and timeframe they want."
    ],
    quote: [
      "Move toward a proper quote.",
      "Confirm product, quantity, delivery location, installation and finance needs."
    ],
    layout_help: [
      "Encourage floor plan upload.",
      "Explain that layout first prevents overbuying and fitout mistakes."
    ],
    finance: [
      "Position finance as reducing upfront pressure.",
      "Avoid promising approval; say finance options can be explored."
    ],
    price_objection: [
      "Acknowledge price concern without defensiveness.",
      "Offer finance, staged rollout, alternate products or revised scope."
    ],
    timing_objection: [
      "Clarify deadline.",
      "Explain lead times honestly and offer faster alternatives if available."
    ],
    quality_concern: [
      "Explain materials, warranty, intended use and supplier confidence."
    ],
    delivery_install_question: [
      "Clarify address, access, lift/loading dock and install scope.",
      "Do not finalise quote until shipping/install costs are checked."
    ],
    ready_to_buy: [
      "Confirm acceptance, deposit/payment link and next steps.",
      "Do not mark closed unless payment/deposit/acceptance evidence exists."
    ],
    unknown: [
      "Ask one simple question to clarify what the customer needs."
    ]
  };

  return {
    ok: true,
    stage,
    intent,
    guidance: [...base, ...(intentGuidance[intent] || [])],
    playbook: SALES_PSYCHOLOGY_PLAYBOOK,
    ethicalRules: ETHICAL_SALES_RULES
  };
}

export function buildChatbotSystemInstruction() {
  return `
You are The Corporate Desk AI workspace advisor.

Your job:
- Help Australian businesses plan office furniture, fitouts, layouts, quotes, finance and delivery.
- Make the customer feel understood, calm and confident.
- Use light, natural humour only when appropriate.
- Ask smart buying questions before recommending.
- Reduce confusion by giving 2-3 clear options.
- Explain value in practical terms: staff comfort, better presentation, fewer mistakes, smoother delivery, budget control and finance options.
- Move toward a clear next step: upload floor plan, build quote, request finance, approve quote or book follow-up.

Rules:
${ETHICAL_SALES_RULES.map((rule) => `- ${rule}`).join("\n")}

Useful line style:
- "Office furniture quotes can turn into a spreadsheet horror movie pretty quickly — let’s keep this simple."
- "No one wants a beautiful office and a mystery budget. I’ll help keep both under control."
- "Let’s narrow this down to the few options that actually make sense for your budget, timing and look."

Soft closes:
${SALES_PSYCHOLOGY_PLAYBOOK.softCloseExamples.map((line) => `- ${line}`).join("\n")}
`.trim();
}

export function canSendCustomerQuote(input: QuoteReadinessInput) {
  const missing: string[] = [];

  if (typeof input.manufacturerCost !== "number") missing.push("manufacturer_cost");
  if (typeof input.shippingCost !== "number") missing.push("shipping_cost");
  if (typeof input.installerCost !== "number") missing.push("installer_cost");
  if (input.gstKnown !== true) missing.push("gst");
  if (input.marginKnown !== true) missing.push("margin");
  if (input.depositKnown !== true) missing.push("deposit_required");
  if (input.leadTimeKnown !== true) missing.push("lead_time");
  if (input.quoteValidityKnown !== true) missing.push("quote_validity");
  if (input.riskNotesKnown !== true) missing.push("risk_notes");

  return {
    ok: missing.length === 0,
    canSend: missing.length === 0,
    missing,
    rule:
      "Nexora must not send a customer quote until cost, margin, GST, deposit, lead time, validity and risk notes are known."
  };
}

function parseFirstNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  if (!match) return undefined;
  const raw = match[1] || match[0];
  const cleaned = raw.replace(/[,¥$audusdcnya-z\s]/gi, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

export function parseSupplierReply(rawText: string): SupplierReplyParseResult {
  const text = rawText || "";
  const lower = text.toLowerCase();

  const detectedCurrency =
    /¥|rmb|cny|yuan/i.test(text) ? "CNY" :
    /\busd\b|us\$|\$us/i.test(text) ? "USD" :
    /\baud\b|a\$|\$|incl gst|gst/i.test(text) ? "AUD" :
    "UNKNOWN";

  const unitCost =
    parseFirstNumber(/(?:unit|each|price|单价|报价)[^\d¥$]*(¥?\$?\s?[\d,]+(?:\.\d+)?)/i, text) ||
    parseFirstNumber(/(¥\s?[\d,]+(?:\.\d+)?)/i, text) ||
    parseFirstNumber(/(\$\s?[\d,]+(?:\.\d+)?)/i, text);

  const totalCost =
    parseFirstNumber(/(?:total|合计|总价)[^\d¥$]*(¥?\$?\s?[\d,]+(?:\.\d+)?)/i, text);

  const leadTimeDays =
    parseFirstNumber(/(\d+)\s*(?:days|day|天)/i, text) ||
    parseFirstNumber(/(?:lead time|production|交期|生产)[^\d]*(\d+)/i, text);

  const cbm =
    parseFirstNumber(/([\d.]+)\s*(?:cbm|m3|立方)/i, text);

  const warrantyMatch = text.match(/(?:warranty|保修)[^\n。.]*/i);
  const customMatch = text.match(/(?:custom|customise|customize|定制|颜色|尺寸)[^\n。.]*/i);
  const shippingMatch = text.match(/(?:shipping|freight|delivery|运费|物流|海运)[^\n。.]*/i);

  const needsHumanReview =
    !unitCost ||
    detectedCurrency === "UNKNOWN" ||
    (!leadTimeDays && !/stock|available|现货/i.test(lower));

  return {
    ok: true,
    detectedCurrency,
    unitCost,
    totalCost,
    leadTimeDays,
    cbm,
    warranty: warrantyMatch?.[0],
    customisation: customMatch?.[0],
    shippingNotes: shippingMatch?.[0],
    rawText,
    needsHumanReview
  };
}

export function buildFollowUpPlan(input: {
  quoteSentAt?: string;
  customerName?: string;
  quoteNumber?: string;
  hasFinanceOption?: boolean;
}) {
  const name = input.customerName || "there";
  const quote = input.quoteNumber || "your quote";

  return {
    ok: true,
    followUps: [
      {
        day: 1,
        purpose: "helpful_check_in",
        message: `Hi ${name}, just checking you received ${quote}. Any questions, or would you like me to simplify the options?`
      },
      {
        day: 3,
        purpose: "reduce_decision_stress",
        message: `Hi ${name}, office furniture decisions can get messy fast. Want me to narrow ${quote} down into the practical option, premium option, and best-value option?`
      },
      {
        day: 5,
        purpose: "finance_or_scope",
        message: input.hasFinanceOption
          ? `Hi ${name}, would a finance/monthly payment option make this easier to move forward?`
          : `Hi ${name}, if budget is the blocker, I can look at a staged rollout or revised scope so the project still moves forward.`
      },
      {
        day: 7,
        purpose: "soft_close_or_revise",
        message: `Hi ${name}, should I keep ${quote} open as-is, revise it, or put it on hold for now?`
      }
    ],
    rule: "Follow-ups must be helpful, low-pressure and stop if the customer opts out or says no."
  };
}
