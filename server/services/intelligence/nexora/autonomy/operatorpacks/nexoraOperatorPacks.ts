import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
  readNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

export function createNexoraOperatorPack(input: any = {}) {
  const packId = String(input.packId || nexoraLocalId("operator_pack"));
  const domain = String(input.domain || "https://www.thecorporatedesk.au");

  const commands = [
    {
      name: "Ping",
      command: `curl -fsS "${domain}/api/nexora/ping"`,
    },
    {
      name: "Runtime diagnostic",
      command: `curl -fsS "${domain}/api/nexora/runtime/diagnostic"`,
    },
    {
      name: "Local status",
      command: `curl -fsS "${domain}/api/nexora/local/status"`,
    },
    {
      name: "Readiness",
      command: `curl -fsS "${domain}/api/nexora/readiness/v1"`,
    },
    {
      name: "Production readiness",
      command: `curl -fsS "${domain}/api/nexora/prod-readiness/status"`,
    },
  ];

  const pack = {
    ok: true,
    nexoraBrain: true,
    packId,
    domain,
    createdAt: now(),
    commands,
    safety: {
      readOnlyMostly: true,
      noDbRequired: true,
      noDeploy: true,
    },
  };

  const file = nexoraLocalPath("operator-packs", `${packId}.json`);
  writeNexoraJson(file, pack);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    pack,
  };
}

export function getNexoraOperatorPack(input: any = {}) {
  const packId = String(input.packId || "");
  const file = nexoraLocalPath("operator-packs", `${packId}.json`);

  return {
    ok: Boolean(readNexoraJson(file, null)),
    nexoraBrain: true,
    packId,
    file,
    pack: readNexoraJson(file, null),
  };
}
