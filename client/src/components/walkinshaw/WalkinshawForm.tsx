import { useState } from "react";

const STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "ACT", "NT"];

export default function WalkinshawForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const form = new FormData(e.currentTarget);

    const payload = {
      companyName: form.get("companyName"),
      contactName: form.get("contactName"),
      email: form.get("email"),
      phone: form.get("phone"),
      state: form.get("state"),
      teamSize: form.get("teamSize"),
      projectType: form.get("projectType"),
      budgetBand: form.get("budgetBand"),
      timeline: form.get("timeline"),
      message: form.get("message"),
      acceptedTerms: form.get("acceptedTerms") === "on",
      acceptedMarketing: form.get("acceptedMarketing") === "on",
    };

    try {
      const res = await fetch("/api/promo/walkinshaw/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to submit");
      }

      setResult(json.message || "Submitted");
      (e.currentTarget as HTMLFormElement).reset();
    } catch (err: any) {
      setResult(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="enter" className="rounded-3xl border border-neutral-200 bg-white p-6">
      <h2 className="text-2xl font-semibold">Enter your project</h2>
      <p className="mt-2 text-sm text-neutral-600">
        This form stores your commercial enquiry and awards entry if the current rules are met.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Input name="companyName" label="Company name" required />
        <Input name="contactName" label="Contact name" required />
        <Input name="email" label="Work email" type="email" autoComplete="email" required />
        <Input name="phone" label="Phone" type="tel" autoComplete="tel" />
        <Select name="state" label="State" options={STATES} required />
        <Input name="teamSize" label="Team size" />
        <Input name="projectType" label="Project type" placeholder="Relocation / fit-out / upgrade" />
        <Input name="budgetBand" label="Budget band" placeholder="$20k–$50k / $50k–$100k / $100k+" />
        <Input name="timeline" label="Timeline" placeholder="0-3 months / 3-6 months / 6-12 months" />
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium">Project notes</label>
          <textarea
            name="message"
            rows={5}
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-900"
          />
        </div>

        <label className="flex items-start gap-3 text-sm md:col-span-2">
          <input type="checkbox" name="acceptedTerms" className="mt-1" required />
          <span>
            I agree to the <a href="/walkinshaw/terms" className="underline">campaign terms</a>.
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm md:col-span-2">
          <input type="checkbox" name="acceptedMarketing" className="mt-1" />
          <span>I agree to receive campaign and project updates.</span>
        </label>

        <div className="md:col-span-2">
          <button
            disabled={loading}
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit entry"}
          </button>
        </div>

        {result ? (
          <div className="md:col-span-2 rounded-2xl bg-neutral-100 px-4 py-3 text-sm">
            {result}
          </div>
        ) : null}
      </form>
    </section>
  );
}

function Input(props: any) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        {...rest}
        className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-900"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <select
        name={name}
        required={required}
        className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-900"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}