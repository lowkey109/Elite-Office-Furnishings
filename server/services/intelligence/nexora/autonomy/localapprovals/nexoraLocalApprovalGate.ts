import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";

function now() {
  return new Date().toISOString();
}

function approvalFile(id: string) {
  return nexoraLocalPath("approvals", `${id}.json`);
}

const APPROVAL_LOG = nexoraLocalPath("approvals", "approval-log.jsonl");

export function createNexoraLocalApproval(input: any = {}) {
  const approvalId = String(input.approvalId || nexoraLocalId("approval"));
  const policy = evaluateNexoraPolicy(input);

  const approval = {
    ok: true,
    nexoraBrain: true,
    approvalId,
    status: "pending",
    risk: String(input.risk || (policy.approvalRequired ? "high" : "medium")),
    reason: String(input.reason || "Approval required by Nexora local gate."),
    requestedBy: String(input.requestedBy || "nexora"),
    payload: input.payload || input,
    policy,
    createdAt: now(),
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
  };

  writeNexoraJson(approvalFile(approvalId), approval);
  appendNexoraJsonl(APPROVAL_LOG, {
    event: "approval.created",
    approvalId,
    approval,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    approval,
  };
}

export function decideNexoraLocalApproval(input: any = {}) {
  const approvalId = String(input.approvalId || "");
  const decision = String(input.decision || "").toLowerCase();
  const file = approvalFile(approvalId);
  const approval = readNexoraJson(file, null);

  if (!approval) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Approval not found.",
      approvalId,
    };
  }

  if (!["approved", "rejected"].includes(decision)) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "decision must be approved or rejected.",
      approvalId,
    };
  }

  approval.status = decision;
  approval.decidedAt = now();
  approval.decidedBy = String(input.decidedBy || "nexora-admin");
  approval.decisionNote = String(input.note || "");

  writeNexoraJson(file, approval);
  appendNexoraJsonl(APPROVAL_LOG, {
    event: `approval.${decision}`,
    approvalId,
    approval,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    approval,
  };
}

export function listNexoraLocalApprovals(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(APPROVAL_LOG)
    .filter((row: any) => row.event === "approval.created")
    .map((row: any) => row.approval)
    .filter((approval: any) => !status || approval.status === status)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraLocalApprovalStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_approval_gate",
    pending: listNexoraLocalApprovals({ status: "pending", limit: 100 }).count,
    total: listNexoraLocalApprovals({ limit: 1000 }).count,
  };
}
