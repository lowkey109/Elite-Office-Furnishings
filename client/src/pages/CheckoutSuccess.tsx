import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

export default function CheckoutSuccess() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white flex items-center justify-center p-6">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto" />
        <h1 className="text-3xl font-bold mt-4">Checkout complete</h1>
        <p className="text-white/50 mt-3">
          Your payment was completed. Stripe will update your plan automatically through the webhook once configured.
        </p>
        <Link href="/client/billing">
          <span className="inline-block mt-6 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">
            Go to Billing
          </span>
        </Link>
      </div>
    </main>
  );
}
