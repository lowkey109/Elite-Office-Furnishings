import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Handshake, ArrowLeft, ArrowRight, CheckCircle, Building2, Users,
  Globe, MapPin, Briefcase, Award, ChevronDown, Sparkles,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PARTNER_TYPES = [
  { value: "broker", label: "Property Broker", desc: "Commercial real estate agents and tenant advisors" },
  { value: "tenant_rep", label: "Tenant Rep", desc: "Tenant representative advisors" },
  { value: "architect", label: "Architect", desc: "Licensed architects and design firms" },
  { value: "designer", label: "Interior Designer", desc: "Interior design and workplace consultants" },
  { value: "builder", label: "Builder / Fitout", desc: "Commercial construction and fitout contractors" },
  { value: "furniture_supplier", label: "Furniture Supplier", desc: "Complementary furniture and accessories" },
  { value: "mover", label: "Office Mover", desc: "Commercial removalist and storage firms" },
  { value: "finance_partner", label: "Finance Partner", desc: "Equipment finance and leasing specialists" },
  { value: "technology_partner", label: "Technology Partner", desc: "AV, IT, and workplace technology firms" },
];
const AU_CITIES = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Darwin", "Hobart", "Newcastle", "Wollongong", "Geelong"];
const INDUSTRIES = ["Technology", "Finance", "Legal", "Healthcare", "Consulting", "Engineering", "Education", "Retail", "Government", "Media", "Construction", "Hospitality"];
const COMPANY_SIZES = ["1-10", "10-50", "50-200", "200+"];

type FormState = {
  partnerType: string; companyName: string; contactName: string; email: string;
  phone: string; website: string; city: string; state: string;
  serviceRegions: string[]; industrySpecialties: string[]; servicesOffered: string;
  companySize: string; bio: string; portfolioExamples: string;
};

const STEPS = ["Partner Type", "Company Profile", "Coverage & Specialties", "Portfolio", "Review"];

export default function PartnerOnboarding() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    partnerType: "", companyName: "", contactName: "", email: "", phone: "",
    website: "", city: "", state: "", serviceRegions: [], industrySpecialties: [],
    servicesOffered: "", companySize: "", bio: "", portfolioExamples: "",
  });
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/partners", {
      ...form,
      servicesOffered: form.servicesOffered ? form.servicesOffered.split(",").map(s => s.trim()) : [],
    }),
    onSuccess: () => setSubmitted(true),
    onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
  });

  const toggleRegion = (r: string) => setForm(f => ({ ...f, serviceRegions: f.serviceRegions.includes(r) ? f.serviceRegions.filter(x => x !== r) : [...f.serviceRegions, r] }));
  const toggleIndustry = (i: string) => setForm(f => ({ ...f, industrySpecialties: f.industrySpecialties.includes(i) ? f.industrySpecialties.filter(x => x !== i) : [...f.industrySpecialties, i] }));

  const canNext = () => {
    if (step === 0) return !!form.partnerType;
    if (step === 1) return !!(form.companyName && form.contactName && form.email);
    if (step === 2) return form.serviceRegions.length > 0;
    return true;
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">Application Received</h2>
          <p className="text-zinc-400 mb-2">Thank you for applying to join The Corporate Desk Partner Network.</p>
          <p className="text-zinc-500 text-sm mb-6">Our team will review your application and be in touch within 2 business days. Once approved, you'll gain access to your partner dashboard and start receiving qualified opportunities.</p>
          <div className="bg-zinc-800 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="text-zinc-400 text-sm"><span className="text-zinc-300 font-medium">Company:</span> {form.companyName}</div>
            <div className="text-zinc-400 text-sm"><span className="text-zinc-300 font-medium">Contact:</span> {form.contactName}</div>
            <div className="text-zinc-400 text-sm"><span className="text-zinc-300 font-medium">Email:</span> {form.email}</div>
            <div className="text-zinc-400 text-sm"><span className="text-zinc-300 font-medium">Partner Type:</span> {PARTNER_TYPES.find(p => p.value === form.partnerType)?.label}</div>
          </div>
          <Link href="/" className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-6 py-3 text-sm font-medium transition-colors">Return to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center"><Handshake className="w-4 h-4 text-blue-400" /></div>
            <span className="text-white font-semibold text-sm">Partner Network</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-500"}`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? "text-white" : "text-zinc-500"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-emerald-500/50" : "bg-zinc-800"}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {/* Step 0: Partner Type */}
          {step === 0 && (
            <div>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Join The Corporate Desk Partner Network</h1>
                <p className="text-zinc-400">Select your primary partner type to get started. We'll match you with relevant opportunities based on your specialisation.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PARTNER_TYPES.map(pt => (
                  <button key={pt.value} onClick={() => setForm(f => ({ ...f, partnerType: pt.value }))} className={`text-left p-4 rounded-xl border transition-all ${form.partnerType === pt.value ? "border-blue-500/60 bg-blue-500/10" : "border-zinc-800 bg-zinc-800/50 hover:border-zinc-700"}`} data-testid={`button-type-${pt.value}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${form.partnerType === pt.value ? "bg-blue-400" : "bg-zinc-600"}`} />
                      <span className={`font-medium text-sm ${form.partnerType === pt.value ? "text-white" : "text-zinc-300"}`}>{pt.label}</span>
                    </div>
                    <p className="text-zinc-500 text-xs pl-4">{pt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Company Profile */}
          {step === 1 && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-2">Company Profile</h2>
                <p className="text-zinc-400">Tell us about your company so we can make qualified introductions.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Company Name *</label>
                    <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Your company name" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" data-testid="input-company-name" />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Company Size</label>
                    <select value={form.companySize} onChange={e => setForm(f => ({ ...f, companySize: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none">
                      <option value="">Select size</option>
                      {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Contact Name *</label>
                    <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Your full name" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" data-testid="input-contact-name" />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Email Address *</label>
                    <input type="email" autoComplete="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@company.com" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" data-testid="input-email" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Phone</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+61 4xx xxx xxx" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Website</label>
                    <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://yourcompany.com.au" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Primary City</label>
                    <select value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none">
                      <option value="">Select city</option>
                      {AU_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">State</label>
                    <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none">
                      <option value="">Select state</option>
                      {["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Company Bio</label>
                  <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} placeholder="Brief overview of your company, expertise, and what makes you stand out..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500 resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Coverage & Specialties */}
          {step === 2 && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-2">Coverage & Specialties</h2>
                <p className="text-zinc-400">Select the cities you serve and industries you specialise in. We'll use this to match you with relevant opportunities.</p>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-zinc-300 text-sm font-medium mb-3 block">Service Regions * <span className="text-zinc-500 text-xs font-normal">Select all that apply</span></label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {AU_CITIES.map(city => (
                      <button key={city} onClick={() => toggleRegion(city)} className={`text-xs py-2 px-3 rounded-xl border transition-all ${form.serviceRegions.includes(city) ? "border-blue-500/60 bg-blue-500/10 text-blue-300" : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"}`} data-testid={`button-region-${city}`}>{city}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-zinc-300 text-sm font-medium mb-3 block">Industry Specialties <span className="text-zinc-500 text-xs font-normal">Optional</span></label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {INDUSTRIES.map(ind => (
                      <button key={ind} onClick={() => toggleIndustry(ind)} className={`text-xs py-2 px-3 rounded-xl border transition-all ${form.industrySpecialties.includes(ind) ? "border-violet-500/60 bg-violet-500/10 text-violet-300" : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"}`}>{ind}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Services Offered <span className="text-zinc-500">(comma-separated)</span></label>
                  <input value={form.servicesOffered} onChange={e => setForm(f => ({ ...f, servicesOffered: e.target.value }))} placeholder="e.g. Tenant advisory, lease negotiations, market analysis" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Portfolio */}
          {step === 3 && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-2">Portfolio & Track Record</h2>
                <p className="text-zinc-400">Share examples of your past work to help us match you with the right projects.</p>
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Portfolio Examples & Notable Projects</label>
                <textarea value={form.portfolioExamples} onChange={e => setForm(f => ({ ...f, portfolioExamples: e.target.value }))} rows={6} placeholder="Describe some of your recent projects, clients you've worked with, or key achievements. This helps us introduce you confidently to clients..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500 resize-none" data-testid="input-portfolio" />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-2">Review Your Application</h2>
                <p className="text-zinc-400">Please review your details before submitting. Our team will review your application within 2 business days.</p>
              </div>
              <div className="space-y-4">
                <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2"><Award className="w-4 h-4 text-blue-400" /><span className="text-white font-medium text-sm">Partner Type</span></div>
                  <div className="text-zinc-300 text-sm">{PARTNER_TYPES.find(p => p.value === form.partnerType)?.label}</div>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-blue-400" /><span className="text-white font-medium text-sm">Company Profile</span></div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="text-zinc-500">Company</div><div className="text-zinc-300">{form.companyName}</div>
                    <div className="text-zinc-500">Contact</div><div className="text-zinc-300">{form.contactName}</div>
                    <div className="text-zinc-500">Email</div><div className="text-zinc-300">{form.email}</div>
                    {form.city && <><div className="text-zinc-500">Location</div><div className="text-zinc-300">{form.city}{form.state ? `, ${form.state}` : ""}</div></>}
                    {form.companySize && <><div className="text-zinc-500">Size</div><div className="text-zinc-300">{form.companySize} employees</div></>}
                  </div>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-blue-400" /><span className="text-white font-medium text-sm">Coverage</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.serviceRegions.map(r => <span key={r} className="bg-blue-500/20 text-blue-300 rounded-lg px-2 py-0.5 text-xs">{r}</span>)}
                  </div>
                  {form.industrySpecialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.industrySpecialties.map(i => <span key={i} className="bg-violet-500/20 text-violet-300 rounded-lg px-2 py-0.5 text-xs">{i}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} className={`flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm ${step === 0 ? "invisible" : ""}`}>
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition-colors" data-testid="button-next-step">
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition-colors" data-testid="button-submit-application">
                {submitMutation.isPending ? <><Sparkles className="w-4 h-4 animate-spin" /> Submitting...</> : <><CheckCircle className="w-4 h-4" /> Submit Application</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
