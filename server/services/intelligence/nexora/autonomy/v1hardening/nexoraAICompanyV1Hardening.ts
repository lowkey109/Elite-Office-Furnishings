import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const HARDENING_LOG = nexoraLocalPath("v1-hardening", "readiness", "hardening-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(HARDENING_LOG, {
    event,
    payload,
    createdAt: now(),
  });
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }

  return out;
}

export function createNexoraAdminAuthScaffold(input: any = {}) {
  const authId = String(input.authId || nexoraLocalId("auth_scaffold"));

  const scaffold = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_admin_auth_scaffold",
    authId,
    createdAt: now(),
    enforcementMode: "scaffold_only",
    roles: [
      {
        role: "viewer",
        permissions: [
          "read_status",
          "read_reports",
          "read_dashboards",
        ],
      },
      {
        role: "operator",
        permissions: [
          "read_status",
          "read_reports",
          "create_drafts",
          "run_safe_ticks",
          "create_local_records",
        ],
      },
      {
        role: "admin",
        permissions: [
          "all_operator_permissions",
          "approve_high_risk",
          "run_replay_dry_run",
          "run_migration_dry_run",
          "manage_routes",
          "manage_release_gate",
        ],
      },
    ],
    apiKeyHeader: "x-nexora-admin-key",
    plannedMiddleware: [
      "Resolve role from admin key.",
      "Map route to required role.",
      "Block high-risk routes for non-admin.",
      "Log all denied attempts.",
    ],
    explicitBlocks: [
      "No live trading route enabled.",
      "No private key handling route enabled.",
      "No supplier purchase order route enabled.",
      "No binding customer quote route enabled.",
    ],
    safety: {
      scaffoldOnly: true,
      doesNotBlockYet: true,
      highRiskApprovalGated: true,
      nexoraOnlyBrain: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "auth", `${authId}.json`), scaffold);
  journal("auth_scaffold.created", scaffold);

  return {
    ok: true,
    nexoraBrain: true,
    scaffold,
  };
}

export function createNexoraRouteAccessMap(input: any = {}) {
  const mapId = String(input.mapId || nexoraLocalId("access_map"));
  const files = walk("server");
  const routes: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const re = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = re.exec(source))) {
      const method = match[1].toUpperCase();
      const routePath = match[2];

      if (!routePath.includes("/api/nexora")) continue;

      const highRisk =
        /approve|reject|purge|delete|replay|restore|migration|execute|burst|live|deploy|private|key/i.test(routePath) ||
        method === "DELETE";

      const write = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

      routes.push({
        method,
        path: routePath,
        file,
        write,
        highRisk,
        requiredRole: highRisk ? "admin" : write ? "operator" : "viewer",
      });
    }
  }

  const accessMap = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_route_access_map",
    mapId,
    createdAt: now(),
    routeCount: routes.length,
    highRiskCount: routes.filter((route) => route.highRisk).length,
    writeCount: routes.filter((route) => route.write).length,
    routes: routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`)),
    safety: {
      generatedOnly: true,
      enforcementNotEnabledYet: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "access-map", `${mapId}.json`), accessMap);
  journal("route_access_map.created", accessMap);

  return {
    ok: true,
    nexoraBrain: true,
    accessMap,
  };
}

export function createNexoraOfficeAgentCommandPack(input: any = {}) {
  const packId = String(input.packId || nexoraLocalId("office_command_pack"));
  const domain = String(input.domain || "https://www.thecorporatedesk.au");

  const commands = [
    {
      name: "Office agents status",
      method: "GET",
      path: "/api/nexora/office-agents/status",
      curl: `curl -fsS "${domain}/api/nexora/office-agents/status"`,
      role: "viewer",
    },
    {
      name: "Lead intake",
      method: "POST",
      path: "/api/nexora/office-agents/lead/intake",
      curl: `curl -fsS -X POST "${domain}/api/nexora/office-agents/lead/intake" -H "Content-Type: application/json" -d '{"customerName":"Example","companyName":"Example Pty Ltd","need":"20 workstation office furniture package","budget":18000,"location":"Brisbane","timeline":"4 weeks"}'`,
      role: "operator",
    },
    {
      name: "Quote draft",
      method: "POST",
      path: "/api/nexora/office-agents/quote/draft",
      curl: `curl -fsS -X POST "${domain}/api/nexora/office-agents/quote/draft" -H "Content-Type: application/json" -d '{"companyName":"Example Pty Ltd","subtotal":18000,"estimatedCost":11160}'`,
      role: "operator",
    },
    {
      name: "Supplier request",
      method: "POST",
      path: "/api/nexora/office-agents/supplier/request",
      curl: `curl -fsS -X POST "${domain}/api/nexora/office-agents/supplier/request" -H "Content-Type: application/json" -d '{"name":"Preferred Supplier Pool","category":"office furniture","leadTimeDays":14}'`,
      role: "operator",
    },
    {
      name: "Follow-up draft",
      method: "POST",
      path: "/api/nexora/office-agents/followup/draft",
      curl: `curl -fsS -X POST "${domain}/api/nexora/office-agents/followup/draft" -H "Content-Type: application/json" -d '{"customerName":"Example","companyName":"Example Pty Ltd","need":"office furniture package"}'`,
      role: "operator",
    },
    {
      name: "Project scope",
      method: "POST",
      path: "/api/nexora/office-agents/project/scope",
      curl: `curl -fsS -X POST "${domain}/api/nexora/office-agents/project/scope" -H "Content-Type: application/json" -d '{"location":"Brisbane","installWindow":"4 weeks","access":"loading dock"}'`,
      role: "operator",
    },
  ];

  const pack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_office_agent_command_pack",
    packId,
    domain,
    createdAt: now(),
    commands,
    safety: {
      noBindingQuote: true,
      noPurchaseOrder: true,
      operatorDraftOnly: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "command-packs", `${packId}.json`), pack);
  journal("office_command_pack.created", pack);

  return {
    ok: true,
    nexoraBrain: true,
    pack,
  };
}

export function createNexoraCompanyRunScheduler(input: any = {}) {
  const schedulerId = String(input.schedulerId || nexoraLocalId("company_scheduler"));

  const schedules = [
    {
      name: "Morning company status",
      route: "/api/nexora/company-run/status",
      method: "GET",
      cadence: "daily_morning",
      role: "viewer",
    },
    {
      name: "Seed company agents",
      route: "/api/nexora/company-run/agents/seed",
      method: "POST",
      cadence: "on_bootstrap",
      role: "operator",
    },
    {
      name: "Daily company cycle",
      route: "/api/nexora/company-run/daily-cycle",
      method: "POST",
      cadence: "daily",
      role: "operator",
    },
    {
      name: "Executive company pack",
      route: "/api/nexora/company-run/executive-pack",
      method: "POST",
      cadence: "daily_evening",
      role: "operator",
    },
    {
      name: "Maintenance plan",
      route: "/api/nexora/maintenance/plan",
      method: "POST",
      cadence: "weekly",
      role: "operator",
    },
    {
      name: "V1 release gate",
      route: "/api/nexora/v1/release-gate",
      method: "POST",
      cadence: "manual",
      role: "admin",
    },
  ];

  const scheduler = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_run_scheduler",
    schedulerId,
    createdAt: now(),
    mode: "plan_only",
    schedules,
    safety: {
      doesNotRunAutomaticallyYet: true,
      noDeploy: true,
      noDbRequired: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "scheduler", `${schedulerId}.json`), scheduler);
  journal("company_scheduler.created", scheduler);

  return {
    ok: true,
    nexoraBrain: true,
    scheduler,
  };
}

export function createNexoraLocalDashboardSummary(input: any = {}) {
  const summaryId = String(input.summaryId || nexoraLocalId("dashboard"));

  const accessMap = createNexoraRouteAccessMap({
    mapId: `${summaryId}_access`,
  }).accessMap;

  const auth = createNexoraAdminAuthScaffold({
    authId: `${summaryId}_auth`,
  }).scaffold;

  const officePack = createNexoraOfficeAgentCommandPack({
    packId: `${summaryId}_office_pack`,
    domain: input.domain,
  }).pack;

  const scheduler = createNexoraCompanyRunScheduler({
    schedulerId: `${summaryId}_scheduler`,
  }).scheduler;

  const dashboard = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_dashboard_summary",
    summaryId,
    createdAt: now(),
    cards: [
      {
        title: "Company Run",
        route: "/api/nexora/company-run/status",
        role: "viewer",
      },
      {
        title: "Office Agents",
        route: "/api/nexora/office-agents/status",
        role: "viewer",
      },
      {
        title: "Maintenance",
        route: "/api/nexora/maintenance/plan",
        role: "operator",
      },
      {
        title: "Postgres Recovery",
        route: "/api/nexora/v1-hardening/postgres/checklist",
        role: "admin",
      },
      {
        title: "Replay Dry Run",
        route: "/api/nexora/v1-hardening/replay/dry-run",
        role: "admin",
      },
      {
        title: "V1 Readiness",
        route: "/api/nexora/v1-hardening/readiness/final",
        role: "viewer",
      },
    ],
    accessMapSummary: {
      routeCount: accessMap.routeCount,
      highRiskCount: accessMap.highRiskCount,
      writeCount: accessMap.writeCount,
    },
    auth,
    officePack,
    scheduler,
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "dashboard", `${summaryId}.json`), dashboard);
  journal("dashboard_summary.created", dashboard);

  return {
    ok: true,
    nexoraBrain: true,
    dashboard,
  };
}

export function createNexoraPostgresRecoveryChecklist(input: any = {}) {
  const checklistId = String(input.checklistId || nexoraLocalId("postgres_recovery"));

  const checklist = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_postgres_recovery_checklist",
    checklistId,
    createdAt: now(),
    postgresStatus: String(input.postgresStatus || "full_or_recovery_mode"),
    steps: [
      "Do not deploy new live database-dependent features while Postgres is full.",
      "Upgrade Railway Postgres storage or free space.",
      "Confirm DATABASE_URL is present.",
      "Run /api/nexora/runtime/db-check until durableKernel.ok is true.",
      "Run local data validation.",
      "Create migration pack.",
      "Run replay dry-run.",
      "Replay in small batches only after dry-run is clean.",
      "Confirm durable writes and counts.",
      "Only then consider enabling durable loops.",
    ],
    commands: [
      "curl -sS https://www.thecorporatedesk.au/api/nexora/runtime/db-check | head -c 2000",
      "curl -sS -X POST https://www.thecorporatedesk.au/api/nexora/migration-pack/create -H 'Content-Type: application/json' -d '{}'",
      "curl -sS -X POST https://www.thecorporatedesk.au/api/nexora/resilience/replay -H 'Content-Type: application/json' -d '{\"dryRun\":true,\"limit\":20}'",
    ],
    safety: {
      dryRunFirst: true,
      noDelete: true,
      noOverwrite: true,
      approvalGatedReplay: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "postgres", `${checklistId}.json`), checklist);
  journal("postgres_recovery_checklist.created", checklist);

  return {
    ok: true,
    nexoraBrain: true,
    checklist,
  };
}

export function createNexoraMigrationReplayDryRunControl(input: any = {}) {
  const replayId = String(input.replayId || nexoraLocalId("replay_dry_run"));

  const control = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_migration_replay_dry_run_control",
    replayId,
    createdAt: now(),
    mode: "dry_run_only",
    limit: Number(input.limit || 20),
    postgresReady: Boolean(input.postgresReady),
    allowedToReplayLive: false,
    blockers: [
      ...(input.postgresReady === true ? [] : ["Postgres not marked ready."]),
      "This control only creates a dry-run plan.",
      "Live replay requires separate admin approval.",
    ],
    plan: {
      source: "local fallback/filebus/journals",
      target: "Postgres durable tables",
      batchSize: Number(input.limit || 20),
      dryRun: true,
      noDelete: true,
      noOverwrite: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "replay", `${replayId}.json`), control);
  journal("migration_replay_dry_run.created", control);

  return {
    ok: true,
    nexoraBrain: true,
    control,
  };
}

export function createNexoraFinalV1ReadinessReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("v1_final"));

  const auth = createNexoraAdminAuthScaffold({
    authId: `${reportId}_auth`,
  }).scaffold;

  const accessMap = createNexoraRouteAccessMap({
    mapId: `${reportId}_access`,
  }).accessMap;

  const officePack = createNexoraOfficeAgentCommandPack({
    packId: `${reportId}_office`,
    domain: input.domain,
  }).pack;

  const scheduler = createNexoraCompanyRunScheduler({
    schedulerId: `${reportId}_scheduler`,
  }).scheduler;

  const postgres = createNexoraPostgresRecoveryChecklist({
    checklistId: `${reportId}_postgres`,
  }).checklist;

  const replay = createNexoraMigrationReplayDryRunControl({
    replayId: `${reportId}_replay`,
    postgresReady: Boolean(input.postgresReady),
  }).control;

  const blockers = [
    ...(input.postgresReady ? [] : ["Postgres storage not marked ready."]),
    ...(accessMap.highRiskCount > 0 ? [] : ["Route access map has no high-risk routes marked; verify manually."]),
    "Auth is scaffold-only until enforcement middleware is enabled.",
    "Deploy skipped until Postgres storage is fixed.",
  ];

  const readinessScore =
    100
    - (input.postgresReady ? 0 : 25)
    - 10; // auth scaffold only

  const report = {
    ok: readinessScore >= 70,
    nexoraBrain: true,
    service: "nexora_final_v1_readiness_report",
    reportId,
    createdAt: now(),
    readinessScore,
    blockers,
    auth,
    accessMapSummary: {
      routeCount: accessMap.routeCount,
      highRiskCount: accessMap.highRiskCount,
      writeCount: accessMap.writeCount,
    },
    officePack,
    scheduler,
    postgres,
    replay,
    finalRecommendation: input.postgresReady
      ? "Ready for manual v1 release review after auth middleware enforcement."
      : "Keep running local/offline mode until Postgres storage is upgraded.",
    safety: {
      noDeploy: true,
      noLiveTrading: true,
      highRiskApprovalGated: true,
      noSupplierPurchaseOrderWithoutApproval: true,
      noBindingCustomerQuoteWithoutApproval: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("v1-hardening", "readiness", `${reportId}.json`), report);
  journal("final_v1_readiness.created", report);

  recordNexoraTimelineEvent({
    type: "v1_readiness",
    title: "Nexora final v1 readiness report created",
    severity: readinessScore >= 70 ? "info" : "warning",
    payload: {
      reportId,
      readinessScore,
      blockers,
    },
  });

  recordNexoraMetric({
    name: "nexora_v1_readiness_score",
    value: readinessScore,
    unit: "score",
    dimensions: {
      postgresReady: Boolean(input.postgresReady),
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    report,
  };
}

export function getNexoraV1HardeningStatus() {
  const events = readNexoraJsonl(HARDENING_LOG);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_ai_company_v1_hardening",
    generatedAt: now(),
    eventCount: events.length,
    modules: [
      "admin_auth_middleware_scaffold",
      "route_access_map",
      "office_agent_command_packs",
      "company_run_scheduler",
      "local_dashboard_summary",
      "postgres_recovery_checklist",
      "migration_replay_dry_run_controls",
      "final_v1_readiness_report",
    ],
    safety: {
      noDeploy: true,
      scaffoldOnlyAuth: true,
      postgresRecoveryRequired: true,
    },
  };
}
