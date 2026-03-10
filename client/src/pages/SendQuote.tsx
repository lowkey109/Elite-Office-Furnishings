import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { LeadForm } from "@/components/LeadForm";
import { CheckCircle2, Clock, DollarSign } from "lucide-react";

const fields = [
  { name: "name", label: "Full Name", type: "text" as const, placeholder: "John Smith" },
  { name: "company", label: "Company Name", type: "text" as const, placeholder: "Acme Corporation" },
  { name: "email", label: "Email Address", type: "email" as const, placeholder: "john@company.com.au" },
  { name: "phone", label: "Phone Number", type: "tel" as const, placeholder: "02 XXXX XXXX" },
  { name: "budget", label: "Project Budget", type: "select" as const, placeholder: "Select budget range", options: [
    "$30,000 – $60,000", "$60,000 – $100,000", "$100,000 – $200,000", "$200,000 – $300,000", "$300,000+",
  ]},
  { name: "timeline", label: "Project Timeline", type: "select" as const, placeholder: "Select timeline", options: [
    "ASAP (within 4 weeks)", "1–3 months", "3–6 months", "6–12 months", "Planning stage",
  ]},
  { name: "message", label: "Project Details / Existing Quote", type: "textarea" as const, placeholder: "Describe your project requirements. If you have an existing quote from another supplier, please outline the key items and quantities.", required: false, half: false },
];

export default function SendQuote() {
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <section className="relative pt-40 pb-16 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
            Quote Request
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-4">
            Send Us<br />
            <span className="gold-text">Your Quote</span>
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-white/55 max-w-xl leading-relaxed text-lg">
            Have a quote from another supplier? We'll match or beat it. Or describe your requirements and we'll provide a comprehensive, transparent quote.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-white mb-4">Our Quote Promise</h2>
                <div className="space-y-4">
                  {[
                    "Competitive, transparent pricing",
                    "No hidden fees or surprises",
                    "Detailed line-item breakdown",
                    "Multiple product options provided",
                    "Delivered within 24 business hours",
                    "Quote valid for 30 days",
                    "ISO 9001 certified quality guaranteed",
                    "6-year manufacturer warranty included",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                      <span className="text-white/65 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="luxury-card p-5 rounded-md text-center" data-testid="card-stat-response">
                  <Clock className="w-6 h-6 text-[hsl(43,78%,52%)] mx-auto mb-2" />
                  <div className="text-2xl font-serif font-bold text-white">24hr</div>
                  <div className="text-xs text-white/45 mt-1">Response time</div>
                </div>
                <div className="luxury-card p-5 rounded-md text-center" data-testid="card-stat-savings">
                  <DollarSign className="w-6 h-6 text-[hsl(43,78%,52%)] mx-auto mb-2" />
                  <div className="text-2xl font-serif font-bold text-white">Best</div>
                  <div className="text-xs text-white/45 mt-1">Price guaranteed</div>
                </div>
              </div>

              <div className="luxury-card p-6 rounded-md">
                <div className="text-sm text-[hsl(43,78%,65%)] font-medium mb-3">Project Range</div>
                <div className="text-xl font-serif font-bold text-white">$30,000 – $300,000+</div>
                <div className="text-white/45 text-sm mt-2 leading-relaxed">
                  We specialise in commercial projects of all sizes, from single office fitouts to full building transformations.
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="luxury-card p-8 rounded-md">
                <h2 className="text-xl font-serif font-bold text-white mb-2">Request Your Quote</h2>
                <p className="text-white/45 text-sm mb-8">Complete the form and our team will respond with a detailed quote within 24 hours.</p>
                <LeadForm
                  formType="quote"
                  fields={fields}
                  onSuccess={() => setLocation("/thank-you-quote")}
                  submitLabel="Submit My Quote Request"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
