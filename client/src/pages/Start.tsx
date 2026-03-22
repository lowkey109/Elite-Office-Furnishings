import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Building2, Handshake, Layers, ChevronLeft,
  CheckCircle2, Loader2,
} from "lucide-react";

function useSEO(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", description);
  }, [title, description]);
}

type Path = "workspace" | "relocation" | "partner" | null;

type FormData = {
  name: string;
  email: string;
  phone: string;
  company: string;
  location: string;
  teamSize: string;
  budget: string;
  message: string;
  timeline: string;
};

const PATHS = [
  {
    id: "workspace" as const,
    icon: Layers,
    label: "Workspace & Furniture",
    sub: "Quote, floor plan, layout, or product advice",
    color: "from-[hsl(43,78%,52%)]/10 to-transparent",
  },
  {
    id: "relocation" as const,
    icon: Building2,
    label: "Relocation & Office Setup",
    sub: "New office, full fitout, or full-service project",
    color: "from-blue-500/8 to-transparent",
  },
  {
    id: "partner" as const,
    icon: Handshake,
    label: "Refer a Client",
    sub: "Earn 7.5% commission on every deal you send us",
    color: "from-emerald-500/8 to-transparent",
    tag: "7.5% Commission",
  },
];

function PathCard({ path, onSelect }: { path: typeof PATHS[0]; onSelect: () => void }) {
  const Icon = path.icon;
  return (
    <button
      onClick={onSelect}
      data-testid={`card-start-${path.id}`}
      className="group relative w-full text-left p-8 border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[hsl(43,78%,52%)]/30 transition-all duration-200"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${path.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative">
        {path.tag && (
          <span className="inline-block text-[10px] px-2 py-0.5 bg-[hsl(43,78%,52%)]/10 text-[hsl(43,78%,65%)] border border-[hsl(43,78%,52%)]/20 tracking-wide mb-4">
            {path.tag}
          </span>
        )}
        <div className="flex items-start justify-between mb-5">
          <div className="w-10 h-10 border border-white/10 bg-white/[0.03] flex items-center justify-center group-hover:border-[hsl(43,78%,52%)]/30 transition-colors">
            <Icon className="w-4.5 h-4.5 text-white/40 group-hover:text-[hsl(43,78%,52%)] transition-colors" />
          </div>
          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[hsl(43,78%,52%)] group-hover:translate-x-0.5 transition-all" />
        </div>
        <h3 className="text-lg font-light text-white mb-2">{path.label}</h3>
        <p className="text-sm text-white/40">{path.sub}</p>
      </div>
    </button>
  );
}

function FormField({
  label, id, type = "text", value, onChange, required, placeholder, options,
}: {
  label: string; id: string; type?: string; value: string; onChange: (v: string) => void;
  required?: boolean; placeholder?: string; options?: string[];
}) {
  const base = "w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-[hsl(43,78%,52%)]/40 placeholder:text-white/20 transition-colors";
  return (
    <div>
      <label className="block text-xs text-white/40 mb-2 uppercase tracking-wide">
        {label}{required && " *"}
      </label>
      {options ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          data-testid={`input-start-${id}`}
          className={base + " appearance-none"}
        >
          <option value="" className="bg-zinc-900">Select...</option>
          {options.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={`input-start-${id}`}
          className={base}
        />
      )}
    </div>
  );
}

export default function Start() {
  useSEO(
    "Get Started | The Corporate Desk",
    "Tell us about your workspace project and we'll respond within 24 hours. Furniture, fitout, relocation, or partner referral — start here."
  );

  const [, setLocation] = useLocation();
  const [selectedPath, setSelectedPath] = useState<Path>(null);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState<FormData>({
    name: "", email: "", phone: "", company: "",
    location: "", teamSize: "", budget: "", message: "", timeline: "",
  });

  const set = (key: keyof FormData) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/enquiries", {
      name: form.name,
      email: form.email,
      phone: form.phone,
      message: [
        form.company && `Company: ${form.company}`,
        form.location && `Location: ${form.location}`,
        form.teamSize && `Team size: ${form.teamSize}`,
        form.budget && `Budget: ${form.budget}`,
        form.timeline && `Timeline: ${form.timeline}`,
        form.message && `Message: ${form.message}`,
      ].filter(Boolean).join(" · "),
      source: `start-page-${selectedPath}`,
    }),
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Enquiry received", description: "We'll be in touch within 24 hours." });
    },
    onError: () => {
      toast({ title: "Submission error", description: "Please try again or call 1300 977 607.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    if (selectedPath === "partner") {
      setLocation("/submit-deal");
      return;
    }
    mutation.mutate();
  };

  const pathMeta = PATHS.find(p => p.id === selectedPath);

  return (
    <Layout>
      <section
        className="relative min-h-screen flex flex-col"
        style={{ background: "hsl(220,20%,6%)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(201,168,76,0.04),transparent)]" />

        <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-32 pb-24">
          <div className="w-full max-w-3xl mx-auto">

            {/* ── Step indicator ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-12">
              {selectedPath && (
                <button
                  onClick={() => { setSelectedPath(null); setSubmitted(false); }}
                  className="p-1.5 text-white/30 hover:text-white/70 transition-colors"
                  data-testid="button-start-back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-2">
                {[1, 2].map(step => {
                  const active = step === (selectedPath ? 2 : 1);
                  const done = step < (selectedPath ? 2 : 1);
                  return (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
                        done ? "bg-[hsl(43,78%,52%)] text-black" :
                        active ? "border border-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]" :
                        "border border-white/15 text-white/25"
                      }`}>
                        {done ? <CheckCircle2 className="w-3 h-3" /> : step}
                      </div>
                      {step < 2 && <div className={`w-8 h-px ${selectedPath ? "bg-[hsl(43,78%,52%)]" : "bg-white/10"} transition-colors`} />}
                    </div>
                  );
                })}
                <span className="ml-3 text-xs text-white/30">
                  {selectedPath ? "Your details" : "How can we help?"}
                </span>
              </div>
            </div>

            {/* ── STEP 1: Path selection ───────────────────────────── */}
            {!selectedPath && (
              <div>
                <div className="mb-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] text-[hsl(43,78%,65%)] text-[10px] font-medium tracking-widest uppercase mb-5">
                    Get Started
                  </div>
                  <h1 className="text-4xl font-light text-white tracking-tight mb-4">
                    What brings you here?
                  </h1>
                  <p className="text-white/40 text-base">
                    Choose your path and we'll tailor the next step to your project.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {PATHS.map(path => (
                    <PathCard key={path.id} path={path} onSelect={() => setSelectedPath(path.id)} />
                  ))}
                </div>
                <p className="mt-8 text-xs text-white/25 text-center">
                  Not sure? Call us on{" "}
                  <a href="tel:1300977607" className="text-white/40 hover:text-white/70 transition-colors">
                    1300 977 607
                  </a>
                  {" "}— Mon–Fri 9am–5pm AEST
                </p>
              </div>
            )}

            {/* ── STEP 2: Form ──────────────────────────────────────── */}
            {selectedPath && !submitted && (
              <div>
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    {pathMeta && <pathMeta.icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />}
                    <span className="text-[hsl(43,78%,65%)] text-xs uppercase tracking-widest font-medium">
                      {pathMeta?.label}
                    </span>
                  </div>
                  <h2 className="text-3xl font-light text-white mb-3">
                    {selectedPath === "workspace" && "Tell us about your workspace project."}
                    {selectedPath === "relocation" && "Tell us about your relocation or fitout."}
                    {selectedPath === "partner" && "Refer a client — earn 7.5% commission."}
                  </h2>
                  <p className="text-white/40 text-sm">
                    {selectedPath === "partner"
                      ? "We'll redirect you to our secure referral form where you can submit full deal details and your commission tracking starts immediately."
                      : "We'll respond within 24 hours with a tailored proposal or next steps."}
                  </p>
                </div>

                {selectedPath === "partner" ? (
                  <div className="border border-[hsl(43,78%,52%)]/15 bg-[hsl(43,78%,52%)]/4 p-8">
                    <div className="flex items-start gap-4 mb-6">
                      <Handshake className="w-8 h-8 text-[hsl(43,78%,52%)] flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-medium text-white mb-2">Partner Referral Network</h3>
                        <p className="text-sm text-white/50 leading-relaxed">
                          Submit client referrals and earn a 7.5% flat commission on every deal we win.
                          You'll have a live dashboard to track referrals, statuses, and commission payments.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-6 text-sm text-white/40">
                      {["7.5% flat commission on deal value", "Live dashboard to track all your referrals", "No lock-in — refer as many or as few as you like", "Commission paid on deal close"].map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={() => setLocation("/submit-deal")}
                      data-testid="button-start-partner-cta"
                      className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none"
                    >
                      Submit a Referral
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-start-enquiry">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField label="Full Name" id="name" value={form.name} onChange={set("name")} required placeholder="Jane Smith" />
                      <FormField label="Email Address" id="email" type="email" value={form.email} onChange={set("email")} required placeholder="jane@company.com" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField label="Phone Number" id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="0400 000 000" />
                      <FormField label="Company Name" id="company" value={form.company} onChange={set("company")} placeholder="Acme Corp" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField label="Office Location" id="location" value={form.location} onChange={set("location")} placeholder="Sydney CBD" />
                      <FormField label="Team Size" id="teamSize" value={form.teamSize} onChange={set("teamSize")} options={["1–10", "11–30", "31–80", "81–200", "200+"]} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        label="Estimated Budget"
                        id="budget"
                        value={form.budget}
                        onChange={set("budget")}
                        options={[
                          "Under $20,000",
                          "$20,000 – $60,000",
                          "$60,000 – $150,000",
                          "$150,000 – $500,000",
                          "$500,000+",
                          "Not sure yet",
                        ]}
                      />
                      <FormField
                        label="Timeline"
                        id="timeline"
                        value={form.timeline}
                        onChange={set("timeline")}
                        options={["ASAP (< 4 weeks)", "1–3 months", "3–6 months", "6+ months", "Just planning"]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-2 uppercase tracking-wide">Additional Context</label>
                      <textarea
                        rows={3}
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder={selectedPath === "workspace"
                          ? "Product types, style preferences, any constraints..."
                          : "Current office situation, move date, key requirements..."}
                        data-testid="input-start-message"
                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-[hsl(43,78%,52%)]/40 placeholder:text-white/20 resize-none transition-colors"
                      />
                    </div>
                    <div className="pt-2 flex items-center gap-4">
                      <Button
                        type="submit"
                        disabled={mutation.isPending || !form.name || !form.email}
                        data-testid="button-start-submit"
                        className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none px-8"
                      >
                        {mutation.isPending ? (
                          <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Sending...</>
                        ) : (
                          <>Send Enquiry <ArrowRight className="ml-2 w-4 h-4" /></>
                        )}
                      </Button>
                      <p className="text-xs text-white/25">We respond within 24 business hours.</p>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ── Step 2: Success ───────────────────────────────────── */}
            {selectedPath && submitted && (
              <div className="border border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/4 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-[hsl(43,78%,52%)] mx-auto mb-5" />
                <h2 className="text-2xl font-light text-white mb-3">Enquiry received.</h2>
                <p className="text-white/45 text-sm mb-8">
                  We'll review your project details and respond within 24 business hours.
                </p>
                <div className="flex items-center justify-center gap-4 text-sm text-white/30">
                  <span>1300 977 607</span>
                  <span>·</span>
                  <span>service@thecorporatedesk.com.au</span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Trust strip ─────────────────────────────────────────────── */}
        <div className="relative border-t border-white/5 py-5 px-6">
          <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-8 text-xs text-white/20">
            {["24hr Response Guarantee", "National Delivery & Installation", "Commercial-Grade Only", "7.5% Partner Commission"].map(item => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-[hsl(43,78%,52%)]/60" />
                {item}
              </div>
            ))}
          </div>
        </div>

      </section>
    </Layout>
  );
}
