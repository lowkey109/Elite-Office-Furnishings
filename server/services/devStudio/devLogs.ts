import fs from "fs";
import path from "path";

const LOG_PATHS = [
  "logs/server.log",
  "server.log",
  "dev.log",
  "npm-debug.log",
];

export async function readDevLogs(lines = 200) {
  const safeLines = Math.min(Math.max(Number(lines) || 200, 20), 1000);

  for (const logPath of LOG_PATHS) {
    const fullPath = path.resolve(process.cwd(), logPath);

    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    return {
      path: logPath,
      logs: content.split("\n").slice(-safeLines).join("\n"),
    };
  }

  return {
    path: null,
    logs: "No log file found. Start server with output redirected to logs/server.log",
  };
}
