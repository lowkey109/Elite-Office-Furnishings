import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, MapPin, Users, LayoutDashboard, Calendar, DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";
import { CATALOGUE } from "@/lib/furnitureCatalogue";
import { FinancePanel } from "@/components/FinancePanel";

interface WorkspaceZone {
  zone: string;
  color: string;
  percentage: number;
  description: string;
  priority: string;
  staffCapacity?: number;
  keyFurniture?: string[];
}

interface ProductRec {
  zone: string;
  sku: string;
  category: string;
  productName: string;
  seriesRecommendation: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  rationale: string;
}

interface CostBreakdown {
  furniture: number;
  installation: number;
  delivery: number;
  total: number;
  perStaff?: number;
}

interface LeadScoreBreakdown {
  companySize?: number;
  projectValue?: number;
  expansionSignals?: number;
  budgetClarity?: number;
  zonesRequired?: number;
  reasoning?: string;
}

interface AiRec {
  clientBrief?: string;
  officeType?: string;
  estimatedProjectValue?: string;
  leadScore?: number;
  leadScoreBreakdown?: LeadScoreBreakdown;
  implementationTimeline?: string;
  workspaceZones?: WorkspaceZone[];
  productRecommendations?: ProductRec[];
  costBreakdown?: CostBreakdown;
  styleDirection?: string;
  keyConsiderations?: string[];
  recommendedNextStep?: string;
  urgencyNote?: string;
}

interface PlanningReportProps {
  request: {
    name: string;
    company: string;
    email: string;
    phone: string;
    city?: string;
    projectType?: string;
    squareMetres?: string;
    staffCount?: string;
    budgetRange?: string;
    stylePreference?: string;
    aiSummary?: string;
    aiRecommendations?: string;
    leadScore?: number;
    estimatedValue?: string;
    implementationTimeline?: string;
    createdAt?: string;
  };
}

function fmt(n?: number) {
  if (!n) return "—";
  return "$" + n.toLocaleString("en-AU");
}

function formatDate(d?: string) {
  if (!d) return new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function PlanningReport({ request }: PlanningReportProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const aiRec: AiRec | null = (() => {
    try { return request.aiRecommendations ? JSON.parse(request.aiRecommendations) : null; } catch { return null; }
  })();

  const zones = aiRec?.workspaceZones ?? [];
  const recs = aiRec?.productRecommendations ?? [];
  const cost = aiRec?.costBreakdown;
  const leadScore = request.leadScore ?? aiRec?.leadScore;
  const timeline = request.implementationTimeline ?? aiRec?.implementationTimeline;
  const estimatedValue = request.estimatedValue ?? aiRec?.estimatedProjectValue;

  function handlePrint() {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !printRef.current) return;
    const content = printRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Workspace Planning Report – ${request.company || request.name}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Inter', sans-serif; color: #1a1a2e; background: #fff; font-size: 11pt; line-height: 1.5; }
            .cover { background: #0e1117; color: white; padding: 60px 50px; min-height: 220px; }
            .cover-logo { color: #C9A84C; font-size: 10pt; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 6px; }
            .cover-title { font-family: 'Playfair Display', serif; font-size: 28pt; font-weight: 700; color: white; margin-bottom: 8px; }
            .cover-sub { color: rgba(255,255,255,0.6); font-size: 11pt; }
            .cover-meta { margin-top: 24px; display: flex; gap: 40px; }
            .cover-meta-item label { color: rgba(255,255,255,0.4); font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; display: block; }
            .cover-meta-item span { color: #C9A84C; font-weight: 600; font-size: 11pt; }
            .section { padding: 32px 50px; border-bottom: 1px solid #eee; }
            .section-title { font-family: 'Playfair Display', serif; font-size: 16pt; font-weight: 700; color: #0e1117; margin-bottom: 16px; border-left: 4px solid #C9A84C; padding-left: 14px; }
            .brief-text { color: #444; font-size: 11pt; line-height: 1.7; }
            .zones-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .zone-card { border: 1px solid #eee; border-radius: 8px; padding: 14px; border-top: 4px solid; }
            .zone-name { font-weight: 700; font-size: 11pt; color: #0e1117; margin-bottom: 4px; }
            .zone-priority { font-size: 9pt; color: #888; margin-bottom: 8px; }
            .zone-desc { font-size: 10pt; color: #555; line-height: 1.5; }
            .zone-bar-container { display: flex; gap: 2px; height: 20px; border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
            .zone-bar-seg { display: flex; align-items: center; justify-content: center; font-size: 8pt; color: white; font-weight: 600; overflow: hidden; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8f5ee; text-align: left; padding: 10px 12px; font-size: 9pt; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 10px 12px; font-size: 10pt; border-bottom: 1px solid #f0f0f0; color: #333; }
            tr:last-child td { border-bottom: none; }
            .cost-row-total td { font-weight: 700; background: #fdf8ee; font-size: 11pt; color: #0e1117; }
            .sku { font-family: monospace; font-size: 9pt; color: #C9A84C; }
            .score-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14pt; }
            .score-high { background: #e8f5e9; color: #2e7d32; }
            .score-mid { background: #fff8e1; color: #f57f17; }
            .score-low { background: #fce4ec; color: #c62828; }
            .considerations li { padding: 6px 0; font-size: 10pt; color: #444; }
            .next-step { background: #f8f5ee; border-radius: 8px; padding: 16px 20px; border-left: 4px solid #C9A84C; }
            .footer { padding: 20px 50px; text-align: center; color: #999; font-size: 9pt; background: #f9f9f9; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  }

  const scoreColor = !leadScore ? "bg-white/5 text-white/40" : leadScore >= 70 ? "bg-green-500/15 text-green-400 border-green-500/30" : leadScore >= 40 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-red-500/15 text-red-400 border-red-500/30";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs">Downloadable workspace planning summary</p>
        <Button
          size="sm"
          onClick={handlePrint}
          data-testid="button-print-report"
          className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[36px]"
        >
          <Printer className="w-3.5 h-3.5 mr-1.5" /> Download / Print Report
        </Button>
      </div>

      <div ref={printRef} className="hidden">
        <div className="cover">
          <div className="cover-logo">THE CORPORATE DESK · thecorporatedesk.com.au</div>
          <div className="cover-title">Workspace Planning Report</div>
          <div className="cover-sub">{aiRec?.officeType || "Office Fit-Out Recommendation"}</div>
          <div className="cover-meta">
            <div className="cover-meta-item"><label>Prepared For</label><span>{request.company || request.name}</span></div>
            <div className="cover-meta-item"><label>Date</label><span>{formatDate(request.createdAt)}</span></div>
            {estimatedValue && <div className="cover-meta-item"><label>Est. Project Value</label><span>{estimatedValue}</span></div>}
            {timeline && <div className="cover-meta-item"><label>Timeline</label><span>{timeline}</span></div>}
          </div>
        </div>

        {aiRec?.clientBrief && (
          <div className="section">
            <div className="section-title">Project Brief</div>
            <p className="brief-text">{aiRec.clientBrief}</p>
            <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
              {request.squareMetres && <div><label style={{ fontSize: "9pt", color: "#999", textTransform: "uppercase" }}>Office Size</label><p style={{ fontWeight: 600, color: "#0e1117" }}>{request.squareMetres} sqm</p></div>}
              {request.staffCount && <div><label style={{ fontSize: "9pt", color: "#999", textTransform: "uppercase" }}>Staff Count</label><p style={{ fontWeight: 600, color: "#0e1117" }}>{request.staffCount} people</p></div>}
              {request.budgetRange && <div><label style={{ fontSize: "9pt", color: "#999", textTransform: "uppercase" }}>Budget Range</label><p style={{ fontWeight: 600, color: "#C9A84C" }}>{request.budgetRange}</p></div>}
            </div>
          </div>
        )}

        {zones.length > 0 && (
          <div className="section">
            <div className="section-title">Workspace Zone Layout</div>
            {zones.every(z => z.percentage) && (
              <div className="zone-bar-container">
                {zones.map((z, i) => (
                  <div key={i} className="zone-bar-seg" style={{ width: `${z.percentage}%`, background: z.color || "#B8960C" }}>
                    {z.percentage >= 10 ? `${z.percentage}%` : ""}
                  </div>
                ))}
              </div>
            )}
            <div className="zones-grid">
              {zones.map((z, i) => (
                <div key={i} className="zone-card" style={{ borderTopColor: z.color || "#B8960C" }}>
                  <div className="zone-name">{z.zone}</div>
                  <div className="zone-priority">{z.priority} {z.staffCapacity ? `· ${z.staffCapacity} staff capacity` : ""} {z.percentage ? `· ${z.percentage}% of floor` : ""}</div>
                  <div className="zone-desc">{z.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recs.length > 0 && (
          <div className="section">
            <div className="section-title">Furniture Recommendations</div>
            <table>
              <thead><tr><th>SKU</th><th>Product</th><th>Zone</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead>
              <tbody>
                {recs.map((p, i) => (
                  <tr key={i}>
                    <td><span className="sku">{p.sku}</span></td>
                    <td>{p.productName || CATALOGUE.find(c => c.sku === p.sku)?.name || p.category}</td>
                    <td>{p.zone}</td>
                    <td>{p.quantity}</td>
                    <td>{p.unitCost ? fmt(p.unitCost) : "POA"}</td>
                    <td>{p.totalCost ? fmt(p.totalCost) : "POA"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cost && (
          <div className="section">
            <div className="section-title">Project Cost Estimate</div>
            <table>
              <tbody>
                <tr><td>Furniture Supply</td><td style={{ textAlign: "right" }}>{fmt(cost.furniture)}</td></tr>
                <tr><td>Installation & Labour</td><td style={{ textAlign: "right" }}>{fmt(cost.installation)}</td></tr>
                <tr><td>Delivery & Logistics</td><td style={{ textAlign: "right" }}>{fmt(cost.delivery)}</td></tr>
                <tr className="cost-row-total"><td>Total Estimated Investment (inc. GST)</td><td style={{ textAlign: "right" }}>{fmt(cost.total)}</td></tr>
                {cost.perStaff && <tr><td style={{ color: "#888", fontSize: "10pt" }}>Per-staff cost</td><td style={{ textAlign: "right", color: "#888", fontSize: "10pt" }}>{fmt(cost.perStaff)}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {timeline && (
          <div className="section">
            <div className="section-title">Implementation Timeline</div>
            <p style={{ fontSize: "13pt", fontWeight: 700, color: "#0e1117" }}>{timeline}</p>
            {aiRec?.keyConsiderations && aiRec.keyConsiderations.length > 0 && (
              <>
                <p style={{ marginTop: "16px", marginBottom: "8px", fontWeight: 600, color: "#555", fontSize: "10pt" }}>Key Considerations</p>
                <ul className="considerations">
                  {aiRec.keyConsiderations.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {aiRec?.recommendedNextStep && (
          <div className="section">
            <div className="section-title">Recommended Next Step</div>
            <div className="next-step">{aiRec.recommendedNextStep}</div>
            {aiRec?.styleDirection && <p style={{ marginTop: "16px", color: "#555", fontSize: "10pt", lineHeight: "1.6" }}>{aiRec.styleDirection}</p>}
          </div>
        )}

        <div className="footer">
          <p>This report was prepared by The Corporate Desk · 1300 977 607 · service@thecorporatedesk.com.au · thecorporatedesk.com.au</p>
          <p style={{ marginTop: "4px" }}>10 Primrose St Bowen Hills QLD 4006 · This is a preliminary estimate only — final pricing subject to detailed specification.</p>
        </div>
      </div>

      <div className="bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.12)] rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {estimatedValue && (
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 text-center">
              <DollarSign className="w-4 h-4 text-[hsl(43,78%,52%)] mx-auto mb-1" />
              <p className="text-[hsl(43,78%,65%)] font-bold text-sm">{estimatedValue}</p>
              <p className="text-white/40 text-xs">Est. Value</p>
            </div>
          )}
          {timeline && (
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 text-center">
              <Calendar className="w-4 h-4 text-[hsl(43,78%,52%)] mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{timeline}</p>
              <p className="text-white/40 text-xs">Timeline</p>
            </div>
          )}
          {leadScore != null && (
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 text-center">
              <TrendingUp className="w-4 h-4 text-[hsl(43,78%,52%)] mx-auto mb-1" />
              <p className={`font-bold text-sm border rounded-full inline-block px-2 py-0.5 ${scoreColor}`}>{leadScore}/100</p>
              <p className="text-white/40 text-xs mt-1">Lead Score</p>
            </div>
          )}
          {cost?.total && (
            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg p-3 text-center">
              <LayoutDashboard className="w-4 h-4 text-[hsl(43,78%,52%)] mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{fmt(cost.total)}</p>
              <p className="text-white/40 text-xs">Budget Est.</p>
            </div>
          )}
        </div>

        {aiRec?.recommendedNextStep && (
          <div className="border-t border-[rgba(255,255,255,0.05)] pt-4">
            <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Recommended Next Step
            </p>
            <p className="text-white/70 text-sm leading-relaxed">{aiRec.recommendedNextStep}</p>
          </div>
        )}

        {cost?.total && cost.total >= 15000 && (
          <div className="border-t border-[rgba(255,255,255,0.05)] pt-4">
            <FinancePanel
              projectValue={cost.total}
              sourcePage="AI Office Planner"
              compact
            />
          </div>
        )}

        <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 text-xs text-white/30">
          Includes: project brief · workspace zones · furniture recommendations · cost estimate · implementation timeline
        </div>
      </div>
    </div>
  );
}
