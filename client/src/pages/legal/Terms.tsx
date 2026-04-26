export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>These Terms apply to use of The Corporate Desk client portal, subscription products, LeaseHawk, Market Map, Office Move Radar, PhantomX paper-trading tools, project dashboards, quotes, procurement workflows and related services.</p>

      <h2>1. No guaranteed outcomes</h2>
      <p>The Corporate Desk provides software, intelligence, project-support tools and commercial workspace services. We do not guarantee that you will obtain sales, leads, project wins, finance approval, supplier availability, investment returns, trading profits or any specific commercial outcome.</p>

      <h2>2. Customer portal is separate from internal admin</h2>
      <p>Client accounts do not provide access to The Corporate Desk internal admin, Nexora command systems, DevStudio, private trading controls, internal data, supplier margin controls or operational tools.</p>

      <h2>3. LeaseHawk and property intelligence</h2>
      <p>LeaseHawk, Office Move Radar, Market Map and related tools rely on available public signals, connected data sources, user-entered records and automated scoring. Data may be incomplete, delayed, inaccurate or require human verification before action.</p>

      <h2>4. Quotes, pricing and procurement</h2>
      <p>Product pricing, shipping, lead times, availability and finance estimates are indicative unless confirmed in a formal written quote or signed agreement. Supplier changes, shipping delays and substitutions may occur.</p>

      <h2>5. PhantomX and trading tools</h2>
      <p>PhantomX tools are provided for paper trading, market observation, education, testing and analytics unless a separate written live-readiness agreement is entered. Nothing in the platform is personal financial advice, a recommendation to trade, or a guarantee of profit.</p>

      <h2>6. Acceptable use</h2>
      <p>You must not misuse the platform, scrape data unlawfully, attempt to access internal admin systems, reverse engineer protected tools, upload unlawful content, or use outreach tools for spam, deception or misleading claims.</p>

      <h2>7. Limitation</h2>
      <p>To the maximum extent permitted by law, The Corporate Desk is not liable for indirect loss, lost profits, lost opportunities, trading losses, data delays, third-party platform outages, supplier failures or decisions made using platform outputs.</p>

      <h2>8. Legal review</h2>
      <p>These terms are a platform draft and should be reviewed by a qualified Australian lawyer before public launch.</p>
    </LegalPage>
  );
}

function LegalPage({ title, children }: any) {
  return (
    <main className="min-h-screen bg-[#080A12] text-white px-6 py-16">
      <article className="max-w-4xl mx-auto prose prose-invert prose-headings:text-white prose-p:text-white/60 prose-a:text-amber-300">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Legal</p>
        <h1>{title}</h1>
        {children}
      </article>
    </main>
  );
}
