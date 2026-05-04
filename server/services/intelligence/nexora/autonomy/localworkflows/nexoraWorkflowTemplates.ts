export type NexoraWorkflowTemplate = {
  id: string;
  name: string;
  category: string;
  humanBoundary: string;
  status: "ready" | "scaffold";
};

export function getNexoraWorkflowTemplates(): NexoraWorkflowTemplate[] {
  return [
    {
      id: "human-approved-office-workflow",
      name: "Human-approved office furniture workflow",
      category: "office-furniture",
      humanBoundary: "AI may prepare work; humans approve, sign, commit, send, and place orders.",
      status: "scaffold",
    },
    {
      id: "paper-first-polymarket-workflow",
      name: "Paper-first Polymarket workflow",
      category: "polymarket-paper",
      humanBoundary: "No live trading, no wallet signing, no private keys, external signer only for future readiness.",
      status: "scaffold",
    },
  ];
}
