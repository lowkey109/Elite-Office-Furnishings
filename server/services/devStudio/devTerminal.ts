import { exec } from "child_process";

const ALLOWED_COMMANDS = [
  "npm install",
  "ls",
  "pwd",
  "grep",
  "find",
  "sed",
  "cat",
  "npm run",
  "npx tsc",
  "curl",
  "git status",
  "ps aux",
  "tail",
  "rm -f",
];

export function isCommandAllowed(command: string) {
  const trimmed = command.trim();
  return ALLOWED_COMMANDS.some((allowed) => trimmed.startsWith(allowed));
}

export function runDevCommand(command: string): Promise<{
  ok: boolean;
  output: string;
}> {
  return new Promise((resolve) => {
    if (!isCommandAllowed(command)) {
      resolve({
        ok: false,
        output: `Blocked command: ${command}`,
      });
      return;
    }

    exec(
      command,
      {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 10,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          output: [stdout, stderr, error?.message].filter(Boolean).join("\n"),
        });
      }
    );
  });
}
