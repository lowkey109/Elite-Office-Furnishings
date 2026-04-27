import { Link } from "wouter";
import { BookOpen, Home, MessageSquare, Radar, ShieldAlert, TrendingUp } from "lucide-react";

export default function ClientHelpCentre() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Help Centre</p>
        <h1 className="text-3xl font-bold mt-2">How to use The Corporate Desk platform</h1>
        <p className="text-white/50 mt-2">
          Start with your project workspace, then use LeaseHawk and PhantomX depending on what you are trying to achieve.
        </p>
      </div>

      <section className="grid lg:grid-cols-3 gap-4">
        <Guide
          icon={<Home />}
          title="Workspace Project Control"
          text="Use this to plan office moves, fitouts, furniture procurement and finance requests."
          href="/client-dashboard"
        />
        <Guide
          icon={<Radar />}
          title="Nexora LeaseHawk"
          text="Use this to view property opportunities, listings, commercial leases and saved enquiries."
          href="/client/property-listings"
        />
        <Guide
          icon={<TrendingUp />}
          title="PhantomX Paper Trader"
          text="Use this free mode to learn strategy behaviour with pretend money. No real trading happens."
          href="/client/phantomx-paper"
        />
        <Guide
          icon={<ShieldAlert />}
          title="Live Readiness"
          text="Apply only if you want a private review later. This does not enable live trading."
          href="/client/phantomx-compliance"
        />
        <Guide
          icon={<MessageSquare />}
          title="Support"
          text="Use support messages for billing, listings, workspace projects or account help."
          href="/contact"
        />
        <Guide
          icon={<BookOpen />}
          title="Subscription"
          text="View available plans, trials and access levels."
          href="/subscriptions"
        />
      </section>
    </main>
  );
}

function Guide({ icon, title, text, href }: any) {
  return (
    <Link href={href}>
      <span className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 cursor-pointer hover:bg-white/[0.06] transition">
        <div className="text-amber-400">{icon}</div>
        <h2 className="text-xl font-semibold mt-4">{title}</h2>
        <p className="text-white/50 text-sm mt-2">{text}</p>
      </span>
    </Link>
  );
}
