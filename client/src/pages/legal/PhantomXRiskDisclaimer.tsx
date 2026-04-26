export default function PhantomXRiskDisclaimer() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white px-6 py-16">
      <article className="max-w-4xl mx-auto prose prose-invert prose-headings:text-white prose-p:text-white/60">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Legal</p>
        <h1>PhantomX Trading Risk Disclaimer</h1>

        <h2>Paper trading only by default</h2>
        <p>PhantomX Paper Trader and PhantomX Pro are paper-trading and market-intelligence tools by default. They use pretend balances and simulated trade records unless a separate live-readiness agreement is entered and live execution is explicitly enabled.</p>

        <h2>No financial advice</h2>
        <p>PhantomX does not provide personal financial advice. Outputs are not recommendations to buy, sell, hold, invest or trade. Users should obtain independent licensed financial advice before making financial decisions.</p>

        <h2>No profit guarantee</h2>
        <p>Past simulated performance, strategy scores, paper outcomes or market signals do not guarantee future performance. Real trading may result in loss of capital.</p>

        <h2>Crypto and market risk</h2>
        <p>Crypto assets and leveraged products can be highly volatile and risky. Market prices can move quickly, data can be delayed or unavailable, and exchange/API failures can occur.</p>

        <h2>Live readiness</h2>
        <p>Live-money trading must remain disabled by default. Any live-readiness process must include API-key security, withdrawal restrictions where available, risk limits, daily loss limits, kill switch controls, paper-performance review and written approval.</p>

        <h2>Legal review</h2>
        <p>This disclaimer is a draft and should be reviewed by a qualified Australian lawyer and financial-services compliance adviser before any live-money or investment-related service is offered.</p>
      </article>
    </main>
  );
}
