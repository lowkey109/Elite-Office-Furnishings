import React, { useState } from "react";

export default function AdminDevStudio() {
  const [devLogs, setDevLogs] = useState("Logs not loaded yet");
  const [command, setCommand] = useState("pwd");
  const [history, setHistory] = useState<string[]>([]);
  const [fileDir, setFileDir] = useState(".");
  const [fileList, setFileList] = useState<any[]>([]);
  const [fileContent, setFileContent] = useState("Select a file to preview");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [autoFixResult, setAutoFixResult] = useState<any>(null);

  
  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setHistory((h) => [...h, "$ " + cmd]);

    const res = await fetch("/api/dev-studio/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    });

    const data = await res.json();

    setHistory((h) => [
      ...h,
      data.ok ? data.output : "ERROR: " + (data.output || data.error),
    ]);
  };

  const runQuick = async (cmd: string) => {
    await executeCommand(cmd);
  };

  const runCommand = async () => {
    const cmd = command.trim();
    await executeCommand(cmd);
    setCommand("");
  };

  
  async function loadDevLogs() {
    const res = await fetch("/api/dev-studio/logs?lines=300");
    const data = await res.json();
    setDevLogs(data.logs || data.error || "No logs returned");
  }

  async function loadFileList(dir = fileDir) {
    const res = await fetch("/api/dev-studio/files/list?dir=" + encodeURIComponent(dir));
    const data = await res.json();
    if (!data.ok) return setFileContent("ERROR: " + data.error);
    setFileDir(dir);
    setFileList(data.files || []);
  }

  async function readFile(path: string) {
    const res = await fetch("/api/dev-studio/files/read?path=" + encodeURIComponent(path));
    const data = await res.json();
    setSelectedFilePath(path);
    setFileContent(data.ok ? data.content : "ERROR: " + data.error);
  }

  async function saveFile() {
    if (!selectedFilePath) return alert("No file selected");

    const res = await fetch("/api/dev-studio/files/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selectedFilePath, content: fileContent }),
    });

    const data = await res.json();
    alert(data.message || data.error || "Save complete");
  }

  async function runAutoFix(apply = false) {
    const res = await fetch("/api/dev-studio/auto-fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "fix typescript", apply }),
    });
    const data = await res.json();
    setAutoFixResult(data);
  }

return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "#05070a",
      color: "#d8fff1",
      fontFamily: "monospace",
    }}>
      <div style={{
        width: 280,
        borderRight: "1px solid rgba(44,255,138,0.2)",
        padding: 16,
      }}>
        <h3 style={{ color: "#2cff8a" }}>DEV STUDIO</h3>
        <div style={{ marginTop: 20, lineHeight: 1.9 }}>
          <div>✔ Terminal</div>
          <div>✔ Logs coming</div>
          <div style={{ border: "1px solid rgba(44,255,138,0.25)", borderRadius: 12, padding: 16, marginTop: 16 }}>
            <h2 style={{ color: "#2cff8a", marginBottom: 10 }}>AI Auto-Fix</h2>

            <button onClick={() => runAutoFix(false)} style={{ marginRight: 8 }}>
              Dry Run
            </button>

            <button onClick={() => runAutoFix(true)}>
              Apply Fix
            </button>

            {autoFixResult && (
              <div style={{ marginTop: 12 }}>
                <div><b>Status:</b> {autoFixResult.ok ? "OK" : "Needs Fix"}</div>
                <div><b>Apply:</b> {String(autoFixResult.apply)}</div>
                <div><b>Message:</b> {autoFixResult.message}</div>

                <h3 style={{ marginTop: 12 }}>Issues</h3>
                <div style={{ margin: "12px 0" }}>
          <button onClick={saveFile} disabled={!selectedFilePath}>
            Save File
          </button>
          <span style={{ marginLeft: 10 }}>{selectedFilePath || "No file selected"}</span>
        </div>

        <textarea
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          style={{
            width: "100%",
            minHeight: 260,
            background: "#020403",
            color: "#d8fff1",
            padding: 12,
            border: "1px solid rgba(44,255,138,0.25)",
            borderRadius: 8,
            fontFamily: "monospace",
          }}
        />

        <pre style={{ background: "#020403", color: "#d8fff1", padding: 12, overflow: "auto", maxHeight: 220 }}>
{JSON.stringify(autoFixResult.issues || [], null, 2)}
                </pre>

                <h3>Suggested Fixes</h3>
                <pre style={{ background: "#020403", color: "#d8fff1", padding: 12, overflow: "auto", maxHeight: 220 }}>
{JSON.stringify(autoFixResult.suggestedFixes || [], null, 2)}
                </pre>

                <h3>Logs</h3>
                <pre style={{ background: "#020403", color: "#d8fff1", padding: 12, overflow: "auto", maxHeight: 260 }}>
{(autoFixResult.logs || []).join("\n")}
                </pre>
              </div>
            )}
          </div>
          <div>✔ Deploy coming</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20 }}>
        <h1 style={{ color: "#2cff8a" }}>AI DevOps Studio</h1>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ border: "1px solid rgba(44,255,138,0.25)", borderRadius: 10, padding: "8px 12px" }}>Terminal: Active</div>
          <div style={{ border: "1px solid rgba(44,255,138,0.25)", borderRadius: 10, padding: "8px 12px" }}>Mode: Internal</div>
          <div style={{ border: "1px solid rgba(44,255,138,0.25)", borderRadius: 10, padding: "8px 12px" }}>Guardrails: On</div>
        </div>

        <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
          {[
            ["pwd", "pwd"],
            ["ls", "ls"],
            ["typecheck", "npx tsc --noEmit"],
            ["git", "git status"],
            ["processes", "ps aux | grep tsx"],
            ["logs", "tail -80 .local/state/workflow-logs/*/start_application.shell.exec.0"]
          ].map(([label, cmd]) => (
            <button
              key={cmd}
              onClick={() => executeCommand(cmd)}
              style={{
                background: "rgba(44,255,138,0.12)",
                color: "#2cff8a",
                border: "1px solid rgba(44,255,138,0.35)",
                borderRadius: 10,
                padding: "8px 12px",
                fontFamily: "monospace",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <p style={{ color: "#8aa" }}>Internal repair cockpit: terminal, diagnostics, logs, patches.</p>

        <div style={{
          border: "1px solid rgba(44,255,138,0.25)",
          borderRadius: 14,
          padding: 16,
          background: "rgba(0,0,0,0.45)",
          height: "80%",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            flex: 1,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            marginBottom: 12,
          }}>
            {history.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>

          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCommand()}
            placeholder="pwd | ls | grep | npx tsc --noEmit"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(44,255,138,0.35)",
              background: "#000",
              color: "#2cff8a",
              fontFamily: "monospace",
            }}
          />
        </div>
      </div>
    </div>
  );
}
