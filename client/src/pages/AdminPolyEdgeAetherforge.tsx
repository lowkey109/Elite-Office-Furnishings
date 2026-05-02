import PolyEdgeAetherforgeCockpit from "./polyedge/PolyEdgeAetherforgeCockpit";
import NexoraMicrofishPanel from "@/components/polyedge/NexoraMicrofishPanel";
import { NexoraVisualSystems } from "@/components/polyedge/NexoraVisualSystems";
import { NexoraVisualSystemsB } from "@/components/polyedge/NexoraVisualSystemsB";

export default function AdminPolyEdgeAetherforge() {
  return (
    <div className="relative min-h-screen bg-black">
      <PolyEdgeAetherforgeCockpit mode="admin" />

      <div className="fixed bottom-4 left-[170px] right-4 z-50 max-h-[420px] overflow-y-auto rounded-2xl border border-cyan-300/30 bg-black/95 p-3 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
        <NexoraMicrofishPanel />
        <div className="mt-4">
          <NexoraVisualSystems />
        </div>
        <div className="mt-4">
          <NexoraVisualSystemsB />
        </div>
      </div>
    </div>
  );
}
