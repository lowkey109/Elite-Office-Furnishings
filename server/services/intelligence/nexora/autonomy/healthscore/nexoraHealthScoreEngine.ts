import { getNexoraLocalCoreStatus } from "../localcore/nexoraLocalCore";
import { validateNexoraLocalData } from "../validation/nexoraLocalDataValidator";
import { createNexoraApiCatalogue } from "../apicatalogue/nexoraApiCatalogue";
import { getNexoraV1ReadinessReport } from "../readiness/nexoraV1Readiness";
import { getNexoraSeedPackStatus } from "../seedpacks/nexoraSeedPacks";

function now() {
  return new Date().toISOString();
}

export function calculateNexoraHealthScore() {
  const localCore = getNexoraLocalCoreStatus();
  const validation = validateNexoraLocalData();
  const catalogue = createNexoraApiCatalogue({ catalogueId: "health_score_catalogue" }).catalogue;
  const readiness = getNexoraV1ReadinessReport();
  const seedPacks = getNexoraSeedPackStatus();

  let score = 100;

  if (!localCore.ok) score -= 20;
  if (!validation.ok) score -= 25;
  if (catalogue.routeCount < 10) score -= 10;
  if (readiness.score < 80) score -= 15;
  if (seedPacks.totalPacks === 0) score -= 5;

  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 50 ? "degraded" : "critical";

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_health_score_engine",
    generatedAt: now(),
    score,
    grade,
    inputs: {
      localCore,
      validation,
      catalogueSummary: {
        routeCount: catalogue.routeCount,
        groupCounts: catalogue.groupCounts,
      },
      readiness,
      seedPacks,
    },
    recommendations: [
      validation.ok ? "Local data validates." : "Fix local data validation failures.",
      seedPacks.totalPacks > 0 ? "Seed packs exist." : "Create seed pack for local test data.",
      readiness.score >= 80 ? "Readiness score acceptable." : "Improve readiness score.",
    ],
  };
}
