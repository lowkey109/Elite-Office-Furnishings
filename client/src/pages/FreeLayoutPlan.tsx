import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { LeadForm } from "@/components/LeadForm";
import {
  CheckCircle2, Ruler, Layout as LayoutIcon, Zap, Lock,
  ArrowRight, Calendar, FileText, Building2, Users, Sparkles,
} from "lucide-react";

const FREE_PLAN_KEY = "tcd_free_plan_used";

const fields = [
  { name: "name", label: "Full Name", type: "text" as const, placeholder: "John Smith" },
  { name: "company", label: "Company Name", type: "text" as const, placeholder: "Acme Corporation" },
  { name: "email", label: "Email Address", type: "email" as const, placeholder: "john@company.com.au" },
  { name: "phone", label: "Phone Number", type: "tel" as const, placeholder: "02 XXXX XXXX" },
  {
    name: "officeSize", label: "Office Size (sqm)", type: "select" as const,
    placeholder: "Select office size",
    options: ["Under 100 sqm", "100–200 sqm", "200–500 sqm", "500–1,000 sqm", "1,000+ sqm"],
  },
  {
    name: "staffCount", label: "Number of Staff", type: "select" as const,
    placeholder: "Select staff count",
    options: ["1–10", "11–25", "26–50", "51–100", "100–250", "250+"],
  },
  {
    name: "floorPlan", label: "Upload Floor Plan (Optional)", type: "file" as const,
    placeholder: "Attach your floor plan (PDF, DWG, JPG, PNG)", required: false, half: false,
    accept: ".pdf,.dwg,.jpg,.jpeg,.png",
    hint: "Accepted formats: PDF, DWG, JPG, PNG — max 20MB. You may also email plans to service@thecorporatedesk.com.au",
  },
  {
    name: "message", label: "Tell Us About Your Project", type: "textarea" as const,
    placeholder: "Describe your current office challenges, furniture requirements, preferred style, special requirements...",
    required: false, half: false,
  },
];

const benefits = [
  { icon: Ruler, title: "Space Optimisation", desc: "Maximise every square metre of your office footprint" },
  { icon: LayoutIcon, title: "Expert Design", desc: "Professional furniture layout by our workplace specialists" },
  { icon: Zap, title: "Fast Turnaround", desc: "Layout plan delivered within 48–72 business hours" },
];

const LAYOUTS = [
  {
    id: "luxury-corporate",
    name: "Luxury Corporate",
    tag: "Executive Grade",
    tagColor: "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]",
    description:
      "Structured prestige layout designed for law firms, financial services, and executive-led organisations. Features private executive suites, formal boardrooms, and premium reception zones.",
    zones: [
      { name: "Executive Suites", detail: "Private corner offices with built-in joinery" },
      { name: "Boardroom", detail: "12-person formal meeting room with AV integration" },
      { name: "Reception & Concierge", detail: "Grand entrance with feature wall and hospitality point" },
      { name: "Partner Offices", detail: "Semi-private enclosed workstations for senior staff" },
    ],
    style: ["Walnut & Brushed Brass", "Dark Marble Accents", "Structured & Formal"],
    bestFor: "Law firms · Finance · C-Suite offices",
    lockedItems: [
      "12 SKUs including executive desks, boardroom table, task chairs",
      "Estimated project value: $85,000 – $140,000",
      "3 preferred suppliers with lead times",
      "Downloadable floor plan (PDF + DWG)",
    ],
  },
  {
    id: "modern-open-plan",
    name: "Modern Open Plan",
    tag: "Most Popular",
    tagColor: "bg-[rgba(99,179,237,0.1)] text-blue-300 border-[rgba(99,179,237,0.2)]",
    description:
      "Collaborative, activity-based layout optimised for tech, media, and fast-growing teams. Balances focus workstations with breakout zones, phone booths, and informal collaboration areas.",
    zones: [
      { name: "Collaborative Hub", detail: "Open bench desking with sit-stand options" },
      { name: "Focus Pods", detail: "4 acoustic booths for deep work and calls" },
      { name: "Breakout Lounge", detail: "Casual seating with soft furnishings and café counter" },
      { name: "Hot Desk Zone", detail: "Flexible desking for hybrid/remote workers" },
    ],
    style: ["White & Natural Timber", "Biophilic Accents", "Open & Energised"],
    bestFor: "Tech · Agencies · Scale-ups · Hybrid teams",
    lockedItems: [
      "18 SKUs including sit-stand desks, acoustic pods, lounge seating",
      "Estimated project value: $42,000 – $78,000",
      "2 preferred suppliers with lead times",
      "Downloadable floor plan (PDF + DWG)",
    ],
  },
  {
    id: "high-efficiency",
    name: "High Efficiency",
    tag: "Best Value",
    tagColor: "bg-[rgba(72,187,120,0.1)] text-green-400 border-[rgba(72,187,120,0.2)]",
    description:
      "Density-optimised layout maximising headcount without sacrificing ergonomics or team wellbeing. Ideal for operations centres, call centres, and organisations prioritising output per square metre.",
    zones: [
      { name: "High-Density Workstations", detail: "Ergonomic benching for maximum staff capacity" },
      { name: "Team Meeting Rooms", detail: "3× 6-person meeting rooms with glass partitioning" },
      { name: "Quiet Focus Area", detail: "Low-partition zone for concentrated solo work" },
      { name: "Utility & Storage", detail: "Integrated overhead storage and filing solutions" },
    ],
    style: ["Light Grey & White", "Clean & Minimal", "Functional & Scalable"],
    bestFor: "Operations · BPO · Call centres · Government",
    lockedItems: [
      "22 SKUs including task chairs, bench desks, storage units",
      "Estimated project value: $28,000 – $55,000",
      "4 preferred suppliers with lead times",
      "Downloadable floor plan (PDF + DWG)",
    ],
  },
];

type View = "form" | "plans" | "already-used";

export default function FreeLayoutPlan() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<View>("form");
  const [selectedLayout, setSelectedLayout] = useState<string>("luxury-corporate");

  useEffect(() => {
    if (localStorage.getItem(FREE_PLAN_KEY)) {
      setView("already-used");
    }
  }, []);

  const handleFormSuccess = () => {
    localStorage.setItem(FREE_PLAN_KEY, "true");
    setView("plans");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (view === "already-used") {
    return (
      <Layout>
        <section className="relative pt-36 sm:pt-40 pb-12 sm:pb-16 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              Free Plan Used
            </Badge>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              Your Free Plan<br />
              <span className="gold-text">Has Been Generated</span>
            </h1>
            <div className="section-divider mb-6" />
            <p className="text-white/55 max-w-xl leading-relaxed text-lg">
              Each account receives one complimentary workspace plan. Unlock your full plan or speak with our team to continue.
            </p>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="luxury-card rounded-xl p-10 text-center space-y-8">
              <div className="w-16 h-16 rounded-full bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7 text-[hsl(43,78%,65%)]" />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-bold text-white mb-3">
                  Unlock Your Full Workspace Plan
                </h2>
                <p className="text-white/55 text-base max-w-lg mx-auto leading-relaxed">
                  Your personalised workspace plan — including furniture breakdown, product SKUs, pricing, and downloadable floor plans — is valued at <span className="text-[hsl(43,78%,65%)] font-semibold">$499</span>. Unlock it instantly or receive it free with your furniture order.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                <div className="luxury-card rounded-lg p-5 border border-[rgba(201,168,76,0.2)] text-left space-y-2">
                  <div className="text-[hsl(43,78%,65%)] font-semibold text-sm">Pay to Unlock</div>
                  <div className="text-white text-2xl font-serif font-bold">$499</div>
                  <div className="text-white/45 text-xs">Instant access to full plan details</div>
                </div>
                <div className="luxury-card rounded-lg p-5 border border-[rgba(99,179,237,0.2)] text-left space-y-2">
                  <div className="text-blue-300 font-semibold text-sm">Free with Purchase</div>
                  <div className="text-white text-2xl font-serif font-bold">$0</div>
                  <div className="text-white/45 text-xs">Purchase furniture and receive full plan free</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  data-testid="button-unlock-full-plan"
                  className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,5%)] font-semibold px-8 py-3 h-auto"
                  onClick={() => setLocation("/upload-your-floor-plan")}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Unlock Full Plan
                </Button>
                <Button
                  data-testid="button-get-quote"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5 px-8 py-3 h-auto"
                  onClick={() => setLocation("/send-us-your-quote")}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Get Quote
                </Button>
                <Button
                  data-testid="button-book-consultation"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5 px-8 py-3 h-auto"
                  onClick={() => window.open("https://calendly.com/thecorporatedesk", "_blank")}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Consultation
                </Button>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  if (view === "plans") {
    const active = LAYOUTS.find((l) => l.id === selectedLayout) ?? LAYOUTS[0];
    return (
      <Layout>
        <section className="relative pt-36 sm:pt-40 pb-12 sm:pb-16 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Badge className="mb-5 bg-[rgba(72,187,120,0.1)] text-green-400 border-[rgba(72,187,120,0.2)]">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Your Free Plan Is Ready
            </Badge>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
              3 Layout Options<br />
              <span className="gold-text">Designed For You</span>
            </h1>
            <div className="section-divider mb-6" />
            <p className="text-white/55 max-w-xl leading-relaxed text-lg">
              We've generated three professional workspace concepts below. Unlock the full plan to access furniture lists, SKUs, pricing, and downloadable floor plans.
            </p>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

            <div className="grid sm:grid-cols-3 gap-4">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  data-testid={`tab-layout-${layout.id}`}
                  onClick={() => setSelectedLayout(layout.id)}
                  className={`luxury-card rounded-lg p-5 text-left transition-all border-2 ${
                    selectedLayout === layout.id
                      ? "border-[hsl(43,78%,52%)]"
                      : "border-transparent hover:border-white/15"
                  }`}
                >
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border mb-3 ${layout.tagColor}`}>
                    <Sparkles className="w-3 h-3" />
                    {layout.tag}
                  </span>
                  <div className="font-serif font-bold text-white text-base">{layout.name}</div>
                  <div className="text-white/40 text-xs mt-1">{layout.bestFor}</div>
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <div className="luxury-card rounded-xl p-8">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-serif font-bold text-white">{active.name}</h2>
                      <div className="text-white/45 text-sm mt-1">{active.bestFor}</div>
                    </div>
                    <span className={`inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-full border ${active.tagColor}`}>
                      {active.tag}
                    </span>
                  </div>
                  <p className="text-white/60 leading-relaxed mb-6">{active.description}</p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {active.style.map((s) => (
                      <span key={s} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/55">
                        {s}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-3">Key Zones Included</h3>
                  <div className="space-y-3">
                    {active.zones.map((zone) => (
                      <div key={zone.name} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-white text-sm font-medium">{zone.name}</div>
                          <div className="text-white/45 text-xs mt-0.5">{zone.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="luxury-card rounded-xl p-6 border border-[rgba(201,168,76,0.2)]">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-4 h-4 text-[hsl(43,78%,65%)]" />
                    <span className="text-[hsl(43,78%,65%)] font-semibold text-sm">Full Plan — Locked</span>
                    <span className="ml-auto text-xs text-white/35 line-through">$499 value</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    {active.lockedItems.map((item) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Lock className="w-2.5 h-2.5 text-white/30" />
                        </div>
                        <span className="text-white/35 text-sm blur-[2px] select-none">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    <Button
                      data-testid="button-unlock-full-plan"
                      className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,5%)] font-semibold h-11"
                      onClick={() => setLocation("/upload-your-floor-plan")}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Unlock Full Plan
                    </Button>
                    <Button
                      data-testid="button-get-quote"
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/5 h-11"
                      onClick={() => setLocation("/send-us-your-quote")}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Get Quote
                    </Button>
                    <Button
                      data-testid="button-book-consultation"
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/5 h-11"
                      onClick={() => window.open("https://calendly.com/thecorporatedesk", "_blank")}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Consultation
                    </Button>
                  </div>
                </div>

                <div className="luxury-card rounded-xl p-5">
                  <div className="text-sm font-semibold text-white mb-3">What's Locked Inside</div>
                  {[
                    { icon: FileText, text: "Full furniture breakdown per zone" },
                    { icon: Building2, text: "Product SKUs & supplier details" },
                    { icon: ArrowRight, text: "Itemised pricing & project estimate" },
                    { icon: Users, text: "Downloadable PDF & DWG floor plan" },
                  ].map((row) => (
                    <div key={row.text} className="flex items-center gap-2.5 py-2 border-b border-white/[0.05] last:border-0">
                      <row.icon className="w-4 h-4 text-white/25 flex-shrink-0" />
                      <span className="text-white/40 text-sm">{row.text}</span>
                    </div>
                  ))}
                </div>

                <div className="luxury-card rounded-xl p-5 text-center">
                  <div className="text-xs text-white/35 mb-1">Free with furniture purchase</div>
                  <div className="text-[hsl(43,78%,65%)] text-sm font-medium">
                    Order your furniture and receive the full plan at no cost.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="relative pt-36 sm:pt-40 pb-12 sm:pb-16 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
            Complimentary Service
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-4">
            Free Office<br />
            <span className="gold-text">Layout Plan</span>
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-white/55 max-w-xl leading-relaxed text-lg">
            Tell us about your space and we'll generate 3 tailored layout concepts — completely free of charge.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-serif font-bold text-white mb-4">What You'll Receive</h2>
                <div className="space-y-4">
                  {[
                    "3 professional layout concepts",
                    "Luxury Corporate, Modern Open Plan & High Efficiency options",
                    "Zone-by-zone space planning",
                    "Style & colour palette recommendations",
                    "Preview of furniture categories per zone",
                    "Complimentary — no obligation",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                      <span className="text-white/65 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {benefits.map((b) => (
                  <div
                    key={b.title}
                    className="luxury-card p-5 rounded-md flex gap-4 items-start"
                    data-testid={`card-benefit-${b.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <b.icon className="w-8 h-8 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-white text-sm">{b.title}</div>
                      <div className="text-white/50 text-xs mt-1">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="luxury-card p-6 rounded-md">
                <div className="text-sm text-[hsl(43,78%,65%)] font-medium mb-2">Layouts Generated</div>
                <div className="text-3xl font-serif font-bold text-white">3 Options</div>
                <div className="text-white/45 text-sm mt-1">Luxury Corporate · Modern Open · High Efficiency</div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="luxury-card p-8 rounded-md">
                <h2 className="text-xl font-serif font-bold text-white mb-2">Generate Your Free Layout Plan</h2>
                <p className="text-white/45 text-sm mb-8">
                  Fill in the form — we'll instantly generate 3 workspace layout concepts for your space.
                </p>
                <LeadForm
                  formType="layout-plan"
                  fields={fields}
                  onSuccess={handleFormSuccess}
                  submitLabel="Generate My 3 Free Layout Plans"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
