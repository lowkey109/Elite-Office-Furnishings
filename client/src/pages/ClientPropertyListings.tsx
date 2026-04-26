import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Home, Building2, Lock } from "lucide-react";

function token() {
  return typeof window !== "undefined" ? window.sessionStorage.getItem("tcd_client_token") || "" : "";
}

async function sendListingEnquiry(listingId: string, enquiryType: string) {
  const message =
    enquiryType === "request_intro"
      ? "Client requested an introduction for this listing."
      : enquiryType === "request_finance"
        ? "Client requested finance information for this listing."
        : enquiryType === "save_listing"
          ? "Client saved this listing."
          : "Client requested more information about this listing.";

  const res = await fetch("/api/client/property-listings/" + listingId + "/enquiry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token(),
    },
    body: JSON.stringify({ enquiryType, message }),
  });

  const json = await res.json();
  alert(json.ok ? "Request saved." : json.error || "Could not save request.");
}

async function fetchListings() {
  const res = await fetch("/api/client/property-listings", {
    headers: { authorization: "Bearer " + token() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ClientPropertyListings() {
  const authed = typeof window !== "undefined" && window.sessionStorage.getItem("tcd_client_auth") === "true";
  const { data, isLoading } = useQuery({
    queryKey: ["/api/client/property-listings"],
    queryFn: fetchListings,
    enabled: authed,
  });

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#080A12] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Lock className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold mt-4">Client login required</h1>
          <p className="text-white/45 mt-3">Log in to view property listings for sale and lease.</p>
          <Link href="/client-login"><span className="inline-block mt-6 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Client Login</span></Link>
        </div>
      </main>
    );
  }

  const listings = data?.listings || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Nexora LeaseHawk</p>
        <h1 className="text-3xl font-bold mt-2">Properties for Sale & Lease</h1>
        <p className="text-white/50 mt-2">Manual, partner-submitted and CSV property listings. Domain/PropTrack can be connected later.</p>
      </div>

      {isLoading && <p className="text-white/40">Loading listings...</p>}

      <section className="grid lg:grid-cols-2 gap-4">
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
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => sendListingEnquiry(l.id, "general_enquiry")} className="px-3 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold">Enquire</button>
              <button onClick={() => sendListingEnquiry(l.id, "request_intro")} className="px-3 py-2 rounded-xl border border-white/10 text-white/70 text-sm">Request Intro</button>
              <button onClick={() => sendListingEnquiry(l.id, "request_finance")} className="px-3 py-2 rounded-xl border border-white/10 text-white/70 text-sm">Request Finance</button>
              <button onClick={() => sendListingEnquiry(l.id, "save_listing")} className="px-3 py-2 rounded-xl border border-white/10 text-white/70 text-sm">Save</button>
            </div>
            {l.listingUrl && <a href={l.listingUrl} target="_blank" rel="noreferrer" className="inline-block mt-4 text-amber-300 underline">Open listing</a>}
          </div>
        ))}
      </section>

      {!listings.length && !isLoading && <p className="text-white/40">No active listings yet.</p>}
    </main>
  );
}
