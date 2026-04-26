import { useQuery } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";

async function fetchAdminClients() {
  const res = await fetch("/api/admin/clients", { headers: { "x-tcd-admin-auth": "true" } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminClientProjects() {
  const { data } = useQuery({ queryKey: ["/api/admin/client-projects"], queryFn: fetchAdminClients });
  const projects = data?.projects || [];

  return (
    <main className="min-h-screen bg-[#080A12] text-white p-6 space-y-6">
      <div>
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Client SaaS Admin</p>
        <h1 className="text-3xl font-bold mt-2">Client Projects</h1>
      </div>
      <section className="grid md:grid-cols-2 gap-4">
        {projects.map((p: any) => (
          <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <FolderKanban className="text-amber-400" />
            <h2 className="font-semibold text-lg mt-4">{p.title}</h2>
            <p className="text-white/45 text-sm mt-2">{p.city} · {p.timeline} · {p.budget}</p>
            <p className="text-white/35 text-sm mt-2">Seats: {p.seats || "—"} · Status: {p.status}</p>
          </div>
        ))}
        {!projects.length && <p className="text-white/40">No client projects yet.</p>}
      </section>
    </main>
  );
}
