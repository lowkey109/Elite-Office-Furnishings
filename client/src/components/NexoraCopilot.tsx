import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Send, Zap, Loader2, ChevronDown, RotateCcw } from "lucide-react";

// ─── Route metadata ─────────────────────────────────────────────────────────

const ADMIN_ROUTE_LABELS: Record<string, string> = {
  "/admin/dashboard": "Admin Dashboard",
  "/admin/leads": "Lead Management",
  "/admin/lead-intelligence": "Lead Intelligence",
  "/admin/deal-pipeline": "Deal Pipeline",
  "/admin/deal-hunter": "Deal Hunter",
  "/admin/deal-intelligence": "Deal Intelligence",
  "/admin/partner-network": "Partner Network",
  "/admin/partners": "Partner Referral Management",
  "/admin/nexora": "Nexora Command Centre",
  "/admin/intelligence-hub": "Intelligence Hub",
  "/admin/office-move-radar": "Office Move Radar",
  "/admin/relocation-intelligence": "Relocation Intelligence",
  "/admin/market-intelligence": "Market Intelligence",
  "/admin/territory-scanner": "Territory Scanner",
  "/admin/lease-signals": "Lease Signals",
  "/admin/quotes": "Quotes Management",
  "/admin/supplier-quotes": "Supplier Quotes",
  "/admin/planning-requests": "Planning Requests",
  "/admin/product-reviews": "Product Reviews",
  "/admin/follow-up-sequences": "Follow-up Sequences",
  "/admin/manufacturer-messaging": "Manufacturer Messaging",
  "/admin/workspace-strategy": "Workspace Strategy",
  "/admin/workspace-learning": "Workspace Learning",
  "/admin/command-centre": "Command Centre",
  "/admin/procurement-engine": "Procurement Engine",
  "/admin/supplier-intelligence": "Supplier Intelligence",
  "/admin/profit-engine": "Profit Engine",
  "/admin/company-visitors": "Company Visitors",
  "/admin/proposal-engine": "Proposal Engine",
  "/admin/product-command-centre": "Product Command Centre",
  "/admin/lead-engine": "Lead Engine",
  "/admin/alex": "Alex AI Dashboard",
};

const OPERATOR_COMMANDS = [
  { label: "Executive briefing", prompt: "Give me a 3-point executive briefing: hottest opportunity, biggest risk, most urgent action needed right now." },
  { label: "Hottest deals", prompt: "What are the hottest deals in the pipeline? List the top 3 with deal value, AI score, and recommended next action." },
  { label: "What's at risk?", prompt: "What deals and leads are at risk of going cold? What should I do about them?" },
  { label: "What to do now", prompt: "What are the 3 highest-priority actions I should take in the next 2 hours?" },
];

const ROUTE_COMMANDS: Record<string, { label: string; prompt: string }[]> = {
  "/admin/partners": [
    { label: "Partner performance", prompt: "Summarise partner performance. Who are the top referring partners and which partners have gone quiet?" },
    { label: "Commission risk", prompt: "Are there any overdue commissions or commission disputes I should know about?" },
    { label: "Referrals to action", prompt: "Which referrals need to be actioned today? List them with their current status and recommended next step." },
  ],
  "/admin/nexora": [
    { label: "Pipeline summary", prompt: "Give me a full pipeline summary: total active deals, total pipeline value, and the most important items to focus on." },
    { label: "Stale deals", prompt: "Which deals have gone stale and need follow-up? List them with how long they've been sitting and a recommended action." },
  ],
  "/admin/deal-pipeline": [
    { label: "Pipeline health", prompt: "What is the overall health of the deal pipeline? Where are the bottlenecks?" },
    { label: "Deals to close this week", prompt: "Which deals are realistically closeable this week? What needs to happen to close them?" },
  ],
  "/admin/leads": [
    { label: "Priority leads", prompt: "Which leads should I focus on first? Sort by urgency and AI fit score." },
    { label: "Stale leads", prompt: "Which leads have been sitting too long without action?" },
  ],
};

function getPageLabel(route: string) {
  return ADMIN_ROUTE_LABELS[route] || route.replace("/admin/", "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getRouteCommands(route: string) {
  return ROUTE_COMMANDS[route] || OPERATOR_COMMANDS;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Message = { id: string; role: "user" | "assistant"; content: string; isLoading?: boolean };

// ─── Message bubble ─────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 mb-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-sm bg-[hsl(43,78%,52%)]/15 border border-[hsl(43,78%,52%)]/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Zap className="w-3 h-3 text-[hsl(43,78%,52%)]" />
        </div>
      )}
      <div
        className={`max-w-[88%] px-3 py-2.5 text-sm leading-relaxed rounded-sm ${
          isUser
            ? "bg-[hsl(43,78%,52%)] text-[#0f0f0f] font-medium ml-auto"
            : "bg-white/[0.04] border border-white/8 text-white/85"
        } ${msg.isLoading ? "animate-pulse" : ""}`}
      >
        {msg.isLoading ? (
          <span className="flex items-center gap-1.5 text-white/40 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Analysing...
          </span>
        ) : (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function NexoraCopilot() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prevRoute, setPrevRoute] = useState(location);
  const [showBadge, setShowBadge] = useState(false);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoadingRef = useRef(false);

  const isAdmin = location.startsWith("/admin") || location.startsWith("/partner/dashboard");
  const pageLabel = getPageLabel(location);
  const routeCommands = getRouteCommands(location);

  const sendRaw = useCallback(async (
    content: string,
    history: Message[],
    routeOverride?: string,
    silent?: boolean
  ): Promise<string> => {
    const apiMessages = history
      .filter(m => !m.isLoading)
      .map(m => ({ role: m.role, content: m.content }));
    apiMessages.push({ role: "user", content });

    const res = await fetch("/api/nexora/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiMessages, route: routeOverride || location }),
    });
    const data = await res.json();
    return data.response || (data.error ? `Error: ${data.error}` : "No response received.");
  }, [location]);

  // Auto-briefing on first open
  useEffect(() => {
    if (!isOpen || !isAdmin || hasAutoLoaded) return;
    setHasAutoLoaded(true);
    isLoadingRef.current = true;
    setIsLoading(true);

    const loadingMsg: Message = { id: "auto-load", role: "assistant", content: "", isLoading: true };
    setMessages([loadingMsg]);

    const briefingPrompt = "Give me a 3-point executive briefing right now based on the live system data. Format: #1 Hottest opportunity, #2 Biggest risk or stale item, #3 Most urgent action I should take. Be direct, data-specific, and actionable.";

    sendRaw(briefingPrompt, [], location)
      .then(reply => {
        setMessages([{ id: "auto-briefing", role: "assistant", content: reply }]);
      })
      .catch(() => {
        setMessages([{
          id: "auto-err",
          role: "assistant",
          content: `I'm Nexora — your admin copilot. You're on **${pageLabel}**. Ask me anything about your pipeline, commissions, or what to focus on.`,
        }]);
      })
      .finally(() => {
        isLoadingRef.current = false;
        setIsLoading(false);
      });
  }, [isOpen, isAdmin]);

  // Inject route-change context message when navigating
  useEffect(() => {
    if (location !== prevRoute && isAdmin && messages.length > 0 && !messages[messages.length - 1]?.isLoading) {
      const ctxMsg: Message = {
        id: `ctx-${Date.now()}`,
        role: "assistant",
        content: `Now on **${getPageLabel(location)}**. Ask me anything about this section.`,
      };
      setMessages(prev => [...prev, ctxMsg]);
    }
    setPrevRoute(location);
  }, [location]);

  // Badge after delay
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => { if (!isOpen) setShowBadge(true); }, 25000);
    return () => clearTimeout(t);
  }, [isAdmin]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setShowBadge(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: content.trim() };
    const loadingMsg: Message = { id: `l-${Date.now()}`, role: "assistant", content: "", isLoading: true };
    const currentMessages = [...messages];
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");

    try {
      const reply = await sendRaw(content.trim(), currentMessages);
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, { id: `a-${Date.now()}`, role: "assistant", content: reply }];
      });
    } catch {
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, { id: `err-${Date.now()}`, role: "assistant", content: "Connection error. Please try again." }];
      });
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [messages, sendRaw]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearAndRefresh = () => {
    setMessages([]);
    setHasAutoLoaded(false);
    setIsOpen(false);
    setTimeout(() => setIsOpen(true), 50);
  };

  if (!isAdmin) return null;

  const userMessageCount = messages.filter(m => m.role === "user").length;

  return (
    <div className="fixed z-[9999]" style={{ bottom: "24px", right: "24px" }} data-testid="nexora-copilot-container">

      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="absolute bottom-16 right-0 w-80 sm:w-[400px] flex flex-col shadow-2xl"
          style={{
            height: "520px",
            background: "hsl(220,18%,8%)",
            border: "1px solid rgba(201,168,76,0.18)",
            borderRadius: "6px",
            boxShadow: "0 12px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.08)",
          }}
          data-testid="nexora-chat-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-sm bg-[hsl(43,78%,52%)]/12 border border-[hsl(43,78%,52%)]/25 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
              </div>
              <div>
                <div className="text-white text-xs font-semibold leading-none">Nexora</div>
                <div className="text-[hsl(43,78%,52%)] text-[10px] mt-0.5 leading-none">{pageLabel}</div>
              </div>
              <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearAndRefresh} title="Refresh briefing" data-testid="nexora-clear-btn" className="p-1.5 rounded text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsOpen(false)} title="Close" data-testid="nexora-close-btn" className="p-1.5 rounded text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
            {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* Operator command buttons — shown when no user messages */}
          {userMessageCount === 0 && !isLoading && (
            <div className="px-4 pb-2">
              <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2">Operator commands</p>
              <div className="grid grid-cols-2 gap-1.5">
                {routeCommands.map(cmd => (
                  <button
                    key={cmd.label}
                    onClick={() => sendMessage(cmd.prompt)}
                    disabled={isLoading}
                    className="text-[10px] px-2.5 py-1.5 border border-[hsl(43,78%,52%)]/18 text-[hsl(43,78%,62%)] bg-[hsl(43,78%,52%)]/4 hover:bg-[hsl(43,78%,52%)]/8 rounded-sm transition-colors text-left truncate"
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Safe action disclaimer */}
          <div className="px-4 py-1.5 text-[9px] text-white/15 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            Nexora recommends — you confirm and execute in the interface.
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nexora anything..."
              disabled={isLoading}
              data-testid="nexora-input"
              className="flex-1 bg-white/[0.04] border border-white/8 text-white text-sm px-3 py-2.5 outline-none focus:border-[hsl(43,78%,52%)]/35 placeholder:text-white/20 rounded-sm transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              data-testid="nexora-send-btn"
              className="w-9 h-9 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center rounded-sm transition-colors flex-shrink-0 mt-0.5"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 text-black animate-spin" /> : <Send className="w-3.5 h-3.5 text-black" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        data-testid="nexora-copilot-btn"
        className="relative w-12 h-12 rounded-sm flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95"
        style={{
          background: isOpen ? "hsl(220,18%,13%)" : "linear-gradient(135deg, hsl(43,78%,52%) 0%, hsl(38,62%,36%) 100%)",
          border: isOpen ? "1px solid rgba(201,168,76,0.35)" : "1px solid rgba(201,168,76,0.15)",
          boxShadow: isOpen ? "0 4px 20px rgba(0,0,0,0.5)" : "0 0 0 1px rgba(201,168,76,0.1), 0 4px 20px rgba(201,168,76,0.35)",
        }}
        aria-label={isOpen ? "Close Nexora" : "Open Nexora — Admin Copilot"}
        title={isOpen ? "Close Nexora" : "Nexora — Admin Operator"}
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-white" /> : <Zap className="w-4 h-4 text-[#0f0f0f]" />}
        {!isOpen && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f0f0f] shadow" />}
        {showBadge && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(43,78%,52%)] rounded-full flex items-center justify-center text-[10px] font-bold text-black shadow-md animate-pulse">!</span>
        )}
      </button>

    </div>
  );
}
