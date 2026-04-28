import { useMemo, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, FileText } from "lucide-react";

type UploadResult = {
  ok: boolean;
  blocked?: boolean;
  stage?: string;
  message?: string;
  customerMessage?: string;
  competitorQuote?: number | null;
  confidence?: "high" | "medium" | "low";
  reason?: string;
  error?: string;
};

function money(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "Not detected";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD"
  }).format(Number(value));
}

export default function UploadYourQuote() {
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [manualText, setManualText] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const combinedText = useMemo(() => {
    return [fileText, manualText].filter(Boolean).join("\n\n").trim();
  }, [fileText, manualText]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const lower = file.name.toLowerCase();

    if (
      lower.endsWith(".txt") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".json") ||
      lower.endsWith(".md") ||
      lower.endsWith(".html")
    ) {
      setFileText(await file.text());
      return;
    }

    setFileText("");
    setResult({
      ok: false,
      blocked: true,
      stage: "quote_upload_text_required",
      error: "This file type was uploaded, but browser text extraction is not available yet. Paste the quote total/details below so Nexora can read it."
    });
  }

  async function submitQuote() {
    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/customer/competitor-quote/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          fileName,
          extractedText: combinedText
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        ok: false,
        error: error?.message || "Upload failed"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">The Corporate Desk</p>
              <h1 className="text-3xl font-bold">Upload your quote</h1>
            </div>
          </div>

          <p className="mt-5 text-slate-300">
            Already have a quote from another company? Upload or paste it here. Nexora will check it honestly.
            If your current quote is genuinely the better deal, we will tell you instead of pushing you into a worse option.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-300">Name</span>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Email</span>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>
          </div>

          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/80 px-6 py-10 text-center hover:border-emerald-400">
            <FileText className="mb-3 h-9 w-9 text-emerald-300" />
            <span className="font-semibold">Choose quote file</span>
            <span className="mt-1 text-sm text-slate-400">
              Text files are read automatically. For PDF/image quotes, paste the quote details below for now.
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json,.html,.md"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>

          {fileName ? (
            <p className="mt-3 text-sm text-slate-300">
              Uploaded: <span className="text-white">{fileName}</span>
            </p>
          ) : null}

          <label className="mt-6 block">
            <span className="text-sm text-slate-300">Paste quote text or total amount</span>
            <textarea
              className="mt-2 min-h-40 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Example: Grand Total inc GST: $8,450. Delivery included. Valid for 14 days."
            />
          </label>

          <button
            onClick={submitQuote}
            disabled={submitting || !combinedText}
            className="mt-6 w-full rounded-xl bg-emerald-400 px-5 py-4 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Nexora is checking..." : "Let Nexora check this quote"}
          </button>

          {result ? (
            <div className={
              "mt-6 rounded-2xl border p-5 " +
              (result.ok
                ? "border-emerald-400/30 bg-emerald-400/10"
                : "border-amber-400/30 bg-amber-400/10")
            }>
              <div className="flex items-start gap-3">
                {result.ok ? (
                  <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-300" />
                ) : (
                  <AlertTriangle className="mt-1 h-6 w-6 text-amber-300" />
                )}
                <div>
                  <p className="font-bold">
                    {result.ok ? "Quote received" : "Nexora needs review"}
                  </p>
                  <p className="mt-2 text-slate-200">
                    {result.customerMessage || result.message || result.error}
                  </p>
                  <p className="mt-3 text-sm text-slate-300">
                    Detected quote amount: <span className="text-white">{money(result.competitorQuote)}</span>
                  </p>
                  {result.confidence ? (
                    <p className="mt-1 text-sm text-slate-400">Confidence: {result.confidence}</p>
                  ) : null}
                  {result.reason ? (
                    <p className="mt-1 text-sm text-slate-400">{result.reason}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
