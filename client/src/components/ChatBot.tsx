// src/components/ChatBot.tsx
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Minimize2, Paperclip, Send, Sparkles, X } from "lucide-react";
import {
  useConcierge,
  type ConversationMessage,
  type UserProfile,
} from "@/contexts/ConciergeContext";

/**
 * Nexora AI Chatbot Component
 *
 * - Greets once per route-open session
 * - Streaming responses (SSE-ish "data: ..." format)
 * - Image attachment preview (base64)
 * - Contextual quick replies + CTA cards
 */
export default function ChatBot() {
  const [location] = useLocation();

  const {
    isOpen,
    setIsOpen,
    messages,
    addMessage,
    updateLastMessage,
    userProfile,
    updateProfile,
    signalLog,
    addSignal,
    previousPage,
  } = useConcierge();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [nexoraDecision, setNexoraDecision] = useState<NexoraDecision | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [isMinimised, setIsMinimised] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageCountRef = useRef(0);
  const hasGreetedRef = useRef<string | null>(null);

  useEffect(() => {
    injectStyles();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;

    const greetingKey = `${location}:${String(isOpen)}`;
    if (hasGreetedRef.current === greetingKey) return;
    hasGreetedRef.current = greetingKey;

    if (messages.length === 0) {
      const greeting = PAGE_GREETINGS[location] ?? DEFAULT_GREETING;
      addMessage?.({ role: "assistant", content: greeting });
    }
  }, [isOpen, location, messages.length, addMessage]);

  useEffect(() => {
    if (isOpen && !isMinimised) window.setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen, isMinimised]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const baseQuickReplies = useMemo(() => {
    return PAGE_QUICK_REPLIES[location] ?? DEFAULT_QUICK_REPLIES;
  }, [location]);

  const quickRepliesToShow = useMemo(() => {
    if (messageCountRef.current >= 2) return FOLLOWUP_QUICK_REPLIES;
    return baseQuickReplies;
  }, [baseQuickReplies, messages.length]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleFileAttach = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachedImageUrl((ev.target?.result as string) ?? null);
      reader.readAsDataURL(file);
    } else {
      setAttachedImageUrl(null);
    }

    e.target.value = "";
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachedFile(null);
    setAttachedImageUrl(null);
  }, []);

  const handleClose = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsMinimised(false);
    setIsOpen(false);
  }, [setIsOpen]);

  const handleMinimise = useCallback(() => {
    setIsMinimised((v) => !v);
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const sendMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || isLoading) return;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      messageCountRef.current += 1;
      setShowQuickReplies(false);
      setShowCTA(false);

      const profileUpdates = extractProfileFromText(trimmed);
      if (Object.keys(profileUpdates).length > 0) updateProfile?.(profileUpdates);

      const mergedProfile: UserProfile = { ...userProfile, ...profileUpdates };

      const userMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        ...(attachedImageUrl ? { imageUrl: attachedImageUrl } : {}),
      };

      addMessage?.(userMsg);
      setInput("");
      clearAttachment();

      if (inputRef.current) inputRef.current.style.height = "auto";

      setIsLoading(true);

      const history = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const decision = buildNexoraDecision({
        message: trimmed,
        location,
        previousPage: previousPage ?? null,
        profile: mergedProfile,
        history,
        signalLog,
        messageCount: messageCountRef.current,
      });

      setNexoraDecision(decision);

      addSignal?.({
        type: "message",
        intent: decision.intent,
        stage: decision.journeyStage,
        urgency: decision.urgency,
        timestamp: Date.now(),
      });

      addMessage?.({ role: "assistant", content: "", isStreaming: true });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            messages: [...history, { role: "user", content: trimmed }],
            systemContext: decision.systemContext,
            adminSummary: decision.adminSummary,
            leadUpdate: decision.leadUpdate,
          }),
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line) continue;

              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (!data || data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const delta =
                    parsed.choices?.[0]?.delta?.content ??
                    parsed.delta?.text ??
                    parsed.text ??
                    "";

                  if (delta) {
                    accumulated += delta;
                    updateLastMessage?.(accumulated, true);
                  }
                } catch {
                  accumulated += data;
                  updateLastMessage?.(accumulated, true);
                }
              } else if (!line.startsWith(":")) {
                accumulated += line;
                updateLastMessage?.(accumulated, true);
              }
            }
          }

          if (buffer.trim()) {
            accumulated += buffer;
          }

          updateLastMessage?.(accumulated, false);
        } else {
          const data = await res.json();
          const content =
            data.message ??
            data.content ??
            data.reply ??
            "I'm here to help. What would you like to know?";

          updateLastMessage?.(content, false);
        }

        setShowCTA(true);
        if (messageCountRef.current >= 2) setShowQuickReplies(true);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") {
          updateLastMessage?.("", false);
          return;
        }

        // eslint-disable-next-line no-console
        console.error("[ChatBot] API error:", err);
        updateLastMessage?.(
          "I'm having trouble connecting right now. Please try again, or call us on **1300 977 607**.",
          false
        );
        setShowCTA(true);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      messages,
      location,
      previousPage,
      userProfile,
      signalLog,
      attachedImageUrl,
      addMessage,
      updateLastMessage,
      updateProfile,
      addSignal,
      clearAttachment,
    ]
  );

  const handleSubmit = useCallback(() => {
    void sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && input.trim()) void sendMessage(input);
      }
    },
    [input, isLoading, sendMessage]
  );

  const handleQuickReply = useCallback(
    (reply: string) => {
      void sendMessage(reply);
    },
    [sendMessage]
  );

  if (!isOpen) return null;

  const showTyping = isLoading && Boolean(messages[messages.length - 1]?.isStreaming);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className={[
          "fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-2xl shadow-2xl",
          "w-[calc(100vw-2rem)] max-w-sm md:w-96",
          "border border-[rgba(201,168,76,0.15)] bg-[hsl(220,20%,8%)]",
          "transition-all duration-300",
          isMinimised ? "h-14" : "h-[600px] max-h-[85vh]",
        ].join(" ")}
        style={{
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.08)",
        }}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(201,168,76,0.1)] bg-[hsl(220,20%,7%)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.15)]">
              <Sparkles className="h-4 w-4 text-[hsl(43,78%,60%)]" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(220,20%,7%)] bg-emerald-400" />
            </div>

            <div>
              <p className="text-sm font-semibold leading-none text-white/90">Nexora</p>
              <p className="mt-0.5 text-[10px] leading-none text-[hsl(43,78%,55%)]">
                {PAGE_LABELS[location] ?? "AI Workspace Advisor"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleMinimise}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
              aria-label={isMinimised ? "Expand chat" : "Minimise chat"}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimised && (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-4 scroll-smooth">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {showTyping && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {nexoraDecision && showCTA && (
              <NexoraActionCard decision={nexoraDecision} onNavigate={() => setShowCTA(false)} />
            )}

            {showCTA && !nexoraDecision && <CTACard location={location} />}

            {showQuickReplies && (
              <QuickReplies
                replies={quickRepliesToShow}
                onSelect={handleQuickReply}
                disabled={isLoading}
              />
            )}

            {attachedFile && (
              <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.06)] px-3 py-2">
                {attachedImageUrl ? (
                  <img
                    src={attachedImageUrl}
                    alt="Attachment preview"
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="h-4 w-4 text-[hsl(43,78%,55%)]" />
                )}

                <span className="flex-1 truncate text-xs text-white/60">{attachedFile.name}</span>

                <button type="button" onClick={clearAttachment} className="text-white/40">
                  ×
                </button>
              </div>
            )}

            <div className="border-t border-[rgba(201,168,76,0.1)] bg-[hsl(220,20%,7%)] px-3 py-3">
              <div className="flex items-end gap-2 rounded-xl border border-[rgba(201,168,76,0.15)] bg-[hsl(220,18%,10%)] px-3 py-2">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach} />

                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={isLoading}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Nexora anything..."
                  className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  rows={1}
                />

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !input.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(43,78%,55%)] text-[hsl(220,20%,8%)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Page Configuration
 * ────────────────────────────────────────────────────────────────────────────── */

interface QuickReply {
  label: string;
  value: string;
}

interface CTAConfig {
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  tertiary: { label: string; href: string };
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Homepage",
  "/catalog": "Product Catalogue",
  "/workplace-solutions": "Workplace Solutions",
  "/ai-office-planner": "AI Office Planner",
  "/upload-your-floor-plan": "Floor Plan Upload",
  "/free-layout-plan": "Free Layout Plan",
  "/free-office-layout-plan": "Free Layout Plan",
  "/3d-office-walkthrough": "3D Office Walkthrough",
  "/quote-builder": "Quote Builder",
  "/request-a-quote": "Request a Quote",
  "/send-us-your-quote": "Request a Quote",
  "/finance-your-workspace": "Finance Your Workspace",
  "/trade-project-procurement": "Trade & Project Procurement",
  "/strategy-call": "Strategy Consultation",
  "/workplace-strategy": "Strategy Consultation",
  "/partners": "Partner Network",
  "/about": "About The Corporate Desk",
  "/contact": "Contact Page",
  "/case-studies": "Case Studies",
  "/testimonials": "Client Testimonials",
  "/blog": "Blog & Insights",
  "/start": "Get Started",
  "/capability": "Capability Statement",
};

const PAGE_GREETINGS: Record<string, string> = {
  "/": "Welcome to The Corporate Desk. I'm your AI workspace advisor — here to help scope fitouts, navigate our range, and guide your next step. What are you working on?",
  "/catalog": "You're browsing our product catalogue. I can narrow this down to exactly what suits your space, team size, and aesthetic. What type of furniture are you looking for?",
  "/workplace-solutions": "Looking at fitout options? I can walk you through our process, help scope your project, or give you an indicative budget range. Where are you at with planning?",
  "/ai-office-planner": "You're at our AI Office Planner — upload your floor plan and brief, and our AI returns a full zone layout, SKU package, and cost estimate in minutes. Any questions before you start?",
  "/upload-your-floor-plan": "Upload your floor plan here and our specialists will create a professional workspace layout tailored to your team. Any questions about the process?",
  "/free-layout-plan": "Our free layout plan is the most popular starting point for office fitouts — no obligation, just a professional workspace concept designed by our team. How can I help?",
  "/free-office-layout-plan": "Our free layout plan is the most popular starting point for office fitouts — no obligation, just a professional CAD layout. How can I help?",
  "/3d-office-walkthrough": "The 3D walkthrough lets you visualise your workspace before committing a dollar. I can explain how it works or help you get started. What's your project about?",
  "/quote-builder": "You're in our Quote Builder — I'm your AI quoting advisor. Let me guide you toward an accurate budget for your project. What type of workspace are you fitting out?",
  "/request-a-quote": "You're ready to request a quote — great. I can help you include the right specifications for an accurate response. What products or scope are you quoting for?",
  "/send-us-your-quote": "You're ready to get a quote — great. I can help you include the right specifications for an accurate response. What products or scope are you quoting for?",
  "/finance-your-workspace": "Finance can be a smart way to preserve cash flow on a large fitout. I can explain options, give indicative repayment estimates, or help you decide if finance suits your situation.",
  "/trade-project-procurement": "You're looking at our trade procurement service — built for project managers, interior designers, and commercial property teams. What type of project are you working on?",
  "/strategy-call": "A strategy consultation is ideal for complex or large-scale projects. I can help answer questions or let you know exactly what to expect. What's the nature of your project?",
  "/workplace-strategy": "A workplace strategy session is the right starting point for complex fitouts. I can answer questions about what to prepare and what to expect. What's your project?",
  "/partners": "Interested in our referral partner program? I can walk you through commission structures, how to register, and how to submit referrals. What's your role?",
  "/about": "Getting to know the business? I can share more about our certifications, process, product range, or what makes us different. What's most relevant to you?",
  "/contact": "Happy to help before you reach out — I can often answer faster than a callback. What's on your mind?",
  "/case-studies": "Seeing real results from real projects builds confidence. I can answer questions about any of these fitouts or help you think through how we'd approach yours.",
  "/blog": "Insights and analysis from the world of commercial fit-outs. I can help you find what's most relevant to your situation.",
  "/capability": "Looking at our capability statement? I can walk you through our certifications, project history, and what sets us apart from other suppliers.",
  "/start": "Let's find the right path for you. Tell me a bit about your project — team size, timeline, budget — and I'll point you to the best next step.",
};

const DEFAULT_GREETING =
  "Welcome to The Corporate Desk. I'm your AI workspace advisor — here to help with products, pricing, fitouts, and more. What brings you here today?";

const PAGE_QUICK_REPLIES: Record<string, QuickReply[]> = {
  "/": [
    { label: "Browse 301 SKUs", value: "What products do you carry across your 301-SKU catalogue?" },
    { label: "GOJO Vol 2 luxury range", value: "Tell me about the GOJO Vol 2 — JN, YOM and HXM series" },
    { label: "Full fitout pricing", value: "What are your pricing ranges for a typical office fitout?" },
    { label: "ISO certifications", value: "What certifications do you hold and what is your warranty?" },
  ],
  "/catalog": [
    { label: "Best range for executives", value: "Which product range suits an executive office best?" },
    { label: "Finance available?", value: "Do you offer finance options on furniture orders?" },
    { label: "Delivery & lead times", value: "What are your typical delivery and lead times?" },
    { label: "Get a quote", value: "How do I get a quote for a specific product?" },
  ],
};

const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { label: "Browse products", value: "What products do you carry?" },
  { label: "Fitout pricing", value: "What are your pricing ranges for a typical office fitout?" },
  { label: "AI Office Planner", value: "Tell me about your AI Office Planner" },
  { label: "ISO certifications", value: "What certifications do you hold?" },
];

const FOLLOWUP_QUICK_REPLIES: QuickReply[] = [
  { label: "Free layout plan", value: "I'd like to get a free office layout plan" },
  { label: "Request a quote", value: "I'd like to request a quote for my project" },
  { label: "Book strategy call", value: "I'd like to book a workplace strategy consultation" },
  { label: "Talk to someone", value: "How can I speak to someone on your team?" },
];

const PAGE_CTAS: Record<string, CTAConfig> = {
  "/": {
    primary: { label: "AI Office Planner", href: "/ai-office-planner" },
    secondary: { label: "Request a Quote", href: "/request-a-quote" },
    tertiary: { label: "Book a Strategy Call", href: "/strategy-call" },
  },
};

const DEFAULT_CTA: CTAConfig = {
  primary: { label: "AI Office Planner", href: "/ai-office-planner" },
  secondary: { label: "Request a Quote", href: "/request-a-quote" },
  tertiary: { label: "Book a Strategy Call", href: "/strategy-call" },
};

/* ──────────────────────────────────────────────────────────────────────────────
 * Decision Engine
 * ────────────────────────────────────────────────────────────────────────────── */

type NexoraJourneyStage = "exploring" | "qualifying" | "engaged" | "converting";
type NexoraUrgency = "low" | "medium" | "high";
type NexoraIntent =
  | "general_enquiry"
  | "product_browse"
  | "quote_request"
  | "fitout_project"
  | "planner_request"
  | "finance_enquiry"
  | "strategy_call"
  | "partner_enquiry"
  | "sales_contact";

interface NexoraDecision {
  intent: NexoraIntent;
  journeyStage: NexoraJourneyStage;
  urgency: NexoraUrgency;
  confidence: number;
  adminSummary: string;
  systemContext: string;
  nextAction: { label: string; href: string };
  escalationRequired: boolean;
  closerMode: boolean;
  leadUpdate: {
    notes: string;
    estimatedDealBand?: string;
    service?: string;
  };
}

function estimateDealBand(profile: UserProfile, message: string): string | undefined {
  const text = message.toLowerCase();
  const sqm = Number(String((profile as any).sqm ?? "").replace(/[^\d]/g, "")) || 0;
  const staff = Number(String((profile as any).staff ?? "").replace(/[^\d]/g, "")) || 0;
  const budgetText = String((profile as any).budget ?? "").toLowerCase();

  if (
    sqm >= 500 ||
    staff >= 50 ||
    /\b(enterprise|hq|head office|headquarters|relocation|fitout|fit-out)\b/.test(text) ||
    /\b(100k|150k|200k|250k|300k)\b/.test(budgetText)
  ) {
    return "$100k+";
  }
  if (
    sqm >= 150 ||
    staff >= 15 ||
    /\b(quote|procurement|boardroom|executive|reception|strategy)\b/.test(text)
  ) {
    return "$25k-$100k";
  }
  if (sqm > 0 || staff > 0 || /\b(desk|chair|catalog|product|furniture)\b/.test(text)) {
    return "$5k-$25k";
  }
  return undefined;
}

function buildNexoraDecision(args: {
  message: string;
  location: string;
  previousPage: string | null;
  profile: UserProfile;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  signalLog: unknown[];
  messageCount: number;
}): NexoraDecision {
  const { message, location, previousPage, profile, history, signalLog, messageCount } = args;
  const text = message.toLowerCase();

  let intent: NexoraIntent = "general_enquiry";
  let journeyStage: NexoraJourneyStage = "exploring";
  let urgency: NexoraUrgency = "low";
  let confidence = 72;
  let escalationRequired = false;
  let closerMode = false;

  if (/\b(partner|referral|commission|refer\s+a\s+(client|lead))\b/.test(text)) {
    intent = "partner_enquiry";
    journeyStage = "qualifying";
    urgency = "medium";
    confidence = 88;
  } else if (/\b(finance|lease|leasing|monthly\s+pay(?:ment)?|chattel|rent.to.own)\b/.test(text)) {
    intent = "finance_enquiry";
    journeyStage = "qualifying";
    urgency = "medium";
    confidence = 86;
  } else if (/\b(strategy\s+call|consultation|book\s+a?\s+call|schedule\s+a?\s+call)\b/.test(text)) {
    intent = "strategy_call";
    journeyStage = "engaged";
    urgency = "high";
    confidence = 92;
    escalationRequired = true;
    closerMode = true;
  } else if (/\b(ai\s+office\s+planner|planner|floor\s+plan|layout\s+plan|space\s+plan)\b/.test(text)) {
    intent = "planner_request";
    journeyStage = "qualifying";
    urgency = "medium";
    confidence = 90;
  } else if (
    /\b(fitout|fit.out|full\s+office|workspace|relocation|procurement|project\s+brief|scope)\b/.test(
      text
    )
  ) {
    intent = "fitout_project";
    journeyStage = "qualifying";
    urgency = "medium";
    confidence = 89;
  } else if (/\b(quote|pricing|price|cost|budget|how\s+much|estimate|ballpark)\b/.test(text)) {
    intent = "quote_request";
    journeyStage = "qualifying";
    urgency = "medium";
    confidence = 87;
  } else if (
    /\b(product|desk|chair|catalog|range|boardroom|reception|lounge|meeting\s+room|workstation)\b/.test(
      text
    )
  ) {
    intent = "product_browse";
    journeyStage = messageCount >= 1 ? "qualifying" : "exploring";
    urgency = "low";
    confidence = 80;
  } else if (/\b(call|phone|speak|talk\s+to\s+(someone|a\s+person|your\s+team)|sales|contact)\b/.test(text)) {
    intent = "sales_contact";
    journeyStage = "engaged";
    urgency = "high";
    confidence = 90;
    escalationRequired = true;
    closerMode = true;
  }

  if (/\b(urgent|asap|today|this\s+week|right\s+now|immediately|deadline|move.in)\b/.test(text)) {
    urgency = "high";
    confidence = Math.max(confidence, 90);
    escalationRequired = true;
    closerMode = true;
  }

  if (messageCount >= 4 && journeyStage === "qualifying") journeyStage = "engaged";
  if (messageCount >= 6 && journeyStage === "engaged") journeyStage = "converting";

  const profileFields = [
    (profile as any).sqm,
    (profile as any).staff,
    (profile as any).budget,
    (profile as any).location,
    (profile as any).industry,
  ].filter(Boolean);
  if (profileFields.length >= 3) confidence = Math.min(confidence + 8, 98);

  const service =
    intent === "planner_request"
      ? "AI Office Planner"
      : intent === "strategy_call"
        ? "Strategy Consultation"
        : intent === "quote_request"
          ? "Request a Quote"
          : intent === "fitout_project"
            ? "Workplace Solutions"
            : undefined;

  const nextAction =
    intent === "planner_request"
      ? { label: "Start AI Office Planner", href: "/ai-office-planner" }
      : intent === "strategy_call"
        ? { label: "Book Strategy Call", href: "/strategy-call" }
        : intent === "quote_request"
          ? { label: "Request a Quote", href: "/request-a-quote" }
          : intent === "finance_enquiry"
            ? { label: "View Finance Options", href: "/finance-your-workspace" }
            : intent === "partner_enquiry"
              ? { label: "View Partner Program", href: "/partners" }
              : intent === "fitout_project"
                ? { label: "Book Strategy Call", href: "/strategy-call" }
                : PAGE_CTAS[location]?.primary ?? DEFAULT_CTA.primary;

  const estimatedDealBand = estimateDealBand(profile, message);

  const adminSummary =
    `Intent=${intent} | Stage=${journeyStage} | Urgency=${urgency} | ` +
    `Route=${location} | Previous=${previousPage ?? "none"} | ` +
    `Messages=${history.length} | Signals=${signalLog.length} | Confidence=${confidence}%`;

  const systemContext =
    `You are Nexora, The Corporate Desk's on-site AI workspace advisor. ` +
    `Current route: ${location}. Previous route: ${previousPage ?? "none"}. ` +
    `Detected intent: ${intent}. Journey stage: ${journeyStage}. ` +
    `Urgency: ${urgency}. Confidence: ${confidence}. ` +
    `Recommended next action: ${nextAction.label} (${nextAction.href}). ` +
    `User profile: ${buildProfileString(profile) || "unknown"}. ` +
    `When mentioning internal page links, format them as [[route:/path|Label Text]]. ` +
    `Respond as a premium commercial workspace advisor. Be concise, practical, and conversion-aware. ` +
    `Use markdown formatting: **bold** for key terms, bullet lists where helpful, and clear structure.`;

  const notes =
    `Visitor intent: ${intent}. Stage: ${journeyStage}. Urgency: ${urgency}. ` +
    `Recommended route: ${nextAction.href}. Profile: ${buildProfileString(profile) || "unknown"}.`;

  return {
    intent,
    journeyStage,
    urgency,
    confidence,
    adminSummary,
    systemContext,
    nextAction,
    escalationRequired,
    closerMode,
    leadUpdate: { notes, estimatedDealBand, service },
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Profile Extraction + Rendering
 * ────────────────────────────────────────────────────────────────────────────── */

function extractProfileFromText(text: string): Partial<UserProfile> {
  const lower = text.toLowerCase();
  const updates: Record<string, any> = {};

  const sqmMatch = lower.match(/(\d{2,5})\s*(?:sqm|square\s*met(?:re|er)s?|m2|sq\.?\s*m)/);
  if (sqmMatch) updates.sqm = `${sqmMatch[1]} sqm`;

  const staffMatch = lower.match(
    /(\d{1,4})\s*(?:staff|people|person|employees?|desks?|workstations?|seats?|heads?)/
  );
  if (staffMatch) updates.staff = `${staffMatch[1]} people`;

  const writtenNumbers: Record<string, number> = {
    ten: 10,
    fifteen: 15,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100,
  };

  for (const [word, num] of Object.entries(writtenNumbers)) {
    const regex = new RegExp(`\\b${word}\\b.*?(?:staff|people|person|employees?|desks?)`, "i");
    if (regex.test(lower) && !updates.staff) updates.staff = `${num} people`;
  }

  const budgetMatch = lower.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k|m|thousand|million)?/i);
  if (budgetMatch) {
    const amount = Number.parseFloat(budgetMatch[1].replace(/,/g, ""));
    const mult = budgetMatch[2]?.toLowerCase();
    const value =
      mult === "k" || mult === "thousand"
        ? amount * 1000
        : mult === "m" || mult === "million"
          ? amount * 1000000
          : amount;

    updates.budget = `$${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`;
  }

  if (/\b(executive|luxury|prestige|high.end|premium)\b/i.test(lower)) updates.style = "executive / luxury";
  else if (/\b(modern|contemporary|sleek|current)\b/i.test(lower)) updates.style = "modern / contemporary";
  else if (/\b(minimalist|clean|simple|pared.back)\b/i.test(lower)) updates.style = "minimalist";
  else if (/\b(biophilic|natural|organic|warm)\b/i.test(lower)) updates.style = "biophilic / natural";
  else if (/\b(industrial|raw|exposed|warehouse)\b/i.test(lower)) updates.style = "industrial";

  const locationMatch = lower.match(
    /\b(sydney|melbourne|brisbane|perth|adelaide|canberra|darwin|hobart|gold\s*coast|newcastle|geelong|wollongong)\b/
  );
  if (locationMatch) {
    updates.location = locationMatch[1]
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  if (/\b(law\s*firm|legal|solicitor|barrister)\b/i.test(lower)) updates.industry = "legal";
  else if (/\b(tech|software|startup|saas|developer)\b/i.test(lower)) updates.industry = "technology";
  else if (/\b(finance|bank|insurance|accounting|financial)\b/i.test(lower))
    updates.industry = "financial services";
  else if (/\b(health|medical|clinic|hospital|dental)\b/i.test(lower)) updates.industry = "healthcare";
  else if (/\b(architect|design|studio|creative)\b/i.test(lower)) updates.industry = "architecture / design";
  else if (/\b(real\s*estate|property|agency)\b/i.test(lower)) updates.industry = "real estate";
  else if (/\b(government|council|public\s*sector)\b/i.test(lower)) updates.industry = "government";
  else if (/\b(education|university|school|college|tafe)\b/i.test(lower)) updates.industry = "education";

  if (/\b(finance|lease|rental|monthly\s*pay)\b/i.test(lower)) updates.financeInterest = true;
  if (/\b(sit.stand|height.adjust|standing\s*desk|ergonomic)\b/i.test(lower)) updates.sitStandInterest = true;

  return updates as Partial<UserProfile>;
}

function buildProfileString(profile: UserProfile): string {
  const p = profile as any;
  const parts: string[] = [];

  if (p.sqm) parts.push(`Office: ${p.sqm}`);
  if (p.staff) parts.push(`${p.staff} staff`);
  if (p.budget) parts.push(`Budget: ${p.budget}`);
  if (p.style) parts.push(`Style: ${p.style}`);
  if (p.location) parts.push(`Location: ${p.location}`);
  if (p.industry) parts.push(`Industry: ${p.industry}`);
  if (p.financeInterest) parts.push("Finance interest: yes");
  if (p.sitStandInterest) parts.push("Sit-stand interest: yes");

  return parts.join(" · ");
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="nx-code">$1</code>')
    .replace(/^(-\s.+)(\n-\s.+)*/gm, (match) => {
      const items = match
        .split("\n")
        .filter(Boolean)
        .map((line) => `<li>${line.replace(/^-\s/, "")}</li>`)
        .join("");
      return `<ul class="nx-list">${items}</ul>`;
    })
    .replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br />");
}

function parseRouteLinks(text: string): {
  clean: string;
  links: Array<{ href: string; label: string }>;
} {
  const links: Array<{ href: string; label: string }> = [];

  const clean = text
    .replace(/\[\[route:([^|\]]+)\|([^\]]+)\]\]/g, (_match, href, label) => {
      links.push({ href: String(href).trim(), label: String(label).trim() });
      return "";
    })
    .trim();

  return { clean, links };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Styles
 * ────────────────────────────────────────────────────────────────────────────── */

const CHATBOT_STYLES = `
  .nx-prose ul.nx-list { margin: 0.4em 0 0.4em 1.1em; padding: 0; list-style: disc; }
  .nx-prose ul.nx-list li { margin: 0.15em 0; }
  .nx-prose p { margin: 0.35em 0; }
  .nx-prose strong { font-weight: 700; color: hsl(43,78%,70%); }
  .nx-prose em { font-style: italic; opacity: 0.85; }
  .nx-prose code.nx-code {
    font-family: monospace;
    font-size: 0.85em;
    background: rgba(201,168,76,0.12);
    border-radius: 3px;
    padding: 0.1em 0.35em;
  }
`;

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("nexora-chatbot-styles")) return;

  const el = document.createElement("style");
  el.id = "nexora-chatbot-styles";
  el.textContent = CHATBOT_STYLES;
  document.head.appendChild(el);
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Subcomponents
 * ────────────────────────────────────────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="mb-4 flex items-end gap-2">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.15)]">
        <Sparkles className="h-3.5 w-3.5 text-[hsl(43,78%,65%)]" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-[rgba(201,168,76,0.1)] bg-[hsl(220,18%,11%)] px-4 py-3">
        <div className="flex h-4 items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(43,78%,52%)]"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  const { clean, links } = isUser
    ? { clean: message.content, links: [] as Array<{ href: string; label: string }> }
    : parseRouteLinks(message.content);

  return (
    <div className={`mb-4 flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.15)]">
          <Sparkles className="h-3.5 w-3.5 text-[hsl(43,78%,65%)]" />
        </div>
      )}

      <div className="flex max-w-[82%] flex-col gap-2">
        {Boolean((message as any).imageUrl) && isUser && (
          <img
            src={(message as any).imageUrl as string}
            alt="Attached"
            className="max-h-36 max-w-full self-end rounded-xl border border-[rgba(201,168,76,0.2)] object-cover"
          />
        )}

        {(clean || message.content) && (
          <div
            className={[
              "rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "rounded-br-sm bg-[hsl(43,78%,52%)] font-medium text-[hsl(220,20%,6%)]"
                : "rounded-bl-sm border border-[rgba(201,168,76,0.1)] bg-[hsl(220,18%,11%)] text-white/85",
              (message as any).isStreaming
                ? "after:content-['▮'] after:animate-pulse after:ml-0.5 after:text-[hsl(43,78%,52%)]"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {isUser ? (
              clean || message.content
            ) : (
              <span
                className="nx-prose"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(clean || message.content) }}
              />
            )}
          </div>
        )}

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(43,78%,52%) 0%, hsl(38,62%,42%) 100%)",
                  color: "hsl(220,20%,6%)",
                }}
              >
                <ArrowRight className="h-3 w-3" />
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CTACard({ location }: { location: string }) {
  const cta = PAGE_CTAS[location] ?? DEFAULT_CTA;
  const isPhone = cta.tertiary.href.startsWith("tel:");

  return (
    <div className="mx-2 mb-3 rounded-xl border border-[rgba(201,168,76,0.18)] bg-[rgba(201,168,76,0.04)] p-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/35">
        Suggested Next Step
      </p>

      <div className="grid grid-cols-1 gap-1.5">
        <Link href={cta.primary.href}>
          <div
            className="flex cursor-pointer items-center justify-between rounded-lg bg-[hsl(43,78%,52%)] px-3 py-2.5 transition-opacity active:opacity-80"
            style={{ touchAction: "manipulation" }}
          >
            <span className="text-xs font-bold text-[hsl(220,20%,6%)]">{cta.primary.label}</span>
            <ArrowRight className="h-3.5 w-3.5 text-[hsl(220,20%,6%)]" />
          </div>
        </Link>

        <Link href={cta.secondary.href}>
          <div
            className="flex cursor-pointer items-center justify-between rounded-lg border border-[rgba(201,168,76,0.25)] px-3 py-2.5 transition-opacity active:opacity-80"
            style={{ touchAction: "manipulation" }}
          >
            <span className="text-xs font-semibold text-[hsl(43,78%,65%)]">
              {cta.secondary.label}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-[hsl(43,78%,65%)]" />
          </div>
        </Link>

        {isPhone ? (
          <a href={cta.tertiary.href}>
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2.5 transition-opacity active:opacity-80"
              style={{ touchAction: "manipulation" }}
            >
              <span className="text-xs font-semibold text-white/55">{cta.tertiary.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-white/35" />
            </div>
          </a>
        ) : (
          <Link href={cta.tertiary.href}>
            <div
              className="flex cursor-pointer items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2.5 transition-opacity active:opacity-80"
              style={{ touchAction: "manipulation" }}
            >
              <span className="text-xs font-semibold text-white/55">{cta.tertiary.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-white/35" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function NexoraActionCard({
  decision,
  onNavigate,
}: {
  decision: NexoraDecision;
  onNavigate: () => void;
}) {
  const urgencyColors: Record<NexoraUrgency, string> = {
    high: "rgba(201,168,76,0.18)",
    medium: "rgba(201,168,76,0.1)",
    low: "rgba(201,168,76,0.06)",
  };

  const stageLabel: Record<NexoraJourneyStage, string> = {
    exploring: "Exploring",
    qualifying: "Qualifying",
    engaged: "Engaged",
    converting: "Ready to convert",
  };

  return (
    <div
      className="mx-2 mb-3 rounded-xl border border-[rgba(201,168,76,0.18)] p-3"
      style={{ background: urgencyColors[decision.urgency] }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">
          Nexora Intelligence
        </p>

        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[hsl(43,78%,65%)]"
          style={{ background: "rgba(201,168,76,0.12)" }}
        >
          {stageLabel[decision.journeyStage]}
        </span>
      </div>

      <p className="mb-2.5 text-xs text-white/60">
        {decision.leadUpdate.estimatedDealBand
          ? `Estimated deal: ${decision.leadUpdate.estimatedDealBand}`
          : "Analysing opportunity…"}
      </p>

      <Link href={decision.nextAction.href} onClick={onNavigate}>
        <div className="flex cursor-pointer items-center justify-between rounded-lg bg-[hsl(43,78%,52%)] px-3 py-2.5 transition-opacity active:opacity-80">
          <span className="text-xs font-bold text-[hsl(220,20%,6%)]">{decision.nextAction.label}</span>
          <ArrowRight className="h-3.5 w-3.5 text-[hsl(220,20%,6%)]" />
        </div>
      </Link>
    </div>
  );
}

function QuickReplies({
  replies,
  onSelect,
  disabled,
}: {
  replies: QuickReply[];
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {replies.map((reply) => (
        <button
          key={reply.value}
          disabled={disabled}
          onClick={() => onSelect(reply.value)}
          className="rounded-full border border-[rgba(201,168,76,0.25)] px-3 py-1.5 text-xs font-medium text-[hsl(43,78%,65%)] transition-all hover:border-[rgba(201,168,76,0.5)] hover:bg-[rgba(201,168,76,0.08)] disabled:pointer-events-none disabled:opacity-40"
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}