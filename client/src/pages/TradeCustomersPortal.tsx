import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Building2, CheckCircle2, Package, Truck, FileText,
  Phone, Mail, Shield, Zap, Users, ClipboardList,
} from "lucide-react";

function useSEO(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", description);
  }, [title, description]);
}

const TRADE_BENEFITS = [
  {
    icon: FileText,
    title: "Priority Project Quoting",
    desc: "Submit a project brief and receive a detailed, itemised furniture quote within 24 business hours. Volume pricing available for multi-floor and multi-site projects.",
  },
  {
    icon: Package,
    title: "Dedicated Account Management",
    desc: "A dedicated account manager for ongoing project support, product selection, and procurement coordination across your full project lifecycle.",
  },
  {
    icon: Truck,
    title: "National Delivery & Installation",
    desc: "Fully managed delivery, installation, and assembly across Australia. Site-specific scheduling, lift access coordination, and post-installation reporting.",
  },
  {
    icon: ClipboardList,
    title: "Full Layout & Specification Support",
    desc: "Our team produces compliant furniture specifications, floor plan overlays, and product schedules compatible with your CAD or FF&E documentation.",
  },
  {
    icon: Shield,
    title: "Procurement-Ready Documentation",
    desc: "COA certificates, compliance data sheets, product warranties, and supplier declarations available for every product in your project specification.",
  },
  {
    icon: Zap,
    title: "Rapid Fulfilment Capability",
    desc: "Express stock allocation for urgent tenant occupancy deadlines. We hold significant ex-stock inventory across all core commercial ranges.",
  },
];

const WHO_WE_WORK_WITH = [
  { label: "Fitout Contractors", desc: "Commercial builders and interior fitout companies managing furniture scope across their project portfolio." },
  { label: "Architects & Designers", desc: "Interior architects, workplace designers, and specification consultants sourcing for commercial clients." },
  { label: "Tenant Representatives", desc: "Leasing advisors and occupier specialists coordinating furniture for clients entering new leases." },
  { label: "Property Managers", desc: "Facility managers and asset managers procuring furniture for common areas and tenancy refurbishments." },
  { label: "Corporate Procurement", desc: "In-house procurement teams, workplace managers, and facilities leads at ASX, government, and enterprise organisations." },
  { label: "Project Managers", desc: "Independent and embedded project managers coordinating fit-out programs across multiple trades." },
];

const PROCESS_STEPS = [
  { step: "01", title: "Submit a Project Brief", desc: "Share your floor plan, project type, and furniture requirements via our brief form or direct email." },
  { step: "02", title: "Receive Your Specification", desc: "Our team produces a compliant furniture schedule with product specifications, lead times, and pricing." },
  { step: "03", title: "Approve & Place Your Order", desc: "Confirm your selections, sign off the specification, and we handle the rest — from factory to floor." },
  { step: "04", title: "Delivery & Installation", desc: "Coordinated delivery and installation to your site with post-installation inspection and documentation." },
];

const CAPABILITIES = [
  "Open-plan workstations",
  "Executive and director offices",
  "Boardroom and meeting rooms",
  "Reception and client-facing areas",
  "Breakout and collaborative spaces",
  "Training rooms and lecture environments",
  "Storage and filing solutions",
  "Acoustic pods and phone booths",
  "Height-adjustable workstations",
  "Chair and seating programs",
];

export default function TradeCustomersPortal() {
  useSEO(
    "Trade & Project Procurement | The Corporate Desk",
    "Dedicated procurement service for fitout contractors, architects, designers, and project managers. Priority quoting, full specification support, and national installation."
  );

  return (
    <Layout>
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 bg-[hsl(220,20%,6%)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,168,76,0.06),transparent_60%)]" />
        <div className="max-w-5xl mx-auto relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.05)] text-[hsl(43,78%,65%)] text-xs font-medium tracking-widest uppercase mb-8">
            Trade & Project Procurement
          </div>
          <h1 className="text-4xl md:text-6xl font-light text-white tracking-tight leading-tight mb-6">
            Built for Builders,<br className="hidden md:block" />
            Designers & Project Teams
          </h1>
          <p className="text-lg md:text-xl text-white/50 leading-relaxed max-w-2xl mb-10">
            The Corporate Desk provides dedicated procurement support for commercial fitout contractors, architects, interior designers, and project managers — with priority quoting, full specification documentation, and nationally coordinated delivery and installation.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold px-8 py-4 h-auto rounded-none">
              <Link href="/send-us-your-quote" data-testid="button-trade-get-quote">
                Submit a Project Brief
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5 px-8 py-4 h-auto rounded-none">
              <a href="tel:1300977607" data-testid="button-trade-call">
                <Phone className="mr-2 w-4 h-4" />
                1300 977 607
              </a>
            </Button>
          </div>
          <div className="mt-12 flex flex-wrap gap-8 text-sm text-white/30">
            {["Priority 24hr Quoting", "Specification Ready", "National Installation", "ISO 9001 Certified"].map(item => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who We Work With ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[hsl(220,18%,8%)]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-light text-white mb-3">Who We Work With</h2>
            <p className="text-white/40 max-w-xl">Our trade program is designed for commercial professionals who source, specify, and procure furniture on behalf of their clients.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHO_WE_WORK_WITH.map(({ label, desc }) => (
              <div key={label} className="p-5 border border-white/8 bg-white/[0.02] hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2.5 mb-3">
                  <Users className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  <h3 className="font-medium text-white text-sm">{label}</h3>
                </div>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trade Benefits ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[hsl(220,20%,6%)]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-light text-white mb-3">Trade Program Benefits</h2>
            <p className="text-white/40 max-w-xl">Operational support built for the pace and complexity of commercial project delivery.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TRADE_BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 border border-white/8 bg-white/[0.02]">
                <Icon className="w-5 h-5 text-[hsl(43,78%,52%)] mb-4" />
                <h3 className="font-medium text-white mb-2">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[hsl(220,18%,8%)]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-light text-white mb-3">How It Works</h2>
            <p className="text-white/40">A simple, consistent process designed for project professionals.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {PROCESS_STEPS.map(({ step, title, desc }) => (
              <div key={step} className="relative">
                <div className="text-[hsl(43,78%,52%)]/30 text-4xl font-light mb-4">{step}</div>
                <h3 className="font-medium text-white mb-2 text-sm">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[hsl(220,20%,6%)]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl font-light text-white mb-5">Full Workspace Capability</h2>
              <p className="text-white/40 leading-relaxed mb-8">
                We supply the complete interior furniture scope for commercial fit-outs — from executive office furniture to workstations, meeting rooms, breakout spaces, and reception areas. One supplier. One specification. One point of contact.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CAPABILITIES.map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-white/50 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-6 border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.03)]">
                <h3 className="font-medium text-white mb-2">Submit a Project Brief</h3>
                <p className="text-white/40 text-sm leading-relaxed mb-5">
                  Tell us about your project — floor plan, project type, furniture scope, and key dates. We'll prepare a full specification and pricing proposal within 24 business hours.
                </p>
                <Button asChild className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none w-full" data-testid="button-trade-brief">
                  <Link href="/send-us-your-quote">
                    Start Your Brief
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
              <div className="p-6 border border-white/8">
                <h3 className="font-medium text-white mb-2">Upload a Floor Plan</h3>
                <p className="text-white/40 text-sm leading-relaxed mb-5">
                  Upload your floor plan for AI-assisted furniture layout and product scheduling. Receive a layout plan with recommended products and indicative pricing.
                </p>
                <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5 rounded-none w-full" data-testid="button-trade-floor-plan">
                  <Link href="/upload-your-floor-plan">
                    Upload Floor Plan
                  </Link>
                </Button>
              </div>
              <div className="p-5 border border-white/8 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-white text-sm font-medium mb-1">Speak directly with our team</div>
                    <a href="tel:1300977607" className="text-[hsl(43,78%,65%)] text-sm" data-testid="link-trade-phone">1300 977 607</a>
                    <span className="text-white/30 text-xs ml-3">Mon–Fri 9am–5pm AEST</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-white/30" />
                  <a href="mailto:service@thecorporatedesk.com.au" className="text-white/40 text-xs" data-testid="link-trade-email">service@thecorporatedesk.com.au</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Referral Partner CTA ─────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[hsl(220,18%,8%)] border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
          <div>
            <h3 className="text-xl font-light text-white mb-1">Referring client projects to us?</h3>
            <p className="text-white/40 text-sm">Architects, agents, and consultants earn 7.5% commission on referred workspace projects.</p>
          </div>
          <Button asChild variant="outline" className="border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.05)] rounded-none flex-shrink-0" data-testid="button-trade-partner-cta">
            <Link href="/partners">Become a Referral Partner</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
