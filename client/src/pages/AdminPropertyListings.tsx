import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Home, Building2, Upload, RefreshCw } from "lucide-react";

async function fetchListings() {
  const res = await fetch("/api/admin/property-listings", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminPropertyListings() {
  const [form, setForm] = useState({
    listingType: "sale",
    propertyType: "house",
    source: "manual",
    status: "active",
    title: "",
    address: "",
    suburb: "",
    city: "Brisbane",
    state: "QLD",
    price: "",
    rent: "",
    bedrooms: "",
    bathrooms: "",
    parking: "",
    landSizeSqm: "",
    buildingSizeSqm: "",
    agentName: "",
    agencyName: "",
    listingUrl: "",
    description: "",
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/property-listings"],
    queryFn: fetchListings,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/property-listings/manual", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tcd-admin-auth": "true",
        },
        body: JSON.stringify(form),
      });
      return res.json();
    },
    onSuccess: () => {
      refetch();
      alert("Listing saved.");
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/property-listings/seed-samples", {
        method: "POST",
        headers: { "x-tcd-admin-auth": "true" },
      });
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const listings = data?.listings || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Nexora LeaseHawk</p>
          <h1 className="text-3xl font-bold mt-2">Property Listings</h1>
          <p className="text-white/45 mt-2">Free-first listing engine: manual, partner-submitted and CSV listings now. Domain/PropTrack adapters later.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => seedMutation.mutate()} className="px-4 py-2 rounded-xl border border-white/10 text-white/70">Seed Samples</button>
          <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex gap-2 items-center"><RefreshCw className="w-4 h-4" />Refresh</button>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold mb-4">Add Listing</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <Select label="Listing Type" value={form.listingType} onChange={(v: string) => setForm({ ...form, listingType: v })} options={["sale", "rent", "lease", "commercial_lease", "development_site"]} />
          <Select label="Property Type" value={form.propertyType} onChange={(v: string) => setForm({ ...form, propertyType: v })} options={["house", "unit", "townhouse", "land", "office", "warehouse", "retail", "industrial", "development_site", "other"]} />
          <Select label="Source" value={form.source} onChange={(v: string) => setForm({ ...form, source: v })} options={["manual", "partner_submitted", "csv_upload"]} />
          <Select label="Status" value={form.status} onChange={(v: string) => setForm({ ...form, status: v })} options={["active", "under_offer", "sold", "leased", "withdrawn"]} />
          {[
            ["title", "Title"],
            ["address", "Address"],
            ["suburb", "Suburb"],
            ["city", "City"],
            ["state", "State"],
            ["price", "Price"],
            ["rent", "Rent"],
            ["bedrooms", "Beds"],
            ["bathrooms", "Baths"],
            ["parking", "Parking"],
            ["landSizeSqm", "Land sqm"],
            ["buildingSizeSqm", "Building sqm"],
            ["agentName", "Agent"],
            ["agencyName", "Agency"],
            ["listingUrl", "Listing URL"],
          ].map(([key, label]) => (
            <Input key={key} label={label} value={(form as any)[key]} onChange={(v: string) => setForm({ ...form, [key]: v })} />
          ))}
          <label className="md:col-span-4">
            <span className="text-sm text-white/45">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-2 w-full min-h-[90px] rounded-xl bg-black/30 border border-white/10 px-4 py-3" />
          </label>
        </div>
        <button onClick={() => createMutation.mutate()} className="mt-4 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold">Save Listing</button>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        {isLoading && <p className="text-white/40">Loading listings...</p>}
        {listings.map((l: any) => (
          <div key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="text-white/45 text-sm">{l.address} {l.suburb} {l.state}</p>
              </div>
              <div className="text-right">
                {l.propertyType === "house" || l.propertyType === "unit" || l.propertyType === "townhouse" ? <Home className="text-amber-400" /> : <Building2 className="text-amber-400" />}
                <p className="text-white/35 text-xs mt-1">{l.source}</p>
              </div>
            </div>
            <p className="text-amber-300 mt-3">{l.price || l.rent || "Price on request"}</p>
            <p className="text-white/50 text-sm mt-2">{l.description}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs text-white/45">
              <span>{l.listingType}</span><span>·</span><span>{l.propertyType}</span><span>·</span><span>{l.status}</span>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Input({ label, value, onChange }: any) {
  return (
    <label>
      <span className="text-sm text-white/45">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3" />
    </label>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label>
      <span className="text-sm text-white/45">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3">
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
