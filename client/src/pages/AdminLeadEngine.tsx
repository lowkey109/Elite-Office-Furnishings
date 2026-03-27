import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Zap, Upload, RefreshCw, Search, TrendingUp, Globe, Linkedin,
  MapPin, FileText, CheckCircle, Filter, Download, Plus
} from "lucide-react";


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
  const fileRef = useRef<HTMLInputElement>(null);

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
    mutationFn: () => apiRequest("/api/admin/lead-engine/seed", { method: "POST" }),
    onSuccess: (d: any) => {
      toast({ title: `✓ Seeded ${d.added} AU leads`, description: `${d.skipped} duplicates skipped` });
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Seed failed", description: e.message, variant: "destructive" }),
  });

  const linkedinMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/lead-engine/scrape/linkedin", { method: "POST" }),
    onSuccess: (d: any) => {
      toast({ title: `LinkedIn: ${d.added} new leads`, description: `${d.skipped} skipped` });
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Scraper error", description: e.message, variant: "destructive" }),
  });

  const mapsMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/lead-engine/scrape/maps", { method: "POST" }),
    onSuccess: (d: any) => {
      toast({ title: `Maps: ${d.added} new leads`, description: `${d.skipped} skipped` });
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Scraper error", description: e.message, variant: "destructive" }),
  });

  const csvMut = useMutation({
    mutationFn: (rows: any[]) => apiRequest("/api/admin/import-leads", { method: "POST", body: JSON.stringify({ rows }) }),
    onSuccess: (d: any) => {
      toast({ title: `CSV Import: ${d.added} added`, description: `${d.skipped} skipped, ${d.errors} errors` });
      setShowCsvModal(false); setCsvText("");
      qc.invalidateQueries({ queryKey: ["/api/admin/lead-engine"] });
    },
    onError: (e: any) => toast({ title: "Import error", description: e.message, variant: "destructive" }),
  });

  function parseCsv(text: string) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return { companyName: obj["companyname"] || obj["company"] || "", email: obj["email"], phone: obj["phone"], city: obj["city"] || "Sydney", contactName: obj["contactname"] || obj["contact"] };
    }).filter(r => r.companyName);
  }

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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(220,18%,12%)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-white font-semibold mb-2">CSV Import</h3>
            <p className="text-white/40 text-xs mb-3">Format: companyName, email, phone, city, contactName (first row = headers)</p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              className="w-full h-40 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 text-white text-xs font-mono resize-none outline-none focus:border-[rgba(201,168,76,0.4)]"
              placeholder={"companyName,email,phone,city\nAcme Corp,info@acme.com.au,02 9100 1000,Sydney\nBeta Ltd,hello@beta.com.au,03 8100 2000,Melbourne"}
              data-testid="input-csv"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { const rows = parseCsv(csvText); if (rows.length) csvMut.mutate(rows); else toast({ title: "No valid rows", variant: "destructive" }); }}
                disabled={csvMut.isPending}
                className="flex-1 bg-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.2)] border border-[rgba(201,168,76,0.2)] rounded-lg py-2 text-[hsl(43,78%,52%)] text-sm font-semibold transition-colors disabled:opacity-50"
                data-testid="btn-csv-submit"
              >{csvMut.isPending ? "Importing..." : "Import"}</button>
              <button onClick={() => setShowCsvModal(false)} className="px-4 py-2 text-white/50 hover:text-white/80 text-sm transition-colors">Cancel</button>
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
