const fs = require("fs");
const path = require("path");

const target = "server/routes.ts";
const symbol = "registerNexoraHardMountRoutes";
const sourceFile = "server/services/intelligence/nexora/autonomy/routes/nexoraHardMountRoutes";

if (!fs.existsSync(target)) {
  console.error("Missing server/routes.ts");
  process.exit(1);
}

if (!fs.existsSync(`${sourceFile}.ts`)) {
  console.error(`Missing ${sourceFile}.ts`);
  process.exit(1);
}

let s = fs.readFileSync(target, "utf8");

const rel = path.relative(path.dirname(target), sourceFile).replace(/\\/g, "/");
const importPath = rel.startsWith(".") ? rel : `./${rel}`;
const importLine = `import { ${symbol} } from "${importPath}";\n`;

if (!s.includes(`import { ${symbol} }`)) {
  const imports = [...s.matchAll(/^import[^\n]*\n/gm)];
  if (imports.length > 0) {
    const last = imports[imports.length - 1];
    const idx = last.index + last[0].length;
    s = s.slice(0, idx) + importLine + s.slice(idx);
  } else {
    s = importLine + s;
  }
}

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

  for (const pattern of patterns) {
    if (pattern.test(s)) {
      s = s.replace(pattern, `$1${injection}`);
      patched = true;
      break;
    }
  }

  if (!patched) {
    console.error("Could not find registerRoutes(...) function in server/routes.ts");
    process.exit(1);
  }
}

fs.writeFileSync(target, s);

console.log("Fixed hard mount patch applied to server/routes.ts");
