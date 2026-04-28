import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

export default function StickyCTA() {
  const [location] = useLocation();

  if (
    location.startsWith("/admin") ||
    location.includes("thank-you") ||
    location.includes("checkout") ||
    location.includes("payment-success")
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <Link
          href="/upload-your-floor-plan"
          className="flex-1 rounded-full bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          Upload floor plan
        </Link>
        <Link
          href="/quote-builder"
          className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-950"
        >
          Get quote <ArrowRight className="inline h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
