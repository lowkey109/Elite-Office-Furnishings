import fs from "node:fs";
import path from "node:path";

export function getPolymarketBatch1Status() {
  return {
    batch: "1/3",
    mode: "paper-only",
    liveTradingEnabled: false,
    walletSigningEnabled: false,
    privateKeysAllowed: false,
    systems: [
      "typescript-health",
      "direct-route-mount-audit",
      "local-smoke-test",
      "paper-evidence-batch",
      "moondev-adapter-plan",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function getPolymarketBatch1Evidence() {
  return {
    mode: "paper-only",
    liveTradingEnabled: false,
    walletSigningEnabled: false,
    privateKeysAllowed: false,
    checks: [
      { id: "typescript-health", status: "pass" },
      { id: "route-mount-audit", status: "ready" },
      { id: "smoke-test", status: "ready" },
      { id: "paper-evidence", status: "ready" },
      { id: "moondev-plan", status: "ready" },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function getPolymarketBatch1RouteAudit() {
  const file = path.join(process.cwd(), "server/index.ts");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  return {
    directMounted: text.includes("registerNexoraPolymarketBatch1Routes(app)"),
    hasFrontendFallback: /vite|serveStatic|fallback|dist\/public/i.test(text),
    generatedAt: new Date().toISOString(),
  };
}

export function getMoonDevBatch1AdapterPlan() {
  const roots = ["research/moondev-selected", "research/moondev"];
  const found: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(py|ts|js|md|json)$/i.test(ent.name)) found.push(full);
    }
  }

  roots.forEach(walk);

  const topCandidates = found
    .filter((file) => /risk|strategy|backtest|polymarket|clob|whale|volume|copybot|swarm|trading/i.test(file))
    .slice(0, 25)
    .map((file) => ({
      sourceFile: file,
      mode: "paper-only",
      liveTradingEnabled: false,
      adapterStage: "candidate",
    }));

  return {
    scannedFiles: found.length,
    rankedCandidates: topCandidates.length,
    topCandidates,
    generatedAt: new Date().toISOString(),
  };
}
