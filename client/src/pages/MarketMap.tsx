import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Building2, TrendingUp, Filter, Layers, Target, BarChart3, AlertTriangle, Clock, ArrowRight, Network, Activity } from "lucide-react";

type LayerMode = "signals" | "buildings" | "tenants" | "demand" | "building-risk" | "opportunities" | "zones" | "clusters" | "lease-expiries" | "tenant-movement" | "hierarchy-clusters" | "demand-zones";

interface MapMarker {
  id: string;
  companyName: string;
  city: string;
  state: string | null;
  industry: string | null;
  lat: number;
  lng: number;
  signalType: string;
  estimatedHeadcount: string | null;
  estimatedOfficeSizeSqm: string | null;
  estimatedProjectValue: number;
  confidenceScore: number;
  priority: string;
  status: string;
  sourceUrl: string | null;
  color: string;
  dateDetected: string;
  linkedProspectId: string | null;
}

interface GeoFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
  meta: { total: number; layer: string };
}

const SIGNAL_COLORS: Record<string, string> = {
  orange: "#F97316",
  red: "#EF4444",
  blue: "#3B82F6",
  green: "#22C55E",
};

const SIGNAL_LABELS: Record<string, string> = {
  orange: "Hiring / Expansion",
  red: "Office Relocation",
  blue: "New Lease / Property",
  green: "Funding / Growth",
};

const PRIORITY_RADIUS: Record<string, number> = { High: 14, Medium: 10, Low: 7 };

const TIER_COLORS: Record<string, string> = {
  hot: "#EF4444",
  high: "#F97316",
  critical: "#DC2626",
  premium: "#8B5CF6",
  upper: "#3B82F6",
  mid: "#22C55E",
  medium: "#F59E0B",
  entry: "#6B7280",
  low: "#374151",
};

const LAYER_TABS: { id: LayerMode; label: string; icon: typeof Layers }[] = [
  { id: "signals", label: "Signals", icon: TrendingUp },
  { id: "opportunities", label: "Opportunities", icon: Target },
  { id: "tenants", label: "Tenants", icon: Building2 },
  { id: "demand", label: "Demand", icon: BarChart3 },
  { id: "building-risk", label: "Risk", icon: AlertTriangle },
  { id: "zones", label: "Zones", icon: Layers },
  { id: "buildings", label: "Buildings", icon: Building2 },
  { id: "clusters", label: "Clusters", icon: MapPin },
  { id: "lease-expiries", label: "Lease Expiries", icon: Clock },
  { id: "tenant-movement", label: "Tenant Movement", icon: ArrowRight },
  { id: "hierarchy-clusters", label: "Corp Hierarchy", icon: Network },
  { id: "demand-zones", label: "Demand Zones", icon: Activity },
];

function fmtVal(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return n > 0 ? `$${n}` : "—";
}

function featureColor(feature: GeoFeature, layer: LayerMode): string {
  const p = feature.properties;
  if (layer === "signals") return (p.color as string) || "#3B82F6";
  if (layer === "building-risk") return TIER_COLORS[(p.riskTier as string)] ?? "#6B7280";
  if (layer === "demand") return TIER_COLORS[(p.demandTier as string)] ?? "#6B7280";
  if (layer === "zones") return TIER_COLORS[(p.demandTier as string)] ?? "#22C55E";
  if (layer === "opportunities") return TIER_COLORS[(p.commercialTier as string)] ?? "#3B82F6";
  if (layer === "tenants") return p.moveProbability && (p.moveProbability as number) > 60 ? "#EF4444" : "#3B82F6";
  if (layer === "buildings") return "#F97316";
  if (layer === "clusters") return "#8B5CF6";
  if (layer === "lease-expiries") {
    const tier = p.urgencyTier as string;
    if (tier === "critical") return "#DC2626";
    if (tier === "high") return "#F97316";
    if (tier === "medium") return "#F59E0B";
    return "#6B7280";
  }
  if (layer === "tenant-movement") return "#A855F7";
  if (layer === "hierarchy-clusters") return "#06B6D4";
  if (layer === "demand-zones") return TIER_COLORS[(p.demandTier as string)] ?? "#22C55E";
  return "#3B82F6";
}

function featureRadius(feature: GeoFeature, layer: LayerMode): number {
  const p = feature.properties;
  if (layer === "signals") return PRIORITY_RADIUS[(p.priority as string)] ?? 8;
  if (layer === "opportunities") return Math.max(6, Math.min(18, ((p.opportunityScore as number) ?? 50) / 7));
  if (layer === "demand") return Math.max(6, Math.min(18, ((p.demandScore as number) ?? 30) / 6));
  if (layer === "building-risk") return Math.max(6, Math.min(18, ((p.vacancyRiskScore as number) ?? 30) / 6));
  if (layer === "zones") return Math.max(6, Math.min(18, ((p.zoneScore as number) ?? 30) / 6));
  if (layer === "clusters") return Math.max(8, Math.min(30, ((p.signalCount as number) ?? 5) * 1.5));
  if (layer === "lease-expiries") return Math.max(7, Math.min(18, ((p.opportunityScore as number) ?? 50) / 6));
  if (layer === "tenant-movement") return Math.max(7, Math.min(16, ((p.radarScore as number) ?? 50) / 7));
  if (layer === "hierarchy-clusters") return Math.max(8, Math.min(28, ((p.companyCount as number) ?? 3) * 2.5));
  if (layer === "demand-zones") return Math.max(6, Math.min(18, ((p.demandScore as number) ?? 30) / 6));
  return 8;
}

function FeaturePopup({ feature, layer }: { feature: GeoFeature; layer: LayerMode }) {
  const p = feature.properties;
  return (
    <div className="bg-[hsl(220,18%,12%)] rounded-xl p-4 min-w-[220px] text-white">
      {layer === "signals" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.companyName as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}{p.state ? `, ${p.state}` : ""}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Signal</span><span className="text-white/70">{(p.signalType as string)?.replace(/_/g, " ")}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Score</span><span className="text-amber-400 font-semibold">{p.radarScore as number}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Priority</span><span className="text-white/70">{p.priority as string}</span></div>
          </div>
          <a href="/admin/office-move-radar" className="mt-3 flex items-center gap-1 text-[10px] text-[hsl(43,78%,52%)] hover:text-[hsl(43,78%,65%)]">
            <TrendingUp className="w-3 h-3" /> View in Radar
          </a>
        </>
      )}
      {layer === "opportunities" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.companyName as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Score</span><span className="text-amber-400 font-semibold">{p.opportunityScore as number}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Relocation Prob.</span><span className="text-red-400">{p.relocationProbability as number}%</span></div>
            <div className="flex justify-between"><span className="text-white/40">Tier</span><span className="text-white/70">{p.commercialTier as string}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Source</span><span className="text-white/70">{(p.source as string)?.replace(/_/g, " ")}</span></div>
          </div>
        </>
      )}
      {layer === "tenants" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.companyName as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string} · {p.industry as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Move Prob.</span><span className="text-red-400">{p.moveProbability as number}%</span></div>
            <div className="flex justify-between"><span className="text-white/40">Priority</span><span className="text-white/70">{p.priorityLevel as string}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Employees</span><span className="text-white/70">{p.employeeEstimate as string}</span></div>
          </div>
        </>
      )}
      {layer === "demand" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.suburb as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Demand Score</span><span className="text-amber-400 font-semibold">{Math.round(p.demandScore as number)}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Tier</span><Badge className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20 border">{p.demandTier as string}</Badge></div>
            <div className="flex justify-between"><span className="text-white/40">Active Companies</span><span className="text-white/70">{p.activeCompanies as number}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Recent Signals</span><span className="text-white/70">{p.recentSignals as number}</span></div>
          </div>
        </>
      )}
      {layer === "building-risk" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.buildingName as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Risk Score</span><span className="text-red-400 font-semibold">{Math.round(p.vacancyRiskScore as number)}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Risk Tier</span><Badge className="text-[9px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/20 border">{p.riskTier as string}</Badge></div>
            <div className="flex justify-between"><span className="text-white/40">Turnover Rate</span><span className="text-white/70">{Math.round(p.tenantTurnoverRate as number)}%</span></div>
          </div>
        </>
      )}
      {layer === "zones" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.suburb as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Zone Score</span><span className="text-amber-400 font-semibold">{Math.round(p.zoneScore as number)}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Demand</span><span className="text-white/70">{Math.round(p.demandScore as number)}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Companies</span><span className="text-white/70">{p.activeCompanies as number}</span></div>
          </div>
        </>
      )}
      {layer === "buildings" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.buildingName as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          {p.observedCompany && (
            <div className="text-xs text-white/60 mb-1">Observed: {p.observedCompany as string}</div>
          )}
          {p.notes && <div className="text-xs text-white/40">{p.notes as string}</div>}
        </>
      )}
      {layer === "clusters" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.city as string}</div>
          <div className="text-xs text-white/60">{p.signalCount as number} active signals</div>
        </>
      )}
      {layer === "lease-expiries" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.companyName as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Expiry</span><span className="text-amber-400 font-semibold">{p.predictedExpiryQuarter as string} {p.predictedExpiryYear as number}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Relocation Prob.</span><span className="text-red-400">{p.relocationProbability as number}%</span></div>
            <div className="flex justify-between"><span className="text-white/40">Opp. Score</span><span className="text-white/70">{p.opportunityScore as number}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Urgency</span><Badge className="text-[9px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/20 border">{p.urgencyTier as string}</Badge></div>
          </div>
          {(p.estimatedProjectValue as number) > 0 && (
            <div className="mt-2 text-[10px] text-green-400">{fmtVal(p.estimatedProjectValue as number)} est. project value</div>
          )}
        </>
      )}
      {layer === "tenant-movement" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.companyName as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Signal Type</span><span className="text-purple-400">{(p.signalType as string)?.replace(/_/g, " ")}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Radar Score</span><span className="text-amber-400 font-semibold">{p.radarScore as number}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Confidence</span><span className="text-white/70">{p.confidenceLevel as string}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Detected</span><span className="text-white/60">{p.dateDetected as string}</span></div>
          </div>
        </>
      )}
      {layer === "hierarchy-clusters" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.city as string}</div>
          <div className="text-white/50 text-xs mb-3">Corporate Hierarchy Cluster</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Companies</span><span className="text-cyan-400 font-semibold">{p.companyCount as number}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Total Signals</span><span className="text-white/70">{p.totalSignals as number}</span></div>
          </div>
          {(p.topCompanies as string) && (
            <div className="mt-2 text-[10px] text-white/40 border-t border-white/05 pt-2">{p.topCompanies as string}</div>
          )}
        </>
      )}
      {layer === "demand-zones" && (
        <>
          <div className="font-semibold text-sm text-white mb-1">{p.suburb as string}</div>
          <div className="text-white/50 text-xs mb-3">{p.city as string}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Demand Score</span><span className="text-green-400 font-semibold">{Math.round(p.demandScore as number)}/100</span></div>
            <div className="flex justify-between"><span className="text-white/40">Tier</span><Badge className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20 border">{p.demandTier as string}</Badge></div>
            <div className="flex justify-between"><span className="text-white/40">Active Companies</span><span className="text-white/70">{p.activeCompanies as number}</span></div>
            {(p.growthRate as number) > 0 && (
              <div className="flex justify-between"><span className="text-white/40">Growth Rate</span><span className="text-green-400">+{Math.round(p.growthRate as number)}%</span></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function MarketMap() {
  const [activeLayer, setActiveLayer] = useState<LayerMode>("signals");
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [minValue, setMinValue] = useState<number>(0);

  const { data: legacyData, isLoading: legacyLoading } = useQuery<{ markers: MapMarker[]; total: number; updatedAt: string }>({
    queryKey: ["/api/market-map"],
    refetchInterval: 300_000,
  });

  const { data: layerData, isLoading: layerLoading } = useQuery<GeoCollection>({
    queryKey: [`/api/map/layers/${activeLayer}`],
    queryFn: () => fetch(`/api/map/layers/${activeLayer}`).then(r => r.json()),
    refetchInterval: 300_000,
  });

  const markers = legacyData?.markers ?? [];
  const cities = ["all", ...Array.from(new Set(markers.map(m => m.city))).sort()];

  const filteredMarkers = markers.filter(m => {
    if (signalFilter !== "all" && m.color !== signalFilter) return false;
    if (cityFilter !== "all" && m.city !== cityFilter) return false;
    if (m.estimatedProjectValue < minValue) return false;
    return true;
  });

  const totalValue = filteredMarkers.reduce((s, m) => s + m.estimatedProjectValue, 0);
  const features = layerData?.features ?? [];
  const isLoading = activeLayer === "signals" ? legacyLoading : layerLoading;

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,9%)]">
        <div className="max-w-screen-xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-1">The Corporate Desk</div>
            <h1 className="text-white font-serif text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              Workspace Intelligence Map
            </h1>
            <p className="text-white/40 text-sm mt-1">Live intelligence — signals, tenants, demand, and risk across Australia</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(SIGNAL_LABELS).map(([color, label]) => (
              <div key={color} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[color] }} />
                <span className="text-white/50">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Layer tabs */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,8%)]">
        <div className="max-w-screen-xl mx-auto px-6 flex gap-1 overflow-x-auto py-2">
          {LAYER_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveLayer(id)}
              data-testid={`layer-tab-${id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeLayer === id
                  ? "bg-[hsl(43,78%,52%)]/20 text-[hsl(43,78%,65%)] border border-[hsl(43,78%,52%)]/30"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,8%)]">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex flex-wrap gap-6">
          <div>
            <span className="text-white/30 text-xs uppercase tracking-wider">
              {activeLayer === "signals" ? "Detected Signals" : `${LAYER_TABS.find(t => t.id === activeLayer)?.label} Points`}
            </span>
            <span className="text-[hsl(43,78%,65%)] font-bold text-lg ml-2" data-testid="map-total-signals">
              {activeLayer === "signals" ? filteredMarkers.length : features.length}
            </span>
          </div>
          {activeLayer === "signals" && (
            <>
              <div>
                <span className="text-white/30 text-xs uppercase tracking-wider">Est. Pipeline Value</span>
                <span className="text-green-400 font-bold text-lg ml-2" data-testid="map-pipeline-value">{fmtVal(totalValue)}</span>
              </div>
              <div>
                <span className="text-white/30 text-xs uppercase tracking-wider">High Priority</span>
                <span className="text-amber-400 font-bold text-lg ml-2">{filteredMarkers.filter(m => m.priority === "High").length}</span>
              </div>
            </>
          )}
          {legacyData?.updatedAt && (
            <div className="ml-auto text-white/20 text-xs self-center">
              Updated {new Date(legacyData.updatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* Signal filters — only shown for signals layer */}
      {activeLayer === "signals" && (
        <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,8%)]">
          <div className="max-w-screen-xl mx-auto px-6 py-3 flex flex-wrap gap-3 items-center">
            <Filter className="w-3.5 h-3.5 text-white/30" />
            <select
              value={signalFilter}
              onChange={e => setSignalFilter(e.target.value)}
              className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white text-xs rounded-lg px-3 py-1.5"
              data-testid="filter-signal-type"
            >
              <option value="all">All Signal Types</option>
              {Object.entries(SIGNAL_LABELS).map(([color, label]) => (
                <option key={color} value={color}>{label}</option>
              ))}
            </select>
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white text-xs rounded-lg px-3 py-1.5"
              data-testid="filter-city"
            >
              {cities.map(c => <option key={c} value={c}>{c === "all" ? "All Cities" : c}</option>)}
            </select>
            <select
              value={minValue}
              onChange={e => setMinValue(Number(e.target.value))}
              className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white text-xs rounded-lg px-3 py-1.5"
              data-testid="filter-project-value"
            >
              <option value={0}>Any Project Value</option>
              <option value={50000}>$50k+</option>
              <option value={100000}>$100k+</option>
              <option value={250000}>$250k+</option>
              <option value={500000}>$500k+</option>
              <option value={1000000}>$1M+</option>
            </select>
            {(signalFilter !== "all" || cityFilter !== "all" || minValue > 0) && (
              <button
                onClick={() => { setSignalFilter("all"); setCityFilter("all"); setMinValue(0); }}
                className="text-white/40 hover:text-white/70 text-xs underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex" style={{ height: "calc(100vh - 260px)", minHeight: 480 }}>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-white/40 text-sm">Loading {activeLayer} layer…</div>
          </div>
        ) : (
          <div className="flex-1 relative">
            <MapContainer
              center={[-27.5, 133.5]}
              zoom={5}
              style={{ height: "100%", width: "100%", background: "#0f1117" }}
              className="z-0"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />

              {/* Legacy signal markers (for signals layer) */}
              {activeLayer === "signals" && filteredMarkers.map(marker => (
                <CircleMarker
                  key={marker.id}
                  center={[marker.lat, marker.lng]}
                  radius={PRIORITY_RADIUS[marker.priority] ?? 8}
                  pathOptions={{
                    color: SIGNAL_COLORS[marker.color] ?? "#3B82F6",
                    fillColor: SIGNAL_COLORS[marker.color] ?? "#3B82F6",
                    fillOpacity: 0.7,
                    weight: 2,
                    opacity: 0.9,
                  }}
                >
                  <Popup className="market-map-popup">
                    <div className="bg-[hsl(220,18%,12%)] rounded-xl p-4 min-w-[220px] text-white">
                      <div className="font-semibold text-sm text-white mb-1">{marker.companyName}</div>
                      <div className="text-white/50 text-xs mb-3">{marker.city}{marker.state ? `, ${marker.state}` : ""}</div>
                      {marker.industry && <div className="text-xs text-white/40 mb-2">{marker.industry}</div>}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-white/40">Signal</span><span className="text-white/70">{marker.signalType?.replace(/_/g, " ")}</span></div>
                        {marker.estimatedProjectValue > 0 && (
                          <div className="flex justify-between"><span className="text-white/40">Est. Value</span><span className="text-[hsl(43,78%,65%)] font-semibold">{fmtVal(marker.estimatedProjectValue)}</span></div>
                        )}
                        {marker.estimatedHeadcount && <div className="flex justify-between"><span className="text-white/40">Headcount</span><span className="text-white/70">{marker.estimatedHeadcount}</span></div>}
                        <div className="flex justify-between"><span className="text-white/40">Confidence</span><span className="text-white/70">{marker.confidenceScore}/100</span></div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {marker.sourceUrl && (
                          <a href={marker.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                            <ExternalLink className="w-3 h-3" /> Source
                          </a>
                        )}
                        <a href="/admin/office-move-radar" className="flex items-center gap-1 text-[10px] text-[hsl(43,78%,52%)] hover:text-[hsl(43,78%,65%)]">
                          <TrendingUp className="w-3 h-3" /> View in Radar
                        </a>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Intelligence layer markers */}
              {activeLayer !== "signals" && features.map((f, idx) => {
                const [lng, lat] = f.geometry.coordinates;
                return (
                  <CircleMarker
                    key={`${activeLayer}-${idx}`}
                    center={[lat, lng]}
                    radius={featureRadius(f, activeLayer)}
                    pathOptions={{
                      color: featureColor(f, activeLayer),
                      fillColor: featureColor(f, activeLayer),
                      fillOpacity: 0.7,
                      weight: 2,
                      opacity: 0.9,
                    }}
                  >
                    <Popup className="market-map-popup">
                      <FeaturePopup feature={f} layer={activeLayer} />
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        )}

        {/* Right sidebar */}
        <div className="w-72 bg-[hsl(220,18%,9%)] border-l border-[rgba(255,255,255,0.06)] overflow-y-auto hidden lg:block">
          <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" />
              {activeLayer === "signals" ? "Top Opportunities" : `Top ${LAYER_TABS.find(t => t.id === activeLayer)?.label}`}
            </h3>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {activeLayer === "signals" && filteredMarkers
              .sort((a, b) => b.confidenceScore - a.confidenceScore)
              .slice(0, 20)
              .map(m => (
                <div key={m.id} className="p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors" data-testid={`map-sidebar-${m.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-white text-xs leading-tight">{m.companyName}</div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: SIGNAL_COLORS[m.color] ?? "#3B82F6" }} />
                  </div>
                  <div className="text-white/40 text-[10px] mb-2">{m.city} · {m.signalType?.replace(/_/g, " ")}</div>
                  <div className="flex items-center justify-between">
                    {m.estimatedProjectValue > 0 && <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">{fmtVal(m.estimatedProjectValue)}</span>}
                    <Badge className={`text-[9px] px-1.5 py-0 border ${
                      m.priority === "High" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      m.priority === "Medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-white/5 text-white/40 border-white/10"
                    }`}>
                      {m.priority}
                    </Badge>
                  </div>
                </div>
              ))}

            {activeLayer !== "signals" && features.slice(0, 20).map((f, idx) => {
              const p = f.properties;
              const name = (p.companyName || p.buildingName || p.suburb || p.city || "Unknown") as string;
              const sub = (p.city || p.signalType || "") as string;
              const score = (p.opportunityScore || p.demandScore || p.vacancyRiskScore || p.zoneScore || p.signalCount || 0) as number;
              return (
                <div key={idx} className="p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors" data-testid={`layer-sidebar-${idx}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-white text-xs leading-tight">{name}</div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: featureColor(f, activeLayer) }} />
                  </div>
                  <div className="text-white/40 text-[10px] mb-1">{sub}</div>
                  {score > 0 && <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">{Math.round(score)}/100</span>}
                </div>
              );
            })}

            {(activeLayer === "signals" ? filteredMarkers : features).length === 0 && (
              <div className="p-6 text-white/30 text-xs text-center">
                {isLoading ? "Loading layer data…" : "No data for this layer yet"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
