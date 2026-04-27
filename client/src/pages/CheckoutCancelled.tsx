import { Link } from "wouter";

export default function CheckoutCancelled() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white flex items-center justify-center p-6">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="text-3xl font-bold">Checkout cancelled</h1>
        <p className="text-white/50 mt-3">No charge was completed. You can return to pricing and choose a plan anytime.</p>
        <Link href="/subscriptions">
          <span className="inline-block mt-6 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">
            View Plans
          </span>
        </Link>
      </div>
    </main>
  );
}
