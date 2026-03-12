import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { ArrowRight, Users, MapPin, Clock, TrendingUp, Building2, ChevronRight } from "lucide-react";

type Industry = "All" | "Legal" | "Finance" | "Technology" | "Healthcare" | "Property" | "Government";

const FILTERS: Industry[] = ["All", "Legal", "Finance", "Technology", "Healthcare", "Property", "Government"];

interface CaseStudy {
  id: number;
  company: string;
  industry: Industry;
  location: string;
  projectType: string;
  challenge: string;
  solution: string;
  outcome: string;
  stats: { label: string; value: string }[];
  series: string;
  value: string;
  timeline: string;
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 1,
    company: "Whitmore & Associates",
    industry: "Legal",
    location: "Brisbane CBD",
    projectType: "Full Office Fitout",
    challenge: "A 40-person boutique law firm needed to relocate and establish a premium brand presence in new Level 18 CBD offices. Their previous space felt dated and failed to reflect the firm's prestigious client base.",
    solution: "Complete fitout in the Fessenz Executive Collection — dark walnut executive desks for all partners, Fessenz boardroom table for 16, full ergonomic task chair rollout, reception station, and custom breakout zone. Full project management from concept to installation.",
    outcome: "The new space was completed on time, two weeks before staff moved in. The firm reported immediate client and staff feedback about the elevated experience. New client conversion rate increased noticeably in the 6 months following the move.",
    stats: [
      { label: "Staff", value: "40" },
      { label: "Project Value", value: "$240,000" },
      { label: "Lead Time", value: "9 weeks" },
      { label: "On-Time", value: "100%" },
    ],
    series: "Fessenz Executive Collection",
    value: "$240,000",
    timeline: "9 weeks",
  },
  {
    id: 2,
    company: "Crestfield Capital",
    industry: "Finance",
    location: "Sydney CBD",
    projectType: "Executive Floor Fitout",
    challenge: "A private equity firm's executive floor hadn't been updated in over a decade. The CEO wanted a complete transformation that would reflect the company's growth and attract top-tier talent.",
    solution: "Full executive floor transformation: custom LRU executive desks with integrated credenzas, premium leather executive chairs, glass-fronted conference room with LRU boardroom table for 12, and a dedicated client meeting lounge with premium soft seating.",
    outcome: "Staff retention and recruitment improved measurably. The CEO cited the upgraded environment as a key factor in winning two significant new client engagements. The space is now regularly featured in company recruitment materials.",
    stats: [
      { label: "Staff Seats", value: "28" },
      { label: "Project Value", value: "$185,000" },
      { label: "Lead Time", value: "7 weeks" },
      { label: "Satisfaction", value: "★★★★★" },
    ],
    series: "LRU Executive Collection",
    value: "$185,000",
    timeline: "7 weeks",
  },
  {
    id: 3,
    company: "NovaTech Solutions",
    industry: "Technology",
    location: "Melbourne Southbank",
    projectType: "Activity-Based Workspace",
    challenge: "A 120-person SaaS company expanding to a new Melbourne headquarters needed a modern, flexible activity-based working environment that could support hybrid work patterns and rapid team growth.",
    solution: "Full activity-based workspace in the Milan Workstation Series: open-plan 80-station workstation run, 6 acoustic meeting pods, 3 breakout café zones, standing desks for all staff, quiet focus booths, and a branded reception zone with feature wall.",
    outcome: "Staff rated the new environment 4.9/5 in a post-move survey. The company was able to accommodate 20% headcount growth without additional space by using the flexible layout. Featured in two tech industry publications for workspace design.",
    stats: [
      { label: "Staff", value: "120" },
      { label: "Project Value", value: "$290,000" },
      { label: "Lead Time", value: "12 weeks" },
      { label: "Staff Rating", value: "4.9/5" },
    ],
    series: "Milan Workstation Series",
    value: "$290,000",
    timeline: "12 weeks",
  },
  {
    id: 4,
    company: "Meridian Health Group",
    industry: "Healthcare",
    location: "Brisbane North",
    projectType: "Multi-Site Rollout",
    challenge: "A healthcare group opening three new specialist clinic locations simultaneously needed consistent, professional furniture across all sites — on a tight launch timeline with complex logistics.",
    solution: "Coordinated three-site rollout of Milan Series reception desks, waiting area soft seating, administration workstations, and consultation room furniture. Dedicated project coordinator, staged delivery schedule, and full installation team across all sites.",
    outcome: "All three sites opened on the same day as planned. Reception and patient feedback highlighted the calm, professional atmosphere. The client has since engaged TCD for two additional clinic fitouts.",
    stats: [
      { label: "Sites", value: "3" },
      { label: "Project Value", value: "$165,000" },
      { label: "Lead Time", value: "8 weeks" },
      { label: "Repeat Client", value: "Yes" },
    ],
    series: "Milan Series",
    value: "$165,000",
    timeline: "8 weeks",
  },
  {
    id: 5,
    company: "Grandview Property Group",
    industry: "Property",
    location: "Gold Coast",
    projectType: "Sales Suite & HQ Fitout",
    challenge: "A luxury residential developer needed a striking sales suite and corporate headquarters that would impress high-net-worth buyers and reflect a multi-billion-dollar portfolio.",
    solution: "Bespoke fitout combining Fessenz executive offices for senior management, a custom boardroom and client presentation suite, and a dedicated property sales suite with premium display configurations, lounge seating, and a custom reception desk.",
    outcome: "The sales suite became a key tool in the property sales process. The developer's principal reported that the quality of the space directly contributed to buyer confidence. Project was delivered entirely on schedule despite complex staging requirements.",
    stats: [
      { label: "Staff", value: "35" },
      { label: "Project Value", value: "$210,000" },
      { label: "Lead Time", value: "10 weeks" },
      { label: "On-Time", value: "100%" },
    ],
    series: "Fessenz & Milan Collections",
    value: "$210,000",
    timeline: "10 weeks",
  },
  {
    id: 6,
    company: "Queensland Regulatory Authority",
    industry: "Government",
    location: "Brisbane CBD",
    projectType: "Departmental Refurbishment",
    challenge: "A state government department needed a complete furniture refresh across two floors to comply with updated ergonomic standards and accommodate staff growth from restructuring.",
    solution: "Comprehensive refurbishment using the Milan and Fessenz collections: 90 height-adjustable workstations, ergonomic task chairs for all staff, 4 new meeting room configurations, updated breakout areas, and new storage solutions — all selected to comply with government procurement and AS/NZS standards.",
    outcome: "WorkSafe audit compliance achieved immediately post-fitout. Staff reported significant reduction in ergonomic complaints. The department later expanded the rollout to a third floor based on the results.",
    stats: [
      { label: "Workstations", value: "90" },
      { label: "Project Value", value: "$195,000" },
      { label: "Lead Time", value: "10 weeks" },
      { label: "Compliance", value: "100%" },
    ],
    series: "Milan & Fessenz Collections",
    value: "$195,000",
    timeline: "10 weeks",
  },
];

export default function CaseStudies() {
  const [filter, setFilter] = useState<Industry>("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Case Studies — Commercial Office Fitout Projects | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Real results from real businesses. See how The Corporate Desk has transformed law firms, tech companies, healthcare providers and more across Australia.");
  }, []);

  const filtered = filter === "All" ? CASE_STUDIES : CASE_STUDIES.filter(cs => cs.industry === filter);

  return (
    <Layout>
      <section className="relative pt-32 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(201,168,76,0.04)] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] mb-5">
            Case Studies
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-white mb-5 leading-tight">
            Real Projects.<br />
            <span className="gold-text">Measurable Results.</span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            From boutique law firms to government departments and fast-growing tech companies — see how Australia's leading organisations have transformed their workspaces with The Corporate Desk.
          </p>
        </div>
      </section>

      <section className="pb-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {FILTERS.map(f => (
              <button
                key={f}
                data-testid={`button-filter-${f.toLowerCase()}`}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] ${
                  filter === f
                    ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                    : "border border-[rgba(255,255,255,0.1)] text-white/60 hover:border-[rgba(201,168,76,0.3)] hover:text-white"
                }`}
              >
                {f}
                {f !== "All" && (
                  <span className="ml-2 text-xs opacity-60">
                    ({CASE_STUDIES.filter(cs => cs.industry === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filtered.map(cs => (
              <div
                key={cs.id}
                data-testid={`card-case-study-${cs.id}`}
                className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden hover:border-[rgba(201,168,76,0.2)] transition-all"
              >
                <div className="p-6 sm:p-7">
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] text-xs">
                          {cs.industry}
                        </Badge>
                        <Badge className="bg-[rgba(255,255,255,0.06)] text-white/50 border-[rgba(255,255,255,0.08)] text-xs">
                          {cs.series}
                        </Badge>
                      </div>
                      <h3 className="text-white font-serif font-bold text-xl">{cs.company}</h3>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[hsl(43,78%,65%)] font-bold text-lg font-serif">{cs.value}</p>
                      <p className="text-white/30 text-xs">project value</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-5 text-xs text-white/40">
                    <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {cs.location}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {cs.timeline}</span>
                    <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {cs.projectType}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {cs.stats.map(stat => (
                      <div key={stat.label} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 text-center border border-[rgba(255,255,255,0.04)]">
                        <p className="text-[hsl(43,78%,65%)] font-bold text-base" data-testid={`stat-${cs.id}-${stat.label.toLowerCase().replace(/\s+/g,"-")}`}>{stat.value}</p>
                        <p className="text-white/40 text-xs mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 mb-5">
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5">The Challenge</p>
                      <p className="text-white/70 text-sm leading-relaxed">{cs.challenge}</p>
                    </div>

                    {expanded === cs.id && (
                      <>
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5">Our Solution</p>
                          <p className="text-white/70 text-sm leading-relaxed">{cs.solution}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5">The Outcome</p>
                          <p className="text-white/70 text-sm leading-relaxed">{cs.outcome}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    data-testid={`button-expand-case-${cs.id}`}
                    onClick={() => setExpanded(expanded === cs.id ? null : cs.id)}
                    className="flex items-center gap-1.5 text-sm text-[hsl(43,78%,65%)] hover:text-[hsl(43,78%,75%)] transition-colors min-h-[44px]"
                  >
                    {expanded === cs.id ? "Show less" : "Read full case study"}
                    <ChevronRight className={`w-4 h-4 transition-transform ${expanded === cs.id ? "rotate-90" : ""}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-white/40">No case studies found for this filter.</p>
            </div>
          )}
        </div>
      </section>

      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[hsl(220,18%,12%)] to-[hsl(220,20%,8%)] border border-[rgba(201,168,76,0.2)] rounded-3xl p-8 sm:p-12 text-center">
            <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] mb-5">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Start Your Project
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
              Your Success Story Starts Here
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Join the growing number of Australian businesses that trust The Corporate Desk with their most important spaces.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] px-8 text-base"
                data-testid="button-case-studies-cta"
              >
                <Link href="/quote-builder">Build Your Quote <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[52px] px-6 text-base"
                data-testid="button-case-studies-layout-plan"
              >
                <Link href="/free-office-layout-plan">Get a Free Layout Plan</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
