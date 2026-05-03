import fs from "fs";
import path from "path";

const PATCH_ROOT = path.resolve(process.cwd(), "reports/nexora-audit/safe-patches");

function now() {
  return new Date().toISOString();
}

function ensurePatchRoot() {
  fs.mkdirSync(PATCH_ROOT, { recursive: true });
}

function patchId() {
  return `patch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function planNexoraSafePatch(input: any = {}) {
  const file = String(input.file || "");
  const operation = String(input.operation || "append");
  const description = String(input.description || "Nexora safe patch plan");
  const content = String(input.content || "");

  const exists = file ? fs.existsSync(file) : false;
  const source = exists ? fs.readFileSync(file, "utf8") : "";

  const blockedReasons: string[] = [];

  if (!file) blockedReasons.push("file is required");
  if (!content && operation !== "inspect") blockedReasons.push("content is required");
  if (operation === "replace_all") blockedReasons.push("replace_all is not allowed by Nexora safe patch framework");
  if (operation === "append_if_missing" && source.includes(content)) blockedReasons.push("content already exists");

  return {
    ok: blockedReasons.length === 0,
    nexoraBrain: true,
    service: "nexora_safe_patch_planner",
    generatedAt: now(),
    planId: patchId(),
    file,
    exists,
    operation,
    description,
    contentLength: content.length,
    blockedReasons,
    backupRequired: exists,
    allowedOperations: [
      "inspect",
      "create_if_missing",
      "append_if_missing",
      "insert_after_marker",
    ],
  };
}

export function applyNexoraSafePatch(input: any = {}) {
  ensurePatchRoot();

  const plan = planNexoraSafePatch(input);

  if (!plan.ok && input.force !== true) {
    return {
      ok: false,
      nexoraBrain: true,
      applied: false,
      plan,
    };
  }

  const file = String(input.file || "");
  const operation = String(input.operation || "append_if_missing");
  const content = String(input.content || "");
  const marker = input.marker ? String(input.marker) : "";

  if (!file) {
    return {
      ok: false,
      nexoraBrain: true,
      applied: false,
      error: "file is required",
    };
  }

  const exists = fs.existsSync(file);
  const source = exists ? fs.readFileSync(file, "utf8") : "";

  const backupFile = exists
    ? path.join(PATCH_ROOT, `${plan.planId}_${file.replace(/[^a-zA-Z0-9._-]/g, "_")}.bak`)
    : null;

  if (exists && backupFile) {
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.writeFileSync(backupFile, source, "utf8");
  }

  let next = source;
  let applied = false;

  if (operation === "inspect") {
    applied = false;
  } else if (operation === "create_if_missing") {
    if (!exists) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      next = content;
      fs.writeFileSync(file, next, "utf8");
      applied = true;
    }
  } else if (operation === "append_if_missing") {
    if (!source.includes(content)) {
      next = source.endsWith("\n") ? `${source}${content}\n` : `${source}\n${content}\n`;
      fs.writeFileSync(file, next, "utf8");
      applied = true;
    }
  } else if (operation === "insert_after_marker") {
    if (!marker) {
      return {
        ok: false,
        nexoraBrain: true,
        applied: false,
        error: "marker is required for insert_after_marker",
        plan,
      };
    }

    if (!source.includes(marker)) {
      return {
        ok: false,
        nexoraBrain: true,
        applied: false,
        error: "marker not found",
        marker,
        plan,
      };
    }

    if (!source.includes(content)) {
      next = source.replace(marker, `${marker}\n${content}`);
      fs.writeFileSync(file, next, "utf8");
      applied = true;
    }
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_safe_patch_framework",
    applied,
    plan,
    backupFile,
  };
}
