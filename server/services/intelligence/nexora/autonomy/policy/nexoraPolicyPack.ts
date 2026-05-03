function now() {
  return new Date().toISOString();
}

const policies = [
  {
    id: "POLICY_NEXORA_ONLY_BRAIN",
    severity: "critical",
    rule: "Nexora is the only decision authority. Workers execute delegated work only.",
  },
  {
    id: "POLICY_TRADING_SANDBOX",
    severity: "critical",
    rule: "Trading and Phantom X remain paper/sandbox unless explicitly promoted through approval.",
  },
  {
    id: "POLICY_SUPPLIER_COMMITMENT_GATE",
    severity: "high",
    rule: "Purchase orders and supplier commitments require approval.",
  },
  {
    id: "POLICY_CUSTOMER_BINDING_GATE",
    severity: "high",
    rule: "Customer-facing binding quotes require approval.",
  },
  {
    id: "POLICY_DB_OUTAGE_FALLBACK",
    severity: "medium",
    rule: "If Postgres is unavailable or full, capture work in local fallback systems.",
  },
];

export function evaluateNexoraPolicy(input: any = {}) {
  const text = JSON.stringify(input).toLowerCase();
  const violations: any[] = [];

  if (text.includes("livetrading") || text.includes("live trade") || text.includes('"tradingmode":"live"')) {
    violations.push(policies[1]);
  }

  if (text.includes("purchaseorder") || text.includes("purchase order") || text.includes("binding supplier")) {
    violations.push(policies[2]);
  }

  if (text.includes("bindingcommitment") || text.includes("binding quote")) {
    violations.push(policies[3]);
  }

  return {
    ok: true,
    nexoraBrain: true,
    generatedAt: now(),
    allowed: violations.length === 0,
    approvalRequired: violations.length > 0,
    violations,
    policies,
  };
}

export function getNexoraPolicyPack() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_policy_pack",
    generatedAt: now(),
    policies,
  };
}
