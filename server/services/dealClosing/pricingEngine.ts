export interface PricingInput {
  costPrice: number;
  sellPrice: number;
  discountPercent?: number;
}

export interface PricingResult {
  costPrice: number;
  sellPrice: number;
  discountedSellPrice: number;
  discountAmount: number;
  marginAmount: number;
  marginPercent: number;
  requiresApproval: boolean;
  approvalReason?: string;
}

export const PRICING_RULES = {
  MIN_MARGIN_PERCENT: 15,
  HIGH_VALUE_APPROVAL_THRESHOLD: 100000,
  MAX_DISCOUNT_PERCENT: 25,
  APPROVAL_MARGIN_THRESHOLD: 12,
};

export class PricingEngine {
  calculate(input: PricingInput): PricingResult {
    const { costPrice, sellPrice, discountPercent = 0 } = input;
    const clampedDiscount = Math.min(discountPercent, PRICING_RULES.MAX_DISCOUNT_PERCENT);
    const discountAmount = Math.round(sellPrice * (clampedDiscount / 100));
    const discountedSellPrice = sellPrice - discountAmount;
    const marginAmount = discountedSellPrice - costPrice;
    const marginPercent = discountedSellPrice > 0
      ? Math.round((marginAmount / discountedSellPrice) * 1000) / 10
      : 0;

    const requiresApproval =
      marginPercent < PRICING_RULES.APPROVAL_MARGIN_THRESHOLD ||
      discountedSellPrice > PRICING_RULES.HIGH_VALUE_APPROVAL_THRESHOLD;

    let approvalReason: string | undefined;
    if (marginPercent < PRICING_RULES.APPROVAL_MARGIN_THRESHOLD) {
      approvalReason = `Margin ${marginPercent}% is below ${PRICING_RULES.APPROVAL_MARGIN_THRESHOLD}% approval threshold`;
    } else if (discountedSellPrice > PRICING_RULES.HIGH_VALUE_APPROVAL_THRESHOLD) {
      approvalReason = `Deal value $${(discountedSellPrice / 100).toFixed(2)} exceeds high-value threshold`;
    }

    return {
      costPrice,
      sellPrice,
      discountedSellPrice,
      discountAmount,
      marginAmount,
      marginPercent,
      requiresApproval,
      approvalReason,
    };
  }

  isBelowMinMargin(marginPercent: number): boolean {
    return marginPercent < PRICING_RULES.MIN_MARGIN_PERCENT;
  }

  calculateCommission(dealValue: number, commissionPercent: number): number {
    return Math.round(dealValue * (commissionPercent / 100));
  }
}

export const pricingEngine = new PricingEngine();
