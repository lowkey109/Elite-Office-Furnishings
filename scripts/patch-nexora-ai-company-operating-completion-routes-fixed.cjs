const fs = require("fs");
const path = require("path");

const target = "server/routes.ts";
const symbol = "registerNexoraAICompanyOperatingCompletionRoutes";
const routeFile = "server/services/intelligence/nexora/autonomy/routes/nexoraAICompanyOperatingCompletionRoutes";

if (!fs.existsSync(target)) {
  console.error("Missing server/routes.ts");
  process.exit(1);
}

if (!fs.existsSync(`${routeFile}.ts`)) {
  console.error(`Missing ${routeFile}.ts`);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");

if (!source.includes(`import { ${symbol} }`)) {
  const rel = path.relative(path.dirname(target), routeFile).replace(/\\/g, "/");
  const importPath = rel.startsWith(".") ? rel : `./${rel}`;
  const importLine = `import { ${symbol} } from "${importPath}";\n`;

  const imports = [...source.matchAll(/^import[^\n]*\n/gm)];
  if (imports.length) {
    const last = imports[imports.length - 1];
    const idx = last.index + last[0].length;
    source = source.slice(0, idx) + importLine + source.slice(idx);
  } else {
    source = importLine + source;
  }
}

if (!source.includes(`${symbol}(`)) {
  const nameIndex = source.indexOf("registerRoutes");
  if (nameIndex === -1) {
    console.error("Could not find registerRoutes text.");
    process.exit(1);
  }

  const openBraceIndex = source.indexOf("{", nameIndex);
  if (openBraceIndex === -1) {
    console.error("Could not find opening brace after registerRoutes.");
    process.exit(1);
  }

  const before = source.slice(0, openBraceIndex + 1);
  const after = source.slice(openBraceIndex + 1);

  const injection = `\n  ${symbol}(app);\n`;

  source = before + injection + after;
}

fs.writeFileSync(target, source);
console.log("Patched completion registrar into server/routes.ts");
