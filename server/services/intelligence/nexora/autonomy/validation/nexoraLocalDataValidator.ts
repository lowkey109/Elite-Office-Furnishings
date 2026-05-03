import fs from "fs";
import path from "path";
import { nexoraLocalPath } from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walk(full, out);
    } else if (name.endsWith(".json") || name.endsWith(".jsonl")) {
      out.push(full);
    }
  }

  return out;
}

function validateJsonFile(file: string) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}

function validateJsonlFile(file: string) {
  const lines = fs.readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    JSON.parse(line);
  }
}

export function validateNexoraLocalData(input: any = {}) {
  const root = String(input.root || nexoraLocalPath());
  const files = walk(root);

  const results = files.map((file: string) => {
    try {
      if (file.endsWith(".json")) {
        validateJsonFile(file);
      }

      if (file.endsWith(".jsonl")) {
        validateJsonlFile(file);
      }

      return {
        ok: true,
        file,
        relative: path.relative(root, file),
        size: fs.statSync(file).size,
      };
    } catch (error) {
      return {
        ok: false,
        file,
        relative: path.relative(root, file),
        size: fs.existsSync(file) ? fs.statSync(file).size : 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const failed = results.filter((row: any) => !row.ok);

  return {
    ok: failed.length === 0,
    nexoraBrain: true,
    service: "nexora_local_data_validator",
    generatedAt: now(),
    root,
    checked: results.length,
    failed: failed.length,
    passed: results.length - failed.length,
    results,
    safety: {
      readOnly: true,
      noMutation: true,
      dbIndependent: true,
    },
  };
}

export function getNexoraLocalDataValidatorStatus() {
  const validation = validateNexoraLocalData({});

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_data_validator_status",
    generatedAt: now(),
    checked: validation.checked,
    failed: validation.failed,
    healthy: validation.ok,
  };
}
