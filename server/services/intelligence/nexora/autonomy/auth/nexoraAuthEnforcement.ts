import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

const AUTH_LOG = nexoraLocalPath("auth", "auth-log.jsonl");

export function createNexoraAuthPolicy(input: any = {}) {
  const policyId = String(input.policyId || nexoraLocalId("auth_policy"));

  const policy = {
    ok: true,
    nexoraBrain: true,
    policyId,
    name: String(input.name || "Nexora local admin policy"),
    enforcementMode: String(input.enforcementMode || "scaffold_only"),
    rules: Array.isArray(input.rules) ? input.rules : [
      {
        match: "/api/nexora/*/purge",
        role: "admin",
        reason: "Purge actions require admin.",
      },
      {
        match: "/api/nexora/*/replay",
        role: "admin",
        reason: "Replay actions require admin.",
      },
      {
        match: "/api/nexora/*/execute",
        role: "admin",
        reason: "Execution actions require admin.",
      },
      {
        match: "/api/nexora/*/burst",
        role: "admin",
        reason: "Operating bursts require admin.",
      },
    ],
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("auth", `${policyId}.json`), policy);
  appendNexoraJsonl(AUTH_LOG, {
    event: "auth.policy.created",
    policy,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    policy,
  };
}

export function evaluateNexoraAuthRequest(input: any = {}) {
  const route = String(input.route || "");
  const method = String(input.method || "GET").toUpperCase();
  const role = String(input.role || "anonymous");

  const highRisk =
    /purge|delete|replay|execute|burst|approve|reject|restore|migration/i.test(route) ||
    ["DELETE", "PATCH", "PUT"].includes(method);

  const requiredRole = highRisk ? "admin" : "viewer";
  const allowed = highRisk ? role === "admin" : ["viewer", "operator", "admin"].includes(role);

  const decision = {
    ok: true,
    nexoraBrain: true,
    route,
    method,
    role,
    highRisk,
    requiredRole,
    allowed,
    enforcementMode: "scaffold_only",
    createdAt: now(),
    note: "Scaffold only. This does not block requests until middleware enforcement is enabled.",
  };

  appendNexoraJsonl(AUTH_LOG, {
    event: "auth.request.evaluated",
    decision,
    createdAt: now(),
  });

  return decision;
}

export function listNexoraAuthEvents(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(AUTH_LOG).slice(-limit).reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraAuthStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_auth_enforcement_scaffold",
    enforcementMode: "scaffold_only",
    totalEvents: listNexoraAuthEvents({ limit: 1000 }).count,
  };
}
