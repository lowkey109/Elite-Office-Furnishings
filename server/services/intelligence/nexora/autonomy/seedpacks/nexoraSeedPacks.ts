import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
  readNexoraJsonl,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

const SEED_LOG = nexoraLocalPath("seed-packs", "seed-log.jsonl");

export function createNexoraSeedPack(input: any = {}) {
  const seedPackId = String(input.seedPackId || nexoraLocalId("seed_pack"));
  const packType = String(input.packType || "business_default");

  const items = Array.isArray(input.items) ? input.items : [
    {
      type: "lead",
      payload: {
        customerName: "Example Facilities Manager",
        companyName: "Example Office Pty Ltd",
        need: "20 workstation office furniture package",
        budget: 18000,
        urgency: "high",
        location: "Brisbane",
      },
    },
    {
      type: "supplier",
      payload: {
        name: "Preferred Supplier Pool",
        category: "office furniture",
        leadTimeDays: 10,
        rating: 8,
      },
    },
    {
      type: "workflow",
      payload: {
        type: "office_lead_to_quote",
        name: "Default lead to quote workflow",
      },
    },
  ];

  const pack = {
    ok: true,
    nexoraBrain: true,
    seedPackId,
    packType,
    createdAt: now(),
    items,
    safety: {
      localOnly: true,
      noDbRequired: true,
      noCustomerCommitment: true,
    },
  };

  const file = nexoraLocalPath("seed-packs", `${seedPackId}.json`);
  writeNexoraJson(file, pack);

  appendNexoraJsonl(SEED_LOG, {
    event: "seed_pack.created",
    pack,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    file,
    pack,
  };
}

export function listNexoraSeedPacks(input: any = {}) {
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(SEED_LOG)
    .filter((row: any) => row.event === "seed_pack.created")
    .map((row: any) => row.pack)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraSeedPackStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_seed_packs",
    totalPacks: listNexoraSeedPacks({ limit: 1000 }).count,
  };
}
