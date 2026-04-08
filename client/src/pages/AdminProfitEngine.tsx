import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DollarSign, TrendingUp, Package, BarChart3, ArrowLeft, Calculator,
  ChevronDown, ChevronUp, RefreshCw, Award, Layers, AlertCircle, CheckCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


function MarginBadge({ pct }: { pct: number }) {
  const status =
    pct >= 58 ? { color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", label: "Excellent" } :
    pct >= 52 ? { color: "bg-blue-500/20 text-blue-300 border-blue-500/30", label: "Good" } :
    pct >= 45 ? { color: "bg-amber-500/20 text-amber-300 border-amber-500/30", label: "Acceptable" } :
    pct >= 38 ? { color: "bg-orange-500/20 text-orange-300 border-orange-500/30", label: "Low" } :
    { color: "bg-red-500/20 text-red-300 border-red-500/30", label: "Critical" };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
      {pct}% — {status.label}
    </span>
  );
}

function fmt(n: number) {
  return `$${n.toLocaleString("en-AU")}`;
}

function CostStackCard({ stack, highlighted }: { stack: any; highlighted?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const tierColors: Record<string, string> = {
    premium: "border-amber-500/30 bg-amber-500/5",
    balanced: "border-blue-500/30 bg-blue-500/5",
    value: "border-zinc-600/50 bg-zinc-800/30",
  };

  const tierBadge: Record<string, string> = {
    premium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    balanced: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    value: "bg-zinc-700/50 text-zinc-400 border-zinc-600/50",
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${tierColors[stack.packageTier] || "border-zinc-700/50"} ${highlighted ? "ring-2 ring-amber-500/30" : ""}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${tierBadge[stack.packageTier]}`}>
                {stack.packageTier.toUpperCase()}
              </span>
              {highlighted && <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">Best Margin</span>}
              <MarginBadge pct={stack.marginPercent} />
            </div>
            <h3 className="text-white font-semibold">{stack.packageName}</h3>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-white">{fmt(stack.quotedPrice)}</p>
            <p className="text-zinc-500 text-xs">quoted price</p>
          </div>
        </div>

        {/* Key financials */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-zinc-900/60 rounded-lg p-3 text-center">
            <p className="text-zinc-500 text-xs mb-1">Landed Cost</p>
            <p className="text-white font-semibold text-sm">{fmt(stack.totalLandedCost)}</p>
          </div>
          <div className="bg-zinc-900/60 rounded-lg p-3 text-center">
            <p className="text-zinc-500 text-xs mb-1">Install</p>
            <p className="text-white font-semibold text-sm">{fmt(stack.installationCost)}</p>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3 text-center">
            <p className="text-zinc-500 text-xs mb-1">Gross Profit</p>
            <p className="text-emerald-300 font-bold text-sm">{fmt(stack.grossProfit)}</p>
          </div>
        </div>

        {/* Key strengths */}
        {stack.keyStrengths && stack.keyStrengths.length > 0 && (
          <div className="mt-3 space-y-1">
            {stack.keyStrengths.map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                <CheckCircle className="w-3 h-3 text-zinc-500 flex-shrink-0 mt-0.5" />
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Supplier mix */}
        {stack.supplierMix && Object.keys(stack.supplierMix).length > 0 && (
          <div className="mt-3">
            <p className="text-zinc-500 text-xs font-medium mb-1.5">SUPPLIER MIX</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stack.supplierMix).map(([supplier, categories]: [string, any]) => (
                <div key={supplier} className="text-xs bg-zinc-900/60 border border-zinc-700/30 rounded-lg px-2 py-1">
                  <span className="text-zinc-300">{supplier}</span>
                  <span className="text-zinc-600 mx-1">·</span>
                  <span className="text-zinc-500">{Array.isArray(categories) ? categories.length : 1} cat.</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line items toggle */}
        {stack.lineItems && stack.lineItems.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between mt-3 pt-3 border-t border-zinc-700/30 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <span>View {stack.lineItems.length} line items</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Line items */}
      {expanded && stack.lineItems && (
        <div className="border-t border-zinc-700/40 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700/30">
                <th className="text-left text-zinc-500 font-medium px-4 py-2">Category</th>
                <th className="text-center text-zinc-500 font-medium px-2 py-2">Qty</th>
                <th className="text-right text-zinc-500 font-medium px-2 py-2">Unit Cost</th>
                <th className="text-right text-zinc-500 font-medium px-2 py-2">Unit Sell</th>
                <th className="text-right text-zinc-500 font-medium px-4 py-2">Total Sell</th>
                <th className="text-right text-zinc-500 font-medium px-4 py-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {stack.lineItems.map((item: any, i: number) => (
                <tr key={i} className="border-b border-zinc-700/20 last:border-0">
                  <td className="px-4 py-2">
                    <p className="text-white">{item.category}</p>
                    <p className="text-zinc-500">{item.supplier}</p>
                  </td>
                  <td className="text-center text-zinc-300 px-2 py-2">{item.quantity}</td>
                  <td className="text-right text-zinc-300 px-2 py-2">{fmt(item.unitLandedCost)}</td>
                  <td className="text-right text-zinc-300 px-2 py-2">{fmt(item.unitSellPrice)}</td>
                  <td className="text-right text-white font-medium px-4 py-2">{fmt(item.totalSellPrice)}</td>
                  <td className="text-right px-4 py-2">
                    <span className={`font-medium ${item.marginPct >= 52 ? "text-emerald-400" : item.marginPct >= 45 ? "text-amber-400" : "text-red-400"}`}>
                      {item.marginPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PackageComparatorPanel() {
  const { toast } = useToast();
  const [officeSqm, setOfficeSqm] = useState("300");
  const [staffCount, setStaffCount] = useState("30");
  const [comparison, setComparison] = useState<any>(null);

  const compareMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/profit/compare", {
        officeSqm: Number(officeSqm),
        staffCount: Number(staffCount),
      }),
    onSuccess: (data: any) => setComparison(data),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
        <p className="text-white font-medium text-sm mb-4">Package Comparison Calculator</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-zinc-400 text-xs font-medium block mb-1.5">Office Size (sqm)</label>
            <input
              type="number"
              value={officeSqm}
              onChange={(e) => setOfficeSqm(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              data-testid="input-office-sqm"
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs font-medium block mb-1.5">Staff Count</label>
            <input
              type="number"
              value={staffCount}
              onChange={(e) => setStaffCount(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              data-testid="input-staff-count"
            />
          </div>
        </div>
        <button
          onClick={() => compareMutation.mutate()}
          disabled={compareMutation.isPending}
          data-testid="button-compare-packages"
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {compareMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          {compareMutation.isPending ? "Calculating..." : "Compare All Packages"}
        </button>
      </div>

      {/* Comparison results */}
      {comparison && (
        <div className="space-y-4">
          {/* Recommendation */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Award className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/90 text-sm">{comparison.recommendation}</p>
            </div>
          </div>

          {/* Package cards */}
          <div className="grid grid-cols-1 gap-4">
            {["premium", "balanced", "value"].map((tier) => (
              <CostStackCard
                key={tier}
                stack={comparison[tier]}
                highlighted={comparison.bestMarginTier === tier}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutPatternsPanel() {
  const { data: patterns = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/profit/layout-patterns"],
  });

  if (isLoading) return <div className="text-zinc-500 text-sm">Loading layout patterns...</div>;

  return (
    <div className="space-y-3">
      {patterns.map((pattern, i) => (
        <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <h3 className="text-white font-medium text-sm">{pattern.layoutType}</h3>
                <MarginBadge pct={pattern.avgMarginPct} />
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400 capitalize">
                  → {pattern.packageRecommendation}
                </span>
              </div>
              <p className="text-emerald-400 font-semibold text-sm">{fmt(pattern.avgProjectValue)} avg project value</p>
              <p className="text-zinc-400 text-xs mt-1.5">{pattern.notes}</p>
              {pattern.bestIndustries && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pattern.bestIndustries.map((ind: string) => (
                    <span key={ind} className="text-xs px-1.5 py-0.5 bg-zinc-900/60 border border-zinc-700/30 rounded text-zinc-500 capitalize">
                      {ind}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold text-white">{pattern.avgMarginPct}%</p>
              <p className="text-zinc-500 text-xs">avg margin</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfitRecordsPanel() {
  const { data: records = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/profit/records"],
  });

  if (isLoading) return <div className="text-zinc-500 text-sm">Loading profit records...</div>;
  if (records.length === 0)
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No profit records yet — these are populated as projects are captured and converted</p>
      </div>
    );

  const avgMargin = records.length
    ? Math.round(records.reduce((s, r) => s + (r.estimatedMarginPercent || 0), 0) / records.length)
    : 0;
  const totalProfit = records.reduce((s, r) => s + (r.estimatedProfit || 0), 0);
  const wonRecords = records.filter((r) => r.conversionResult === "won");

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-center">
          <p className="text-zinc-500 text-xs mb-1">Avg Margin</p>
          <p className="text-2xl font-bold text-white">{avgMargin}%</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-center">
          <p className="text-zinc-500 text-xs mb-1">Total Profit</p>
          <p className="text-2xl font-bold text-emerald-400">{fmt(totalProfit)}</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-center">
          <p className="text-zinc-500 text-xs mb-1">Won Projects</p>
          <p className="text-2xl font-bold text-white">{wonRecords.length}</p>
        </div>
      </div>

      {/* Records table */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="text-left text-zinc-500 font-medium px-4 py-3 text-xs">Project</th>
                <th className="text-right text-zinc-500 font-medium px-3 py-3 text-xs">Quoted</th>
                <th className="text-right text-zinc-500 font-medium px-3 py-3 text-xs">Profit</th>
                <th className="text-right text-zinc-500 font-medium px-4 py-3 text-xs">Margin</th>
                <th className="text-center text-zinc-500 font-medium px-4 py-3 text-xs">Result</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-zinc-700/20 last:border-0" data-testid={`profit-record-${record.id}`}>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-xs">{record.packageName || "Unnamed Package"}</p>
                    <p className="text-zinc-500 text-xs">
                      {record.officeSize && `${record.officeSize}sqm`}
                      {record.staffCount && ` · ${record.staffCount} staff`}
                      {record.packageTier && ` · ${record.packageTier}`}
                    </p>
                  </td>
                  <td className="text-right text-white text-xs px-3 py-3">
                    {record.quotedPrice ? fmt(record.quotedPrice) : "—"}
                  </td>
                  <td className="text-right text-emerald-400 font-medium text-xs px-3 py-3">
                    {record.estimatedProfit ? fmt(record.estimatedProfit) : "—"}
                  </td>
                  <td className="text-right px-4 py-3">
                    {record.estimatedMarginPercent ? <MarginBadge pct={record.estimatedMarginPercent} /> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      record.conversionResult === "won"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : record.conversionResult === "lost"
                        ? "bg-red-500/20 text-red-300 border-red-500/30"
                        : "bg-zinc-700/50 text-zinc-400 border-zinc-600/50"
                    }`}>
                      {record.conversionResult || "pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "compare", label: "Package Comparator", icon: Calculator },
  { id: "patterns", label: "Layout Profit Patterns", icon: Layers },
  { id: "records", label: "Profit Records", icon: BarChart3 },
];

export default function AdminProfitEngine() {
  const [tab, setTab] = useState("compare");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-zinc-500 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-white font-semibold text-base">Profit Optimisation Engine</h1>
                <p className="text-zinc-500 text-xs">AI Workspace Margin Intelligence</p>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-px">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`tab-${t.id}`}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "compare" && <PackageComparatorPanel />}
        {tab === "patterns" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Layout Type Profit Patterns</h2>
            <p className="text-zinc-400 text-sm">Margin intelligence by office layout type — use to guide package recommendations and pricing strategy.</p>
            <LayoutPatternsPanel />
          </div>
        )}
        {tab === "records" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Project Profit Records</h2>
            <p className="text-zinc-400 text-sm">Historical profit data from captured workspace projects. Auto-populated as projects move through the pipeline.</p>
            <ProfitRecordsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
