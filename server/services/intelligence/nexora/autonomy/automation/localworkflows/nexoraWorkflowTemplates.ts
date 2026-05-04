export function getNexoraWorkflowTemplates() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_workflow_templates",
    generatedAt: new Date().toISOString(),
    templates: [
      "lead_to_quote",
      "quote_to_approval",
      "paper_trade_to_risk_review",
      "trade_intent_to_human_approval",
      "external_signer_handoff"
    ],
    safety: {
      liveTradingEnabled: false,
      privateKeysInsideNexora: false,
      walletSigningInsideNexora: false,
      humanApprovalRequired: true
    }
  };
}

export function getNexoraWorkflowTemplateStatus() {
  return getNexoraWorkflowTemplates();
}

export default {
  getNexoraWorkflowTemplates,
  getNexoraWorkflowTemplateStatus
};
