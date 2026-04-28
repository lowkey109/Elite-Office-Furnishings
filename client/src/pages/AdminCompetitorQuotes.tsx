import { useEffect, useMemo, useState } from "react";

type CompetitorQuote = {
  id: string;
  createdAt?: string;
  status?: string;
  customerName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  quoteAmount?: number | null;
  competitorQuote?: number | null;
  projectDetails?: string;
  uploadedFile?: {
    originalName?: string;
    storedName?: string;
    sizeBytes?: number;
    mimeType?: string;
    downloadUrl?: string;
  } | null;
  fileDownloadUrl?: string | null;
  nexora?: any;
};

function money(value: any) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "Not supplied";
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD"
  });
}

function fileSize(bytes: any) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

export default function AdminCompetitorQuotes() {
  const [items, setItems] = useState<CompetitorQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/customer-competitor-quotes", {
        headers: { "x-tcd-admin-auth": "true" },
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not load competitor quotes");

      setItems(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load competitor quotes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [
        item.customerName,
        item.companyName,
        item.email,
        item.phone,
        item.projectDetails,
        item.uploadedFile?.originalName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold">Uploaded competitor quotes</h1>
            <p className="mt-2 text-slate-400">
              Customer quote uploads that Nexora can use automatically before sending our final quote.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10"
          >
            Refresh
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
            placeholder="Search customer, company, email, file name or project details..."
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
            Loading competitor quotes...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-8 text-red-100">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
            No competitor quote uploads found.
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((item) => {
              const downloadUrl = item.fileDownloadUrl || item.uploadedFile?.downloadUrl || "";
              return (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold">
                          {item.customerName || "Unnamed customer"}
                        </h2>
                        <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                          {item.status || "uploaded"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {item.companyName || "No company"} · {item.email || "No email"} · {item.phone || "No phone"}
                      </p>

                      <p className="mt-3 text-2xl font-bold text-cyan-200">
                        {money(item.quoteAmount ?? item.competitorQuote)}
                      </p>

                      {item.projectDetails ? (
                        <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm text-slate-300">
                          {item.projectDetails}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-[260px] rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm">
                      <p className="font-semibold text-slate-200">Uploaded file</p>
                      {item.uploadedFile ? (
                        <>
                          <p className="mt-2 break-all text-slate-300">
                            {item.uploadedFile.originalName || "Uploaded quote file"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.uploadedFile.mimeType || "file"} {fileSize(item.uploadedFile.sizeBytes) ? "· " + fileSize(item.uploadedFile.sizeBytes) : ""}
                          </p>

                          {downloadUrl ? (
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-4 inline-flex w-full justify-center rounded-lg bg-cyan-300 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-200"
                            >
                              Download quote
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <p className="mt-2 text-slate-500">No file attached.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-4 text-xs text-slate-500">
                    ID: {item.id} · Created: {item.createdAt ? new Date(item.createdAt).toLocaleString("en-AU") : "Unknown"}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
