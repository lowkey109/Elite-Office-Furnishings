import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowRight, UploadCloud } from "lucide-react";

const HIDDEN_KEY = "tcd_lead_popup_hidden_until";

export default function LeadCapturePopup() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hiddenUntil = Number(localStorage.getItem(HIDDEN_KEY) || "0");
    if (Date.now() < hiddenUntil) return;
    if (location.startsWith("/admin") || location.includes("thank-you") || location.includes("checkout")) return;

    const timer = window.setTimeout(() => setOpen(true), 35000);

    const onMouseOut = (event: MouseEvent) => {
      if (event.clientY <= 0) setOpen(true);
    };

    document.addEventListener("mouseout", onMouseOut);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [location]);

  function close() {
    localStorage.setItem(HIDDEN_KEY, String(Date.now() + 1000 * 60 * 60 * 24 * 7));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl md:bottom-8">
      <button
        onClick={close}
        className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Close popup"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          <UploadCloud className="h-4 w-4" />
          Free workspace plan direction
        </div>
        <h3 className="text-2xl font-bold">Planning an office fitout or furniture upgrade?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload your floor plan or tell us what you need. We’ll help turn it into a clearer layout, budget, supplier plan, and next steps.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/upload-your-floor-plan"
            onClick={close}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Upload floor plan <ArrowRight className="ml-1 inline h-4 w-4" />
          </Link>
          <Link
            href="/quote-builder"
            onClick={close}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Build a quote
          </Link>
        </div>
      </div>
    </div>
  );
}
