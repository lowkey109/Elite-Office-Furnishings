export type NexoraLocalSecurityScaffold = {
  liveTradingEnabled: false;
  walletSigningEnabled: false;
  privateKeysAllowed: false;
  autonomousEmailSendAllowed: false;
  autonomousPurchaseOrdersAllowed: false;
  autonomousBindingQuotesAllowed: false;
  notes: string[];
};

export function getNexoraLocalSecurityScaffold(): NexoraLocalSecurityScaffold {
  return {
    liveTradingEnabled: false,
    walletSigningEnabled: false,
    privateKeysAllowed: false,
    autonomousEmailSendAllowed: false,
    autonomousPurchaseOrdersAllowed: false,
    autonomousBindingQuotesAllowed: false,
    notes: [
      "Humans approve, sign, commit, send, and place orders.",
      "Polymarket remains paper-first.",
      "Future live-money support must use an external signer design only.",
    ],
  };
}
