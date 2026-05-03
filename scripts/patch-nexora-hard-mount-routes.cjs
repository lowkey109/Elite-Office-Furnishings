const fs = require("fs");
const path = require("path");

const target = "server/routes.ts";
const symbol = "registerNexoraHardMountRoutes";
const routeFile = "server/services/intelligence/nexora/autonomy/routes/nexoraHardMountRoutes";

if (!fs.existsSync(target)) {
  console.error("Missing server/routes.ts");
  process.exit(1);
}

let s = fs.readFileSync(target, "utf8");

if (!s.includes(symbol)) {
  const rel = path.relative(path.dirname(target), routeFile).replace(/\\/g, "/");
  const importPath = rel.startsWith(".") ? rel : `./${rel}`;
  const importLine = `import { ${symbol} } from "${importPath}";\n`;

  if (/^import\s/m.test(s)) {
    const imports = [...s.matchAll(/^import[^\n]*\n/gm)];
    const last = imports[imports.length - 1];
    const idx = last ? last.index + last[0].length : 0;
    s = s.slice(0, idx) + importLine + s.slice(idx);
  } else {
    s = importLine + s;
  }
}

if (!s.includes(`${symbol}(`)) {
  console.error("Import insertion failed.");
  process.exit(1);
}

/**
 * Force hard mount at the very top of registerRoutes.
 * Handles common signatures:
 *   registerRoutes(app)
 *   registerRoutes(server, app)
 *   async function registerRoutes(...)
 */
if (!s.includes("NEXORA_HARD_MOUNT_BEGIN")) {
  const injection = `
  // NEXORA_HARD_MOUNT_BEGIN
  try {
    const nexoraHardMountApp =
      typeof app !== "undefined"
        ? app
        : typeof server !== "undefined"
          ? server
          : undefined;
    ${symbol}(nexoraHardMountApp);
  } catch (error) {
    console.error("[NEXORA_HARD_MOUNT_ERROR]", error);
  }
  // NEXORA_HARD_MOUNT_END
`;

  const patterns = [
    /(export\s+async\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    /(export\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    /(async\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    /(function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
  ];

  let patched = false;

  for (const re of patterns) {
    if (re.test(s)) {
      s = s.replace(re, `$1${injection}`);
      patched = true;
      break;
    }
  }

  if (!patched) {
    console.error("Could not find registerRoutes function to hard mount Nexora routes.");
    process.exit(1);
  }
}

fs.writeFileSync(target, s);
console.log("Hard-mounted Nexora routes at top of", target);
