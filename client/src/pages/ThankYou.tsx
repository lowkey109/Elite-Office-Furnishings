import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { CheckCircle2, Phone, ArrowRight, Mail } from "lucide-react";

const variants = {
  "layout-plan": {
    path: "/thank-you-layout-plan",
    title: "Your Layout Plan Request is Confirmed",
    subtitle: "We're working on your free office layout plan",
    message: "Our workplace specialists will review your space details and begin crafting your personalised office layout plan. You'll receive it within 48–72 business hours.",
    nextSteps: [
      "Our team will review your requirements",
      "A specialist will contact you within 24 hours",
      "Your layout plan will be delivered within 48–72 hours",
      "We'll schedule a call to walk you through the plan",
    ],
    ctas: [
      { label: "View Our Products", href: "/catalog", primary: true },
      { label: "Explore Workplace Solutions", href: "/workplace-solutions", primary: false },
    ],
  },
  "quote": {
    path: "/thank-you-quote",
    title: "Your Quote Request Has Been Received",
    subtitle: "We're preparing your detailed furniture quote",
    message: "Our team will review your project requirements and prepare a comprehensive, transparent quote for you. Expect to hear from us within 24 business hours.",
    nextSteps: [
      "Our estimating team will review your requirements",
      "We'll contact you within 24 hours",
      "A detailed line-item quote will be provided",
      "Multiple product options will be presented",
    ],
    ctas: [
      { label: "View Our Products", href: "/catalog", primary: true },
      { label: "Book a Strategy Call", href: "/strategy-call", primary: false },
    ],
  },
  "strategy": {
    path: "/thank-you-strategy",
    title: "Your Strategy Call is Booked",
    subtitle: "A workplace specialist will be in touch shortly",
    message: "One of our senior workplace consultants will contact you within one business day to confirm your consultation time and send you a pre-call brief.",
    nextSteps: [
      "A consultant will contact you within 24 hours",
      "We'll confirm your preferred time and send a calendar invite",
      "You'll receive a pre-call brief with agenda",
      "Our 30-minute consultation will cover your full project scope",
    ],
    ctas: [
      { label: "Explore Our Products", href: "/catalog", primary: true },
      { label: "View Workplace Solutions", href: "/workplace-solutions", primary: false },
    ],
  },
};

function ThankYouContent({ variant }: { variant: typeof variants[keyof typeof variants] }) {
  return (
    <Layout>
      <section className="min-h-screen flex items-center bg-gradient-to-b from-[hsl(220,20%,5%)] to-background pt-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-20 w-full">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.3)] mb-8" data-testid="icon-success">
              <CheckCircle2 className="w-10 h-10 text-[hsl(43,78%,52%)]" />
            </div>
            <div className="text-sm text-[hsl(43,78%,65%)] font-medium uppercase tracking-widest mb-3">Thank You</div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4 leading-tight">
              {variant.title}
            </h1>
            <p className="text-lg text-[hsl(43,78%,52%)] font-medium mb-6">{variant.subtitle}</p>
            <div className="section-divider mx-auto mb-6" />
            <p className="text-white/60 max-w-xl mx-auto leading-relaxed">
              {variant.message}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="luxury-card p-7 rounded-md" data-testid="card-next-steps">
              <h3 className="text-lg font-serif font-bold text-white mb-5">What Happens Next</h3>
              <div className="space-y-4">
                {variant.nextSteps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-[hsl(43,78%,52%)]">{i + 1}</span>
                    </div>
                    <span className="text-white/60 text-sm leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="luxury-card p-6 rounded-md" data-testid="card-contact-info">
                <h3 className="text-base font-serif font-bold text-white mb-4">Need to Reach Us Sooner?</h3>
                <div className="space-y-4">
                  <a href="tel:1300977607" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center">
                      <Phone className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                    </div>
                    <div>
                      <div className="text-sm text-white/40">Phone</div>
                      <div className="font-semibold text-white group-hover:text-[hsl(43,78%,65%)] transition-colors">1300 977 607</div>
                    </div>
                  </a>
                  <a href="mailto:service@thecorporatedesk.com.au" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center">
                      <Mail className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                    </div>
                    <div>
                      <div className="text-sm text-white/40">Email</div>
                      <div className="text-sm font-medium text-white group-hover:text-[hsl(43,78%,65%)] transition-colors break-all">
                        service@thecorporatedesk.com.au
                      </div>
                    </div>
                  </a>
                </div>
              </div>

              <div className="luxury-card p-5 rounded-md text-center">
                <div className="text-sm text-white/40 mb-1">Response Time</div>
                <div className="text-2xl font-serif font-bold gold-text">Within 24 hrs</div>
                <div className="text-xs text-white/35 mt-1">Mon–Fri, 9am–5pm AEST</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            {variant.ctas.map((cta) => (
              <Button
                key={cta.href}
                asChild
                size="lg"
                className={cta.primary
                  ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-8"
                  : "border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] bg-transparent px-8"
                }
                data-testid={`button-thankyou-cta-${cta.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Link href={cta.href}>
                  {cta.label} <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function ThankYouLayoutPlan() {
  return <ThankYouContent variant={variants["layout-plan"]} />;
}

export function ThankYouQuote() {
  return <ThankYouContent variant={variants["quote"]} />;
}

export function ThankYouStrategy() {
  return <ThankYouContent variant={variants["strategy"]} />;
}
