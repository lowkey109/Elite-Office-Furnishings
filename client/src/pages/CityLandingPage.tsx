import { useEffect } from "react";
import { Link, Redirect } from "wouter";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, CheckCircle2, Building2, Users, MapPin,
  Clock, Star, Phone, FileText, Zap, Package, DollarSign,
} from "lucide-react";

interface CityData {
  city: string;
  state: string;
  slug: string;
  headline: string;
  subheadline: string;
  metaTitle: string;
  metaDescription: string;
  suburbs: string[];
  precincts: { name: string; desc: string }[];
  marketStats: { label: string; value: string }[];
  testimonial: { quote: string; name: string; company: string; suburb: string };
}

const CITIES: Record<string, CityData> = {
  brisbane: {
    city: "Brisbane",
    state: "QLD",
    slug: "office-furniture-brisbane",
    headline: "Premium Office Furniture Brisbane",
    subheadline: "Executive-grade commercial workspaces delivered across Greater Brisbane, the Gold Coast and Sunshine Coast corridors.",
    metaTitle: "Office Furniture Brisbane | Commercial Fitouts & Executive Desks | The Corporate Desk",
    metaDescription: "Premium commercial office furniture in Brisbane. Desks, chairs, workstations & full fitouts for CBD, Fortitude Valley, South Brisbane & Queensland businesses. Free layout plan.",
    suburbs: ["Brisbane CBD", "Fortitude Valley", "South Brisbane", "Bowen Hills", "Newstead", "Milton", "Toowong", "Chermside", "Eight Mile Plains", "Springwood"],
    precincts: [
      { name: "Brisbane CBD & Eagle Street", desc: "High-rise commercial towers demand executive-calibre furniture. We supply Tier-1 towers including 1 William Street, 480 Queen Street and the waterfront precinct." },
      { name: "Fortitude Valley & Newstead", desc: "Tech startups and creative agencies flock here. Collaborative benching, biophilic breakout zones and flexible hot-desking — all supplied and installed." },
      { name: "South Brisbane & West End", desc: "Media, health and government agencies. From heritage office fitouts to modern open-plan, we deliver to the South Bank precinct and beyond." },
      { name: "Inner Suburbs & Business Parks", desc: "Eight Mile Plains, Chermside, Bowen Hills — we service all greater Brisbane business parks with full delivery and installation." },
    ],
    marketStats: [
      { label: "Delivery Radius", value: "200 km" },
      { label: "Projects Completed", value: "180+" },
      { label: "Lead Time", value: "2–4 weeks" },
      { label: "Avg Project Size", value: "$85,000" },
    ],
    testimonial: {
      quote: "Outstanding quality and the team understood our brief from the first call. Our Fortitude Valley office looks like something from a Singapore Tier-1 tower.",
      name: "Marcus T.",
      company: "PropTech startup",
      suburb: "Fortitude Valley, Brisbane",
    },
  },
  sydney: {
    city: "Sydney",
    state: "NSW",
    slug: "office-furniture-sydney",
    headline: "Premium Office Furniture Sydney",
    subheadline: "Billionaire-aesthetic commercial workspaces supplied and installed across the Sydney CBD, North Shore, Parramatta and surrounding precincts.",
    metaTitle: "Office Furniture Sydney | Commercial Fitouts & Executive Desks | The Corporate Desk",
    metaDescription: "Premium commercial office furniture in Sydney. Executive desks, ergonomic chairs & full fitouts for CBD, North Sydney, Parramatta, Chatswood & NSW businesses. Free layout plan.",
    suburbs: ["Sydney CBD", "North Sydney", "Parramatta", "Chatswood", "Macquarie Park", "Rhodes", "St Leonards", "Pyrmont", "Barangaroo", "Olympic Park"],
    precincts: [
      { name: "Sydney CBD & Barangaroo", desc: "Australia's highest-value commercial precinct. We supply executive suites in Martin Place, George Street towers and the Barangaroo International Towers precinct." },
      { name: "North Sydney & St Leonards", desc: "Finance, legal and corporate advisory firms. Our deep stock of executive seating and boardroom furniture services NSW's second CBD." },
      { name: "Parramatta & Western Sydney", desc: "Western Sydney's booming commercial corridor — government, health and professional services. We deliver full fitouts to Parramatta Square and nearby precincts." },
      { name: "Macquarie Park & North Shore", desc: "Technology campuses and pharma HQs. Activity-based working furniture, collaborative benching and executive suites for innovation-led organisations." },
    ],
    marketStats: [
      { label: "Delivery Radius", value: "250 km" },
      { label: "Projects Completed", value: "240+" },
      { label: "Lead Time", value: "2–4 weeks" },
      { label: "Avg Project Size", value: "$110,000" },
    ],
    testimonial: {
      quote: "We fitted out three floors of our Martin Place office in one coordinated delivery. The quality of the executive range is honestly better than anything we found locally.",
      name: "Sophia W.",
      company: "Global investment firm",
      suburb: "Sydney CBD",
    },
  },
  melbourne: {
    city: "Melbourne",
    state: "VIC",
    slug: "office-furniture-melbourne",
    headline: "Premium Office Furniture Melbourne",
    subheadline: "Precision-crafted commercial workspaces for Melbourne's CBD, Docklands, Southbank, St Kilda Road and inner-suburban business precincts.",
    metaTitle: "Office Furniture Melbourne | Commercial Fitouts & Executive Desks | The Corporate Desk",
    metaDescription: "Premium commercial office furniture in Melbourne. Ergonomic workstations, executive desks & full fitouts for CBD, Docklands, Southbank & Victorian businesses. Free layout plan.",
    suburbs: ["Melbourne CBD", "Docklands", "Southbank", "St Kilda Road", "Richmond", "Hawthorn", "South Yarra", "Box Hill", "Dandenong", "Clayton"],
    precincts: [
      { name: "Melbourne CBD & Collins Street", desc: "The Millionaires Walk. We supply boardroom furniture, executive desks and premium visitor seating to Collins Street's most prestigious addresses." },
      { name: "Docklands & Waterfront City", desc: "ANZ, NAB and NAB's technology campus all reside here. Large-format open-plan fitouts, collaborative zones and executive suites — delivered and installed." },
      { name: "Southbank & St Kilda Road", desc: "Legal, consulting and government agencies. Refined, professional aesthetics for Melbourne's southern business strip." },
      { name: "Richmond, Hawthorn & Inner East", desc: "Melbourne's fastest-growing tech precinct. Flexible, design-led workspaces that attract and retain talent in Melbourne's creative economy." },
    ],
    marketStats: [
      { label: "Delivery Radius", value: "200 km" },
      { label: "Projects Completed", value: "210+" },
      { label: "Lead Time", value: "2–4 weeks" },
      { label: "Avg Project Size", value: "$95,000" },
    ],
    testimonial: {
      quote: "The Corporate Desk delivered a complete Collins Street executive suite on time and under budget. Impeccable quality — our clients comment on the furniture at every board meeting.",
      name: "David K.",
      company: "Commercial law firm",
      suburb: "Collins Street, Melbourne",
    },
  },
  canberra: {
    city: "Canberra",
    state: "ACT",
    slug: "office-furniture-canberra",
    headline: "Premium Office Furniture Canberra",
    subheadline: "Government-grade commercial furniture for the ACT's agencies, departments, consultancies and private sector tenants across Civic, Barton and Parkes.",
    metaTitle: "Office Furniture Canberra | Government & Commercial Fitouts | The Corporate Desk",
    metaDescription: "Premium commercial office furniture for Canberra. Government-grade desks, ergonomic workstations & full fitouts for ACT agencies, departments & businesses. Free layout plan.",
    suburbs: ["Canberra CBD / Civic", "Barton", "Parkes", "Forrest", "Fyshwick", "Phillip", "Woden", "Belconnen", "Gungahlin", "Majura Park"],
    precincts: [
      { name: "Canberra CBD & Civic", desc: "The commercial heart of the ACT. We supply consulting firms, financial services and private sector tenants in Canberra's primary office towers." },
      { name: "Barton & Parkes (Parliamentary Triangle)", desc: "High-security government and diplomatic precincts. We understand Commonwealth procurement requirements and deliver compliant, quality-assured fitouts." },
      { name: "Woden & Tuggeranong", desc: "Large Commonwealth departments. Activity-based working systems, standing desks and collaborative furniture for modern APS workplaces." },
      { name: "Belconnen & Gungahlin", desc: "Growing suburban commercial precincts. Defence, technology and services firms choosing quality over price — the Corporate Desk delivers both." },
    ],
    marketStats: [
      { label: "Delivery Radius", value: "150 km" },
      { label: "Projects Completed", value: "90+" },
      { label: "Lead Time", value: "2–4 weeks" },
      { label: "Avg Project Size", value: "$75,000" },
    ],
    testimonial: {
      quote: "We've been unable to find furniture of this quality at this price point from any local Canberra supplier. The Corporate Desk delivered to our government requirements without compromise.",
      name: "Jennifer L.",
      company: "Commonwealth agency",
      suburb: "Barton, ACT",
    },
  },
};

const FEATURES = [
  { icon: Package, title: "Full Commercial Range", desc: "Executive desks, ergonomic chairs, benching systems, boardroom furniture, reception and breakout — everything from a single supplier." },
  { icon: Building2, title: "On-Site Delivery & Install", desc: "Our specialist installation crews handle delivery, assembly and placement. You walk in to a finished workspace." },
  { icon: Zap, title: "2–4 Week Lead Times", desc: "Stock-backed supply chain means fast turnaround for most commercial specifications. No 16-week import delays." },
  { icon: FileText, title: "Formal Quotation in 24 Hours", desc: "Submit your brief online and receive a detailed, line-item quotation with product specs, photos and pricing within one business day." },
  { icon: Users, title: "Dedicated Account Manager", desc: "A single point of contact who knows your project from brief to handover. No call centres, no account juggling." },
  { icon: DollarSign, title: "Finance Available", desc: "Spread the cost with commercial furniture finance. $0 upfront options available for qualifying businesses." },
];

export default function CityLandingPage({ cityKey }: { cityKey: string }) {
  const data = CITIES[cityKey];

  useEffect(() => {
    if (!data) return;
    const BASE = "https://www.thecorporatedesk.au";
    const pageUrl = `${BASE}/${data.slug}`;
    const heroImg = `${BASE}/images/hero-office.png`;

    document.title = data.metaTitle;

    const setMeta = (attrKey: string, attrVal: string, content: string) => {
      let el = document.querySelector(`meta[${attrKey}="${attrVal}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attrKey, attrVal); document.head.appendChild(el); }
      el.content = content;
    };

    setMeta("name", "description", data.metaDescription);
    setMeta("name", "keywords", `office furniture ${data.city}, commercial office fitout ${data.city}, executive desks ${data.city}, office chairs ${data.state}, office fitout ${data.city}`);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", data.metaTitle);
    setMeta("property", "og:description", data.metaDescription);
    setMeta("property", "og:url", pageUrl);
    setMeta("property", "og:image", heroImg);
    setMeta("property", "og:site_name", "The Corporate Desk");
    setMeta("property", "og:locale", "en_AU");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", data.metaTitle);
    setMeta("name", "twitter:description", data.metaDescription);
    setMeta("name", "twitter:image", heroImg);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = pageUrl;

    const localBusinessSchema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": pageUrl,
      name: "The Corporate Desk",
      url: BASE,
      telephone: "+611300977607",
      email: "hello@thecorporatedesk.com.au",
      image: heroImg,
      description: data.metaDescription,
      address: {
        "@type": "PostalAddress",
        addressLocality: data.city,
        addressRegion: data.state,
        addressCountry: "AU",
      },
      areaServed: {
        "@type": "City",
        name: data.city,
        containedInPlace: { "@type": "Country", name: "Australia" },
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: `Office Furniture ${data.city}`,
        itemListElement: [
          { "@type": "Offer", name: "Executive Desks" },
          { "@type": "Offer", name: "Ergonomic Office Chairs" },
          { "@type": "Offer", name: "Boardroom Furniture" },
          { "@type": "Offer", name: "Office Workstations" },
          { "@type": "Offer", name: "Commercial Office Fitouts" },
        ],
      },
      priceRange: "$$$$",
      currenciesAccepted: "AUD",
      paymentAccepted: "Bank Transfer, Finance",
      openingHours: "Mo-Fr 08:00-17:30",
      sameAs: ["https://www.thecorporatedesk.au", "https://www.thecorporatedesk.com.au"],
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE },
        { "@type": "ListItem", position: 2, name: `Office Furniture ${data.city}`, item: pageUrl },
      ],
    };

    const injectSchema = (id: string, schema: object) => {
      document.getElementById(id)?.remove();
      const script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    };
    injectSchema(`city-local-jsonld-${cityKey}`, localBusinessSchema);
    injectSchema(`city-breadcrumb-jsonld-${cityKey}`, breadcrumbSchema);

    window.scrollTo(0, 0);

    return () => {
      document.getElementById(`city-local-jsonld-${cityKey}`)?.remove();
      document.getElementById(`city-breadcrumb-jsonld-${cityKey}`)?.remove();
      canonical?.remove();
    };
  }, [data, cityKey]);

  if (!data) return <Redirect to="/not-found" />;

  return (
    <Layout>
      <div className="min-h-screen bg-background">

        {/* ── Hero ── */}
        <section className="relative pt-28 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,20%,6%)] via-[hsl(220,18%,8%)] to-background" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('/images/hero-office.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
          <div className="relative max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-full px-4 py-2 text-[hsl(43,78%,65%)] text-sm font-medium mb-6">
              <MapPin className="w-3.5 h-3.5" />
              Serving {data.city} & {data.state}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-white leading-tight mb-5">
              {data.headline.split(" ").slice(0, 3).join(" ")}{" "}
              <span className="gold-text">{data.headline.split(" ").slice(3).join(" ")}</span>
            </h1>
            <div className="section-divider mx-auto mb-5" />
            <p className="text-white/55 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
              {data.subheadline}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/quote-builder">
                <button
                  data-testid={`button-cta-estimate-${cityKey}`}
                  className="inline-flex items-center gap-2 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,60%)] text-[hsl(220,20%,6%)] font-bold rounded-xl px-7 py-4 transition-all text-base"
                >
                  <Zap className="w-4 h-4" /> Get My Free Estimate
                </button>
              </Link>
              <a href="tel:1300977607">
                <button
                  data-testid={`button-cta-call-${cityKey}`}
                  className="inline-flex items-center gap-2 border border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.07)] font-semibold rounded-xl px-7 py-4 transition-all text-base"
                >
                  <Phone className="w-4 h-4" /> 1300 977 607
                </button>
              </a>
            </div>

            {/* Market stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 max-w-2xl mx-auto">
              {data.marketStats.map(stat => (
                <div key={stat.label} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                  <p className="text-xl font-serif font-bold text-[hsl(43,78%,65%)]">{stat.value}</p>
                  <p className="text-white/35 text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Suburbs served ── */}
        <section className="py-10 px-4 border-t border-[rgba(255,255,255,0.04)]">
          <div className="max-w-5xl mx-auto">
            <p className="text-white/30 text-xs uppercase tracking-widest text-center mb-4 font-medium">Delivery & Installation Across</p>
            <div className="flex flex-wrap justify-center gap-2">
              {data.suburbs.map(suburb => (
                <Badge
                  key={suburb}
                  data-testid={`badge-suburb-${suburb.replace(/\s+/g, "-").toLowerCase()}`}
                  className="bg-[rgba(255,255,255,0.03)] text-white/50 border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,168,76,0.2)] hover:text-white/70 transition-colors text-xs px-3 py-1.5"
                >
                  {suburb}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* ── Precincts ── */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
                We Know <span className="gold-text">{data.city}'s</span> Office Precincts
              </h2>
              <div className="section-divider mx-auto mb-4" />
              <p className="text-white/45 max-w-xl mx-auto text-base">
                Whether you're in a landmark tower or a boutique commercial suite, we understand the local market and deliver accordingly.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {data.precincts.map((precinct, i) => (
                <div
                  key={precinct.name}
                  data-testid={`card-precinct-${i}`}
                  className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,168,76,0.2)] rounded-2xl p-6 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[rgba(201,168,76,0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-2 leading-snug">{precinct.name}</h3>
                      <p className="text-white/45 text-sm leading-relaxed">{precinct.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features / Why us ── */}
        <section className="py-16 px-4 border-t border-[rgba(255,255,255,0.04)]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
                Why <span className="gold-text">{data.city} Businesses</span> Choose Us
              </h2>
              <div className="section-divider mx-auto mb-4" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  data-testid={`card-feature-${title.replace(/\s+/g, "-").toLowerCase()}`}
                  className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-[rgba(201,168,76,0.1)] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[hsl(43,78%,52%)]" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonial ── */}
        <section className="py-14 px-4">
          <div className="max-w-2xl mx-auto">
            <div
              data-testid={`card-testimonial-${cityKey}`}
              className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-8 text-center"
            >
              <div className="flex justify-center gap-1 mb-5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]" />
                ))}
              </div>
              <blockquote className="text-white text-lg font-serif leading-relaxed mb-6 italic">
                "{data.testimonial.quote}"
              </blockquote>
              <div className="border-t border-[rgba(255,255,255,0.06)] pt-5">
                <p className="text-white font-semibold text-sm">{data.testimonial.name}</p>
                <p className="text-white/40 text-xs mt-1">{data.testimonial.company} · {data.testimonial.suburb}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Product categories ── */}
        <section className="py-14 px-4 border-t border-[rgba(255,255,255,0.04)]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-serif font-bold text-white mb-3">
                Commercial Office Furniture — <span className="gold-text">Full Range</span>
              </h2>
              <div className="section-divider mx-auto" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                "Executive Desks", "Ergonomic Chairs", "Boardroom Tables",
                "Reception Furniture", "Workstations", "Storage & Shelving",
              ].map(cat => (
                <Link key={cat} href="/catalog">
                  <div
                    data-testid={`card-category-${cat.replace(/\s+/g, "-").toLowerCase()}`}
                    className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,168,76,0.25)] rounded-xl p-4 text-center cursor-pointer transition-all group"
                  >
                    <p className="text-white/70 text-xs font-medium group-hover:text-white transition-colors leading-snug">{cat}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-3xl p-8 sm:p-12 text-center">
              <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] rounded-full px-4 py-2 text-[hsl(43,78%,65%)] text-sm font-medium mb-6">
                <Clock className="w-3.5 h-3.5" />
                Formal quote within 24 hours
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
                Ready to Upgrade Your<br /><span className="gold-text">{data.city} Office?</span>
              </h2>
              <p className="text-white/45 text-base mb-8 max-w-xl mx-auto leading-relaxed">
                Get an AI-generated estimate including product recommendations, bill of quantities and investment summary — instantly, free, no obligation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/quote-builder">
                  <button
                    data-testid={`button-cta-estimate-bottom-${cityKey}`}
                    className="inline-flex items-center gap-2 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,60%)] text-[hsl(220,20%,6%)] font-bold rounded-xl px-7 py-4 transition-all"
                  >
                    <Zap className="w-4 h-4" /> Generate My Estimate
                  </button>
                </Link>
                <Link href="/catalog">
                  <button
                    data-testid={`button-cta-catalog-${cityKey}`}
                    className="inline-flex items-center gap-2 border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.07)] font-semibold rounded-xl px-7 py-4 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" /> Browse the Catalogue
                  </button>
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-white/30">
                {["No obligation", "Instant AI estimate", "24-hr formal quote", "Delivery & install included"].map(item => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-[hsl(43,78%,52%)]" />{item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}

export function BrisbanePage() { return <CityLandingPage cityKey="brisbane" />; }
export function SydneyPage() { return <CityLandingPage cityKey="sydney" />; }
export function MelbournePage() { return <CityLandingPage cityKey="melbourne" />; }
export function CanberraPage() { return <CityLandingPage cityKey="canberra" />; }
