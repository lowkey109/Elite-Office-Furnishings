export function summariseWalterAction(input: {
  actionType: string;
  targetCompany: string;
  outcome: string;
  nextStep: string;
}): string {
  return `${input.actionType}: ${input.outcome}. Next → ${input.nextStep}`;
}

export function buildWalterRecommendation(input: {
  area: string;
  targetEntity: string;
  issue: string;
  action: string;
  consequence: string;
}): string {
  return `Walter: ${input.issue}. Action → ${input.action}. Outcome → ${input.consequence}`;
}