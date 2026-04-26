import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Star, Clock, Shield, Zap, MessageSquare, TrendingUp,
  Plus, RefreshCw, ChevronDown, ChevronUp, Mail, CheckCircle2,
  AlertTriangle, Trash2, Send, FileText, Users, Building2, ArrowRight
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplierProfile {
  id: string;
  supplierId: string;
  supplierName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  country?: string;
  specializations?: string;
  pricingScore?: number;
  deliveryScore?: number;
  reliabilityScore?: number;
  qualityScore?: number;
  installationScore?: number;
  responsivenessScore?: number;
  overallScore?: number;
  notes?: string;
  isActive?: boolean;
}

interface FurnitureItem { category: string; quantity: number; notes?: string; }
interface SupplierMatch { supplierName: string; supplierId: string; contactName?: string; categories: string[]; reason: string; routingNote?: string; }

interface RfqProject {
  id: string;
  projectName: string;
  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  city?: string;
  headcount?: number;
  officeSize?: number;
  budget?: string;
  timeline?: string;
  status: string;
  furnitureJson?: string;
  recommendationsJson?: string;
  notes?: string;
  createdAt: string;
}

interface RfqResponse {
  id: string;
  rfqProjectId: string;
  supplierName: string;
  category: string;
  quotedUnitPrice?: string;
  quotedTotalPrice?: string;
  deliveryWeeks?: string;
  availability?: string;
  notes?: string;
  status: string;
}

// ─── Score display ─────────────────────────────────────────────────────────────

function ScoreDot({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < score ? "bg-amber-400" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-6 text-right">{value}</span>
    </div>
  );
}

// ─── Known suppliers seed data ─────────────────────────────────────────────────

const SEED_SUPPLIERS = [
  {
    supplierId: "BOKE", supplierName: "Boke Furniture", contactName: "Boke Team", country: "China",
    specializations: JSON.stringify(["Task Chairs", "Meeting Chairs", "Boardroom Chairs", "Visitor Chairs", "Breakout / Lounge Seating"]),
    pricingScore: 4, deliveryScore: 3, reliabilityScore: 4, qualityScore: 4, installationScore: 1, responsivenessScore: 4,
    notes: "Seating specialist ONLY. Do not send desk, table, or storage requests.",
  },
  {
    supplierId: "MEIYI", supplierName: "Guangzhou Meiyi Furniture", contactName: "Asya", country: "China",
    specializations: JSON.stringify(["Workstations", "Meeting Tables", "Storage Units"]),
    pricingScore: 4, deliveryScore: 4, reliabilityScore: 5, qualityScore: 4, installationScore: 1, responsivenessScore: 5,
    notes: "Primary supplier for desks, workstations, and meeting tables. Trusted contact — Asya.",
  },
  {
    supplierId: "XITIAN", supplierName: "Xitian Furniture", contactName: "Ruby", country: "China",
    specializations: JSON.stringify(["Reception Desk", "Executive Desks"]),
    pricingScore: 3, deliveryScore: 3, reliabilityScore: 4, qualityScore: 5, installationScore: 1, responsivenessScore: 3,
    notes: "Best for executive, reception, and custom pieces. WhatsApp number pending confirmation.",
  },
  {
    supplierId: "FSZ", supplierName: "Feisenzhuo Furniture", contactName: "FSZ Team", country: "China",
    specializations: JSON.stringify(["Boardroom Table", "Executive Desks", "Workstations"]),
    pricingScore: 3, deliveryScore: 3, reliabilityScore: 4, qualityScore: 5, installationScore: 1, responsivenessScore: 3,
    notes: "Premium executive and boardroom specialist. ISO 9001 certified. 145 products.",
  },
];

const FURNITURE_CATEGORIES = [
  "Workstations", "Ergonomic Task Chairs", "Meeting Tables", "Meeting Chairs",
  "Boardroom Table", "Boardroom Chairs", "Reception Desk", "Visitor / Reception Chairs",
  "Breakout / Lounge Seating", "Storage Units", "Executive Desks", "Other",
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:      { color: "bg-gray-100 text-gray-600",    label: "Draft" },
  sent:       { color: "bg-blue-100 text-blue-700",    label: "Sent" },
  responding: { color: "bg-amber-100 text-amber-700",  label: "Responding" },
  awarded:    { color: "bg-emerald-100 text-emerald-700", label: "Awarded" },
  complete:   { color: "bg-gray-100 text-gray-500",    label: "Complete" },
};

// ─── Score rating helpers ─────────────────────────────────────────────────────

function ratingLabel(s: number) {
  return s >= 5 ? "Excellent" : s >= 4 ? "Good" : s >= 3 ? "Moderate" : s >= 2 ? "Poor" : "Avoid";
}

// ─── Supplier Profile Card ─────────────────────────────────────────────────────

function SupplierCard({ profile, onEdit, onDelete }: {
  profile: SupplierProfile;
  onEdit: (p: SupplierProfile) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const overall = profile.overallScore ?? 0;

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow" data-testid={`supplier-card-${profile.supplierId}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-sm truncate">{profile.supplierName}</h3>
              <Badge className={`text-xs ${overall >= 75 ? "bg-emerald-100 text-emerald-700" : overall >= 55 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                {overall >= 75 ? "Preferred" : overall >= 55 ? "Acceptable" : "Review"}
              </Badge>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {profile.contactName && <span className="mr-3">Contact: {profile.contactName}</span>}
              {profile.country && <span>{profile.country}</span>}
            </div>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="text-2xl font-bold text-gray-900">{overall}</div>
            <div className="text-xs text-gray-400">/ 100</div>
          </div>
        </div>

        {profile.specializations && (
          <div className="mt-3 flex flex-wrap gap-1">
            {JSON.parse(profile.specializations).map((s: string) => (
              <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{s}</span>
            ))}
          </div>
        )}

        <button
          className="mt-3 text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600"
          onClick={() => setExpanded(!expanded)}
          data-testid={`btn-expand-${profile.supplierId}`}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide" : "Show"} performance breakdown
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            <ScoreBar value={Math.round((profile.pricingScore ?? 3) / 5 * 100)} label="Pricing" />
            <ScoreBar value={Math.round((profile.deliveryScore ?? 3) / 5 * 100)} label="Delivery" />
            <ScoreBar value={Math.round((profile.reliabilityScore ?? 3) / 5 * 100)} label="Reliability" />
            <ScoreBar value={Math.round((profile.qualityScore ?? 3) / 5 * 100)} label="Quality" />
            <ScoreBar value={Math.round((profile.responsivenessScore ?? 3) / 5 * 100)} label="Responsiveness" />
            {profile.notes && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {profile.notes}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEdit(profile)} data-testid={`btn-edit-supplier-${profile.supplierId}`}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => onDelete(profile.id)} data-testid={`btn-delete-supplier-${profile.supplierId}`}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Score slider ─────────────────────────────────────────────────────────────

function ScoreSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-600 font-medium">{label}</label>
        <span className="text-xs font-bold text-gray-900">{ratingLabel(value)} ({value}/5)</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex-1 h-6 rounded text-xs font-medium transition-colors ${value >= v ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
            data-testid={`score-btn-${label.toLowerCase().replace(/\s/g, "-")}-${v}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminSupplierIntelligence() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Supplier profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery<SupplierProfile[]>({ queryKey: ["/api/admin/supplier-profiles"] });
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SupplierProfile | null>(null);

  const emptyProfile = { supplierId: "", supplierName: "", contactName: "", country: "China", pricingScore: 3, deliveryScore: 3, reliabilityScore: 3, qualityScore: 3, installationScore: 3, responsivenessScore: 3, notes: "", specializations: "[]" };
  const [profileForm, setProfileForm] = useState<typeof emptyProfile>(emptyProfile);

  // RFQ
  const { data: rfqList = [], isLoading: rfqLoading } = useQuery<RfqProject[]>({ queryKey: ["/api/admin/rfq"] });
  const [showRfqForm, setShowRfqForm] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<RfqProject | null>(null);
  const [rfqDetail, setRfqDetail] = useState<{ project: RfqProject; responses: RfqResponse[] } | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<any[] | null>(null);

  const [rfqForm, setRfqForm] = useState({
    projectName: "", clientName: "", clientCompany: "", clientEmail: "",
    city: "", headcount: "", officeSize: "", budget: "", timeline: "", notes: "",
  });
  const [autoFurniture, setAutoFurniture] = useState<FurnitureItem[] | null>(null);
  const [autoRouting, setAutoRouting] = useState<SupplierMatch[] | null>(null);
  const [manualFurniture, setManualFurniture] = useState<FurnitureItem[]>([{ category: "Workstations", quantity: 20 }]);

  const [responseForm, setResponseForm] = useState({ supplierName: "", category: "", quotedUnitPrice: "", quotedTotalPrice: "", deliveryWeeks: "", availability: "", notes: "" });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveProfileMutation = useMutation({
    mutationFn: (data: any) => editingProfile
      ? apiRequest("PATCH", `/api/admin/supplier-profiles/${editingProfile.id}`, data)
      : apiRequest("POST", "/api/admin/supplier-profiles", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/supplier-profiles"] });
      setShowProfileForm(false); setEditingProfile(null); setProfileForm(emptyProfile);
      toast({ title: editingProfile ? "Profile updated" : "Supplier added" });
    },
    onError: () => toast({ title: "Error saving supplier", variant: "destructive" }),
  });

  const deleteProfileMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/supplier-profiles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/supplier-profiles"] }); toast({ title: "Supplier removed" }); },
  });

  const loadSupplierDirectoryMutation = useMutation({
    mutationFn: async () => {
      for (const s of SEED_SUPPLIERS) {
        await apiRequest("POST", "/api/admin/supplier-profiles", s);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/supplier-profiles"] }); toast({ title: "Suppliers seeded" }); },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/rfq/auto-generate-furniture", data).then(r => r.json()),
    onSuccess: (data: any) => { setAutoFurniture(data.furniture); setAutoRouting(data.routing); },
    onError: () => toast({ title: "Generation failed", variant: "destructive" }),
  });

  const createRfqMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/rfq", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/rfq"] });
      setShowRfqForm(false); setAutoFurniture(null); setAutoRouting(null);
      setRfqForm({ projectName: "", clientName: "", clientCompany: "", clientEmail: "", city: "", headcount: "", officeSize: "", budget: "", timeline: "", notes: "" });
      toast({ title: "RFQ project created" });
    },
    onError: () => toast({ title: "Error creating RFQ", variant: "destructive" }),
  });

  const generateEmailsMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/rfq/${id}/generate-emails`, {}).then(r => r.json()),
    onSuccess: (data: any) => { setGeneratedEmails(data.emails); qc.invalidateQueries({ queryKey: ["/api/admin/rfq"] }); },
    onError: () => toast({ title: "Error generating emails", variant: "destructive" }),
  });

  const deleteRfqMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/rfq/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/rfq"] }); setSelectedRfq(null); setRfqDetail(null); toast({ title: "RFQ deleted" }); },
  });

  const addResponseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/admin/rfq/${selectedRfq!.id}/responses`, data),
    onSuccess: async () => {
      const d = await fetch(`/api/admin/rfq/${selectedRfq!.id}`).then(r => r.json());
      setRfqDetail(d);
      setResponseForm({ supplierName: "", category: "", quotedUnitPrice: "", quotedTotalPrice: "", deliveryWeeks: "", availability: "", notes: "" });
      toast({ title: "Response logged" });
    },
  });

  const updateResponseMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/rfq/responses/${id}`, { status }),
    onSuccess: async () => {
      const d = await fetch(`/api/admin/rfq/${selectedRfq!.id}`).then(r => r.json());
      setRfqDetail(d);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openRfqDetail(rfq: RfqProject) {
    setSelectedRfq(rfq);
    setGeneratedEmails(null);
    fetch(`/api/admin/rfq/${rfq.id}`).then(r => r.json()).then(setRfqDetail);
  }

  function startEditProfile(p: SupplierProfile) {
    setEditingProfile(p);
    setProfileForm({
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      contactName: p.contactName ?? "",
      country: p.country ?? "China",
      pricingScore: p.pricingScore ?? 3,
      deliveryScore: p.deliveryScore ?? 3,
      reliabilityScore: p.reliabilityScore ?? 3,
      qualityScore: p.qualityScore ?? 3,
      installationScore: p.installationScore ?? 3,
      responsivenessScore: p.responsivenessScore ?? 3,
      notes: p.notes ?? "",
      specializations: p.specializations ?? "[]",
    });
    setShowProfileForm(true);
  }

  const furnitureForRfq = autoFurniture ?? manualFurniture;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              <h1 className="text-xl font-bold text-gray-900" data-testid="page-title-supplier-intelligence">Supplier Procurement Intelligence</h1>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">Performance profiles · RFQ automation · Response tracking</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">
        <Tabs defaultValue="suppliers">
          <TabsList className="mb-6">
            <TabsTrigger value="suppliers" data-testid="tab-suppliers">
              <Shield className="w-4 h-4 mr-1.5" /> Supplier Profiles
            </TabsTrigger>
            <TabsTrigger value="rfq" data-testid="tab-rfq">
              <FileText className="w-4 h-4 mr-1.5" /> RFQ Projects
            </TabsTrigger>
          </TabsList>

          {/* ── SUPPLIERS TAB ────────────────────────────────────────────── */}
          <TabsContent value="suppliers">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-gray-500">{profiles.length} supplier{profiles.length !== 1 ? "s" : ""} profiled</p>
              <div className="flex gap-2">
                {profiles.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => loadSupplierDirectoryMutation.mutate()}
                    disabled={loadSupplierDirectoryMutation.isPending}
                    data-testid="btn-load-real-suppliers"
                  >
                    {loadSupplierDirectoryMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Load Real Supplier Directory
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-8 text-xs bg-gray-900 text-amber-400 hover:bg-gray-800"
                  onClick={() => { setEditingProfile(null); setProfileForm(emptyProfile); setShowProfileForm(!showProfileForm); }}
                  data-testid="btn-add-supplier"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Supplier
                </Button>
              </div>
            </div>

            {/* Add/Edit Profile Form */}
            {showProfileForm && (
              <Card className="border-0 shadow-sm mb-6 bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{editingProfile ? "Edit" : "Add"} Supplier Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Supplier ID (short code)</label>
                      <Input
                        placeholder="e.g. BOKE, FSZ"
                        value={profileForm.supplierId}
                        onChange={e => setProfileForm(f => ({ ...f, supplierId: e.target.value.toUpperCase() }))}
                        className="h-8 text-sm"
                        data-testid="input-supplier-id"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
                      <Input
                        placeholder="Supplier full name"
                        value={profileForm.supplierName}
                        onChange={e => setProfileForm(f => ({ ...f, supplierName: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid="input-supplier-name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Contact Name</label>
                      <Input
                        placeholder="Primary contact"
                        value={profileForm.contactName}
                        onChange={e => setProfileForm(f => ({ ...f, contactName: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Country</label>
                      <Input
                        value={profileForm.country}
                        onChange={e => setProfileForm(f => ({ ...f, country: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Routing Note / Specialisation Notes</label>
                    <Textarea
                      placeholder="e.g. Seating specialist only — do not send desk requests"
                      value={profileForm.notes}
                      onChange={e => setProfileForm(f => ({ ...f, notes: e.target.value }))}
                      className="text-sm h-16 resize-none"
                    />
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-3">Performance Scores</p>
                    <div className="space-y-3">
                      <ScoreSlider label="Pricing Competitiveness" value={profileForm.pricingScore} onChange={v => setProfileForm(f => ({ ...f, pricingScore: v }))} />
                      <ScoreSlider label="Delivery Speed" value={profileForm.deliveryScore} onChange={v => setProfileForm(f => ({ ...f, deliveryScore: v }))} />
                      <ScoreSlider label="Reliability" value={profileForm.reliabilityScore} onChange={v => setProfileForm(f => ({ ...f, reliabilityScore: v }))} />
                      <ScoreSlider label="Product Quality" value={profileForm.qualityScore} onChange={v => setProfileForm(f => ({ ...f, qualityScore: v }))} />
                      <ScoreSlider label="Responsiveness" value={profileForm.responsivenessScore} onChange={v => setProfileForm(f => ({ ...f, responsivenessScore: v }))} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-gray-900 text-amber-400 hover:bg-gray-800 h-8 text-xs"
                      onClick={() => saveProfileMutation.mutate(profileForm)}
                      disabled={!profileForm.supplierName || !profileForm.supplierId || saveProfileMutation.isPending}
                      data-testid="btn-save-supplier"
                    >
                      {saveProfileMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      {editingProfile ? "Update Profile" : "Save Profile"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowProfileForm(false); setEditingProfile(null); }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {profilesLoading ? (
              <div className="text-center py-10 text-gray-400 text-sm">Loading supplier profiles…</div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="w-10 h-10 mx-auto opacity-20 mb-3" />
                <p className="text-sm">No supplier profiles yet.</p>
                <p className="text-xs mt-1">Click "Load Real Supplier Directory" to load your existing suppliers, or add one manually.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {profiles.map(p => (
                  <SupplierCard
                    key={p.id}
                    profile={p}
                    onEdit={startEditProfile}
                    onDelete={id => deleteProfileMutation.mutate(id)}
                  />
                ))}
              </div>
            )}

            {/* Legend */}
            {profiles.length > 0 && (
              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-100 text-xs text-gray-500">
                <p className="font-semibold text-gray-700 mb-2">Scoring Methodology</p>
                <p>Overall score is weighted: Reliability 30% · Quality 25% · Pricing 20% · Delivery 15% · Responsiveness 10%</p>
                <div className="mt-2 flex gap-4">
                  <span className="text-emerald-600">● 75–100 = Preferred</span>
                  <span className="text-amber-600">● 55–74 = Acceptable</span>
                  <span className="text-red-500">● &lt;55 = Review</span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── RFQ TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="rfq">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left: RFQ list + create */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{rfqList.length} RFQ project{rfqList.length !== 1 ? "s" : ""}</p>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-gray-900 text-amber-400 hover:bg-gray-800"
                    onClick={() => { setShowRfqForm(!showRfqForm); setAutoFurniture(null); setAutoRouting(null); }}
                    data-testid="btn-new-rfq"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> New RFQ
                  </Button>
                </div>

                {/* Create RFQ Form */}
                {showRfqForm && (
                  <Card className="border-0 shadow-sm bg-gray-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">New RFQ Project</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input placeholder="Project name *" value={rfqForm.projectName} onChange={e => setRfqForm(f => ({ ...f, projectName: e.target.value }))} className="h-8 text-sm" data-testid="input-rfq-project-name" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Client name" value={rfqForm.clientName} onChange={e => setRfqForm(f => ({ ...f, clientName: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="Company" value={rfqForm.clientCompany} onChange={e => setRfqForm(f => ({ ...f, clientCompany: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="City" value={rfqForm.city} onChange={e => setRfqForm(f => ({ ...f, city: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="Timeline" value={rfqForm.timeline} onChange={e => setRfqForm(f => ({ ...f, timeline: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Headcount" type="number" value={rfqForm.headcount} onChange={e => setRfqForm(f => ({ ...f, headcount: e.target.value }))} className="h-8 text-sm" data-testid="input-rfq-headcount" />
                        <Input placeholder="Budget" value={rfqForm.budget} onChange={e => setRfqForm(f => ({ ...f, budget: e.target.value }))} className="h-8 text-sm" />
                      </div>

                      {/* Auto-generate furniture */}
                      {rfqForm.headcount && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-xs"
                          onClick={() => autoGenerateMutation.mutate({ headcount: parseInt(rfqForm.headcount), hasReception: true, hasBoardroom: true })}
                          disabled={autoGenerateMutation.isPending}
                          data-testid="btn-auto-generate-furniture"
                        >
                          {autoGenerateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                          Auto-generate furniture from {rfqForm.headcount} staff
                        </Button>
                      )}

                      {/* Furniture list preview */}
                      {autoFurniture && (
                        <div className="bg-white rounded border border-gray-100 p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Generated Furniture List</p>
                          <div className="space-y-1">
                            {autoFurniture.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs" data-testid={`furniture-item-${i}`}>
                                <span className="text-gray-700">{item.category}</span>
                                <span className="font-semibold text-gray-900">× {item.quantity}</span>
                              </div>
                            ))}
                          </div>
                          {autoRouting && (
                            <div className="mt-3 pt-2 border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-700 mb-1.5">Supplier Routing</p>
                              {autoRouting.map((s, i) => (
                                <div key={i} className="text-xs mb-1">
                                  <span className="text-amber-600 font-medium">{s.supplierName}</span>
                                  <span className="text-gray-400 ml-1">→ {s.categories.join(", ")}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Manual furniture lines */}
                      {!autoFurniture && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5">Or add furniture manually:</p>
                          <div className="space-y-1.5">
                            {manualFurniture.map((item, i) => (
                              <div key={i} className="flex gap-1.5" data-testid={`manual-furniture-${i}`}>
                                <Select value={item.category} onValueChange={v => setManualFurniture(f => f.map((x, idx) => idx === i ? { ...x, category: v } : x))}>
                                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {FURNITURE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Input type="number" min={1} value={item.quantity} onChange={e => setManualFurniture(f => f.map((x, idx) => idx === i ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))} className="w-16 h-7 text-xs text-center" />
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setManualFurniture(f => f.filter((_, idx) => idx !== i))} disabled={manualFurniture.length === 1}>
                                  <Trash2 className="w-3 h-3 text-gray-400" />
                                </Button>
                              </div>
                            ))}
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setManualFurniture(f => [...f, { category: "Workstations", quantity: 10 }])}>
                              <Plus className="w-3 h-3 mr-1" /> Add line
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 bg-gray-900 text-amber-400 hover:bg-gray-800 h-8 text-xs"
                          onClick={() => createRfqMutation.mutate({
                            ...rfqForm,
                            headcount: rfqForm.headcount ? parseInt(rfqForm.headcount) : null,
                            officeSize: rfqForm.officeSize ? parseInt(rfqForm.officeSize) : null,
                            furnitureJson: JSON.stringify(furnitureForRfq),
                            status: "draft",
                          })}
                          disabled={!rfqForm.projectName || createRfqMutation.isPending}
                          data-testid="btn-create-rfq"
                        >
                          {createRfqMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                          Create RFQ Project
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowRfqForm(false)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* RFQ List */}
                {rfqLoading ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
                ) : rfqList.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto opacity-20 mb-3" />
                    <p className="text-sm">No RFQ projects yet.</p>
                    <p className="text-xs mt-1">Create one from a client project to generate supplier RFQ emails.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rfqList.map(rfq => {
                      const sc = STATUS_CONFIG[rfq.status] ?? { color: "bg-gray-100 text-gray-500", label: rfq.status };
                      const isSelected = selectedRfq?.id === rfq.id;
                      return (
                        <Card
                          key={rfq.id}
                          className={`border-0 shadow-sm cursor-pointer hover:shadow-md transition-all ${isSelected ? "ring-2 ring-amber-400" : ""}`}
                          onClick={() => openRfqDetail(rfq)}
                          data-testid={`rfq-card-${rfq.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900 truncate">{rfq.projectName}</p>
                                <p className="text-xs text-gray-400 truncate">{rfq.clientCompany || rfq.clientName || "No client"} · {rfq.city || "Location TBD"}</p>
                                {rfq.headcount && <p className="text-xs text-gray-500 mt-0.5"><Users className="w-3 h-3 inline mr-0.5" />{rfq.headcount} staff</p>}
                              </div>
                              <Badge className={`text-xs flex-shrink-0 ${sc.color}`}>{sc.label}</Badge>
                            </div>
                            {rfq.timeline && <p className="text-xs text-amber-600 mt-1.5"><Clock className="w-3 h-3 inline mr-0.5" />{rfq.timeline}</p>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: RFQ Detail */}
              <div className="lg:col-span-3">
                {!selectedRfq ? (
                  <div className="flex items-center justify-center h-64 text-gray-300 flex-col gap-2">
                    <FileText className="w-12 h-12 opacity-20" />
                    <p className="text-sm text-gray-400">Select an RFQ project to view details</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Project header */}
                    <Card className="border-0 shadow-sm bg-gray-900 text-white">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide mb-1">
                              {STATUS_CONFIG[selectedRfq.status]?.label ?? selectedRfq.status}
                            </p>
                            <h2 className="text-lg font-bold">{selectedRfq.projectName}</h2>
                            {selectedRfq.clientCompany && <p className="text-gray-400 text-sm">{selectedRfq.clientCompany}</p>}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-transparent"
                            onClick={() => deleteRfqMutation.mutate(selectedRfq.id)}
                            data-testid="btn-delete-rfq"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                          {selectedRfq.headcount && <div><span className="text-gray-400">Staff</span><br /><span className="font-semibold">{selectedRfq.headcount}</span></div>}
                          {selectedRfq.city && <div><span className="text-gray-400">City</span><br /><span className="font-semibold">{selectedRfq.city}</span></div>}
                          {selectedRfq.timeline && <div><span className="text-gray-400">Timeline</span><br /><span className="font-semibold text-amber-400">{selectedRfq.timeline}</span></div>}
                          {selectedRfq.budget && <div><span className="text-gray-400">Budget</span><br /><span className="font-semibold">{selectedRfq.budget}</span></div>}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Furniture list */}
                    {rfqDetail?.project.furnitureJson && (
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Furniture Requirements</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1.5">
                            {JSON.parse(rfqDetail.project.furnitureJson).map((item: FurnitureItem, i: number) => (
                              <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                                <span className="text-sm text-gray-700">{item.category}</span>
                                <div className="text-right">
                                  <span className="font-semibold text-sm text-gray-900">× {item.quantity}</span>
                                  {item.notes && <span className="text-xs text-gray-400 block">{item.notes}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Supplier routing */}
                    {rfqDetail?.project.recommendationsJson && (
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Supplier Routing</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {JSON.parse(rfqDetail.project.recommendationsJson).map((s: SupplierMatch, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-amber-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900">{s.supplierName}</p>
                                {s.contactName && <p className="text-xs text-gray-400">Contact: {s.contactName}</p>}
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {s.categories.map(c => (
                                    <span key={c} className="px-1.5 py-0.5 bg-white text-xs text-gray-600 rounded border border-gray-100">{c}</span>
                                  ))}
                                </div>
                                {s.routingNote && (
                                  <p className="text-xs text-amber-700 mt-1"><AlertTriangle className="w-3 h-3 inline mr-0.5" />{s.routingNote}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Generate RFQ Emails */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">RFQ Email Drafts</CardTitle>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-gray-900 text-amber-400 hover:bg-gray-800"
                            onClick={() => generateEmailsMutation.mutate(selectedRfq.id)}
                            disabled={generateEmailsMutation.isPending}
                            data-testid="btn-generate-rfq-emails"
                          >
                            {generateEmailsMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                            Generate RFQ Emails
                          </Button>
                        </div>
                      </CardHeader>
                      {generatedEmails && (
                        <CardContent className="space-y-4">
                          {generatedEmails.map((email, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-semibold text-sm text-gray-900">{email.supplierName}</p>
                                  <p className="text-xs text-gray-500">{email.subject}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => { navigator.clipboard.writeText(email.body); toast({ title: "Email copied to clipboard" }); }}
                                  data-testid={`btn-copy-email-${i}`}
                                >
                                  Copy
                                </Button>
                              </div>
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white rounded p-3 max-h-48 overflow-y-auto border border-gray-100">
                                {email.body}
                              </pre>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {email.categories.map((c: string) => (
                                  <span key={c} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-xs rounded">{c}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>

                    {/* Log a response */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Log Supplier Response</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Supplier name" value={responseForm.supplierName} onChange={e => setResponseForm(f => ({ ...f, supplierName: e.target.value }))} className="h-8 text-sm" data-testid="input-response-supplier" />
                          <Select value={responseForm.category} onValueChange={v => setResponseForm(f => ({ ...f, category: v }))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                            <SelectContent>
                              {FURNITURE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input placeholder="Unit price" value={responseForm.quotedUnitPrice} onChange={e => setResponseForm(f => ({ ...f, quotedUnitPrice: e.target.value }))} className="h-8 text-sm" data-testid="input-response-unit-price" />
                          <Input placeholder="Total price" value={responseForm.quotedTotalPrice} onChange={e => setResponseForm(f => ({ ...f, quotedTotalPrice: e.target.value }))} className="h-8 text-sm" />
                          <Input placeholder="Lead time (weeks)" value={responseForm.deliveryWeeks} onChange={e => setResponseForm(f => ({ ...f, deliveryWeeks: e.target.value }))} className="h-8 text-sm" />
                          <Input placeholder="Availability" value={responseForm.availability} onChange={e => setResponseForm(f => ({ ...f, availability: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <Textarea placeholder="Notes / alternatives offered" value={responseForm.notes} onChange={e => setResponseForm(f => ({ ...f, notes: e.target.value }))} className="text-sm h-14 resize-none" />
                        <Button
                          size="sm"
                          className="w-full bg-gray-900 text-amber-400 hover:bg-gray-800 h-8 text-xs"
                          onClick={() => addResponseMutation.mutate(responseForm)}
                          disabled={!responseForm.supplierName || !responseForm.category || addResponseMutation.isPending}
                          data-testid="btn-log-response"
                        >
                          {addResponseMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                          Log Response
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Logged responses */}
                    {rfqDetail && rfqDetail.responses.length > 0 && (
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Supplier Responses ({rfqDetail.responses.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {rfqDetail.responses.map(r => (
                            <div key={r.id} className={`p-3 rounded-lg border ${r.status === "accepted" ? "bg-emerald-50 border-emerald-100" : r.status === "rejected" ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`} data-testid={`response-${r.id}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-sm text-gray-900">{r.supplierName}</p>
                                  <p className="text-xs text-gray-500">{r.category}</p>
                                </div>
                                <div className="text-right">
                                  {r.quotedTotalPrice && <p className="font-bold text-sm text-gray-900">{r.quotedTotalPrice}</p>}
                                  {r.quotedUnitPrice && <p className="text-xs text-gray-400">{r.quotedUnitPrice} / unit</p>}
                                </div>
                              </div>
                              {r.deliveryWeeks && <p className="text-xs text-gray-500 mt-1"><Clock className="w-3 h-3 inline mr-0.5" />Lead time: {r.deliveryWeeks} weeks</p>}
                              {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes}</p>}
                              <div className="flex gap-1.5 mt-2">
                                <Button size="sm" variant="outline" className="h-6 text-xs text-emerald-600 border-emerald-200" onClick={() => updateResponseMutation.mutate({ id: r.id, status: "accepted" })} data-testid={`btn-accept-${r.id}`}>Accept</Button>
                                <Button size="sm" variant="outline" className="h-6 text-xs text-red-500 border-red-200" onClick={() => updateResponseMutation.mutate({ id: r.id, status: "rejected" })} data-testid={`btn-reject-${r.id}`}>Reject</Button>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
