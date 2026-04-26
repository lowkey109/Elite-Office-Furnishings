import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BarChart3, ShieldCheck, Workflow, WalletCards } from "lucide-react";

const painPoints = [
  "Cost changes happen across suppliers without one clear control layer",
  "Substitutions and scope movements are often tracked too late",
  "Finance sees the result, not the live movement during delivery",
  "Project teams lose time chasing visibility across stakeholders",
];

const outcomes = [
  { value: "5–25%", label: "Target reduction in cost overruns" },
  { value: "10–20%", label: "Target improvement in delivery speed" },
  { value: "Live", label: "Cost visibility during execution" },
  { value: "One", label: "Control layer across procurement, suppliers, delivery and finance" },
];

export default function HomeSafe() {
  return (
    <Layout>
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[hsl(220,20%,6%)]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('/images/hero-office.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,20%,6%)] via-[hsl(220,20%,6%)]/85 to-[hsl(220,20%,6%)]/30" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-4xl">
            <Badge className="mb-6 bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">
              Execution + Financial Control for Workspace Projects
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif font-bold text-white leading-[1.05] mb-6">
              Control Cost.
              <br />
              <span className="gold-text">Deliver Projects Properly.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/72 leading-relaxed max-w-2xl mb-5">
              The Corporate Desk helps companies control cost, execution and financial outcomes across office fitouts, relocations, expansions and multi-site workspace projects.
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
                <Link href="/strategy-call">
                  Book a Strategy Call
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[hsl(220,20%,6%)] text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <Badge className="mb-4 bg-white/8 text-white/70 border-white/10">
              Where Projects Lose Money
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-5">
              Workspace projects are financially blind during execution.
            </h2>
            <p className="text-white/65 text-lg leading-relaxed">
              Most overruns do not come from the original plan. They come from decisions, substitutions, supplier movements and cost changes that happen while the project is already moving.
            </p>
          </div>

          <div className="grid gap-4">
            {painPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white/78">
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white text-[hsl(220,20%,6%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <Badge className="mb-4 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,36%)] border-[rgba(201,168,76,0.25)]">
              The Control Layer
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-5">
              Connect procurement, suppliers, delivery and finance.
            </h2>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Start with cost tracking and variance control during fitout execution, then expand into wider project control once ROI is proven.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-zinc-200 p-6">
              <BarChart3 className="w-8 h-8 mb-4 text-[hsl(43,78%,42%)]" />
              <h3 className="text-xl font-semibold mb-2">Cost Visibility</h3>
              <p className="text-zinc-600">Track budget movement, substitutions and project variance before the damage is hidden inside the final outcome.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-6">
              <Workflow className="w-8 h-8 mb-4 text-[hsl(43,78%,42%)]" />
              <h3 className="text-xl font-semibold mb-2">Execution Control</h3>
              <p className="text-zinc-600">Create one operating layer across stakeholders so delivery decisions are visible and accountable.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-6">
              <WalletCards className="w-8 h-8 mb-4 text-[hsl(43,78%,42%)]" />
              <h3 className="text-xl font-semibold mb-2">Finance Alignment</h3>
              <p className="text-zinc-600">Align procurement decisions with financial impact while the project is live, not after it is too late.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-5">
          {outcomes.map((item) => (
            <div key={item.value} className="rounded-2xl bg-white border border-zinc-200 p-6">
              <div className="text-3xl font-bold text-[hsl(43,78%,42%)] mb-2">{item.value}</div>
              <p className="text-zinc-600">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-[hsl(220,20%,6%)] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto mb-5 text-[hsl(43,78%,65%)]" />
          <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-5">
            See where cost is being lost before the project finishes.
          </h2>
          <p className="text-white/65 text-lg mb-8">
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
