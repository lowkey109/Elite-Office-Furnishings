import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

// ── Env-var configuration ──────────────────────────────────────────────────
// Set these in Replit Secrets as VITE_* variables to activate each pixel.
// Components silently do nothing if the corresponding ID is not set.
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const LINKEDIN_PARTNER_ID = import.meta.env.VITE_LINKEDIN_PARTNER_ID as string | undefined;

// ── Helpers ────────────────────────────────────────────────────────────────

function loadScript(src: string, id: string, onLoad?: () => void): void {
  if (document.getElementById(id)) { onLoad?.(); return; }
  const script = document.createElement("script");
  script.id = id;
  script.src = src;
  script.async = true;
  if (onLoad) script.onload = onLoad;
  document.head.appendChild(script);
}

function inlineScript(code: string, id: string): void {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.textContent = code;
  document.head.appendChild(script);
}

function inlineMetaNoScript(pixelId: string, id: string): void {
  if (document.getElementById(id)) return;
  const ns = document.createElement("noscript");
  ns.id = id;
  const img = document.createElement("img");
  img.setAttribute("height", "1");
  img.setAttribute("width", "1");
  img.style.display = "none";
  img.src = `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`;
  img.alt = "";
  ns.appendChild(img);
  document.body.appendChild(ns);
}

// ── Meta Pixel ─────────────────────────────────────────────────────────────

function initMetaPixel(pixelId: string): void {
  // Inject the Meta Pixel base code
  inlineScript(`
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `, "meta-pixel-base");

  inlineMetaNoScript(pixelId, "meta-pixel-noscript");
}

function trackMetaPageView(): void {
  if (typeof (window as any).fbq === "function") {
    (window as any).fbq("track", "PageView");
  }
}

// ── Google Analytics 4 ─────────────────────────────────────────────────────

function initGA4(measurementId: string): void {
  loadScript(
    `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
    "ga4-script"
  );
  inlineScript(`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}', { send_page_view: false });
  `, "ga4-config");
}

function trackGA4PageView(path: string, measurementId: string): void {
  if (typeof (window as any).gtag === "function") {
    (window as any).gtag("config", measurementId, {
      page_path: path,
      page_location: window.location.href,
    });
  }
}

// ── LinkedIn Insight Tag ───────────────────────────────────────────────────

function initLinkedIn(partnerId: string): void {
  inlineScript(`
    _linkedin_partner_id = "${partnerId}";
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(_linkedin_partner_id);
  `, "linkedin-config");

  loadScript(
    "https://snap.licdn.com/li.lms-analytics/insight.min.js",
    "linkedin-insight"
  );

  inlineScript(
    `<img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif" />`,
    "linkedin-noscript"
  );
}

// ── Main TrackingPixels component ──────────────────────────────────────────

export function TrackingPixels() {
  const [location] = useLocation();
  const initialized = useRef(false);

  // One-time pixel initialisation on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (META_PIXEL_ID) {
      initMetaPixel(META_PIXEL_ID);
    }
    if (GA_MEASUREMENT_ID) {
      initGA4(GA_MEASUREMENT_ID);
    }
    if (LINKEDIN_PARTNER_ID) {
      initLinkedIn(LINKEDIN_PARTNER_ID);
    }
  }, []);

  // Fire page-view events on every SPA route change (after initial mount)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // Skipped — init already fires first page view
    }

    if (META_PIXEL_ID) {
      trackMetaPageView();
    }
    if (GA_MEASUREMENT_ID) {
      trackGA4PageView(location, GA_MEASUREMENT_ID);
    }
    // LinkedIn auto-tracks via the insight tag on page navigation — no manual call needed
  }, [location]);

  // This component renders nothing — it only injects scripts as side effects
  return null;
}
