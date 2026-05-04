import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraMetrics } from "../warehouse/nexoraLocalWarehouse";
import { getNexoraTimeline } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const UI_LOG = nexoraLocalPath("local-ui", "journal", "local-ui-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(UI_LOG, {
    event,
    payload,
    createdAt: now(),
  });
}

function safeRead(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function countLog(file: string, event?: string) {
  const rows = safeRead(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

function latestRows(file: string, limit = 10) {
  return safeRead(file).slice(-limit).reverse();
}

function localFileExists(...parts: string[]) {
  return fs.existsSync(nexoraLocalPath(...parts));
}

function htmlEscape(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function badge(label: string, value: any) {
  return `<div class="badge"><strong>${htmlEscape(value)}</strong><span>${htmlEscape(label)}</span></div>`;
}

function page(title: string, body: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg:#0b1020;
      --panel:#121a33;
      --panel2:#172142;
      --text:#f5f7ff;
      --muted:#aab4d4;
      --line:#2c3a66;
      --good:#40d98a;
      --warn:#ffd166;
      --bad:#ff5c7a;
      --blue:#6ea8ff;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family: Inter, Arial, sans-serif; }
    header { padding:24px; border-bottom:1px solid var(--line); background:linear-gradient(135deg,#101936,#0b1020); }
    header h1 { margin:0 0 8px; font-size:28px; }
    header p { margin:0; color:var(--muted); }
    nav { display:flex; flex-wrap:wrap; gap:10px; padding:16px 24px; border-bottom:1px solid var(--line); background:#0d1429; }
    nav a { color:var(--text); text-decoration:none; padding:8px 12px; background:var(--panel); border:1px solid var(--line); border-radius:10px; }
    main { padding:24px; max-width:1400px; margin:0 auto; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:18px; margin-bottom:18px; }
    .panel h2 { margin-top:0; }
    .badge { background:var(--panel2); border:1px solid var(--line); border-radius:14px; padding:16px; }
    .badge strong { display:block; font-size:26px; color:var(--blue); }
    .badge span { color:var(--muted); }
    .ok { color:var(--good); }
    .warn { color:var(--warn); }
    .bad { color:var(--bad); }
    pre { overflow:auto; white-space:pre-wrap; background:#070b18; border:1px solid var(--line); border-radius:12px; padding:14px; color:#dbe5ff; }
    table { width:100%; border-collapse:collapse; }
    th,td { text-align:left; padding:10px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-weight:600; }
    .small { color:var(--muted); font-size:13px; }
  </style>
</head>
<body>
  <header>
    <h1>${htmlEscape(title)}</h1>
    <p>Nexora local/offline AI company control layer. No Railway deploy. No Postgres dependency.</p>
  </header>
  <nav>
    <a href="/nexora/owner">Owner</a>
    <a href="/nexora/company">Company</a>
    <a href="/nexora/approvals">Approvals</a>
    <a href="/nexora/office">Office Agents</a>
    <a href="/nexora/teaching">Teaching</a>
    <a href="/nexora/rewards">Rewards</a>
    <a href="/nexora/recovery">Recovery</a>
  </nav>
  <main>${body}</main>
</body>
</html>`;
}

export function getNexoraLocalUiStatus() {
  const summary = getNexoraOwnerSummary();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_owner_cockpit_ui",
    generatedAt: now(),
    pages: [
      "/nexora/owner",
      "/nexora/company",
      "/nexora/approvals",
      "/nexora/office",
      "/nexora/teaching",
      "/nexora/rewards",
      "/nexora/recovery",
    ],
    apis: [
      "/api/nexora/local-ui/status",
      "/api/nexora/local-ui/owner-summary",
      "/api/nexora/local-ui/company-summary",
      "/api/nexora/local-ui/approval-summary",
      "/api/nexora/local-ui/office-summary",
      "/api/nexora/local-ui/teaching-summary",
      "/api/nexora/local-ui/reward-summary",
      "/api/nexora/local-ui/recovery-summary",
    ],
    summary,
  };
}

export function getNexoraOwnerSummary() {
  const approvalSummary = getNexoraApprovalSummary();
  const office = getNexoraOfficeSummary();
  const teaching = getNexoraTeachingSummary();
  const rewards = getNexoraRewardSummary();
  const recovery = getNexoraRecoverySummary();
  const company = getNexoraCompanySummary();

  const ownerActions = [
    ...(approvalSummary.pending > 0 ? [`Review ${approvalSummary.pending} approval/sign/commit items`] : []),
    ...(office.leads > 0 ? [`Review ${office.leads} local lead records`] : []),
    ...(teaching.openTeachingItems > 0 ? [`Teach Nexora on ${teaching.openTeachingItems} open gaps/items`] : []),
    ...(recovery.postgresMode === "disabled" ? ["Postgres intentionally paused; continue local-only mode"] : []),
  ];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_owner_summary",
    generatedAt: now(),
    ownerOnlyDoes: ["approve", "sign", "commit"],
    nexoraDoesEverythingElse: true,
    ownerActions,
    company,
    approvalSummary,
    office,
    teaching,
    rewards,
    recovery,
  };
}

export function getNexoraCompanySummary() {
  const companyRuns = countLog(nexoraLocalPath("company-run", "cycles", "company-cycle-log.jsonl"));
  const companyV2Runs = countLog(nexoraLocalPath("company-v2", "journal", "company-v2-journal.jsonl"));
  const nerveActions = countLog(nexoraLocalPath("nerve-center", "actions", "action-log.jsonl"));
  const humanOps = countLog(nexoraLocalPath("human-ops", "journal", "human-ops-journal.jsonl"));
  const completion = countLog(nexoraLocalPath("company-completion", "journal", "completion-journal.jsonl"));

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_company_summary",
    generatedAt: now(),
    companyRuns,
    companyV2Runs,
    nerveActions,
    humanOps,
    completion,
    status: "local_ai_company_mode",
  };
}

export function getNexoraApprovalSummary() {
  const humanBoundaryApprovals = latestRows(nexoraLocalPath("human-boundary", "approvals", "approval-log.jsonl"), 50);
  const humanBoundarySigns = latestRows(nexoraLocalPath("human-boundary", "signatures", "signature-log.jsonl"), 50);
  const humanBoundaryCommits = latestRows(nexoraLocalPath("human-boundary", "commitments", "commitment-log.jsonl"), 50);
  const humanCompanyApprovals = latestRows(nexoraLocalPath("human-company", "approvals", "approval-log.jsonl"), 50);
  const ownerQueue = latestRows(nexoraLocalPath("human-ops", "owner-queue", "owner-queue-log.jsonl"), 50);

  const combined = [
    ...humanBoundaryApprovals,
    ...humanBoundarySigns,
    ...humanBoundaryCommits,
    ...humanCompanyApprovals,
    ...ownerQueue,
  ];

  const pending = combined.filter((row: any) => {
    const text = JSON.stringify(row).toLowerCase();
    return text.includes("pending") || text.includes("open");
  }).length;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_approval_summary",
    generatedAt: now(),
    pending,
    total: combined.length,
    rows: combined.slice(0, 25),
  };
}

export function getNexoraOfficeSummary() {
  const leads = countLog(nexoraLocalPath("crm", "crm-log.jsonl"), "lead.upserted");
  const quotes = countLog(nexoraLocalPath("quotes", "quote-log.jsonl"), "quote.created");
  const suppliers = countLog(nexoraLocalPath("suppliers", "supplier-log.jsonl"), "supplier.upserted");
  const projects = countLog(nexoraLocalPath("projects", "project-log.jsonl"), "project.created");
  const officeJournal = countLog(nexoraLocalPath("office-agents", "journal", "office-agent-journal.jsonl"));

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_office_summary",
    generatedAt: now(),
    leads,
    quotes,
    suppliers,
    projects,
    officeJournal,
  };
}

export function getNexoraTeachingSummary() {
  const skills = countLog(nexoraLocalPath("teaching", "skills", "skill-log.jsonl"), "skill.created");
  const gaps = countLog(nexoraLocalPath("teaching", "gaps", "gap-log.jsonl"), "gap.created");
  const lessons = countLog(nexoraLocalPath("teaching", "lessons", "lesson-log.jsonl"), "lesson.created");
  const playbooks = countLog(nexoraLocalPath("teaching", "playbooks", "playbook-log.jsonl"), "playbook.created");
  const training = countLog(nexoraLocalPath("teaching", "training", "training-log.jsonl"), "training.created");
  const queueRows = latestRows(nexoraLocalPath("teaching", "queue", "teaching-queue.jsonl"), 100);
  const openTeachingItems = queueRows.filter((row: any) => JSON.stringify(row).toLowerCase().includes("open")).length;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_teaching_summary",
    generatedAt: now(),
    skills,
    gaps,
    lessons,
    playbooks,
    training,
    openTeachingItems,
  };
}

export function getNexoraRewardSummary() {
  const rewards = latestRows(nexoraLocalPath("rewards", "ledger", "reward-ledger.jsonl"), 100);
  const praise = latestRows(nexoraLocalPath("rewards", "praise", "praise-log.jsonl"), 100);
  const patterns = latestRows(nexoraLocalPath("rewards", "patterns", "success-pattern-log.jsonl"), 100);
  const promotions = latestRows(nexoraLocalPath("rewards", "promotions", "promotion-log.jsonl"), 100);

  const totalPoints = rewards.reduce((sum: number, row: any) => {
    const points = Number(row?.reward?.points || 0);
    return sum + points;
  }, 0);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_reward_summary",
    generatedAt: now(),
    rewards: rewards.length,
    praise: praise.length,
    successPatterns: patterns.length,
    promotions: promotions.length,
    totalPoints,
  };
}

export function getNexoraRecoverySummary() {
  const dbModeFile = nexoraLocalPath("dbmode", "nexora-db-mode.json");
  let postgresMode = "disabled";

  try {
    if (fs.existsSync(dbModeFile)) {
      postgresMode = JSON.parse(fs.readFileSync(dbModeFile, "utf8")).mode || "disabled";
    }
  } catch {}

  const fallbackJournalExists = localFileExists("fallback-journal", "nexora-fallback-journal.jsonl");
  const localDataMetrics = getNexoraMetrics({ limit: 20 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_recovery_summary",
    generatedAt: now(),
    postgresMode,
    fallbackJournalExists,
    localDataMetrics,
    recommendation: "Continue local-only mode until Postgres storage is purchased/upgraded.",
  };
}

export function renderNexoraOwnerPage() {
  const summary = getNexoraOwnerSummary();

  const body = `
    <div class="grid">
      ${badge("Owner actions", summary.ownerActions.length)}
      ${badge("Pending approvals", summary.approvalSummary.pending)}
      ${badge("Leads", summary.office.leads)}
      ${badge("Quotes", summary.office.quotes)}
      ${badge("Teaching gaps", summary.teaching.gaps)}
      ${badge("Reward points", summary.rewards.totalPoints)}
    </div>

    <div class="panel">
      <h2>Owner Rule</h2>
      <p><span class="ok">Humans only approve, sign, and commit.</span> Nexora does everything else.</p>
    </div>

    <div class="panel">
      <h2>Next Human Actions</h2>
      <ul>
        ${summary.ownerActions.map((x: string) => `<li>${htmlEscape(x)}</li>`).join("") || "<li>No urgent human actions found.</li>"}
      </ul>
    </div>

    <div class="panel">
      <h2>Raw Summary</h2>
      <pre>${htmlEscape(JSON.stringify(summary, null, 2))}</pre>
    </div>
  `;

  journal("ui.owner_page.rendered", { generatedAt: now() });

  return page("Nexora Owner Cockpit", body);
}

export function renderNexoraCompanyPage() {
  const summary = getNexoraCompanySummary();

  const body = `
    <div class="grid">
      ${badge("Company runs", summary.companyRuns)}
      ${badge("Company v2 events", summary.companyV2Runs)}
      ${badge("Nerve actions", summary.nerveActions)}
      ${badge("Human ops events", summary.humanOps)}
      ${badge("Completion events", summary.completion)}
    </div>
    <div class="panel"><h2>Company Summary</h2><pre>${htmlEscape(JSON.stringify(summary, null, 2))}</pre></div>
  `;

  return page("Nexora Company", body);
}

export function renderNexoraApprovalsPage() {
  const summary = getNexoraApprovalSummary();

  const rows = summary.rows.map((row: any) => `
    <tr>
      <td>${htmlEscape(row.event || "item")}</td>
      <td><pre>${htmlEscape(JSON.stringify(row, null, 2))}</pre></td>
    </tr>
  `).join("");

  const body = `
    <div class="grid">
      ${badge("Pending", summary.pending)}
      ${badge("Total", summary.total)}
    </div>
    <div class="panel">
      <h2>Approvals / Sign / Commit Queue</h2>
      <table><thead><tr><th>Type</th><th>Payload</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;

  return page("Nexora Approvals", body);
}

export function renderNexoraOfficePage() {
  const summary = getNexoraOfficeSummary();

  const body = `
    <div class="grid">
      ${badge("Leads", summary.leads)}
      ${badge("Quotes", summary.quotes)}
      ${badge("Suppliers", summary.suppliers)}
      ${badge("Projects", summary.projects)}
      ${badge("Office events", summary.officeJournal)}
    </div>
    <div class="panel"><h2>Office Agents</h2><pre>${htmlEscape(JSON.stringify(summary, null, 2))}</pre></div>
  `;

  return page("Nexora Office Agents", body);
}

export function renderNexoraTeachingPage() {
  const summary = getNexoraTeachingSummary();

  const body = `
    <div class="grid">
      ${badge("Skills", summary.skills)}
      ${badge("Gaps", summary.gaps)}
      ${badge("Lessons", summary.lessons)}
      ${badge("Playbooks", summary.playbooks)}
      ${badge("Training", summary.training)}
      ${badge("Open queue", summary.openTeachingItems)}
    </div>
    <div class="panel"><h2>Teaching System</h2><pre>${htmlEscape(JSON.stringify(summary, null, 2))}</pre></div>
  `;

  return page("Nexora Teaching", body);
}

export function renderNexoraRewardsPage() {
  const summary = getNexoraRewardSummary();

  const body = `
    <div class="grid">
      ${badge("Rewards", summary.rewards)}
      ${badge("Praise", summary.praise)}
      ${badge("Success patterns", summary.successPatterns)}
      ${badge("Promotion reviews", summary.promotions)}
      ${badge("Total points", summary.totalPoints)}
    </div>
    <div class="panel"><h2>Reward System</h2><pre>${htmlEscape(JSON.stringify(summary, null, 2))}</pre></div>
  `;

  return page("Nexora Rewards", body);
}

export function renderNexoraRecoveryPage() {
  const summary = getNexoraRecoverySummary();

  const body = `
    <div class="grid">
      ${badge("Postgres mode", summary.postgresMode)}
      ${badge("Fallback journal", summary.fallbackJournalExists ? "yes" : "no")}
    </div>
    <div class="panel"><h2>Recovery</h2><pre>${htmlEscape(JSON.stringify(summary, null, 2))}</pre></div>
  `;

  return page("Nexora Recovery", body);
}
