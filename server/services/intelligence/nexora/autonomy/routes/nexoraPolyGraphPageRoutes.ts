import type { Express } from "express";
import fs from "fs";
import path from "path";

export function registerNexoraPolyGraphPageRoutes(app: Express): void {
  app.get("/nexora-poly-graph.html", (_req, res) => {
    const file = path.join(process.cwd(), "public", "nexora-poly-graph.html");

    if (!fs.existsSync(file)) {
      res.status(404).send("Poly graph page missing.");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(file, "utf8"));
  });

  app.get("/api/nexora/poly-graph-page/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_graph_page_status",
      generatedAt: new Date().toISOString(),
      page: "/nexora-poly-graph.html",
      source: "public/nexora-poly-graph.html",
      safety: {
        liveTradingEnabled: false,
        privateKeysInsideNexora: false,
        walletSigningInsideNexora: false
      }
    });
  });
}
