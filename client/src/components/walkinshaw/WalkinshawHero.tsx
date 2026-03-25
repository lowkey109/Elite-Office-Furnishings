export default function WalkinshawHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black text-white">
      <div className="grid gap-8 p-8 md:grid-cols-2 md:p-14">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
            Queensland Launch
          </div>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
            Upgrade your workplace. Enter to win a VL Walkinshaw.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/75 md:text-lg">
            A premium commercial workspace campaign from The Corporate Desk.
            Queensland entries only at launch while interstate approvals are reviewed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#enter"
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Enter the campaign
            </a>
            <a
              href="/walkinshaw/terms"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/5"
            >
              View terms
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-white/60">
            Prize
          </div>
          <div className="mt-2 text-3xl font-semibold">$250,000+ VL Walkinshaw</div>
          <div className="mt-6 space-y-3 text-sm text-white/75">
            <p>• Free-entry promotional campaign tied to genuine commercial projects</p>
            <p>• Default launch state: Queensland</p>
            <p>• Revenue-funded release model to avoid underpricing the brand</p>
            <p>• Entries increase as a lead progresses into a real project</p>
          </div>
        </div>
      </div>
    </section>
  );
}