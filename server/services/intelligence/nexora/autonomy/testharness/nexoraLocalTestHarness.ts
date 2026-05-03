import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { createNexoraApiCatalogue } from "../apicatalogue/nexoraApiCatalogue";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";

function now() {
  return new Date().toISOString();
}

const TEST_LOG = nexoraLocalPath("test-harness", "test-log.jsonl");

export function createNexoraLocalTestPlan(input: any = {}) {
  const testPlanId = String(input.testPlanId || nexoraLocalId("test_plan"));
  const catalogue = createNexoraApiCatalogue({ catalogueId: `${testPlanId}_catalogue` }).catalogue;

  const routes = catalogue.routes
    .filter((route: any) => route.path.includes("/api/nexora"))
    .slice(0, Number(input.limit || 80));

  const tests = routes.map((route: any, index: number) => {
    const policy = evaluateNexoraPolicy({
      route: route.path,
      method: route.method,
    });

    return {
      testId: `${testPlanId}_test_${index + 1}`,
      method: route.method,
      path: route.path,
      highRisk: route.highRisk,
      write: route.write,
      expected: {
        shouldRequireAdmin: route.highRisk,
        policyAllowed: policy.allowed,
      },
      file: route.file,
    };
  });

  const testPlan = {
    ok: true,
    nexoraBrain: true,
    testPlanId,
    createdAt: now(),
    testCount: tests.length,
    tests,
    safety: {
      dryRunOnly: true,
      noNetworkCall: true,
      noDeploy: true,
    },
  };

  const file = nexoraLocalPath("test-harness", `${testPlanId}.json`);
  writeNexoraJson(file, testPlan);

  appendNexoraJsonl(TEST_LOG, {
    event: "test_plan.created",
    testPlan,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    file,
    testPlan,
  };
}

export function runNexoraLocalTestPlanDryRun(input: any = {}) {
  const plan = createNexoraLocalTestPlan(input).testPlan;

  const results = plan.tests.map((test: any) => ({
    testId: test.testId,
    method: test.method,
    path: test.path,
    dryRun: true,
    passed: true,
    note: "Dry-run only. No HTTP request executed.",
    highRisk: test.highRisk,
  }));

  const report = {
    ok: true,
    nexoraBrain: true,
    testRunId: nexoraLocalId("test_run"),
    createdAt: now(),
    planId: plan.testPlanId,
    total: results.length,
    passed: results.filter((result: any) => result.passed).length,
    failed: results.filter((result: any) => !result.passed).length,
    results,
  };

  appendNexoraJsonl(TEST_LOG, {
    event: "test_run.dry_run",
    report,
    createdAt: now(),
  });

  return report;
}

export function listNexoraLocalTestRuns(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(TEST_LOG)
    .filter((row: any) => row.event === "test_run.dry_run")
    .map((row: any) => row.report)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}
