require("tsx/cjs");

const {
  evaluateNexoraExecutionGate,
  assertNexoraExecutionApproved,
} = require("../server/services/intelligence/nexora/nexoraExecutionGate.ts");

function show(label, result) {
  console.log("");
  console.log("== " + label + " ==");
  console.log({
    ok: result.ok,
    allowed: result.allowed,
    decision: result.decision,
    moduleKey: result.moduleKey,
    intent: result.intent,
    requiresHumanApproval: result.requiresHumanApproval,
    empireScore: result.empireScore?.empireScore,
    businessDecision: result.empireScore?.businessDecision,
    reason: result.reason,
  });
}

const outreach = evaluateNexoraExecutionGate({
  moduleKey: "outreach",
  intent: "send_message",
  requestedBy: "nexora",
  reason: "Nexora found a high value office move lead and wants to start outreach",
  evidence: {
    dealValue: 250000,
    leadIntent: "office relocation",
    city: "Brisbane",
  },
  dryRun: true,
});

show("outreach approval", outreach);

const phantomPaper = evaluateNexoraExecutionGate({
  moduleKey: "phantom_x",
  intent: "paper_trade",
  requestedBy: "nexora",
  reason: "Nexora approved a paper trade for learning only",
  evidence: {
    paperMode: true,
    risk: "contained",
  },
  dryRun: true,
});

show("phantom x paper approval", phantomPaper);

const liveTrade = evaluateNexoraExecutionGate({
  moduleKey: "phantom_x",
  intent: "live_trade",
  requestedBy: "nexora",
  reason: "Test live trade should stay blocked until explicitly configured",
  evidence: {},
  dryRun: true,
});

show("phantom x live trade blocked", liveTrade);

try {
  assertNexoraExecutionApproved({
    moduleKey: "phantom_x",
    intent: "live_trade",
    requestedBy: "nexora",
    reason: "This should throw because live trading is not enabled",
    evidence: {},
    dryRun: true,
  });
  console.error("ERROR: live trade unexpectedly approved");
  process.exit(1);
} catch (err) {
  console.log("");
  console.log("== expected block throw ==");
  console.log(err.message);
}

if (!outreach.allowed) {
  console.error("ERROR: outreach should be approved by Nexora");
  process.exit(1);
}

if (!phantomPaper.allowed) {
  console.error("ERROR: phantom paper trade should be approved by Nexora");
  process.exit(1);
}

if (liveTrade.allowed) {
  console.error("ERROR: live trade should be blocked");
  process.exit(1);
}

console.log("");
console.log("Nexora execution gate smoke test passed.");
