import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, TrendingUp, Target, BarChart3, Building2,
  MapPin, ArrowUpRight, Loader2, Trophy, Clock, Zap
} from "lucide-react";

interface ProspectedLead {
  id: string;
  company: string;
  location: string;
  industry: string;
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  status: string;
  city: string | null;
  dealProbability: number | null;
  estimatedOfficeSqm: string | null;
  signalType: string | null;
  recommendedNextAction: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string;
  type: string;
  opportunityScore: number | null;
  opportunityTier: string | null;
  estimatedValueRange: string | null;
  createdAt: string;
}

const STATUS_COLS = [
  { key: "New",       label: "New Leads",     color: "border-t-blue-400",    bg: "bg-blue-50" },
  { key: "Contacted", label: "Contacted",      color: "border-t-yellow-400",  bg: "bg-yellow-50" },
  { key: "Qualified", label: "Qualified",      color: "border-t-purple-400",  bg: "bg-purple-50" },
  { key: "Closed",    label: "Won",            color: "border-t-emerald-400", bg: "bg-emerald-50" },
];

function parseValue(val: string | null | undefined): number {
  if (!val) return 0;
  const match = val.match(/\$([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, "")) : 0;
}

function ProbabilityPill({ value }: { value: number }) {
  const cls = value >= 70 ? "bg-emerald-100 text-emerald-700" : value >= 50 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cls}`}>{value}%</span>;
}

export default function AdminDealPipeline() {
  const [cityFilter, setCityFilter] = useState("all");

  const { data: prospects = [], isLoading: prospectsLoading } = useQuery<ProspectedLead[]>({
    queryKey: ["/api/admin/prospected-leads"],
    queryFn: () => fetch("/api/admin/prospected-leads").then(r => r.json()),
  });

  const { data: pipelineStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/pipeline-stats"],
    queryFn: () => fetch("/api/admin/pipeline-stats").then(r => r.json()),
  });

  const filtered = prospects.filter(l =>
    cityFilter === "all" || l.city === cityFilter || l.location?.includes(cityFilter)
  );

  // Pipeline computation
  const weightedPipeline = filtered.reduce((sum, l) => {
    const val = parseValue(l.estimatedProjectValue);
    const prob = (l.dealProbability ?? 60) / 100;
    return sum + val * prob;
  }, 0);

  const grossPipeline = filtered.reduce((sum, l) => sum + parseValue(l.estimatedProjectValue), 0);
  const wonDeals = filtered.filter(l => l.status === "Closed");
  const wonValue = wonDeals.reduce((sum, l) => sum + parseValue(l.estimatedProjectValue), 0);
  const highProb = filtered.filter(l => (l.dealProbability ?? 0) >= 70);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#c9a84c]" />
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title-pipeline">Deal Pipeline</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">Weighted revenue forecast across all prospected leads</p>
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-40 h-9 text-sm" data-testid="select-pipeline-city">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              <SelectItem value="Brisbane">Brisbane</SelectItem>
              <SelectItem value="Melbourne">Melbourne</SelectItem>
              <SelectItem value="Sydney">Sydney</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Forecast cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Gross Pipeline", value: `$${(grossPipeline / 1000).toFixed(0)}k`, sub: "all prospects", icon: DollarSign, color: "text-gray-900" },
            { label: "Weighted Forecast", value: `$${(weightedPipeline / 1000).toFixed(0)}k`, sub: "probability-adjusted", icon: BarChart3, color: "text-emerald-600" },
            { label: "High Probability", value: highProb.length, sub: "≥70% win chance", icon: Target, color: "text-blue-600" },
            { label: "Won Deals", value: `$${(wonValue / 1000).toFixed(0)}k`, sub: `${wonDeals.length} closed`, icon: Trophy, color: "text-[#c9a84c]" },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</div>
                    <div className="text-xs text-gray-400">{s.sub}</div>
                  </div>
                  <s.icon className="w-5 h-5 text-gray-200 mt-0.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pipeline board */}
        {prospectsLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {STATUS_COLS.map(col => {
              const colLeads = filtered.filter(l => l.status === col.key);
              const colValue = colLeads.reduce((s, l) => s + parseValue(l.estimatedProjectValue), 0);
              return (
                <div key={col.key}>
                  <div className={`rounded-t-lg border-t-4 ${col.color} ${col.bg} px-3 py-2.5 mb-2`}>
                    <div className="font-semibold text-gray-700 text-sm">{col.label}</div>
                    <div className="text-xs text-gray-500">{colLeads.length} leads · ${(colValue / 1000).toFixed(0)}k</div>
                  </div>
                  <div className="space-y-2">
                    {colLeads.length === 0 ? (
                      <div className="rounded-lg bg-white border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                        No leads
                      </div>
                    ) : colLeads.map(lead => (
                      <Card key={lead.id} className="border-0 shadow-sm" data-testid={`pipeline-card-${lead.id}`}>
                        <CardContent className="p-3">
                          <div className="font-semibold text-gray-900 text-sm truncate">{lead.company}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {lead.city && <span className="text-xs text-gray-400">{lead.city}</span>}
                            {lead.dealProbability !== null && (
                              <ProbabilityPill value={lead.dealProbability} />
                            )}
                          </div>
                          <div className="text-sm font-bold text-gray-900 mt-2">{lead.estimatedProjectValue}</div>
                          {lead.signalType && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">{lead.signalType.replace(/_/g, " ")}</div>
                          )}
                          {lead.recommendedNextAction && (
                            <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2 leading-relaxed">
                              {lead.recommendedNextAction}
                            </div>
                          )}
                          <div className="text-xs text-gray-300 mt-2">{new Date(lead.createdAt).toLocaleDateString("en-AU")}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pipeline stats from existing system */}
        {pipelineStats && !statsLoading && (
          <Card className="mt-8 border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inbound Lead Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Leads", value: pipelineStats.totalLeads ?? 0 },
                  { label: "High Opportunity", value: pipelineStats.highOpportunity ?? 0 },
                  { label: "Total Pipeline Value", value: pipelineStats.estimatedPipelineValue ? `$${(parseInt(pipelineStats.estimatedPipelineValue.replace(/[^0-9]/g, "")) / 1000).toFixed(0)}k+` : "—" },
                  { label: "Avg Opportunity Score", value: pipelineStats.avgScore ?? "—" },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl font-bold text-gray-900">{s.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
