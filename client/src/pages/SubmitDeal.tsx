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
import { ArrowRight, CheckCircle2, Clock, Shield, Zap } from "lucide-react";
import { Link } from "wouter";

const submitSchema = z.object({
  companyName: z.string().min(2, "Company name required"),
  contactName: z.string().min(2, "Contact name required"),
  contactEmail: z.string().email("Valid email required"),
  contactPhone: z.string().min(8, "Phone required"),
  officeLocation: z.string().min(2, "Office location required"),
  officeSizeSqm: z.string().optional(),
  staffCount: z.string().optional(),
  projectType: z.string().min(1, "Project type required"),
  projectStage: z.string().min(1, "Project stage required"),
  estimatedValue: z.string().optional(),
  sourceNotes: z.string().optional(),
  partnerName: z.string().optional(),
  partnerEmail: z.string().optional(),
});

type SubmitForm = z.infer<typeof submitSchema>;

const PROJECT_TYPES = [
  "Office Relocation",
  "New Office Setup",
  "Office Expansion",
  "Fitout / Refurbishment",
  "Workspace Refresh / Upgrade",
  "New Lease — Furniture Supply",
  "Other",
];

const PROJECT_STAGES = [
  "Early — Just exploring",
  "Signed lease / committed",
  "Active planning",
  "Ready to quote",
  "Urgent — needs solution now",
  "Already won — handover needed",
];

const REASSURANCES = [
  { icon: Zap, text: "Same-day response to all referrals" },
  { icon: Shield, text: "Your client relationships are protected" },
  { icon: Clock, text: "Fast quotes, full layout support included" },
];

export default function SubmitDeal() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [referralId, setReferralId] = useState<string | null>(null);

  const form = useForm<SubmitForm>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      companyName: "", contactName: "", contactEmail: "", contactPhone: "",
      officeLocation: "", officeSizeSqm: "", staffCount: "",
      projectType: "", projectStage: "", estimatedValue: "", sourceNotes: "",
      partnerName: "", partnerEmail: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: SubmitForm) => apiRequest("POST", "/api/partners/referrals", {
      ...data,
      estimatedValue: data.estimatedValue ? parseInt(data.estimatedValue.replace(/\D/g, ""), 10) || null : null,
    }),
    onSuccess: async (response: any) => {
      const data = await response.json();
      setReferralId(data?.referral?.id || null);
      setSubmitted(true);
      toast({ title: "Opportunity submitted", description: "Our team will reach out within 4 business hours." });
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Please try again or email us directly.", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-16 px-6 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(43,78%,52%)]/30 bg-[hsl(43,78%,52%)]/5 text-[hsl(43,78%,52%)] text-xs font-medium tracking-wide uppercase mb-8">
            Submit a Deal
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-4 leading-tight">
            Refer a Workspace Opportunity
          </h1>
          <p className="text-lg text-white/50 leading-relaxed mb-8">
            Have a client considering a relocation, new lease, or workspace upgrade?
            Submit the details below. We'll handle everything and you earn 7.5% when the deal closes.
          </p>
          <div className="flex flex-wrap gap-6">
            {REASSURANCES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-white/50 text-sm">
                <Icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          {submitted ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-12 h-12 text-[hsl(43,78%,52%)] mx-auto mb-4" />
              <h2 className="text-2xl font-light text-white mb-3">Opportunity Received</h2>
              {referralId && (
                <p className="text-white/30 text-xs mb-3 font-mono">Ref: {referralId.slice(0, 8).toUpperCase()}</p>
              )}
              <p className="text-white/50 mb-3 max-w-md mx-auto leading-relaxed">
                Thank you. Our team will review this opportunity and reach out to your client within 4 business hours.
                You'll receive a confirmation to your email.
              </p>
              <p className="text-white/30 text-sm mb-10">
                Questions? Call Ben Mumford on <a href="tel:0408407166" className="text-[hsl(43,78%,52%)]">0408 407 166</a> or email <a href="mailto:sales@thecorporatedesk.com.au" className="text-[hsl(43,78%,52%)]">sales@thecorporatedesk.com.au</a>
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => { setSubmitted(false); form.reset(); }} variant="outline" className="border-white/20 text-white hover:bg-white/5 rounded-none">
                  Submit Another
                </Button>
                <Link href="/partners">
                  <Button variant="ghost" className="text-[hsl(43,78%,52%)] hover:text-[hsl(43,78%,45%)] hover:bg-transparent">
                    Become a Formal Partner
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(v => submitMutation.mutate(v))} className="space-y-8">

              {/* ── Client Details ─────────────────────────────────────── */}
              <div>
                <h2 className="text-lg font-medium text-white mb-5 pb-3 border-b border-white/8">
                  Client Details
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Company Name *</label>
                    <Input {...form.register("companyName")} data-testid="input-deal-company" placeholder="e.g. Acme Consulting Pty Ltd" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.companyName && <p className="text-red-400 text-xs mt-1">{form.formState.errors.companyName.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Primary Contact Name *</label>
                    <Input {...form.register("contactName")} data-testid="input-deal-contact-name" placeholder="Full name" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.contactName && <p className="text-red-400 text-xs mt-1">{form.formState.errors.contactName.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Contact Email *</label>
                    <Input {...form.register("contactEmail")} type="email" autoComplete="email" data-testid="input-deal-contact-email" placeholder="client@company.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.contactEmail && <p className="text-red-400 text-xs mt-1">{form.formState.errors.contactEmail.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Contact Phone *</label>
                    <Input {...form.register("contactPhone")} type="tel" autoComplete="tel" data-testid="input-deal-contact-phone" placeholder="04XX XXX XXX" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.contactPhone && <p className="text-red-400 text-xs mt-1">{form.formState.errors.contactPhone.message}</p>}
                  </div>
                </div>
              </div>

              {/* ── Project Details ────────────────────────────────────── */}
              <div>
                <h2 className="text-lg font-medium text-white mb-5 pb-3 border-b border-white/8">
                  Project Details
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Office Location / City *</label>
                    <Input {...form.register("officeLocation")} data-testid="input-deal-location" placeholder="e.g. Brisbane CBD, QLD" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                    {form.formState.errors.officeLocation && <p className="text-red-400 text-xs mt-1">{form.formState.errors.officeLocation.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Office Size (sqm)</label>
                    <Input {...form.register("officeSizeSqm")} data-testid="input-deal-sqm" placeholder="e.g. 400" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Staff Count</label>
                    <Input {...form.register("staffCount")} data-testid="input-deal-staff" placeholder="e.g. 35" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Project Type *</label>
                    <select {...form.register("projectType")} data-testid="select-deal-project-type" className="w-full bg-white/5 border border-white/10 text-white rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20">
                      <option value="" className="bg-zinc-900">Select type</option>
                      {PROJECT_TYPES.map(t => (
                        <option key={t} value={t} className="bg-zinc-900">{t}</option>
                      ))}
                    </select>
                    {form.formState.errors.projectType && <p className="text-red-400 text-xs mt-1">{form.formState.errors.projectType.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Project Stage *</label>
                    <select {...form.register("projectStage")} data-testid="select-deal-project-stage" className="w-full bg-white/5 border border-white/10 text-white rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20">
                      <option value="" className="bg-zinc-900">Select stage</option>
                      {PROJECT_STAGES.map(s => (
                        <option key={s} value={s} className="bg-zinc-900">{s}</option>
                      ))}
                    </select>
                    {form.formState.errors.projectStage && <p className="text-red-400 text-xs mt-1">{form.formState.errors.projectStage.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Estimated Project Value</label>
                    <Input {...form.register("estimatedValue")} data-testid="input-deal-value" placeholder="e.g. $80,000" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Notes / Context</label>
                    <Textarea {...form.register("sourceNotes")} data-testid="textarea-deal-notes" placeholder="Any additional context — timeline urgency, special requirements, existing relationships, floor plan available, etc." className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none resize-none h-28" />
                  </div>
                </div>
              </div>

              {/* ── Partner Details ────────────────────────────────────── */}
              <div>
                <h2 className="text-lg font-medium text-white mb-5 pb-3 border-b border-white/8">
                  Your Details (Referring Partner)
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Your Name</label>
                    <Input {...form.register("partnerName")} data-testid="input-deal-partner-name" placeholder="Your full name" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Your Email</label>
                    <Input {...form.register("partnerEmail")} type="email" autoComplete="email" data-testid="input-deal-partner-email" placeholder="your@email.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-none" />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={submitMutation.isPending} data-testid="button-submit-deal" className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold py-4 h-auto rounded-none text-base">
                {submitMutation.isPending ? "Submitting..." : "Submit Opportunity"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>

              <p className="text-white/20 text-xs text-center leading-relaxed">
                By submitting, you confirm you have permission to share this opportunity. Commission of 7.5% is paid on verified, invoice-confirmed deals only.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
