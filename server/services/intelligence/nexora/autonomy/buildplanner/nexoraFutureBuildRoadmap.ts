function now() {
  return new Date().toISOString();
}

export function getNexoraFutureBuildRoadmap() {
  const roadmap = [
    {
      range: "61-65",
      title: "Build Planner and Preflight Engine",
      status: "current",
      purpose: "Prevent overwrite builds and inspect collisions before adding code.",
    },
    {
      range: "66-70",
      title: "Local Workflow Templates",
      status: "planned",
      purpose: "Reusable local quote, CRM, supplier, project, and approval workflows.",
    },
    {
      range: "71-75",
      title: "Local Analytics and Scoring",
      status: "planned",
      purpose: "Score leads, quotes, suppliers, workers, and project risk locally.",
    },
    {
      range: "76-80",
      title: "Replay and Migration Tools",
      status: "planned",
      purpose: "Move local/offline records into durable Postgres after upgrade.",
    },
    {
      range: "81-85",
      title: "Auth and Admin Hardening",
      status: "planned",
      purpose: "Add admin authorization, API guardrails, and route access controls.",
    },
    {
      range: "86-90",
      title: "Production Recovery Controls",
      status: "planned",
      purpose: "Backups, restore packs, dry-run restore, and production repair scripts.",
    },
    {
      range: "91-100",
      title: "Nexora v1 Packaging",
      status: "planned",
      purpose: "Package the whole OS into command, dashboard, recovery, and operating modes.",
    },
  ];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_future_build_roadmap",
    generatedAt: now(),
    currentBuild: 65,
    remainingTo100: 35,
    roadmap,
  };
}
