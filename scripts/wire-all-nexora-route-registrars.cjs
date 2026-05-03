const fs = require("fs");
const path = require("path");

const routesFile = "server/routes.ts";
const reportDir = process.env.REPORT_DIR || "reports/nexora-audit/wire-all-latest";

fs.mkdirSync(reportDir, { recursive: true });

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }

  return out;
}

function importPathFor(targetFile, sourceFile) {
  const withoutExt = sourceFile.replace(/\.(ts|js)$/, "");
  const rel = path.relative(path.dirname(targetFile), withoutExt).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

if (!fs.existsSync(routesFile)) {
  console.error(`Missing ${routesFile}`);
  process.exit(1);
}

let routesSource = fs.readFileSync(routesFile, "utf8");

const allFiles = [
  ...walk("server/services/intelligence/nexora"),
  ...walk("server"),
].filter((file) => file !== routesFile);

const registrars = [];

for (const file of allFiles) {
  const source = fs.readFileSync(file, "utf8");

  const exportRe = /export\s+function\s+(register[A-Za-z0-9_]*Routes)\s*\(/g;
  let match;

  while ((match = exportRe.exec(source))) {
    const name = match[1];
    if (!/Nexora/i.test(name)) continue;

    registrars.push({
      name,
      file,
      importPath: importPathFor(routesFile, file),
    });
  }
}

const uniqueRegistrars = uniqueBy(registrars, (r) => r.name)
  .sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(
  path.join(reportDir, "01-discovered-registrars.json"),
  JSON.stringify({
    registrarCount: uniqueRegistrars.length,
    registrars: uniqueRegistrars,
  }, null, 2),
);

const importInsertions = [];
const callInsertions = [];

for (const registrar of uniqueRegistrars) {
  const importPattern = new RegExp(`import\\s*\\{[^}]*\\b${registrar.name}\\b[^}]*\\}\\s*from\\s*["']`);
  const alreadyImported = importPattern.test(routesSource) || routesSource.includes(`import { ${registrar.name} }`);

  if (!alreadyImported) {
    importInsertions.push(`import { ${registrar.name} } from "${registrar.importPath}";`);
  }

  const callPattern = new RegExp(`\\b${registrar.name}\\s*\\(\\s*app\\s*\\)`, "g");
  const callOccurrences = [...routesSource.matchAll(callPattern)].length;

  if (callOccurrences === 0) {
    callInsertions.push(`  ${registrar.name}(app);`);
  }
}

if (importInsertions.length) {
  const importMatches = [...routesSource.matchAll(/^import[^\n]*\n/gm)];

  if (importMatches.length) {
    const last = importMatches[importMatches.length - 1];
    const insertAt = last.index + last[0].length;
    routesSource =
      routesSource.slice(0, insertAt) +
      importInsertions.join("\n") +
      "\n" +
      routesSource.slice(insertAt);
  } else {
    routesSource = importInsertions.join("\n") + "\n" + routesSource;
  }
}

if (callInsertions.length) {
  const marker = "  // NEXORA_AUTO_WIRE_ALL_BEGIN";
  const endMarker = "  // NEXORA_AUTO_WIRE_ALL_END";

  const existingBlockMatch = routesSource.match(/  \/\/ NEXORA_AUTO_WIRE_ALL_BEGIN[\s\S]*?  \/\/ NEXORA_AUTO_WIRE_ALL_END\n?/);

  const existingCalls = existingBlockMatch
    ? existingBlockMatch[0]
        .split("\n")
        .filter((line) => /register[A-Za-z0-9_]*Routes\(app\);/.test(line.trim()))
    : [];

  const allCalls = [...new Set([...existingCalls.map((line) => line.trim()), ...callInsertions.map((line) => line.trim())])]
    .sort()
    .map((line) => `    ${line}`);

  const block = [
    marker,
    "  try {",
    ...allCalls,
    "  } catch (error) {",
    '    console.error("[NEXORA_AUTO_WIRE_ALL_ERROR]", error);',
    "  }",
    endMarker,
    "",
  ].join("\n");

  if (routesSource.includes(marker) && routesSource.includes(endMarker)) {
    routesSource = routesSource.replace(
      /  \/\/ NEXORA_AUTO_WIRE_ALL_BEGIN[\s\S]*?  \/\/ NEXORA_AUTO_WIRE_ALL_END\n?/,
      block,
    );
  } else {
    const patterns = [
      /(export\s+async\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
      /(export\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
      /(async\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
      /(function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    ];

    let patched = false;

    for (const pattern of patterns) {
      if (pattern.test(routesSource)) {
        routesSource = routesSource.replace(pattern, `$1\n${block}`);
        patched = true;
        break;
      }
    }

    if (!patched) {
      console.error("Could not find registerRoutes(...) function in server/routes.ts");
      process.exit(1);
    }
  }
}

fs.writeFileSync(routesFile, routesSource);

const afterSource = fs.readFileSync(routesFile, "utf8");

const mountReport = uniqueRegistrars.map((registrar) => {
  const imported =
    afterSource.includes(`import { ${registrar.name} }`) ||
    new RegExp(`import\\s*\\{[^}]*\\b${registrar.name}\\b[^}]*\\}`).test(afterSource);

  const called = new RegExp(`\\b${registrar.name}\\s*\$begin:math:text$\\\\s\*app\\\\s\*\\$end:math:text$`).test(afterSource);

  return {
    ...registrar,
    imported,
    called,
    mounted: imported && called,
  };
});

const missing = mountReport.filter((row) => !row.mounted);

fs.writeFileSync(
  path.join(reportDir, "02-mount-report.json"),
  JSON.stringify({
    ok: missing.length === 0,
    importedAdded: importInsertions.length,
    callsAdded: callInsertions.length,
    totalRegistrars: uniqueRegistrars.length,
    missing,
    mountReport,
  }, null, 2),
);

fs.writeFileSync(
  path.join(reportDir, "02-mount-report.md"),
  [
    "# Nexora Route Wiring Report",
    "",
    `Total registrars: **${uniqueRegistrars.length}**`,
    `Imports added: **${importInsertions.length}**`,
    `Calls added: **${callInsertions.length}**`,
    `Missing mounts: **${missing.length}**`,
    "",
    "| Mounted | Registrar | File |",
    "|---|---|---|",
    ...mountReport.map((row) => `| ${row.mounted ? "yes" : "NO"} | \`${row.name}\` | \`${row.file}\` |`),
  ].join("\n"),
);

console.log(`Discovered Nexora registrars: ${uniqueRegistrars.length}`);
console.log(`Imports added: ${importInsertions.length}`);
console.log(`Calls added: ${callInsertions.length}`);
console.log(`Missing mounts: ${missing.length}`);

if (missing.length) {
  console.error("Some Nexora route registrars are still not mounted.");
  process.exit(1);
}
