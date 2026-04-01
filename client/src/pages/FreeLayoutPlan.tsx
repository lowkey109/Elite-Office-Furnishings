import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { LeadForm } from "@/components/LeadForm";
import {
  CheckCircle2, Ruler, Layout as LayoutIcon, Zap, Lock,
  ArrowRight, Calendar, FileText, Building2, Users, Sparkles,
  TrendingUp, BarChart2, AlertTriangle,
} from "lucide-react";

// ─── Space Intelligence Calculator ───────────────────────────────────────────
const SQM_RANGES: Record<string, { min: number; max: number; label: string }> = {
  "Under 100 sqm": { min: 40, max: 100, label: "40–100 sqm" },
  "100–200 sqm": { min: 100, max: 200, label: "100–200 sqm" },
  "200–500 sqm": { min: 200, max: 500, label: "200–500 sqm" },
  "500–1,000 sqm": { min: 500, max: 1000, label: "500–1,000 sqm" },
  "1,000+ sqm": { min: 1000, max: 2000, label: "1,000+ sqm" },
};
const STAFF_RANGES: Record<string, { min: number; max: number }> = {
  "1–10": { min: 1, max: 10 },
  "11–25": { min: 11, max: 25 },
  "26–50": { min: 26, max: 50 },
  "51–100": { min: 51, max: 100 },
  "100–250": { min: 100, max: 250 },
  "250+": { min: 250, max: 400 },
};

function SpaceIntelligenceWidget({
  officeSize,
  staffCount,
}: {
  officeSize: string;
  staffCount: string;
}) {
  const insight = useMemo(() => {
    const sqmRange = SQM_RANGES[officeSize];
    const staffRange = STAFF_RANGES[staffCount];
    if (!sqmRange || !staffRange) return null;

    const avgSqm = (sqmRange.min + sqmRange.max) / 2;
    const avgStaff = (staffRange.min + staffRange.max) / 2;
    const sqmPerPerson = avgSqm / avgStaff;

    const desksNeeded = Math.ceil(avgStaff * 0.85);
    const meetingRoomsNeeded = Math.max(1, Math.ceil(avgStaff / 10));
    const focusPodsNeeded = Math.max(1, Math.ceil(avgStaff / 15));

    let densityLabel: string;
    let densityIcon: typeof CheckCircle2;
    let densityTip: string;

    if (sqmPerPerson < 8) {
      densityLabel = "High Density";
      densityIcon = AlertTriangle;
      densityTip = "Below AU workplace standard (8–12 sqm/person). Acoustic booths & clever zoning essential.";
    } else if (sqmPerPerson < 12) {
      densityLabel = "Optimal Density";
      densityIcon = CheckCircle2;
      densityTip = "Within the Australian workplace benchmark of 8–12 sqm/person. Great starting point.";
    } else {
      densityLabel = "Spacious Layout";
      densityIcon = TrendingUp;
      densityTip = "Above benchmark — excellent for premium collaborative zones and executive areas.";
    }

    return {
      sqmPerPerson: sqmPerPerson.toFixed(1),
      desksNeeded,
      meetingRoomsNeeded,
      focusPodsNeeded,
      densityLabel,
      densityIcon,
      densityTip,
    };
  }, [officeSize, staffCount]);

  if (!insight) {
    return (
      <div className="luxury-card p-6 rounded-md border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
          <span className="text-sm font-semibold text-white">Space Intelligence</span>
        </div>
        <p className="text-white/40 text-xs">Select your office size and staff count to see personalised workspace recommendations.</p>
      </div>
    );
  }

  const DensityIcon = insight.densityIcon;

  return (
    <div className="luxury-card p-6 rounded-md border border-[rgba(201,168,76,0.15)] space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
        <span className="text-sm font-semibold text-white">Space Intelligence</span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border ${
          insight.densityLabel === "High Density" ? "bg-orange-400/10 border-orange-400/20 text-orange-400" :
          insight.densityLabel === "Optimal Density" ? "bg-green-400/10 border-green-400/20 text-green-400" :
          "bg-blue-400/10 border-blue-400/20 text-blue-400"
        }`}>
          {insight.densityLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Sqm / Person", value: `${insight.sqmPerPerson} sqm`, highlight: true },
          { label: "Desks Needed", value: `${insight.desksNeeded} stations`, highlight: false },
          { label: "Meeting Rooms", value: `${insight.meetingRoomsNeeded} rooms`, highlight: false },
          { label: "Focus Pods", value: `${insight.focusPodsNeeded} pods`, highlight: false },
        ].map((item) => (
          <div key={item.label} className={`rounded-lg p-3 ${item.highlight ? "bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.2)]" : "bg-white/[0.04] border border-white/[0.06]"}`}>
            <div className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">{item.label}</div>
            <div className={`font-semibold text-sm ${item.highlight ? "text-[hsl(43,78%,65%)]" : "text-white"}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className={`flex items-start gap-2 text-xs rounded-lg p-3 ${
        insight.densityLabel === "High Density" ? "bg-orange-400/5 border border-orange-400/10 text-orange-300/80" :
        insight.densityLabel === "Optimal Density" ? "bg-green-400/5 border border-green-400/10 text-green-300/80" :
        "bg-blue-400/5 border border-blue-400/10 text-blue-300/80"
      }`}>
        <DensityIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{insight.densityTip}</span>
      </div>
    </div>
  );
}

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
  const [calcOfficeSize, setCalcOfficeSize] = useState<string>("");
  const [calcStaffCount, setCalcStaffCount] = useState<string>("");

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
                <h2 className="text-2xl font-serif font-bold text-white mb-2">
                  Your workspace plan is ready
                  <span className="block text-[hsl(43,78%,65%)]">(valued at $499)</span>
                </h2>
                <p className="text-white/45 text-sm font-medium mt-3 tracking-wide uppercase">
                  Only 1 free plan per company — unlock full details to proceed
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
                {[
                  { icon: FileText, label: "Full furniture list with SKUs" },
                  { icon: ArrowRight, label: "Exact pricing breakdown" },
                  { icon: Building2, label: "Downloadable layout (PDF + DWG)" },
                  { icon: Users, label: "Supplier-ready spec sheet" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                    <Icon className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    <span className="text-white/75 text-sm">{label}</span>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <div className="luxury-card rounded-lg p-5 border border-[rgba(201,168,76,0.25)] text-left space-y-1.5">
                  <div className="text-[hsl(43,78%,65%)] font-semibold text-xs uppercase tracking-wide">Pay to Unlock</div>
                  <div className="text-white text-2xl font-serif font-bold">$499</div>
                  <div className="text-white/40 text-xs">Instant access · fee credited to your order</div>
                </div>
                <div className="luxury-card rounded-lg p-5 border border-[rgba(99,179,237,0.2)] text-left space-y-1.5">
                  <div className="text-blue-300 font-semibold text-xs uppercase tracking-wide">Free with Purchase</div>
                  <div className="text-white text-2xl font-serif font-bold">$0</div>
                  <div className="text-white/40 text-xs">Order furniture · receive full plan free</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto w-full">
                <Button
                  data-testid="button-unlock-full-plan"
                  className="flex-1 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,5%)] font-semibold px-6 py-3 h-auto"
                  onClick={() => setLocation("/upload-your-floor-plan")}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Unlock Full Plan
                </Button>
                <Button
                  data-testid="button-get-quote"
                  variant="outline"
                  className="flex-1 border-white/20 text-white hover:bg-white/5 px-6 py-3 h-auto"
                  onClick={() => setLocation("/send-us-your-quote")}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Get Quote Instead
                </Button>
              </div>

              <p className="text-white/35 text-xs">
                Unlock fee is credited toward your furniture order
              </p>

              <div className="pt-6 border-t border-white/[0.07] text-left">
                <div className="text-white/70 text-sm font-semibold">Benjamin Mumford</div>
                <div className="text-white/40 text-xs mt-0.5">Director, Workplace Strategy &amp; Commercial Interiors</div>
                <div className="text-white/30 text-xs mt-0.5">The Corporate Desk &nbsp;·&nbsp; 0408 407 166 &nbsp;·&nbsp; service@thecorporatedesk.com.au</div>
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
                <div className="luxury-card rounded-xl p-6 border border-[rgba(201,168,76,0.25)] space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className="w-4 h-4 text-[hsl(43,78%,65%)]" />
                      <span className="text-[hsl(43,78%,65%)] font-semibold text-sm">Full Plan — Locked</span>
                    </div>
                    <div className="text-white font-serif font-bold text-lg leading-tight">
                      Your workspace plan is ready
                      <span className="block text-[hsl(43,78%,65%)] text-base font-sans font-normal mt-0.5">(valued at $499)</span>
                    </div>
                    <p className="text-white/45 text-xs font-medium mt-2 uppercase tracking-wide">
                      Only 1 free plan per company — unlock full details to proceed
                    </p>
                  </div>

                  <div className="space-y-2">
                    {[
                      { icon: FileText, label: "Full furniture list with SKUs" },
                      { icon: ArrowRight, label: "Exact pricing breakdown" },
                      { icon: Building2, label: "Downloadable layout (PDF + DWG)" },
                      { icon: Users, label: "Supplier-ready spec sheet" },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        <Icon className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
                        <span className="text-white/70 text-xs">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
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
                      Get Quote Instead
                    </Button>
                  </div>

                  <p className="text-white/30 text-xs text-center">
                    Unlock fee is credited toward your furniture order
                  </p>

                  <div className="pt-4 border-t border-white/[0.07]">
                    <div className="text-white/65 text-xs font-semibold">Benjamin Mumford</div>
                    <div className="text-white/35 text-xs mt-0.5">Director, Workplace Strategy &amp; Commercial Interiors</div>
                    <div className="text-white/25 text-xs mt-0.5">The Corporate Desk &nbsp;·&nbsp; 0408 407 166</div>
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

              <div className="luxury-card p-5 rounded-md border border-white/[0.06] space-y-3">
                <div className="text-sm font-semibold text-white mb-1">Quick Space Calculator</div>
                <p className="text-white/40 text-xs mb-3">Get an instant density score for your space — no signup required.</p>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Office Size</label>
                  <select
                    value={calcOfficeSize}
                    onChange={(e) => setCalcOfficeSize(e.target.value)}
                    data-testid="select-calc-office-size"
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.15)] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-[rgba(201,168,76,0.4)] appearance-none"
                  >
                    <option value="">Select office size…</option>
                    {Object.keys(SQM_RANGES).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Staff Count</label>
                  <select
                    value={calcStaffCount}
                    onChange={(e) => setCalcStaffCount(e.target.value)}
                    data-testid="select-calc-staff-count"
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.15)] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-[rgba(201,168,76,0.4)] appearance-none"
                  >
                    <option value="">Select staff count…</option>
                    {Object.keys(STAFF_RANGES).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>

              <SpaceIntelligenceWidget officeSize={calcOfficeSize} staffCount={calcStaffCount} />
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
