import { useEffect, useState } from "react";
import WalkinshawHero from "../components/walkinshaw/WalkinshawHero";
import WalkinshawForm from "../components/walkinshaw/WalkinshawForm";
import WalkinshawTracker from "../components/walkinshaw/WalkinshawTracker";

export default function WalkinshawLanding() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch("/api/promo/walkinshaw/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok) setMetrics(json.metrics);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
      <WalkinshawHero />
      <WalkinshawTracker metrics={metrics} />

      <section className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <WalkinshawForm />

        <aside className="rounded-3xl border border-neutral-200 bg-white p-6">
          <h3 className="text-xl font-semibold">How entries work</h3>
          <div className="mt-4 space-y-3 text-sm text-neutral-700">
            <p>• Enquiry submitted: 1 entry</p>
            <p>• Qualified project: 5 entries</p>
            <p>• Quote stage: 10 entries</p>
            <p>• Deposit paid: 25 entries</p>
            <p>• Project won: 100 entries</p>
          </div>

          <div className="mt-8 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
            Default launch is Queensland-only until interstate permit and legal requirements are finalised.
          </div>
        </aside>
      </section>
    </main>
  );
}