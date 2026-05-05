import type { Express } from "express";
import fs from "fs";
import path from "path";

export function registerNexoraPolyEdgeTerminalV2Routes(app: Express): void {
  const send = (_req: any, res: any) => {
    const file = path.join(process.cwd(), "public", "polyedge-terminal-v2.html");

    if (!fs.existsSync(file)) {
      res.status(404).send("PolyEdge terminal v2 page missing.");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(file, "utf8"));
  };

  app.get("/nexora/polyedge-terminal-v2", send);
  app.get("/nexora/polyedge-terminal", send);
  app.get("/nexora-poly-graph.html", send);

  app.get("/api/nexora/polyedge-terminal-v2/status", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_polyedge_terminal_v2_status",
      generatedAt: new Date().toISOString(),
      routes: [
        "/nexora/polyedge-terminal-v2",
        "/nexora/polyedge-terminal",
        "/nexora-poly-graph.html"
      ],
      dataRoutes: [
        "/api/nexora/poly-paper-summary/latest",
        "/api/nexora/poly-edge-fixed/state"
      ],
      safety: {
        liveTradingEnabled: false,
        privateKeysInsideNexora: false,
        walletSigningInsideNexora: false,
        bankTransfersEnabled: false
      }
    });
  });
}
