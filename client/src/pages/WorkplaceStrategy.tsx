import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { LeadForm } from "@/components/LeadForm";
import { CheckCircle2, Phone } from "lucide-react";

const fields = [
  { name: "name", label: "Full Name", type: "text" as const, placeholder: "John Smith" },
  { name: "company", label: "Company Name", type: "text" as const, placeholder: "Acme Corporation" },
  { name: "email", label: "Email Address", type: "email" as const, placeholder: "john@company.com.au" },
  { name: "phone", label: "Phone Number", type: "tel" as const, placeholder: "02 XXXX XXXX" },
  { name: "staffCount", label: "Number of Staff", type: "select" as const, placeholder: "Select staff count", options: [
    "1–10", "11–25", "26–50", "51–100", "100–250", "250+",
  ]},
  { name: "officeLocation", label: "Office Location", type: "select" as const, placeholder: "Select city", options: [
    "Brisbane", "Sydney", "Melbourne", "Adelaide", "Perth", "Canberra", "Other",
  ]},
  { name: "moveDate", label: "Target Move / Completion Date", type: "select" as const, placeholder: "Select timeframe", options: [
    "Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "More than 12 months", "Flexible",
  ]},
  { name: "budget", label: "Budget Range", type: "select" as const, placeholder: "Select budget", options: [
    "$30,000 – $60,000", "$60,000 – $100,000", "$100,000 – $200,000", "$200,000 – $300,000", "$300,000+", "Not yet defined",
  ]},
  { name: "message", label: "Tell Us About Your Project Vision", type: "textarea" as const, placeholder: "Describe your current situation, challenges you're facing, desired outcomes, specific requirements or questions...", required: false, half: false },
];

const callTopics = [
  "Space planning and layout optimisation",
  "Budget planning and cost estimation",
  "Product selection and customisation options",
  "Project timeline and milestone planning",
  "Installation and delivery logistics",
  "After-sales support and warranty information",
];

export default function WorkplaceStrategy() {
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <section className="relative pt-40 pb-16 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
            Expert Consultation
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-4">
            Workplace<br />
            <span className="gold-text">Strategy Call</span>
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-white/55 max-w-xl leading-relaxed text-lg">
            A complimentary 30-minute consultation with one of our senior workplace specialists. We'll map out your entire project from day one.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-white mb-4">What We Cover</h2>
                <div className="space-y-3">
                  {callTopics.map((topic) => (
                    <div key={topic} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                      <span className="text-white/65 text-sm">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="luxury-card p-6 rounded-md" data-testid="card-call-details">
                <Phone className="w-8 h-8 text-[hsl(43,78%,52%)] mb-4" />
                <div className="text-sm text-[hsl(43,78%,65%)] font-medium mb-1">Call Duration</div>
                <div className="text-2xl font-serif font-bold text-white mb-3">30 Minutes</div>
                <div className="space-y-2 text-sm text-white/50">
                  <p>Available Monday – Friday</p>
                  <p>9:00am – 5:00pm AEST</p>
                  <p className="text-[hsl(43,78%,52%)] font-medium">Or call us directly: 1300 977 607</p>
                </div>
              </div>

              <div className="luxury-card p-6 rounded-md">
                <div className="text-sm text-[hsl(43,78%,65%)] font-medium mb-3">Who Is This For?</div>
                <div className="space-y-3 text-sm text-white/55">
                  <p>Companies planning a new office fit-out or refurbishment</p>
                  <p>Businesses expanding into new premises</p>
                  <p>Organisations wanting to improve staff productivity and wellbeing</p>
                  <p>Projects ranging from $30,000 to $300,000+</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="luxury-card p-8 rounded-md">
                <h2 className="text-xl font-serif font-bold text-white mb-2">Book Your Strategy Call</h2>
                <p className="text-white/45 text-sm mb-8">Complete the form and we'll be in touch within one business day to schedule your consultation.</p>
                <LeadForm
                  formType="strategy"
                  fields={fields}
                  onSuccess={() => setLocation("/thank-you-strategy")}
                  submitLabel="Book My Strategy Call"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
