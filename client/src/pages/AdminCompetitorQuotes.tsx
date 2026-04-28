import { useEffect, useMemo, useState } from "react";

type CompetitorQuoteSubmission = {
  id?: string;
  createdAt?: string;
  submittedAt?: string;
  customerName?: string;
  name?: string;
  customerEmail?: string;
  email?: string;
  customerPhone?: string;
  phone?: string;
  quoteRequestId?: string;
  quoteNumber?: string;
  competitorQuote?: number | string;
  competitorPrice?: number | string;
  customerCompetitorQuote?: number | string;
  otherQuoteAmount?: number | string;
  amount?: number | string;
  fileName?: string;
  filename?: string;
  notes?: string;
  message?: string;
  status?: string;
  [key: string]: any;
};

function money(value: any) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return "Not supplied";
  return parsed.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  });
}

function getAmount(item: CompetitorQuoteSubmission) {
  return (
    item.competitorQuote ??
    item.competitorPrice ??
    item.customerCompetitorQuote ??
    item.otherQuoteAmount ??
    item.amount ??
    ""
  );
}

function getName(item: CompetitorQuoteSubmission) {
  return item.customerName || item.name || "Customer";
}

function getEmail(item: CompetitorQuoteSubmission) {
  return item.customerEmail || item.email || "";
}

function getPhone(item: CompetitorQuoteSubmission) {
  return item.customerPhone || item.phone || "";
}

function getDate(item: CompetitorQuoteSubmission) {
  return item.createdAt || item.submittedAt || "";
}

export default function AdminCompetitorQuotes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [submissions, setSubmissions] = useState<CompetitorQuoteSubmission[]>([]);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/customer-competitor-quotes", {
        cache: "no-store",
        headers: { "x-tcd-admin-auth": "true" }
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load uploaded competitor quotes");
      }

      setSourcePath(data.sourcePath || "");
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load uploaded competitor quotes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;

    return submissions.filter((item) => {
      const text = JSON.stringify(item).toLowerCase();
      return text.includes(q);
    });
  }, [search, submissions]);

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Nexora Procurement</p>
            <h1 className="mt-2 text-3xl font-bold">Uploaded Competitor Quotes</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Customer-uploaded quotes are captured here. Nexora automatically checks these before sending a customer quote,
              blocks unsafe pricing, and refuses work where matching the other quote would leave less than $500 gross profit.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Refresh
          </button>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Uploaded quotes</p>
            <p className="mt-2 text-3xl font-bold">{submissions.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:col-span-2">
            <p className="text-sm text-slate-400">Intake source</p>
            <p className="mt-2 break-all text-sm text-slate-200">{sourcePath || "Not found yet"}</p>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="text-sm text-emerald-200">Guardrail</p>
            <p className="mt-2 font-semibold">Minimum $500 gross profit</p>
          </div>
        </section>

        <div className="mb-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, email, phone, quote ID, amount..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">Loading uploaded quotes...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-8 text-red-100">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
            No uploaded competitor quotes found yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/10 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Competitor amount</th>
                    <th className="px-4 py-3">Quote ref</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Nexora action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, index) => (
                    <tr key={item.id || index} className="border-b border-white/10 align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{getName(item)}</p>
                        <p className="mt-1 text-xs text-slate-400">{item.id || "No ID"}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        <p>{getEmail(item) || "No email"}</p>
                        <p className="mt-1">{getPhone(item) || "No phone"}</p>
                      </td>
                      <td className="px-4 py-4 font-semibold text-cyan-200">{money(getAmount(item))}</td>
                      <td className="px-4 py-4 text-slate-300">
                        {item.quoteRequestId || item.quoteNumber || "Auto-match by email/phone"}
                      </td>
                      <td className="px-4 py-4 text-slate-300">{item.fileName || item.filename || "No file name"}</td>
                      <td className="px-4 py-4 text-slate-300">{getDate(item) || "No date"}</td>
                      <td className="px-4 py-4">
                        <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                          Auto-check before customer quote send
                        </div>
                        {(item.notes || item.message) ? (
                          <p className="mt-2 max-w-xs text-xs text-slate-400">{item.notes || item.message}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
