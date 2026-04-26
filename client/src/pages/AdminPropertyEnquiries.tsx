import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, RefreshCw } from "lucide-react";

async function fetchEnquiries() {
  const res = await fetch("/api/admin/property-enquiries", {
    headers: { "x-tcd-admin-auth": "true" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminPropertyEnquiries() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["/api/admin/property-enquiries"],
    queryFn: fetchEnquiries,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch("/api/admin/property-enquiries/" + id, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-tcd-admin-auth": "true",
        },
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const enquiries = data?.enquiries || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">LeaseHawk Admin</p>
          <h1 className="text-3xl font-bold mt-2">Property Enquiries</h1>
          <p className="text-white/45 mt-2">Client listing enquiries, intro requests, finance requests and saved listing actions.</p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex gap-2 items-center">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card label="Total" value={data?.stats?.total || 0} />
        <Card label="New" value={data?.stats?.new || 0} />
        <Card label="Contacted" value={data?.stats?.contacted || 0} />
        <Card label="Converted" value={data?.stats?.converted || 0} />
      </div>

      {isLoading && <p className="text-white/40">Loading enquiries...</p>}

      <section className="grid lg:grid-cols-2 gap-4">
        {enquiries.map((e: any) => (
          <div key={e.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-semibold">{e.listingTitle || e.listingId}</p>
                <p className="text-white/45 text-sm">{e.clientCompanyName || "Client"} · {e.clientEmail}</p>
              </div>
              <MessageSquare className="text-amber-400" />
            </div>

            <p className="text-amber-300 mt-3">{e.enquiryType}</p>
            <p className="text-white/50 text-sm mt-2">{e.message || "No message provided."}</p>
            <p className="text-white/35 text-xs mt-2">{e.createdAt}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {["new", "reviewing", "contacted", "converted", "closed", "dismissed"].map((status) => (
                <button
                  key={status}
                  onClick={() => updateMutation.mutate({ id: e.id, status })}
                  className={`px-3 py-2 rounded-xl text-xs border ${e.status === status ? "bg-amber-500 text-black border-amber-500" : "border-white/10 text-white/55"}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {!enquiries.length && !isLoading && <p className="text-white/40">No property enquiries yet.</p>}
    </main>
  );
}

function Card({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-white/40 text-sm">{label}</p>
    </div>
  );
}
