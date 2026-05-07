import fs from "fs";
import path from "path";

const ROOT = path.join(
  process.cwd(),
  "data/nexora/local/coinbase-paper"
);

const FILE = path.join(ROOT, "learning-governor.json");

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
      FILE,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          totalRuns: 0,
          wins: 0,
          losses: 0,
          skips: 0,
          bestStrategy: "learning",
          confidence: 35,
          learningMode: true,
          liveTradingEnabled: false,
        },
        null,
        2
      )
    );
  }
}

export function getPaperLearningGovernor() {
  ensure();
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

export function updatePaperLearningGovernor(input: any) {
  ensure();

  const current = getPaperLearningGovernor();

  const next = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));

  return next;
}
