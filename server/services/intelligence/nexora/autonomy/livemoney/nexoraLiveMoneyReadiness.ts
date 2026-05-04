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

const JOURNAL = nexoraLocalPath("live-money", "journal", "live-money-journal.jsonl");
const READINESS_LOG = nexoraLocalPath("live-money", "readiness", "readiness-log.jsonl");
const APPROVAL_LOG = nexoraLocalPath("live-money", "approvals", "approval-log.jsonl");
const WALLET_POLICY_FILE = nexoraLocalPath("live-money", "wallet-policy", "wallet-policy.json");
const EXECUTION_POLICY_FILE = nexoraLocalPath("live-money", "execution-policy", "execution-policy.json");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeCount(file: string, event?: string) {
  const rows = readNexoraJsonl(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

function latest(file: string, limit = 50) {
  return readNexoraJsonl(file).slice(-limit).reverse();
}

export function createNexoraWalletPolicy(input: any = {}) {
  const policy = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_wallet_policy",
    updatedAt: now(),
    status: "locked",
    privateKeysAllowedInNexora: false,
    seedPhrasesAllowedInNexora: false,
    rawWalletExportsAllowed: false,
    signingInsideNexoraAllowed: false,
    futureAllowedPattern: {
      externalSigner: true,
      hardwareWallet: true,
      dedicatedExecutionService: true,
      minimumBalanceOnly: true,
      withdrawalBlocked: true,
      perTradeCaps: true,
      dailyLossCaps: true,
      ownerCommitRequired: true,
    },
    hardRules: [
      "Never paste private keys into Nexora.",
      "Never store seed phrases in repo, env, JSON, logs, or chat.",
      "Live execution must use an external signer or isolated execution service.",
      "Nexora may prepare order intents but must not hold signing secrets.",
      "Owner must explicitly commit before live mode is enabled.",
    ],
    operatorNote: input.operatorNote || "Future live-money mode must use external signing and strict caps.",
  };

  writeNexoraJson(WALLET_POLICY_FILE, policy);
  journal("wallet_policy.created", policy);

  return { ok: true, nexoraBrain: true, policy };
}

export function getNexoraWalletPolicy() {
  const policy = readNexoraJson(WALLET_POLICY_FILE, null);
  if (policy) return { ok: true, nexoraBrain: true, policy };
  return createNexoraWalletPolicy({});
}

export function createNexoraLiveExecutionPolicy(input: any = {}) {
  const policy = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_execution_policy",
    updatedAt: now(),
    status: "blocked_until_ready",
    liveTradingEnabled: false,
    liveOrdersAllowed: false,
    liveOrderPlacementAllowed: false,
    clobSigningAllowed: false,
    maxInitialBankrollUsd: Number(input.maxInitialBankrollUsd || 100),
    maxSingleTradeUsd: Number(input.maxSingleTradeUsd || 5),
    maxDailyLossUsd: Number(input.maxDailyLossUsd || 10),
    maxOpenExposureUsd: Number(input.maxOpenExposureUsd || 20),
    requiredBeforeLive: [
      "Postgres storage upgraded and durableKernel.ok true",
      "At least 30 backtest runs",
      "At least 100 paper settlements",
      "Positive paper PnL",
      "Risk governor events present",
      "Swarm consensus records present",
      "Kill switch tested",
      "External signer designed",
      "Owner commits explicitly",
      "Separate live execution build reviewed",
    ],
    mandatoryKillSwitches: [
      "daily loss stop",
      "max exposure stop",
      "max single trade stop",
      "latency spike stop",
      "CLOB/API error stop",
      "reconciliation mismatch stop",
      "manual owner stop",
    ],
    hardBlocksNow: [
      "No live orders",
      "No private keys",
      "No wallet signing",
      "No withdrawals",
      "No autonomous commitment",
    ],
  };

  writeNexoraJson(EXECUTION_POLICY_FILE, policy);
  journal("live_execution_policy.created", policy);

  return { ok: true, nexoraBrain: true, policy };
}

export function getNexoraLiveExecutionPolicy() {
  const policy = readNexoraJson(EXECUTION_POLICY_FILE, null);
  if (policy) return { ok: true, nexoraBrain: true, policy };
  return createNexoraLiveExecutionPolicy({});
}

export function createNexoraLiveMoneyApprovalRequest(input: any = {}) {
  const approvalId = String(input.approvalId || nexoraLocalId("live_money_approval"));
  const policy = evaluateNexoraPolicy({
    ...input,
    liveTrading: true,
    bindingCommitment: true,
    approvalRequired: true,
  });

  const approval = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_money_approval_request",
    approvalId,
    createdAt: now(),
    status: "blocked_for_now",
    title: String(input.title || "Live money promotion request"),
    requestedBy: String(input.requestedBy || "operator"),
    reason: String(input.reason || "Future live trading requires owner commit and separate execution build."),
    policy,
    decision: "blocked_until_requirements_met",
    ownerCanOnly: [
      "reject",
      "request more paper evidence",
      "prepare external signer design",
    ],
    ownerCannotYet: [
      "enable live trading",
      "paste private key",
      "place real CLOB orders",
    ],
    safety: {
      noLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      requiresFutureBuild: true,
    },
    payload: input.payload || {},
  };

  writeNexoraJson(nexoraLocalPath("live-money", "approvals", `${approvalId}.json`), approval);
  appendNexoraJsonl(APPROVAL_LOG, { event: "live_money.approval_requested", approval, createdAt: now() });
  journal("live_money.approval_requested", approval);

  recordNexoraTimelineEvent({
    type: "live_money_approval",
    title: "Live money approval request blocked for now",
    severity: "critical",
    payload: { approvalId },
  });

  return { ok: true, nexoraBrain: true, approval };
}

export function evaluateNexoraLiveMoneyReadiness(input: any = {}) {
  const readinessId = String(input.readinessId || nexoraLocalId("live_money_readiness"));

  const backtests = safeCount(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), "backtest.run");
  const paperSettlements =
    safeCount(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"), "reconciliation.settled") +
    safeCount(nexoraLocalPath("trading-lab", "portfolio", "portfolio-log.jsonl"), "position.settled") +
    safeCount(nexoraLocalPath("trading-mega", "performance", "performance-log.jsonl"), "paper_execution.settled");

  const riskEvents = safeCount(nexoraLocalPath("risk-governor", "risk-governor-log.jsonl"), "risk.evaluated");
  const swarmConsensus = safeCount(nexoraLocalPath("swarm-runtime", "consensus", "swarm-consensus.jsonl"), "swarm.consensus.created");
  const killSwitchEvents = safeCount(nexoraLocalPath("trading-execution", "kill-switch", "kill-switch-log.jsonl"));
  const readinessGates = safeCount(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), "promotion_gate.evaluated");

  const postgresReady = Boolean(input.postgresReady);
  const externalSignerDesigned = Boolean(input.externalSignerDesigned);
  const ownerCommit = Boolean(input.ownerCommit);

  const checks = [
    { key: "postgresReady", ok: postgresReady, required: true, actual: postgresReady },
    { key: "backtests", ok: backtests >= 30, required: 30, actual: backtests },
    { key: "paperSettlements", ok: paperSettlements >= 100, required: 100, actual: paperSettlements },
    { key: "riskEvents", ok: riskEvents >= 20, required: 20, actual: riskEvents },
    { key: "swarmConsensus", ok: swarmConsensus >= 20, required: 20, actual: swarmConsensus },
    { key: "killSwitchTested", ok: killSwitchEvents > 0, required: 1, actual: killSwitchEvents },
    { key: "readinessGate", ok: readinessGates > 0, required: 1, actual: readinessGates },
    { key: "externalSignerDesigned", ok: externalSignerDesigned, required: true, actual: externalSignerDesigned },
    { key: "ownerCommit", ok: ownerCommit, required: true, actual: ownerCommit },
  ];

  const failed = checks.filter((check) => !check.ok);

  const readiness = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_money_readiness",
    readinessId,
    createdAt: now(),
    decision: failed.length ? "not_ready" : "ready_for_separate_live_execution_design_review",
    liveTradingStillBlocked: true,
    privateKeysStillBlocked: true,
    checks,
    failed,
    walletPolicy: getNexoraWalletPolicy().policy,
    executionPolicy: getNexoraLiveExecutionPolicy().policy,
    nextAllowedStep: failed.length
      ? "Continue paper testing and satisfy failed checks."
      : "Design isolated external signer and live execution build. Do not enable live trading in this build.",
    safety: {
      thisDoesNotEnableLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      ownerCommitRequired: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("live-money", "readiness", `${readinessId}.json`), readiness);
  appendNexoraJsonl(READINESS_LOG, { event: "live_money.readiness", readiness, createdAt: now() });
  journal("live_money.readiness", readiness);

  recordNexoraMetric({
    name: "live_money_failed_checks",
    value: failed.length,
    unit: "checks",
    dimensions: { decision: readiness.decision },
  });

  return { ok: true, nexoraBrain: true, readiness };
}

export function createNexoraLiveMoneyOperatorChecklist(input: any = {}) {
  const checklistId = String(input.checklistId || nexoraLocalId("live_money_checklist"));

  const checklist = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_money_operator_checklist",
    checklistId,
    createdAt: now(),
    title: "Future Live Money Operator Checklist",
    steps: [
      "Buy/upgrade Postgres storage.",
      "Verify durableKernel.ok true.",
      "Run local-to-Postgres replay dry-run.",
      "Run at least 30 backtests.",
      "Run at least 100 paper settlements.",
      "Verify positive paper PnL.",
      "Verify drawdown limits.",
      "Run risk governor tests.",
      "Run swarm consensus tests.",
      "Test kill switch.",
      "Design external signer.",
      "Set initial bankroll cap.",
      "Set max trade cap.",
      "Set daily loss cap.",
      "Owner commits explicitly.",
      "Build separate live execution module.",
      "Review code before any real order path.",
    ],
    hardNever: [
      "Never paste private keys into Nexora.",
      "Never store seed phrase.",
      "Never enable live trading in this scaffold.",
      "Never bypass owner commit.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("live-money", "operator-checklists", `${checklistId}.json`), checklist);
  appendNexoraJsonl(JOURNAL, { event: "live_money.checklist", checklist, createdAt: now() });

  return { ok: true, nexoraBrain: true, checklist };
}

export function getNexoraLiveMoneyStatus() {
  const readiness = latestReadiness();
  const approvals = readNexoraJsonl(APPROVAL_LOG).filter((row: any) => row.event === "live_money.approval_requested");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_money_status",
    generatedAt: now(),
    liveTradingEnabled: false,
    privateKeysAllowed: false,
    walletSigningAllowed: false,
    latestReadiness: readiness,
    approvals: approvals.length,
    walletPolicy: getNexoraWalletPolicy().policy,
    executionPolicy: getNexoraLiveExecutionPolicy().policy,
    message: "This scaffold prepares for future real-money support but does not enable it.",
  };
}

function latestReadiness() {
  return readNexoraJsonl(READINESS_LOG)
    .filter((row: any) => row.event === "live_money.readiness")
    .map((row: any) => row.readiness)
    .slice(-1)[0] || null;
}
