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

  useEffect(() => {
    const path = location || window.location.pathname;
    if (path === lastTracked.current) return;
    lastTracked.current = path;

    const sessionId = getOrCreateSessionId();
    const referrer = document.referrer || undefined;
    const utms = getUtmParams();

    fetch("/api/track/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagePath: path, referrer, sessionId, ...utms }),
      keepalive: true,
    }).catch(() => {});
  }, [location]);
}
