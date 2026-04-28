import { useState } from "react";

type UploadState = "idle" | "uploading" | "success" | "error";

export default function UploadYourQuote() {
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("uploading");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/customer/competitor-quote/upload", {
        method: "POST",
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not upload your quote");
      }

      setState("success");
      setMessage(data.message || "Quote uploaded. Nexora will compare it before we send anything back.");
      form.reset();
      setFileName("");
    } catch (error: any) {
      setState("error");
      setMessage(error?.message || "Something went wrong uploading your quote.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            The Corporate Desk
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Upload your current quote
          </h1>
          <p className="mt-5 text-lg text-slate-300">
            Send us the quote you already have. Nexora will compare it against our supply,
            delivery, install and minimum profit guardrails before we recommend anything.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            If we cannot beat it properly, or matching it would leave less than $500 gross profit,
            we will tell you honestly to stay with your original quote.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Your name</span>
                <input
                  name="customerName"
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  placeholder="Benjamin Mumford"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Company</span>
                <input
                  name="companyName"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  placeholder="Company name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  placeholder="you@company.com.au"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Phone</span>
                <input
                  name="phone"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  placeholder="0400 000 000"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Competitor quote amount
                </span>
                <input
                  name="quoteAmount"
                  required
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  placeholder="$12,500"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Upload quote file
                </span>
                <input
                  name="quoteFile"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name || "")}
                  className="w-full rounded-xl border border-dashed border-cyan-300/40 bg-slate-900 px-4 py-4 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                />
                {fileName ? <p className="mt-2 text-xs text-cyan-200">Selected: {fileName}</p> : null}
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Project details
                </span>
                <textarea
                  name="projectDetails"
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  placeholder="Tell us the quantities, delivery suburb, install needs, timeline or anything missing from the quote."
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={state === "uploading"}
              className="mt-6 w-full rounded-xl bg-cyan-300 px-6 py-4 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "uploading" ? "Uploading quote..." : "Upload quote for Nexora to compare"}
            </button>

            {message ? (
              <div
                className={
                  "mt-5 rounded-xl border px-4 py-3 text-sm " +
                  (state === "success"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                    : "border-red-400/40 bg-red-400/10 text-red-100")
                }
              >
                {message}
              </div>
            ) : null}
          </form>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">What Nexora checks</h2>
            <ul className="mt-5 space-y-4 text-sm text-slate-300">
              <li>• Supplier/manufacturer cost is never exposed to the customer.</li>
              <li>• Customer quote must sit above landed cost.</li>
              <li>• Matching another quote must still leave at least $500 gross profit.</li>
              <li>• If the other quote is genuinely better, we tell the customer to stay with it.</li>
              <li>• Admin can view/download the uploaded quote in the competitor quote dashboard.</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
