import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileSpreadsheet } from "lucide-react";

const sampleCsv = `listingType,propertyType,source,status,title,address,suburb,city,state,price,rent,bedrooms,bathrooms,parking,landSizeSqm,buildingSizeSqm,agentName,agencyName,listingUrl,description
sale,house,csv_upload,active,CSV test house,22 Example St,Paddington,Brisbane,QLD,$1250000,,4,2,2,450,,Jane Agent,Example Realty,https://example.com,Imported house listing
commercial_lease,office,csv_upload,active,CSV office lease,88 Commercial Rd,Fortitude Valley,Brisbane,QLD,,$650/sqm gross,,,,,420,John Agent,Example Commercial,https://example.com,Imported office lease`;

export default function AdminPropertyListingsImport() {
  const [csv, setCsv] = useState(sampleCsv);
  const [partnerName, setPartnerName] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/property-listings/import-csv", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tcd-admin-auth": "true",
        },
        body: JSON.stringify({
          csv,
          source: "csv_upload",
          partnerName,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      alert(data.ok ? `Imported ${data.imported} listings.` : data.error || "Import failed");
      console.log(data);
    },
  });

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">LeaseHawk Listings</p>
        <h1 className="text-3xl font-bold mt-2">CSV Import</h1>
        <p className="text-white/45 mt-2">
          Paste listing spreadsheets from agents, builders, developers or partners. No paid Domain/REA API required.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div className="flex items-center gap-3 text-amber-300">
          <FileSpreadsheet />
          <h2 className="text-xl font-semibold">Paste CSV</h2>
        </div>

        <label className="block">
          <span className="text-sm text-white/45">Partner / agency name</span>
          <input
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="Example Realty"
            className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm text-white/45">CSV content</span>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className="mt-2 w-full min-h-[420px] rounded-xl bg-black/30 border border-white/10 px-4 py-3 font-mono text-xs"
          />
        </label>

        <button
          onClick={() => mutation.mutate()}
          className="px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Import Listings
        </button>
      </section>
    </main>
  );
}
