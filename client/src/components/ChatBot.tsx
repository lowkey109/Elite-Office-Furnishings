import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Send, ChevronDown, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useConcierge, ConversationMessage, UserProfile } from "@/contexts/ConciergeContext";
import { runNexoraEngine, NexoraDecision } from "@/lib/nexoraEngine";

// ─── Page Configuration ────────────────────────────────────────────────────────

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
  "/": "Welcome to The Corporate Desk. I’m your AI workspace advisor — here to help scope fitouts, navigate our range, and guide your next step. What are you working on?",
  "/catalog": "You’re browsing our product catalogue. I can narrow this down to exactly what suits your space, team size, and aesthetic. What type of furniture are you looking for?",
  "/workplace-solutions": "Looking at fitout options? I can walk you through our process, help scope your project, or give you an indicative budget range. Where are you at with planning?",
  "/ai-office-planner": "You’re at our AI Office Planner — upload your floor plan and brief, and our AI returns a full zone layout, SKU package, and cost estimate in minutes. Any questions before you start?",
  "/upload-your-floor-plan": "Upload your floor plan here and our specialists will create a professional workspace layout tailored to your team. Any questions about the process?",
  "/free-layout-plan": "Our free layout plan is the most popular starting point for office fitouts — no obligation, just a professional workspace concept designed by our team. How can I help?",
  "/free-office-layout-plan": "Our free layout plan is the most popular starting point for office fitouts — no obligation, just a professional CAD layout. How can I help?",
  "/3d-office-walkthrough": "The 3D walkthrough lets you visualise your workspace before committing a dollar. I can explain how it works or help you get started. What’s your project about?",
  "/quote-builder": "You’re in our Quote Builder — I’m your AI quoting advisor. Let me guide you toward an accurate budget for your project. What type of workspace are you fitting out?",
  "/request-a-quote": "You’re ready to request a quote — great. I can help you include the right specifications for an accurate response. What products or scope are you quoting for?",
  "/send-us-your-quote": "You’re ready to get a quote — great. I can help you include the right specifications for an accurate response. What products or scope are you quoting for?",
  "/finance-your-workspace": "Finance can be a smart way to preserve cash flow on a large fitout. I can explain options, give indicative repayment estimates, or help you decide if finance suits your situation.",
  "/trade-project-procurement": "You’re looking at our trade procurement service — built for project managers, interior designers, and commercial property teams. What type of project are you working on?",
  "/strategy-call": "A strategy consultation is ideal for complex or large-scale projects. I can help answer questions or let you know exactly what to expect. What’s the nature of your project?",
  "/workplace-strategy": "A workplace strategy session is the right starting point for complex fitouts. I can answer questions about what to prepare and what to expect. What’s your project?",
  "/partners": "Interested in our referral partner program? I can walk you through commission structures, how to register, and how to submit referrals. What’s your role?",
  "/about": "Getting to know the business? I can share more about our certifications, process, product range, or what makes us different. What’s most relevant to you?",
  "/contact": "Happy to help before you reach out — I can often answer faster than a callback. What’s on your mind?",
  "/case-studies": "Seeing real results from real projects builds confidence. I can answer questions about any of these fitouts or help you think through how we’d approach yours.",
  "/blog": "Insights and analysis from the world of commercial fit-outs. I can help you find what’s most relevant to your situation.",
  "/capability": "Looking at our capability statement? I can walk you through our certifications, project history, and what sets us apart from other suppliers.",
  "/start": "Let’s find the right path for you. Tell me a bit about your project — team size, timeline, budget — and I’ll point you to the best next step.",
};
const DEFAULT_GREETING =
  "Welcome to The Corporate Desk. I'm your AI workspace advisor — here to help with products, pricing, fitouts, and more. What brings you here today?";

interface QuickReply {
  label: string;
  value: string;
}

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
  "/ai-office-planner": [
    { label: "How does it work?", value: "How does the AI Office Planner work?" },
    { label: "File types accepted?", value: "What file types do you accept for floor plans?" },
    { label: "What’s in the paid report?", value: "What does the $399 paid AI report include?" },
    { label: "See example output", value: "Can you show me an example of a planner output?" },
  ],
  "/upload-your-floor-plan": [
    { label: "How does it work?", value: "How does the floor plan upload work?" },
    { label: "File types accepted?", value: "What file types do you accept for floor plans?" },
    { label: "What comes next?", value: "What happens after I upload my floor plan?" },
    { label: "Who reviews it?", value: "Who reviews my floor plan?" },
  ],
  "/free-layout-plan": [
    { label: "What’s included?", value: "What does the free office layout plan include?" },
    { label: "How long does it take?", value: "How long does it take to receive the free layout plan?" },
    { label: "Unusual floor shapes?", value: "What if my office has an unusual shape or layout?" },
    { label: "Who designs it?", value: "Who designs the layout — AI or a human designer?" },
  ],
  "/3d-office-walkthrough": [
    { label: "How does 3D work?", value: "How does the 3D office walkthrough work?" },
    { label: "What’s included?", value: "What does the 3D walkthrough package include?" },
    { label: "Can I customise it?", value: "Can I customise the 3D walkthrough to my space?" },
    { label: "Pricing?", value: "What does a 3D office walkthrough cost?" },
  ],
  "/finance-your-workspace": [
    { label: "Estimate $150k monthly", value: "What would monthly repayments be for a $150,000 fitout?" },
    { label: "Which plan suits me?", value: "Which finance plan would suit my situation?" },
    { label: "Minimum spend?", value: "Is there a minimum spend for finance?" },
    { label: "Tax implications?", value: "What are the tax implications of leasing furniture?" },
  ],
  "/quote-builder": [
    { label: "20-person office needs", value: "What furniture do I need for an office of 20 people?" },
    { label: "Acoustic requirements", value: "Help me estimate acoustic and privacy requirements" },
    { label: "Delivery & install", value: "What’s included in delivery and installation?" },
    { label: "Quote validity", value: "How long is a quote valid for?" },
  ],
  "/request-a-quote": [
    { label: "What happens next?", value: "What happens after I submit my quote request?" },
    { label: "Response time?", value: "How long does it take to receive a quote response?" },
    { label: "Can we meet first?", value: "Can I meet your team before committing?" },
    { label: "Delivery & install?", value: "Do you handle delivery and installation?" },
  ],
  "/trade-project-procurement": [
    { label: "Minimum project size?", value: "What is the minimum project size for trade procurement?" },
    { label: "Trade pricing available?", value: "Do you offer trade pricing for interior designers?" },
    { label: "Staged delivery?", value: "Can you manage staged deliveries for large fitouts?" },
    { label: "Documentation?", value: "What documentation do you provide at project handover?" },
  ],
  "/strategy-call": [
    { label: "What’s covered?", value: "What’s covered in a workplace strategy consultation?" },
    { label: "How long is the call?", value: "How long is the strategy consultation?" },
    { label: "Can I bring my designer?", value: "Can I bring my interior designer to the strategy call?" },
    { label: "Cost?", value: "Is the strategy consultation free?" },
  ],
  "/partners": [
    { label: "Commission structure?", value: "What is the commission structure for partners?" },
    { label: "Who can join?", value: "Who is eligible to become a referral partner?" },
    { label: "How to submit referral?", value: "How do I submit a referral as a partner?" },
    { label: "Payment terms?", value: "When and how are partner commissions paid?" },
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

interface CTAConfig {
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  tertiary: { label: string; href: string };
}

const PAGE_CTAS: Record<string, CTAConfig> = {
  "/": {
    primary: { label: "AI Office Planner", href: "/ai-office-planner" },
    secondary: { label: "Request a Quote", href: "/request-a-quote" },
    tertiary: { label: "Book a Strategy Call", href: "/strategy-call" },
  },
  "/catalog": {
    primary: { label: "Request a Quote", href: "/request-a-quote" },
    secondary: { label: "AI Office Planner", href: "/ai-office-planner" },
    tertiary: { label: "Finance Options", href: "/finance-your-workspace" },
  },
  "/workplace-solutions": {
    primary: { label: "Request a Quote", href: "/request-a-quote" },
    secondary: { label: "AI Office Planner", href: "/ai-office-planner" },
    tertiary: { label: "Book Strategy Call", href: "/strategy-call" },
  },
  "/ai-office-planner": {
    primary: { label: "Free Layout Plan Instead", href: "/free-layout-plan" },
    secondary: { label: "Request a Quote", href: "/request-a-quote" },
    tertiary: { label: "Book Strategy Call", href: "/strategy-call" },
  },
  "/upload-your-floor-plan": {
    primary: { label: "AI Office Planner", href: "/ai-office-planner" },
    secondary: { label: "Request a Quote", href: "/request-a-quote" },
    tertiary: { label: "Book Strategy Call", href: "/strategy-call" },
  },
  "/free-layout-plan": {
    primary: { label: "Try AI Office Planner", href: "/ai-office-planner" },
    secondary: { label: "Request a Quote", href: "/request-a-quote" },
    tertiary: { label: "Book Strategy Call", href: "/strategy-call" },
  },
  "/3d-office-walkthrough": {
    primary: { label: "AI Office Planner", href: "/ai-office-planner" },
    secondary: { label: "Request a Quote", href: "/request-a-quote" },
    tertiary: { label: "Book Strategy Call", href: "/strategy-call" },
  },
  "/finance-your-workspace": {
    primary: { label: "Request a Quote", href: "/request-a-quote" },
    secondary: { label: "Book Strategy Call", href: "/strategy-call" },
    tertiary: { label: "AI Office Planner", href: "/ai-office-planner" },
  },
  "/quote-builder": {
    primary: { label: "Request a Quote", href: "/request-a-quote" },
    secondary: { label: "Book Strategy Call", href: "/strategy-call" },
    tertiary: { label: "Free Layout Plan", href: "/free-layout-plan" },
  },
  "/request-a-quote": {
    primary: { label: "Book Strategy Call", href: "/strategy-call" },
    secondary: { label: "AI Office Planner", href: "/ai-office-planner" },
    tertiary: { label: "Call Us: 1300 977 607", href: "tel:1300977607" },
  },
  "/trade-project-procurement": {
    primary: { label: "Submit Project Brief", href: "/request-a-quote" },
    secondary: { label: "Book Strategy Call", href: "/strategy-call" },
    tertiary: { label: "Call Us: 1300 977 607", href: "tel:1300977607" },
  },
  "/strategy-call": {
    primary: { label: "Request a Quote", href: "/request-a-quote" },
    secondary: { label: "AI Office Planner", href: "/ai-office-planner" },
    tertiary: { label: "Call Us: 1300 977 607", href: "tel:1300977607" },
  },
  "/partners": {
    primary: { label: "Apply to Partner Program", href: "/partners" },
    secondary: { label: "Submit a Referral", href: "/partners" },
    tertiary: { label: "Call Us: 1300 977 607", href: "tel:1300977607" },
  },
};
const DEFAULT_CTA: CTAConfig = {
  primary: { label: "AI Office Planner", href: "/ai-office-planner" },
  secondary: { label: "Request a Quote", href: "/request-a-quote" },
  tertiary: { label: "Book a Strategy Call", href: "/strategy-call" },
};

// ─── Profile extraction ─────────────────────────────────────────────────────

function extractProfileFromText(text: string): Partial<UserProfile> {
  const lower = text.toLowerCase();
  const updates: Partial<UserProfile> = {};

  const sqmMatch = lower.match(/(\d{2,5})\s*(?:sqm|square\s*met(?:re|er)|m2|sq\.?\s*m)/);
  if (sqmMatch) updates.sqm = `${sqmMatch[1]} sqm`;

  const staffMatch = lower.match(/(\d{1,4})\s*(?:staff|people|person|employee|desk|workstation|seat)/);
  if (staffMatch) updates.staff = `${staffMatch[1]} people`;

  const budgetMatch = lower.match(/\$\s*([\d,]+(?:\.\d+)?(?:k|,000|m)?)/i);
  if (budgetMatch) updates.budget = `$${budgetMatch[1]}`;

  if (/executive|luxury|prestige/i.test(lower)) updates.style = "executive / luxury";
  else if (/premium|high.end|upscale/i.test(lower)) updates.style = "premium";
  else if (/modern|contemporary|sleek/i.test(lower)) updates.style = "modern / contemporary";
  else if (/minimalist|clean|simple/i.test(lower)) updates.style = "minimalist";

  const locationMatch = lower.match(/(sydney|melbourne|brisbane|perth|adelaide|canberra|darwin|hobart)/);
  if (locationMatch)
    updates.location = locationMatch[1].charAt(0).toUpperCase() + locationMatch[1].slice(1);

  if (/law\s*firm|legal/i.test(lower)) updates.industry = "legal";
  else if (/tech|software|startup/i.test(lower)) updates.industry = "technology";
  else if (/finance|bank|insurance/i.test(lower)) updates.industry = "financial services";
  else if (/health|medical|clinic/i.test(lower)) updates.industry = "healthcare";

  if (/finance|lease|rental|monthly\s*payment/i.test(lower)) updates.financeInterest = true;
  if (/sit.stand|height.adjust|standing\s*desk/i.test(lower)) updates.sitStandInterest = true;

  return updates;
}

function buildProfileString(profile: UserProfile): string {
  const parts: string[] = [];
  if (profile.sqm) parts.push(`Office: ${profile.sqm}`);
  if (profile.staff) parts.push(`${profile.staff} staff`);
  if (profile.budget) parts.push(`Budget: ${profile.budget}`);
  if (profile.style) parts.push(`Style: ${profile.style}`);
  if (profile.location) parts.push(`Location: ${profile.location}`);
  if (profile.industry) parts.push(`Industry: ${profile.industry}`);
  if (profile.financeInterest) parts.push("Finance interest: yes");
  if (profile.sitStandInterest) parts.push("Sit-stand interest: yes");
  return parts.join(" · ");
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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

function parseRouteLinks(text: string): { clean: string; links: Array<{ href: string; label: string }> } {
  const links: Array<{ href: string; label: string }> = [];
  const clean = text.replace(/\[\[route:([^|\]]+)\|([^\]]+)\]\]/g, (_match, href, label) => {
    links.push({ href: href.trim(), label: label.trim() });
    return "";
  }).trim();
  return { clean, links };
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  const { clean, links } = isUser ? { clean: message.content, links: [] } : parseRouteLinks(message.content);
  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center flex-shrink-0 mb-0.5">
          <Sparkles className="w-3.5 h-3.5 text-[hsl(43,78%,65%)]" />
        </div>
      )}
      <div className="max-w-[82%] flex flex-col gap-2">
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] rounded-br-sm font-medium"
              : "bg-[hsl(220,18%,11%)] border border-[rgba(201,168,76,0.1)] text-white/85 rounded-bl-sm"
          } ${message.isStreaming ? "after:content-['▮'] after:text-[hsl(43,78%,52%)] after:animate-pulse" : ""}`}
        >
          {clean || message.content}
        </div>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, hsl(43,78%,52%) 0%, hsl(38,62%,42%) 100%)",
                  color: "hsl(220,20%,6%)",
                }}
              >
                <ArrowRight className="w-3 h-3" />
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
  const cta = PAGE_CTAS[location] || DEFAULT_CTA;
  const isPhone = cta.tertiary.href.startsWith("tel:");

  return (
    <div className="mx-2 mb-3 rounded-xl border border-[rgba(201,168,76,0.18)] bg-[rgba(201,168,76,0.04)] p-3">
      <p className="text-[10px] text-white/35 mb-2 font-medium uppercase tracking-wider">Suggested Next Step</p>
      <div className="grid grid-cols-1 gap-1.5">
        <Link href={cta.primary.href}>
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[hsl(43,78%,52%)] cursor-pointer active:opacity-80"
            style={{ touchAction: "manipulation" }}
            data-testid="chatbot-cta-primary"
          >
            <span className="text-[hsl(220,20%,6%)] text-xs font-bold">{cta.primary.label}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[hsl(220,20%,6%)]" />
          </div>
        </Link>
        <Link href={cta.secondary.href}>
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[rgba(201,168,76,0.25)] cursor-pointer active:opacity-80"
            style={{ touchAction: "manipulation" }}
            data-testid="chatbot-cta-secondary"
          >
            <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">{cta.secondary.label}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[hsl(43,78%,65%)]" />
          </div>
        </Link>
        {isPhone ? (
          <a href={cta.tertiary.href} data-testid="chatbot-cta-tertiary">
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] cursor-pointer active:opacity-80"
              style={{ touchAction: "manipulation" }}
            >
              <span className="text-white/55 text-xs font-semibold">{cta.tertiary.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/35" />
            </div>
          </a>
        ) : (
          <Link href={cta.tertiary.href}>
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] cursor-pointer active:opacity-80"
              style={{ touchAction: "manipulation" }}
              data-testid="chatbot-cta-tertiary"
            >
              <span className="text-white/55 text-xs font-semibold">{cta.tertiary.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/35" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function NexoraActionCard({ decision, onNavigate }: { decision: NexoraDecision; onNavigate: () => void }) {
  const urgencyColors: Record<string, string> = {
    high: "rgba(201,168,76,0.18)",
    medium: "rgba(201,168,76,0.1)",
    low: "rgba(201,168,76,0.06)",
  };
  const stageLabel: Record<string, string> = {
    exploring: "Exploring",
    qualifying: "Qualifying",
    engaged: "Engaged",
    converting: "Ready to convert",
  };
  return (
    <div
      className="mx-3 mb-3 rounded-xl px-3 py-2.5 flex items-center gap-3"
      style={{
        background: urgencyColors[decision.urgency] || urgencyColors.low,
        border: "1px solid rgba(201,168,76,0.2)",
      }}
      data-testid="nexora-action-card"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[hsl(43,78%,62%)]" style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Nexora recommends
          </span>
          <span className="text-white/25" style={{ fontSize: "9px" }}>•</span>
          <span className="text-white/35" style={{ fontSize: "9px" }}>
            {stageLabel[decision.journeyStage] ?? decision.journeyStage}
          </span>
        </div>
        <p className="text-white/75 text-xs truncate">{decision.nextAction.label}</p>
      </div>
      <Link
        href={decision.nextAction.href}
        onClick={onNavigate}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
        style={{
          background: "linear-gradient(135deg, hsl(43,78%,52%) 0%, hsl(38,62%,42%) 100%)",
          color: "hsl(220,20%,6%)",
        }}
        data-testid="nexora-action-cta"
      >
        Go <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function OrbTrigger({
  isOpen,
  showBadge,
  onClick,
}: {
  isOpen: boolean;
  showBadge: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative group">
      {/* Hover tooltip */}
      {!isOpen && (
        <div
          className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-y-1 group-hover:translate-y-0"
          style={{ whiteSpace: "nowrap" }}
        >
          <div
            className="rounded-xl px-3 py-2 shadow-xl"
            style={{
              background: "hsl(220,18%,10%)",
              border: "1px solid rgba(201,168,76,0.22)",
            }}
          >
            <p className="text-white text-xs font-semibold leading-tight">Nexora</p>
            <p className="text-[hsl(43,78%,62%)] text-[10px] leading-tight mt-0.5">
              The Corporate Desk · AI
            </p>
          </div>
          <div
            className="absolute right-5 top-full w-0 h-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid rgba(201,168,76,0.22)",
            }}
          />
        </div>
      )}

      {/* Ambient pulse ring */}
      {!isOpen && (
        <span
          className="absolute inset-0 rounded-full animate-ping pointer-events-none"
          style={{
            background: "rgba(201,168,76,0.18)",
            animationDuration: "3s",
          }}
        />
      )}

      {/* Orb */}
      <button
        onClick={onClick}
        className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95"
        style={{
          background: isOpen
            ? "hsl(220,18%,13%)"
            : "linear-gradient(135deg, hsl(43,78%,56%) 0%, hsl(38,62%,39%) 100%)",
          border: isOpen
            ? "1px solid rgba(201,168,76,0.3)"
            : "1px solid rgba(201,168,76,0.12)",
          boxShadow: isOpen
            ? "0 4px 24px rgba(0,0,0,0.5)"
            : "0 0 0 1px rgba(201,168,76,0.08), 0 4px 24px rgba(201,168,76,0.42), 0 2px 8px rgba(0,0,0,0.5)",
          touchAction: "manipulation",
        }}
        aria-label={isOpen ? "Close workspace advisor" : "Open workspace advisor"}
        data-testid="chatbot-toggle"
      >
        <span
          className="transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(90deg) scale(0.9)" : "rotate(0deg) scale(1)" }}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <Sparkles className="w-5 h-5 text-[hsl(220,20%,6%)]" />
          )}
        </span>

        {/* Online dot */}
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 z-20 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[hsl(220,20%,6%)] shadow" />
        )}

        {/* Notification badge */}
        {showBadge && !isOpen && (
          <span className="absolute -top-1 -right-1 z-30 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md animate-pulse">
            1
          </span>
        )}
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ChatBot() {
  const [location] = useLocation();
  const {
    messages,
    apiHistory,
    userProfile,
    messageCount,
    showCTA,
    showQuickReplies,
    hasShownWelcome,
    isOpen,
    previousPage,
    signalLog,
    closerMode,
    setIsOpen,
    setMessages,
    setApiHistory,
    setUserProfile,
    setMessageCount,
    setShowCTA,
    setShowQuickReplies,
    setHasShownWelcome,
    setIntent,
    setJourneyStage,
    setSelectedService,
    setLastDecision,
    emit,
  } = useConcierge();
  const [nexoraDecision, setNexoraDecision] = useState<NexoraDecision | null>(null);

  const isLoadingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize welcome greeting once (first visit, no history)
  useEffect(() => {
    if (!hasShownWelcome && messages.length === 0) {
      const greeting = PAGE_GREETINGS[location] || DEFAULT_GREETING;
      const welcomeMsg: ConversationMessage = {
        id: "greeting-0",
        role: "assistant",
        content: greeting,
      };
      setMessages([welcomeMsg]);
      setApiHistory([{ role: "assistant", content: greeting }]);
      setHasShownWelcome(true);
    }
  }, []); // intentionally run once on mount

  // Badge timer
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isOpen) setShowBadge(true);
    }, 10000);
    return () => clearTimeout(t);
  }, []); // intentionally run once

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  }, [messages, isOpen]);

  // Focus input and clear badge when opened
  useEffect(() => {
    if (isOpen) {
      setShowBadge(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const pageLabel =
    PAGE_LABELS[location] ||
    (location.startsWith("/catalog/") ? "Product Catalogue" : "The Corporate Desk");
  const profileString = buildProfileString(userProfile);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoadingRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);

      const userMsg: ConversationMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: content.trim(),
      };

      const newHistory = [...apiHistory, { role: "user" as const, content: content.trim() }];
      setMessages((prev) => [...prev, userMsg]);
      setApiHistory(newHistory);
      setInputValue("");
      setShowQuickReplies(false);

      // Extract profile data from user message
      const extracted = extractProfileFromText(content);
      if (Object.keys(extracted).length > 0) {
        setUserProfile((prev) => ({ ...prev, ...extracted }));
      }

      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", isStreaming: true },
      ]);

      try {
        // Run Nexora engine — classify intent and compute next action
        const nexoraInput = {
          currentRoute: location,
          previousRoute: previousPage ?? null,
          pagesVisited: userProfile.pagesVisited,
          signalLog,
          messageText: content.trim(),
          messageCount,
          userProfile,
          conversationHistory: newHistory,
        };
        const decision = runNexoraEngine(nexoraInput);
        setNexoraDecision(decision);
        setLastDecision(decision);
        setIntent(decision.intent);
        setJourneyStage(decision.journeyStage);
        if (decision.leadUpdate?.service) setSelectedService(decision.leadUpdate.service);

        // Fire-and-forget lead update for medium/high urgency
        if (decision.leadUpdate && decision.urgency !== "low") {
          fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: userProfile.staff ? `AI Session – ${userProfile.staff} staff` : userProfile.company ? `AI Session – ${userProfile.company}` : "AI Session Capture",
              email: userProfile.email || "nexora-capture@thecorporatedesk.com.au",
              company: userProfile.company || "",
              phone: "",
              type: "nexora_session",
              sourcePage: location,
              message: decision.leadUpdate.notes,
              officeSize: userProfile.sqm,
              staffCount: userProfile.staff,
              budget: userProfile.budget,
              officeLocation: userProfile.location,
              nexoraIntent: decision.intent,
              nexoraJourney: decision.journeyStage,
              nexoraUrgency: decision.urgency,
              nexoraConfidence: decision.confidence,
              nexoraAdminSummary: decision.adminSummary,
              nexoraNextAction: decision.nextAction.href,
              nexoraDealBand: decision.leadUpdate.estimatedDealBand || undefined,
              nexoraEscalation: decision.escalationRequired ? "yes" : "no",
            }),
          }).catch(() => {});
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newHistory,
            stream: true,
            pageContext: pageLabel,
            userProfile: profileString || undefined,
            nexoraContext: decision.systemContext,
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
                    m.id === assistantId ? { ...m, content: fullContent, isStreaming: true } : m
                  )
                );
              }
            } catch (_) {}
          }
        }

        const finalHistory = [...newHistory, { role: "assistant" as const, content: fullContent }];
        setApiHistory(finalHistory);
        emit("ASSISTANT_MESSAGE", { length: fullContent.length, closerMode: decision.closerMode ? 1 : 0 });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: fullContent, isStreaming: false } : m
          )
        );

        // Also extract profile from AI reply
        const extractedReply = extractProfileFromText(fullContent);
        if (Object.keys(extractedReply).length > 0) {
          setUserProfile((prev) => ({ ...prev, ...extractedReply }));
        }

        setMessageCount((prev) => {
          const next = prev + 1;
          if (next >= 2) setShowCTA(true);
          if (next >= 3) setShowQuickReplies(true);
          return next;
        });
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
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
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      apiHistory,
      pageLabel,
      profileString,
      previousPage,
      userProfile,
      messageCount,
      location,
      signalLog,
      setApiHistory,
      setMessageCount,
      setMessages,
      setShowCTA,
      setShowQuickReplies,
      setUserProfile,
      setIntent,
      setJourneyStage,
      setSelectedService,
      setLastDecision,
      emit,
    ]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const quickReplies =
    messageCount === 0
      ? PAGE_QUICK_REPLIES[location] || DEFAULT_QUICK_REPLIES
      : FOLLOWUP_QUICK_REPLIES;

  const currentPageLabel = PAGE_LABELS[location] || pageLabel;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
      )}

      <div className="fixed bottom-28 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">
        {isOpen && (
          <div
            className="w-[min(385px,calc(100vw-24px))] flex flex-col overflow-hidden rounded-2xl"
            style={{
              height: isMinimized ? "auto" : "min(560px, calc(100dvh - 100px))",
              background: "hsl(220,18%,8%)",
              border: "1px solid rgba(201,168,76,0.18)",
              boxShadow:
                "0 0 0 1px rgba(201,168,76,0.06), 0 32px 64px rgba(0,0,0,0.72), 0 8px 24px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="chatbot-window"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{
                background: "hsl(220,18%,7%)",
                borderBottom: "1px solid rgba(201,168,76,0.1)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(201,168,76,0.2) 0%, rgba(201,168,76,0.06) 100%)",
                      border: "1px solid rgba(201,168,76,0.32)",
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-[hsl(43,78%,62%)]" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[hsl(220,18%,7%)]" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight tracking-tight">
                    Nexora
                  </p>
                  <p className="text-[hsl(43,78%,56%)] text-[11px] leading-tight mt-0.5">
                    Workspace Intelligence · The Corporate Desk
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Page context badge */}
                <div
                  className="hidden sm:flex items-center px-2 py-1 rounded-md mr-0.5"
                  style={{
                    background: "rgba(201,168,76,0.07)",
                    border: "1px solid rgba(201,168,76,0.14)",
                  }}
                >
                  <span
                    className="text-[hsl(43,78%,55%)] font-medium truncate"
                    style={{ fontSize: "10px", maxWidth: "90px" }}
                  >
                    {currentPageLabel}
                  </span>
                </div>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  style={{ touchAction: "manipulation" }}
                  aria-label="Minimize"
                  data-testid="chatbot-minimize"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isMinimized ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  style={{ touchAction: "manipulation" }}
                  aria-label="Close"
                  data-testid="chatbot-close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 overscroll-contain">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  {isLoading && messages[messages.length - 1]?.isStreaming === false && (
                    <TypingIndicator />
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick replies */}
                {showQuickReplies && !isLoading && (
                  <div className="px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.value}
                        onClick={() => sendMessage(reply.value)}
                        className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                        style={{
                          border: "1px solid rgba(201,168,76,0.22)",
                          color: "hsl(43,78%,62%)",
                          touchAction: "manipulation",
                          minHeight: "36px",
                        }}
                        data-testid={`chatbot-quick-reply-${reply.label
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Nexora action card */}
                {nexoraDecision && nexoraDecision.urgency !== "low" && !isLoading && (
                  <NexoraActionCard decision={nexoraDecision} onNavigate={() => setIsOpen(false)} />
                )}

                {/* CTA */}
                {showCTA && !isLoading && !nexoraDecision && <CTACard location={location} />}

                {/* Input */}
                <form
                  onSubmit={handleSubmit}
                  className="px-3 pb-3 pt-2 flex-shrink-0"
                  style={{ borderTop: "1px solid rgba(201,168,76,0.08)" }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors"
                    style={{
                      background: "hsl(220,18%,11%)",
                      border: "1px solid rgba(201,168,76,0.13)",
                    }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Ask about fitouts, products, pricing..."
                      className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none min-w-0"
                      style={{ fontSize: "16px" }}
                      disabled={isLoading}
                      data-testid="chatbot-input"
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isLoading}
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
                      style={{
                        background: "hsl(43,78%,52%)",
                        touchAction: "manipulation",
                      }}
                      data-testid="chatbot-send"
                    >
                      <Send className="w-3.5 h-3.5 text-[hsl(220,20%,6%)]" />
                    </button>
                  </div>
                  <p
                    className="text-center mt-1.5"
                    style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)" }}
                  >
                    AI Workspace Intelligence · The Corporate Desk
                  </p>
                </form>
              </>
            )}
          </div>
        )}

        <OrbTrigger
          isOpen={isOpen}
          showBadge={showBadge}
          onClick={() => {
            setIsOpen(!isOpen);
            setShowBadge(false);
          }}
        />
      </div>
    </>
  );
}
