import { useState } from "react";
import { Link } from "wouter";
import { TrendingUp, ArrowRight, Phone } from "lucide-react";
import { calcMonthly, fmtFinance, FINANCE_THRESHOLD, FINANCE_DISCLAIMER } from "@/lib/financeCalc";

interface FinancePanelProps {
  projectValue: number;
  className?: string;
  sourcePage?: string;
  compact?: boolean;
}

const TERM_OPTIONS = [24, 36, 48, 60] as const;

export function FinancePanel({ projectValue, className = "", sourcePage = "", compact = false }: FinancePanelProps) {
  const [term, setTerm] = useState<number>(36);

  if (!projectValue || projectValue < FINANCE_THRESHOLD) return null;

  const monthly = calcMonthly(projectValue, term);
  const applyUrl = `/finance-workspace?apply=1&amount=${Math.round(projectValue)}&term=${term}&source=${encodeURIComponent(sourcePage)}#apply`;

  if (compact) {
    return (
      <div className={`bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.2)] rounded-xl p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[hsl(43,78%,52%)]" />
          <span className="text-xs font-semibold text-[hsl(43,78%,65%)] uppercase tracking-wider">Finance Available</span>
        </div>
        <div className="flex items-end gap-3 mb-3">
          <div>
            <p className="text-2xl font-bold text-[hsl(43,78%,65%)]">{fmtFinance(monthly)}<span className="text-sm font-normal text-white/40">/mo</span></p>
            <p className="text-white/40 text-xs mt-0.5">indicative over {term} months</p>
          </div>
          <div className="flex gap-1 mb-1">
            {TERM_OPTIONS.map(t => (
              <button
                key={t}
                data-testid={`finance-term-${t}`}
                onClick={() => setTerm(t)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                  term === t
                    ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                    : "border border-[rgba(255,255,255,0.12)] text-white/50 hover:border-[rgba(201,168,76,0.4)]"
                }`}
              >
                {t}m
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={applyUrl}>
            <button
              data-testid="button-finance-apply-compact"
              className="flex-1 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 hover:bg-[hsl(43,78%,60%)] transition-all"
            >
              Apply for Finance <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
          <a href="tel:1300977607">
            <button
              data-testid="button-finance-call-compact"
              className="border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] rounded-lg px-3 py-2.5 text-sm hover:bg-[rgba(201,168,76,0.07)] transition-all"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          </a>
        </div>
        <p className="text-white/25 text-[10px] mt-3 leading-relaxed">{FINANCE_DISCLAIMER}</p>
      </div>
    );
  }

  return (
    <div className={`bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-[hsl(43,78%,52%)]" />
        <span className="text-sm font-semibold text-white">Prefer Monthly Payments?</span>
        <span className="ml-auto text-[10px] bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.2)] rounded-full px-2 py-0.5 uppercase tracking-wider font-semibold">Finance Available</span>
      </div>
      <p className="text-white/40 text-xs mb-4">Indicative repayments for your project. Terms subject to lender approval.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {TERM_OPTIONS.map(t => (
          <button
            key={t}
            data-testid={`finance-term-${t}`}
            onClick={() => setTerm(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              term === t
                ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                : "border border-[rgba(255,255,255,0.1)] text-white/60 hover:border-[rgba(201,168,76,0.35)]"
            }`}
          >
            {t} months
          </button>
        ))}
      </div>

      <div className="bg-[rgba(0,0,0,0.2)] rounded-xl p-4 mb-4 flex items-center gap-4">
        <div>
          <p className="text-white/40 text-xs mb-0.5">Estimated Monthly Repayment</p>
          <p className="text-3xl font-serif font-bold text-[hsl(43,78%,65%)]" data-testid="text-finance-monthly">
            {fmtFinance(monthly)}
          </p>
          <p className="text-white/30 text-xs mt-0.5">per month · {term} month term · {fmtFinance(projectValue)} project</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={applyUrl} className="flex-1">
          <button
            data-testid="button-finance-apply"
            className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,60%)] text-[hsl(220,20%,6%)] font-bold rounded-xl px-5 py-3 text-sm flex items-center justify-center gap-2 transition-all"
          >
            Apply for Finance <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
        <a href="tel:1300977607">
          <button
            data-testid="button-finance-specialist"
            className="w-full sm:w-auto border border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.07)] font-semibold rounded-xl px-5 py-3 text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Phone className="w-4 h-4" /> Talk to Finance Specialist
          </button>
        </a>
      </div>

      <p className="text-white/25 text-[10px] mt-4 leading-relaxed">{FINANCE_DISCLAIMER}</p>
    </div>
  );
}
