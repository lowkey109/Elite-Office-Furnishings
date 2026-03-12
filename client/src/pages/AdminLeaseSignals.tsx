import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Building2, MapPin, TrendingUp, DollarSign, Target,
  RefreshCw, Mail, Copy, ChevronDown, ChevronRight, Users,
  BarChart3, Loader2, CheckCircle2, Briefcase, ArrowUpRight,
  Clock, Star, Brain, Scan
} from "lucide-react";
import { validateAdminLogin } from "@/lib/adminAuth";

interface ProspectedLead {
  id: string;
  company: string;
  location: string;
  industry: string;
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  outreachMessage: string;
  reasoning: string;
  status: string;
  sourceType: string | null;
  signalType: string | null;
  city: string | null;
  contactRole: string | null;
  dealProbability: number | null;
  estimatedOfficeSqm: string | null;
  estimatedHeadcount: string | null;
  recommendedNextAction: string | null;
  outreachSubject: string | null;
  scanBatchId: string | null;
  signalsDetected: string[];
  createdAt: string;
}

const SIGNAL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new_lease:         { label: "New Lease",         color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  relocation:        { label: "Relocation",         color: "bg-blue-100 text-blue-800 border-blue-200" },
  office_expansion:  { label: "Expansion",          color: "bg-purple-100 text-purple-800 border-purple-200" },
  refurbishment:     { label: "Refurbishment",      color: "bg-orange-100 text-orange-800 border-orange-200" },
  hiring_signals:    { label: "Hiring Signals",     color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  funding_growth:    { label: "Funding / Growth",   color: "bg-pink-100 text-pink-800 border-pink-200" },
  new_office_opening:{ label: "New Office Opening", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  territory_signal:  { label: "Territory Signal",   color: "bg-red-100 text-red-800 border-red-200" },
};

const PRIORITY_COLOR: Record<string, string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-gray-100 text-gray-600 border-gray-200",
};

function ProbabilityBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-gray-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{value}%</span>
    </div>
  );
}

export default function AdminLeaseSignals() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [scanCity, setScanCity] = useState("all");
  const [scanSignal, setScanSignal] = useState("all");
  const [scanCount, setScanCount] = useState("6");
  const { toast } = useToast();

  const { data: leads = [], isLoading } = useQuery<ProspectedLead[]>({
    queryKey: ["/api/admin/prospected-leads"],
    queryFn: () => fetch("/api/admin/prospected-leads").then(r => r.json()),
    refetchInterval: 30_000,
  });

  // Filter only AI-scanned leads (sourceType = "ai_scan")
  const scannedLeads = leads.filter(l => l.sourceType === "ai_scan" || l.signalType);

  const filtered = scannedLeads.filter(l => {
    if (cityFilter !== "all" && l.city !== cityFilter) return false;
    if (signalFilter !== "all" && l.signalType !== signalFilter) return false;
    if (priorityFilter !== "all" && l.priority !== priorityFilter) return false;
    return true;
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/lease-signal-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cities: scanCity === "all" ? ["Brisbane", "Melbourne", "Sydney"] : [scanCity],
          signalTypes: scanSignal === "all" ? [] : [scanSignal],
          count: parseInt(scanCount),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospected-leads"] });
      toast({ title: `Scan complete — ${data.count} new leads detected`, description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/admin/prospected-leads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/prospected-leads"] }),
  });

  // Pipeline stats from scanned leads
  const totalPipeline = scannedLeads.reduce((sum, l) => {
    const match = l.estimatedProjectValue.match(/\$([\d,]+)/);
    return sum + (match ? parseInt(match[1].replace(/,/g, "")) : 0);
  }, 0);
  const avgProbability = scannedLeads.length
    ? Math.round(scannedLeads.reduce((s, l) => s + (l.dealProbability || 60), 0) / scannedLeads.length)
    : 0;
  const highPriority = scannedLeads.filter(l => l.priority === "High").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#c9a84c]" />
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Lease Signal Intelligence</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              AI-detected office move, expansion, and lease signals across Brisbane, Melbourne & Sydney
            </p>
          </div>
          {/* Scan controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={scanCity} onValueChange={setScanCity}>
              <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-scan-city">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                <SelectItem value="Brisbane">Brisbane</SelectItem>
                <SelectItem value="Melbourne">Melbourne</SelectItem>
                <SelectItem value="Sydney">Sydney</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scanSignal} onValueChange={setScanSignal}>
              <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-scan-signal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All signal types</SelectItem>
                <SelectItem value="new_lease">New Lease</SelectItem>
                <SelectItem value="relocation">Relocation</SelectItem>
                <SelectItem value="office_expansion">Office Expansion</SelectItem>
                <SelectItem value="hiring_signals">Hiring Signals</SelectItem>
                <SelectItem value="funding_growth">Funding / Growth</SelectItem>
                <SelectItem value="new_office_opening">New Office Opening</SelectItem>
                <SelectItem value="refurbishment">Refurbishment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scanCount} onValueChange={setScanCount}>
              <SelectTrigger className="w-24 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 leads</SelectItem>
                <SelectItem value="5">5 leads</SelectItem>
                <SelectItem value="6">6 leads</SelectItem>
                <SelectItem value="8">8 leads</SelectItem>
                <SelectItem value="10">10 leads</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="h-9 bg-gray-900 hover:bg-gray-800 text-[#c9a84c] text-sm font-semibold px-4"
              data-testid="button-run-scan"
            >
              {scanMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Scanning…</>
              ) : (
                <><Scan className="w-3.5 h-3.5 mr-1.5" /> Run AI Scan</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Scanned Leads", value: scannedLeads.length, icon: Target, color: "text-gray-900" },
            { label: "High Priority", value: highPriority, icon: Star, color: "text-red-600" },
            { label: "Avg Deal Probability", value: `${avgProbability}%`, icon: BarChart3, color: "text-emerald-600" },
            { label: "Pipeline Value", value: `$${Math.round(totalPipeline / 1000)}k+`, icon: DollarSign, color: "text-[#c9a84c]" },
          ].map(stat => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                  </div>
                  <stat.icon className="w-5 h-5 text-gray-300 mt-0.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span className="text-sm font-medium text-gray-600">Filter:</span>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-city-filter">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              <SelectItem value="Brisbane">Brisbane</SelectItem>
              <SelectItem value="Melbourne">Melbourne</SelectItem>
              <SelectItem value="Sydney">Sydney</SelectItem>
            </SelectContent>
          </Select>
          <Select value={signalFilter} onValueChange={setSignalFilter}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Signal type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All signals</SelectItem>
              <SelectItem value="new_lease">New Lease</SelectItem>
              <SelectItem value="relocation">Relocation</SelectItem>
              <SelectItem value="office_expansion">Expansion</SelectItem>
              <SelectItem value="hiring_signals">Hiring</SelectItem>
              <SelectItem value="funding_growth">Funding</SelectItem>
              <SelectItem value="new_office_opening">New Office</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} leads</span>
        </div>

        {/* Lead list */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400"><Loader2 className="w-8 h-8 mx-auto animate-spin opacity-30" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-gray-500">No leads scanned yet</p>
            <p className="text-sm mt-1">Click "Run AI Scan" to detect new office opportunities</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(lead => {
              const signalCfg = SIGNAL_TYPE_LABELS[lead.signalType || ""] || { label: lead.signalType || "Signal", color: "bg-gray-100 text-gray-600 border-gray-200" };
              const isExpanded = expandedId === lead.id;
              return (
                <Card key={lead.id} className="border-0 shadow-sm hover:shadow-md transition-shadow" data-testid={`lead-card-${lead.id}`}>
                  <CardContent className="p-5">
                    {/* Main row */}
                    <div className="flex items-start gap-4">
                      {/* Score */}
                      <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gray-900 text-[#c9a84c] flex items-center justify-center text-base font-bold">
                        {lead.score}
                      </div>

                      {/* Company info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-base" data-testid={`lead-company-${lead.id}`}>{lead.company}</span>
                          <Badge variant="outline" className={`text-xs ${signalCfg.color}`}>{signalCfg.label}</Badge>
                          <Badge variant="outline" className={`text-xs ${PRIORITY_COLOR[lead.priority]}`}>{lead.priority}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{lead.city || lead.location}</span>
                          <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{lead.industry}</span>
                          {lead.estimatedHeadcount && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{lead.estimatedHeadcount}</span>}
                          {lead.estimatedOfficeSqm && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{lead.estimatedOfficeSqm}</span>}
                        </div>
                        {/* Signal tags */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {lead.signalsDetected.slice(0, 4).map((s, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-500">{s}</span>
                          ))}
                        </div>
                      </div>

                      {/* Right column */}
                      <div className="flex-shrink-0 text-right min-w-[140px]">
                        <div className="text-base font-bold text-gray-900">{lead.estimatedProjectValue}</div>
                        {lead.dealProbability !== null && (
                          <div className="mt-1.5 w-32 ml-auto">
                            <div className="text-xs text-gray-400 mb-1">Deal probability</div>
                            <ProbabilityBar value={lead.dealProbability} />
                          </div>
                        )}
                        {lead.contactRole && (
                          <div className="text-xs text-gray-400 mt-2">Contact: {lead.contactRole}</div>
                        )}
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                        data-testid={`btn-expand-${lead.id}`}
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
                        {isExpanded ? "Hide" : "View outreach + details"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const subject = lead.outreachSubject || "Your new office";
                          const body = lead.outreachMessage || "";
                          navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                          toast({ title: "Email copied to clipboard" });
                        }}
                        data-testid={`btn-copy-${lead.id}`}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy email
                      </Button>
                      <div className="ml-auto flex gap-1.5">
                        {(["New", "Contacted", "Qualified", "Closed"] as const).map(s => (
                          <Button
                            key={s}
                            size="sm"
                            variant={lead.status === s ? "default" : "outline"}
                            className={`h-7 px-2 text-xs ${lead.status === s ? "bg-gray-900 text-[#c9a84c]" : ""}`}
                            onClick={() => statusMutation.mutate({ id: lead.id, status: s })}
                            data-testid={`btn-status-${s.toLowerCase()}-${lead.id}`}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Outreach email */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Outreach Email</h4>
                          {lead.outreachSubject && (
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              Subject: <span className="text-gray-600 font-normal">{lead.outreachSubject}</span>
                            </div>
                          )}
                          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed border border-gray-100">
                            {lead.outreachMessage}
                          </div>
                        </div>
                        {/* Intelligence */}
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deal Intelligence</h4>
                            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-100">
                              {lead.reasoning}
                            </div>
                          </div>
                          {lead.recommendedNextAction && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                              <div className="text-xs font-semibold text-amber-700 mb-1">Recommended Next Action</div>
                              <div className="text-sm text-amber-800">{lead.recommendedNextAction}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
