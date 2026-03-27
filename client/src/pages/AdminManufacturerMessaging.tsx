import React, { useState } from "react";

export default function AdminManufacturerMessaging() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const runAIOutreach = async () => {
    try {
      setLoading(true);
      setStatus("Alex is starting manufacturer outreach...");

      const res = await fetch("/api/ai/manufacturer-outreach", {
        method: "POST",
      });

      const text = await res.text();

      try {
        const data = JSON.parse(text);
        setStatus(data.message || "Alex ran successfully");
      } catch {
        setStatus("Alex ran (non-JSON response)");
      }
    } catch (error) {
      setStatus("Request failed");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-400/80">
            Alex AI Team
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-semibold">
            Manufacturer Messaging
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Trigger Alex to start manufacturer outreach, launch supplier engagement,
            and activate the AI messaging workflow from one place.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">AI Outreach Control</h2>
            <p className="mt-2 text-slate-400">
              Use this action to start the manufacturer outreach workflow.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={runAIOutreach}
                disabled={loading}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Running Alex..." : "Run Alex Outreach"}
              </button>

              <button
                type="button"
                className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 hover:bg-slate-800"
              >
                View Logs
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">System Status</p>
              <p className="mt-2 text-sm md:text-base text-white">
                {status || "Waiting for Alex command..."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Workflow</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>• Load manufacturer targets</li>
              <li>• Generate outreach content</li>
              <li>• Trigger messaging flow</li>
              <li>• Record response status</li>
              <li>• Prepare follow-up actions</li>
            </ul>

            <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-300">
                Current Mode
              </p>
              <p className="mt-1 font-medium text-white">
                AI-assisted outreach trigger
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}