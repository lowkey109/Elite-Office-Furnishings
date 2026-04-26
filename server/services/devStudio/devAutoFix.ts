import fs from "fs";
import { execSync } from "child_process";
import { generateSimpleFix } from "./devAIPatch";
import { runDevCommand } from "./devTerminal";

type TscIssue = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
};

type FixPlan = {
  file: string;
  line: number;
  column?: number;
  code: string;
  message: string;
  action: string;
  executable: boolean;
  packageName?: string;
};

const INSTALL_ALLOWLIST = new Set([
  "slugify",
  "zod",
  "date-fns",
  "nanoid",
  "uuid",
  "axios",
  "lodash",
  "clsx",
]);

const AUDIT_LOG = "server/logs/dev-auto-fix-audit.log";

function audit(event: string, data: Record<string, unknown> = {}) {
  fs.mkdirSync("server/logs", { recursive: true });
  fs.appendFileSync(
    AUDIT_LOG,
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...data,
    }) + "\n"
  );
}

function backupFile(file: string) {
  if (!fs.existsSync(file)) return null;
  const backup = `${file}.bak-${Date.now()}`;
  fs.copyFileSync(file, backup);
  return backup;
}

function restoreBackup(file: string, backup: string | null) {
  if (backup && fs.existsSync(backup)) {
    fs.copyFileSync(backup, file);
  }
}

function parseTscIssues(output: string): TscIssue[] {
  const issues: TscIssue[] = [];
  const regex = /^(.+?)(?:\((\d+),(\d+)\)|:(\d+):(\d+)):\s+error\s+(TS\d+):\s+(.+)$/gm;

  let match;
  while ((match = regex.exec(output)) !== null) {
    issues.push({
      file: match[1],
      line: Number(match[2] || match[4]),
      column: Number(match[3] || match[5]),
      code: match[6],
      message: match[7],
    });
  }

  return issues;
}

function planFixes(issues: TscIssue[]): FixPlan[] {
  return issues.map((issue) => {
    const file = issue.file.trim();

    if (issue.code === "TS2322") {
      return { ...issue, file, action: "fix-type-mismatch", executable: true };
    }

    if (issue.code === "TS2339") {
      return { ...issue, file, action: "ai-patch", executable: true };
    }

    if (issue.code === "TS2307") {
      const match = issue.message.match(/Cannot find module '([^']+)'/);
      const packageName = match?.[1];

      return {
        ...issue,
        file,
        action: "install-package",
        packageName,
        executable: Boolean(packageName && INSTALL_ALLOWLIST.has(packageName)),
      };
    }

    return { ...issue, file, action: "inspect", executable: false };
  });
}

function safeInstallPackage(fix: FixPlan) {
  const packageName = fix.packageName;

  audit("install.attempt", { packageName, file: fix.file });

  if (!packageName || !INSTALL_ALLOWLIST.has(packageName)) {
    audit("install.blocked", { packageName, reason: "not_allowlisted" });
    return false;
  }

  const packageJsonBackup = backupFile("package.json");
  const packageLockBackup = backupFile("package-lock.json");

  try {
    execSync(`npm install ${packageName}`, { stdio: "pipe" });
    execSync("npx tsc --noEmit", { stdio: "pipe" });

    audit("install.success", { packageName });
    return true;
  } catch (error: any) {
    restoreBackup("package.json", packageJsonBackup);
    restoreBackup("package-lock.json", packageLockBackup);

    audit("install.rollback", {
      packageName,
      error: String(error?.message || error),
    });

    return false;
  }
}

function applyCodeFix(fix: FixPlan) {
  if (fix.action === "install-package") {
    return safeInstallPackage(fix);
  }

  if (!fs.existsSync(fix.file)) {
    audit("codefix.skipped", { file: fix.file, reason: "file_not_found" });
    return false;
  }

  const fileBackup = backupFile(fix.file);
  const source = fs.readFileSync(fix.file, "utf8");

  try {
    let nextSource: string | null = null;

    if (fix.action === "fix-type-mismatch") {
      const lines = source.split("\n");
      lines[fix.line - 1] = generateSimpleFix(lines[fix.line - 1], fix);
      nextSource = lines.join("\n");
    }

    if (fix.action === "ai-patch") {
      const result = generateSimpleFix(fix, source);
      if (result && result.after) {
        nextSource = result.after;
      }
    }

    if (!nextSource || nextSource === source) {
      audit("codefix.no_change", { action: fix.action, file: fix.file });
      return false;
    }

    fs.writeFileSync(fix.file, nextSource, "utf8");

    try {
      execSync("npx tsc --noEmit", { stdio: "pipe" });
      audit("codefix.verified", { action: fix.action, file: fix.file });
      return true;
    } catch (verifyError: any) {
      restoreBackup(fix.file, fileBackup);
      audit("codefix.rollback", {
        action: fix.action,
        file: fix.file,
        reason: "verify_failed",
        error: String(verifyError?.message || verifyError),
      });
      return false;
    }
  } catch (error: any) {
    restoreBackup(fix.file, fileBackup);
    audit("codefix.rollback", {
      action: fix.action,
      file: fix.file,
      reason: "patch_failed",
      error: String(error?.message || error),
    });
    return false;
  }
}

export async function runAutoFix(task = "fix typescript", apply = false) {
  const logs: string[] = [];

  async function run(command: string) {
    logs.push("$ " + command);
    const result = await runDevCommand(command);
    logs.push(result.output || "");
    return result;
  }

  audit("autofix.start", { task, apply });

  const diagnose = await run("npx tsc --noEmit");
  const issues = parseTscIssues(diagnose.output || "");
  const fixes = planFixes(issues);

  logs.push("== FIX PLAN ==");
  logs.push(JSON.stringify(fixes, null, 2));

  if (diagnose.ok) {
    audit("autofix.clean", {});
    return { ok: true, logs, message: "TypeScript clean" };
  }

  if (!apply) {
    audit("autofix.dry_run", { issues: issues.length });
    return { ok: false, issues, fixes, logs, message: "Dry run only" };
  }

  for (const fix of fixes) {
    if (!fix.executable) {
      audit("fix.skipped", {
        code: fix.code,
        action: fix.action,
        packageName: fix.packageName,
        reason: "not_executable",
      });
      continue;
    }

    const changed = applyCodeFix(fix);
    logs.push(`${fix.action}: ${changed ? "applied" : "failed"}`);
  }

  const verify = await run("npx tsc --noEmit");

  audit("autofix.complete", {
    ok: verify.ok,
  });

  return {
    ok: verify.ok,
    logs,
    message: verify.ok ? "Auto-fix succeeded" : "Still failing",
  };
}
