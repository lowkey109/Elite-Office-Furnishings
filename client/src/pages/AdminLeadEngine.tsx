import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Zap, Upload, RefreshCw, Search, TrendingUp, Globe, Linkedin,
  MapPin, FileText, CheckCircle, Filter, Download, Plus, AlertCircle, XCircle, Loader2
} from "lucide-react";

type PreviewRow = {
  row: number;
  data: Record<string, unknown>;
  status: "valid" | "invalid" | "duplicate";
  reason?: string;
};

type PreviewResult = {
  valid: PreviewRow[];
  invalid: PreviewRow[];
  duplicates: PreviewRow[];
  totalRows: number;
};


const SOURCE_COLORS: Record<string, string> = {
  linkedin: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  maps: "text-green-400 bg-green-400/10 border-green-400/20",
  website_form: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  csv: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  manual_seed: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  manual: "text-white/60 bg-white/5 border-white/10",
};

const SIGNAL_COLORS: Record<string, string> = {
  expansion: "text-cyan-400",
  relocation: "text-violet-400",
  hiring: "text-blue-400",
  real_estate: "text-green-400",
  website_form: "text-orange-400",
};

export default function AdminLeadEngine() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [csvText, setCsvText] = useState("");
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function closeCsvModal() {
    setShowCsvModal(false);
    setCsvText("");
    setPreviewData(null);
  }

  async function handlePreview() {
    if (!csvText.trim()) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/leads/preview-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreviewData(data);
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string ?? "");
      setPreviewData(null);
    };
    reader.readAsText(file);
  }

  const { data: stats, refetch: refetchStats } = useQuery<{
    total: number; todayCount: number; avgScore: number;
    bySource: Record<string, number>; byStatus: Record<string, number>;
  }>({ queryKey: ["/api/admin/lead-engine/stats"], refetchInterval: 30000 });

  const { data: leadsData, refetch: refetchLeads, isLoading } = useQuery<{
    leads: Array<{
      id: string; companyName: string; contactName?: string; email?: string; phone?: string;
      city: string; state?: string; source: string; signalType: string; notes?: string;
      estimatedValue?: number; score: number; status: string; createdAt: string;
    }>; total: number;
  }>({
    queryKey: ["/api/admin/lead-engine/leads", sourceFilter],
    queryFn: () => fetch(`/api/admin/lead-engine/leads${sourceFilter ? `?source=${sourceFilter}` : ""}`).then(r => r.json()),
  });

  const seedMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/lead-engine/seed"),
    onSuccess: (d: any) => {
      toast({ title: `✓ Seeded ${d.added} AU leads`, description: `${d.skipped} duplicates skipped` });
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Seed failed", description: e.message, variant: "destructive" }),
  });

  const linkedinMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/lead-engine/scrape/linkedin"),
    onSuccess: (d: any) => {
      toast({ title: `LinkedIn: ${d.added} new leads`, description: `${d.skipped} skipped` });
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Scraper error", description: e.message, variant: "destructive" }),
  });

  const mapsMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/lead-engine/scrape/maps"),
    onSuccess: (d: any) => {
      toast({ title: `Maps: ${d.added} new leads`, description: `${d.skipped} skipped` });
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Scraper error", description: e.message, variant: "destructive" }),
  });

  const csvMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leads/import-csv", JSON.stringify({ csv: csvText })),
    onSuccess: (d: any) => {
      toast({ title: `CSV Import: ${d.imported} imported`, description: `${d.duplicates} duplicates skipped, ${d.invalid} invalid` });
      closeCsvModal();
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Import error", description: e.message, variant: "destructive" }),
  });

  const leads = leadsData?.leads ?? [];

  return (
    <div className="min-h-screen bg-[hsl(220,18%,7%)] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/admin/command-centre" className="text-white/40 hover:text-white/70 text-xs transition-colors">← Command Centre</a>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[hsl(43,78%,52%)]" />
            Real Lead Engine
          </h1>
          <p className="text-white/50 text-sm mt-0.5">50–200 qualified leads per day — AI-scored, deduplicated, and auto-routed to the deal pipeline</p>
        </div>
        <button onClick={() => { refetchStats(); refetchLeads(); }} className="text-white/30 hover:text-white/60 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Leads", value: stats?.total ?? 0, color: "text-white", sub: "all time" },
          { label: "Today", value: stats?.todayCount ?? 0, color: "text-green-400", sub: "ingested" },
          { label: "Avg Score", value: stats?.avgScore ?? 0, color: "text-amber-400", sub: "/ 100" },
          { label: "Active", value: stats?.byStatus?.["new"] ?? 0, color: "text-cyan-400", sub: "in pipeline" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Source breakdown */}
      {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mb-4">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-3">Sources</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
              <button
                key={src}
                onClick={() => setSourceFilter(sourceFilter === src ? "" : src)}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${SOURCE_COLORS[src] ?? "text-white/60 bg-white/5 border-white/10"} ${sourceFilter === src ? "ring-1 ring-white/30" : ""}`}
                data-testid={`filter-source-${src}`}
              >
                {src} <span className="font-bold">{count}</span>
              </button>
            ))}
            {sourceFilter && (
              <button onClick={() => setSourceFilter("")} className="text-[10px] px-2 py-1 text-white/40 hover:text-white/70">✕ clear</button>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => seedMut.mutate()}
          disabled={seedMut.isPending}
          className="flex flex-col items-center gap-1.5 bg-[rgba(201,168,76,0.08)] hover:bg-[rgba(201,168,76,0.14)] border border-[rgba(201,168,76,0.2)] rounded-xl px-4 py-3 text-[hsl(43,78%,52%)] transition-colors disabled:opacity-50"
          data-testid="btn-seed-leads"
        >
          <Globe className="w-4 h-4" />
          <span className="text-xs font-semibold">{seedMut.isPending ? "Seeding..." : "Seed 25 AU Leads"}</span>
        </button>
        <button
          onClick={() => linkedinMut.mutate()}
          disabled={linkedinMut.isPending}
          className="flex flex-col items-center gap-1.5 bg-[rgba(59,130,246,0.08)] hover:bg-[rgba(59,130,246,0.14)] border border-[rgba(59,130,246,0.2)] rounded-xl px-4 py-3 text-blue-400 transition-colors disabled:opacity-50"
          data-testid="btn-linkedin-scraper"
        >
          <Linkedin className="w-4 h-4" />
          <span className="text-xs font-semibold">{linkedinMut.isPending ? "Running..." : "LinkedIn Scraper"}</span>
        </button>
        <button
          onClick={() => mapsMut.mutate()}
          disabled={mapsMut.isPending}
          className="flex flex-col items-center gap-1.5 bg-[rgba(34,197,94,0.08)] hover:bg-[rgba(34,197,94,0.14)] border border-[rgba(34,197,94,0.2)] rounded-xl px-4 py-3 text-green-400 transition-colors disabled:opacity-50"
          data-testid="btn-maps-scraper"
        >
          <MapPin className="w-4 h-4" />
          <span className="text-xs font-semibold">{mapsMut.isPending ? "Running..." : "Maps Scraper"}</span>
        </button>
        <button
          onClick={() => setShowCsvModal(true)}
          className="flex flex-col items-center gap-1.5 bg-[rgba(251,146,60,0.08)] hover:bg-[rgba(251,146,60,0.14)] border border-[rgba(251,146,60,0.2)] rounded-xl px-4 py-3 text-orange-400 transition-colors"
          data-testid="btn-csv-import"
        >
          <Upload className="w-4 h-4" />
          <span className="text-xs font-semibold">CSV Import</span>
        </button>
      </div>

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/75 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[hsl(220,18%,11%)] border border-[rgba(255,255,255,0.1)] rounded-2xl w-full max-w-2xl my-10">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-orange-400" /> CSV Import
                </h3>
                <p className="text-white/35 text-xs mt-0.5">Paste CSV or upload a file — preview before committing</p>
              </div>
              <button onClick={closeCsvModal} className="text-white/30 hover:text-white/60 transition-colors" data-testid="btn-csv-close">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Supported columns */}
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3">
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1.5">Supported CSV columns</p>
                <p className="text-white/50 text-xs font-mono">companyName, contactName, email, phone, city, notes, staffCount, budgetMin, budgetMax, estimatedValue, source</p>
                <p className="text-white/25 text-[10px] mt-1">Required: email. Recommended: companyName + contactName. First row must be headers.</p>
              </div>

              {/* File upload + textarea */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/50 text-xs">Paste CSV data</label>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="text-[10px] text-orange-400/80 hover:text-orange-400 border border-orange-400/20 hover:border-orange-400/40 px-2.5 py-1 rounded transition-colors"
                    data-testid="btn-upload-file"
                  >
                    Upload .csv file
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} data-testid="input-file-upload" />
                </div>
                <textarea
                  value={csvText}
                  onChange={e => { setCsvText(e.target.value); setPreviewData(null); }}
                  className="w-full h-36 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 text-white text-xs font-mono resize-none outline-none focus:border-[rgba(201,168,76,0.35)] transition-colors"
                  placeholder={"companyName,contactName,email,phone,city\nAcme Corp,Jane Smith,jane@acme.com.au,02 9100 1000,Sydney\nBeta Ltd,Mark Jones,mark@beta.com.au,03 8100 2000,Melbourne"}
                  data-testid="input-csv"
                />
              </div>

              {/* Preview results */}
              {previewData && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-3 text-center">
                      <div className="text-2xl font-light text-emerald-400" data-testid="stat-preview-valid">{previewData.valid.length}</div>
                      <div className="text-[10px] text-emerald-400/60 uppercase tracking-wide mt-0.5">Valid</div>
                    </div>
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3 text-center">
                      <div className="text-2xl font-light text-yellow-400" data-testid="stat-preview-duplicates">{previewData.duplicates.length}</div>
                      <div className="text-[10px] text-yellow-400/60 uppercase tracking-wide mt-0.5">Duplicates</div>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3 text-center">
                      <div className="text-2xl font-light text-red-400" data-testid="stat-preview-invalid">{previewData.invalid.length}</div>
                      <div className="text-[10px] text-red-400/60 uppercase tracking-wide mt-0.5">Invalid</div>
                    </div>
                  </div>

                  {/* Row-level detail for invalid rows */}
                  {previewData.invalid.length > 0 && (
                    <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                      <p className="text-red-400/70 text-[10px] uppercase tracking-wide mb-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Invalid rows (will be skipped)
                      </p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {previewData.invalid.map(r => (
                          <div key={r.row} className="flex gap-2 text-[10px]">
                            <span className="text-red-400/50 font-mono w-12 shrink-0">row {r.row}</span>
                            <span className="text-red-400/60">{r.reason}</span>
                            <span className="text-white/25 truncate">{String(r.data.email ?? r.data.company ?? "")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row-level detail for duplicates */}
                  {previewData.duplicates.length > 0 && (
                    <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-lg p-3">
                      <p className="text-yellow-400/70 text-[10px] uppercase tracking-wide mb-2">Duplicates (will be skipped)</p>
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {previewData.duplicates.map(r => (
                          <div key={r.row} className="flex gap-2 text-[10px]">
                            <span className="text-yellow-400/50 font-mono w-12 shrink-0">row {r.row}</span>
                            <span className="text-yellow-400/60">{r.reason}</span>
                            <span className="text-white/25 truncate">{String(r.data.email ?? r.data.company ?? "")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewData.valid.length === 0 && (
                    <p className="text-white/30 text-xs text-center py-2">No valid rows to import.</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {!previewData ? (
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading || !csvText.trim()}
                    className="flex-1 flex items-center justify-center gap-2 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)] rounded-lg py-2.5 text-white/70 text-sm font-medium transition-colors disabled:opacity-40"
                    data-testid="btn-csv-preview"
                  >
                    {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {previewLoading ? "Analysing..." : "Preview Import"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setPreviewData(null)}
                      className="px-4 py-2.5 text-white/40 hover:text-white/70 text-sm border border-[rgba(255,255,255,0.07)] rounded-lg transition-colors"
                      data-testid="btn-csv-back"
                    >
                      ← Edit
                    </button>
                    <button
                      onClick={() => csvMut.mutate()}
                      disabled={csvMut.isPending || previewData.valid.length === 0}
                      className="flex-1 flex items-center justify-center gap-2 bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.18)] border border-[rgba(201,168,76,0.25)] rounded-lg py-2.5 text-[hsl(43,78%,52%)] text-sm font-semibold transition-colors disabled:opacity-40"
                      data-testid="btn-csv-submit"
                    >
                      {csvMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {csvMut.isPending ? "Importing..." : `Import ${previewData.valid.length} lead${previewData.valid.length !== 1 ? "s" : ""}`}
                    </button>
                  </>
                )}
                <button onClick={closeCsvModal} className="px-4 py-2.5 text-white/40 hover:text-white/70 text-sm transition-colors" data-testid="btn-csv-cancel">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-[hsl(43,78%,52%)]" />
            Lead Pipeline
            <span className="text-white/30 text-xs">({leadsData?.total ?? 0} leads{sourceFilter ? ` — ${sourceFilter}` : ""})</span>
          </h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No leads yet — use the buttons above to seed or scrape</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)]">
                  {["Company", "Contact", "City", "Source", "Signal", "Value", "Score", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-white/30 text-[10px] uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={lead.id} className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${i % 2 === 0 ? "" : "bg-[rgba(255,255,255,0.01)]"}`} data-testid={`row-lead-${lead.id}`}>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-xs">{lead.companyName}</p>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">{lead.contactName ?? "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{lead.city}{lead.state ? `, ${lead.state}` : ""}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${SOURCE_COLORS[lead.source] ?? "text-white/50 bg-white/5 border-white/10"}`}>
                        {lead.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium ${SIGNAL_COLORS[lead.signalType] ?? "text-white/50"}`}>{lead.signalType}</span>
                    </td>
                    <td className="px-4 py-3 text-white/70 text-xs">{lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                          <div className="h-full bg-[hsl(43,78%,52%)] rounded-full" style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className="text-white/50 text-[10px]">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${lead.status === "qualified" ? "text-green-400 bg-green-400/10" : lead.status === "contacted" ? "text-blue-400 bg-blue-400/10" : "text-white/40 bg-white/5"}`}>
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
