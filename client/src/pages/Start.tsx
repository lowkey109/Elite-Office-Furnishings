import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Building2, FileText, Upload, Calculator, Phone,
  Handshake, MessageSquare, CheckCircle2, ChevronRight,
} from "lucide-react";

function useSEO(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", description);
  }, [title, description]);
}

const PATHS = [
  {
    id: "quote",
    icon: FileText,
    label: "Get a Quote",
    desc: "Tell us about your project and receive a detailed furniture quote within 24 hours.",
    cta: "Start Your Quote",
    href: "/send-us-your-quote",
    tag: null,
  },
  {
    id: "floorplan",
    icon: Upload,
    label: "Upload a Floor Plan",
    desc: "Upload your floor plan and our AI will generate a furniture layout and product schedule.",
    cta: "Upload Floor Plan",
    href: "/upload-your-floor-plan",
    tag: "AI-Powered",
  },
  {
    id: "trade",
    icon: Building2,
    label: "Trade & Project Procurement",
    desc: "Fitout contractors, architects, and project managers — get priority procurement support.",
    cta: "Trade Portal",
    href: "/trade-customers-portal",
    tag: "Trade",
  },
  {
    id: "calculator",
    icon: Calculator,
    label: "Build a Quote",
    desc: "Use our interactive quote builder to configure your workspace and get live pricing.",
    cta: "Open Quote Builder",
    href: "/quote-builder",
    tag: null,
  },
  {
    id: "partner",
    icon: Handshake,
    label: "Refer a Client",
    desc: "Submit a client referral and earn 7.5% commission on every won deal.",
    cta: "Refer a Client",
    href: "/submit-deal",
    tag: "7.5% Commission",
  },
  {
    id: "strategy",
    icon: Phone,
    label: "Book a Strategy Call",
    desc: "Speak with a workspace consultant about your office project, timeline, and requirements.",
    cta: "Book a Call",
    href: "/workplace-strategy",
    tag: null,
  },
];

type QuickEnquiryForm = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

export default function Start() {
  useSEO(
    "Get Started | The Corporate Desk",
    "Tell us about your workspace project and we'll get back to you within 24 hours. Quote, floor plan, trade procurement, or strategy call — start here."
  );

  const [, setLocation] = useLocation();
  const [form, setForm] = useState<QuickEnquiryForm>({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const enquiryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/enquiries", {
      name: form.name,
      email: form.email,
      phone: form.phone,
      message: form.message,
      source: "start-page",
    }),
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Enquiry received", description: "We'll be in touch within 24 hours." });
    },
    onError: () => {
      toast({ title: "Submission error", description: "Please try again or call 1300 977 607.", variant: "destructive" });
    },
  });

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    enquiryMutation.mutate();
  };

  return (
    <Layout>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-6 bg-[hsl(220,20%,6%)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(201,168,76,0.05),transparent_60%)]" />
        <div className="max-w-4xl mx-auto relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.05)] text-[hsl(43,78%,65%)] text-xs font-medium tracking-widest uppercase mb-8">
            Where would you like to start?
          </div>
          <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-5">
            Let's build your workspace.
          </h1>
          <p className="text-lg text-white/45 max-w-xl mx-auto mb-3">
            Choose the path that best fits your project — or send us a quick message and we'll take it from there.
          </p>
        </div>
      </section>

      {/* ── Path Cards ─────────────────────────────────────────────────── */}
      <section className="py-12 px-6 bg-[hsl(220,18%,8%)]">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PATHS.map(({ id, icon: Icon, label, desc, cta, href, tag }) => (
            <Link href={href} key={id}>
              <div
                data-testid={`card-start-${id}`}
                className="group h-full p-5 border border-white/8 bg-white/[0.02] hover:bg-white/5 hover:border-[hsl(43,78%,52%)]/20 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 border border-white/10 bg-white/[0.03] flex items-center justify-center group-hover:border-[hsl(43,78%,52%)]/30">
                    <Icon className="w-4 h-4 text-white/50 group-hover:text-[hsl(43,78%,52%)] transition-colors" />
                  </div>
                  {tag && (
                    <span className="text-[10px] px-2 py-0.5 bg-[hsl(43,78%,52%)]/10 text-[hsl(43,78%,65%)] border border-[hsl(43,78%,52%)]/20 tracking-wide">
                      {tag}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-white text-sm mb-2">{label}</h3>
                <p className="text-white/40 text-xs leading-relaxed mb-4">{desc}</p>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(43,78%,52%)] font-medium">
                  {cta} <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Quick Enquiry Form ──────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[hsl(220,20%,6%)] border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl font-light text-white mb-3">Just send us a message</h2>
              <p className="text-white/40 text-sm leading-relaxed mb-6">
                Not sure which path fits your project? Drop us a line and we'll respond within 24 business hours.
              </p>
              <div className="space-y-3 text-sm text-white/40">
                {[
                  "1300 977 607 — Mon–Fri 9am–5pm AEST",
                  "service@thecorporatedesk.com.au",
                  "thecorporatedesk.com.au",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[hsl(43,78%,52%)]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {submitted ? (
              <div className="border border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/5 p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-[hsl(43,78%,52%)] mx-auto mb-4" />
                <h3 className="font-medium text-white mb-2">Message received</h3>
                <p className="text-white/40 text-sm">We'll be in touch within 24 business hours.</p>
              </div>
            ) : (
              <form onSubmit={handleQuickSubmit} className="space-y-3" data-testid="form-start-enquiry">
                {[
                  { id: "name", label: "Full Name *", type: "text", key: "name", required: true },
                  { id: "email", label: "Email Address *", type: "email", key: "email", required: true },
                  { id: "phone", label: "Phone Number", type: "tel", key: "phone", required: false },
                ].map(({ id, label, type, key, required }) => (
                  <div key={id}>
                    <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wide">{label}</label>
                    <input
                      type={type}
                      required={required}
                      value={form[key as keyof QuickEnquiryForm]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      data-testid={`input-start-${id}`}
                      className="w-full bg-white/5 border border-white/10 text-white px-4 py-2.5 text-sm outline-none focus:border-white/20 placeholder:text-white/20"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wide">Message</label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us about your project..."
                    data-testid="input-start-message"
                    className="w-full bg-white/5 border border-white/10 text-white px-4 py-2.5 text-sm outline-none focus:border-white/20 placeholder:text-white/20 resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={enquiryMutation.isPending || !form.name || !form.email}
                  data-testid="button-start-submit"
                  className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none"
                >
                  {enquiryMutation.isPending ? "Sending..." : "Send Message"}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────────── */}
      <section className="py-8 px-6 bg-[hsl(220,18%,8%)] border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-8 text-xs text-white/25">
          {["24hr Response Guarantee", "National Delivery & Installation", "Commercial-Grade Only", "7.5% Partner Commission"].map(item => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
