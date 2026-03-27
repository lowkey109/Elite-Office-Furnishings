import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Lightbulb, ArrowLeft, Sparkles, BarChart3, TrendingUp, DollarSign,
  Building2, Users, Layers, Target, RefreshCw, ChevronRight, X,
  CheckCircle, Award, Zap, LayoutGrid, Brain, Briefcase, ArrowRight,
  Clock, Map, Star,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


type WorkspaceStrategy = {
  id: string; officeSqm?: number; staffCount?: number; projectType?: string;
  industryContext?: string; recommendedLayoutType?: string; recommendedDeskDensity?: string;
  recommendedZonesJson?: string; recommendedPackageTier?: string;
  recommendedFurnitureJson?: string; predictedProjectValue?: number;
  predictedGrossProfit?: number; predictedMarginPct?: number;
  workspaceConcept?: string; budgetEstimateLow?: number; budgetEstimateHigh?: number;
  proposalSummary?: string; keyInsights?: string[]; confidenceScore?: number;
  dataSourcesUsed?: number; createdAt: string;
};
type LearningInsights = {
  totalRecords: number; avgMarginPct: number; avgProjectValue: number;
  topLayoutType: string; topPackageTier: string; topIndustry: string;
  avgSqmPerPerson: number;
  recentStrategies: WorkspaceStrategy[];
  layoutBreakdown: Array<{ layout: string; count: number; avgMargin: number }>;
  packageBreakdown: Array<{ package: string; count: number; avgValue: number }>;
};

const TIER_COLORS: Record<string, string> = {
  Premium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Balanced: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Value: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
};
const LAYOUT_ICONS: Record<string, string> = {
  open_plan: "🟦", hybrid: "🔲", executive: "⬛", collaborative: "🟩", cellular: "🔳", mixed: "🔀",
};

function formatCurrency(v?: number) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(v);
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} /></div>
      <span className="text-xs text-zinc-400 w-8 text-right">{score}%</span>
    </div>
  );
}

export default function AdminWorkspaceStrategy() {
  const [view, setView] = useState<"generate" | "history" | "insights">("generate");
  const [selectedStrategy, setSelectedStrategy] = useState<WorkspaceStrategy | null>(null);
  const [form, setForm] = useState({
    officeSqm: "", staffCount: "", projectType: "refit", industryContext: "", budgetRange: "", stylePreference: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery<WorkspaceStrategy[]>({
    queryKey: ["/api/admin/workspace-strategy"],
  });
  const { data: insights, isLoading: insightsLoading } = useQuery<LearningInsights>({
    queryKey: ["/api/admin/workspace-strategy/learning-insights"],
    enabled: view === "insights",
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/workspace-strategy/generate", {
      officeSqm: parseInt(form.officeSqm),
      staffCount: parseInt(form.staffCount),
      projectType: form.projectType || undefined,
      industryContext: form.industryContext || undefined,
      budgetRange: form.budgetRange || undefined,
      stylePreference: form.stylePreference || undefined,
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workspace-strategy"] });
      setSelectedStrategy(data);
      setView("history");
      toast({ title: "Strategy generated successfully" });
    },
    onError: (err: any) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const renderZones = (zonesJson?: string | null) => {
    if (!zonesJson) return null;
    try { return JSON.parse(zonesJson) as Array<{ zone: string; percentage: number; sqm: number }>; }
    catch { return null; }
  };
  const renderFurniture = (furnitureJson?: string | null) => {
    if (!furnitureJson) return null;
    try { return JSON.parse(furnitureJson) as Array<{ category: string; suggestion: string; quantity: number }>; }
    catch { return null; }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/command-centre" className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center"><Brain className="w-5 h-5 text-violet-400" /></div>
              <div><div className="text-white font-semibold text-lg">AI Workspace Strategy Engine</div><div className="text-zinc-500 text-xs">Data-driven office design, package and margin optimisation</div></div>
            </div>
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto px-6 pb-0 flex items-center gap-1">
          {[{ id: "generate", label: "Generate Strategy", icon: Sparkles }, { id: "history", label: "Strategy History", icon: BarChart3 }, { id: "insights", label: "Learning Insights", icon: Brain }].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${view === tab.id ? "border-violet-500 text-white" : "border-transparent text-zinc-500 hover:text-white"}`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Generate Tab */}
        {view === "generate" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <h2 className="text-white font-semibold">Generate Strategy Recommendation</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Office Size (sqm) *</label>
                    <input type="number" value={form.officeSqm} onChange={e => setForm(f => ({ ...f, officeSqm: e.target.value }))} placeholder="e.g. 500" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" data-testid="input-office-sqm" />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Staff Count *</label>
                    <input type="number" value={form.staffCount} onChange={e => setForm(f => ({ ...f, staffCount: e.target.value }))} placeholder="e.g. 45" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" data-testid="input-staff-count" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Project Type</label>
                    <select value={form.projectType} onChange={e => setForm(f => ({ ...f, projectType: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none">
                      <option value="refit">Office Refit</option>
                      <option value="relocation">Relocation</option>
                      <option value="expansion">Expansion</option>
                      <option value="new_office">New Office</option>
                      <option value="executive_suite">Executive Suite</option>
                      <option value="hot_desk">Hot-Desk Setup</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Industry Context</label>
                    <input value={form.industryContext} onChange={e => setForm(f => ({ ...f, industryContext: e.target.value }))} placeholder="e.g. Technology, Legal, Finance" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" data-testid="input-industry" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Budget Range</label>
                    <select value={form.budgetRange} onChange={e => setForm(f => ({ ...f, budgetRange: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none">
                      <option value="">Not specified</option>
                      <option value="Value">Value (cost-effective)</option>
                      <option value="Balanced">Balanced (mid-range)</option>
                      <option value="Premium">Premium (high-end)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs mb-1 block">Style Preference</label>
                    <input value={form.stylePreference} onChange={e => setForm(f => ({ ...f, stylePreference: e.target.value }))} placeholder="e.g. Executive, Collaborative" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-zinc-500" />
                  </div>
                </div>
                <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !form.officeSqm || !form.staffCount} className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white rounded-xl py-3.5 text-sm font-medium transition-colors mt-2" data-testid="button-generate-strategy">
                  {generateMutation.isPending ? <><Sparkles className="w-4 h-4 animate-spin" /> Generating Strategy...</> : <><Brain className="w-4 h-4" /> Generate Strategy</>}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5"><Lightbulb className="w-5 h-5 text-amber-400" /><span className="text-white font-semibold">How the Strategy Engine Works</span></div>
              <div className="space-y-4">
                {[
                  { step: "1", title: "Density Analysis", desc: "Calculates sqm-per-person density and compares against industry norms to recommend the ideal layout type (open plan, hybrid, executive, etc.).", icon: LayoutGrid },
                  { step: "2", title: "Learning Database", desc: "Cross-references your project parameters against accumulated workspace learning records from previous projects to benchmark estimates.", icon: Brain },
                  { step: "3", title: "Package Optimisation", desc: "Selects the optimal furniture package tier (Premium, Balanced, Value) based on budget signals, industry standards, and margin targets.", icon: Target },
                  { step: "4", title: "Profit Prediction", desc: "Calculates predicted project value, gross profit, and margin percentage using historical margin data from your profit engine.", icon: TrendingUp },
                ].map(({ step, title, desc, icon: Icon }) => (
                  <div key={step} className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5"><span className="text-violet-400 font-bold text-sm">{step}</span></div>
                    <div><div className="text-white text-sm font-medium mb-1">{title}</div><p className="text-zinc-400 text-xs leading-relaxed">{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {view === "history" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">{strategies.length} strategies generated</span>
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/workspace-strategy"] })} className="p-1.5 text-zinc-500 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
              </div>
              {strategiesLoading ? (
                Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-20 animate-pulse" />)
              ) : strategies.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                  <Brain className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <div className="text-zinc-400 text-sm">No strategies yet</div>
                  <button onClick={() => setView("generate")} className="text-violet-400 text-xs mt-1 hover:underline">Generate your first strategy →</button>
                </div>
              ) : strategies.map(strat => (
                <div key={strat.id} onClick={() => setSelectedStrategy(strat)} className={`bg-zinc-900 border rounded-2xl p-4 cursor-pointer transition-all hover:border-zinc-600 ${selectedStrategy?.id === strat.id ? "border-violet-500/40" : "border-zinc-800"}`} data-testid={`card-strategy-${strat.id}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-white text-sm font-medium">{strat.officeSqm} sqm · {strat.staffCount} staff</span>
                    {strat.recommendedPackageTier && <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_COLORS[strat.recommendedPackageTier] ?? ""}`}>{strat.recommendedPackageTier}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-xs">{strat.recommendedLayoutType?.replace(/_/g, " ") ?? "—"}</span>
                    {strat.predictedProjectValue && <span className="text-emerald-400 text-xs font-medium">{formatCurrency(strat.predictedProjectValue)}</span>}
                  </div>
                  {strat.confidenceScore !== undefined && (
                    <div className="mt-2"><ConfidenceBar score={strat.confidenceScore} /></div>
                  )}
                </div>
              ))}
            </div>

            {/* Strategy Detail */}
            <div className="xl:col-span-2">
              {selectedStrategy ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-violet-400" />
                      <span className="text-white font-medium">Strategy Recommendation</span>
                      {selectedStrategy.recommendedPackageTier && <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_COLORS[selectedStrategy.recommendedPackageTier] ?? ""}`}>{selectedStrategy.recommendedPackageTier}</span>}
                    </div>
                    <button onClick={() => setSelectedStrategy(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-5 space-y-5 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {/* Core Metrics */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {[
                        { label: "Office Size", value: selectedStrategy.officeSqm ? `${selectedStrategy.officeSqm} sqm` : "—" },
                        { label: "Staff", value: selectedStrategy.staffCount ?? "—" },
                        { label: "Layout", value: selectedStrategy.recommendedLayoutType?.replace(/_/g, " ") ?? "—" },
                        { label: "Confidence", value: selectedStrategy.confidenceScore ? `${selectedStrategy.confidenceScore}%` : "—" },
                        { label: "Data Points", value: selectedStrategy.dataSourcesUsed ?? 0 },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-zinc-800 rounded-xl p-3 text-center">
                          <div className="text-white text-sm font-semibold">{value}</div>
                          <div className="text-zinc-500 text-xs mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Financial Predictions */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-emerald-400" /><span className="text-white font-medium text-sm">Financial Projections</span></div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "Budget Low", value: formatCurrency(selectedStrategy.budgetEstimateLow) },
                          { label: "Budget High", value: formatCurrency(selectedStrategy.budgetEstimateHigh) },
                          { label: "Gross Profit", value: formatCurrency(selectedStrategy.predictedGrossProfit) },
                          { label: "Margin", value: selectedStrategy.predictedMarginPct ? `${selectedStrategy.predictedMarginPct}%` : "—" },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div className="text-zinc-500 text-xs">{label}</div>
                            <div className="text-emerald-400 font-semibold text-sm mt-0.5">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Workspace Concept */}
                    {selectedStrategy.workspaceConcept && (
                      <div>
                        <div className="text-zinc-400 text-xs mb-2 font-medium">Workspace Concept</div>
                        <p className="text-zinc-300 text-sm leading-relaxed">{selectedStrategy.workspaceConcept}</p>
                      </div>
                    )}

                    {/* Zones */}
                    {renderZones(selectedStrategy.recommendedZonesJson) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3"><Map className="w-4 h-4 text-blue-400" /><span className="text-white font-medium text-sm">Zone Allocation</span></div>
                        <div className="space-y-2">
                          {renderZones(selectedStrategy.recommendedZonesJson)!.map(({ zone, percentage, sqm }) => (
                            <div key={zone} className="flex items-center gap-3">
                              <div className="flex-1"><div className="flex items-center justify-between mb-0.5"><span className="text-zinc-300 text-xs capitalize">{zone}</span><span className="text-zinc-500 text-xs">{percentage}% · {sqm} sqm</span></div><div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${percentage}%` }} /></div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Furniture Recommendations */}
                    {renderFurniture(selectedStrategy.recommendedFurnitureJson) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-amber-400" /><span className="text-white font-medium text-sm">Furniture Recommendations</span></div>
                        <div className="space-y-2">
                          {renderFurniture(selectedStrategy.recommendedFurnitureJson)!.map(({ category, suggestion, quantity }) => (
                            <div key={category} className="flex items-start gap-3 bg-zinc-800/50 rounded-xl p-3">
                              <div className="flex-1"><div className="text-white text-xs font-medium">{category}</div><div className="text-zinc-400 text-xs mt-0.5">{suggestion}</div></div>
                              <span className="text-zinc-500 text-xs shrink-0">×{quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Insights */}
                    {selectedStrategy.keyInsights && selectedStrategy.keyInsights.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-yellow-400" /><span className="text-white font-medium text-sm">Key Insights</span></div>
                        <div className="space-y-2">
                          {selectedStrategy.keyInsights.map((insight, i) => (
                            <div key={i} className="flex gap-2.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /><span className="text-zinc-300 text-xs leading-relaxed">{insight}</span></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Proposal Summary */}
                    {selectedStrategy.proposalSummary && (
                      <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-4">
                        <div className="text-violet-400 text-xs mb-2 font-medium">Client Proposal Summary</div>
                        <p className="text-zinc-300 text-sm leading-relaxed">{selectedStrategy.proposalSummary}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                  <Brain className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                  <div className="text-zinc-400 font-medium">Select a strategy to view details</div>
                  <p className="text-zinc-600 text-sm mt-1">Or generate a new strategy recommendation</p>
                  <button onClick={() => setView("generate")} className="mt-4 flex items-center gap-2 bg-violet-700 hover:bg-violet-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium mx-auto transition-colors"><Sparkles className="w-4 h-4" /> Generate Strategy</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {view === "insights" && (
          <div className="space-y-6">
            {insightsLoading ? (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-24 animate-pulse" />)}</div>
            ) : insights ? (
              <>
                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Learning Records", value: insights.totalRecords, icon: Brain, color: "violet" },
                    { label: "Avg Project Value", value: formatCurrency(insights.avgProjectValue), icon: DollarSign, color: "emerald" },
                    { label: "Avg Gross Margin", value: `${insights.avgMarginPct}%`, icon: TrendingUp, color: "blue" },
                    { label: "Avg Sqm/Person", value: `${insights.avgSqmPerPerson} sqm`, icon: Users, color: "amber" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                      <div className={`w-9 h-9 rounded-xl bg-${color}-500/10 flex items-center justify-center mb-3`}><Icon className={`w-5 h-5 text-${color}-400`} /></div>
                      <div className="text-2xl font-bold text-white">{value}</div>
                      <div className="text-zinc-500 text-sm mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Dominant patterns */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-5"><Star className="w-4 h-4 text-yellow-400" /><span className="text-white font-medium">Dominant Patterns</span></div>
                    <div className="space-y-4">
                      <div><div className="text-zinc-500 text-xs mb-1">Most Common Layout</div><div className="text-white font-medium capitalize">{insights.topLayoutType.replace(/_/g, " ")} {LAYOUT_ICONS[insights.topLayoutType] ?? ""}</div></div>
                      <div><div className="text-zinc-500 text-xs mb-1">Top Package Tier</div><div className={`inline-block text-sm px-2.5 py-0.5 rounded-full border ${TIER_COLORS[insights.topPackageTier] ?? ""}`}>{insights.topPackageTier}</div></div>
                      <div><div className="text-zinc-500 text-xs mb-1">Primary Industry</div><div className="text-white font-medium">{insights.topIndustry}</div></div>
                    </div>
                  </div>

                  {/* Layout Breakdown */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4"><LayoutGrid className="w-4 h-4 text-blue-400" /><span className="text-white font-medium">Layout Performance</span></div>
                    {insights.layoutBreakdown.length === 0 ? (
                      <div className="text-zinc-500 text-sm text-center py-4">No data yet — generate some strategies first</div>
                    ) : (
                      <div className="space-y-3">
                        {insights.layoutBreakdown.map(({ layout, count, avgMargin }) => (
                          <div key={layout}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-zinc-300 text-sm capitalize">{layout.replace(/_/g, " ")}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-zinc-500 text-xs">{count} strategies</span>
                                <span className="text-emerald-400 text-xs font-medium">{avgMargin}% margin</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${Math.min(100, count * 15)}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Package Breakdown */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4"><Award className="w-4 h-4 text-amber-400" /><span className="text-white font-medium">Package Analysis</span></div>
                    {insights.packageBreakdown.length === 0 ? (
                      <div className="text-zinc-500 text-sm text-center py-4">No data yet</div>
                    ) : (
                      <div className="space-y-3">
                        {insights.packageBreakdown.map(({ package: pkg, count, avgValue }) => (
                          <div key={pkg} className="bg-zinc-800 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_COLORS[pkg] ?? ""}`}>{pkg}</span>
                              <span className="text-zinc-500 text-xs">{count} strategies</span>
                            </div>
                            <div className="text-emerald-400 text-sm font-medium">Avg {formatCurrency(avgValue)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <Brain className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <div className="text-zinc-400">Learning insights unavailable</div>
                <p className="text-zinc-600 text-sm mt-1">Generate strategies and accumulate workspace learning records to see patterns emerge</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
