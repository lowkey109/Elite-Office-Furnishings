import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

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
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setMessages: (msgs: ConversationMessage[] | ((prev: ConversationMessage[]) => ConversationMessage[])) => void;
  setApiHistory: (history: Array<{ role: "user" | "assistant"; content: string }>) => void;
  setUserProfile: (profile: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
  setMessageCount: (count: number | ((prev: number) => number)) => void;
  setShowCTA: (show: boolean) => void;
  setShowQuickReplies: (show: boolean) => void;
  setHasShownWelcome: (shown: boolean) => void;
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

  useEffect(() => {
    setUserProfileRaw((prev) => {
      if (prev.pagesVisited.includes(location)) return prev;
      const updated = { ...prev, pagesVisited: [...prev.pagesVisited, location] };
      sw("tcd_c_profile", updated);
      return updated;
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
        isOpen,
        setIsOpen,
        setMessages,
        setApiHistory,
        setUserProfile,
        setMessageCount,
        setShowCTA,
        setShowQuickReplies,
        setHasShownWelcome,
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
