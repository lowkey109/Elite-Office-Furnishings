import { Link } from "wouter";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function PaymentSuccess() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
        <h1 className="mt-6 text-4xl font-bold">Payment received.</h1>
        <p className="mt-4 text-lg text-slate-300">
          Thanks — your payment has been received or is being confirmed. Our team will match it to your quote/project and confirm the next steps.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/thank-you-quote" className="rounded-full bg-white px-6 py-3 font-semibold text-slate-950">
            View next steps <ArrowRight className="ml-2 inline h-4 w-4" />
          </Link>
          <Link href="/" className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white">
            Back to website
          </Link>
        </div>
      </section>
    </main>
  );
}
