import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Package, Building2, Clock,
  TrendingUp, Phone, Mail, Shield, Users, Truck, FileText,
} from "lucide-react";

function useSEO(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, description]);
}

const SERVICES = [
  {
    icon: Package,
    title: "Full Procurement Management",
    desc: "End-to-end management of your office furniture procurement — from specification and supplier selection through to delivery and installation sign-off.",
  },
  {
    icon: Building2,
    title: "Project Fit-Out Coordination",
    desc: "We coordinate with builders, interior designers, and facilities teams to ensure your furniture schedule integrates seamlessly with your fitout timeline.",
  },
  {
    icon: TrendingUp,
    title: "Supplier Leverage & Volume Pricing",
    desc: "Our established relationships with premium Australian and international suppliers means better pricing, priority lead times, and guaranteed quality at scale.",
  },
  {
    icon: Shield,
    title: "Trade-Only Pricing",
    desc: "Access exclusive trade pricing on the full Corporate Desk range. No inflated retail markups — direct procurement pricing with full manufacturer warranties.",
  },
  {
    icon: Truck,
    title: "Staged Delivery Scheduling",
    desc: "We plan deliveries around your construction milestones. Staged drops, holding facilities, and site-specific logistics managed by our operations team.",
  },
  {
    icon: FileText,
    title: "Full Documentation & Handover",
    desc: "Complete procurement documentation including product schedules, warranties, install guides, and AS-BUILT furniture registers handed over at project completion.",
  },
];

const PROCESS = [
  { step: "01", title: "Project Brief", desc: "Share your fitout brief, floor plan, headcount, and timeline. Our team reviews within 24 hours." },
  { step: "02", title: "Specification & Pricing", desc: "We prepare a full furniture schedule with trade pricing, lead times, and supplier recommendations." },
  { step: "03", title: "Procurement Approval", desc: "You approve the schedule. We place all orders and manage supplier relationships on your behalf." },
  { step: "04", title: "Delivery & Installation", desc: "Staged deliveries coordinated with your site. Installation crew manages placement and sign-off." },
];

export default function TradeProcurement() {
  useSEO(
    "Trade & Project Procurement | The Corporate Desk",
    "End-to-end office furniture procurement for trade clients, project managers, and interior designers. Trade pricing, staged delivery, and full project coordination."
  );

  return (
    <Layout>
      <div className="min-h-screen bg-[hsl(220,20%,6%)]">
        <section className="relative pt-32 pb-20 px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220,20%,8%)] via-[hsl(220,20%,6%)] to-[hsl(220,20%,4%)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[hsl(43,78%,52%)]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.05)] text-[hsl(43,78%,65%)] text-xs font-semibold tracking-widest uppercase mb-8">
              <Users className="w-3.5 h-3.5" /> Trade & Project Procurement
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white mb-6 leading-tight">
              Large-Scale Office<br />
              <span className="gold-text">Procurement, Handled.</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed mb-10">
              Purpose-built for project managers, interior designers, and commercial property teams. We manage the full furniture procurement lifecycle — from specification to installation handover.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold tracking-wide px-8 border-none text-base min-h-[52px]"
                data-testid="button-trade-get-started"
              >
                <Link href="/request-a-quote">
                  Submit Your Project Brief <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 text-white bg-white/5 font-semibold px-8 text-base min-h-[52px]"
                data-testid="button-trade-call"
              >
                <a href="tel:1300977607">
                  <Phone className="w-4 h-4 mr-2" /> 1300 977 607
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8 bg-[hsl(220,20%,5%)] border-y border-[rgba(201,168,76,0.08)]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
                What We Manage For You
              </h2>
              <p className="text-white/50 max-w-xl mx-auto">
                From a 20-person office refresh to a full 500-seat corporate fitout — our procurement team handles complexity at every scale.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SERVICES.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.title}
                    className="bg-[rgba(255,255,255,0.03)] border border-[rgba(201,168,76,0.1)] rounded-2xl p-6 hover:border-[rgba(201,168,76,0.25)] transition-colors"
                    data-testid={`card-service-${s.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[rgba(201,168,76,0.1)] flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-[hsl(43,78%,65%)]" />
                    </div>
                    <h3 className="text-white font-semibold text-base mb-2">{s.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">How It Works</h2>
              <p className="text-white/50">A structured process from brief to handover.</p>
            </div>
            <div className="space-y-6">
              {PROCESS.map((p) => (
                <div key={p.step} className="flex gap-6 items-start" data-testid={`step-${p.step}`}>
                  <div className="flex-shrink-0 w-12 h-12 rounded-full border border-[rgba(201,168,76,0.3)] flex items-center justify-center">
                    <span className="text-[hsl(43,78%,65%)] font-bold text-sm font-mono">{p.step}</span>
                  </div>
                  <div className="pt-2">
                    <h3 className="text-white font-semibold mb-1">{p.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-6 px-6 lg:px-8 bg-[hsl(220,20%,5%)] border-t border-[rgba(201,168,76,0.08)]">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: "500+", label: "Projects Delivered" },
                { value: "$80M+", label: "Procurement Managed" },
                { value: "6yr", label: "Manufacturer Warranty" },
                { value: "ISO", label: "9001 Certified" },
              ].map(stat => (
                <div key={stat.label}>
                  <div className="text-3xl font-serif font-bold gold-text mb-1">{stat.value}</div>
                  <div className="text-xs text-white/40 font-medium uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
              Ready to Start Your Project?
            </h2>
            <p className="text-white/50 mb-8 leading-relaxed">
              Submit your project brief today and our trade procurement team will respond within one business day with a preliminary scope and pricing indication.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button
                asChild
                size="lg"
                className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold tracking-wide px-10 border-none text-base min-h-[52px]"
                data-testid="button-trade-cta-quote"
              >
                <Link href="/request-a-quote">
                  Submit Project Brief <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] font-semibold px-8 text-base min-h-[52px]"
                data-testid="button-trade-cta-strategy"
              >
                <Link href="/strategy-call">
                  Book a Strategy Call
                </Link>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-white/40">
              <a href="tel:1300977607" className="flex items-center gap-1.5 hover:text-[hsl(43,78%,65%)] transition-colors">
                <Phone className="w-3.5 h-3.5" /> 1300 977 607
              </a>
              <a href="mailto:service@thecorporatedesk.com.au" className="flex items-center gap-1.5 hover:text-[hsl(43,78%,65%)] transition-colors">
                <Mail className="w-3.5 h-3.5" /> service@thecorporatedesk.com.au
              </a>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
