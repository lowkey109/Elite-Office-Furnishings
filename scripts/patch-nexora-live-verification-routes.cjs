const fs = require("fs");
const path = require("path");

const target = "server/routes.ts";
const symbol = "registerNexoraLiveVerificationRoutes";
const routeFile = "server/services/intelligence/nexora/autonomy/routes/nexoraLiveVerificationRoutes";

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
    if (last) {
      const idx = last.index + last[0].length;
      s = s.slice(0, idx) + importLine + s.slice(idx);
    } else {
      s = importLine + s;
    }
  } else {
    s = importLine + s;
  }
}

if (!s.includes(`${symbol}(app);`)) {
  const patterns = [
    /(export\s+async\s+function\s+registerRoutes\s*\(\s*app\s*:[^)]+\)\s*(?::[^{]+)?\s*{)/,
    /(export\s+function\s+registerRoutes\s*\(\s*app\s*:[^)]+\)\s*(?::[^{]+)?\s*{)/,
    /(export\s+async\s+function\s+registerRoutes\s*\(\s*app\s*\)\s*{)/,
    /(export\s+function\s+registerRoutes\s*\(\s*app\s*\)\s*{)/,
  ];

  let patched = false;

  for (const re of patterns) {
    if (re.test(s)) {
      s = s.replace(re, `$1\n  ${symbol}(app);`);
      patched = true;
      break;
    }
  }

  if (!patched) {
    const serverAppPatterns = [
      /(export\s+async\s+function\s+registerRoutes\s*\(\s*server\s*:[^,]+,\s*app\s*:[^)]+\)\s*(?::[^{]+)?\s*{)/,
      /(export\s+function\s+registerRoutes\s*\(\s*server\s*:[^,]+,\s*app\s*:[^)]+\)\s*(?::[^{]+)?\s*{)/,
    ];

    for (const re of serverAppPatterns) {
      if (re.test(s)) {
        s = s.replace(re, `$1\n  ${symbol}(app);`);
        patched = true;
        break;
      }
    }
  }

  if (!patched && s.includes("app.get(")) {
    const idx = s.indexOf("app.get(");
    s = s.slice(0, idx) + `${symbol}(app);\n` + s.slice(idx);
    patched = true;
  }

  if (!patched) {
    console.error("Could not patch server/routes.ts with live route mount.");
    process.exit(1);
  }
}

fs.writeFileSync(target, s);
console.log("Mounted Nexora live verification routes in", target);
