import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Workflow,
  WalletCards,
  Building2,
  Globe2,
  CheckCircle2,
  AlertTriangle,
  Layers3,
} from "lucide-react";

const painPoints = [
  "Cost changes happen across builders, suppliers and delivery teams without one clear control layer.",
  "Substitutions, variations and scope movements are often tracked too late.",
  "Finance sees the outcome after the fact, not the live movement during delivery.",
  "Project teams lose time chasing visibility across stakeholders.",
];

const outcomes = [
  {
    value: "5–25%",
    label: "Target reduction in cost overruns",
  },
  {
    value: "10–20%",
    label: "Target improvement in delivery speed",
  },
  {
    value: "Live",
    label: "Cost visibility during execution",
  },
  {
    value: "One",
    label: "Control layer across procurement, suppliers, delivery and finance",
  },
];

const modelCards = [
  {
    title: "Australia",
    subtitle: "High-cost, compliance-heavy delivery",
    points: [
      "Labour and material costs are high",
      "Suppliers are fragmented",
      "Cost visibility often drops during execution",
      "Value is created through control, certainty and accountability",
    ],
  },
  {
    title: "Asia",
    subtitle: "Lower-cost, decentralised execution",
    points: [
      "Execution is often localised",
      "Coordination gaps create rework and leakage",
      "Standards vary across suppliers and regions",
      "Value is created through standardisation and financial discipline",
    ],
  },
];

export default function HomeRecovery() {
  return (
    <Layout>
      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[hsl(220,20%,6%)] text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('/images/hero-office.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,20%,6%)] via-[hsl(220,20%,6%)]/88 to-[hsl(220,20%,6%)]/25" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-4xl">
            <Badge className="mb-6 bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">
              Execution + Financial Control for Workspace Projects
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif font-bold leading-[1.05] mb-6">
              Control Cost.
              <br />
              <span className="gold-text">Deliver Projects Properly.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/72 leading-relaxed max-w-2xl mb-5">
              The Corporate Desk helps companies control cost, supplier coordination, execution visibility and financial outcomes across office fitouts, relocations, expansions and multi-site workspace projects.
            </p>

            <p className="text-sm sm:text-base text-[hsl(43,78%,65%)] font-medium mb-10">
              We don’t replace your systems — we connect and control them.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] hover:bg-[hsl(43,78%,58%)]">
                <Link href="/request-a-quote">
                  Get a Project Quote <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 text-white hover:bg-white/10">
                <Link href="/strategy-call">Book a Strategy Call</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* POSITIONING STRIP */}
      <section className="bg-[hsl(220,20%,6%)] border-t border-white/10 border-b border-white/10 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="py-8 md:pr-8">
            <p className="text-sm uppercase tracking-[0.2em] text-[hsl(43,78%,65%)] mb-2">Cost Control</p>
            <p className="text-white/70">Track project cost movement before overruns become final outcomes.</p>
          </div>
          <div className="py-8 md:px-8">
            <p className="text-sm uppercase tracking-[0.2em] text-[hsl(43,78%,65%)] mb-2">Execution Visibility</p>
            <p className="text-white/70">Make decisions, substitutions and delivery changes visible across stakeholders.</p>
          </div>
          <div className="py-8 md:pl-8">
            <p className="text-sm uppercase tracking-[0.2em] text-[hsl(43,78%,65%)] mb-2">Finance Alignment</p>
            <p className="text-white/70">Connect delivery decisions to financial impact while projects are live.</p>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-start">
          <div>
            <Badge className="mb-5 bg-white/8 text-white/70 border-white/10">
              The Real Problem
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-6">
              Workspace projects are financially blind during execution.
            </h2>
            <p className="text-white/65 text-lg leading-relaxed">
              Most overruns do not come from the original plan. They come from decisions, substitutions, supplier movements and cost changes that happen while the project is already moving.
            </p>
          </div>

          <div className="grid gap-4">
            {painPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white/78 flex gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5 text-[hsl(43,78%,65%)] shrink-0" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="py-24 bg-white text-[hsl(220,20%,6%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <Badge className="mb-5 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,36%)] border-[rgba(201,168,76,0.25)]">
              The Control Layer
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-6">
              Connect procurement, suppliers, delivery and finance.
            </h2>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Start with cost tracking and variance control during fitout execution, then expand into wider project control once ROI is proven.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-200 p-7 bg-white shadow-sm">
              <BarChart3 className="w-9 h-9 mb-5 text-[hsl(43,78%,42%)]" />
              <h3 className="text-xl font-semibold mb-3">Cost Visibility</h3>
              <p className="text-zinc-600 leading-relaxed">
                Track budget movement, substitutions and project variance before the damage is hidden inside the final outcome.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-7 bg-white shadow-sm">
              <Workflow className="w-9 h-9 mb-5 text-[hsl(43,78%,42%)]" />
              <h3 className="text-xl font-semibold mb-3">Execution Control</h3>
              <p className="text-zinc-600 leading-relaxed">
                Create one operating layer across stakeholders so delivery decisions are visible, structured and accountable.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-7 bg-white shadow-sm">
              <WalletCards className="w-9 h-9 mb-5 text-[hsl(43,78%,42%)]" />
              <h3 className="text-xl font-semibold mb-3">Finance Alignment</h3>
              <p className="text-zinc-600 leading-relaxed">
                Align procurement decisions with financial impact while the project is live, not after it is too late.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OUTCOMES */}
      <section className="py-24 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <Badge className="mb-5 bg-zinc-900 text-white border-zinc-900">
              Commercial Outcomes
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-6">
              Not software overhead. Cost control and risk reduction.
            </h2>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Fitouts and workspace rollouts are high-capex decisions. Even a small improvement in cost control, timing and accountability can create a meaningful commercial return.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-5">
            {outcomes.map((item) => (
              <div key={item.value} className="rounded-2xl bg-white border border-zinc-200 p-6 shadow-sm">
                <div className="text-3xl font-bold text-[hsl(43,78%,42%)] mb-2">{item.value}</div>
                <p className="text-zinc-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARKET MODELS */}
      <section className="py-24 bg-white text-[hsl(220,20%,6%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-14 items-start">
            <div>
              <Badge className="mb-5 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,36%)] border-[rgba(201,168,76,0.25)]">
                Australia to Asia
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-6">
                One control layer across different delivery models.
              </h2>
              <p className="text-lg text-zinc-600 leading-relaxed">
                In Australia, value comes from controlling high-cost delivery. In Asia, value comes from coordination, standardisation and financial discipline across decentralised execution.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {modelCards.map((card) => (
                <div key={card.title} className="rounded-2xl border border-zinc-200 p-7 bg-zinc-50">
                  <Globe2 className="w-8 h-8 mb-5 text-[hsl(43,78%,42%)]" />
                  <h3 className="text-2xl font-semibold mb-1">{card.title}</h3>
                  <p className="text-zinc-500 mb-5">{card.subtitle}</p>
                  <ul className="space-y-3">
                    {card.points.map((point) => (
                      <li key={point} className="flex gap-3 text-zinc-700">
                        <CheckCircle2 className="w-5 h-5 mt-0.5 text-[hsl(43,78%,42%)] shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ENTRY WEDGE */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <Badge className="mb-5 bg-white/8 text-white/70 border-white/10">
              Entry Wedge
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-6">
              Land with one high-impact module.
            </h2>
            <p className="text-lg text-white/65 leading-relaxed mb-8">
              The first wedge is cost tracking and variance control during workspace delivery. Prove the return in one defined use case, then expand into the broader execution platform.
            </p>
            <div className="grid gap-3">
              {["Corporate office expansions", "Multi-site workspace rollouts", "Office relocations", "Fitout execution and supplier coordination"].map((item) => (
                <div key={item} className="flex gap-3 text-white/80">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-[hsl(43,78%,65%)] shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <Layers3 className="w-10 h-10 mb-6 text-[hsl(43,78%,65%)]" />
            <h3 className="text-2xl font-semibold mb-4">Furniture and fitout become supporting layers.</h3>
            <p className="text-white/65 leading-relaxed">
              Furniture, fitout and delivery remain important, but they are no longer the core positioning. The strategic value is the control layer that improves cost, execution and financial outcomes.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-white text-[hsl(220,20%,6%)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto mb-5 text-[hsl(43,78%,42%)]" />
          <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-6">
            See where cost is being lost before the project finishes.
          </h2>
          <p className="text-zinc-600 text-lg mb-8">
            Built for corporate expansions, relocations and multi-site rollouts where cost control, delivery certainty and accountability matter.
          </p>
          <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] hover:bg-[hsl(43,78%,58%)]">
            <Link href="/strategy-call">
              Book a 15-minute walkthrough <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
