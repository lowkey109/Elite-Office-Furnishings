const fs = require("fs");
const path = require("path");

const target = "server/routes.ts";
const symbol = "registerNexoraOperatorKitRoutes";
const routeFile = "server/services/intelligence/nexora/autonomy/routes/nexoraOperatorKitRoutes";

if (!fs.existsSync(target)) {
  console.error("Missing server/routes.ts");
  process.exit(1);
}

let s = fs.readFileSync(target, "utf8");

if (!s.includes(`import { ${symbol} }`)) {
  const rel = path.relative(path.dirname(target), routeFile).replace(/\\/g, "/");
  const importPath = rel.startsWith(".") ? rel : `./${rel}`;
  const importLine = `import { ${symbol} } from "${importPath}";\n`;

  const imports = [...s.matchAll(/^import[^\n]*\n/gm)];

  if (imports.length) {
    const last = imports[imports.length - 1];
    const idx = last.index + last[0].length;
    s = s.slice(0, idx) + importLine + s.slice(idx);
  } else {
    s = importLine + s;
  }
}

if (!s.includes(`${symbol}(app);`)) {
  const patterns = [
    /(export\s+async\s+function\s+registerRoutes\s*\([^)]*\)\s*(?::[^{]+)?\s*{)/,
    /(export\s+function\s+registerRoutes\s*$begin:math:text$\[\^\)\]\*$end:math:text$\s*(?::[^{]+)?\s*{)/,
    /(async\s+function\s+registerRoutes\s*$begin:math:text$\[\^\)\]\*$end:math:text$\s*(?::[^{]+)?\s*{)/,
    /(function\s+registerRoutes\s*$begin:math:text$\[\^\)\]\*$end:math:text$\s*(?::[^{]+)?\s*{)/,
  ];

  let patched = false;

  for (const pattern of patterns) {
    if (pattern.test(s)) {
      s = s.replace(pattern, `$1\n  ${symbol}(app);`);
      patched = true;
      break;
    }
  }

  if (!patched) {
    console.error("Could not patch registerRoutes with operator kit routes.");
    process.exit(1);
  }
}

fs.writeFileSync(target, s);
console.log("Patched Nexora operator kit routes into server/routes.ts");
