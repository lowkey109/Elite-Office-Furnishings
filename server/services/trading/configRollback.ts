import { db } from "../../db";
import { tradingConfigVersions, tradingRollbacks } from "@shared/schema";
import { eq, desc, and, ne } from "drizzle-orm";

export interface RollbackResult {
  success: boolean;
  fromVersionId: string;
  toVersionId: string;
  reason: string;
  error?: string;
}

export async function rollbackConfig(reason: string): Promise<RollbackResult> {
  const activeVersions = await db
    .select()
    .from(tradingConfigVersions)
    .where(eq(tradingConfigVersions.isActive, true))
    .limit(1);

  if (activeVersions.length === 0) {
    return { success: false, fromVersionId: "", toVersionId: "", reason, error: "No active config version to rollback from" };
  }

  const currentVersion = activeVersions[0];

  const previousVersions = await db
    .select()
    .from(tradingConfigVersions)
    .where(and(
      eq(tradingConfigVersions.isActive, false),
      eq(tradingConfigVersions.approvalStatus, "approved"),
    ))
    .orderBy(desc(tradingConfigVersions.deactivatedAt))
    .limit(1);

  if (previousVersions.length === 0) {
    return { success: false, fromVersionId: currentVersion.id, toVersionId: "", reason, error: "No previous approved config version found for rollback" };
  }

  const targetVersion = previousVersions[0];

  await db.update(tradingConfigVersions).set({
    isActive: false,
    deactivatedAt: new Date(),
    approvalStatus: "reverted",
  }).where(eq(tradingConfigVersions.id, currentVersion.id));

  await db.update(tradingConfigVersions).set({
    isActive: true,
    activatedAt: new Date(),
  }).where(eq(tradingConfigVersions.id, targetVersion.id));

  await db.insert(tradingRollbacks).values({
    fromConfigVersionId: currentVersion.id,
    toConfigVersionId: targetVersion.id,
    reason,
  });

  return {
    success: true,
    fromVersionId: currentVersion.id,
    toVersionId: targetVersion.id,
    reason,
  };
}

export async function getRollbackHistory(limit: number = 10): Promise<any[]> {
  return db
    .select()
    .from(tradingRollbacks)
    .orderBy(desc(tradingRollbacks.createdAt))
    .limit(limit);
}
