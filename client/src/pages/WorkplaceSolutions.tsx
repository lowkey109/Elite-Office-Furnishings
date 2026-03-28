import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { ArrowRight, CheckCircle2, FileText, Calculator, Phone, Zap } from "lucide-react";
import { useSEO, buildBreadcrumbSchema } from "@/hooks/useSEO";

const solutions = [
  {
    icon: FileText,
    title: "Free Office Layout Plan",
    subtitle: "Space planning & design",
    description: "Upload your floor plan and let our specialists design the optimal furniture layout for your space. Includes product recommendations and space utilisation analysis.",
    cta: "Get Your Free Layout Plan",
    href: "/free-layout-plan",
    features: ["Expert space planning", "Furniture recommendations", "3D visualisation option", "Completely free"],
    testId: "card-solution-layout-plan",
    ctaTestId: "button-solution-layout-plan",
  },
  {
    icon: Calculator,
    title: "Send Us Your Quote",
    subtitle: "Competitive pricing",
    description: "Have specifications or another supplier's quote? Send it to us. We'll match or beat any genuine quote and provide a detailed breakdown of costs.",
    cta: "Submit Your Quote",
    href: "/request-a-quote",
    features: ["Quote matching", "Detailed cost breakdown", "Multiple product options", "Fast 24hr response"],
    testId: "card-solution-quote",
    ctaTestId: "button-solution-quote",
  },
  {
    icon: Phone,
    title: "Workplace Strategy Call",
    subtitle: "Expert consultation",
    description: "Book a 30-minute strategy call with one of our workplace consultants. We'll discuss your vision, timeline, budget, and create a project roadmap.",
    cta: "Book a Strategy Call",
    href: "/strategy-call",
    features: ["One-on-one consultation", "Project roadmap", "Budget planning", "Timeline management"],
    testId: "card-solution-strategy",
    ctaTestId: "button-solution-strategy",
  },
];

const processSteps = [
  { step: "01", title: "Initial Consultation", desc: "Tell us about your space, team size, and vision. We listen and understand your unique requirements." },
  { step: "02", title: "Space Planning & Design", desc: "Our specialists create a detailed furniture layout plan optimised for workflow and aesthetics." },
  { step: "03", title: "Product Selection", desc: "We curate a tailored selection of furniture from our extensive range that fits your design and budget." },
  { step: "04", title: "Quote & Approval", desc: "Receive a comprehensive, transparent quote. No hidden fees. No surprises. Your approval, your timeline." },
  { step: "05", title: "Delivery & Installation", desc: "Professional delivery and installation across Australia. We handle everything so you can focus on your business." },
  { step: "06", title: "After-Sales Support", desc: "Backed by our 6-year warranty and dedicated support team. We're here long after delivery." },
];

export default function WorkplaceSolutions() {
  useSEO({
    title: "Workplace Solutions — Office Fitout & Strategy Services | The Corporate Desk",
    description: "End-to-end commercial office fitout and workplace strategy services. Free space planning, 3D design, custom quotes and complete project management. Serving Australian businesses nationwide.",
    canonical: "/workplace-solutions",
    keywords: "office fitout services Australia, workplace strategy, office space planning, commercial fitout management, office design consultation",
    schema: buildBreadcrumbSchema([{ name: "Home", url: "/" }, { name: "Workplace Solutions", url: "/workplace-solutions" }]),
  });

  return (
    <Layout>
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/category-fitout.png')" }}
        />
        <div className="absolute inset-0 bg-[hsl(220,20%,6%)]/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,20%,6%)]/95 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">
              Workplace Solutions
            </Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight">
              Premium Office Furniture<br />
              <span className="gold-text">&amp; Complete Workplace</span><br />
              <span className="text-white">Fit-Outs</span>
            </h1>
            <p className="text-xl text-white/65 leading-relaxed mb-4">
              Serving Brisbane, Sydney &amp; Melbourne — and businesses nationwide.
            </p>
            <p className="text-base text-[hsl(43,78%,52%)] font-medium mb-10">
              Projects from $30,000 to $300,000+ — delivered turnkey.
            </p>
            <div className="flex flex-wrap gap-3">
              {["End-to-End Project Management", "ISO 9001 Certified", "6-Year Warranty", "Australia-Wide Delivery"].map(item => (
                <div key={item} className="flex items-center gap-2 bg-[rgba(255,255,255,0.07)] backdrop-blur-sm px-4 py-2 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                  <span className="text-xs text-white/80 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 rounded-2xl border border-[rgba(201,168,76,0.35)] bg-gradient-to-br from-[hsl(220,18%,10%)] to-[hsl(220,20%,7%)] p-8 sm:p-10 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-full mb-4">
                <Zap className="w-3 h-3 text-[hsl(43,78%,52%)]" />
                <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase">New — AI-Powered</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-3">
                AI Office Planner — Get Instant Workspace Recommendations
              </h2>
              <p className="text-white/60 leading-relaxed">
                Upload your floor plan and brief. Our AI analyses your space and returns a full workspace zone plan, SKU-matched furniture package, project cost estimate, and implementation timeline — in minutes, before speaking to anyone.
              </p>
            </div>
            <div className="flex-shrink-0 w-full md:w-auto">
              <Button asChild size="lg" className="w-full md:w-auto bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-10 min-h-[56px] text-base whitespace-nowrap" data-testid="button-solutions-ai-planner">
                <Link href="/ai-office-planner">Start AI Office Planner <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            </div>
          </div>

          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              Choose Your Path
            </Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              How Would You Like<br />to Get Started?
            </h2>
            <div className="section-divider mx-auto mb-5" />
            <p className="text-white/50 max-w-xl mx-auto">
              Three ways to begin your workplace transformation. All paths lead to the same exceptional result.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {solutions.map((solution, i) => (
              <div
                key={solution.title}
                className={`relative luxury-card rounded-md p-8 flex flex-col hover-elevate ${i === 1 ? "border-[rgba(201,168,76,0.4)]" : ""}`}
                data-testid={solution.testId}
              >
                {i === 1 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold text-xs">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <solution.icon className="w-10 h-10 text-[hsl(43,78%,52%)] mb-5" />
                <div className="text-xs text-[hsl(43,78%,52%)] font-medium uppercase tracking-widest mb-1">{solution.subtitle}</div>
                <h3 className="text-xl font-serif font-bold text-white mb-3">{solution.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed mb-6 flex-1">{solution.description}</p>
                <ul className="space-y-2 mb-8">
                  {solution.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/65">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className={`w-full font-semibold min-h-[52px] text-base ${i === 1 ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] border-none" : "border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] bg-transparent"}`} data-testid={solution.ctaTestId}>
                  <Link href={solution.href}>
                    {solution.cta} <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 bg-[hsl(220,20%,5%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              Our Process
            </Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              From Concept to<br />
              <span className="gold-text">Completion</span>
            </h2>
            <div className="section-divider mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {processSteps.map((step, i) => (
              <div key={step.step} className="luxury-card p-7 rounded-md hover-elevate" data-testid={`card-process-${step.step}`}>
                <div className="text-5xl font-serif font-bold text-[rgba(201,168,76,0.15)] mb-3 leading-none">{step.step}</div>
                <h3 className="font-serif font-bold text-white text-lg mb-2">{step.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-background border-t border-[rgba(201,168,76,0.1)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-serif font-bold text-white mb-4">
            Speak to a Workplace Specialist
          </h2>
          <p className="text-white/55 mb-8">
            Prefer to talk? Our team is available Monday–Friday, 9am–5pm AEST.
          </p>
          <a
            href="tel:1300977607"
            className="inline-flex items-center gap-3 text-2xl font-serif font-bold text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,75%)] transition-colors"
            data-testid="link-phone-cta"
          >
            <Phone className="w-7 h-7" />
            1300 977 607
          </a>
        </div>
      </section>
    </Layout>
  );
}
