import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { X, Send, Zap, Loader2, ChevronDown, RotateCcw, ExternalLink } from "lucide-react";

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

const ROUTE_QUICK_PROMPTS: Record<string, string[]> = {
  "/admin/partners": [
    "Which referrals need action today?",
    "Show me high-value opportunities",
    "Which commissions are overdue?",
    "Summarise partner performance",
  ],
  "/admin/nexora": [
    "What did the last system run find?",
    "Are there stale leads?",
    "What should I run next?",
    "Summarise the intelligence queue",
  ],
  "/admin/dashboard": [
    "What needs my attention today?",
    "Which referrals are hottest?",
    "Are there stale leads?",
    "Show commission risk areas",
  ],
  "/admin/leads": [
    "Which leads need follow-up?",
    "What are the highest-scoring leads?",
    "Summarise lead pipeline status",
    "Which leads have gone cold?",
  ],
  "/admin/deal-pipeline": [
    "Which deals are most likely to close?",
    "What's stalled in the pipeline?",
    "High-value deals at risk?",
    "Which stage has the most deals?",
  ],
  "/admin/intelligence-hub": [
    "What's the strongest market signal today?",
    "Which suburbs have highest demand?",
    "Summarise lease expiry opportunities",
    "What should I prioritise?",
  ],
};

const DEFAULT_QUICK_PROMPTS = [
  "What needs my attention?",
  "Summarise this page",
  "Which deals are hottest?",
  "Are there stale leads?",
];

function getPageLabel(route: string) {
  return ADMIN_ROUTE_LABELS[route] || route.replace("/admin/", "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getQuickPrompts(route: string) {
  return ROUTE_QUICK_PROMPTS[route] || DEFAULT_QUICK_PROMPTS;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Message = { id: string; role: "user" | "assistant"; content: string; isLoading?: boolean };

// ─── Message bubble ─────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 mb-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-sm bg-[hsl(43,78%,52%)]/15 border border-[hsl(43,78%,52%)]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Zap className="w-3 h-3 text-[hsl(43,78%,52%)]" />
        </div>
      )}
      <div
        className={`max-w-[85%] px-3 py-2.5 text-sm leading-relaxed rounded-lg ${
          isUser
            ? "bg-[hsl(43,78%,52%)] text-[#0f0f0f] font-medium ml-auto"
            : "bg-[rgba(255,255,255,0.05)] border border-white/10 text-white/85"
        } ${msg.isLoading ? "animate-pulse" : ""}`}
      >
        {msg.isLoading ? (
          <span className="flex items-center gap-1.5 text-white/40">
            <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoadingRef = useRef(false);

  const isAdmin = location.startsWith("/admin") || location.startsWith("/partner/dashboard");
  const pageLabel = getPageLabel(location);
  const quickPrompts = getQuickPrompts(location);

  // Inject route-change context message when navigating within admin
  useEffect(() => {
    if (location !== prevRoute && isAdmin && messages.length > 0) {
      const ctxMsg: Message = {
        id: `ctx-${Date.now()}`,
        role: "assistant",
        content: `You're now on **${getPageLabel(location)}**. Ask me anything about this section.`,
      };
      setMessages(prev => [...prev, ctxMsg]);
    }
    setPrevRoute(location);
  }, [location]);

  // Initialize welcome message when first opened on admin
  useEffect(() => {
    if (isOpen && messages.length === 0 && isAdmin) {
      const welcome: Message = {
        id: "nexora-welcome",
        role: "assistant",
        content: `I'm Nexora — your admin intelligence copilot. You're on **${pageLabel}**.\n\nI have access to your live referral pipeline, partner commissions, and deal data. What would you like to know?`,
      };
      setMessages([welcome]);
    }
  }, [isOpen]);

  // Show badge after delay
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => { if (!isOpen) setShowBadge(true); }, 20000);
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
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: content.trim() };
    const loadingMsg: Message = { id: `l-${Date.now()}`, role: "assistant", content: "", isLoading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");

    try {
      const apiMessages = messages
        .filter(m => !m.isLoading)
        .map(m => ({ role: m.role, content: m.content }));
      apiMessages.push({ role: "user", content: content.trim() });

      const res = await fetch("/api/nexora/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, route: location }),
      });
      const data = await res.json();
      const reply = data.response || (data.error ? `Error: ${data.error}` : "No response received.");

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
  }, [messages, location]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearHistory = () => {
    setMessages([]);
    const welcome: Message = {
      id: `nexora-reset-${Date.now()}`,
      role: "assistant",
      content: `History cleared. You're on **${pageLabel}**. What do you need?`,
    };
    setMessages([welcome]);
  };

  if (!isAdmin) return null;

  return (
    <div
      className="fixed z-[9999]"
      style={{ bottom: "24px", right: "24px" }}
      data-testid="nexora-copilot-container"
    >
      {/* ── Chat Panel ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="absolute bottom-16 right-0 w-80 sm:w-96 flex flex-col shadow-2xl"
          style={{
            height: "480px",
            background: "hsl(220,18%,8%)",
            border: "1px solid rgba(201,168,76,0.2)",
            borderRadius: "8px",
            boxShadow: "0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.1)",
          }}
          data-testid="nexora-chat-panel"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-sm bg-[hsl(43,78%,52%)]/15 border border-[hsl(43,78%,52%)]/30 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
              </div>
              <div>
                <div className="text-white text-xs font-semibold leading-none">Nexora</div>
                <div className="text-[hsl(43,78%,52%)] text-[10px] mt-0.5 leading-none">{pageLabel}</div>
              </div>
              <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearHistory}
                title="Clear history"
                data-testid="nexora-clear-btn"
                className="p-1.5 rounded text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                data-testid="nexora-close-btn"
                className="p-1.5 rounded text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ scrollbarWidth: "none" }}>
            {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts — shown when no user messages yet */}
          {messages.filter(m => m.role === "user").length === 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  disabled={isLoading}
                  className="text-[10px] px-2.5 py-1 border border-[hsl(43,78%,52%)]/20 text-[hsl(43,78%,65%)] bg-[hsl(43,78%,52%)]/5 hover:bg-[hsl(43,78%,52%)]/10 rounded-sm transition-colors truncate max-w-full"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Safe action hint */}
          <div
            className="px-4 py-2 text-[10px] text-white/20 flex-shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            Nexora recommends — you confirm and execute. No silent mutations.
          </div>

          {/* Input */}
          <div
            className="px-3 pb-3 flex gap-2 flex-shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nexora..."
              disabled={isLoading}
              data-testid="nexora-input"
              className="flex-1 bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-[hsl(43,78%,52%)]/40 placeholder:text-white/25 rounded-sm"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              data-testid="nexora-send-btn"
              className="w-9 h-9 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center rounded-sm transition-colors flex-shrink-0 mt-0.5"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 text-black animate-spin" /> : <Send className="w-3.5 h-3.5 text-black" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Trigger Button ───────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        data-testid="nexora-copilot-btn"
        className="relative w-12 h-12 rounded-sm flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95"
        style={{
          background: isOpen
            ? "hsl(220,18%,13%)"
            : "linear-gradient(135deg, hsl(43,78%,52%) 0%, hsl(38,62%,36%) 100%)",
          border: isOpen
            ? "1px solid rgba(201,168,76,0.35)"
            : "1px solid rgba(201,168,76,0.15)",
          boxShadow: isOpen
            ? "0 4px 20px rgba(0,0,0,0.5)"
            : "0 0 0 1px rgba(201,168,76,0.1), 0 4px 20px rgba(201,168,76,0.35), 0 2px 8px rgba(0,0,0,0.6)",
        }}
        aria-label={isOpen ? "Close Nexora copilot" : "Open Nexora copilot"}
        title="Nexora — Admin Copilot"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-white" />
        ) : (
          <Zap className="w-4 h-4 text-[#0f0f0f]" />
        )}

        {/* Online indicator */}
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f0f0f] shadow" />
        )}

        {/* Badge */}
        {showBadge && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(43,78%,52%)] rounded-full flex items-center justify-center text-[10px] font-bold text-black shadow-md animate-pulse">
            !
          </span>
        )}
      </button>

      {/* Hover label */}
      {!isOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 pointer-events-none opacity-0 hover:opacity-100 transition-opacity"
          style={{ whiteSpace: "nowrap" }}
        >
          <div
            className="px-2.5 py-1.5 text-xs rounded-sm"
            style={{ background: "hsl(220,18%,10%)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <span className="text-white font-semibold">Nexora</span>
            <span className="text-white/40 ml-1">Admin Copilot</span>
          </div>
        </div>
      )}
    </div>
  );
}
