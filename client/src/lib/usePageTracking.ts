import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

function getOrCreateSessionId(): string {
  const key = "tcd_session_id";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

function getUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource: p.get("utm_source") || undefined,
    utmMedium: p.get("utm_medium") || undefined,
    utmCampaign: p.get("utm_campaign") || undefined,
  };
}

export function usePageTracking() {
  const [location] = useLocation();
  const lastTracked = useRef<string>("");
  const sessionStart = useRef<number>(Date.now());

  useEffect(() => {
    const path = location || window.location.pathname;
    if (path === lastTracked.current) return;
    lastTracked.current = path;

    const sessionId = getOrCreateSessionId();
    const referrer = document.referrer || undefined;
    const utms = getUtmParams();
    const sessionDuration = Math.round((Date.now() - sessionStart.current) / 1000);

    // Existing analytics pageview tracker
    fetch("/api/track/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagePath: path, referrer, sessionId, ...utms }),
      keepalive: true,
    }).catch(() => {});

    // Company visitor identification — enrich with IP and score engagement
    fetch("/api/track/visitor-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: sessionId, pagePath: path, referrer, utmSource: utms.utmSource, sessionDuration }),
      keepalive: true,
    }).catch(() => {});
  }, [location]);
}
