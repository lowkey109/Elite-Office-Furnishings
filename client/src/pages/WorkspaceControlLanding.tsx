import { Link } from "wouter";
import { CheckCircle2, ClipboardList, DollarSign, Truck, Users } from "lucide-react";

export default function WorkspaceControlLanding() {
  return (
    <main className="min-h-screen bg-[#080A12] text-white px-6 py-24">
      <div className="max-w-7xl mx-auto">
        <p className="text-amber-400 text-xs uppercase tracking-[0.25em] font-semibold">Workspace Project Control</p>
        <h1 className="text-5xl md:text-7xl font-bold mt-5 max-w-5xl leading-[0.95]">
          Control cost, suppliers and execution across office projects.
        </h1>
        <p className="text-white/60 text-xl mt-6 max-w-3xl">
          Built for office moves, fitouts, procurement, finance requests and multi-site workspace rollouts.
        </p>

        <div className="grid lg:grid-cols-4 gap-4 mt-12">
          <Feature icon={<DollarSign />} title="Cost Control" text="Track budget movement before overruns become final outcomes." />
          <Feature icon={<ClipboardList />} title="Project Workspace" text="Keep decisions, briefs, files and requests in one client portal." />
          <Feature icon={<Truck />} title="Supplier Coordination" text="Manage furniture, delivery, substitutions and execution visibility." />
          <Feature icon={<Users />} title="Stakeholder Alignment" text="Give clients and internal teams a clear shared operating layer." />
        </div>

        <div className="flex flex-wrap gap-3 mt-10">
          <Link href="/client-signup"><span className="px-6 py-4 rounded-xl bg-amber-500 text-black font-semibold cursor-pointer">Start Project</span></Link>
          <Link href="/strategy-call"><span className="px-6 py-4 rounded-xl border border-white/15 text-white/80 cursor-pointer">Book Strategy Call</span></Link>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, title, text }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-amber-400">{icon}</div>
      <h2 className="text-xl font-semibold mt-5">{title}</h2>
      <p className="text-white/50 mt-3">{text}</p>
    </div>
  );
}
