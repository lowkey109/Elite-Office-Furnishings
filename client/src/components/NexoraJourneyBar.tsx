/**
 * NexoraJourneyBar
 *
 * A persistent, context-aware journey prompt that shows Nexora's current
 * recommendation across every page. It reads the lastDecision from ConciergeContext
 * and surfaces the recommended next action as a non-intrusive inline bar.
 *
 * Rules:
 * - Hidden on admin routes
 * - Hidden when no meaningful decision has been made (exploring stage with no signals)
 * - Shows the PRIMARY recommended action from Nexora
 * - Links directly to the recommended route
 * - Shows urgency visual (critical = red glow, high = gold, medium = subtle)
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowRight, Zap, Brain } from "lucide-react";
import { useConcierge } from "@/contexts/ConciergeContext";
import { useNexoraSignal } from "@/hooks/useNexoraSignal";

const HIDDEN_ROUTES = [
  "/admin", "/admin/", "/admin/dashboard", "/admin/leads", "/admin/quotes",
  "/admin/nexora", "/admin/intelligence-hub", "/admin/deal-pipeline",
  "/admin/deal-intelligence", "/admin/deal-hunter", "/admin/command-centre",
  "/admin/planning-requests", "/admin/product-command-centre",
  "/admin/catalog-staging", "/admin/procurement-engine", "/admin/profit-engine",
  "/admin/market-intelligence", "/admin/territory-scanner", "/admin/relocation-intelligence",
  "/admin/company-visitors", "/admin/office-mov-radar", "/admin/lease-signals",
  "/admin/partner-network", "/admin/partners", "/admin/supplier-intelligence",
  "/admin/follow-up-sequences", "/admin/alex", "/admin/manufacturer-messaging",
];

const URGENCY_STYLES = {
  critical: "bg-red-950/60 border-red-500/30 text-red-300",
  high: "bg-[rgba(201,168,76,0.08)] border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)]",
  medium: "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-white/70",
  low: "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white/50",
};

const URGENCY_DOT = {
  critical: "bg-red-400 animate-pulse",
  high: "bg-[hsl(43,78%,52%)]",
  medium: "bg-white/40",
  low: "bg-white/25",
};

const STAGE_LABEL: Record<string, string> = {
  exploring: "Discovering",
  qualifying: "Qualifying",
  engaged: "Engaged",
  converting: "Ready to Act",
};

// Don't show on these pages as they already have strong CTAs
const CONVERSION_ROUTES = [
  "/request-a-quote", "/strategy-call", "/send-us-your-quote",
  "/quote-builder", "/thank-you-layout-plan", "/thank-you-quote",
  "/thank-you-strategy",
];

export function NexoraJourneyBar() {
  const [location] = useLocation();
  const { lastDecision, journeyStage, intent } = useConcierge();
  const { emitCTAClick } = useNexoraSignal();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state on route change
  useEffect(() => {
    setDismissed(false);
  }, [location]);

  // Hide on admin routes
  if (HIDDEN_ROUTES.some(r => location.startsWith(r))) return null;

  // Hide on conversion-destination routes
  if (CONVERSION_ROUTES.includes(location)) return null;

  // Hide if dismissed
  if (dismissed) return null;

  // Hide if no meaningful decision or still purely exploring
  if (!lastDecision || (journeyStage === "exploring" && intent === "EXPLORE")) return null;

  // Hide if intent is EXPLORE with low confidence (nothing meaningful yet)
  if (lastDecision.confidence < 30 && lastDecision.intent === "EXPLORE") return null;

  const { nextAction, urgency, closerMode, escalationRequired } = lastDecision;
  const urgencyStyle = URGENCY_STYLES[urgency] || URGENCY_STYLES.medium;
  const dotStyle = URGENCY_DOT[urgency] || URGENCY_DOT.medium;

  const handleCTAClick = () => {
    emitCTAClick(nextAction.label, nextAction.href);
  };

  return (
    <div className={`fixed bottom-[80px] left-0 right-0 z-40 pointer-events-none px-4 sm:px-6`}>
      <div className="max-w-5xl mx-auto pointer-events-auto">
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm backdrop-blur-md shadow-xl transition-all ${urgencyStyle}`}
          role="status"
          aria-label="Nexora recommendation"
        >
          {/* Nexora brand dot */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotStyle}`} />
            <Brain className="w-3.5 h-3.5 opacity-60 hidden sm:block" />
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <span className="opacity-60 text-xs hidden sm:inline mr-1">
              {closerMode ? "Ready to proceed?" : escalationRequired ? "Escalation recommended" : `Nexora · ${STAGE_LABEL[journeyStage] || journeyStage}`}
            </span>
            <span className="font-medium truncate">{nextAction.label}</span>
          </div>

          {/* CTA */}
          <Link
            href={nextAction.href}
            onClick={handleCTAClick}
            className="flex items-center gap-1.5 flex-shrink-0 font-semibold text-xs bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg transition-colors"
            data-testid="nexora-bar-cta"
          >
            {closerMode ? "Proceed" : "Continue"}
            <ArrowRight className="w-3 h-3" />
          </Link>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 opacity-40 hover:opacity-70 transition-opacity p-1"
            aria-label="Dismiss recommendation"
            data-testid="nexora-bar-dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
