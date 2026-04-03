import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  MapPin,
  Plus,
  Trash2,
  Loader2,
  Edit3,
  Check,
  X,
  Globe,
  Brain,
} from "lucide-react";

interface Territory {
  id: string;
  buildingName: string;
  address: string | null;
  suburb: string | null;
  city: string;
  state: string | null;
  propertyType: string | null;
  notes: string | null;
  tenantCount: number | null;
  activeStatus: boolean | null;
  lastActivityAt: string;
  createdAt: string;
}

type TerritoryForm = {
  buildingName: string;
  address: string;
  suburb: string;
  city: string;
  state: string;
  propertyType: string;
  notes: string;
  tenantCount: string;
};

type ScanResponse = {
  count?: number;
  success?: boolean;
  message?: string;
};

const PROPERTY_TYPES: Record<string, string> = {
  office_tower: "Office Tower",
  business_park: "Business Park",
  strata_office: "Strata Office",
  mixed_use: "Mixed Use",
  tech_precinct: "Tech Precinct",
  cbd_building: "CBD Building",
};

const CITY_COLOR: Record<string, string> = {
  Brisbane: "bg-purple-100 text-purple-700",
  Melbourne: "bg-blue-100 text-blue-700",
  Sydney: "bg-emerald-100 text-emerald-700",
};

const DEFAULT_FORM: TerritoryForm = {
  buildingName: "",
  address: "",
  suburb: "",
  city: "Brisbane",
  state: "QLD",
  propertyType: "office_tower",
  notes: "",
  tenantCount: "",
};

async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  let payload: any = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

function normalizeTerritoriesResponse(payload: unknown): Territory[] {
  if (Array.isArray(payload)) return payload as Territory[];

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { territories?: unknown[] }).territories)
  ) {
    return (payload as { territories: Territory[] }).territories;
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: Territory[] }).data;
  }

  console.error("Unexpected /api/admin/territories response:", payload);
  return [];
}

function getStateForCity(city: string) {
  if (city === "Brisbane") return "QLD";
  if (city === "Melbourne") return "VIC";
  if (city === "Sydney") return "NSW";
  return "";
}

export default function AdminTerritoryScanner() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [form, setForm] = useState<TerritoryForm>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState<Partial<Territory>>({});
  const { toast } = useToast();

  const {
    data: territories = [],
    isLoading,
    isError,
    error,
  } = useQuery<Territory[]>({
    queryKey: ["/api/admin/territories"],
    queryFn: async () => {
      const response = await fetch("/api/admin/territories");

      if (!response.ok) {
        throw new Error(`Failed to load territories: ${response.status}`);
      }

      const result = await response.json();
      return normalizeTerritoriesResponse(result);
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<Territory>("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tenantCount: form.tenantCount ? parseInt(form.tenantCount, 10) : null,
          activeStatus: true,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territories"] });
      setShowAdd(false);
      setForm(DEFAULT_FORM);
      toast({ title: "Territory added" });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to add territory",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest<{ success: boolean; message?: string }>(
        `/api/admin/territories/${id}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territories"] });
      toast({ title: "Territory deleted" });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to delete territory",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Territory> }) => {
      return apiRequest<Territory>(`/api/admin/territories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territories"] });
      setEditingId(null);
      setEditForm({});
      toast({ title: "Territory updated" });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to update territory",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (territory: Territory) => {
      return apiRequest<ScanResponse>("/api/admin/lease-signal-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cities: [territory.city],
          signalTypes: ["territory_signal", "new_lease", "relocation"],
          count: 2,
          buildingContext: `${territory.buildingName}, ${territory.suburb ?? ""}, ${territory.city}`
            .replace(/\s+,/g, ",")
            .replace(/,\s*,/g, ",")
            .trim(),
        }),
      });
    },
    onSuccess: (data, territory) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prospected-leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territories"] });
      setScanningId(null);

      toast({
        title: `Scan complete — ${data.count ?? 0} leads generated from ${territory.buildingName}`,
      });
    },
    onError: (err: Error) => {
      setScanningId(null);
      toast({
        title: "Scan failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const startEdit = (territory: Territory) => {
    setEditingId(territory.id);
    setEditForm({
      buildingName: territory.buildingName,
      address: territory.address,
      suburb: territory.suburb,
      city: territory.city,
      state: territory.state,
      propertyType: territory.propertyType,
      notes: territory.notes,
      tenantCount: territory.tenantCount,
      activeStatus: territory.activeStatus,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (territoryId: string) => {
    const payload: Partial<Territory> = {
      ...editForm,
      buildingName: (editForm.buildingName ?? "").toString().trim(),
    };

    if (!payload.buildingName) {
      toast({
        title: "Building name is required",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ id: territoryId, data: payload });
  };

  console.log("territories runtime value:", territories);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#c9a84c]" />
              <h1
                className="text-2xl font-bold text-gray-900"
                data-testid="page-title-territory"
              >
                Territory Scanner
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Track key office towers and precincts. Scan for tenant movement signals and
              generate leads.
            </p>
          </div>

          <Button
            onClick={() => setShowAdd((prev) => !prev)}
            className="bg-gray-900 text-[#c9a84c] hover:bg-gray-800 h-9 text-sm"
            data-testid="button-add-territory"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Building
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {showAdd && (
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Territory / Building</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Building name *"
                  value={form.buildingName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, buildingName: e.target.value }))
                  }
                  data-testid="input-building-name"
                />

                <Input
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />

                <Input
                  placeholder="Suburb"
                  value={form.suburb}
                  onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))}
                />

                <Select
                  value={form.city}
                  onValueChange={(city) =>
                    setForm((f) => ({
                      ...f,
                      city,
                      state: getStateForCity(city),
                    }))
                  }
                >
                  <SelectTrigger data-testid="select-territory-city">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Brisbane">Brisbane</SelectItem>
                    <SelectItem value="Melbourne">Melbourne</SelectItem>
                    <SelectItem value="Sydney">Sydney</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={form.propertyType}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, propertyType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROPERTY_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Tenant count (est.)"
                  type="number"
                  value={form.tenantCount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tenantCount: e.target.value }))
                  }
                />
              </div>

              <Textarea
                className="mt-3"
                placeholder="Notes — tenant intelligence, leasing activity, known movements…"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />

              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => addMutation.mutate()}
                  disabled={!form.buildingName.trim() || addMutation.isPending}
                  className="bg-gray-900 text-[#c9a84c] hover:bg-gray-800"
                  data-testid="button-save-territory"
                >
                  {addMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Save Territory"
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAdd(false);
                    setForm(DEFAULT_FORM);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-red-500">
            <p className="font-semibold">Failed to load territories</p>
            <p className="text-sm mt-1">{(error as Error)?.message || "Unknown error"}</p>
          </div>
        ) : !Array.isArray(territories) || territories.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-gray-500">No territories tracked yet</p>
            <p className="text-sm mt-1">
              Add office towers and precincts to monitor for tenant movements.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(territories) &&
              territories.map((t) => {
                const isEditing = editingId === t.id;
                const isScanning = scanningId === t.id;
                const isDeleting = deleteMutation.isPending;
                const isUpdating = updateMutation.isPending;

                return (
                  <Card
                    key={t.id}
                    className="border-0 shadow-sm"
                    data-testid={`territory-card-${t.id}`}
                  >
                    <CardContent className="p-5">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={String(editForm.buildingName ?? "")}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, buildingName: e.target.value }))
                            }
                            placeholder="Building name"
                          />

                          <Input
                            value={String(editForm.address ?? "")}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, address: e.target.value }))
                            }
                            placeholder="Address"
                          />

                          <Input
                            value={String(editForm.suburb ?? "")}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, suburb: e.target.value }))
                            }
                            placeholder="Suburb"
                          />

                          <Textarea
                            value={String(editForm.notes ?? "")}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, notes: e.target.value }))
                            }
                            placeholder="Notes"
                            rows={3}
                          />

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEdit(t.id)}
                              disabled={isUpdating}
                              className="bg-gray-900 text-[#c9a84c]"
                            >
                              {isUpdating ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 mr-1" />
                              )}
                              Save
                            </Button>

                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900 text-base">
                                  {t.buildingName}
                                </h3>

                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    CITY_COLOR[t.city] || "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {t.city}
                                </Badge>

                                {t.propertyType && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-gray-200 text-gray-500"
                                  >
                                    {PROPERTY_TYPES[t.propertyType] || t.propertyType}
                                  </Badge>
                                )}
                              </div>

                              {(t.address || t.suburb) && (
                                <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {[t.suburb, t.address].filter(Boolean).join(" — ")}
                                </div>
                              )}

                              {t.tenantCount !== null && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  ~{t.tenantCount} tenants
                                </div>
                              )}

                              {t.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2.5 border border-gray-100 whitespace-pre-wrap">
                                  {t.notes}
                                </div>
                              )}

                              <div className="text-xs text-gray-300 mt-2">
                                Last activity:{" "}
                                {t.lastActivityAt
                                  ? new Date(t.lastActivityAt).toLocaleDateString("en-AU")
                                  : "—"}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-1.5 mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-[#c9a84c] text-[#c9a84c] hover:bg-amber-50"
                              disabled={isScanning}
                              data-testid={`btn-scan-territory-${t.id}`}
                              onClick={() => {
                                setScanningId(t.id);
                                scanMutation.mutate(t);
                              }}
                            >
                              {isScanning ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Scanning…
                                </>
                              ) : (
                                <>
                                  <Brain className="w-3 h-3 mr-1" />
                                  AI Scan
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => startEdit(t)}
                              data-testid={`btn-edit-territory-${t.id}`}
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-500 hover:bg-red-50"
                              onClick={() => deleteMutation.mutate(t.id)}
                              disabled={isDeleting}
                              data-testid={`btn-delete-territory-${t.id}`}
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}

        <Card className="mt-8 border-0 bg-gray-800 text-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-100">
              Prime Australian Office Precincts to Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {[
                {
                  city: "Brisbane",
                  precincts: [
                    "Brisbane CBD — Eagle St Precinct",
                    "Fortitude Valley — 1 King St",
                    "South Brisbane — Cordelia St",
                    "Newstead — Gasworks Precinct",
                    "Milton — Coronation Dr",
                    "Spring Hill — 555 Ann St",
                  ],
                },
                {
                  city: "Melbourne",
                  precincts: [
                    "CBD — Collins St / Bourke St",
                    "Docklands — NewQuay",
                    "Southbank — City Rd",
                    "Cremorne — Richmond",
                    "St Kilda Rd",
                    "Hawthorn / Toorak Rd",
                  ],
                },
                {
                  city: "Sydney",
                  precincts: [
                    "Sydney CBD — Martin Place",
                    "North Sydney — Miller St",
                    "Pyrmont / Ultimo",
                    "Parramatta CBD",
                    "Surry Hills / Chippendale",
                    "Macquarie Park",
                  ],
                },
              ].map((p) => (
                <div key={p.city}>
                  <div className="text-[#c9a84c] font-semibold text-xs uppercase tracking-wide mb-2">
                    {p.city}
                  </div>
                  <ul className="space-y-1">
                    {p.precincts.map((pr) => (
                      <li key={pr} className="text-gray-300 text-xs">
                        {pr}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}