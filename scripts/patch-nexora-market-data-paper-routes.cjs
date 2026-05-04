const fs = require("fs");
const path = require("path");

const target = "server/routes.ts";
const symbol = "registerNexoraMarketDataPaperRoutes";
const routeFile = "server/services/intelligence/nexora/autonomy/routes/nexoraMarketDataPaperRoutes";

if (!fs.existsSync(target)) {
  console.error("Missing server/routes.ts");
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

if (!source.includes(`${symbol}(app);`)) {
  const patterns = [
    /(export\s+async\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    /(export\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    /(async\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    /(function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
  ];

  let patched = false;
  for (const pattern of patterns) {
    if (pattern.test(source)) {
      source = source.replace(pattern, `$1\n  ${symbol}(app);`);
      patched = true;
      break;
    }
  }

  if (!patched) {
    console.error("Could not patch registerRoutes with market data routes.");
    process.exit(1);
  }
}

fs.writeFileSync(target, source);
console.log("Patched Nexora market data routes into server/routes.ts");
