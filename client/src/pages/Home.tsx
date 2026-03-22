import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { ArrowRight, CheckCircle2, Star, Phone, Award, Shield, Truck, Users, Monitor, Sparkles, Box, BookOpen, Clock } from "lucide-react";
import { allPosts } from "@/data/blog/index";

function useSEO(title: string, description: string, schema?: object) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", description);
    let og = document.querySelector('meta[property="og:title"]');
    if (!og) { og = document.createElement("meta"); og.setAttribute("property", "og:title"); document.head.appendChild(og); }
    og.setAttribute("content", title);
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) { ogDesc = document.createElement("meta"); ogDesc.setAttribute("property", "og:description"); document.head.appendChild(ogDesc); }
    ogDesc.setAttribute("content", description);
    if (schema) {
      let script = document.querySelector('script[data-schema="tcd"]');
      if (!script) { script = document.createElement("script"); script.setAttribute("type", "application/ld+json"); script.setAttribute("data-schema", "tcd"); document.head.appendChild(script); }
      script.textContent = JSON.stringify(schema);
    }
  }, [title, description]);
}

const productCategories = [
  {
    title: "Executive Desks",
    description: "Command authority with furniture that reflects your status. Our executive desks blend power with precision craftsmanship.",
    image: "/images/category-desks.png",
    href: "/catalog/executive-desks",
  },
  {
    title: "Boardroom Tables",
    description: "Where decisions are made. Premium conference and boardroom tables engineered for corporate gravitas.",
    image: "/images/category-boardroom.png",
    href: "/catalog/boardroom-tables",
  },
  {
    title: "Reception Areas",
    description: "First impressions are everything. Transform your reception into a statement of excellence.",
    image: "/images/category-reception.png",
    href: "/catalog/reception-desks",
  },
  {
    title: "Office Seating",
    description: "Ergonomic excellence meets luxury design. Seating solutions that support performance and impress visitors.",
    image: "/images/category-seating.png",
    href: "/catalog/office-seating",
  },
  {
    title: "Complete Fitouts",
    description: "Turnkey workplace transformations. Coordinated furniture packages for cohesive, stunning office environments.",
    image: "/images/category-fitout.png",
    href: "/workplace-solutions",
  },
];

const stats = [
  { value: "500+", label: "Projects Delivered" },
  { value: "6yr", label: "Manufacturer Warranty" },
  { value: "100%", label: "Australian Owned" },
  { value: "3", label: "Major Cities Served" },
];

const features = [
  {
    icon: Award,
    title: "ISO 9001 & 14001 Certified",
    description: "Our manufacturer adheres to the world's most rigorous quality and environmental management standards.",
  },
  {
    icon: Shield,
    title: "6-Year Manufacturer's Warranty",
    description: "Every piece backed by an industry-leading warranty. We stand behind the quality of every product we deliver.",
  },
  {
    icon: Truck,
    title: "Australia-Wide Delivery",
    description: "Seamless delivery to Brisbane, Sydney, Melbourne, and beyond. Full installation service available.",
  },
  {
    icon: Users,
    title: "End-to-End Project Management",
    description: "From concept to completion, our team manages every detail of your office fitout project.",
  },
];

const testimonials = [
  {
    quote: "The Corporate Desk transformed our entire floor. The quality is exceptional and the coordinated look has completely elevated how clients perceive our brand.",
    author: "David R.",
    role: "Managing Director",
    company: "Brisbane Financial Group",
  },
  {
    quote: "We fitted out three floors of our Sydney office with TCD. The project management was seamless and the furniture quality is genuinely impressive.",
    author: "Sarah K.",
    role: "Head of Facilities",
    company: "Sydney Technology Partners",
  },
  {
    quote: "Finally a furniture supplier that understands premium corporate. Our Melbourne headquarters has never looked better. Our staff love coming to work.",
    author: "Michael T.",
    role: "CEO",
    company: "Melbourne Capital Advisors",
  },
];

export default function Home() {
  useSEO(
    "Premium Commercial Office Furniture | The Corporate Desk Australia",
    "Australia's most exclusive commercial office furniture supplier. ISO 9001 certified, 6-year warranty. Executive desks, boardroom tables, reception fitouts. Projects $30K–$300K+.",
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "name": "The Corporate Desk",
          "url": "https://thecorporatedesk.com.au",
          "logo": "https://thecorporatedesk.com.au/logo.png",
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "1300 977 607",
            "contactType": "sales",
            "areaServed": "AU",
          },
          "sameAs": [
            "https://facebook.com/thecorporatedesk.com.au",
            "https://www.instagram.com/thecorporatedesk.au/",
          ],
        },
        {
          "@type": "LocalBusiness",
          "name": "The Corporate Desk",
          "image": "https://thecorporatedesk.com.au/images/hero-bg.jpg",
          "telephone": "1300 977 607",
          "email": "service@thecorporatedesk.com.au",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "10 Primrose Street",
            "addressLocality": "Bowen Hills",
            "addressRegion": "QLD",
            "postalCode": "4006",
            "addressCountry": "AU",
          },
          "openingHoursSpecification": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "opens": "09:00",
            "closes": "17:00",
          },
        },
      ],
    }
  );

  return (
    <Layout>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/hero-office.png')" }}
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,20%,6%)]/80 via-transparent to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">
          <div className="max-w-3xl">
            <Badge className="mb-5 sm:mb-6 bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)] font-medium tracking-wide">
              Premium Commercial Office Furniture
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-[1.05] mb-5 sm:mb-6">
              Where Ambition<br />
              <span className="gold-text">Meets Design</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/70 leading-relaxed mb-4 max-w-2xl">
              Australia's most exclusive commercial office furniture supplier. We deliver complete workplace transformations for companies that refuse to compromise.
            </p>
            <p className="text-sm sm:text-base text-[hsl(43,78%,65%)] font-medium mb-8 sm:mb-10">
              Serving Brisbane, Sydney &amp; Melbourne — Nationally Available
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Button
                asChild
                size="lg"
                className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold tracking-wide px-8 border-none text-base min-h-[52px] w-full sm:w-auto"
                data-testid="button-hero-layout-plan"
                style={{ touchAction: "manipulation" }}
              >
                <Link href="/ai-office-planner">
                  AI Office Planner
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 text-white bg-white/5 backdrop-blur-sm font-semibold tracking-wide px-8 text-base min-h-[52px] w-full sm:w-auto"
                data-testid="button-hero-quote"
                style={{ touchAction: "manipulation" }}
              >
                <Link href="/request-a-quote">
                  Request a Quote
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] bg-transparent font-semibold tracking-wide px-8 text-base min-h-[52px] w-full sm:w-auto"
                data-testid="button-hero-strategy"
                style={{ touchAction: "manipulation" }}
              >
                <Link href="/strategy-call">
                  Book a Strategy Call
                </Link>
              </Button>
            </div>

            <div className="mt-10 sm:mt-14 flex flex-wrap gap-4 sm:gap-6">
              {["ISO 9001 Certified", "6-Year Warranty", "Australian Owned", "Free Delivery Quote"].map(badge => (
                <div key={badge} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  <span className="text-xs sm:text-sm text-white/60 font-medium">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-0 right-0 flex justify-center">
          <div className="w-px h-16 bg-gradient-to-b from-[rgba(201,168,76,0.5)] to-transparent" />
        </div>
      </section>

      <section className="py-16 bg-[hsl(220,20%,5%)] border-y border-[rgba(201,168,76,0.1)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-serif font-bold gold-text mb-2">{stat.value}</div>
                <div className="text-sm text-white/50 font-medium tracking-wide uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-[hsl(220,20%,4%)] border-b border-[rgba(201,168,76,0.08)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-white/25 text-xs font-semibold tracking-[0.25em] uppercase mb-8">Trusted by leading Australian organisations</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14">
            {[
              "Whitmore & Associates",
              "Crestfield Capital",
              "NovaTech Solutions",
              "Meridian Health Group",
              "Gillard Partners",
              "Horizon Infrastructure",
              "Pacific Housing Trust",
              "QBI Medical",
            ].map((name) => (
              <span
                key={name}
                data-testid={`logo-client-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="text-white/20 hover:text-white/40 transition-colors duration-300 text-sm font-semibold tracking-wide whitespace-nowrap"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              Our Collections
            </Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              Furniture That Commands Respect
            </h2>
            <div className="section-divider mx-auto mb-5" />
            <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
              Every piece in our collection is curated for corporate environments where excellence is the standard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productCategories.slice(0, 3).map((cat) => (
              <Link key={cat.title} href={cat.href}>
                <div
                  className="group relative overflow-hidden rounded-md cursor-pointer hover-elevate"
                  data-testid={`card-category-${cat.title.toLowerCase().replace(/\s+/g, "-")}`}
                  style={{ aspectRatio: "4/3" }}
                >
                  <img
                    src={cat.image}
                    alt={cat.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,6%)]/92 via-[hsl(220,20%,6%)]/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="w-10 h-px bg-[hsl(43,78%,52%)] mb-3" />
                    <h3 className="text-xl font-serif font-bold text-white mb-2">{cat.title}</h3>
                    <p className="text-sm text-white/65 leading-relaxed mb-3 group-card-content">
                      {cat.description}
                    </p>
                    <div className="flex items-center gap-1 text-[hsl(43,78%,65%)] text-sm font-medium">
                      Explore <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {productCategories.slice(3).map((cat) => (
              <Link key={cat.title} href={cat.href}>
                <div
                  className="group relative overflow-hidden rounded-md cursor-pointer hover-elevate"
                  data-testid={`card-category-${cat.title.toLowerCase().replace(/\s+/g, "-")}`}
                  style={{ aspectRatio: "16/7" }}
                >
                  <img
                    src={cat.image}
                    alt={cat.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,6%)]/92 via-[hsl(220,20%,6%)]/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <div className="w-10 h-px bg-[hsl(43,78%,52%)] mb-3" />
                    <h3 className="text-xl md:text-2xl font-serif font-bold text-white mb-2">{cat.title}</h3>
                    <p className="text-sm text-white/65 leading-relaxed">{cat.description}</p>
                    <div className="flex items-center gap-1 mt-4 text-[hsl(43,78%,65%)] text-sm font-medium">
                      Explore <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button asChild variant="outline" size="lg" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] font-semibold px-10" data-testid="button-view-all-products">
              <Link href="/catalog">View All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-[hsl(220,20%,5%)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
                Why The Corporate Desk
              </Badge>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">
                The Standard Others<br />
                <span className="gold-text">Aspire To</span>
              </h2>
              <div className="section-divider mb-8" />
              <p className="text-white/60 leading-relaxed mb-10">
                As an Australian-owned and operated company, we've revolutionized office furniture by making fully coordinated, premium collections accessible to Australian businesses. For the first time, companies can achieve a truly cohesive office environment where every piece — desks, storage, seating — is colour-matched and design-coordinated.
              </p>
              <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none" data-testid="button-about-learn-more">
                <Link href="/about">Learn Our Story <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature) => (
                <div key={feature.title} className="luxury-card p-6 rounded-md hover-elevate" data-testid={`card-feature-${feature.title.toLowerCase().replace(/[\s&]+/g, "-")}`}>
                  <feature.icon className="w-8 h-8 text-[hsl(43,78%,52%)] mb-4" />
                  <h3 className="text-base font-serif font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              Client Stories
            </Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              Trusted by Australia's<br />Leading Businesses
            </h2>
            <div className="section-divider mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="luxury-card p-8 rounded-md flex flex-col" data-testid={`card-testimonial-${i}`}>
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-[hsl(43,78%,52%)] fill-[hsl(43,78%,52%)]" />
                  ))}
                </div>
                <blockquote className="text-white/70 leading-relaxed mb-6 flex-1 italic text-sm">
                  "{t.quote}"
                </blockquote>
                <div className="border-t border-[rgba(201,168,76,0.1)] pt-5">
                  <div className="font-semibold text-white text-sm">{t.author}</div>
                  <div className="text-xs text-white/40 mt-1">{t.role}, {t.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3D Walkthrough showcase */}
      <section className="py-20 sm:py-28 bg-[hsl(220,20%,5%)] border-y border-[rgba(201,168,76,0.08)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: text */}
            <div>
              <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
                AI Office Planner
              </Badge>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4 leading-tight">
                See your future office<br />
                <span className="gold-text">before you commit</span>
              </h2>
              <div className="section-divider mb-6" />
              <p className="text-white/60 leading-relaxed mb-6 text-lg">
                Upload your floor plan and our AI generates a personalised workspace concept — complete with zone layout, furniture plan, cost estimate, and an interactive 3D walkthrough.
              </p>
              <ul className="space-y-3 mb-9">
                {[
                  "Free AI workspace concept in minutes",
                  "Personalised 3D office walkthrough",
                  "Zone-by-zone furniture SKUs & cost estimate",
                  "Full plan unlocks for $399 — one-time",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/65 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none" data-testid="button-home-ai-planner">
                  <Link href="/ai-office-planner"><Sparkles className="w-4 h-4 mr-2" /> Start Free AI Office Planner</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)]" data-testid="button-home-view-demo">
                  <Link href="/3d-office-walkthrough"><Monitor className="w-4 h-4 mr-2" /> View 3D Demo</Link>
                </Button>
              </div>
              <p className="text-white/30 text-xs mt-3">No account required · Free concept · Personalised 3D unlocks after payment</p>
            </div>
            {/* Right: visual preview card */}
            <div className="relative">
              <div className="bg-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.18)] rounded-2xl overflow-hidden shadow-2xl" data-testid="card-3d-preview">
                {/* Mock 3D grid */}
                <div className="relative h-64 bg-[hsl(220,20%,7%)] flex items-center justify-center overflow-hidden">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(3, 1fr)", width: "88%", height: "82%" }}>
                    {[
                      { label: "Open Plan", color: "#5a8fd4", span: "col-span-2 row-span-2" },
                      { label: "Boardroom", color: "#c9a84c", span: "col-span-1 row-span-1" },
                      { label: "Executive", color: "#b87333", span: "col-span-1 row-span-1" },
                      { label: "Breakout", color: "#4abf7a", span: "col-span-1 row-span-1" },
                      { label: "Reception", color: "#bf7a4a", span: "col-span-1 row-span-1" },
                      { label: "Meeting", color: "#8a6abf", span: "col-span-2 row-span-1" },
                    ].map(({ label, color, span }, i) => (
                      <div key={i} className={`${span} rounded-lg flex items-center justify-center opacity-80`} style={{ background: color + "25", border: `1px solid ${color}40` }}>
                        <span className="text-white/50 text-xs font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-3 left-3 bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
                    <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider">SAMPLE LAYOUT</span>
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <Box className="w-6 h-6 text-[hsl(43,78%,52%)] opacity-60" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-semibold text-sm">AI Workspace Concept</p>
                      <p className="text-white/40 text-xs mt-0.5">280 sqm · 20 staff · 6 zones</p>
                    </div>
                    <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] text-xs">DEMO</Badge>
                  </div>
                  <Button asChild className="w-full bg-[rgba(201,168,76,0.12)] hover:bg-[rgba(201,168,76,0.2)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.25)] text-sm font-semibold" data-testid="button-preview-3d-card">
                    <Link href="/3d-office-walkthrough"><Monitor className="w-4 h-4 mr-2" /> View Interactive 3D Demo</Link>
                  </Button>
                </div>
              </div>
              {/* Decorative glow */}
              <div className="absolute -inset-8 bg-[hsl(43,78%,52%)]/4 rounded-3xl blur-3xl -z-10 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Blog Preview ── */}
      <section className="py-20 sm:py-28 bg-[hsl(220,20%,5%)]" data-testid="section-blog-preview">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#b8974a]/70 mb-3">Workplace Intelligence</p>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-white">
                Expert Insights for<br />
                <span className="gold-text">Australian Businesses</span>
              </h2>
            </div>
            <Link href="/blog" data-testid="link-view-all-articles"
              className="hidden sm:flex items-center gap-2 text-sm text-[#b8974a] hover:text-[#c8a75a] transition-colors font-medium">
              View All Articles <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {allPosts.slice(0, 3).map(post => (
              <Link key={post.id} href={`/blog/${post.slug}`} data-testid={`card-blog-${post.id}`}
                className="group flex flex-col rounded-2xl border border-white/8 bg-[hsl(220,20%,7%)] hover:border-[#b8974a]/30 transition-all duration-200 overflow-hidden">
                <div className="p-6 flex flex-col flex-1 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#b8974a]/80 font-medium">{post.category}</span>
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{post.readTime}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-[#b8974a] transition-colors line-clamp-3">
                    {post.title}
                  </h3>
                  <p className="text-xs text-white/45 leading-relaxed line-clamp-3 flex-1">{post.excerpt}</p>
                  <div className="flex items-center gap-1.5 text-[#b8974a] text-xs font-medium">
                    <BookOpen className="w-3.5 h-3.5" />
                    Read Article <ArrowRight className="w-3 h-3 ml-auto group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/blog" data-testid="link-view-all-articles-mobile"
              className="inline-flex items-center gap-2 text-sm text-[#b8974a] font-medium">
              View All Articles <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-28 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/category-fitout.png')" }}
        />
        <div className="absolute inset-0 bg-[hsl(220,20%,6%)]/88" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,20%,6%)]/90 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl">
            <Badge className="mb-5 bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.3)]">
              Start Your Project
            </Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-5">
              Ready to Transform<br />
              <span className="gold-text">Your Workplace?</span>
            </h2>
            <p className="text-white/60 leading-relaxed mb-10 text-lg">
              From concept to installation — we manage every aspect of your office fitout. Projects from $30,000 to $300,000+.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-8" data-testid="button-cta-layout-plan">
                <Link href="/ai-office-planner">AI Office Planner <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white bg-white/5 px-8" data-testid="button-cta-strategy-call">
                <Link href="/strategy-call">Book a Strategy Call</Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <Phone className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              <span className="text-white/60">Or call us now: </span>
              <a href="tel:1300977607" className="text-[hsl(43,78%,65%)] font-semibold hover:text-[hsl(43,78%,75%)] transition-colors">
                1300 977 607
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
