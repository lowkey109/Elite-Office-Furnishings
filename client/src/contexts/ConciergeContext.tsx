import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import type { NexoraIntent, JourneyStage } from "@/lib/nexoraEngine";

export type { NexoraIntent, JourneyStage };

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
  financeInterest?: boolean;
  sitStandInterest?: boolean;
  pagesVisited: string[];
  plannerStarted: boolean;
  quoteStarted: boolean;
}

interface ConciergeContextValue {
  messages: ConversationMessage[];
  apiHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userProfile: UserProfile;
  messageCount: number;
  showCTA: boolean;
  showQuickReplies: boolean;
  hasShownWelcome: boolean;
  currentPage: string;
  previousPage: string | null;
  isOpen: boolean;
  intent: NexoraIntent;
  journeyStage: JourneyStage;
  selectedService: string | null;
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
}

const DEFAULT_PROFILE: UserProfile = {
  pagesVisited: [],
  plannerStarted: false,
  quoteStarted: false,
};

const ConciergeContext = createContext<ConciergeContextValue | null>(null);

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

export function ConciergeProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [previousPage, setPreviousPage] = useState<string | null>(null);

  const [messages, setMessagesRaw] = useState<ConversationMessage[]>(() => ss("tcd_c_msgs", []));
  const [apiHistory, setApiHistoryRaw] = useState<Array<{ role: "user" | "assistant"; content: string }>>(() =>
    ss("tcd_c_hist", [])
  );
  const [userProfile, setUserProfileRaw] = useState<UserProfile>(() => ss("tcd_c_profile", DEFAULT_PROFILE));
  const [messageCount, setMessageCountRaw] = useState<number>(() => ss("tcd_c_count", 0));
  const [showCTA, setShowCTARaw] = useState<boolean>(() => ss("tcd_c_cta", false));
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [hasShownWelcome, setHasShownWelcomeRaw] = useState<boolean>(() => ss("tcd_c_welcome", false));
  const [isOpen, setIsOpen] = useState(false);
  const [intent, setIntentRaw] = useState<NexoraIntent>(() => ss("tcd_n_intent", "EXPLORE" as NexoraIntent));
  const [journeyStage, setJourneyStageRaw] = useState<JourneyStage>(() => ss("tcd_n_journey", "exploring" as JourneyStage));
  const [selectedService, setSelectedServiceRaw] = useState<string | null>(() => ss("tcd_n_service", null));

  useEffect(() => {
    setUserProfileRaw((prev) => {
      if (prev.pagesVisited.includes(location)) return prev;
      const updated = { ...prev, pagesVisited: [...prev.pagesVisited, location] };
      sw("tcd_c_profile", updated);
      return updated;
    });
    setPreviousPage((prev) => (prev !== location ? prev ?? null : prev));
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

  return (
    <ConciergeContext.Provider
      value={{
        messages,
        apiHistory,
        userProfile,
        messageCount,
        showCTA,
        showQuickReplies,
        hasShownWelcome,
        currentPage: location,
        previousPage,
        isOpen,
        intent,
        journeyStage,
        selectedService,
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
