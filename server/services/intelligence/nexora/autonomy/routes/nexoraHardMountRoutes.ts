function now() {
  return new Date().toISOString();
}

function statusPayload(service: string) {
  return {
    ok: true,
    nexoraBrain: true,
    service,
    hardMounted: true,
    generatedAt: now(),
    message: "Nexora hard-mounted route is live. Deep runtime modules may be tested separately.",
    safety: {
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      supplierCommitmentsApprovalGated: true,
      customerBindingCommitmentsApprovalGated: true,
      tradingMode: "paper/sandbox",
      liveTradingBlocked: true,
    },
    routes: [
      "GET /api/nexora/ping",
      "GET /api/nexora/live/status",
      "GET /api/nexora/advanced/status",
      "GET /api/nexora/mega/status",
      "GET /api/nexora/cockpit/status",
      "GET /api/nexora/supreme/status",
      "GET /api/nexora/runtime/diagnostic",
      "POST /api/nexora/runtime/test-task"
    ],
  };
}

export function registerNexoraHardMountRoutes(app: any) {
  if (!app || typeof app.get !== "function") {
    console.error("[NEXORA_HARD_MOUNT] Invalid Express app object.");
    return;
  }

  app.get("/api/nexora/ping", (_req: any, res: any) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_ping",
      hardMounted: true,
      generatedAt: now(),
    });
  });

  app.get("/api/nexora/live/status", (_req: any, res: any) => {
    res.json(statusPayload("nexora_live_status_hard_mount"));
  });

  app.get("/api/nexora/advanced/status", (_req: any, res: any) => {
    res.json(statusPayload("nexora_advanced_status_hard_mount"));
  });

  app.get("/api/nexora/mega/status", (_req: any, res: any) => {
    res.json(statusPayload("nexora_mega_status_hard_mount"));
  });

  app.get("/api/nexora/cockpit/status", (_req: any, res: any) => {
    res.json(statusPayload("nexora_cockpit_status_hard_mount"));
  });

  app.get("/api/nexora/supreme/status", (_req: any, res: any) => {
    res.json(statusPayload("nexora_supreme_status_hard_mount"));
  });

  app.get("/api/nexora/runtime/diagnostic", async (_req: any, res: any) => {
    const diagnostic: any = {
      ok: true,
      nexoraBrain: true,
      service: "nexora_runtime_diagnostic",
      hardMounted: true,
      generatedAt: now(),
      env: {
        nodeEnv: process.env.NODE_ENV || null,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        railwayEnvironment: process.env.RAILWAY_ENVIRONMENT || null,
        railwayServiceName: process.env.RAILWAY_SERVICE_NAME || null,
        railwayProjectName: process.env.RAILWAY_PROJECT_NAME || null,
      },
      imports: {},
    };

    const tests = [
      {
        name: "durableKernel",
        loader: () => import("../persistence/nexoraDurableKernel"),
      },
      {
        name: "cockpit",
        loader: () => import("../cockpit/nexoraExecutiveCockpit"),
      },
      {
        name: "supreme",
        loader: () => import("../supreme/nexoraSupremeOrchestrationMatrix"),
      },
      {
        name: "finance",
        loader: () => import("../finance/nexoraFinanceQuoteIntelligence"),
      },
      {
        name: "strategy",
        loader: () => import("../strategy/nexoraStrategyCompiler"),
      },
    ];

    for (const test of tests) {
      try {
        await test.loader();
        diagnostic.imports[test.name] = {
          ok: true,
        };
      } catch (error) {
        diagnostic.ok = false;
        diagnostic.imports[test.name] = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    res.status(diagnostic.ok ? 200 : 500).json(diagnostic);
  });

  app.post("/api/nexora/runtime/test-task", async (req: any, res: any) => {
    try {
      const kernel = await import("../persistence/nexoraDurableKernel");
      const result = await kernel.createNexoraDurableTask({
        worker: "nexora_runtime_test",
        area: "diagnostic",
        action: "hard_mount_runtime_test_task",
        risk: "safe",
        priority: 50,
        payload: {
          body: req.body || {},
          generatedAt: now(),
        },
        source: "nexora.hard_mount.runtime_test",
      });

      res.json({
        ok: true,
        nexoraBrain: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        nexoraBrain: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
