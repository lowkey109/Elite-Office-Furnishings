import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Building2, Users, Calendar, RefreshCw,
  Plus, Eye, Database, MapPin, Layers, AlertTriangle,
  ChevronRight, Loader2, Globe,
} from "lucide-react";


const GRADE_COLORS: Record<string, string> = {
  Premium: "bg-yellow-500/20 text-yellow-300",
  A: "bg-blue-500/20 text-blue-300",
  B: "bg-green-500/20 text-green-300",
  C: "bg-gray-500/20 text-gray-300",
};

export default function BuildingDatabase() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [filterCity, setFilterCity] = useState("");
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newBuilding, setNewBuilding] = useState({ name: "", address: "", city: "", suburb: "", state: "", postcode: "", floors: "", buildingGrade: "A", totalAreaSqm: "" });
  const [newTenant, setNewTenant] = useState({ companyName: "", floor: "", spaceSizeSqm: "", industry: "", estimatedHeadcount: "" });

  const { data: buildings = [], refetch: refetchBuildings, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/buildings"],
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/buildings/stats"],
  });

  const { data: tenants = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: leases = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/leases"],
  });

  const importRealBuildingMutation = useMutation({
    mutationFn: () => fetch("/api/admin/buildings/seed", { method: "POST" }).then(r => r.json()),
    onSuccess: (d) => {
      toast({ title: "Buildings Seeded", description: `${d.inserted} new buildings added, ${d.skipped} already present.` });
      qc.invalidateQueries({ queryKey: ["/api/admin/buildings"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/buildings/stats"] });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const addBuildingMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/admin/buildings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, floors: data.floors ? parseInt(data.floors) : undefined, totalAreaSqm: data.totalAreaSqm ? parseInt(data.totalAreaSqm) : undefined }) }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Building Added" });
      qc.invalidateQueries({ queryKey: ["/api/admin/buildings"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/buildings/stats"] });
      setShowAddBuilding(false);
      setNewBuilding({ name: "", address: "", city: "", suburb: "", state: "", postcode: "", floors: "", buildingGrade: "A", totalAreaSqm: "" });
    },
    onError: () => toast({ title: "Failed to add building", variant: "destructive" }),
  });

  const addTenantMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/admin/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, buildingId: selectedBuilding?.id, spaceSizeSqm: data.spaceSizeSqm ? parseInt(data.spaceSizeSqm) : undefined, estimatedHeadcount: data.estimatedHeadcount ? parseInt(data.estimatedHeadcount) : undefined }) }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Tenant Added" });
      qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/buildings/stats"] });
      setShowAddTenant(false);
      setNewTenant({ companyName: "", floor: "", spaceSizeSqm: "", industry: "", estimatedHeadcount: "" });
    },
    onError: () => toast({ title: "Failed to add tenant", variant: "destructive" }),
  });

  const filteredBuildings = filterCity ? buildings.filter((b: any) => b.city === filterCity) : buildings;
  const cities = [...new Set(buildings.map((b: any) => b.city))].sort();
  const buildingTenants = selectedBuilding ? tenants.filter((t: any) => t.buildingId === selectedBuilding.id) : [];
  const buildingLeases = selectedBuilding ? leases.filter((l: any) => l.buildingId === selectedBuilding.id) : [];
  const now = new Date();
  const in12Months = new Date(now.getTime() + 12 * 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-[hsl(220,18%,7%)] text-white">
      <header className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4 flex items-center gap-4">
        <Link href="/admin/command-centre">
          <button className="text-white/40 hover:text-white transition-colors" data-testid="btn-back-acc">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[hsl(43,78%,52%)]" />
          <h1 className="text-white font-bold text-lg">Building + Tenant Database</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => importRealBuildingMutation.mutate()} disabled={importRealBuildingMutation.isPending} className="flex items-center gap-2 bg-[rgba(180,100,255,0.08)] hover:bg-[rgba(180,100,255,0.14)] border border-[rgba(180,100,255,0.2)] rounded-xl px-3 py-2 text-purple-400 text-xs font-semibold transition-colors disabled:opacity-50" data-testid="btn-import-real-au-buildings">
            {importRealBuildingMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Import Real Buildings
          </button>
          <button onClick={() => setShowAddBuilding(true)} className="flex items-center gap-2 bg-[rgba(100,220,150,0.08)] hover:bg-[rgba(100,220,150,0.14)] border border-[rgba(100,220,150,0.2)] rounded-xl px-3 py-2 text-green-400 text-xs font-semibold transition-colors" data-testid="btn-add-building">
            <Plus className="w-3.5 h-3.5" /> Add Building
          </button>
          <Link href="/admin/market-map">
            <button className="flex items-center gap-2 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white/60 text-xs font-semibold transition-colors" data-testid="btn-view-on-map">
              <MapPin className="w-3.5 h-3.5" /> Map View
            </button>
          </Link>
          <button onClick={() => refetchBuildings()} className="text-white/30 hover:text-white/60 transition-colors p-2" data-testid="btn-refresh-buildings">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Buildings", value: stats?.totalBuildings ?? buildings.length, color: "text-purple-400" },
            { label: "Tenants", value: stats?.totalTenants ?? tenants.length, color: "text-blue-400" },
            { label: "Active Leases", value: stats?.activeLeases ?? 0, color: "text-green-400" },
            { label: "Expiring ≤12m", value: stats?.expiringIn12Months ?? 0, color: "text-amber-400" },
            { label: "Cities", value: stats?.cities ?? cities.length, color: "text-cyan-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-white/40 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Add Building Form */}
        {showAddBuilding && (
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,220,150,0.2)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-green-400" /> Add New Building</h2>
              <button onClick={() => setShowAddBuilding(false)} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Building Name *", key: "name", placeholder: "e.g. 1 Eagle Street" },
                { label: "Address", key: "address", placeholder: "Full street address" },
                { label: "City *", key: "city", placeholder: "e.g. Brisbane" },
                { label: "Suburb", key: "suburb", placeholder: "e.g. Brisbane City" },
                { label: "State", key: "state", placeholder: "e.g. QLD" },
                { label: "Postcode", key: "postcode", placeholder: "e.g. 4000" },
                { label: "Total Area (sqm)", key: "totalAreaSqm", placeholder: "e.g. 45000" },
                { label: "Floors", key: "floors", placeholder: "e.g. 40" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-white/40 text-xs mb-1 block">{label}</label>
                  <input type="text" value={(newBuilding as any)[key]} onChange={e => setNewBuilding(b => ({ ...b, [key]: e.target.value }))} placeholder={placeholder} className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20" data-testid={`input-building-${key}`} />
                </div>
              ))}
              <div>
                <label className="text-white/40 text-xs mb-1 block">Building Grade</label>
                <select value={newBuilding.buildingGrade} onChange={e => setNewBuilding(b => ({ ...b, buildingGrade: e.target.value }))} className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-white text-sm" data-testid="select-building-grade">
                  {["Premium","A","B","C"].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => addBuildingMutation.mutate(newBuilding)} disabled={addBuildingMutation.isPending || !newBuilding.name || !newBuilding.city} className="flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl px-4 py-2 text-green-400 text-xs font-semibold transition-colors disabled:opacity-50" data-testid="btn-submit-add-building">
                {addBuildingMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add Building
              </button>
              <button onClick={() => setShowAddBuilding(false)} className="text-white/40 hover:text-white/60 text-xs px-4 py-2 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Buildings List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Buildings ({filteredBuildings.length})</h2>
              <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-white/60 text-xs" data-testid="select-filter-city">
                <option value="">All Cities</option>
                {cities.map((c: any) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[hsl(43,78%,52%)] animate-spin" /></div>
            ) : filteredBuildings.length === 0 ? (
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl py-16 text-center">
                <Database className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No buildings in database</p>
                <button onClick={() => importRealBuildingMutation.mutate()} className="mt-4 text-purple-400 text-xs underline" data-testid="btn-import-real-empty-state">Import real Australian buildings</button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBuildings.map((b: any) => {
                  const bTenants = tenants.filter((t: any) => t.buildingId === b.id);
                  const bLeases = leases.filter((l: any) => l.buildingId === b.id);
                  const expiringLeases = bLeases.filter((l: any) => l.expiryDate && new Date(l.expiryDate) <= in12Months);
                  return (
                    <div key={b.id} onClick={() => setSelectedBuilding(b)} className={`bg-[hsl(220,18%,10%)] border rounded-xl px-5 py-4 cursor-pointer transition-all ${selectedBuilding?.id === b.id ? "border-[rgba(180,100,255,0.4)]" : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"}`} data-testid={`card-building-${b.id}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-semibold text-sm">{b.name}</p>
                          <p className="text-white/40 text-xs mt-0.5">{b.address}{b.suburb ? ` · ${b.suburb}` : ""} · {b.city}, {b.state}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {b.buildingGrade && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${GRADE_COLORS[b.buildingGrade] || "bg-gray-500/20 text-gray-300"}`}>Grade {b.buildingGrade}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
                        {b.floors && <span>{b.floors} floors</span>}
                        {b.totalAreaSqm && <span>{b.totalAreaSqm.toLocaleString()} sqm</span>}
                        {b.currentVacancyPct != null && <span className={b.currentVacancyPct > 15 ? "text-amber-400" : "text-green-400"}>{b.currentVacancyPct}% vacant</span>}
                        {b.nabers && <span>NABERS {b.nabers}★</span>}
                        <span>{bTenants.length} tenants</span>
                        {expiringLeases.length > 0 && <span className="text-amber-400">{expiringLeases.length} lease{expiringLeases.length > 1 ? "s" : ""} expiring</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Building Detail */}
          <div className="space-y-4">
            {selectedBuilding ? (
              <>
                <div className="bg-[hsl(220,18%,10%)] border border-[rgba(180,100,255,0.2)] rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                    <h3 className="text-white font-semibold text-sm">{selectedBuilding.name}</h3>
                    <button onClick={() => setSelectedBuilding(null)} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "City", value: selectedBuilding.city },
                        { label: "Grade", value: selectedBuilding.buildingGrade || "—" },
                        { label: "Floors", value: selectedBuilding.floors || "—" },
                        { label: "Area", value: selectedBuilding.totalAreaSqm ? `${selectedBuilding.totalAreaSqm.toLocaleString()} sqm` : "—" },
                        { label: "Vacancy", value: selectedBuilding.currentVacancyPct != null ? `${selectedBuilding.currentVacancyPct}%` : "—" },
                        { label: "NABERS", value: selectedBuilding.nabers ? `${selectedBuilding.nabers}★` : "—" },
                        { label: "Year Built", value: selectedBuilding.yearBuilt || "—" },
                        { label: "Source", value: selectedBuilding.sourceType || "manual" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-[rgba(255,255,255,0.03)] rounded-lg p-2.5">
                          <p className="text-white/40 text-[10px]">{label}</p>
                          <p className="text-white text-xs font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setShowAddTenant(true)} className="w-full flex items-center justify-center gap-2 bg-[rgba(100,180,255,0.08)] hover:bg-[rgba(100,180,255,0.14)] border border-[rgba(100,180,255,0.2)] rounded-xl py-2 text-blue-400 text-xs font-semibold transition-colors" data-testid="btn-add-tenant">
                      <Plus className="w-3.5 h-3.5" /> Add Tenant
                    </button>
                  </div>
                </div>

                {/* Add Tenant Form */}
                {showAddTenant && (
                  <div className="bg-[hsl(220,18%,10%)] border border-[rgba(100,180,255,0.2)] rounded-2xl p-4">
                    <h3 className="text-white font-semibold text-xs mb-3">Add Tenant to {selectedBuilding.name}</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Company Name *", key: "companyName", placeholder: "e.g. Acme Corp" },
                        { label: "Floor", key: "floor", placeholder: "e.g. Level 12" },
                        { label: "Space (sqm)", key: "spaceSizeSqm", placeholder: "e.g. 500" },
                        { label: "Industry", key: "industry", placeholder: "e.g. Technology" },
                        { label: "Headcount", key: "estimatedHeadcount", placeholder: "e.g. 50" },
                      ].map(({ label, key, placeholder }) => (
                        <div key={key}>
                          <label className="text-white/40 text-[10px] mb-0.5 block">{label}</label>
                          <input type="text" value={(newTenant as any)[key]} onChange={e => setNewTenant(t => ({ ...t, [key]: e.target.value }))} placeholder={placeholder} className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-white text-xs placeholder-white/20" data-testid={`input-tenant-${key}`} />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => addTenantMutation.mutate(newTenant)} disabled={addTenantMutation.isPending || !newTenant.companyName} className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl py-2 text-blue-400 text-xs font-semibold disabled:opacity-50" data-testid="btn-submit-add-tenant">Add</button>
                      <button onClick={() => setShowAddTenant(false)} className="text-white/40 hover:text-white/60 text-xs px-3 transition-colors">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Tenants */}
                {buildingTenants.length > 0 && (
                  <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                      <p className="text-white/50 text-xs font-semibold">Tenants ({buildingTenants.length})</p>
                    </div>
                    <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                      {buildingTenants.map((t: any) => (
                        <div key={t.id} className="px-5 py-3" data-testid={`row-tenant-${t.id}`}>
                          <p className="text-white text-xs font-semibold">{t.companyName}</p>
                          <p className="text-white/30 text-[10px]">{t.floor ? `${t.floor} · ` : ""}{t.spaceSizeSqm ? `${t.spaceSizeSqm} sqm` : ""}{t.industry ? ` · ${t.industry}` : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Leases */}
                {buildingLeases.length > 0 && (
                  <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                      <p className="text-white/50 text-xs font-semibold">Leases ({buildingLeases.length})</p>
                    </div>
                    <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                      {buildingLeases.map((l: any) => {
                        const expiry = l.expiryDate ? new Date(l.expiryDate) : null;
                        const isExpiringSoon = expiry && expiry <= in12Months;
                        return (
                          <div key={l.id} className="px-5 py-3" data-testid={`row-lease-${l.id}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-white text-xs font-semibold">{l.companyName || "Unknown"}</p>
                              {isExpiringSoon && <span className="text-amber-400 text-[10px]">Expiring soon</span>}
                            </div>
                            <p className="text-white/30 text-[10px]">Expires: {expiry ? expiry.toLocaleDateString("en-AU") : "—"}{l.spaceSizeSqm ? ` · ${l.spaceSizeSqm} sqm` : ""}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl py-12 text-center">
                <Building2 className="w-6 h-6 text-white/20 mx-auto mb-2" />
                <p className="text-white/30 text-xs">Select a building to view details</p>
              </div>
            )}

            {/* Intel Info */}
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(180,100,255,0.1)] rounded-2xl p-4">
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5"><Globe className="w-3 h-3" /> Intelligence Feeds</p>
              <div className="space-y-1.5 text-xs text-white/30">
                <div className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /> Lease expiry → opportunity detection</div>
                <div className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /> Vacancy risk → demand score</div>
                <div className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /> Tenant movement → relocation probability</div>
                <div className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /> Suburb edges → market intelligence map</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
