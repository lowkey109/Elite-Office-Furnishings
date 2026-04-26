import fs from "fs";
import { runDevCommand } from "./devTerminal";

export async function writeDevFile(path: string, content: string) {
  const backup = path + ".bak";

  // backup
  if (fs.existsSync(path)) {
    fs.copyFileSync(path, backup);
  }

  // write new content
  fs.writeFileSync(path, content, "utf8");

  // verify with tsc
  const result = await runDevCommand("npx tsc --noEmit");

  if (!result.ok) {
    // rollback
    if (fs.existsSync(backup)) {
      fs.copyFileSync(backup, path);
    }
    return {
      ok: false,
      message: "Write failed — rolled back",
      output: result.output,
    };
  }

  return {
    ok: true,
    message: "File saved successfully",
  };
}
