import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { calculateNexoraHealthScore } from "../healthscore/nexoraHealthScoreEngine";
import { createNexoraApiCatalogue } from "../apicatalogue/nexoraApiCatalogue";
import { createNexoraOperatorPack } from "../operatorpacks/nexoraOperatorPacks";

function now() {
  return new Date().toISOString();
}

export function createNexoraPackageManifest(input: any = {}) {
  const manifestId = String(input.manifestId || nexoraLocalId("package_manifest"));
  const health = calculateNexoraHealthScore();
  const apiCatalogue = createNexoraApiCatalogue({ catalogueId: `${manifestId}_api` });
  const operatorPack = createNexoraOperatorPack({
    packId: `${manifestId}_operator`,
    domain: input.domain || "https://www.thecorporatedesk.au",
  });

  const manifest = {
    ok: true,
    nexoraBrain: true,
    manifestId,
    version: String(input.version || "local-v1-prep"),
    createdAt: now(),
    health,
    apiCatalogue,
    operatorPack,
    packageContents: [
      "Nexora local/offline modules",
      "API catalogue",
      "Operator command pack",
      "Health score report",
      "Readiness controls",
    ],
    safety: {
      noDeploy: true,
      dbIndependent: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
    },
  };

  const file = nexoraLocalPath("package-kit", `${manifestId}.json`);
  writeNexoraJson(file, manifest);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    manifest,
  };
}
