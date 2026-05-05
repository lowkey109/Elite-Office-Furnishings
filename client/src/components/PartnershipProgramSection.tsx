import { Link } from "wouter";

export default function PartnershipProgramSection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(218,165,32,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.8),transparent_45%)]" />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <p className="uppercase tracking-[0.28em] text-yellow-400 text-sm font-semibold">
              Partnership Program
            </p>
            <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tight">
              Partner with The Corporate Desk
            </h2>
            <p className="mt-5 text-slate-300 text-lg leading-8 max-w-3xl">
              Join our commercial office furniture and fitout partner network. Nexora helps
              source opportunities, prepare proposals, coordinate suppliers, and support
              project delivery while humans approve commitments.
            </p>

            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-2xl font-black text-yellow-300">01</div>
                <div className="mt-2 font-bold">Lead flow</div>
                <p className="mt-1 text-sm text-slate-400">Receive qualified B2B workspace opportunities.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-2xl font-black text-yellow-300">02</div>
                <div className="mt-2 font-bold">Supplier access</div>
                <p className="mt-1 text-sm text-slate-400">Work with curated product and fitout channels.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-2xl font-black text-yellow-300">03</div>
                <div className="mt-2 font-bold">AI support</div>
                <p className="mt-1 text-sm text-slate-400">Use Nexora-assisted quoting and project workflows.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/partners/apply">
                <a className="inline-flex rounded-xl bg-yellow-400 px-6 py-3 font-black text-slate-950 hover:bg-yellow-300 transition">
                  Apply to Partner
                </a>
              </Link>
              <Link href="/partners">
                <a className="inline-flex rounded-xl border border-white/15 px-6 py-3 font-bold text-white hover:bg-white/10 transition">
                  View Partner Program
                </a>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-white/[0.04] p-6 shadow-2xl">
            <div className="rounded-2xl bg-slate-900/90 border border-white/10 p-6">
              <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Partner dashboard preview</div>
              <div className="mt-6 space-y-4">
                {[
                  ["New workspace lead", "Ready for review"],
                  ["Quote pack", "Draft generated"],
                  ["Supplier request", "Awaiting human approval"],
                  ["Project handover", "Checklist ready"],
                ].map(([label, status]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs rounded-full bg-yellow-400/15 text-yellow-300 px-3 py-1">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
