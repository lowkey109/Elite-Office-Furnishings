import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { Star, Quote, ArrowRight, Building2, MapPin, CheckCircle2 } from "lucide-react";

type Industry = "All" | "Legal" | "Finance" | "Technology" | "Healthcare" | "Property" | "Government" | "Education";

const FILTERS: Industry[] = ["All", "Legal", "Finance", "Technology", "Healthcare", "Property", "Government", "Education"];

interface Testimonial {
  id: number;
  name: string;
  title: string;
  company: string;
  industry: Industry;
  location: string;
  rating: number;
  quote: string;
  highlight: string;
  projectValue?: string;
  featured?: boolean;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    name: "James Whitmore",
    title: "Managing Partner",
    company: "Whitmore & Associates",
    industry: "Legal",
    location: "Brisbane CBD",
    rating: 5,
    quote: "The Corporate Desk transformed our new offices into something we're genuinely proud to bring clients into. From the first consultation through to final installation, every interaction was professional and the quality exceeded our expectations. The Aimu Series boardroom table alone has become a talking point in client meetings. I cannot recommend them highly enough to any professional services firm seeking to elevate their workspace.",
    highlight: "Every client who visits comments on the quality of our space.",
    projectValue: "$240,000",
    featured: true,
  },
  {
    id: 2,
    name: "Sarah Chen",
    title: "Chief Operating Officer",
    company: "Crestfield Capital",
    industry: "Finance",
    location: "Sydney CBD",
    rating: 5,
    quote: "We'd been in the same office for over a decade and the transformation The Corporate Desk delivered was extraordinary. They understood exactly what a private equity firm needs to project — authority, quality, precision — and they executed it impeccably. The executive chairs alone were worth every cent. Our recruitment numbers have genuinely improved since the fitout.",
    highlight: "Recruitment numbers improved measurably after the fitout.",
    projectValue: "$185,000",
    featured: true,
  },
  {
    id: 3,
    name: "Marcus Webb",
    title: "Head of People & Culture",
    company: "NovaTech Solutions",
    industry: "Technology",
    location: "Melbourne Southbank",
    rating: 5,
    quote: "Staff rated our new environment 4.9 out of 5 in a post-move survey — that says everything. The Corporate Desk helped us design an activity-based workspace that genuinely works for our hybrid team. Six months later, we're still getting compliments from clients who visit. The acoustic pods in particular have been a game-changer for focus work.",
    highlight: "Staff satisfaction score of 4.9/5 post-move.",
    projectValue: "$290,000",
    featured: true,
  },
  {
    id: 4,
    name: "Dr. Priya Nair",
    title: "Practice Director",
    company: "Meridian Health Group",
    industry: "Healthcare",
    location: "Brisbane North",
    rating: 5,
    quote: "Coordinating furniture for three clinic openings simultaneously was a complex brief — and The Corporate Desk handled it with remarkable precision. All three sites opened on the same day, on schedule. Patient feedback has consistently highlighted the calm, professional atmosphere. We've since engaged them for two more clinics, which speaks for itself.",
    highlight: "All three clinics opened on time, on the same day.",
    projectValue: "$165,000",
  },
  {
    id: 5,
    name: "Tom Gillard",
    title: "Partner",
    company: "Gillard Partners Property",
    industry: "Property",
    location: "Gold Coast",
    rating: 5,
    quote: "In commercial property, first impressions determine whether a client signs. Our reception and client meeting rooms needed to reflect the calibre of properties we represent. The Corporate Desk got that immediately. The reception desk they custom-designed is exactly right for our brand — sophisticated, confident, and distinctive.",
    highlight: "Reception design that perfectly reflects our brand positioning.",
  },
  {
    id: 6,
    name: "Claire Nguyen",
    title: "Director of Corporate Services",
    company: "Horizon Infrastructure",
    industry: "Government",
    location: "Canberra",
    rating: 5,
    quote: "Government procurement often means compromise on quality. Working with The Corporate Desk, we managed to achieve a premium outcome within our budget parameters — and they navigated the procurement process with complete professionalism. The ergonomic workstation rollout across our 80-person floor has meaningfully reduced our WorkCover incident rates.",
    highlight: "Significant reduction in WorkCover incidents post-rollout.",
    projectValue: "$210,000",
  },
  {
    id: 7,
    name: "Brendan O'Hara",
    title: "CEO",
    company: "Pinnacle Financial Services",
    industry: "Finance",
    location: "Sydney CBD",
    rating: 5,
    quote: "When we opened our new Sydney office, we needed furniture that would signal to institutional clients that we are a serious operation. The Corporate Desk delivered exactly that. The boardroom is exceptional — I've had senior executives from major banks specifically comment on it. The project was delivered ahead of schedule and within budget.",
    highlight: "Institutional clients consistently comment on the boardroom quality.",
  },
  {
    id: 8,
    name: "Melissa Tang",
    title: "Facilities Manager",
    company: "MedTech Innovations",
    industry: "Technology",
    location: "Brisbane Fortitude Valley",
    rating: 5,
    quote: "Managing a 150-person fitout is extraordinarily complex, and The Corporate Desk made the furniture component feel simple. A dedicated account manager, clear communication at every step, staged delivery that aligned perfectly with our construction programme, and a zero-defect installation. The sit-stand desks for our entire floor have been phenomenally well-received by staff.",
    highlight: "Zero defects on a 150-person installation.",
    projectValue: "$320,000",
  },
  {
    id: 9,
    name: "Professor Alan Bryce",
    title: "Dean of Business",
    company: "Queensland Business Institute",
    industry: "Education",
    location: "Brisbane",
    rating: 5,
    quote: "Our executive education centre needed furniture that would meet the expectations of the senior executives who attend our programs. The Corporate Desk created a learning environment that genuinely rivals the best corporate boardrooms in Brisbane. Participants regularly comment on the quality of the physical environment — which reflects directly on the programme's perceived value.",
    highlight: "Participants compare our facility to tier-1 corporate boardrooms.",
    projectValue: "$145,000",
  },
  {
    id: 10,
    name: "Lisa Drummond",
    title: "Practice Manager",
    company: "Drummond Law Group",
    industry: "Legal",
    location: "Melbourne CBD",
    rating: 5,
    quote: "We approached three suppliers before selecting The Corporate Desk. The difference was immediately apparent: they asked better questions, understood the specific requirements of a legal practice environment — including acoustics, confidentiality, and client perception — and proposed a solution that addressed all of them. The finished result is magnificent.",
    highlight: "They understood legal practice requirements before we explained them.",
  },
  {
    id: 11,
    name: "Andrew Park",
    title: "Co-Founder",
    company: "Vertex Health Analytics",
    industry: "Technology",
    location: "Sydney Surry Hills",
    rating: 5,
    quote: "As a start-up scaling to 40 people, we needed furniture that looked premium without an enterprise budget. The Corporate Desk worked within our constraints and still delivered an office we're proud of every day. The flexible workbench system has scaled with us perfectly — we've since added two additional runs as we've grown, and the integration is seamless.",
    highlight: "The furniture has scaled perfectly as we've grown from 15 to 60 people.",
  },
  {
    id: 12,
    name: "Rachel Forrester",
    title: "National Operations Manager",
    company: "Pacific Housing Trust",
    industry: "Property",
    location: "Melbourne & Sydney",
    rating: 5,
    quote: "A two-city, simultaneous rollout is not a simple brief. The Corporate Desk managed both sites with a single point of contact, consistent communication, and delivery that arrived on the same morning in both cities. The consistency of quality across both fitouts was remarkable. We will not use another supplier for our remaining four state offices.",
    highlight: "Consistent quality across simultaneous Melbourne and Sydney installations.",
    projectValue: "$285,000",
  },
];

const STATS = [
  { value: "500+", label: "Projects Delivered" },
  { value: "98%", label: "Client Satisfaction" },
  { value: "4.9★", label: "Average Rating" },
  { value: "85%", label: "Repeat Business Rate" },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < rating ? "fill-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]" : "fill-white/20 text-white/20"}`}
        />
      ))}
    </div>
  );
}

function FeaturedCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div
      data-testid={`featured-testimonial-${testimonial.id}`}
      className="relative rounded-2xl overflow-hidden border border-[rgba(201,168,76,0.2)] bg-gradient-to-br from-[rgba(201,168,76,0.06)] to-[rgba(201,168,76,0.02)] p-8 lg:p-10 flex flex-col gap-6"
    >
      <div className="absolute top-6 right-8 opacity-10">
        <Quote className="w-16 h-16 text-[hsl(43,78%,52%)]" />
      </div>

      <div className="flex items-start justify-between gap-4">
        <StarRating rating={testimonial.rating} />
        <Badge className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.25)] text-xs shrink-0">
          Featured
        </Badge>
      </div>

      <blockquote className="text-white/80 text-base lg:text-lg leading-relaxed italic relative z-10">
        "{testimonial.quote}"
      </blockquote>

      <div className="border-l-2 border-[hsl(43,78%,52%)] pl-4">
        <p className="text-[hsl(43,78%,65%)] text-sm font-medium">{testimonial.highlight}</p>
      </div>

      <div className="flex items-end justify-between mt-auto pt-4 border-t border-white/10 gap-4 flex-wrap">
        <div>
          <p className="text-white font-semibold" data-testid={`text-name-${testimonial.id}`}>{testimonial.name}</p>
          <p className="text-white/50 text-sm">{testimonial.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
            <span className="text-white/60 text-sm">{testimonial.company}</span>
            <span className="text-white/30">·</span>
            <MapPin className="w-3.5 h-3.5 text-white/40" />
            <span className="text-white/40 text-sm">{testimonial.location}</span>
          </div>
        </div>
        {testimonial.projectValue && (
          <div className="text-right shrink-0">
            <p className="text-[hsl(43,78%,52%)] font-bold text-lg">{testimonial.projectValue}</p>
            <p className="text-white/40 text-xs">Project Value</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div
      data-testid={`testimonial-card-${testimonial.id}`}
      className="rounded-xl border border-white/8 bg-white/[0.03] hover:border-[rgba(201,168,76,0.25)] hover:bg-white/[0.05] transition-all duration-300 p-6 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <StarRating rating={testimonial.rating} />
        <Badge variant="outline" className="border-white/15 text-white/50 text-xs">
          {testimonial.industry}
        </Badge>
      </div>

      <blockquote className="text-white/70 text-sm leading-relaxed italic flex-1">
        "{testimonial.quote}"
      </blockquote>

      <div className="bg-[rgba(201,168,76,0.08)] rounded-lg px-3 py-2 border-l-2 border-[hsl(43,78%,52%)]">
        <p className="text-[hsl(43,78%,65%)] text-xs font-medium flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {testimonial.highlight}
        </p>
      </div>

      <div className="pt-3 border-t border-white/8">
        <p className="text-white font-medium text-sm" data-testid={`text-name-card-${testimonial.id}`}>{testimonial.name}</p>
        <p className="text-white/45 text-xs">{testimonial.title} · {testimonial.company}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <MapPin className="w-3 h-3 text-white/30" />
          <span className="text-white/35 text-xs">{testimonial.location}</span>
        </div>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const [activeFilter, setActiveFilter] = useState<Industry>("All");

  const featured = TESTIMONIALS.filter(t => t.featured);
  const allOthers = TESTIMONIALS.filter(t => !t.featured);
  const filteredOthers = activeFilter === "All"
    ? allOthers
    : allOthers.filter(t => t.industry === activeFilter);
  const filteredFeatured = activeFilter === "All"
    ? featured
    : featured.filter(t => t.industry === activeFilter);

  return (
    <Layout>
      <div className="min-h-screen bg-[hsl(220,20%,6%)]">

        {/* Hero */}
        <section className="relative pt-32 pb-20 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[hsl(43,78%,52%)] opacity-[0.04] blur-[120px] rounded-full" />
          </div>
          <div className="max-w-3xl mx-auto relative z-10">
            <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.25)] rounded-full px-4 py-2 mb-6">
              <Star className="w-4 h-4 fill-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]" />
              <span className="text-[hsl(43,78%,65%)] text-sm font-medium tracking-wide">Client Testimonials</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight mb-6">
              What Our Clients
              <span className="block gold-text">Say About Us</span>
            </h1>
            <p className="text-white/60 text-lg leading-relaxed mb-10">
              Over 500 completed fitouts across Australia. Here is what the organisations we've worked with have to say about the experience and the results.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {STATS.map(stat => (
                <div
                  key={stat.label}
                  data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="bg-white/[0.04] border border-white/10 rounded-xl p-4"
                >
                  <div className="text-2xl font-bold gold-text mb-1">{stat.value}</div>
                  <div className="text-white/50 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Testimonials */}
        {filteredFeatured.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-16">
            <h2 className="text-white/40 text-xs font-semibold tracking-[0.2em] uppercase mb-6">Featured Reviews</h2>
            <div className="grid lg:grid-cols-3 gap-6">
              {filteredFeatured.map(t => (
                <FeaturedCard key={t.id} testimonial={t} />
              ))}
            </div>
          </section>
        )}

        {/* Filter Bar */}
        <section className="max-w-7xl mx-auto px-4 pb-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/40 text-sm mr-2 shrink-0">Filter by industry:</span>
            {FILTERS.map(f => (
              <button
                key={f}
                data-testid={`filter-${f.toLowerCase()}`}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  activeFilter === f
                    ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] border-[hsl(43,78%,52%)]"
                    : "border-white/15 text-white/60 hover:border-white/30 hover:text-white bg-transparent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </section>

        {/* All Testimonials Grid */}
        <section className="max-w-7xl mx-auto px-4 pb-24">
          {filteredOthers.length > 0 ? (
            <>
              <h2 className="text-white/40 text-xs font-semibold tracking-[0.2em] uppercase mb-6">
                {activeFilter === "All" ? "All Client Reviews" : `${activeFilter} Reviews`}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredOthers.map(t => (
                  <TestimonialCard key={t.id} testimonial={t} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-white/40 text-lg">No testimonials in this industry yet.</p>
              <button
                onClick={() => setActiveFilter("All")}
                className="mt-4 text-[hsl(43,78%,65%)] text-sm underline underline-offset-4"
              >
                View all testimonials
              </button>
            </div>
          )}
        </section>

        {/* Trust Badges */}
        <section className="border-t border-white/8 py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-white/40 text-xs font-semibold tracking-[0.2em] uppercase mb-10">Why Clients Trust The Corporate Desk</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: "🏆", title: "500+ Projects", desc: "Delivered across Australia's major commercial markets." },
                { icon: "⚡", title: "On-Time Delivery", desc: "Committed delivery schedules backed by manufacturer partnerships." },
                { icon: "🛡️", title: "Commercial Grade", desc: "Every product carries full commercial warranties and AS/NZS compliance." },
                { icon: "🤝", title: "Full Service", desc: "From design to installation — one point of contact for the entire project." },
              ].map(item => (
                <div
                  key={item.title}
                  data-testid={`trust-badge-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  className="bg-white/[0.03] border border-white/8 rounded-xl p-6 text-center"
                >
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-gradient-to-br from-[rgba(201,168,76,0.1)] to-[rgba(201,168,76,0.03)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-10 lg:p-14">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
                Ready to Become Our Next
                <span className="block gold-text">Success Story?</span>
              </h2>
              <p className="text-white/60 text-lg mb-8">
                Join 500+ Australian businesses that have transformed their workplaces with The Corporate Desk.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/send-us-your-quote">
                  <Button
                    data-testid="button-cta-quote"
                    size="lg"
                    className="w-full sm:w-auto bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold px-8"
                  >
                    Get a Free Quote
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/case-studies">
                  <Button
                    data-testid="button-cta-casestudies"
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-white/25 text-white hover:bg-white/8 px-8"
                  >
                    View Case Studies
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
