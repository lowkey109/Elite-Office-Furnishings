export function getNexoraWorkerRegistry() {
  const workers = [
    { key: "core_brain", area: "core", status: "active", route: "/api/nexora/modules" },
    { key: "office_receptionist", area: "office", status: "active", route: "/api/nexora/office/receptionist/status" },
    { key: "office_pipeline", area: "office", status: "active", route: "/api/nexora/pipeline" },
    { key: "opportunities", area: "office", status: "active", route: "/api/nexora/opportunities/top" },
    { key: "follow_up_queue", area: "office", status: "active", route: "/api/nexora/follow-up-queue" },

    { key: "prediction_scanner", area: "trading", status: "active", route: "/api/nexora/scanner/status" },
    { key: "controlled_memory_scanner", area: "trading", status: "active", route: "/api/nexora/scanner/controlled-memory" },
    { key: "math_genius_core", area: "trading", status: "active", route: "/api/nexora/math/genius-core" },
    { key: "fallback_stack", area: "trading", status: "active", route: "/api/nexora/prediction-market/fallback-stack" },
    { key: "fair_probability", area: "trading", status: "active", route: "/api/nexora/prediction-market/fair-probability" },
    { key: "order_book_sim", area: "trading", status: "active", route: "/api/nexora/prediction-market/order-book-sim" },

    { key: "quantum_learning", area: "learning", status: "active", route: "/api/nexora/quantum/status" },
    { key: "autonomy", area: "learning", status: "active", route: "/api/nexora/autonomy/status" },
    { key: "simulation", area: "learning", status: "active", route: "/api/nexora/simulation/status" },
    { key: "memory_backtester", area: "learning", status: "active", route: "/api/nexora/backtest/memory/status" },

    { key: "db_health_gate", area: "safety", status: "active", route: "/api/nexora/db/health-gate" },
    { key: "execution_safety", area: "safety", status: "active", route: "/api/nexora/superbot/safety-core" },
    { key: "emergency_stop", area: "safety", status: "active", route: "/api/nexora/execution/emergency-stop" },
    { key: "promotion_gate", area: "safety", status: "active", route: "/api/nexora/promotion/gate" },
  ];

  return {
    ok: true,
    service: "nexora_worker_registry",
    nexoraBrain: true,
    totalWorkers: workers.length,
    workers,
    areas: {
      core: workers.filter(w => w.area === "core").length,
      office: workers.filter(w => w.area === "office").length,
      trading: workers.filter(w => w.area === "trading").length,
      learning: workers.filter(w => w.area === "learning").length,
      safety: workers.filter(w => w.area === "safety").length,
    },
    rule: "Nexora is the main brain. Workers provide evidence or execute approved safe actions.",
    updatedAt: new Date().toISOString(),
  };
}

export function getNexoraHandsFreeReadiness() {
  return {
    ok: true,
    service: "nexora_hands_free_readiness",
    nexoraBrain: true,
    currentMode: "SAFE_AUTONOMY_WITH_GATES",
    canRunHandsFreeNow: [
      "office lead capture",
      "office lead qualification",
      "scanner status checks",
      "memory-only paper signal scoring",
      "math/risk/order-book evaluation",
      "worker health reporting",
      "alerts",
      "backtesting",
      "safe recommendations"
    ],
    mustStayGated: [
      "real-money trading",
      "external customer messaging without approval",
      "deleting data",
      "large DB writes while Postgres is recovering",
      "changing production secrets",
      "deploying code without typecheck"
    ],
    nextHandsFreeBuilds: [
      "central scheduled worker runner",
      "worker heartbeat monitor",
      "auto-retry failed safe jobs",
      "office lead auto-routing",
      "daily Nexora report",
      "safe task queue",
      "human approval queue for risky actions"
    ],
    rule: "Hands-free does not mean unsafe. Nexora can automate safe work and hold risky actions for approval.",
    updatedAt: new Date().toISOString(),
  };
}
