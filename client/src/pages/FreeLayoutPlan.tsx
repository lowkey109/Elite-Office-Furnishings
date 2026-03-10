import { useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { LeadForm } from "@/components/LeadForm";
import { CheckCircle2, Ruler, Layout as LayoutIcon, Zap } from "lucide-react";

const fields = [
  { name: "name", label: "Full Name", type: "text" as const, placeholder: "John Smith" },
  { name: "company", label: "Company Name", type: "text" as const, placeholder: "Acme Corporation" },
  { name: "email", label: "Email Address", type: "email" as const, placeholder: "john@company.com.au" },
  { name: "phone", label: "Phone Number", type: "tel" as const, placeholder: "02 XXXX XXXX" },
  { name: "officeSize", label: "Office Size (sqm)", type: "select" as const, placeholder: "Select office size", options: [
    "Under 100 sqm", "100–200 sqm", "200–500 sqm", "500–1,000 sqm", "1,000+ sqm",
  ]},
  { name: "staffCount", label: "Number of Staff", type: "select" as const, placeholder: "Select staff count", options: [
    "1–10", "11–25", "26–50", "51–100", "100–250", "250+",
  ]},
  { name: "message", label: "Tell Us About Your Project", type: "textarea" as const, placeholder: "Describe your current office challenges, furniture requirements, preferred style, special requirements...", required: false, half: false },
];

const benefits = [
  { icon: Ruler, title: "Space Optimisation", desc: "Maximise every square metre of your office footprint" },
  { icon: LayoutIcon, title: "Expert Design", desc: "Professional furniture layout by our workplace specialists" },
  { icon: Zap, title: "Fast Turnaround", desc: "Layout plan delivered within 48–72 business hours" },
];

export default function FreeLayoutPlan() {
  const [, setLocation] = useLocation();

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
            Tell us about your space and our specialists will design the optimal furniture layout — completely free of charge.
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
                    "Professional space planning analysis",
                    "Optimised furniture layout diagram",
                    "Product recommendations with pricing",
                    "Staff workflow and circulation planning",
                    "Collaborative zone & focus area design",
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
                  <div key={b.title} className="luxury-card p-5 rounded-md flex gap-4 items-start" data-testid={`card-benefit-${b.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    <b.icon className="w-8 h-8 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-white text-sm">{b.title}</div>
                      <div className="text-white/50 text-xs mt-1">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="luxury-card p-6 rounded-md">
                <div className="text-sm text-[hsl(43,78%,65%)] font-medium mb-2">Response Time</div>
                <div className="text-3xl font-serif font-bold text-white">24–48 hrs</div>
                <div className="text-white/45 text-sm mt-1">Our team will respond within one business day</div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="luxury-card p-8 rounded-md">
                <h2 className="text-xl font-serif font-bold text-white mb-2">Request Your Free Layout Plan</h2>
                <p className="text-white/45 text-sm mb-8">Fill in the form below and our team will be in touch promptly.</p>
                <LeadForm
                  formType="layout-plan"
                  fields={fields}
                  onSuccess={() => setLocation("/thank-you-layout-plan")}
                  submitLabel="Request My Free Layout Plan"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
