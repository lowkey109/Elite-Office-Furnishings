export async function disabledRealLeadSeeder(): Promise<never> {
  throw new Error("Manual lead seeding is disabled. Use Nexora real signal ingestion instead.");
}
