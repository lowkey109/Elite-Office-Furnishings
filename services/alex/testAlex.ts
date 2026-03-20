import { runAlexAutonomousAgent } from "./alexAutonomousAgent.js";
import { runOutreachAI } from "./outreachAI.js";

async function main() {
  const alexResult = await runAlexAutonomousAgent({
    request:
      "Review this office move lead, prepare next sales step, check pricing, and recommend workspace strategy.",
    companyName: "Acme Advisory",
    safeMode: true,
  });

  console.log("ALEX RESULT");
  console.log(JSON.stringify(alexResult, null, 2));

  const outreachResult = await runOutreachAI({
    companyName: "Acme Advisory",
    contactName: "Sarah",
    request:
      "Prepare outreach for a potential office relocation and furniture fit-out discussion.",
    safeMode: true,
  });

  console.log("OUTREACH RESULT");
  console.log(JSON.stringify(outreachResult, null, 2));
}

main().catch((error) => {
  console.error("testAlex failed:", error);
  process.exit(1);
});