import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, CheckCircle2, DollarSign, Building2, Users, Briefcase,
  TrendingUp, Shield, Clock, Star, ChevronRight, Handshake,
} from "lucide-react";
import { Link } from "wouter";

const applySchema = z.object({
  contactName: z.string().min(2, "Full name required"),
  companyName: z.string().min(2, "Company required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(8, "Phone required"),
  city: z.string().min(2, "City required"),
  state: z.string().min(2, "State required"),
  partnerType: z.string().min(1, "Please select your partner type"),
  bio: z.string().optional(),
  hasLiveOpportunity: z.boolean().optional(),
});

type ApplyForm = z.infer<typeof applySchema>;

const PARTNER_TYPES = [
  "Commercial Real Estate Agent",
  "Tenant Representative",
  "Commercial Broker",
  "Architect",
  "Interior Designer",
  "Fitout Contractor",
  "Workplace Consultant",
  "Project Manager",
  "Builder",
  "Other Commercial Introducer",
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Introduce the Opportunity",
    desc: "Submit a client or project through our partner portal. Give us the essentials — company, size, timeline, location.",
  },
  {
    step: "02",
    title: "We Handle the Solution",
    desc: "Our team delivers the full workspace solution: furniture supply, layout planning, turnkey fitout coordination, and national delivery.",
  },
  {
    step: "03",
    title: "You Earn 7.5%",
    desc: "When the project is approved and the client pays, you earn 7.5% of the verified deal value. Tracked transparently in your partner portal.",
  },
];

const WHY_PARTNER = [
  { icon: Clock, title: "Fast Response", desc: "Same-business-day response to partner referrals. Your clients feel the professionalism." },
  { icon: TrendingUp, title: "Layout & Quote Support", desc: "We provide full layout planning and detailed quotes — at no cost to you or your client." },
  { icon: Star, title: "Premium Brand Positioning", desc: "Align with one of Australia's most respected commercial workspace brands." },
  { icon: Building2, title: "National Reach", desc: "We deliver across all major Australian markets — Brisbane, Sydney, Melbourne, Perth, Adelaide." },
  { icon: Shield, title: "High-Trust Handling", desc: "Your client relationships are treated with professionalism and confidentiality." },
  { icon: DollarSign, title: "Transparent Commission", desc: "Track your referrals and commission in real time through your partner dashboard." },
];

const IDEAL_REFERRALS = [
  "Office relocations", "New lease fit-outs", "Office expansions",
  "Workspace upgrades", "New office setups", "Refresh projects",
];

export default function Partners() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ApplyForm>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      contactName: "", companyName: "", email: "", phone: "",
      city: "", state: "", partnerType: "", bio: "", hasLiveOpportunity: false,
    },
  });

  const applyMutation = useMutation({
    mutationFn: (data: ApplyForm) => apiRequest("POST", "/api/partners/apply", data),
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Application received", description: "We'll be in touch within 1 business day." });
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Please try again or email us directly.", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 px-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(43,78%,52%)]/30 bg-[hsl(43,78%,52%)]/5 text-[hsl(43,78%,52%)] text-xs font-medium tracking-wide uppercase mb-8">
            <Handshake className="w-3.5 h-3.5" />
            Partner Network
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight text-white mb-6 leading-none">
            Earn 7.5% on Qualified
            <br />
            <span className="text-[hsl(43,78%,52%)]">Workspace Projects</span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Partner with The Corporate Desk to support office relocations, fit-outs, expansions,
            and workspace activations across Australia. Introduce the opportunity — we do the rest.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#apply" data-testid="link-become-partner">
              <Button className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold px-8 py-3 text-base h-auto rounded-none">
                Become a Partner
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
            <Link href="/submit-deal" data-testid="link-submit-live-deal">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 px-8 py-3 text-base h-auto rounded-none">
                Submit a Live Deal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Proof Strip ────────────────────────────────────────────────────── */}
      <section className="py-5 border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-white/40 text-sm tracking-wide">
            {["Fast Quotes", "Layout Support", "Turnkey Delivery", "National Capability", "7.5% Commission"].map(p => (
              <span key={p} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[hsl(43,78%,52%)]" />
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who This Is For ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-light text-white mb-2">Who This Is For</h2>
          <p className="text-white/40 mb-10">Commercial professionals who work with companies making workspace decisions.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ["Commercial Real Estate Agents", Users],
              ["Tenant Representatives", Briefcase],
              ["Commercial Brokers", Building2],
              ["Architects & Designers", Star],
              ["Fitout Professionals", Building2],
              ["Workplace Consultants", TrendingUp],
            ].map(([label, Icon]: any) => (
              <div key={label} className="flex items-center gap-3 p-4 border border-white/8 bg-white/[0.02] hover:bg-white/5 transition-colors">
                <Icon className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                <span className="text-sm text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-b border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-light text-white mb-2">How It Works</h2>
          <p className="text-white/40 mb-12">Three steps from introduction to commission.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="relative">
                <div className="text-5xl font-light text-white/8 mb-4">{step}</div>
                <h3 className="text-lg font-medium text-white mb-3">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ideal Referrals ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-light text-white mb-2">Ideal Referral Types</h2>
          <p className="text-white/40 mb-10">We specialise in commercial workspace projects with real budget and timeline.</p>
          <div className="flex flex-wrap gap-3">
            {IDEAL_REFERRALS.map(ref => (
              <span key={ref} className="px-4 py-2 border border-white/10 text-white/60 text-sm">
                {ref}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Partner With Us ────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-b border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-light text-white mb-2">Why Partner With Us</h2>
          <p className="text-white/40 mb-12">The tools, support, and trust you need to refer confidently.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_PARTNER.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 border border-white/8 bg-white/[0.02] hover:bg-white/5 transition-colors">
                <Icon className="w-5 h-5 text-[hsl(43,78%,52%)] mb-4" />
                <h3 className="font-medium text-white mb-2">{title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Payout Policy ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-2">
              <h2 className="text-3xl font-light text-white mb-4">Payout Policy</h2>
              <p className="text-white/50 leading-relaxed mb-6">
                We operate a flat 7.5% commission structure across all approved, paid deals.
                Commission is paid within 30 days of verified client payment — tracked transparently
                in your partner dashboard from day one.
              </p>
              <ul className="space-y-3">
                {["Flat 7.5% across all project types", "Paid on verified, invoice-confirmed deals", "Transparent tracking in your partner dashboard", "No cap on annual earnings"].map(p => (
                  <li key={p} className="flex items-center gap-3 text-white/60 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[hsl(43,78%,52%)]/5 border border-[hsl(43,78%,52%)]/20 p-6">
              <div className="text-4xl font-light text-[hsl(43,78%,52%)] mb-1">7.5%</div>
              <div className="text-white/40 text-sm mb-4">flat commission rate</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">$50k project</span>
                  <span className="text-white font-medium">$3,750</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">$100k project</span>
                  <span className="text-white font-medium">$7,500</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">$250k project</span>
                  <span className="text-white font-medium">$18,750</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Application Form ───────────────────────────────────────────────── */}
      <section id="apply" className="py-20 px-6 bg-white/[0.015]">
        <div className="max-w-2xl mx-auto">
          {submitted ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-12 h-12 text-[hsl(43,78%,52%)] mx-auto mb-4" />
              <h2 className="text-2xl font-light text-white mb-3">Application Received</h2>
              <p className="text-white/50 mb-8">
                Thank you for your interest. Our partnership team will be in touch within 1 business day.
              </p>
              <Link href="/submit-deal">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 rounded-none">
                  Submit a Live Opportunity Instead
                  <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-light text-white mb-2">Partner Application</h2>
              <p className="text-white/40 mb-10">Apply to become a Corporate Desk referral partner. Takes under 2 minutes.</p>

              <form onSubmit={form.handleSubmit(v => applyMutation.mutate(v))} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Full Name</label>
                    <Input {...form.register("contactName")} data-testid="input-partner-name" placeholder="Your full name" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.contactName && <p className="text-red-400 text-xs mt-1">{form.formState.errors.contactName.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Company</label>
                    <Input {...form.register("companyName")} data-testid="input-partner-company" placeholder="Company name" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.companyName && <p className="text-red-400 text-xs mt-1">{form.formState.errors.companyName.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Email</label>
                    <Input {...form.register("email")} type="email" autoComplete="email" data-testid="input-partner-email" placeholder="work@company.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.email && <p className="text-red-400 text-xs mt-1">{form.formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Phone</label>
                    <Input {...form.register("phone")} type="tel" autoComplete="tel" data-testid="input-partner-phone" placeholder="04XX XXX XXX" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.phone && <p className="text-red-400 text-xs mt-1">{form.formState.errors.phone.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">City</label>
                    <Input {...form.register("city")} data-testid="input-partner-city" placeholder="Brisbane" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.city && <p className="text-red-400 text-xs mt-1">{form.formState.errors.city.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">State</label>
                    <select {...form.register("state")} data-testid="select-partner-state" className="w-full bg-white/5 border border-white/10 text-white rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20">
                      <option value="" className="bg-zinc-900">Select state</option>
                      {["QLD", "NSW", "VIC", "WA", "SA", "TAS", "ACT", "NT"].map(s => (
                        <option key={s} value={s} className="bg-zinc-900">{s}</option>
                      ))}
                    </select>
                    {form.formState.errors.state && <p className="text-red-400 text-xs mt-1">{form.formState.errors.state.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Your Role / Partner Type</label>
                  <select {...form.register("partnerType")} data-testid="select-partner-type" className="w-full bg-white/5 border border-white/10 text-white rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20">
                    <option value="" className="bg-zinc-900">Select your type</option>
                    {PARTNER_TYPES.map(t => (
                      <option key={t} value={t} className="bg-zinc-900">{t}</option>
                    ))}
                  </select>
                  {form.formState.errors.partnerType && <p className="text-red-400 text-xs mt-1">{form.formState.errors.partnerType.message}</p>}
                </div>

                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">About You (Optional)</label>
                  <Textarea {...form.register("bio")} data-testid="textarea-partner-bio" placeholder="Briefly describe your client base and how you typically identify workspace opportunities" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none resize-none h-24" />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" {...form.register("hasLiveOpportunity")} data-testid="checkbox-live-opportunity" className="mt-1 accent-[hsl(43,78%,52%)]" />
                  <span className="text-sm text-white/50">I have a live opportunity I'd like to submit immediately</span>
                </label>

                <Button type="submit" disabled={applyMutation.isPending} data-testid="button-partner-apply" className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold py-3 h-auto rounded-none text-base">
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-white/30 text-sm mb-3">Already have a deal to refer?</p>
                <Link href="/submit-deal">
                  <Button variant="ghost" className="text-[hsl(43,78%,52%)] hover:text-[hsl(43,78%,45%)] hover:bg-transparent text-sm">
                    Submit a Live Deal Instead <ChevronRight className="ml-1 w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
