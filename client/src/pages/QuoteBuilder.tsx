import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, ArrowLeft, CheckCircle2, Send, Building2,
  Users, LayoutDashboard, DollarSign, MapPin, User, Mail,
  Phone, MessageSquare, ChevronRight, Loader2,
} from "lucide-react";

const STEPS = ["Project", "Space", "Products", "Details", "Summary"];

const PROJECT_TYPES = [
  { id: "full-fitout", label: "Full Office Fitout", desc: "Complete workspace from scratch", icon: Building2 },
  { id: "expansion", label: "Office Expansion", desc: "Adding staff or new areas", icon: Users },
  { id: "refurbishment", label: "Refurbishment", desc: "Upgrading existing furniture", icon: LayoutDashboard },
  { id: "specific", label: "Specific Items", desc: "Targeted product purchases", icon: DollarSign },
];

const STYLE_OPTIONS = [
  { id: "aimu", label: "Aimu Series", desc: "Executive, dark veneer, prestige", tag: "Most Popular" },
  { id: "breeze", label: "Breeze Series", desc: "Contemporary, light timber, modern" },
  { id: "mixed", label: "Mixed / Flexible", desc: "Open to recommendations" },
];

const ROOM_TYPES = [
  { id: "executive-offices", label: "Executive Offices", unitLabel: "offices", unitPrice: 4500 },
  { id: "staff-workstations", label: "Staff Workstations", unitLabel: "workstations", unitPrice: 1200 },
  { id: "boardroom", label: "Boardroom Table", unitLabel: "seats", unitPrice: 600 },
  { id: "reception", label: "Reception Area", unitLabel: "stations", unitPrice: 6000 },
  { id: "meeting-rooms", label: "Meeting Rooms", unitLabel: "rooms", unitPrice: 3500 },
  { id: "breakout", label: "Breakout / Café Zone", unitLabel: "seats", unitPrice: 400 },
  { id: "seating", label: "Task & Visitor Chairs", unitLabel: "chairs", unitPrice: 650 },
  { id: "storage", label: "Storage & Filing", unitLabel: "units", unitPrice: 700 },
];

const TIMELINES = [
  { id: "urgent", label: "Urgent (< 4 weeks)" },
  { id: "3months", label: "Within 3 months" },
  { id: "6months", label: "3–6 months" },
  { id: "planning", label: "Still planning (6 months+)" },
];

const LOCATIONS = ["Brisbane", "Sydney", "Melbourne", "Perth", "Adelaide", "Other"];

interface Selections {
  projectType: string;
  style: string;
  staffCount: string;
  timeline: string;
  location: string;
  rooms: Record<string, number>;
}

interface ContactInfo {
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
}

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

function estimateTotal(rooms: Record<string, number>): number {
  return ROOM_TYPES.reduce((sum, rt) => {
    return sum + (rooms[rt.id] || 0) * rt.unitPrice;
  }, 0);
}

function GoldInput({ label, value, onChange, type = "text", placeholder = "", required = false, testId = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; testId?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-white/60 mb-1.5">
        {label}{required && <span className="text-[hsl(43,78%,52%)] ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base"
        style={{ minHeight: "48px" }}
      />
    </div>
  );
}

export default function QuoteBuilder() {
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Selections>({
    projectType: "", style: "", staffCount: "", timeline: "", location: "", rooms: {},
  });
  const [contact, setContact] = useState<ContactInfo>({
    name: "", company: "", email: "", phone: "", notes: "",
  });
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Quote Builder — Build Your Custom Office Quote | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Build your custom commercial office furniture quote online. Interactive AI-assisted tool to scope, price and plan your office fitout.");
  }, []);

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const total = estimateTotal(selections.rooms);
  const gst = total / 11;
  const exGST = total - gst;

  const submitLead = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leads", data),
    onSuccess: () => setSubmitted(true),
    onError: () => toast({ title: "Submission failed", description: "Please try again or call us on 1300 977 607.", variant: "destructive" }),
  });

  async function sendAiMessage(userMsg?: string) {
    const msg = userMsg || aiInput;
    if (!msg.trim()) return;
    const newMessages: AiMessage[] = [...aiMessages, { role: "user", content: msg }];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);

    const context = `The user is using the Quote Builder tool. Current selections:
- Project type: ${selections.projectType || "not selected yet"}
- Style: ${selections.style || "not selected yet"}
- Staff count: ${selections.staffCount || "not stated"}
- Timeline: ${selections.timeline || "not selected yet"}
- Location: ${selections.location || "not selected yet"}
- Rooms/quantities: ${JSON.stringify(selections.rooms)}
- Estimated total (inc GST): $${total.toLocaleString()}

Answer their question using your role as AI Quoting Specialist and Workplace Strategy Consultant.`;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: context },
            { role: "assistant", content: "Understood. I'm reviewing the Quote Builder selections and ready to advise." },
            ...newMessages,
          ],
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";
      setAiMessages(prev => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  assistantMsg += data.content;
                  setAiMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: assistantMsg };
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch {
      toast({ title: "AI unavailable", description: "Our team can assist — call 1300 977 607.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function handleStepAdvance() {
    if (step === 0 && !selections.projectType) return toast({ title: "Please select a project type", variant: "destructive" });
    if (step === 1 && !selections.style) return toast({ title: "Please select a style preference", variant: "destructive" });
    if (step === 3) {
      if (!contact.name || !contact.email || !contact.phone) return toast({ title: "Please complete required fields", variant: "destructive" });
    }
    setStep(s => s + 1);
    const prompts: Record<number, string> = {
      0: `I've selected "${selections.projectType}" as my project type. What should I consider for this type of fitout?`,
      1: `I'm going with the ${selections.style} style. What are the key benefits and what should I expect?`,
      2: `Here's what I've selected so far: ${Object.entries(selections.rooms).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(", ") || "still selecting"}. My budget estimate is showing $${total.toLocaleString()} inc GST. Does this look right?`,
    };
    if (prompts[step]) {
      setTimeout(() => sendAiMessage(prompts[step]), 300);
    }
  }

  function handleSubmit() {
    if (!contact.name || !contact.email || !contact.phone) {
      return toast({ title: "Please complete required fields", variant: "destructive" });
    }
    const roomSummary = ROOM_TYPES
      .filter(rt => (selections.rooms[rt.id] || 0) > 0)
      .map(rt => `${rt.label}: ${selections.rooms[rt.id]} ${rt.unitLabel}`)
      .join(", ");

    submitLead.mutate({
      name: contact.name,
      company: contact.company || "",
      email: contact.email,
      phone: contact.phone,
      type: "quote-builder",
      message: `Quote Builder Submission\n\nProject: ${selections.projectType} | Style: ${selections.style} | Staff: ${selections.staffCount} | Timeline: ${selections.timeline} | Location: ${selections.location}\n\nRooms: ${roomSummary}\n\nEstimated Total (inc GST): $${total.toLocaleString()}\n\nNotes: ${contact.notes}`,
    });
  }

  if (submitted) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center px-4 pt-24">
          <div className="max-w-lg text-center">
            <div className="w-20 h-20 rounded-full bg-[rgba(201,168,76,0.12)] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-[hsl(43,78%,52%)]" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-white mb-4">Quote Submitted</h1>
            <p className="text-white/60 mb-8">Thank you, {contact.name}. Our team will review your requirements and send a detailed quote within 24 hours.</p>
            <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl p-6 mb-8 text-left">
              <h3 className="text-[hsl(43,78%,65%)] font-semibold mb-3">Your Estimate Summary</h3>
              <div className="space-y-1 text-sm text-white/70">
                {ROOM_TYPES.filter(rt => (selections.rooms[rt.id] || 0) > 0).map(rt => (
                  <div key={rt.id} className="flex justify-between">
                    <span>{rt.label} × {selections.rooms[rt.id]}</span>
                    <span>${((selections.rooms[rt.id] || 0) * rt.unitPrice).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-[rgba(201,168,76,0.1)] mt-3 pt-3 flex justify-between font-semibold text-white">
                  <span>Indicative Total (inc GST)</span>
                  <span>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]">
                <Link href="/">Back to Home</Link>
              </Button>
              <Button asChild variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[48px]">
                <a href="tel:1300977607">Call 1300 977 607</a>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-20 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center pt-10 pb-8">
            <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] mb-4">
              AI-Assisted Quote Builder
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
              Build Your Custom Quote
            </h1>
            <p className="text-white/50 max-w-xl mx-auto">
              Answer a few questions and get an instant indicative budget. Our AI advisor is here to guide you every step.
            </p>
          </div>

          <div className="flex items-center justify-center mb-10 gap-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex flex-col items-center ${i <= step ? "opacity-100" : "opacity-40"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]" :
                    i === step ? "border-2 border-[hsl(43,78%,52%)] text-[hsl(43,78%,65%)]" :
                    "border border-white/20 text-white/40"
                  }`}>
                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-xs mt-1 hidden sm:block text-white/50">{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 sm:w-16 h-px mx-1 transition-all ${i < step ? "bg-[hsl(43,78%,52%)]" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            <div className="xl:col-span-2 bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(201,168,76,0.12)] p-6 sm:p-8">

              {step === 0 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">What brings you here?</h2>
                  <p className="text-white/50 text-sm mb-6">Select the option that best describes your project.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PROJECT_TYPES.map(pt => {
                      const Icon = pt.icon;
                      return (
                        <button
                          key={pt.id}
                          data-testid={`button-project-type-${pt.id}`}
                          onClick={() => setSelections(s => ({ ...s, projectType: pt.id }))}
                          className={`text-left p-5 rounded-xl border transition-all min-h-[80px] ${
                            selections.projectType === pt.id
                              ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)]"
                              : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,168,76,0.3)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selections.projectType === pt.id ? "text-[hsl(43,78%,52%)]" : "text-white/40"}`} />
                            <div>
                              <p className="font-semibold text-white text-sm">{pt.label}</p>
                              <p className="text-white/50 text-xs mt-0.5">{pt.desc}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">Your Style Preference</h2>
                  <p className="text-white/50 text-sm mb-6">Which series aligns with your brand and culture?</p>
                  <div className="space-y-3">
                    {STYLE_OPTIONS.map(s => (
                      <button
                        key={s.id}
                        data-testid={`button-style-${s.id}`}
                        onClick={() => setSelections(sel => ({ ...sel, style: s.id }))}
                        className={`w-full text-left p-5 rounded-xl border transition-all flex items-center justify-between min-h-[72px] ${
                          selections.style === s.id
                            ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)]"
                            : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(201,168,76,0.3)]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{s.label}</span>
                            {s.tag && <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-0 text-xs">{s.tag}</Badge>}
                          </div>
                          <p className="text-white/50 text-xs mt-0.5">{s.desc}</p>
                        </div>
                        {selections.style === s.id && <CheckCircle2 className="w-5 h-5 text-[hsl(43,78%,52%)] flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">How many staff? <span className="text-[hsl(43,78%,52%)]">*</span></label>
                      <input
                        type="number"
                        min="1"
                        value={selections.staffCount}
                        onChange={e => setSelections(s => ({ ...s, staffCount: e.target.value }))}
                        placeholder="e.g. 25"
                        data-testid="input-staff-count"
                        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base"
                        style={{ minHeight: "48px" }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1.5">Location</label>
                      <select
                        value={selections.location}
                        onChange={e => setSelections(s => ({ ...s, location: e.target.value }))}
                        data-testid="select-location"
                        className="w-full bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base"
                        style={{ minHeight: "48px" }}
                      >
                        <option value="">Select city</option>
                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">What do you need?</h2>
                  <p className="text-white/50 text-sm mb-6">Enter quantities for each area. Leave blank if not required.</p>
                  <div className="space-y-3">
                    {ROOM_TYPES.map(rt => (
                      <div key={rt.id} className="flex items-center gap-4 p-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{rt.label}</p>
                          <p className="text-white/40 text-xs mt-0.5">~${rt.unitPrice.toLocaleString()} per {rt.unitLabel.slice(0,-1)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            data-testid={`button-decrement-${rt.id}`}
                            onClick={() => setSelections(s => ({ ...s, rooms: { ...s.rooms, [rt.id]: Math.max(0, (s.rooms[rt.id] || 0) - 1) } }))}
                            className="w-9 h-9 rounded-md border border-[rgba(201,168,76,0.2)] text-white/60 flex items-center justify-center text-lg font-bold"
                          >−</button>
                          <span className="w-10 text-center text-white font-semibold" data-testid={`text-qty-${rt.id}`}>
                            {selections.rooms[rt.id] || 0}
                          </span>
                          <button
                            data-testid={`button-increment-${rt.id}`}
                            onClick={() => setSelections(s => ({ ...s, rooms: { ...s.rooms, [rt.id]: (s.rooms[rt.id] || 0) + 1 } }))}
                            className="w-9 h-9 rounded-md border border-[rgba(201,168,76,0.2)] text-white/60 flex items-center justify-center text-lg font-bold"
                          >+</button>
                        </div>
                        {(selections.rooms[rt.id] || 0) > 0 && (
                          <span className="text-sm text-[hsl(43,78%,65%)] w-20 text-right">
                            ${((selections.rooms[rt.id] || 0) * rt.unitPrice).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5">
                    <label className="block text-sm text-white/60 mb-1.5">Project Timeline</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TIMELINES.map(t => (
                        <button
                          key={t.id}
                          data-testid={`button-timeline-${t.id}`}
                          onClick={() => setSelections(s => ({ ...s, timeline: t.id }))}
                          className={`p-3 rounded-lg border text-sm transition-all text-left min-h-[48px] ${
                            selections.timeline === t.id
                              ? "border-[hsl(43,78%,52%)] bg-[rgba(201,168,76,0.08)] text-white"
                              : "border-[rgba(255,255,255,0.08)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">Your Contact Details</h2>
                  <p className="text-white/50 text-sm mb-6">We'll use this to send your formal quote. No spam, ever.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <GoldInput label="Full Name" value={contact.name} onChange={v => setContact(c => ({ ...c, name: v }))} required testId="input-contact-name" placeholder="Jane Smith" />
                    <GoldInput label="Company Name" value={contact.company} onChange={v => setContact(c => ({ ...c, company: v }))} testId="input-contact-company" placeholder="Smith & Co." />
                    <GoldInput label="Email Address" value={contact.email} onChange={v => setContact(c => ({ ...c, email: v }))} type="email" required testId="input-contact-email" placeholder="jane@smithco.com.au" />
                    <GoldInput label="Phone Number" value={contact.phone} onChange={v => setContact(c => ({ ...c, phone: v }))} type="tel" required testId="input-contact-phone" placeholder="04xx xxx xxx" />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm text-white/60 mb-1.5">Additional Notes</label>
                    <textarea
                      value={contact.notes}
                      onChange={e => setContact(c => ({ ...c, notes: e.target.value }))}
                      placeholder="Any specific requirements, existing furniture, budget constraints..."
                      data-testid="textarea-contact-notes"
                      rows={3}
                      className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-base resize-none"
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="text-xl font-serif font-bold text-white mb-2">Review Your Quote Request</h2>
                  <p className="text-white/50 text-sm mb-6">Check everything looks right before submitting.</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Project Type", value: PROJECT_TYPES.find(p => p.id === selections.projectType)?.label || "—" },
                        { label: "Style Series", value: STYLE_OPTIONS.find(s => s.id === selections.style)?.label || "—" },
                        { label: "Staff Count", value: selections.staffCount || "—" },
                        { label: "Timeline", value: TIMELINES.find(t => t.id === selections.timeline)?.label || "—" },
                        { label: "Location", value: selections.location || "—" },
                        { label: "Contact", value: contact.name },
                      ].map(item => (
                        <div key={item.label} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 border border-[rgba(255,255,255,0.06)]">
                          <p className="text-white/40 text-xs mb-1">{item.label}</p>
                          <p className="text-white text-sm font-medium">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl p-4">
                      <h4 className="text-[hsl(43,78%,65%)] font-semibold text-sm mb-3">Indicative Budget Breakdown</h4>
                      {ROOM_TYPES.filter(rt => (selections.rooms[rt.id] || 0) > 0).map(rt => (
                        <div key={rt.id} className="flex justify-between text-sm py-1 text-white/70">
                          <span>{rt.label} × {selections.rooms[rt.id]}</span>
                          <span>${((selections.rooms[rt.id] || 0) * rt.unitPrice).toLocaleString()}</span>
                        </div>
                      ))}
                      {total === 0 && <p className="text-white/40 text-sm">No items selected — quote will be scoped by our team.</p>}
                      {total > 0 && (
                        <div className="border-t border-[rgba(201,168,76,0.1)] mt-3 pt-3 space-y-1">
                          <div className="flex justify-between text-sm text-white/60">
                            <span>Ex-GST</span><span>${exGST.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="flex justify-between text-sm text-white/60">
                            <span>GST (10%)</span><span>${gst.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="flex justify-between font-bold text-white mt-1 pt-1 border-t border-[rgba(201,168,76,0.1)]">
                            <span>Indicative Total (inc GST)</span><span className="text-[hsl(43,78%,65%)]">${total.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      <p className="text-white/30 text-xs mt-3">Indicative only. Formal quote issued by our team within 24 hours.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-[rgba(255,255,255,0.06)]">
                {step > 0 ? (
                  <Button
                    onClick={() => setStep(s => s - 1)}
                    variant="outline"
                    className="border-[rgba(255,255,255,0.15)] text-white/70 min-h-[48px] px-5"
                    data-testid="button-step-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                ) : <div />}

                {step < 4 ? (
                  <Button
                    onClick={handleStepAdvance}
                    className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] px-6"
                    data-testid="button-step-next"
                  >
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitLead.isPending}
                    className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] px-8"
                    data-testid="button-submit-quote"
                  >
                    {submitLead.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4 mr-2" /> Submit Quote Request</>}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(201,168,76,0.12)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[rgba(201,168,76,0.12)] flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">AI Quoting Advisor</p>
                    <p className="text-white/40 text-xs">Your expert guide</p>
                  </div>
                </div>

                <div className="min-h-[200px] max-h-[350px] overflow-y-auto space-y-3 mb-4 pr-1">
                  {aiMessages.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-white/40 text-sm">Select your project type and I'll give you expert guidance on your quote.</p>
                    </div>
                  )}
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[rgba(201,168,76,0.12)] text-white"
                          : "bg-[rgba(255,255,255,0.04)] text-white/80 border border-[rgba(255,255,255,0.06)]"
                      }`}>
                        {msg.content || (aiLoading && i === aiMessages.length - 1 ? <span className="animate-pulse">●●●</span> : null)}
                      </div>
                    </div>
                  ))}
                  <div ref={aiEndRef} />
                </div>

                <div className="flex gap-2">
                  <input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                    placeholder="Ask the AI advisor..."
                    data-testid="input-ai-chat"
                    className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.15)] rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[rgba(201,168,76,0.4)] text-sm"
                    style={{ minHeight: "44px" }}
                  />
                  <Button
                    onClick={() => sendAiMessage()}
                    disabled={aiLoading || !aiInput.trim()}
                    className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] min-h-[44px] min-w-[44px] px-3"
                    data-testid="button-send-ai"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {total > 0 && (
                <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-5">
                  <h4 className="text-[hsl(43,78%,65%)] font-semibold text-sm mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Live Estimate
                  </h4>
                  <div className="text-3xl font-serif font-bold text-white mb-1">
                    ${total.toLocaleString()}
                  </div>
                  <p className="text-white/40 text-xs">Indicative total inc GST</p>
                  <div className="mt-3 pt-3 border-t border-[rgba(201,168,76,0.1)] space-y-1 text-xs text-white/50">
                    <div className="flex justify-between"><span>Ex-GST</span><span>${exGST.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                    <div className="flex justify-between"><span>GST (10%)</span><span>${gst.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  </div>
                </div>
              )}

              <div className="bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(255,255,255,0.06)] p-5">
                <h4 className="text-white font-semibold text-sm mb-3">Why use the Quote Builder?</h4>
                <ul className="space-y-2">
                  {[
                    "Instant indicative budget",
                    "AI-guided product recommendations",
                    "No obligation quote request",
                    "Formal quote within 24 hours",
                    "6-year warranty included",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
