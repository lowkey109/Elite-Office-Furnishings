import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";

export default function LegalAcceptance({
  accepted,
  onAcceptedChange,
}: {
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-200">Legal acknowledgement</p>
          <p className="text-white/55 text-sm mt-1">
            By continuing, you agree to The Corporate Desk terms, privacy notice, subscription terms and product disclaimers.
            LeaseHawk is an opportunity-intelligence tool and does not guarantee leads, sales, deals or accuracy of third-party data.
            PhantomX is paper trading/market-intelligence only unless separately approved in writing; it is not financial advice.
          </p>

          <label className="flex gap-3 mt-4 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => onAcceptedChange(e.target.checked)}
              className="mt-1"
            />
            <span>
              I accept the{" "}
              <Link href="/legal/terms"><span className="text-amber-300 underline">Terms</span></Link>,{" "}
              <Link href="/legal/privacy"><span className="text-amber-300 underline">Privacy Notice</span></Link>,{" "}
              <Link href="/legal/subscription-terms"><span className="text-amber-300 underline">Subscription Terms</span></Link>{" "}
              and{" "}
              <Link href="/legal/phantomx-risk-disclaimer"><span className="text-amber-300 underline">PhantomX Risk Disclaimer</span></Link>.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
