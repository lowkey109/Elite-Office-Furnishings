import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { X, Send, MessageSquare, ChevronDown, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface QuickReply {
  label: string;
  value: string;
}

const PAGE_CONTEXT_GREETINGS: Record<string, string> = {
  "/": "Welcome to The Corporate Desk. I'm your AI business consultant — here to help with products, pricing, fitout scoping, quoting, and more. What are you working on?",
  "/products": "Browsing our product range? I can narrow down exactly what suits your space, team size, and aesthetic. What type of furniture are you looking for?",
  "/workplace-solutions": "Looking at fitout options? I can walk you through our process, help scope your project, or give you an indicative budget range. Where are you at with planning?",
  "/free-office-layout-plan": "Our free layout plan is the most popular starting point for fitout projects — no obligation, just a professional CAD layout. Any questions before you submit?",
  "/send-us-your-quote": "Ready to get a quote? I can help you include the right specifications for an accurate response. What products or scope are you quoting for?",
  "/quote-builder": "You're using our interactive Quote Builder — I'm your AI Quoting Advisor. Select your options and I'll guide you through building an accurate budget estimate. What type of project is this for?",
  "/finance-your-workspace": "Finance can be a smart move for preserving cash flow. I can explain the options, give indicative repayment estimates, or help you think through whether finance suits your situation. What would be helpful?",
  "/case-studies": "Seeing real results from real projects is one of the best ways to build confidence. Happy to answer questions about any of these fitouts, or help you think about how we'd approach your project.",
  "/workplace-strategy": "A strategy call is ideal for complex or large-scale projects. I can answer questions about what to expect and help you prepare. What's the nature of your project?",
  "/about": "Getting to know the business? I can share more about our certifications, process, product range, or what makes us different. What's most relevant to you?",
  "/contact": "Happy to help before you reach out. Often I can answer your question faster than waiting for a callback. What's on your mind?",
};

const DEFAULT_GREETING =
  "Welcome to The Corporate Desk. I'm your AI consultant — here to help with products, pricing, fitouts, and more. What brings you here today?";

const QUICK_REPLIES_INITIAL: QuickReply[] = [
  { label: "301 SKUs — browse products", value: "What products do you carry across your 301-SKU catalogue?" },
  { label: "GOJO Vol 2 neo-Chinese luxury", value: "Tell me about the GOJO Vol 2 collections — JN, YOM and HXM series" },
  { label: "Get pricing info", value: "What are your pricing ranges for a typical office fitout?" },
  { label: "Are you ISO certified?", value: "What certifications do you have and what is your warranty?" },
];

const QUICK_REPLIES_FOLLOWUP: QuickReply[] = [
  { label: "Get a free layout plan", value: "I'd like to get a free office layout plan" },
  { label: "Request a quote", value: "I'd like to request a quote for my project" },
  { label: "Book a strategy call", value: "I'd like to book a workplace strategy call" },
  { label: "Talk to someone", value: "How can I speak to someone on your team?" },
];

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-[hsl(43,78%,65%)]" />
      </div>
      <div className="bg-[hsl(220,18%,11%)] border border-[rgba(201,168,76,0.1)] rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center flex-shrink-0 mb-0.5">
          <Sparkles className="w-3.5 h-3.5 text-[hsl(43,78%,65%)]" />
        </div>
      )}
      <div
        className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] rounded-br-sm font-medium"
            : "bg-[hsl(220,18%,11%)] border border-[rgba(201,168,76,0.1)] text-white/85 rounded-bl-sm"
        } ${message.isStreaming ? "after:content-['▋'] after:text-[hsl(43,78%,52%)] after:animate-pulse" : ""}`}
      >
        {message.content || (message.isStreaming ? "" : "")}
      </div>
    </div>
  );
}

function CTACard() {
  return (
    <div className="mx-2 mb-3 rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] p-3">
      <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Next Step</p>
      <div className="grid grid-cols-1 gap-1.5">
        <Link href="/free-office-layout-plan">
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[hsl(43,78%,52%)] cursor-pointer active:opacity-80"
            style={{ touchAction: "manipulation" }}
            data-testid="chatbot-cta-layout-plan"
          >
            <span className="text-[hsl(220,20%,6%)] text-xs font-bold">Free Layout Plan</span>
            <ArrowRight className="w-3.5 h-3.5 text-[hsl(220,20%,6%)]" />
          </div>
        </Link>
        <Link href="/send-us-your-quote">
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[rgba(201,168,76,0.25)] cursor-pointer active:opacity-80"
            style={{ touchAction: "manipulation" }}
            data-testid="chatbot-cta-quote"
          >
            <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">Request a Quote</span>
            <ArrowRight className="w-3.5 h-3.5 text-[hsl(43,78%,65%)]" />
          </div>
        </Link>
        <Link href="/workplace-strategy">
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] cursor-pointer active:opacity-80"
            style={{ touchAction: "manipulation" }}
            data-testid="chatbot-cta-strategy"
          >
            <span className="text-white/60 text-xs font-semibold">Book a Strategy Call</span>
            <ArrowRight className="w-3.5 h-3.5 text-white/40" />
          </div>
        </Link>
      </div>
    </div>
  );
}

export function ChatBot() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [showCTA, setShowCTA] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const getGreeting = useCallback(() => {
    return PAGE_CONTEXT_GREETINGS[location] || DEFAULT_GREETING;
  }, [location]);

  useEffect(() => {
    const greeting = getGreeting();
    const initialMessage: Message = {
      id: "greeting",
      role: "assistant",
      content: greeting,
    };
    setMessages([initialMessage]);
    historyRef.current = [{ role: "assistant", content: greeting }];
  }, [getGreeting]);

  useEffect(() => {
    const badgeTimer = setTimeout(() => setShowBadge(true), 8000);
    const autoOpenTimer = setTimeout(() => {
      if (!hasAutoOpened && !isOpen) {
        setHasAutoOpened(true);
        setShowBadge(false);
      }
    }, 30000);

    return () => {
      clearTimeout(badgeTimer);
      clearTimeout(autoOpenTimer);
    };
  }, [hasAutoOpened, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setShowBadge(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
    };

    historyRef.current.push({ role: "user", content: content.trim() });
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setShowQuickReplies(false);

    const assistantMessageId = `assistant-${Date.now()}`;
    const streamingMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyRef.current.filter((m) => m.role === "user" || m.role === "assistant"),
          stream: true,
        }),
      });

      if (!response.ok) throw new Error("Request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) break;
            if (data.error) throw new Error(data.error);
            if (data.content) {
              fullContent += data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: fullContent, isStreaming: true }
                    : m
                )
              );
            }
          } catch (_) {}
        }
      }

      historyRef.current.push({ role: "assistant", content: fullContent });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: fullContent, isStreaming: false }
            : m
        )
      );

      const newCount = messageCount + 1;
      setMessageCount(newCount);

      if (newCount >= 2) {
        setShowCTA(true);
      }

      if (newCount >= 3) {
        setShowQuickReplies(true);
      }

    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content:
                  "I'm having trouble connecting right now. Please call us on 1300 977 607 or email service@thecorporatedesk.com.au",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messageCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleQuickReply = (reply: QuickReply) => {
    sendMessage(reply.value);
  };

  const quickReplies = messageCount === 0 ? QUICK_REPLIES_INITIAL : QUICK_REPLIES_FOLLOWUP;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">
        {isOpen && (
          <div
            className="w-[min(380px,calc(100vw-32px))] bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.2)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{
              height: isMinimized ? "auto" : "min(560px, calc(100vh - 120px))",
              boxShadow: "0 0 0 1px rgba(201,168,76,0.1), 0 25px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="chatbot-window"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(201,168,76,0.15)] bg-[hsl(220,18%,7%)] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.3)] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[hsl(43,78%,60%)]" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[hsl(220,18%,7%)]" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">TCD Consultant</p>
                  <p className="text-[hsl(43,78%,60%)] text-xs">AI Sales Assistant · Online now</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                  style={{ touchAction: "manipulation" }}
                  aria-label="Minimize"
                  data-testid="chatbot-minimize"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? "rotate-180" : ""}`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                  style={{ touchAction: "manipulation" }}
                  aria-label="Close chat"
                  data-testid="chatbot-close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-0 scroll-smooth">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isLoading && messages[messages.length - 1]?.isStreaming === false && (
                    <TypingIndicator />
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {showQuickReplies && !isLoading && (
                  <div className="px-3 py-2 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0 touch-scroll">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.value}
                        onClick={() => handleQuickReply(reply)}
                        className="flex-shrink-0 px-3 py-2 rounded-full border border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] text-xs font-medium whitespace-nowrap hover:bg-[rgba(201,168,76,0.08)] active:bg-[rgba(201,168,76,0.12)] transition-colors"
                        style={{ touchAction: "manipulation", minHeight: "36px" }}
                        data-testid={`chatbot-quick-reply-${reply.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                )}

                {showCTA && !isLoading && <CTACard />}

                <form
                  onSubmit={handleSubmit}
                  className="px-3 pb-3 pt-2 border-t border-[rgba(201,168,76,0.1)] flex-shrink-0"
                >
                  <div className="flex items-center gap-2 bg-[hsl(220,18%,11%)] border border-[rgba(201,168,76,0.15)] rounded-xl px-3 py-2 focus-within:border-[rgba(201,168,76,0.35)] transition-colors">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Ask about products, pricing, fitouts..."
                      className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none min-w-0"
                      style={{ fontSize: "16px" }}
                      disabled={isLoading}
                      data-testid="chatbot-input"
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isLoading}
                      className="w-8 h-8 rounded-lg bg-[hsl(43,78%,52%)] flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                      style={{ touchAction: "manipulation" }}
                      data-testid="chatbot-send"
                    >
                      <Send className="w-3.5 h-3.5 text-[hsl(220,20%,6%)]" />
                    </button>
                  </div>
                  <p className="text-center text-[10px] text-white/20 mt-1.5">
                    Powered by AI · The Corporate Desk
                  </p>
                </form>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setShowBadge(false);
          }}
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95"
          style={{
            background: isOpen
              ? "hsl(220,18%,12%)"
              : "linear-gradient(135deg, hsl(43,78%,52%) 0%, hsl(43,60%,40%) 100%)",
            border: isOpen
              ? "1px solid rgba(201,168,76,0.3)"
              : "none",
            boxShadow: isOpen
              ? "0 4px 20px rgba(0,0,0,0.4)"
              : "0 4px 20px rgba(201,168,76,0.35), 0 2px 8px rgba(0,0,0,0.3)",
            touchAction: "manipulation",
          }}
          aria-label={isOpen ? "Close chat" : "Open chat"}
          data-testid="chatbot-toggle"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <MessageSquare className="w-6 h-6 text-[hsl(220,20%,6%)]" />
          )}

          {showBadge && !isOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold animate-pulse">
              1
            </span>
          )}

          {!isOpen && !showBadge && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[hsl(220,20%,6%)]" />
          )}
        </button>
      </div>
    </>
  );
}
