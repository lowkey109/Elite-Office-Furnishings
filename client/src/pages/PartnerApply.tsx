import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, ArrowRight, ArrowLeft, FileText, Loader2,
  Building2, User, Mail, Phone, MapPin, Briefcase, Shield,
} from "lucide-react";

const PARTNER_TYPES = [
  { value: "broker", label: "Property Broker", desc: "Commercial real estate agents & tenant advisors" },
  { value: "tenant_rep", label: "Tenant Rep", desc: "Tenant representative advisors" },
  { value: "architect", label: "Architect", desc: "Licensed architects and design firms" },
  { value: "designer", label: "Interior Designer", desc: "Workplace & interior design consultants" },
  { value: "builder", label: "Builder / Fitout", desc: "Commercial construction & fitout contractors" },
  { value: "mover", label: "Office Mover", desc: "Commercial removalists & storage firms" },
  { value: "finance_partner", label: "Finance Partner", desc: "Equipment finance & leasing specialists" },
  { value: "technology_partner", label: "Technology Partner", desc: "AV, IT & workplace technology firms" },
];

const AU_STATES: Record<string, string> = {
  QLD: "Queensland", NSW: "New South Wales", VIC: "Victoria",
  WA: "Western Australia", SA: "South Australia", TAS: "Tasmania",
  ACT: "ACT", NT: "Northern Territory",
};

type FormState = {
  partnerType: string;
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  abn: string;
  city: string;
  state: string;
  bio: string;
};

const EMPTY: FormState = {
  partnerType: "", contactName: "", companyName: "", email: "",
  phone: "", abn: "", city: "", state: "", bio: "",
};

export default function PartnerApply() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [agreementText, setAgreementText] = useState("");
  const [templateVersion, setTemplateVersion] = useState("v1");
  const [agreed, setAgreed] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [activated, setActivated] = useState<{ contactName: string; companyName: string; email: string } | null>(null);

  const set = (field: keyof FormState, val: string) =>
    setForm(f => ({ ...f, [field]: val }));

  // Step 0 → 1: Submit application
  const applyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/partners/apply", {
      partnerType: form.partnerType,
      contactName: form.contactName.trim(),
      companyName: form.companyName.trim(),
      email: form.email.trim(),
      phone: form.phone || undefined,
      abn: form.abn || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      bio: form.bio || undefined,
    }),
    onSuccess: async (res: any) => {
      const body = await res.json();
      if (body.error === "already_signed") {
        toast({ title: "Account already active", description: "You already have an active partner account. Please sign in.", variant: "destructive" });
        navigate("/partner-dashboard");
        return;
      }
      setPartnerId(body.partnerId);
      setAgreementText(body.agreementText);
      setTemplateVersion(body.templateVersion);
      if (body.resuming) {
        toast({ title: "Resuming your application", description: "Complete your agreement to activate your account." });
      }
      setStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: () => toast({ title: "Submission failed", description: "Please check your details and try again.", variant: "destructive" }),
  });

  // Step 1 → 2: Sign & activate
  const signMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/partners/apply/${partnerId}/sign`, { signedByName: signedName.trim() }),
    onSuccess: async (res: any) => {
      const body = await res.json();
      setActivated({ contactName: body.partner.contactName, companyName: body.partner.companyName, email: body.partner.email });
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: () => toast({ title: "Signing failed", description: "Please try again.", variant: "destructive" }),
  });

  const canApply = !!(form.partnerType && form.contactName.trim().length >= 2 && form.companyName.trim().length >= 2 && form.email.includes("@"));
  const canSign = agreed && signedName.trim().length >= 2;

  // ── Step 2: Activated ────────────────────────────────────────────────────
  if (step === 2 && activated) {
    return (
      <PageShell>
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 border border-emerald-500/25 bg-emerald-500/8 mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-medium tracking-wide uppercase mb-5">
            Account Activated
          </div>
          <h1 className="text-3xl font-light text-white mb-3">
            Welcome, {activated.contactName}
          </h1>
          <p className="text-white/55 leading-relaxed mb-2">
            You're live in the Corporate Desk Partner Network. Your account is fully active — start submitting referrals right now.
          </p>
          <p className="text-white/30 text-sm mb-8">
            A confirmation has been sent to <span className="text-white/50">{activated.email}</span>
          </p>

          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { label: "Commission", value: "7.5%" },
              { label: "Payment", value: "30 days" },
              { label: "Account", value: "Active" },
            ].map(({ label, value }) => (
              <div key={label} className="p-4 border border-white/8 bg-white/[0.02]">
                <div className="text-xs text-white/35 mb-1">{label}</div>
                <div className="text-base font-medium text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Button
              asChild
              className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold py-3 h-auto rounded-none"
              data-testid="button-go-to-dashboard"
            >
              <Link href="/partner-dashboard">
                Go to Partner Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full border-white/15 text-white/60 hover:bg-white/5 hover:text-white py-3 h-auto rounded-none"
              data-testid="button-submit-deal"
            >
              <Link href="/submit-deal">Submit Your First Deal</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Step 1: Agreement ────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <PageShell step={1} totalSteps={2}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[hsl(43,78%,52%)]/25 bg-[hsl(43,78%,52%)]/5 text-[hsl(43,78%,52%)] text-xs font-medium tracking-wide uppercase mb-5">
              Step 2 of 2 — Partner Agreement
            </div>
            <h1 className="text-2xl font-light text-white mb-2">Review &amp; Sign Your Agreement</h1>
            <p className="text-white/45 text-sm">
              Read the Partner Referral Agreement below. Once signed, your account activates immediately.
            </p>
          </div>

          {/* Key terms */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Commission Rate", value: "7.5% per deal" },
              { label: "Payment Terms", value: "30 days after payment" },
              { label: "Arrangement", value: "Referral / Introducer" },
            ].map(({ label, value }) => (
              <div key={label} className="p-4 border border-white/8 bg-white/[0.02]">
                <div className="text-xs text-white/35 mb-1">{label}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>

          {/* Agreement text */}
          <div className="border border-white/8 bg-white/[0.015] mb-8">
            <div className="border-b border-white/8 px-5 py-3.5 flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-white/30" />
              <span className="text-xs text-white/50">Partner Referral Agreement — Version {templateVersion}</span>
            </div>
            <div className="px-5 py-5 max-h-[420px] overflow-y-auto">
              <pre className="text-xs text-white/55 whitespace-pre-wrap leading-relaxed font-mono" data-testid="text-agreement-body">
                {agreementText}
              </pre>
            </div>
          </div>

          {/* Signing */}
          <div className="border border-white/10 bg-white/[0.02] p-6 mb-6">
            <h2 className="text-sm font-medium text-white mb-5">Digital Signature</h2>
            <div className="space-y-5">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  data-testid="checkbox-agree"
                  className="mt-0.5 w-4 h-4 accent-[hsl(43,78%,52%)] cursor-pointer"
                />
                <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors leading-relaxed">
                  I have read and agree to be bound by the Partner Referral Agreement between{" "}
                  <strong className="text-white/80">{form.companyName}</strong> and The Corporate Desk Pty Ltd.
                </span>
              </label>

              <div>
                <label className="block text-xs text-white/35 uppercase tracking-wide mb-2">
                  Full Legal Name (Digital Signature)
                </label>
                <input
                  type="text"
                  value={signedName}
                  onChange={e => setSignedName(e.target.value)}
                  data-testid="input-signed-name"
                  placeholder={form.contactName || "Your full legal name"}
                  className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
                />
                <p className="text-white/25 text-xs mt-1.5">
                  Entering your name constitutes a legally binding digital signature.
                </p>
              </div>

              <Button
                onClick={() => signMutation.mutate()}
                disabled={!canSign || signMutation.isPending}
                data-testid="button-sign-activate"
                className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold py-3 h-auto rounded-none disabled:opacity-30 text-sm"
              >
                {signMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Activating Account...</>
                ) : (
                  <>Sign &amp; Activate Account <ArrowRight className="ml-2 w-4 h-4" /></>
                )}
              </Button>
            </div>
          </div>

          <button
            onClick={() => setStep(0)}
            className="flex items-center gap-2 text-white/30 hover:text-white/60 text-sm transition-colors"
            data-testid="button-back-to-form"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to application
          </button>
        </div>
      </PageShell>
    );
  }

  // ── Step 0: Application Form ─────────────────────────────────────────────
  return (
    <PageShell step={0} totalSteps={2}>
      <div className="max-w-2xl mx-auto">

        {/* Intro */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[hsl(43,78%,52%)]/25 bg-[hsl(43,78%,52%)]/5 text-[hsl(43,78%,52%)] text-xs font-medium tracking-wide uppercase mb-5">
            Partner Network
          </div>
          <h1 className="text-3xl font-light text-white mb-3">Join the Partner Network</h1>
          <p className="text-white/50 leading-relaxed">
            Earn 7.5% commission on every client you introduce. Complete your application below — you'll sign your agreement in the next step and be live within minutes.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { icon: Shield, label: "7.5% commission", sub: "Per verified deal" },
            { icon: ArrowRight, label: "Instant activation", sub: "No waiting period" },
            { icon: CheckCircle2, label: "Real-time tracking", sub: "Dashboard + pipeline" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="p-4 border border-white/8 bg-white/[0.02]">
              <Icon className="w-4 h-4 text-[hsl(43,78%,52%)] mb-2" />
              <div className="text-sm font-medium text-white leading-tight">{label}</div>
              <div className="text-xs text-white/35 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Partner type selection */}
        <div className="mb-8">
          <label className="block text-xs text-white/40 uppercase tracking-wide mb-4">
            What best describes your business? <span className="text-[hsl(43,78%,52%)]">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PARTNER_TYPES.map(pt => (
              <button
                key={pt.value}
                type="button"
                onClick={() => set("partnerType", pt.value)}
                data-testid={`button-type-${pt.value}`}
                className={`text-left p-4 border transition-colors ${
                  form.partnerType === pt.value
                    ? "border-[hsl(43,78%,52%)]/40 bg-[hsl(43,78%,52%)]/6"
                    : "border-white/8 bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.025]"
                }`}
              >
                <div className={`text-sm font-medium mb-0.5 ${form.partnerType === pt.value ? "text-[hsl(43,78%,52%)]" : "text-white"}`}>
                  {pt.label}
                </div>
                <div className="text-xs text-white/35 leading-snug">{pt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact details */}
        <div className="space-y-4 mb-8">
          <div className="text-xs text-white/40 uppercase tracking-wide mb-2">Your Details</div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/35 mb-1.5">
                Full Name <span className="text-[hsl(43,78%,52%)]">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={form.contactName}
                  onChange={e => set("contactName", e.target.value)}
                  data-testid="input-contact-name"
                  placeholder="Jane Smith"
                  className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/35 mb-1.5">
                Company Name <span className="text-[hsl(43,78%,52%)]">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={form.companyName}
                  onChange={e => set("companyName", e.target.value)}
                  data-testid="input-company-name"
                  placeholder="Acme Advisors Pty Ltd"
                  className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/35 mb-1.5">
                Email Address <span className="text-[hsl(43,78%,52%)]">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  data-testid="input-email"
                  placeholder="jane@acme.com.au"
                  className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/35 mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  data-testid="input-phone"
                  placeholder="0400 000 000"
                  className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-white/35 mb-1.5">ABN <span className="text-white/20 font-normal">(optional)</span></label>
              <input
                type="text"
                value={form.abn}
                onChange={e => set("abn", e.target.value)}
                data-testid="input-abn"
                placeholder="12 345 678 901"
                className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/35 mb-1.5">City</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={form.city}
                  onChange={e => set("city", e.target.value)}
                  data-testid="input-city"
                  placeholder="Brisbane"
                  className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/35 mb-1.5">State</label>
              <select
                value={form.state}
                onChange={e => set("state", e.target.value)}
                data-testid="select-state"
                className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-white/25 appearance-none"
              >
                <option value="" className="bg-[#1a1a1a]">Select state</option>
                {Object.entries(AU_STATES).map(([code, name]) => (
                  <option key={code} value={code} className="bg-[#1a1a1a]">{code} — {name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/35 mb-1.5">
              Brief Introduction <span className="text-white/20 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.bio}
              onChange={e => set("bio", e.target.value)}
              data-testid="textarea-bio"
              placeholder="Tell us about your business and the types of clients you work with..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20 resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={() => applyMutation.mutate()}
          disabled={!canApply || applyMutation.isPending}
          data-testid="button-submit-application"
          className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold py-4 h-auto rounded-none text-sm disabled:opacity-30"
        >
          {applyMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</>
          ) : (
            <>Continue to Agreement <ArrowRight className="ml-2 w-4 h-4" /></>
          )}
        </Button>

        {!canApply && (
          <p className="text-white/25 text-xs text-center mt-3">
            Select your partner type and fill in name, company, and email to continue.
          </p>
        )}

        <div className="mt-8 pt-6 border-t border-white/6 flex items-center justify-between text-xs text-white/25">
          <span>Already a partner?</span>
          <Link href="/partner-dashboard" className="text-[hsl(43,78%,52%)] hover:underline">
            Sign in to your dashboard
          </Link>
        </div>

      </div>
    </PageShell>
  );
}

function PageShell({ children, step, totalSteps }: { children: React.ReactNode; step?: number; totalSteps?: number }) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div className="border-b border-white/8 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex flex-col cursor-pointer">
            <span className="text-sm font-serif font-bold text-white leading-tight">THE CORPORATE</span>
            <span className="text-[9px] font-serif tracking-[0.3em] text-[hsl(43,78%,52%)] uppercase">DESK</span>
          </Link>
          {step !== undefined && totalSteps !== undefined && (
            <div className="flex items-center gap-3">
              {Array.from({ length: totalSteps + 1 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium border ${
                    i < step
                      ? "bg-[hsl(43,78%,52%)] border-[hsl(43,78%,52%)] text-black"
                      : i === step
                      ? "border-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]"
                      : "border-white/15 text-white/25"
                  }`}>
                    {i < step ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                  </div>
                  {i < totalSteps && (
                    <div className={`w-10 h-px ${i < step ? "bg-[hsl(43,78%,52%)]" : "bg-white/10"}`} />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Briefcase className="w-3.5 h-3.5" />
            Partner Network
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {children}
      </div>

      {/* Footer */}
      <div className="border-t border-white/6 py-8">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs text-white/20">
            Questions? Contact us at{" "}
            <a href="mailto:service@thecorporatedesk.com.au" className="text-[hsl(43,78%,52%)] hover:underline">
              service@thecorporatedesk.com.au
            </a>
            {" "}· 1300 977 607
          </p>
        </div>
      </div>
    </div>
  );
}
