import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const BLOCKED = new Set(["node_modules", ".git", "dist", "build", ".cache"]);

function safeResolve(input = ".") {
  const full = path.resolve(ROOT, input);
  if (!full.startsWith(ROOT)) throw new Error("Path outside workspace blocked");
  return full;
}

export async function listDevFiles(dir = ".") {
  const full = safeResolve(dir);
  const entries = fs.readdirSync(full, { withFileTypes: true });

  return entries
    .filter(e => !BLOCKED.has(e.name))
    .map(e => ({
      name: e.name,
      path: path.relative(ROOT, path.join(full, e.name)) || ".",
      type: e.isDirectory() ? "dir" : "file",
    }))
    .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
}

export async function readDevFile(filePath: string) {
  const full = safeResolve(filePath);
  const stat = fs.statSync(full);

  if (!stat.isFile()) throw new Error("Not a file");
  if (stat.size > 200_000) throw new Error("File too large for preview");

  return {
    path: filePath,
    content: fs.readFileSync(full, "utf8"),
  };
}
