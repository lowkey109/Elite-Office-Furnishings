import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import {
  CheckCircle2, Phone, ChevronLeft, ChevronRight, Calendar,
  Clock, ArrowRight, User, Building2, Mail, MessageSquare,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const callTopics = [
  "Space planning and layout optimisation",
  "Budget planning and cost estimation",
  "Product selection and customisation options",
  "Project timeline and milestone planning",
  "Installation and delivery logistics",
  "After-sales support and warranty information",
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function StrategyCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const canPrev = view.y > today.getFullYear() || view.m > today.getMonth();

  const prev = () => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 });
  const next = () => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={prev} disabled={!canPrev} data-testid="button-cal-prev"
          className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-white tracking-wide">{MONTH_NAMES[view.m]} {view.y}</span>
        <button onClick={next} data-testid="button-cal-next"
          className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] text-white/25 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ds = toDateStr(view.y, view.m, day);
          const date = new Date(view.y, view.m, day);
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const past = date < today;
          const active = ds === selected;
          const disabled = weekend || past;
          return (
            <button key={day} onClick={() => !disabled && onSelect(ds)} disabled={disabled}
              data-testid={`button-cal-day-${ds}`}
              className={`mx-auto w-9 h-9 rounded-full text-sm flex items-center justify-center transition-all duration-150
                ${active ? "bg-[#b8974a] text-[#080808] font-bold" : ""}
                ${!active && !disabled ? "text-white hover:bg-white/10 cursor-pointer" : ""}
                ${disabled ? "text-white/15 cursor-not-allowed" : ""}
              `}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Time Slots ────────────────────────────────────────────────────────────────
function TimeSlots({ date, selected, onSelect }: { date: string; selected: string; onSelect: (t: string) => void }) {
  const { data, isLoading } = useQuery<{ available: string[]; booked: string[] }>({
    queryKey: ["/api/strategy-bookings/available", date],
    queryFn: () => fetch(`/api/strategy-bookings/available?date=${date}`).then(r => r.json()),
    enabled: !!date,
    staleTime: 30_000,
  });

  if (isLoading) return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: 8 }).map((_,i) => <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />)}
    </div>
  );

  const available = data?.available ?? [];
  if (!available.length) return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
      <p className="text-white/40 text-sm">No times available on this date. Please select another day.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {available.map(t => (
        <button key={t} onClick={() => onSelect(t)} data-testid={`button-timeslot-${t.replace(/[\s:]/g,"-")}`}
          className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-150 border
            ${selected === t
              ? "bg-[#b8974a] border-[#b8974a] text-[#080808] font-bold"
              : "bg-white/5 border-white/10 text-white/70 hover:border-[#b8974a]/50 hover:text-white hover:bg-white/10"
            }`}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────
function FieldInput({ label, id, type="text", value, onChange, placeholder, required=true, autoComplete }: {
  label:string; id:string; type?:string; value:string; onChange:(v:string)=>void; placeholder?:string; required?:boolean; autoComplete?:string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-white/50 uppercase tracking-wider">{label}{required && " *"}</label>
      <input id={id} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        data-testid={`input-strategy-${id}`}
        autoComplete={autoComplete}
        className="bg-white/5 border border-white/10 focus:border-[#b8974a]/50 rounded-lg px-4 py-3 text-white placeholder:text-white/25 focus:outline-none text-sm transition-colors" />
    </div>
  );
}

function FieldSelect({ label, id, value, onChange, options, placeholder }: {
  label:string; id:string; value:string; onChange:(v:string)=>void; options:string[]; placeholder?:string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-white/50 uppercase tracking-wider">{label}</label>
      <select id={id} value={value} onChange={e=>onChange(e.target.value)} data-testid={`select-strategy-${id}`}
        className="bg-[#0d0e11] border border-white/10 focus:border-[#b8974a]/50 rounded-lg px-4 py-3 text-white focus:outline-none text-sm transition-colors appearance-none">
        <option value="" disabled>{placeholder || "Select…"}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

interface FormData {
  name:string; company:string; email:string; phone:string;
  staffCount:string; officeLocation:string; budget:string; moveDate:string; message:string;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkplaceStrategy() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<1|2|3>(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [form, setForm] = useState<FormData>({
    name:"", company:"", email:"", phone:"",
    staffCount:"", officeLocation:"", budget:"", moveDate:"", message:"",
  });
  const set = (f: keyof FormData) => (v:string) => setForm(prev => ({...prev, [f]:v}));

  const step1Valid = !!(form.name.trim() && form.company.trim() && form.email.trim() && form.phone.trim());
  const step2Valid = !!(selectedDate && selectedTime);

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/strategy-bookings", {
      ...form, bookingDate: selectedDate, bookingTime: selectedTime, status: "pending",
    }),
    onSuccess: () => setLocation("/thank-you-strategy"),
    onError: async (err: any) => {
      let msg = "Booking failed. Please try again.";
      try { const d = await err?.response?.json?.(); if (d?.error) msg = typeof d.error === "string" ? d.error : "Slot unavailable — please choose another time."; } catch {}
      toast({ title: "Could not confirm booking", description: msg, variant: "destructive" });
    },
  });

  const formattedDate = selectedDate
    ? parseLocalDate(selectedDate).toLocaleDateString("en-AU", { weekday:"long", year:"numeric", month:"long", day:"numeric" })
    : "";

  const STEPS = [
    { n:1 as const, label:"Your Details", icon:User },
    { n:2 as const, label:"Choose Time",  icon:Calendar },
    { n:3 as const, label:"Confirm",      icon:CheckCircle2 },
  ];

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative pt-36 sm:pt-40 pb-12 bg-gradient-to-b from-[hsl(220,20%,5%)] to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
            Expert Consultation
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-4">
            Workplace<br /><span className="gold-text">Strategy Call</span>
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-white/55 max-w-xl leading-relaxed text-lg">
            A complimentary 30-minute consultation with one of our senior workplace specialists. We'll map out your entire project from day one.
          </p>
        </div>
      </section>

      <section className="py-14 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">

            {/* ── Left sidebar ── */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-serif font-bold text-white mb-4">What We Cover</h2>
                <div className="space-y-3">
                  {callTopics.map(topic => (
                    <div key={topic} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                      <span className="text-white/65 text-sm">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="luxury-card p-6 rounded-xl" data-testid="card-call-details">
                <Phone className="w-8 h-8 text-[hsl(43,78%,52%)] mb-4" />
                <div className="text-sm text-[hsl(43,78%,65%)] font-medium mb-1">Call Duration</div>
                <div className="text-2xl font-serif font-bold text-white mb-3">30 Minutes</div>
                <div className="space-y-2 text-sm text-white/50">
                  <p>Available Monday – Friday</p>
                  <p>9:00am – 5:00pm AEST</p>
                  <p className="text-[hsl(43,78%,52%)] font-medium">Or call us directly: 1300 977 607</p>
                </div>
              </div>

              <div className="luxury-card p-6 rounded-xl">
                <div className="text-sm text-[hsl(43,78%,65%)] font-medium mb-3">Who Is This For?</div>
                <div className="space-y-3 text-sm text-white/55">
                  <p>Companies planning a new office fit-out or refurbishment</p>
                  <p>Businesses expanding into new premises</p>
                  <p>Organisations wanting to improve staff productivity and wellbeing</p>
                  <p>Projects ranging from $30,000 to $300,000+</p>
                </div>
              </div>
            </div>

            {/* ── Right booking panel ── */}
            <div className="lg:col-span-3">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-8" data-testid="booking-steps">
                {STEPS.map(({ n, label }, idx) => (
                  <div key={n} className="flex items-center gap-2">
                    {idx > 0 && (
                      <div className={`h-px w-6 sm:w-10 flex-shrink-0 transition-colors ${step > idx ? "bg-[#b8974a]" : "bg-white/10"}`} />
                    )}
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all flex-shrink-0
                        ${step === n ? "bg-[#b8974a] border-[#b8974a] text-[#080808]"
                          : step > n ? "bg-[#b8974a]/15 border-[#b8974a]/35 text-[#b8974a]"
                          : "bg-white/5 border-white/10 text-white/30"}`}>
                        {step > n ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
                      </div>
                      <span className={`text-xs hidden sm:block transition-colors ${step === n ? "text-white" : "text-white/30"}`}>{label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Step 1 ── */}
              {step === 1 && (
                <div className="luxury-card p-8 rounded-xl space-y-5">
                  <div>
                    <h2 className="text-xl font-serif font-bold text-white mb-1">Your Details</h2>
                    <p className="text-white/40 text-sm">Tell us about your project — then choose a time.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FieldInput label="Full Name" id="name" value={form.name} onChange={set("name")} placeholder="Jane Smith" />
                    <FieldInput label="Company Name" id="company" value={form.company} onChange={set("company")} placeholder="Acme Corporation" />
                    <FieldInput label="Email Address" id="email" type="email" value={form.email} onChange={set("email")} placeholder="jane@company.com.au" autoComplete="email" />
                    <FieldInput label="Phone Number" id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="02 XXXX XXXX" autoComplete="tel" />
                    <FieldSelect label="Number of Staff" id="staffCount" value={form.staffCount} onChange={set("staffCount")}
                      options={["1–10","11–25","26–50","51–100","100–250","250+"]} placeholder="Select staff count" />
                    <FieldSelect label="Office Location" id="officeLocation" value={form.officeLocation} onChange={set("officeLocation")}
                      options={["Brisbane","Sydney","Melbourne","Adelaide","Perth","Canberra","Other"]} placeholder="Select city" />
                    <FieldSelect label="Budget Range" id="budget" value={form.budget} onChange={set("budget")}
                      options={["$30,000 – $60,000","$60,000 – $100,000","$100,000 – $200,000","$200,000 – $300,000","$300,000+","Not yet defined"]} placeholder="Select budget" />
                    <FieldSelect label="Target Completion" id="moveDate" value={form.moveDate} onChange={set("moveDate")}
                      options={["Less than 1 month","1–3 months","3–6 months","6–12 months","More than 12 months","Flexible"]} placeholder="Select timeframe" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="message" className="text-xs text-white/50 uppercase tracking-wider">Project Context</label>
                    <textarea id="message" value={form.message} onChange={e=>set("message")(e.target.value)}
                      placeholder="Describe your current situation, challenges, and desired outcomes…"
                      rows={4} data-testid="input-strategy-message"
                      className="bg-white/5 border border-white/10 focus:border-[#b8974a]/50 rounded-lg px-4 py-3 text-white placeholder:text-white/25 focus:outline-none text-sm resize-none transition-colors" />
                  </div>

                  <Button onClick={() => setStep(2)} disabled={!step1Valid} data-testid="button-strategy-next"
                    className="w-full bg-[#b8974a] hover:bg-[#c8a75a] text-[#080808] font-bold min-h-[48px] disabled:opacity-40">
                    Choose a Time <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <div className="luxury-card p-8 rounded-xl space-y-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-serif font-bold text-white mb-1">Choose Your Time</h2>
                      <p className="text-white/40 text-sm">Select a weekday and an available 30-minute slot.</p>
                    </div>
                    <button onClick={() => setStep(1)}
                      className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors mt-1">
                      <ChevronLeft className="w-3.5 h-3.5" /> Back
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-4 h-4 text-[#b8974a]" />
                      <span className="text-xs text-white/50 uppercase tracking-wider">Select Date</span>
                    </div>
                    <StrategyCalendar selected={selectedDate} onSelect={d => { setSelectedDate(d); setSelectedTime(""); }} />
                  </div>

                  {selectedDate && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-4 h-4 text-[#b8974a]" />
                        <span className="text-xs text-white/50 uppercase tracking-wider">Available Times</span>
                        <span className="text-xs text-white/25 ml-auto">AEST</span>
                      </div>
                      <TimeSlots date={selectedDate} selected={selectedTime} onSelect={setSelectedTime} />
                    </div>
                  )}

                  <Button onClick={() => setStep(3)} disabled={!step2Valid} data-testid="button-strategy-confirm"
                    className="w-full bg-[#b8974a] hover:bg-[#c8a75a] text-[#080808] font-bold min-h-[48px] disabled:opacity-40">
                    Review Booking <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* ── Step 3 ── */}
              {step === 3 && (
                <div className="luxury-card p-8 rounded-xl space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-serif font-bold text-white mb-1">Confirm Your Booking</h2>
                      <p className="text-white/40 text-sm">Everything look right? Hit confirm to lock in your slot.</p>
                    </div>
                    <button onClick={() => setStep(2)}
                      className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1 transition-colors mt-1">
                      <ChevronLeft className="w-3.5 h-3.5" /> Back
                    </button>
                  </div>

                  <div className="rounded-xl border border-[#b8974a]/25 bg-[#b8974a]/5 p-5 space-y-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-[#b8974a]" />
                      <span className="text-[#b8974a] font-semibold text-sm">Your Booking</span>
                    </div>
                    <div className="text-white font-medium">{formattedDate}</div>
                    <div className="text-white/70 text-sm flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#b8974a]" />
                      {selectedTime} AEST — 30 minute consultation
                    </div>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    {[
                      { icon: User,         label:"Name",    val:form.name },
                      { icon: Building2,    label:"Company", val:form.company },
                      { icon: Mail,         label:"Email",   val:form.email },
                      { icon: Phone,        label:"Phone",   val:form.phone },
                      ...(form.staffCount   ? [{ icon:User,         label:"Staff",    val:form.staffCount }]   : []),
                      ...(form.budget       ? [{ icon:MessageSquare, label:"Budget",   val:form.budget }]       : []),
                      ...(form.officeLocation ? [{ icon:Building2,  label:"Location", val:form.officeLocation }] : []),
                    ].map(({ icon:Icon, label, val }) => (
                      <div key={label} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                        <Icon className="w-4 h-4 text-white/25 flex-shrink-0" />
                        <span className="text-white/40 w-20 flex-shrink-0">{label}</span>
                        <span className="text-white text-xs">{val}</span>
                      </div>
                    ))}
                    {form.message && (
                      <div className="flex items-start gap-3 py-2">
                        <MessageSquare className="w-4 h-4 text-white/25 flex-shrink-0 mt-0.5" />
                        <span className="text-white/40 w-20 flex-shrink-0">Context</span>
                        <span className="text-white/70 text-xs leading-relaxed flex-1">{form.message}</span>
                      </div>
                    )}
                  </div>

                  <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}
                    data-testid="button-strategy-submit"
                    className="w-full bg-[#b8974a] hover:bg-[#c8a75a] text-[#080808] font-bold min-h-[48px]">
                    {mutation.isPending ? "Confirming…" : "Confirm Booking"}
                    {!mutation.isPending && <CheckCircle2 className="w-4 h-4 ml-2" />}
                  </Button>

                  <p className="text-center text-xs text-white/25">
                    A confirmation will be sent to <span className="text-white/45">{form.email}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
