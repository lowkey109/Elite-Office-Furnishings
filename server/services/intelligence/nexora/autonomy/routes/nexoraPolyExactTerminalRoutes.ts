import type { Express } from "express";
import fs from "fs";
import path from "path";

export function registerNexoraPolyExactTerminalRoutes(app: Express): void {
  const send = (_req: any, res: any) => {
    const file = path.join(process.cwd(), "public", "nexora-polyedge-exact-terminal.html");
    if (!fs.existsSync(file)) {
      res.status(404).send("Nexora PolyEdge terminal page missing.");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(file, "utf8"));
  };

  app.get("/nexora/polyedge-terminal", send);
  app.get("/nexora-polyedge-terminal", send);

  app.get("/api/nexora/polyedge-terminal/status", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_polyedge_terminal_status",
      generatedAt: new Date().toISOString(),
      routes: ["/nexora/polyedge-terminal", "/nexora-polyedge-terminal"],
      safety: {
        liveTradingEnabled: false,
        privateKeysInsideNexora: false,
        walletSigningInsideNexora: false
      }
    });
  });
}
