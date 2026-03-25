type Metrics = {
  leadTotal: number;
  contractTotal: number;
  grossMarginTotal: number;
  totalEntries: number;
  fundingTarget: number;
  fundingProgressPct: number;
  canAwardPrize: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function WalkinshawTracker({ metrics }: { metrics: Metrics | null }) {
  if (!metrics) return null;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Campaign funding tracker</h2>
          <p className="mt-2 text-sm text-neutral-600">
            The prize should only be awarded once the campaign funding target is achieved.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Progress</div>
          <div className="text-2xl font-semibold">
            {metrics.fundingProgressPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-neutral-900 transition-all"
          style={{ width: `${metrics.fundingProgressPct}%` }}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Qualified revenue" value={money(metrics.contractTotal)} />
        <Card label="Gross margin tracked" value={money(metrics.grossMarginTotal)} />
        <Card label="Total entries" value={String(metrics.totalEntries)} />
        <Card
          label="Prize status"
          value={metrics.canAwardPrize ? "Funded" : "Not yet funded"}
        />
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}