import type { Express } from "express";

function html(): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Nexora Bank Connect</title>
  <style>
    body {
      margin: 0;
      background: #080b12;
      color: #f4f7fb;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .wrap {
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 18px 60px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 34px;
      letter-spacing: -0.04em;
    }
    .sub {
      color: #aeb8ca;
      max-width: 760px;
      line-height: 1.5;
    }
    .pill {
      display: inline-flex;
      padding: 8px 12px;
      border-radius: 999px;
      background: #10203a;
      color: #8fd3ff;
      border: 1px solid #1f3e66;
      font-size: 13px;
      white-space: nowrap;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .card {
      background: linear-gradient(180deg, #101722, #0c111a);
      border: 1px solid #1c2a3f;
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 16px 40px rgba(0,0,0,.28);
    }
    .card h2 {
      margin: 0 0 10px;
      font-size: 17px;
    }
    .status {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      background: #05070b;
      border: 1px solid #1d2b40;
      border-radius: 14px;
      padding: 12px;
      min-height: 110px;
      white-space: pre-wrap;
      overflow: auto;
      color: #cbe4ff;
      font-size: 12px;
      line-height: 1.45;
    }
    button {
      cursor: pointer;
      border: 0;
      border-radius: 12px;
      padding: 11px 14px;
      background: #2f7df6;
      color: white;
      font-weight: 700;
      margin: 6px 6px 6px 0;
    }
    button.secondary {
      background: #172235;
      color: #d9e7ff;
      border: 1px solid #2b3f5c;
    }
    button.danger {
      background: #3a1b20;
      color: #ffb3bd;
      border: 1px solid #6b2833;
    }
    .wide { grid-column: span 3; }
    .warning {
      margin-top: 18px;
      padding: 14px;
      border-radius: 14px;
      background: #22180a;
      border: 1px solid #5d3f0c;
      color: #ffd98a;
      line-height: 1.5;
    }
    ul {
      margin: 8px 0 0;
      padding-left: 18px;
      color: #aeb8ca;
    }
    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
      .wide { grid-column: span 1; }
      .top { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>Nexora Bank Connect</h1>
        <div class="sub">
          Secure read-only bank/card connection scaffold for Phantom X and The Corporate Desk.
          Nexora stores provider metadata only. No card numbers, CVV, bank passwords, or automatic transfers.
        </div>
      </div>
      <div class="pill">READ-ONLY · HUMAN APPROVAL REQUIRED</div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>1. Connection Status</h2>
        <button onclick="loadStatus()">Refresh Status</button>
        <div id="status" class="status">Waiting...</div>
      </div>

      <div class="card">
        <h2>2. Create Provider Session</h2>
        <button onclick="createSession()">Create Link Session</button>
        <div id="session" class="status">No session yet.</div>
      </div>

      <div class="card">
        <h2>3. Demo Callback</h2>
        <button onclick="demoCallback()">Simulate Read-Only Connection</button>
        <div id="callback" class="status">No callback yet.</div>
      </div>

      <div class="card">
        <h2>4. Accounts</h2>
        <button onclick="loadAccounts()">Load Accounts</button>
        <div id="accounts" class="status">No accounts loaded.</div>
      </div>

      <div class="card">
        <h2>5. Balances</h2>
        <button onclick="loadBalances()">Load Balances</button>
        <div id="balances" class="status">No balances loaded.</div>
      </div>

      <div class="card">
        <h2>6. Funding Readiness</h2>
        <button onclick="fundingReadiness()">Check Funding Readiness</button>
        <div id="readiness" class="status">Not checked.</div>
      </div>

      <div class="card wide">
        <h2>Security Rules</h2>
        <ul>
          <li>No raw card numbers stored in Nexora.</li>
          <li>No CVV stored in Nexora.</li>
          <li>No bank passwords or raw bank logins stored in Nexora.</li>
          <li>No automatic transfers, deposits, or withdrawals.</li>
          <li>Provider token/metadata only.</li>
          <li>Human approval required before any funding or real-money trading step.</li>
          <li>External bank/payment provider required for real money movement.</li>
        </ul>
        <div class="warning">
          This UI is wired for provider-ready scaffolding. A real provider such as Stripe, Plaid, TrueLayer, Basiq, or an Australian Open Banking provider should handle credentials and sensitive payment data.
        </div>
      </div>
    </div>
  </div>

  <script>
    const pretty = (data) => JSON.stringify(data, null, 2);

    async function getJson(url) {
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { ok: false, nonJson: text.slice(0, 1000) }; }
    }

    async function postJson(url, body) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { ok: false, nonJson: text.slice(0, 1000) }; }
    }

    async function loadStatus() {
      document.getElementById("status").textContent = pretty(await getJson("/api/nexora/bank-connect/status"));
    }

    async function createSession() {
      document.getElementById("session").textContent = pretty(await postJson("/api/nexora/bank-connect/session/create", {
        provider: "provider_placeholder",
        country: "AU",
        mode: "read_only"
      }));
      await loadStatus();
    }

    async function demoCallback() {
      document.getElementById("callback").textContent = pretty(await postJson("/api/nexora/bank-connect/callback", {
        provider: "provider_placeholder",
        providerCustomerRef: "cust_demo_metadata_only",
        providerConnectionRef: "conn_demo_metadata_only",
        institutionName: "Demo Bank",
        accountName: "Operating Account",
        accountMask: "****1234",
        accountType: "checking",
        currency: "AUD"
      }));
      await loadStatus();
    }

    async function loadAccounts() {
      document.getElementById("accounts").textContent = pretty(await getJson("/api/nexora/bank-connect/accounts"));
    }

    async function loadBalances() {
      document.getElementById("balances").textContent = pretty(await getJson("/api/nexora/bank-connect/balances"));
    }

    async function fundingReadiness() {
      document.getElementById("readiness").textContent = pretty(await postJson("/api/nexora/bank-connect/funding-readiness", {
        requestedFor: "funding_readiness_check",
        liveTrading: false,
        humanApprovalRequired: true
      }));
      await loadStatus();
    }

    loadStatus();
  </script>
</body>
</html>`;
}

export function registerNexoraBankConnectUiRoutes(app: Express): void {
  app.get("/nexora/operator/bank-connect", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html());
  });

  app.get("/api/nexora/bank-connect/ui/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_bank_connect_ui_status",
      generatedAt: new Date().toISOString(),
      uiRoute: "/nexora/operator/bank-connect",
      apiRoutes: [
        "/api/nexora/bank-connect/status",
        "/api/nexora/bank-connect/session/create",
        "/api/nexora/bank-connect/callback",
        "/api/nexora/bank-connect/accounts",
        "/api/nexora/bank-connect/balances",
        "/api/nexora/bank-connect/funding-readiness"
      ],
      safety: {
        rawCardNumbersStored: false,
        bankPasswordsStored: false,
        automaticTransfersEnabled: false,
        humanApprovalRequired: true,
        externalBankProviderRequired: true
      }
    });
  });
}
