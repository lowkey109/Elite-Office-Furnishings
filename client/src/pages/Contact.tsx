import { useEffect } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { LeadForm } from "@/components/LeadForm";
import { Phone, Mail, MapPin, Clock, ArrowRight } from "lucide-react";

const fields = [
  { name: "name", label: "Full Name", type: "text" as const, placeholder: "John Smith" },
  { name: "company", label: "Company Name", type: "text" as const, placeholder: "Acme Corporation" },
  { name: "email", label: "Email Address", type: "email" as const, placeholder: "john@company.com.au" },
  { name: "phone", label: "Phone Number", type: "tel" as const, placeholder: "02 XXXX XXXX" },
  { name: "message", label: "How Can We Help?", type: "textarea" as const, placeholder: "Tell us about your project, enquiry, or any questions you have...", required: false, half: false },
];

const contactInfo = [
  {
    icon: Phone,
    label: "Phone",
    value: "1300 977 607",
    href: "tel:1300977607",
    testId: "link-contact-phone",
  },
  {
    icon: Mail,
    label: "Email",
    value: "service@thecorporatedesk.com.au",
    href: "mailto:service@thecorporatedesk.com.au",
    testId: "link-contact-email",
  },
  {
    icon: MapPin,
    label: "Address",
    value: "10 Primrose Street, Bowen Hills QLD 4006",
    href: null,
    testId: "text-contact-address",
  },
  {
    icon: Clock,
    label: "Business Hours",
    value: "Monday – Friday, 9:00am – 5:00pm AEST",
    href: null,
    testId: "text-contact-hours",
  },
];

export default function Contact() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Contact Us — Get in Touch | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "Contact The Corporate Desk for commercial office furniture enquiries. Call 1300 977 607 or email service@thecorporatedesk.com.au. Brisbane, Sydney, Melbourne and national.");
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);

  return (
    <Layout>
      <section className="relative pt-36 sm:pt-40 pb-12 sm:pb-16 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
            Get In Touch
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-4">
            Let's Start a<br />
            <span className="gold-text">Conversation</span>
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-white/55 max-w-xl leading-relaxed text-lg">
            Ready to transform your workspace? Our team of specialists is here to help. Reach out and we'll respond within 24 hours.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-white mb-6">Contact Information</h2>
                <div className="space-y-4">
                  {contactInfo.map((info) => (
                    <div key={info.label} className="luxury-card p-5 rounded-md flex gap-4 items-start" data-testid={info.testId}>
                      <div className="w-10 h-10 rounded-full bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center flex-shrink-0">
                        <info.icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                      </div>
                      <div>
                        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{info.label}</div>
                        {info.href ? (
                          <a href={info.href} className="text-white/80 hover:text-[hsl(43,78%,65%)] transition-colors font-medium text-sm break-all">
                            {info.value}
                          </a>
                        ) : (
                          <p className="text-white/80 text-sm">{info.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-base font-serif font-bold text-white mb-4">Prefer a Direct Path?</h3>
                <div className="space-y-3">
                  <Button asChild size="sm" className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-semibold border-none" data-testid="button-contact-ai-planner">
                    <Link href="/upload-your-floor-plan">
                      AI Office Planner <ArrowRight className="ml-2 w-3.5 h-3.5" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="w-full border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]" data-testid="button-contact-layout-plan">
                    <Link href="/free-office-layout-plan">
                      Free Office Layout Plan <ArrowRight className="ml-2 w-3.5 h-3.5" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="w-full border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]" data-testid="button-contact-strategy">
                    <Link href="/workplace-strategy">
                      Book a Strategy Call <ArrowRight className="ml-2 w-3.5 h-3.5" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="w-full border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)]" data-testid="button-contact-quote">
                    <Link href="/send-us-your-quote">
                      Send Us Your Quote <ArrowRight className="ml-2 w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="luxury-card p-8 rounded-md">
                <h2 className="text-xl font-serif font-bold text-white mb-2">Send Us a Message</h2>
                <p className="text-white/45 text-sm mb-8">We'll respond within one business day.</p>
                <LeadForm
                  formType="contact"
                  fields={fields}
                  onSuccess={() => setLocation("/thank-you-quote")}
                  submitLabel="Send Message"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
