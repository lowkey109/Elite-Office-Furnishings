const fs = require('fs');
const path = require('path');

const candidates = [
  'src/server.ts',
  'src/index.ts',
  'src/app.ts',
  'server.ts',
  'index.ts',
  'app.ts',
  'backend/src/server.ts',
  'backend/src/index.ts',
  'backend/src/app.ts',
];

function findFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) findFiles(full, out);
    else if (/\.(ts|tsx|js)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...candidates.filter((file) => fs.existsSync(file)),
  ...findFiles('src'),
];

const target = files.find((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return (
    text.includes('express(') &&
    (
      text.includes('app.listen') ||
      text.includes('createServer') ||
      text.includes('module.exports = app') ||
      text.includes('export default app')
    )
  );
});

if (!target) {
  console.error('Could not locate Express app entrypoint to patch.');
  process.exit(1);
}

let text = fs.readFileSync(target, 'utf8');

if (text.includes('registerNexoraDurableAutonomyRoutes')) {
  console.log(`Routes already patched in ${target}`);
  process.exit(0);
}

const fromTargetDir = path.relative(path.dirname(target), 'src/nexora/autonomy/routes/nexoraDurableAutonomyRoutes')
  .replace(/\\/g, '/');

const importPath = fromTargetDir.startsWith('.') ? fromTargetDir : `./${fromTargetDir}`;
const importLine = `import { registerNexoraDurableAutonomyRoutes } from '${importPath}';\n`;

if (/^import\s/m.test(text)) {
  text = text.replace(/^(import[\s\S]*?;\n)(?!import)/m, `$1${importLine}`);
} else {
  text = `${importLine}${text}`;
}

const appPatterns = [
  /const\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
  /let\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
  /var\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
];

let patched = false;

for (const pattern of appPatterns) {
  if (pattern.test(text)) {
    text = text.replace(pattern, (match) => `${match}\nregisterNexoraDurableAutonomyRoutes(app);`);
    patched = true;
    break;
  }
}

if (!patched) {
  const listenIndex = text.indexOf('app.listen');
  if (listenIndex !== -1) {
    text = `${text.slice(0, listenIndex)}registerNexoraDurableAutonomyRoutes(app);\n${text.slice(listenIndex)}`;
    patched = true;
  }
}

if (!patched) {
  console.error(`Found candidate ${target}, but could not patch app registration safely.`);
  process.exit(1);
}

fs.writeFileSync(target, text);
console.log(`Patched Nexora durable autonomy routes into ${target}`);
