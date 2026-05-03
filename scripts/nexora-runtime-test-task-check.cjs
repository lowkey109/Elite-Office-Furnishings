const fs = require("fs");

const file = "server/services/intelligence/nexora/autonomy/routes/nexoraHardMountRoutes.ts";

if (!fs.existsSync(file)) {
  console.error("Missing", file);
  process.exit(1);
}

const s = fs.readFileSync(file, "utf8");

const required = [
  "/api/nexora/runtime/test-task",
  "/api/nexora/runtime/db-check",
  "safe_runtime_fallback",
  "ensureNexoraDurableKernel",
];

const missing = required.filter((x) => !s.includes(x));

if (missing.length) {
  console.error("Missing runtime test-task repair terms:", missing);
  process.exit(1);
}

console.log("Nexora runtime test-task repair check passed.");
