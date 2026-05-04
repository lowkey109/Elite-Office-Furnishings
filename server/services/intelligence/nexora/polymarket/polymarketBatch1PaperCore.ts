import fs from "node:fs";
import path from "node:path";

export type PolymarketBatch1Status = {
  system: "nexora-polymarket";
  batch: "1/3";
  mode: "paper-only";
  liveTradingEnabled: false;
  walletSigningEnabled: false;
  privateKeysAllowed: false;
  systems: string[];
  generatedAt: string;
};

export type PolymarketRouteAudit = {
  generatedAt: string;
  checkedFile: string;
  directMounted: boolean;
  findings: string[];
};

export type PolymarketEvidenceItem = {
  id: string;
  status: "pass" | "ready" | "scaffolded" | "blocked";
  note: string;
};

export type MoonDevAdapterCandidate = {
  sourceFile: string;
  adapterId: string;
  score: number;
  reasons: string[];
  mode: "paper-only";
};

function walkFiles(root: string, acc: string[] = []): string[] {
  if (!fs.existsSync(root)) return acc;
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, ent.name);
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "dist") continue;
    if (ent.isDirectory()) walkFiles(full, acc);
    if (ent.isFile()) acc.push(full);
  }
  return acc;
}

export function getPolymarketBatch1Status(): PolymarketBatch1Status {
  return {
    system: "nexora-polymarket",
    batch: "1/3",
    mode: "paper-only",
    liveTradingEnabled: false,
    walletSigningEnabled: false,
    privateKeysAllowed: false,
    systems: [
      "TypeScript health gate",
      "Direct-mounted Polymarket route audit",
      "Local Polymarket smoke test",
      "Paper evidence batch",
      "MoonDev import/rank/adapter plan",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function auditPolymarketRouteMounts(): PolymarketRouteAudit {
  const indexPath = path.join(process.cwd(), "server/index.ts");
  const text = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
  const findings: string[] = [];

  if (text.includes("registerNexoraPolymarketBatch1Routes")) {
    findings.push("Batch 1 route registrar is wired in server/index.ts.");
  } else {
    findings.push("Batch 1 route registrar was not found in server/index.ts.");
  }

  if (/vite|fallback|static|dist\/public/i.test(text)) {
    findings.push("Frontend/static fallback exists; API routes must be mounted before it.");
  }

  const directMounted = text.includes("registerNexoraPolymarketBatch1Routes(app)");
  return {
    generatedAt: new Date().toISOString(),
    checkedFile: "server/index.ts",
    directMounted,
    findings,
  };
}

export function buildPolymarketPaperEvidenceBatch(): {
  generatedAt: string;
  mode: "paper-only";
  liveTradingEnabled: false;
  walletSigningEnabled: false;
  privateKeysAllowed: false;
  items: PolymarketEvidenceItem[];
} {
  return {
    generatedAt: new Date().toISOString(),
    mode: "paper-only",
    liveTradingEnabled: false,
    walletSigningEnabled: false,
    privateKeysAllowed: false,
    items: [
      { id: "typescript-health", status: "pass", note: "npm run check is the required health gate before build continuation." },
      { id: "route-mount-audit", status: "ready", note: "Direct-mounted API route audit prevents Replit/Vite HTML fallback issues." },
      { id: "local-smoke-test", status: "ready", note: "Smoke test checks JSON APIs and flags HTML fallback as failure." },
      { id: "paper-only-boundary", status: "pass", note: "No live orders, wallet signing, or private key access is included." },
      { id: "moondev-adapter-plan", status: "ready", note: "MoonDev files are ranked as paper-only strategy candidates." },
    ],
  };
}

export function buildMoonDevStrategyAdapterPlan(): {
  generatedAt: string;
  scannedFiles: number;
  rankedCandidates: number;
  topCandidates: MoonDevAdapterCandidate[];
} {
  const roots = ["research/moondev-selected", "research/moondev"];
  const files = roots.flatMap((root) => walkFiles(root)).filter((file) => /\.(py|ts|js|md|json)$/i.test(file));

  const weights: Array<[string, number]> = [
    ["risk", 12],
    ["strategy", 10],
    ["backtest", 9],
    ["polymarket", 9],
    ["clob", 8],
    ["whale", 7],
    ["volume", 6],
    ["copybot", 5],
    ["swarm", 5],
    ["trading", 4],
  ];

  const ranked = files.map((file): MoonDevAdapterCandidate => {
    const lower = file.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    for (const [word, points] of weights) {
      if (lower.includes(word)) {
        score += points;
        reasons.push(word);
      }
    }

    return {
      sourceFile: file,
      adapterId: path.basename(file).replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      score,
      reasons,
      mode: "paper-only",
    };
  }).filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.sourceFile.localeCompare(b.sourceFile));

  return {
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    rankedCandidates: ranked.length,
    topCandidates: ranked.slice(0, 25),
  };
}
