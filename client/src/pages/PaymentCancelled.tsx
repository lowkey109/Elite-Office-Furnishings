import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export default function PaymentCancelled() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
        <h1 className="text-4xl font-bold">Payment was not completed.</h1>
        <p className="mt-4 text-lg text-slate-300">
          No problem — you can return to your quote, contact us, or request help before making payment.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/quote-builder" className="rounded-full bg-white px-6 py-3 font-semibold text-slate-950">
            Return to quote <ArrowRight className="ml-2 inline h-4 w-4" />
          </Link>
          <Link href="/contact" className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white">
            Contact us
          </Link>
        </div>
      </section>
    </main>
  );
}
