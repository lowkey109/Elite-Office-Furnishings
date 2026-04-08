import { execSync } from "child_process";
import fs from "fs";

console.log("🔥 Starting REAL build repair...");

// 1. Restore tsconfig
const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json", "utf-8"));
tsconfig.include = ["client/src/**/*", "shared/**/*", "server/**/*"];
tsconfig.compilerOptions.strict = true;
tsconfig.compilerOptions.noImplicitAny = true;
fs.writeFileSync("tsconfig.json", JSON.stringify(tsconfig, null, 2));

console.log("✅ Restored tsconfig");

// 2. Restore real build script
const buildScript = `import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

const allowlist = [
  "express","pg","drizzle-orm","zod","openai","stripe"
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    external: externals,
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.url": '"file:///dist/index.cjs"',
    },
    minify: true,
  });
}

buildAll();
`;

fs.writeFileSync("script/build.ts", buildScript);

console.log("✅ Restored real build");

// 3. Fix package.json
const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
pkg.scripts.build = "tsx script/build.ts";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));

console.log("✅ Fixed package.json");

// 4. Install deps
execSync("npm install", { stdio: "inherit" });

// 5. Run checks
execSync("npm run check", { stdio: "inherit" });

// 6. Run build
execSync("npm run build", { stdio: "inherit" });

console.log("🚀 BUILD FIX COMPLETE");
