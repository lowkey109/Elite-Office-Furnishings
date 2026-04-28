import { Link } from "wouter";
import { ArrowRight, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

export default function Checkout() {
  const params = new URLSearchParams(window.location.search);
  const quoteNo = params.get("quote") || "Quote / project deposit";
  const amount = Number(params.get("amount") || "0");
  const displayAmount = amount > 0 ? new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount) : "Amount confirmed on your quote";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Secure checkout
            </p>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Confirm your workspace project payment.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              Use this page for quote deposits, planning fees, project deposits, or approved workspace payments.
              Your payment helps us move the project into supplier confirmation, install planning, and delivery scheduling.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Secure payment", "Processed through Stripe."],
                ["Project tracking", "Linked to your quote/project."],
                ["Next steps", "You get a clear confirmation page."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-cyan-300" />
                  <div className="font-semibold">{title}</div>
                  <p className="mt-1 text-sm text-slate-400">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/quote-builder" className="rounded-full bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-100">
                Build / update quote <ArrowRight className="ml-2 inline h-4 w-4" />
              </Link>
              <Link href="/upload-your-floor-plan" className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10">
                Upload floor plan
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-400/15 p-3">
                <CreditCard className="h-6 w-6 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Payment summary</h2>
                <p className="text-sm text-slate-400">The Corporate Desk Pty Ltd</p>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl bg-slate-900/80 p-5">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-4">
                <span className="text-slate-400">Reference</span>
                <span className="text-right font-semibold">{quoteNo}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-4">
                <span className="text-slate-400">Amount</span>
                <span className="text-right text-xl font-bold">{displayAmount}</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-300">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                <span>
                  Final payment links should be generated from the approved quote/admin workflow so the amount,
                  quote reference, and payment metadata stay linked.
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              This public checkout page is ready for conversion. Connect approved quote payment links from the admin quote workflow before taking live project payments here.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
