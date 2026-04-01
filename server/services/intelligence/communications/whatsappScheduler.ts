// server/services/intelligence/communications/whatsappScheduler.ts

import { processWhatsAppOutbox } from "./whatsappOutbox";

export async function runWhatsAppDispatchCycle(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  // small safe batch
  return processWhatsAppOutbox({ limit: 25 });
}