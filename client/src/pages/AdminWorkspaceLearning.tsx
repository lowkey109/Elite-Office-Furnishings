import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, Users, Building2, DollarSign, BarChart3, ArrowLeft, Layers } from "lucide-react";
import { Link } from "wouter";

interface WorkspaceLearning {
  id: string;
  planningRequestId: string | null;
  clientName: string | null;
  clientCompany: string | null;
  city: string | null;
  projectType: string | null;
  officeSqm: string | null;
  staffCount: string | null;
  meetingRoomCount: string | null;
  receptionIncluded: boolean | null;
  breakoutIncluded: boolean | null;
  executiveOfficeIncluded: boolean | null;
  budgetRange: string | null;
  stylePreference: string | null;
  officeType: string | null;
  packageTier: string | null;
  estimatedCost: string | null;
  leadScore: number | null;
  workspaceZonesJson: string | null;
  productRecsJson: string | null;
  supplierMix: string | null;
  keyInsight: string | null;
  conversionResult: string | null;
  createdAt: string | null;
}

interface LearningStats {
  total: number;
  paid: number;
  pending: number;
  lost: number;
  avgSqm: string;
  avgStaff: string;
  tierCounts: Record<string, number>;
}

function conversionBadge(result: string | null) {
  if (result === "paid") return <Badge className="bg-emerald-600 text-white text-xs">Converted</Badge>;
  if (result === "lost") return <Badge className="bg-red-600 text-white text-xs">Lost</Badge>;
  return <Badge className="bg-amber-500 text-white text-xs">Pending</Badge>;
}

function tierBadge(tier: string | null) {
  if (tier === "Executive") return <Badge className="bg-amber-700 text-white text-xs">Executive</Badge>;
  if (tier === "Professional") return <Badge className="bg-slate-600 text-white text-xs">Professional</Badge>;
  return <Badge variant="outline" className="text-xs">Foundation</Badge>;
}

function parseZones(json: string | null): Array<{ zone: string; pct: number }> {
  try { return JSON.parse(json || "[]"); } catch { return []; }
}

export default function AdminWorkspaceLearning() {
  const { data: records = [], isLoading } = useQuery<WorkspaceLearning[]>({
    queryKey: ["/api/admin/workspace-learning"],
  });

  const { data: stats } = useQuery<LearningStats>({
    queryKey: ["/api/admin/workspace-learning/stats/summary"],
  });

  const conversionRate = stats && stats.total > 0
    ? ((stats.paid / stats.total) * 100).toFixed(0)
    : "0";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <button data-testid="back-to-admin" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Admin
            </button>
          </Link>
          <div className="h-4 w-px bg-gray-700" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">Workspace Learning System</h1>
              <p className="text-xs text-gray-400">Auto-captured project intelligence from every AI Planner submission</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-[#111] border-[#222]">
              <CardContent className="p-4">
                <p className="text-xs text-gray-400 mb-1">Total Captured</p>
                <p className="text-2xl font-bold text-white" data-testid="stat-total">{stats.total}</p>
                <p className="text-xs text-gray-500 mt-1">planning sessions</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111] border-[#222]">
              <CardContent className="p-4">
                <p className="text-xs text-gray-400 mb-1">Conversion Rate</p>
                <p className="text-2xl font-bold text-emerald-400" data-testid="stat-conversion">{conversionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">{stats.paid} paid of {stats.total}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111] border-[#222]">
              <CardContent className="p-4">
                <p className="text-xs text-gray-400 mb-1">Avg Office Size</p>
                <p className="text-2xl font-bold text-blue-400" data-testid="stat-sqm">{stats.avgSqm}m²</p>
                <p className="text-xs text-gray-500 mt-1">across all sessions</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111] border-[#222]">
              <CardContent className="p-4">
                <p className="text-xs text-gray-400 mb-1">Avg Headcount</p>
                <p className="text-2xl font-bold text-amber-400" data-testid="stat-staff">{stats.avgStaff}</p>
                <p className="text-xs text-gray-500 mt-1">staff per project</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tier Distribution */}
        {stats && Object.keys(stats.tierCounts).length > 0 && (
          <Card className="bg-[#111] border-[#222] mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" />
                Package Tier Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                {Object.entries(stats.tierCounts).map(([tier, count]) => (
                  <div key={tier} className="flex items-center gap-2">
                    {tierBadge(tier)}
                    <span className="text-white font-semibold">{count}</span>
                    <span className="text-gray-500 text-xs">
                      ({stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Records Table */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              All Captured Sessions ({records.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading workspace intelligence...</div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center">
                <Brain className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm font-medium">No workspace learning records yet</p>
                <p className="text-gray-600 text-xs mt-1">Records are auto-captured when clients submit the AI Office Planner</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#222]">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Client</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Project</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Size</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Tier</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Est. Value</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Score</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Zones</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Suppliers</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const zones = parseZones(r.workspaceZonesJson);
                      return (
                        <tr
                          key={r.id}
                          data-testid={`workspace-learning-row-${r.id}`}
                          className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors"
                        >
                          <td className="py-3 px-4">
                            <p className="text-white font-medium text-xs">{r.clientName || "—"}</p>
                            <p className="text-gray-500 text-xs">{r.clientCompany || ""}{r.city ? ` · ${r.city}` : ""}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-gray-300 text-xs">{r.officeType || r.projectType || "—"}</p>
                            <p className="text-gray-600 text-xs">{r.stylePreference || ""}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-gray-300 text-xs">
                              <Building2 className="w-3 h-3 text-gray-500" />
                              {r.officeSqm ? `${r.officeSqm}m²` : "—"}
                            </div>
                            <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                              <Users className="w-3 h-3" />
                              {r.staffCount || "—"} staff
                            </div>
                          </td>
                          <td className="py-3 px-4">{tierBadge(r.packageTier)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-gray-300 text-xs">
                              <DollarSign className="w-3 h-3 text-emerald-500" />
                              {r.estimatedCost || "—"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {r.leadScore !== null ? (
                              <div className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-amber-400" />
                                <span className={`text-xs font-semibold ${r.leadScore >= 70 ? "text-emerald-400" : r.leadScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                                  {r.leadScore}
                                </span>
                              </div>
                            ) : <span className="text-gray-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            {zones.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {zones.slice(0, 3).map((z) => (
                                  <div key={z.zone} className="text-xs text-gray-400">
                                    <span className="text-gray-300">{z.zone}</span>
                                    <span className="text-gray-600 ml-1">{z.pct}%</span>
                                  </div>
                                ))}
                                {zones.length > 3 && <span className="text-gray-600 text-xs">+{zones.length - 3} more</span>}
                              </div>
                            ) : <span className="text-gray-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-gray-400 text-xs leading-relaxed max-w-[160px]">{r.supplierMix || "—"}</p>
                          </td>
                          <td className="py-3 px-4">{conversionBadge(r.conversionResult)}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Key Insights Panel */}
        {records.filter(r => r.keyInsight).length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {records.filter(r => r.keyInsight).slice(0, 6).map(r => (
              <div
                key={r.id}
                data-testid={`insight-card-${r.id}`}
                className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-300">{r.clientCompany || r.clientName || "Client"}</p>
                  {conversionBadge(r.conversionResult)}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{r.keyInsight}</p>
                {r.supplierMix && (
                  <p className="text-xs text-violet-400 mt-2">Suppliers: {r.supplierMix}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
