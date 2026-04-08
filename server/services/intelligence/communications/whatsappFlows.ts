// server/services/intelligence/communications/whatsappFlows.ts
// FIXED: Removed dependency on missing whatsappSequences

type WhatsAppMessage = {
  text: string;
};

type WhatsAppFlow = {
  name: string;
  messages: WhatsAppMessage[];
};

// ✅ All flows now defined inline (no external import)
export const whatsappFlows: Record<string, WhatsAppFlow> = {
  initial_outreach: {
    name: "Initial Outreach",
    messages: [
      {
        text: "Hi {{name}}, just reaching out regarding your workspace setup. We help businesses design and furnish offices end-to-end.",
      },
      {
        text: "Would you be open to a quick 10-min chat this week?",
      },
    ],
  },

  follow_up_1: {
    name: "Follow Up 1",
    messages: [
      {
        text: "Just circling back — happy to share a quick layout or estimate if helpful.",
      },
    ],
  },

  follow_up_2: {
    name: "Follow Up 2",
    messages: [
      {
        text: "We recently helped a similar company optimise their office and save costs — worth exploring?",
      },
    ],
  },
};

// Helper
export function getWhatsAppFlow(flowName: string): WhatsAppFlow | null {
  return whatsappFlows[flowName] || null;
}
