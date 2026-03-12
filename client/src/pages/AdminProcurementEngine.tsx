import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Trash2, Loader2, BarChart3, Clock, DollarSign,
  ShieldCheck, MessageSquare, TrendingUp, AlertTriangle, CheckCircle2
} from "lucide-react";

interface ProcurementLine {
  category: string;
  quantity: number;
}

interface ProcurementResult {
  category: string;
  quantity: number;
  unitEstimate: string;
  totalEstimate: string;
  recommendedSupplier: string;
  supplierContact: string;
  leadTime: string;
  marginBand: string;
  notes: string;
}

const CATEGORIES = [
  "Task Chairs",
  "Executive Seating",
  "Desks",
  "Workstations",
  "Meeting Tables",
  "Boardroom Tables",
  "Reception Desks",
  "Executive Desks",
  "Acoustic Pods",
  "Storage",
  "Lounge",
  "Breakout Seating",
];

const SUPPLIER_NOTES: Record<string, { color: string; icon: any; note: string }> = {
  "Boke Furniture": {
    color: "border-l-4 border-blue-400 bg-blue-50",
    icon: CheckCircle2,
    note: "Seating specialist. Do NOT send desk or workstation requests to Boke.",
  },
  "Guangzhou Meiyi Furniture": {
    color: "border-l-4 border-emerald-400 bg-emerald-50",
    icon: CheckCircle2,
    note: "Primary for desks, workstations, meeting tables. Trusted contact — Asya.",
  },
  "Xitian Furniture (Ruby)": {
    color: "border-l-4 border-purple-400 bg-purple-50",
    icon: AlertTriangle,
    note: "Best for executive, reception, and custom pieces. WhatsApp number pending confirmation.",
  },
  "General Supplier": {
    color: "border-l-4 border-gray-300 bg-gray-50",
    icon: Package,
    note: "Route through Denny for sourcing support on non-specialist categories.",
  },
};

function parseMin(estimate: string): number {
  const match = estimate.match(/\$([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, "")) : 0;
}

export default function AdminProcurementEngine() {
  const [lines, setLines] = useState<ProcurementLine[]>([{ category: "Task Chairs", quantity: 20 }]);
  const [results, setResults] = useState<ProcurementResult[] | null>(null);
  const [projectLabel, setProjectLabel] = useState("");
  const { toast } = useToast();

  const addLine = () => setLines(l => [...l, { category: "Desks", quantity: 10 }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: keyof ProcurementLine, value: string | number) =>
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [key]: value } : line));

  const calcMutation = useMutation({
    mutationFn: () => fetch("/api/admin/procurement/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    }).then(r => r.json()),
    onSuccess: (data) => {
      setResults(data.recommendations);
    },
    onError: () => toast({ title: "Calculation failed", variant: "destructive" }),
  });

  const totalMin = results ? results.reduce((s, r) => s + parseMin(r.totalEstimate), 0) : 0;
  const totalMax = results ? results.reduce((s, r) => {
    const match = r.totalEstimate.match(/\$([\d,]+).*?\$([\d,]+)/);
    return s + (match ? parseInt(match[2].replace(/,/g, "")) : parseMin(r.totalEstimate));
  }, 0) : 0;

  const supplierGroups = results ? results.reduce((acc, r) => {
    if (!acc[r.recommendedSupplier]) acc[r.recommendedSupplier] = [];
    acc[r.recommendedSupplier].push(r);
    return acc;
  }, {} as Record<string, ProcurementResult[]>) : {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#c9a84c]" />
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title-procurement">Procurement Engine</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Build a product list → get supplier routing, unit cost estimates, lead times, and margin bands
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left — input */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Project Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Project label (e.g. Brisbane CBD 80 pax)"
                  value={projectLabel}
                  onChange={e => setProjectLabel(e.target.value)}
                  className="mb-4"
                  data-testid="input-project-label"
                />
                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`procurement-line-${i}`}>
                      <Select value={line.category} onValueChange={v => updateLine(i, "category", v)}>
                        <SelectTrigger className="flex-1 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={e => updateLine(i, "quantity", parseInt(e.target.value) || 1)}
                        className="w-20 h-9 text-sm text-center"
                        data-testid={`input-qty-${i}`}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => removeLine(i)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs text-gray-500"
                  onClick={addLine}
                  data-testid="button-add-line"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add category
                </Button>
                <Button
                  className="w-full mt-4 bg-gray-900 text-[#c9a84c] hover:bg-gray-800"
                  onClick={() => calcMutation.mutate()}
                  disabled={calcMutation.isPending}
                  data-testid="button-calculate"
                >
                  {calcMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating…</>
                  ) : (
                    <><BarChart3 className="w-4 h-4 mr-2" /> Calculate Procurement</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Routing rules summary */}
            <Card className="border-0 shadow-sm mt-4 bg-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-200">Supplier Routing Rules</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {[
                  { supplier: "Boke", rule: "Chairs & seating ONLY — no desks" },
                  { supplier: "Meiyi / Asya", rule: "Desks, workstations, meeting tables" },
                  { supplier: "Ruby / Xitian", rule: "Reception, executive, custom" },
                  { supplier: "Denny", rule: "Sourcing, coordination, non-specialist" },
                ].map(r => (
                  <div key={r.supplier} className="flex gap-2">
                    <span className="text-[#c9a84c] font-semibold w-24 flex-shrink-0">{r.supplier}</span>
                    <span className="text-gray-300">{r.rule}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right — results */}
          <div className="lg:col-span-3">
            {!results ? (
              <div className="flex items-center justify-center h-64 text-gray-300 flex-col gap-2">
                <Package className="w-12 h-12 opacity-20" />
                <p className="text-sm text-gray-400">Enter product lines and click Calculate</p>
              </div>
            ) : (
              <>
                {/* Total estimate */}
                <Card className="border-0 shadow-sm mb-5 bg-gray-900 text-white">
                  <CardContent className="p-5">
                    {projectLabel && <div className="text-[#c9a84c] text-xs font-semibold uppercase tracking-wide mb-2">{projectLabel}</div>}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="text-sm text-gray-400">Estimated Landed Cost (FOB + freight)</div>
                        <div className="text-3xl font-bold text-white mt-0.5">
                          ${totalMin.toLocaleString()} – ${totalMax.toLocaleString()} <span className="text-sm font-normal text-gray-400">AUD</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Margin Band</div>
                        <div className="text-xl font-bold text-[#c9a84c]">32–52%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* By supplier */}
                {Object.entries(supplierGroups).map(([supplier, items]) => {
                  const cfg = SUPPLIER_NOTES[supplier] || SUPPLIER_NOTES["General Supplier"];
                  const Icon = cfg.icon;
                  return (
                    <Card key={supplier} className="border-0 shadow-sm mb-4">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm">{supplier}</CardTitle>
                            <div className="text-xs text-gray-400 mt-0.5">{items[0]?.supplierContact}</div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3.5 h-3.5" /> {items[0]?.leadTime}
                          </div>
                        </div>
                        {cfg.note && (
                          <div className={`text-xs rounded px-3 py-2 mt-2 ${cfg.color}`}>
                            <Icon className="w-3.5 h-3.5 inline mr-1" />
                            {cfg.note}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {items.map(item => (
                            <div key={item.category} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0" data-testid={`procurement-result-${item.category}`}>
                              <div>
                                <span className="font-medium text-sm text-gray-900">{item.category}</span>
                                <span className="text-xs text-gray-400 ml-2">× {item.quantity}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-900">{item.totalEstimate}</div>
                                <div className="text-xs text-gray-400">{item.unitEstimate} / unit</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* WhatsApp draft hint */}
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-200 text-emerald-700"
                            onClick={() => {
                              const text = items.map(i => `- ${i.quantity}x ${i.category}`).join("\n");
                              navigator.clipboard.writeText(`Hi,\n\nWe're reviewing a project and would need the following:\n\n${text}\n\nCould you please confirm pricing, lead time, and MOQ?\n\nThank you.`);
                            }}
                            data-testid={`btn-copy-whatsapp-${supplier}`}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" /> Copy WhatsApp request
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
