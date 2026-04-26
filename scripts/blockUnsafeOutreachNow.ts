import { db } from "../server/db";
import { outreachMessages, outreachThreads } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: outreachMessages.id,
      threadId: outreachMessages.threadId,
      recipientEmail: outreachMessages.recipientEmail,
      deliveryStatus: outreachMessages.deliveryStatus,
      companyName: outreachThreads.companyName,
      opportunityScore: outreachThreads.opportunityScore,
    })
    .from(outreachMessages)
    .leftJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
    .limit(500);

  let blocked = 0;

  for (const r of rows as any[]) {
    const companyName = String(r.companyName || "").trim();
    const recipientEmail = String(r.recipientEmail || "").trim();
    const confidence = Number(r.opportunityScore || 0);

    const unsafe =
      !companyName ||
      companyName.toLowerCase() === "unknown" ||
      !recipientEmail ||
      recipientEmail === "—" ||
      !recipientEmail.includes("@") ||
      confidence < 85;

    if (!unsafe) continue;

    await db
      .update(outreachMessages)
      .set({
        deliveryStatus: "blocked_quality_guard",
        blockingReason:
          "Blocked by Nexora quality guard: requires real company, verified recipient email, and confidence >= 85.",
        updatedAt: new Date(),
      } as any)
      .where(eq(outreachMessages.id, r.id));

    blocked++;
  }

  console.log({ checked: rows.length, blocked });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
