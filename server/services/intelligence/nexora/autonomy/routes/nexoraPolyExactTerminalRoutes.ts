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

  app.get("/nexora/polyedge-terminal", send);
  app.get("/nexora/operator/poly-edge", send);
  app.get("/nexora-poly-graph.html", send);
}
