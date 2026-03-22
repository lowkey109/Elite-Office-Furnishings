/**
 * NEXORA CONTEXT — Global Platform State Layer
 *
 * This is the central state bus for the Nexora operating system.
 * Every meaningful user action is captured as a signal here.
 * The UI reads from this context. Nexora writes to it.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import type { NexoraIntent, JourneyStage, NexoraSignal, NexoraSignalType, NexoraDecision } from "@/lib/nexoraEngine";

export type { NexoraIntent, JourneyStage, NexoraSignal, NexoraSignalType };

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export interface UserProfile {
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
  pagesVisited: string[];
  plannerStarted: boolean;
  quoteStarted: boolean;
}

interface ConciergeContextValue {
  // Session
  sessionId: string;

  // Conversation
  messages: ConversationMessage[];
  apiHistory: Array<{ role: "user" | "assistant"; content: string }>;
  messageCount: number;
  hasShownWelcome: boolean;
  showCTA: boolean;
  showQuickReplies: boolean;

  // User data
  userProfile: UserProfile;

  // Navigation state
  currentPage: string;
  previousPage: string | null;

  // Assistant UI state
  isOpen: boolean;

  // Nexora decision state
  intent: NexoraIntent;
  journeyStage: JourneyStage;
  selectedService: string | null;
  lastDecision: NexoraDecision | null;
  closerMode: boolean;
  problemSolverMode: boolean;

  // Signal log
  signalLog: NexoraSignal[];

  // Setters
  setIsOpen: (open: boolean) => void;
  setMessages: (msgs: ConversationMessage[] | ((prev: ConversationMessage[]) => ConversationMessage[])) => void;
  setApiHistory: (history: Array<{ role: "user" | "assistant"; content: string }>) => void;
  setUserProfile: (profile: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
  setMessageCount: (count: number | ((prev: number) => number)) => void;
  setShowCTA: (show: boolean) => void;
  setShowQuickReplies: (show: boolean) => void;
  setHasShownWelcome: (shown: boolean) => void;
  setIntent: (intent: NexoraIntent) => void;
  setJourneyStage: (stage: JourneyStage) => void;
  setSelectedService: (service: string | null) => void;
  setLastDecision: (decision: NexoraDecision | null) => void;

  // Signal emission — the universal capture method
  emit: (type: NexoraSignalType, payload?: Record<string, string | number | boolean | null>) => void;
}

const DEFAULT_PROFILE: UserProfile = {
  pagesVisited: [],
  plannerStarted: false,
  quoteStarted: false,
};

const ConciergeContext = createContext<ConciergeContextValue | null>(null);

// ─── Session Storage Helpers ──────────────────────────────────────────────────

function ss<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function sw(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function genSessionId(): string {
  return `nxr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConciergeProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const previousPageRef = useRef<string | null>(null);
  const [previousPage, setPreviousPage] = useState<string | null>(null);

  // Session identity
  const [sessionId] = useState<string>(() => ss("tcd_n_sid", genSessionId()));

  // Conversation
  const [messages, setMessagesRaw] = useState<ConversationMessage[]>(() => ss("tcd_c_msgs", []));
  const [apiHistory, setApiHistoryRaw] = useState<Array<{ role: "user" | "assistant"; content: string }>>(() => ss("tcd_c_hist", []));
  const [messageCount, setMessageCountRaw] = useState<number>(() => ss("tcd_c_count", 0));
  const [showCTA, setShowCTARaw] = useState<boolean>(() => ss("tcd_c_cta", false));
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [hasShownWelcome, setHasShownWelcomeRaw] = useState<boolean>(() => ss("tcd_c_welcome", false));
  const [isOpen, setIsOpen] = useState(false);

  // User profile
  const [userProfile, setUserProfileRaw] = useState<UserProfile>(() => ss("tcd_c_profile", DEFAULT_PROFILE));

  // Nexora state
  const [intent, setIntentRaw] = useState<NexoraIntent>(() => ss("tcd_n_intent", "EXPLORE" as NexoraIntent));
  const [journeyStage, setJourneyStageRaw] = useState<JourneyStage>(() => ss("tcd_n_journey", "exploring" as JourneyStage));
  const [selectedService, setSelectedServiceRaw] = useState<string | null>(() => ss("tcd_n_service", null));
  const [lastDecision, setLastDecisionRaw] = useState<NexoraDecision | null>(() => ss("tcd_n_decision", null));
  const [closerMode, setCloserMode] = useState(false);
  const [problemSolverMode, setProblemSolverMode] = useState(false);

  // Signal log — capped at 50 signals in session storage
  const [signalLog, setSignalLogRaw] = useState<NexoraSignal[]>(() => ss("tcd_n_signals", []));

  // ─── Route change tracking ────────────────────────────────────────────────

  useEffect(() => {
    // Track page navigation as a signal
    const isNew = !userProfile.pagesVisited.includes(location);
    setUserProfileRaw((prev) => {
      if (prev.pagesVisited.includes(location)) return prev;
      const updated = { ...prev, pagesVisited: [...prev.pagesVisited, location] };
      sw("tcd_c_profile", updated);
      return updated;
    });

    // Update previous page
    if (previousPageRef.current !== location) {
      setPreviousPage(previousPageRef.current);
      previousPageRef.current = location;
    }

    // Emit PAGE_VIEW signal
    setSignalLogRaw((prev) => {
      const sig: NexoraSignal = { type: "PAGE_VIEW", route: location, timestamp: Date.now() };
      const next = [...prev.slice(-49), sig];
      sw("tcd_n_signals", next);
      return next;
    });

    // Route-specific automatic intent signals
    const routeSignalMap: Partial<Record<string, NexoraSignalType>> = {
      "/finance-your-workspace": "FINANCE_VIEW",
      "/trade-project-procurement": "TRADE_VIEW",
      "/strategy-call": "STRATEGY_VIEW",
      "/partners": "PARTNER_VIEW",
      "/ai-office-planner": "PLANNER_START",
      "/upload-your-floor-plan": "PLANNER_START",
      "/quote-builder": "QUOTE_START",
      "/request-a-quote": "QUOTE_START",
    };
    const autoSignal = routeSignalMap[location];
    if (autoSignal) {
      setSignalLogRaw((prev) => {
        const sig: NexoraSignal = { type: autoSignal, route: location, timestamp: Date.now() };
        const next = [...prev.slice(-49), sig];
        sw("tcd_n_signals", next);
        return next;
      });
    }
  }, [location]);

  // Update closer/problem modes from lastDecision
  useEffect(() => {
    if (lastDecision) {
      setCloserMode(lastDecision.closerMode);
      setProblemSolverMode(lastDecision.problemSolverMode);
    }
  }, [lastDecision]);

  // ─── Stable setters ──────────────────────────────────────────────────────

  const emit = useCallback((type: NexoraSignalType, payload?: Record<string, string | number | boolean | null>) => {
    setSignalLogRaw((prev) => {
      const sig: NexoraSignal = { type, route: location, payload, timestamp: Date.now() };
      const next = [...prev.slice(-49), sig];
      sw("tcd_n_signals", next);
      return next;
    });
  }, [location]);

  const setMessages = useCallback(
    (msgs: ConversationMessage[] | ((prev: ConversationMessage[]) => ConversationMessage[])) => {
      setMessagesRaw((prev) => {
        const next = typeof msgs === "function" ? msgs(prev) : msgs;
        sw("tcd_c_msgs", next);
        return next;
      });
    },
    []
  );

  const setApiHistory = useCallback((history: Array<{ role: "user" | "assistant"; content: string }>) => {
    setApiHistoryRaw(history);
    sw("tcd_c_hist", history);
  }, []);

  const setUserProfile = useCallback((profile: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setUserProfileRaw((prev) => {
      const next = typeof profile === "function" ? profile(prev) : profile;
      sw("tcd_c_profile", next);
      return next;
    });
  }, []);

  const setMessageCount = useCallback((count: number | ((prev: number) => number)) => {
    setMessageCountRaw((prev) => {
      const next = typeof count === "function" ? count(prev) : count;
      sw("tcd_c_count", next);
      return next;
    });
  }, []);

  const setShowCTA = useCallback((show: boolean) => {
    setShowCTARaw(show);
    sw("tcd_c_cta", show);
  }, []);

  const setHasShownWelcome = useCallback((shown: boolean) => {
    setHasShownWelcomeRaw(shown);
    sw("tcd_c_welcome", shown);
  }, []);

  const setIntent = useCallback((i: NexoraIntent) => {
    setIntentRaw(i);
    sw("tcd_n_intent", i);
  }, []);

  const setJourneyStage = useCallback((s: JourneyStage) => {
    setJourneyStageRaw(s);
    sw("tcd_n_journey", s);
  }, []);

  const setSelectedService = useCallback((s: string | null) => {
    setSelectedServiceRaw(s);
    sw("tcd_n_service", s);
  }, []);

  const setLastDecision = useCallback((d: NexoraDecision | null) => {
    setLastDecisionRaw(d);
    sw("tcd_n_decision", d);
  }, []);

  return (
    <ConciergeContext.Provider
      value={{
        sessionId,
        messages,
        apiHistory,
        messageCount,
        showCTA,
        showQuickReplies,
        hasShownWelcome,
        userProfile,
        currentPage: location,
        previousPage,
        isOpen,
        intent,
        journeyStage,
        selectedService,
        lastDecision,
        closerMode,
        problemSolverMode,
        signalLog,
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
      }}
    >
      {children}
    </ConciergeContext.Provider>
  );
}

export function useConcierge() {
  const ctx = useContext(ConciergeContext);
  if (!ctx) throw new Error("useConcierge must be used within ConciergeProvider");
  return ctx;
}
