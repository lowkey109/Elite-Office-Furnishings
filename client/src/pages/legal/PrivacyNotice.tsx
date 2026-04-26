export default function PrivacyNotice() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white px-6 py-16">
      <article className="max-w-4xl mx-auto prose prose-invert prose-headings:text-white prose-p:text-white/60">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Legal</p>
        <h1>Privacy Notice</h1>
        <p>The Corporate Desk may collect personal information such as your name, email, phone number, company name, project details, uploaded floor plans/photos, subscription selection, support requests and portal activity.</p>

        <h2>Why we collect information</h2>
        <p>We collect information to provide quotes, client portal access, project support, procurement services, finance-option workflows, LeaseHawk subscriptions, customer support, security, billing and service improvement.</p>

        <h2>Uploads and project data</h2>
        <p>Floor plans, photos, project notes, budgets and procurement requests may contain business-sensitive information. Customers should only upload files they are authorised to share.</p>

        <h2>Use and disclosure</h2>
        <p>We may use customer information to deliver services and may disclose relevant project information to suppliers, finance partners, logistics providers, implementation partners or professional advisers where reasonably required to deliver the requested service.</p>

        <h2>Marketing</h2>
        <p>We may contact business customers about relevant services, reports, upgrades and opportunities. Customers can request not to receive marketing communications.</p>

        <h2>Security</h2>
        <p>Production systems should use database-backed accounts, hashed passwords, tenant checks, Stripe subscription verification and access controls. This local build may include temporary client-auth placeholders that must be hardened before public launch.</p>

        <h2>Access and correction</h2>
        <p>Customers may request access to, or correction of, personal information held by The Corporate Desk.</p>

        <h2>Legal review</h2>
        <p>This privacy notice is a draft and should be reviewed against the Privacy Act 1988, Australian Privacy Principles and your real operating model before launch.</p>
      </article>
    </main>
  );
}
