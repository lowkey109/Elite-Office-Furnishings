import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraAlmightyStatus, createNexoraAlmightyCommand } from "../almighty/nexoraAlmightyCommander";
import { getNexoraGoalCompilerStatus } from "../goalcompiler/nexoraGoalCompiler";
import { getNexoraPlaybookStatus } from "../playbooks/nexoraPlaybookRunner";
import { getNexoraRiskSimulatorStatus } from "../risksim/nexoraRiskSimulator";

function now() {
  return new Date().toISOString();
}

export function createNexoraBrainPack(input: any = {}) {
  const brainPackId = String(input.brainPackId || nexoraLocalId("brainpack"));

  const pack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_brain_pack",
    brainPackId,
    createdAt: now(),
    almighty: getNexoraAlmightyStatus(),
    goalCompiler: getNexoraGoalCompilerStatus(),
    playbooks: getNexoraPlaybookStatus(),
    riskSimulator: getNexoraRiskSimulatorStatus(),
    command: createNexoraAlmightyCommand({
      commandId: `${brainPackId}_command`,
      intent: input.intent || "full_empire_local",
      budget: input.budget || 25000,
    }),
    safety: {
      singleBrain: "Nexora",
      localOnly: true,
      noPostgresRequired: true,
      noDeploy: true,
      approvalGatesPreserved: true,
    },
  };

  const file = nexoraLocalPath("brainpack", `${brainPackId}.json`);
  writeNexoraJson(file, pack);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    pack,
  };
}
