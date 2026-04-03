import { getActiveConfig, getConfigHistory, getConfigChanges } from "./tradingConfig";
import { getPendingProposals } from "./ruleUpdateEngine";
import { getRollbackHistory } from "./configRollback";
import { generateParameterProposals, persistProposals } from "./ruleUpdateEngine";
import { evaluateGuardrails } from "./tradingGuardrails";
import { runShadowValidation } from "./shadowValidation";
import { db } from "../../db";
import { tradingAdaptationProposals } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AdaptationReport {
  currentConfig: {
    versionName: string;
    isActive: boolean;
    activatedAt: string | null;
    changeSummary: string | null;
    approvalStatus: string;
    config: Record<string, any>;
  } | null;
  pendingProposals: any[];
  recentChanges: any[];
  rejectedProposals: any[];
  rollbackHistory: any[];
  guardrailFailures: any[];
}

export async function getAdaptationReport(): Promise<AdaptationReport> {
  const { version, config } = await getActiveConfig();
  const proposals = await getPendingProposals();
  const configHistory = await getConfigHistory(10);
  const rollbacks = await getRollbackHistory(10);

  const pendingProposals = proposals.filter(p => p.approvalStatus === "pending");
  const rejectedProposals = proposals.filter(p => p.approvalStatus === "rejected" || p.guardrailStatus === "failed");
  const guardrailFailures = proposals.filter(p => p.guardrailStatus === "failed");

  const recentChanges: any[] = [];
  for (const cv of configHistory.slice(0, 5)) {
    if (cv.approvalStatus === "approved" && cv.changeSummary) {
      const changes = await getConfigChanges(cv.id);
      recentChanges.push({
        versionName: cv.versionName,
        changeSummary: cv.changeSummary,
        activatedAt: cv.activatedAt,
        changes,
      });
    }
  }

  return {
    currentConfig: version ? {
      versionName: version.versionName,
      isActive: version.isActive,
      activatedAt: version.activatedAt?.toISOString() ?? null,
      changeSummary: version.changeSummary,
      approvalStatus: version.approvalStatus,
      config: config as Record<string, any>,
    } : null,
    pendingProposals: pendingProposals.map(p => ({
      id: p.id,
      proposalType: p.proposalType,
      proposal: p.proposalJson,
      sampleSize: p.sampleSize,
      confidence: p.confidence,
      guardrailStatus: p.guardrailStatus,
      approvalStatus: p.approvalStatus,
      shadowResult: p.shadowResult,
      createdAt: p.createdAt?.toISOString(),
    })),
    recentChanges,
    rejectedProposals: rejectedProposals.map(p => ({
      id: p.id,
      proposalType: p.proposalType,
      proposal: p.proposalJson,
      guardrailStatus: p.guardrailStatus,
      guardrailNotes: p.guardrailNotes,
      approvalStatus: p.approvalStatus,
      createdAt: p.createdAt?.toISOString(),
    })),
    rollbackHistory: rollbacks.map(r => ({
      id: r.id,
      fromConfigVersionId: r.fromConfigVersionId,
      toConfigVersionId: r.toConfigVersionId,
      reason: r.reason,
      createdAt: r.createdAt?.toISOString(),
    })),
    guardrailFailures: guardrailFailures.map(p => ({
      id: p.id,
      proposalType: p.proposalType,
      proposal: p.proposalJson,
      guardrailNotes: p.guardrailNotes,
      createdAt: p.createdAt?.toISOString(),
    })),
  };
}

export async function runAdaptationCycle(): Promise<{
  proposals: number;
  guardrailPassed: number;
  guardrailFailed: number;
  shadowValidated: number;
}> {
  const paramProposals = await generateParameterProposals();
  if (paramProposals.length === 0) {
    return { proposals: 0, guardrailPassed: 0, guardrailFailed: 0, shadowValidated: 0 };
  }

  const proposalIds = await persistProposals(paramProposals);

  const guardrailResults = evaluateGuardrails(paramProposals);
  let passed = 0, failed = 0;

  for (let i = 0; i < paramProposals.length; i++) {
    const result = guardrailResults.get(i);
    if (!result) continue;

    if (result.passed) {
      passed++;
      await db.update(tradingAdaptationProposals).set({
        guardrailStatus: "passed",
        guardrailNotes: `Risk level: ${result.riskLevel}`,
      }).where(eq(tradingAdaptationProposals.id, proposalIds[i]));
    } else {
      failed++;
      await db.update(tradingAdaptationProposals).set({
        guardrailStatus: "failed",
        guardrailNotes: result.failureReasons.join("; "),
        approvalStatus: "rejected",
      }).where(eq(tradingAdaptationProposals.id, proposalIds[i]));
    }
  }

  const passedProposals = paramProposals.filter((_, i) => guardrailResults.get(i)?.passed);
  let shadowValidated = 0;

  if (passedProposals.length > 0) {
    const { config } = await getActiveConfig();
    const shadowResults = await runShadowValidation(config, passedProposals);

    for (const sr of shadowResults) {
      const originalIdx = paramProposals.indexOf(passedProposals[sr.proposalIndex]);
      if (originalIdx >= 0) {
        await db.update(tradingAdaptationProposals).set({
          shadowResult: sr as any,
        }).where(eq(tradingAdaptationProposals.id, proposalIds[originalIdx]));
        if (sr.improvement) shadowValidated++;
      }
    }
  }

  return { proposals: paramProposals.length, guardrailPassed: passed, guardrailFailed: failed, shadowValidated };
}
