import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import {
  CheckCircle2, TrendingUp, DollarSign, Shield, Clock,
  FileText, ArrowRight, Phone, Calculator, Percent,
} from "lucide-react";

const BENEFITS = [
  {
    icon: TrendingUp,
    title: "Preserve Cash Flow",
    desc: "Keep working capital in the business. Spread the cost of your fitout across manageable monthly payments rather than a single lump sum.",
  },
  {
    icon: Percent,
    title: "Potential Tax Advantages",
    desc: "Business equipment finance repayments may be tax-deductible as a business expense. Speak with your accountant to confirm eligibility.",
  },
  {
    icon: Clock,
    title: "Flexible Terms",
    desc: "Finance terms from 12 to 60 months available through our preferred third-party lenders. Structure repayments to match your budget.",
  },
  {
    icon: Shield,
    title: "Approved Quickly",
    desc: "Streamlined approval process for qualified businesses. Most applications assessed within 24–48 business hours.",
  },
  {
    icon: FileText,
    title: "Simple Documentation",
    desc: "Minimal paperwork. Our team guides you through the process from enquiry to approval to delivery.",
  },
  {
    icon: DollarSign,
    title: "Fits Any Budget",
    desc: "Projects from $30,000 to $300,000+ can be financed. No need to delay your fitout waiting for capital to free up.",
  },
];

const FAQS = [
  {
    q: "What types of businesses are eligible?",
    a: "Most registered Australian businesses (Pty Ltd, partnerships, trusts) with at least 12 months of trading history are eligible. Our lending partners assess each application individually.",
  },
  {
    q: "Is finance available for all project sizes?",
    a: "Yes. Finance is typically available for projects from $10,000 through to $500,000+. Larger projects may require additional documentation.",
  },
  {
    q: "How does the approval process work?",
    a: "You submit your quote and basic business details to our team. We refer your application to our preferred finance partners who assess and respond within 24–48 hours.",
  },
  {
    q: "Can I include delivery and installation in the finance?",
    a: "Yes. The full project cost — furniture, delivery, and installation — can typically be included in the financed amount.",
  },
  {
    q: "Will this affect my business credit?",
    a: "Finance applications involve a credit assessment. We recommend confirming with your accountant whether the finance structure is right for your situation.",
  },
];

const TERM_OPTIONS = [12, 24, 36, 48, 60];
const RATE_FACTORS: Record<number, number> = { 12: 0.0885, 24: 0.0465, 36: 0.0325, 48: 0.0255, 60: 0.0215 };

function formatCurrency(v: number) {
  return v.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

export default function FinanceWorkspace() {
  const [amount, setAmount] = useState("80000");
  const [term, setTerm] = useState(36);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Finance Your Workspace — Office Furniture Finance | The Corporate Desk";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Spread the cost of your commercial office fitout with flexible business finance. Preserve cash flow, possible tax benefits, fast approval.");
  }, []);

  const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const monthlyFactor = RATE_FACTORS[term] || RATE_FACTORS[36];
  const monthly = numericAmount * monthlyFactor;
  const totalRepayable = monthly * term;
  const totalInterest = totalRepayable - numericAmount;
  const gstComponent = numericAmount / 11;
  const exGST = numericAmount - gstComponent;

  return (
    <Layout>
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(201,168,76,0.04)] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] mb-5">
            Finance Your Workspace
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white mb-6 leading-tight">
            Get the Office You Need,<br />
            <span className="gold-text">Without the Upfront Cost</span>
          </h1>
          <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            Premium office furniture is a strategic investment in your team and your brand. Flexible finance options let you move forward now — without waiting on capital.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] text-base px-8"
              data-testid="button-finance-enquire"
            >
              <Link href="/contact">Enquire About Finance <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[52px] text-base px-6"
              data-testid="button-finance-call"
            >
              <a href="tel:1300977607"><Phone className="w-4 h-4 mr-2" /> 1300 977 607</a>
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-10 pt-8 border-t border-[rgba(201,168,76,0.1)]">
            {["Fast Approval", "Flexible Terms 12–60 Months", "No Hidden Fees", "Australian Businesses Only"].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-white mb-3">Why Finance Your Fitout?</h2>
            <p className="text-white/50 max-w-xl mx-auto">Smart businesses don't tie up capital in furniture. They invest it where it generates returns.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 hover:border-[rgba(201,168,76,0.2)] transition-all">
                  <div className="w-11 h-11 rounded-xl bg-[rgba(201,168,76,0.1)] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[hsl(43,78%,52%)]" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{b.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-[rgba(201,168,76,0.03)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] mb-4">
              <Calculator className="w-3.5 h-3.5 mr-1.5" /> Repayment Estimator
            </Badge>
            <h2 className="text-3xl font-serif font-bold text-white mb-3">Estimate Your Monthly Repayments</h2>
            <p className="text-white/50 max-w-lg mx-auto text-sm">
              Indicative only. Actual repayments depend on lender assessment, credit profile, and product selection. Always confirm with your accountant.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(201,168,76,0.15)] p-6 sm:p-8">
              <div className="mb-6">
                <label className="block text-sm text-white/60 mb-2">Project Amount (inc GST)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(43,78%,52%)] font-semibold">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="10000"
                    step="5000"
                    data-testid="input-finance-amount"
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] rounded-md pl-8 pr-4 py-3 text-white focus:outline-none focus:border-[rgba(201,168,76,0.5)] text-lg font-semibold"
                    style={{ minHeight: "52px" }}
                  />
                </div>
                <input
                  type="range"
                  min="10000"
                  max="500000"
                  step="5000"
                  value={numericAmount}
                  onChange={e => setAmount(e.target.value)}
                  data-testid="range-finance-amount"
                  className="w-full mt-3 accent-[hsl(43,78%,52%)]"
                />
                <div className="flex justify-between text-xs text-white/30 mt-1">
                  <span>$10,000</span><span>$500,000</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-white/60 mb-3">Finance Term</label>
                <div className="grid grid-cols-5 gap-2">
                  {TERM_OPTIONS.map(t => (
                    <button
                      key={t}
                      data-testid={`button-term-${t}`}
                      onClick={() => setTerm(t)}
                      className={`py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
                        term === t
                          ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                          : "border border-[rgba(255,255,255,0.1)] text-white/60 hover:border-[rgba(201,168,76,0.3)]"
                      }`}
                    >
                      {t}mo
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl p-4">
                <p className="text-white/40 text-xs mb-1">Estimated Monthly Repayment</p>
                <p className="text-4xl font-serif font-bold text-[hsl(43,78%,65%)]" data-testid="text-monthly-repayment">
                  {formatCurrency(monthly)}
                </p>
                <p className="text-white/30 text-xs mt-1">per month over {term} months</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[hsl(220,18%,10%)] rounded-2xl border border-[rgba(255,255,255,0.06)] p-6">
                <h3 className="text-white font-semibold mb-4 text-sm">Summary</h3>
                <div className="space-y-3">
                  {[
                    { label: "Project Amount (inc GST)", value: formatCurrency(numericAmount) },
                    { label: "GST Component (10%)", value: formatCurrency(gstComponent) },
                    { label: "Amount ex-GST", value: formatCurrency(exGST) },
                    { label: "Finance Term", value: `${term} months` },
                    { label: "Monthly Repayment (est.)", value: formatCurrency(monthly) },
                    { label: "Total Repayable (est.)", value: formatCurrency(totalRepayable) },
                    { label: "Estimated Interest Cost", value: formatCurrency(totalInterest) },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-sm py-1 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <span className="text-white/50">{item.label}</span>
                      <span className="text-white font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-5">
                <p className="text-xs text-white/40 leading-relaxed mb-4">
                  <strong className="text-white/60">Important Disclaimer:</strong> These calculations are indicative only and should not be relied upon as financial advice. Actual rates and repayments will vary based on lender assessment, business credit profile, and term selected. Consult your accountant or financial adviser before entering into any finance arrangement.
                </p>
                <Button
                  asChild
                  className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px]"
                  data-testid="button-finance-apply"
                >
                  <Link href="/contact">Enquire About Finance <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-[rgba(201,168,76,0.25)] bg-[hsl(220,18%,10%)] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-[hsl(43,78%,65%)] text-xs font-medium uppercase tracking-widest mb-2">Before You Finance — Know Your Numbers</p>
              <h3 className="text-xl font-serif font-bold text-white mb-2">Get an AI-Generated Project Estimate First</h3>
              <p className="text-white/50 text-sm leading-relaxed">Upload your floor plan and let our AI generate a full furniture recommendation and estimated project cost — so you know exactly what to finance.</p>
            </div>
            <Button asChild className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] px-8 flex-shrink-0 whitespace-nowrap" data-testid="button-finance-ai-planner">
              <Link href="/upload-your-floor-plan">AI Office Planner <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-serif font-bold text-white mb-3">Common Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden"
              >
                <button
                  data-testid={`button-faq-${i}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between min-h-[60px]"
                >
                  <span className="text-white font-medium text-sm pr-4">{faq.q}</span>
                  <span className={`text-[hsl(43,78%,52%)] text-xl font-light flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-white/60 leading-relaxed border-t border-[rgba(255,255,255,0.04)] pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[hsl(220,18%,12%)] to-[hsl(220,20%,8%)] border border-[rgba(201,168,76,0.2)] rounded-3xl p-8 sm:p-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
              Ready to Move Forward?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto leading-relaxed">
              Get your formal quote first. Once you have it, our team will connect you with the right finance solution for your business.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[52px] px-8 text-base"
                data-testid="button-finance-get-quote"
              >
                <Link href="/quote-builder">Build Your Quote <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[52px] px-6 text-base"
                data-testid="button-finance-cta-call"
              >
                <a href="tel:1300977607"><Phone className="w-4 h-4 mr-2" /> 1300 977 607</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
