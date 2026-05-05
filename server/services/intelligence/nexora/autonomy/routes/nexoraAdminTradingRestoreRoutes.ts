import type { Express } from "express";

function page(): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Nexora Trading App</title>
  <style>
    body {
      margin: 0;
      background: #02060b;
      color: #dffaff;
      font-family: Inter, system-ui, sans-serif;
    }
    .bar {
      height: 56px;
      background: #07131d;
      border-bottom: 1px solid #12364a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }
    .title {
      font-weight: 900;
      letter-spacing: .12em;
      color: #80f7ff;
      text-transform: uppercase;
    }
    .links a {
      color: #77ffae;
      margin-left: 14px;
      font-size: 13px;
      text-decoration: none;
      font-weight: 800;
    }
    iframe {
      width: 100%;
      height: calc(100vh - 56px);
      border: 0;
      display: block;
      background: #02060b;
    }
  </style>
</head>
<body>
  <div class="bar">
    <div>
      <div class="title">Nexora PolyEdge Trading App</div>
      <div style="font-size:12px;color:#7aa9b7">MoonDev strategy brain · paper trader · learning memory · live-money locked</div>
    </div>
    <div class="links">
      <a href="/admin">Admin</a>
      <a href="/nexora/operator/poly-edge">PolyEdge</a>
      <a href="/nexora-poly-graph.html">Graph</a>
    </div>
  </div>
  <iframe src="/nexora/operator/poly-edge" title="Nexora PolyEdge Live Dashboard"></iframe>
</body>
</html>`;
}

export function registerNexoraAdminTradingRestoreRoutes(app: Express): void {
  const sendTradingApp = (_req: any, res: any) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(page());
  };

  app.get("/admin/trading-app", sendTradingApp);
app.get("/admin/trading-monitor", sendTradingApp);
  app.get("/admin/polyedge", sendTradingApp);

  app.get("/api/admin/trading-app/status", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_admin_trading_app_restore",
      generatedAt: new Date().toISOString(),
      routes: [
        "/admin/trading-app",
        "/admin/polyedge-aetherforge",
        "/admin/trading-monitor",
        "/admin/polyedge",
        "/nexora/operator/poly-edge",
        "/nexora-poly-graph.html"
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
