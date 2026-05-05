import type { Express } from "express";
import fs from "fs";
import path from "path";

export function registerNexoraPolyExactTerminalRoutes(app: Express): void {
  const send = (_req: any, res: any) => {
    const file = path.join(process.cwd(), "public", "nexora-polyedge-exact-terminal.html");

    if (!fs.existsSync(file)) {
      res.status(404).send("Exact PolyEdge terminal page missing.");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(file, "utf8"));
  };

  // Primary terminal routes
  app.get("/nexora/polyedge-terminal", send);
  app.get("/nexora/operator/poly-edge", send);
  app.get("/nexora-poly-graph.html", send);

  // Legacy/admin compatibility routes
  app.get("/admin/polyedge-terminal", send);
  app.get("/admin/polyedge-aetherforge/live", send);

  app.get("/api/nexora/polyedge-terminal/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_polyedge_terminal_status",
      generatedAt: new Date().toISOString(),
      terminalRoutes: [
        "/nexora/polyedge-terminal",
        "/nexora/operator/poly-edge",
        "/nexora-poly-graph.html",
        "/admin/polyedge-terminal",
        "/admin/polyedge-aetherforge/live"
      ],
      dataRoutes: [
        "/api/nexora/poly-edge-fixed/state",
        "/api/nexora/poly-paper-summary/latest",
        "/api/nexora/live-money/status"
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
