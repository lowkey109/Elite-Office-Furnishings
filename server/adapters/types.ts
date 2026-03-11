export type AdapterStatus = "live" | "manual_only" | "planned";

export interface LeadSignalAdapter {
  id: string;
  name: string;
  sourceType: string;
  description: string;
  placeholder: string;
  urlLabel: string | null;
  status: AdapterStatus;
  fetchContent(input: string): Promise<{ text: string; resolvedUrl?: string }>;
}
