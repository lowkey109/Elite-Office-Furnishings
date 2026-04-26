import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Upload,
  Calendar,
  Phone,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Eye,
  WalletCards,
  Workflow,
  Globe2,
  Layers3,
  ShieldCheck,
  Monitor,
  Handshake,
  Star,
  DollarSign,
  Clock,
} from "lucide-react";

const platformStrip = [
  {
    icon: DollarSign,
    title: "Cost Control",
    text: "Track project cost movement before overruns become final outcomes.",
  },
  {
    icon: Eye,
    title: "Execution Visibility",
    text: "Make decisions, substitutions and delivery changes visible across stakeholders.",
  },
  {
    icon: BarChart3,
    title: "Finance Alignment",
    text: "Connect delivery decisions to financial impact while projects are live.",
  },
];

const painPoints = [
  "Cost changes happen across builders, suppliers and delivery teams without one clear control layer.",
  "Substitutions, variations and scope movements are often tracked too late.",
  "Finance sees the outcome after the fact, not the live movement during delivery.",
  "Project teams lose time chasing visibility across stakeholders.",
];

const controlCards = [
  {
    icon: BarChart3,
    title: "Cost Visibility",
    text: "Track cost movements, substitutions and supplier changes in real time.",
  },
  {
    icon: Workflow,
    title: "Execution Control",
    text: "Centralise decisions, changes and approvals across stakeholders.",
  },
  {
    icon: WalletCards,
    title: "Finance Alignment",
    text: "Connect live delivery outcomes to financial impact and forecasts.",
  },
];

const outcomeCards = [
  { value: "5–25%", label: "Target reduction in cost overruns" },
  { value: "10–20%", label: "Target improvement in delivery speed" },
  { value: "Live", label: "Cost visibility during execution" },
  { value: "One", label: "Control layer across procurement, suppliers, delivery and finance" },
];

const workspaceCards = [
  { title: "Boardroom & Conference", range: "120–250 sqm", image: "/images/category-boardroom.png" },
  { title: "Executive Suite", range: "80–150 sqm", image: "/images/category-desks.png" },
  { title: "Open Plan Workspace", range: "200–500 sqm", image: "/images/category-fitout.png" },
  { title: "Reception & Entry", range: "40–100 sqm", image: "/images/category-reception.png" },
  { title: "Breakout & Lounge", range: "60–120 sqm", image: "/images/category-seating.png" },
  { title: "Complete Floor Fitout", range: "300–800 sqm", image: "/images/hero-office.png" },
];

const marketCards = [
  {
    title: "Australia",
    subtitle: "High-cost, compliance-heavy delivery",
    points: [
      "Labour and material costs are high",
      "Suppliers are fragmented",
      "Cost visibility often drops during execution",
      "Value is created through control and accountability",
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

const testimonials = [
  {
    quote: "The Corporate Desk transformed our entire floor. The coordinated look has completely elevated how clients perceive our brand.",
    author: "David R.",
    role: "Managing Director, Brisbane Financial Group",
  },
  {
    quote: "We fitted out three floors of our Sydney office with TCD. The project management was seamless and the quality is genuinely impressive.",
    author: "Sarah K.",
    role: "Head of Facilities, Sydney Technology Partners",
  },
  {
    quote: "Finally a supplier that understands premium corporate environments. Our Melbourne headquarters has never looked better.",
    author: "Michael T.",
    role: "CEO, Melbourne Capital Advisors",
  },
];

export default function HomeRecovery() {
  return (
    <Layout>
      {/* HERO — keep old visual language */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[hsl(220,20%,6%)] text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/images/hero-office.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,20%,6%)] via-[hsl(220,20%,6%)]/78 to-[hsl(220,20%,6%)]/18" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,6%)] via-transparent to-[hsl(220,20%,6%)]/35" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2 mb-6">
              {["Facilities Manager", "Finance / CFO", "HR / People", "Office Relocation"].map((item, i) => (
                <span
                  key={item}
                  className={`px-3 py-1.5 rounded border text-xs font-medium ${
                    i === 0
                      ? "bg-[rgba(201,168,76,0.22)] border-[rgba(201,168,76,0.45)] text-[hsl(43,78%,65%)]"
                      : "bg-white/8 border-white/12 text-white/65"
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>

            <Badge className="mb-5 bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">
              AI-Designed Office Fitouts · Australia
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif font-bold leading-[1.04] mb-6">
              We Design, Supply & Install
              <br />
              <span className="gold-text">Your Entire Office — Powered by AI</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/72 leading-relaxed max-w-2xl mb-5">
              Upload your floor plan. Get an AI-generated layout and fitout direction started today.
            </p>

            <p className="text-sm sm:text-base text-[hsl(43,78%,65%)] font-medium mb-8">
              Serving Brisbane, Sydney & Melbourne — Nationally Available
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-8">
              <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] hover:bg-[hsl(43,78%,58%)]">
                <Link href="/free-layout-plan">
                  <Upload className="mr-2 w-4 h-4" /> Get Your Free AI Design
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 text-white hover:bg-white/10">
                <Link href="/strategy-call">
                  <Calendar className="mr-2 w-4 h-4" /> Book a Site Consult
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)]">
                <Link href="/catalog">View Fitout Range</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65">
              {["Single point of contact", "Full install managed", "6-year warranty", "Delivery to 500+ sites"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,65%)]" /> {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM STRIP */}
      <section className="bg-[hsl(220,20%,6%)] text-white border-y border-[rgba(201,168,76,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 rounded-3xl overflow-hidden">
          {platformStrip.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="p-8 md:p-10 border-b md:border-b-0 md:border-r last:border-r-0 border-white/10 bg-white/[0.025]">
                <Icon className="w-9 h-9 text-[hsl(43,78%,55%)] mb-5" />
                <p className="uppercase tracking-[0.32em] text-xs text-[hsl(43,78%,65%)] mb-3">{item.title}</p>
                <p className="text-white/68 leading-relaxed">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* REAL PROBLEM */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-start">
          <div>
            <p className="uppercase tracking-[0.28em] text-xs text-[hsl(43,78%,60%)] mb-5">The Real Problem</p>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold leading-tight mb-6">
              Workspace projects are financially <span className="gold-text">blind during execution.</span>
            </h2>
            <p className="text-lg text-white/65 leading-relaxed max-w-2xl">
              Most overruns do not come from the original plan. They come from decisions, substitutions, supplier movements and cost changes that happen while the project is already moving.
            </p>
          </div>

          <div className="grid gap-4">
            {painPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 flex gap-4">
                <AlertTriangle className="w-5 h-5 text-[hsl(43,78%,65%)] shrink-0 mt-1" />
                <p className="text-white/78 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTROL LAYER */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[0.85fr_1.15fr] gap-14 items-start">
          <div>
            <p className="uppercase tracking-[0.28em] text-xs text-[hsl(43,78%,60%)] mb-5">The Control Layer</p>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold leading-tight mb-6">
              Connect procurement, suppliers, <span className="gold-text">delivery and finance.</span>
            </h2>
            <p className="text-lg text-white/65 leading-relaxed">
              Start with cost tracking and variance control during fitout execution, then expand the control layer once ROI is proven.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {controlCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-6">
                  <Icon className="w-9 h-9 mb-5 text-[hsl(43,78%,55%)]" />
                  <h3 className="text-xl font-serif font-bold mb-3">{card.title}</h3>
                  <p className="text-white/62 leading-relaxed text-sm">{card.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMMERCIAL OUTCOMES */}
      <section className="py-20 bg-[hsl(220,20%,6%)] text-white border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="uppercase tracking-[0.28em] text-xs text-[hsl(43,78%,60%)] mb-5">Commercial Outcomes</p>
          <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-10">
            Not software overhead. <span className="gold-text">Cost control and risk reduction.</span>
          </h2>

          <div className="grid md:grid-cols-4 gap-5">
            {outcomeCards.map((item) => (
              <div key={item.value} className="rounded-2xl border border-white/10 bg-white/[0.045] p-7 text-center">
                <div className="text-4xl font-serif font-bold text-[hsl(43,78%,58%)] mb-3">{item.value}</div>
                <p className="text-white/64 leading-relaxed">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUSTRALIA TO ASIA */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[0.8fr_1.2fr] gap-14 items-start">
          <div>
            <p className="uppercase tracking-[0.28em] text-xs text-[hsl(43,78%,60%)] mb-5">Australia to Asia</p>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold leading-tight mb-6">
              One control layer across different delivery models.
            </h2>
            <p className="text-lg text-white/65 leading-relaxed">
              In Australia, value comes from controlling high-cost delivery. In Asia, value comes from coordination, standardisation and financial discipline across decentralised execution.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {marketCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-7">
                <Globe2 className="w-8 h-8 mb-5 text-[hsl(43,78%,58%)]" />
                <h3 className="text-2xl font-serif font-bold mb-1">{card.title}</h3>
                <p className="text-white/50 mb-5">{card.subtitle}</p>
                <ul className="space-y-3">
                  {card.points.map((point) => (
                    <li key={point} className="flex gap-3 text-white/70">
                      <CheckCircle2 className="w-5 h-5 text-[hsl(43,78%,58%)] shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ENTRY WEDGE */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="uppercase tracking-[0.28em] text-xs text-[hsl(43,78%,60%)] mb-5">Entry Wedge</p>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold leading-tight mb-6">
              Land with <span className="gold-text">one high-impact module.</span>
            </h2>
            <p className="text-lg text-white/65 leading-relaxed mb-8">
              The first wedge is cost tracking and variance control during workspace delivery. Prove the return in one defined use case, then expand into the broader execution platform.
            </p>
            <div className="grid gap-3">
              {["Corporate office expansions", "Multi-site workspace rollouts", "Office relocations", "Fitout execution and supplier coordination"].map((item) => (
                <div key={item} className="flex gap-3 text-white/76">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-[hsl(43,78%,58%)] shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.045] overflow-hidden">
            <div
              className="h-56 bg-cover bg-center"
              style={{ backgroundImage: "url('/images/category-fitout.png')" }}
            />
            <div className="p-8">
              <Layers3 className="w-9 h-9 mb-5 text-[hsl(43,78%,58%)]" />
              <h3 className="text-2xl font-serif font-bold mb-4">Furniture and fitout become supporting layers.</h3>
              <p className="text-white/65 leading-relaxed mb-6">
                Furniture, fitout and delivery remain important, but they are no longer the core positioning. The strategic value is the control layer that improves cost, execution and financial outcomes.
              </p>
              <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] hover:bg-[hsl(43,78%,58%)]">
                <Link href="/strategy-call">Start with Cost Tracking <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* PREMIUM WORKPLACE OUTCOMES */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="uppercase tracking-[0.28em] text-xs text-[hsl(43,78%,60%)] mb-5">Premium Workplace Outcomes</p>
          <div className="grid md:grid-cols-6 gap-5">
            {workspaceCards.map((card) => (
              <Link key={card.title} href="/catalog" className="group rounded-2xl overflow-hidden border border-white/10 bg-white/[0.045]">
                <div
                  className="h-48 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `linear-gradient(to top, rgba(5,7,10,0.94), rgba(5,7,10,0.18)), url('${card.image}')` }}
                />
                <div className="p-5 -mt-24 relative z-10 min-h-[140px] flex flex-col justify-end">
                  <h3 className="font-serif font-bold text-lg leading-tight">{card.title}</h3>
                  <p className="text-[hsl(43,78%,58%)] text-sm mt-1">{card.range}</p>
                  <p className="text-[hsl(43,78%,58%)] text-sm mt-3 flex items-center">Explore <ArrowRight className="ml-2 w-3 h-3" /></p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 bg-[hsl(220,20%,5%)] text-white border-y border-[rgba(201,168,76,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            ["500+", "Projects Delivered"],
            ["$30k–$300k+", "Project Range"],
            ["6-Year", "Manufacturer Warranty"],
            ["Australia-Wide", "Service"],
          ].map(([value, label]) => (
            <div key={value}>
              <div className="text-4xl font-serif font-bold text-[hsl(43,78%,58%)]">{value}</div>
              <p className="uppercase tracking-[0.2em] text-xs text-white/45 mt-2">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LOWER OLD-STYLE SECTIONS */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-8 grid md:grid-cols-2 gap-8">
            <div>
              <Badge className="mb-5 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">AI Office Planner</Badge>
              <h2 className="text-3xl font-serif font-bold mb-5">See your future office before you commit.</h2>
              <ul className="space-y-3 text-white/70 mb-6">
                {["Upload your floor plan", "AI generates personalised layout", "Zone layout, furniture plan and cost estimate", "Interactive 3D walkthrough"].map((item) => (
                  <li key={item} className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[hsl(43,78%,58%)] shrink-0" /> {item}</li>
                ))}
              </ul>
              <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]">
                <Link href="/free-layout-plan">Start Free AI Office Planner <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[hsl(220,20%,4%)] p-5">
              <div className="grid grid-cols-2 gap-3 text-center text-sm text-white/55">
                <div className="col-span-2 rounded-xl bg-blue-500/12 border border-blue-400/20 p-8">Open Plan</div>
                <div className="rounded-xl bg-amber-500/12 border border-amber-400/20 p-6">Boardroom</div>
                <div className="rounded-xl bg-orange-500/12 border border-orange-400/20 p-6">Executive</div>
                <div className="rounded-xl bg-purple-500/12 border border-purple-400/20 p-6">Meeting</div>
                <div className="rounded-xl bg-emerald-500/12 border border-emerald-400/20 p-6">Breakout</div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-white/70">AI workspace concept</span>
                <Monitor className="w-5 h-5 text-[hsl(43,78%,58%)]" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-8">
            <Badge className="mb-5 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">Office Finance</Badge>
            <h2 className="text-3xl font-serif font-bold mb-5">Complete office fitout from $299/week</h2>
            <p className="text-white/65 leading-relaxed mb-6">No large upfront cost. Spread your fitout investment across flexible terms with commercial finance pathways.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                ["$299", "weekly from"],
                ["$30k", "minimum project"],
                ["48hrs", "approval time"],
                ["$300k+", "maximum project"],
              ].map(([value, label]) => (
                <div key={value} className="rounded-2xl border border-white/10 bg-[hsl(220,20%,4%)] p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/38">{label}</p>
                  <p className="text-3xl font-serif font-bold text-[hsl(43,78%,58%)] mt-2">{value}</p>
                </div>
              ))}
            </div>
            <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]">
              <Link href="/finance-your-workspace">Explore Finance Options <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-8">
            <Badge className="mb-5 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">Partner & Referral Program</Badge>
            <Handshake className="w-10 h-10 text-[hsl(43,78%,58%)] mb-5" />
            <h2 className="text-3xl font-serif font-bold mb-5">Earn 7.5% on every project you refer.</h2>
            <p className="text-white/65 leading-relaxed mb-6">For real estate agents, architects, designers and commercial brokers who introduce qualified workspace projects.</p>
            <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]">
              <Link href="/partners">Become a Partner <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-8">
            <Badge className="mb-5 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">Client Stories</Badge>
            <ShieldCheck className="w-10 h-10 text-[hsl(43,78%,58%)] mb-5" />
            <h2 className="text-3xl font-serif font-bold mb-5">Trusted by Australia’s leading businesses.</h2>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} className="w-5 h-5 fill-[hsl(43,78%,58%)] text-[hsl(43,78%,58%)]" />)}
            </div>
            <p className="text-white/65 mb-6">4.9 average rating across client fitout and workspace delivery projects.</p>
            <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/testimonials">View All Reviews <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 bg-[hsl(220,20%,6%)] text-white border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge className="mb-5 bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">Client Stories</Badge>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold">Trusted by Australia’s Leading Businesses</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <div key={item.author} className="rounded-2xl border border-white/10 bg-white/[0.045] p-7">
                <div className="flex gap-1 mb-5">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className="w-4 h-4 fill-[hsl(43,78%,58%)] text-[hsl(43,78%,58%)]" />)}
                </div>
                <p className="text-white/65 italic leading-relaxed mb-6">"{item.quote}"</p>
                <p className="font-semibold">{item.author}</p>
                <p className="text-white/42 text-sm">{item.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
