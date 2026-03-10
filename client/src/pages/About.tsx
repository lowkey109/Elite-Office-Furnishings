import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { ArrowRight, CheckCircle2, Award, Shield, Globe, Zap } from "lucide-react";

const values = [
  {
    icon: Award,
    title: "Innovation",
    description: "We continuously source the latest designs from global manufacturers to bring cutting-edge furniture to Australian businesses.",
  },
  {
    icon: Shield,
    title: "Quality You Can Trust",
    description: "ISO 9001 certified manufacturing with independent quality control inspections before every delivery. Every product comes with a 6-year warranty.",
  },
  {
    icon: Globe,
    title: "Australian & Local",
    description: "Unlike suppliers who appear local but operate overseas, we are proudly based in Brisbane. Speak directly with a local representative.",
  },
  {
    icon: Zap,
    title: "Ethical & Transparent",
    description: "No hidden fees, no misleading warranties. We're upfront about everything — from pricing to delivery timelines.",
  },
];

const milestones = [
  { year: "Founded", detail: "100% Australian-owned and operated from Brisbane, QLD" },
  { year: "ISO 9001", detail: "Our manufacturer achieved ISO 9001 quality management certification" },
  { year: "ISO 14001", detail: "Environmental management certification — because we care about the planet" },
  { year: "National", detail: "Expanded delivery capabilities to serve businesses across Australia" },
  { year: "Today", detail: "Hundreds of completed fitouts across Brisbane, Sydney, Melbourne and beyond" },
];

export default function About() {
  return (
    <Layout>
      <section className="relative pt-36 sm:pt-40 pb-20 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220,20%,6%)] via-[hsl(220,20%,7%)] to-[hsl(220,15%,5%)]" />
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle at 70% 50%, hsl(43,78%,52%), transparent 60%)"
          }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              About The Corporate Desk
            </Badge>
            <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight">
              Revolutionising Office<br />
              <span className="gold-text">Furniture in Australia</span>
            </h1>
            <div className="section-divider mb-8" />
            <p className="text-xl text-white/60 leading-relaxed">
              We're an Australian-owned company on a mission to transform how businesses think about their workspace — bringing world-class design, quality, and coordination to every project.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-[hsl(220,20%,5%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-[rgba(201,168,76,0.05)] rounded-md blur-2xl" />
              <img
                src="/images/hero-office.png"
                alt="Premium office environment by The Corporate Desk"
                className="relative rounded-md w-full object-cover"
                style={{ aspectRatio: "4/3" }}
              />
              <div className="absolute -bottom-6 -right-6 luxury-card p-6 rounded-md w-56">
                <div className="text-3xl font-serif font-bold gold-text">500+</div>
                <div className="text-sm text-white/50 mt-1">Projects successfully delivered across Australia</div>
              </div>
            </div>

            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6">
                Innovation, Quality,<br />and Design
              </h2>
              <div className="section-divider mb-8" />
              <div className="space-y-5 text-white/60 leading-relaxed">
                <p>
                  Welcome to <strong className="text-white">The Corporate Desk</strong>, where we redefine the concept of office furniture in Australia. Our commitment to <strong className="text-white">innovation, quality, and design</strong> has set us apart, providing aesthetically appealing and highly functional office furniture solutions that meet the demands of modern workplaces.
                </p>
                <p>
                  We understand that the contemporary office is more than just a place of work — it's a statement of your company's values and ethos. Our exclusive range brings <strong className="text-white">bold colours, coordinated designs</strong>, and a focus on creating productive workspaces that impress both clients and staff.
                </p>
                <p>
                  For the first time in the Australian market, businesses can access <strong className="text-white">fully matching furniture packages</strong>, where all pieces are colour-coordinated, including workstations. This attention to detail ensures a harmonious and visually appealing workspace.
                </p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {["Executive Desks", "Boardroom Tables", "Ergonomic Seating", "Workstations", "Reception Desks", "Storage & Cabinets"].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    <span className="text-sm text-white/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              Our Principles
            </Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              What Sets Us Apart
            </h2>
            <div className="section-divider mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((value) => (
              <div key={value.title} className="luxury-card p-8 rounded-md hover-elevate" data-testid={`card-value-${value.title.toLowerCase()}`}>
                <value.icon className="w-10 h-10 text-[hsl(43,78%,52%)] mb-5" />
                <h3 className="text-xl font-serif font-bold text-white mb-3">{value.title}</h3>
                <p className="text-white/55 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-[hsl(220,20%,5%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              Our Journey
            </Badge>
            <h2 className="text-4xl font-serif font-bold text-white">Built on a Foundation of Excellence</h2>
          </div>

          <div className="relative max-w-3xl mx-auto">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-[hsl(43,78%,52%)] via-[rgba(201,168,76,0.3)] to-transparent" />
            <div className="space-y-10">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-8 pl-20 relative" data-testid={`milestone-${i}`}>
                  <div className="absolute left-5 top-1.5 w-6 h-6 rounded-full border-2 border-[hsl(43,78%,52%)] bg-[hsl(220,20%,5%)] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[hsl(43,78%,52%)]" />
                  </div>
                  <div className="luxury-card p-5 rounded-md flex-1">
                    <div className="text-sm font-bold text-[hsl(43,78%,65%)] uppercase tracking-wider mb-1">{m.year}</div>
                    <div className="text-white/65 text-sm leading-relaxed">{m.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[hsl(220,20%,5%)] border-t border-[rgba(201,168,76,0.1)]">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-5">
            Ready to Transform Your Office?
          </h2>
          <p className="text-white/55 mb-8 leading-relaxed">
            Whether you're refurbishing an old office or setting up a brand new workplace, our team is ready to help you create something exceptional.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-8" data-testid="button-about-cta-quote">
              <Link href="/workplace-solutions">Get Started <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] px-8" data-testid="button-about-cta-contact">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
