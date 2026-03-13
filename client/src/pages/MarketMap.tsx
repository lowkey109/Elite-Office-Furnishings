import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Building2, TrendingUp, Filter } from "lucide-react";

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

const SIGNAL_COLORS: Record<string, string> = {
  orange: "#F97316",
  red:    "#EF4444",
  blue:   "#3B82F6",
  green:  "#22C55E",
};

const SIGNAL_LABELS: Record<string, string> = {
  orange: "Hiring / Expansion",
  red:    "Office Relocation",
  blue:   "New Lease / Property",
  green:  "Funding / Growth",
};

const PRIORITY_RADIUS: Record<string, number> = { High: 14, Medium: 10, Low: 7 };

function fmtVal(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return n > 0 ? `$${n}` : "—";
}

export default function MarketMap() {
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [minValue, setMinValue] = useState<number>(0);

  const { data, isLoading } = useQuery<{ markers: MapMarker[]; total: number; updatedAt: string }>({
    queryKey: ["/api/market-map"],
    queryFn: () => fetch("/api/market-map").then(r => r.json()),
    refetchInterval: 300_000,
  });

  const markers = data?.markers ?? [];

  const cities = ["all", ...Array.from(new Set(markers.map(m => m.city))).sort()];
  const signals = ["all", ...Array.from(new Set(markers.map(m => m.color)))];

  const filtered = markers.filter(m => {
    if (signalFilter !== "all" && m.color !== signalFilter) return false;
    if (cityFilter !== "all" && m.city !== cityFilter) return false;
    if (m.estimatedProjectValue < minValue) return false;
    return true;
  });

  const totalValue = filtered.reduce((s, m) => s + m.estimatedProjectValue, 0);

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,9%)]">
        <div className="max-w-screen-xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <div className="text-[hsl(43,78%,52%)] text-xs font-bold tracking-widest uppercase mb-1">The Corporate Desk</div>
            <h1 className="text-white font-serif text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              National Office Market Map
            </h1>
            <p className="text-white/40 text-sm mt-1">Live intelligence — office relocations, expansions and new leases across Australia</p>
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

      {/* Stats bar */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[hsl(220,18%,8%)]">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex flex-wrap gap-6">
          <div>
            <span className="text-white/30 text-xs uppercase tracking-wider">Detected Signals</span>
            <span className="text-[hsl(43,78%,65%)] font-bold text-lg ml-2" data-testid="map-total-signals">{filtered.length}</span>
          </div>
          <div>
            <span className="text-white/30 text-xs uppercase tracking-wider">Est. Pipeline Value</span>
            <span className="text-green-400 font-bold text-lg ml-2" data-testid="map-pipeline-value">{fmtVal(totalValue)}</span>
          </div>
          <div>
            <span className="text-white/30 text-xs uppercase tracking-wider">High Priority</span>
            <span className="text-amber-400 font-bold text-lg ml-2">{filtered.filter(m => m.priority === "High").length}</span>
          </div>
          {data?.updatedAt && (
            <div className="ml-auto text-white/20 text-xs self-center">
              Updated {new Date(data.updatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
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

      {/* Map */}
      <div className="flex" style={{ height: "calc(100vh - 220px)", minHeight: 480 }}>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-white/40 text-sm">Loading market intelligence…</div>
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
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              {filtered.map(marker => (
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
                  eventHandlers={{ click: () => {} }}
                >
                  <Popup className="market-map-popup">
                    <div className="bg-[hsl(220,18%,12%)] rounded-xl p-4 min-w-[220px] text-white">
                      <div className="font-semibold text-sm text-white mb-1">{marker.companyName}</div>
                      <div className="text-white/50 text-xs mb-3">{marker.city}{marker.state ? `, ${marker.state}` : ""}</div>
                      {marker.industry && (
                        <div className="text-xs text-white/40 mb-2">{marker.industry}</div>
                      )}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/40">Signal</span>
                          <span className="text-white/70">{marker.signalType?.replace(/_/g, " ")}</span>
                        </div>
                        {marker.estimatedProjectValue > 0 && (
                          <div className="flex justify-between">
                            <span className="text-white/40">Est. Value</span>
                            <span className="text-[hsl(43,78%,65%)] font-semibold">{fmtVal(marker.estimatedProjectValue)}</span>
                          </div>
                        )}
                        {marker.estimatedHeadcount && (
                          <div className="flex justify-between">
                            <span className="text-white/40">Headcount</span>
                            <span className="text-white/70">{marker.estimatedHeadcount}</span>
                          </div>
                        )}
                        {marker.estimatedOfficeSizeSqm && (
                          <div className="flex justify-between">
                            <span className="text-white/40">Office Size</span>
                            <span className="text-white/70">{marker.estimatedOfficeSizeSqm} sqm</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-white/40">Confidence</span>
                          <span className="text-white/70">{marker.confidenceScore}/100</span>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {marker.sourceUrl && (
                          <a
                            href={marker.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-3 h-3" /> Source
                          </a>
                        )}
                        <a
                          href="/admin/office-move-radar"
                          className="flex items-center gap-1 text-[10px] text-[hsl(43,78%,52%)] hover:text-[hsl(43,78%,65%)]"
                        >
                          <TrendingUp className="w-3 h-3" /> View in Radar
                        </a>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* Right sidebar — top opportunities */}
        <div className="w-72 bg-[hsl(220,18%,9%)] border-l border-[rgba(255,255,255,0.06)] overflow-y-auto hidden lg:block">
          <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Top Opportunities
            </h3>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {filtered
              .sort((a, b) => b.confidenceScore - a.confidenceScore)
              .slice(0, 20)
              .map(m => (
                <div key={m.id} className="p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors" data-testid={`map-sidebar-${m.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-white text-xs leading-tight">{m.companyName}</div>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: SIGNAL_COLORS[m.color] ?? "#3B82F6" }}
                    />
                  </div>
                  <div className="text-white/40 text-[10px] mb-2">{m.city} · {m.signalType?.replace(/_/g, " ")}</div>
                  <div className="flex items-center justify-between">
                    {m.estimatedProjectValue > 0 && (
                      <span className="text-[hsl(43,78%,65%)] text-xs font-semibold">{fmtVal(m.estimatedProjectValue)}</span>
                    )}
                    <Badge className={`text-[9px] px-1.5 py-0 ${
                      m.priority === "High" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      m.priority === "Medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-white/5 text-white/40 border-white/10"
                    } border`}>
                      {m.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            {filtered.length === 0 && (
              <div className="p-6 text-white/30 text-xs text-center">No signals match current filters</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
