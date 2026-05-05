import { useState, useEffect, useCallback } from "react";

const API = (path: string) => path;

type Intent = {
  id: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  symbol: string;
  side: string;
  notionalAud: number;
  capitalTier: string;
  maxTradeAud: number;
  reason: string;
  approvalNote?: string;
  executedOrderId?: string;
};

type AuditEvent = {
  id: string;
  ts: string;
  type: string;
  reason: string;
  symbol?: string;
  side?: string;
  notionalAud?: number;
  intentId?: string;
  orderId?: string;
};

type ReadinessResult = {
  ready: boolean;
  blockedReasons: string[];
  checks: Record<string, boolean>;
  balanceUsdt: number;
  balanceAud: number;
};

type Safety = {
  liveEnabled: boolean;
  withdrawalsLocked: boolean;
  killSwitchArmed: boolean;
  dryRunMode: boolean;
};

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: ok ? "#16a34a22" : "#dc262622",
      color: ok ? "#16a34a" : "#dc2626",
      border: `1px solid ${ok ? "#16a34a44" : "#dc262644"}`,
      marginRight: 4,
    }}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "#ca8a04",
    approved: "#16a34a",
    rejected: "#dc2626",
    expired: "#6b7280",
    executed: "#2563eb",
  };

  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      background: `${colors[status] || "#6b7280"}22`,
      color: colors[status] || "#6b7280",
      border: `1px solid ${colors[status] || "#6b7280"}55`,
      textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

export default function AdminBinanceLive() {
  const [safety, setSafety] = useState<Safety | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [activeTab, setActiveTab] = useState<"queue" | "order" | "audit">("queue");

  const [newSymbol, setNewSymbol] = useState("BTCUSDT");
  const [newSide, setNewSide] = useState<"BUY" | "SELL">("BUY");
  const [newNotionalAud, setNewNotionalAud] = useState(1);
  const [newEquityAud, setNewEquityAud] = useState(50);
  const [newReason, setNewReason] = useState("operator_manual_intent");
  const [intentMsg, setIntentMsg] = useState("");

  const [orderIntentId, setOrderIntentId] = useState("");
  const [orderQty, setOrderQty] = useState("");
  const [orderEquityAud, setOrderEquityAud] = useState(50);
  const [orderMsg, setOrderMsg] = useState("");
  const [orderResult, setOrderResult] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState("");

  const loadSafety = useCallback(async () => {
    try {
      const r = await fetch(API("/api/nexora/binance/live-readiness/status"));
      const d = await r.json();
      setSafety(d.safety || null);
    } catch {}
  }, []);

  const loadIntents = useCallback(async () => {
    try {
      const r = await fetch(API("/api/nexora/binance/live/intents-v2"));
      const d = await r.json();
      setIntents(d.intents || []);
    } catch {}
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const r = await fetch(API("/api/nexora/binance/live/audit?limit=100"));
      const d = await r.json();
      setAuditEvents(d.events || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadSafety();
    loadIntents();
    loadAudit();
    const t = setInterval(() => {
      loadSafety();
      loadIntents();
    }, 15000);
    return () => clearInterval(t);
  }, [loadSafety, loadIntents, loadAudit]);

  async function runReadinessCheck() {
    setReadinessLoading(true);
    try {
      const r = await fetch(API("/api/nexora/binance/live-readiness/check"), { method: "POST" });
      const d = await r.json();
      setReadiness(d);
      setSafety(d.safety || null);
    } catch {
      setReadiness(null);
    }
    setReadinessLoading(false);
  }

  async function toggleKillSwitch() {
    if (!safety) return;
    const action = safety.killSwitchArmed ? "clear" : "arm";
    await fetch(API("/api/nexora/binance/live/kill-switch"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: "admin_ui_toggle" }),
    });
    await loadSafety();
  }

  async function toggleDryRun() {
    if (!safety) return;
    await fetch(API("/api/nexora/binance/live/dry-run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !safety.dryRunMode }),
    });
    await loadSafety();
  }

  async function createIntent() {
    setIntentMsg("");
    try {
      const r = await fetch(API("/api/nexora/binance/live/intent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: newSymbol,
          side: newSide,
          notionalAud: newNotionalAud,
          equityAud: newEquityAud,
          reason: newReason,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setIntentMsg(`✓ Intent created: ${d.intent?.id}`);
        await loadIntents();
      } else {
        setIntentMsg(`✗ ${d.error || "Failed"}`);
      }
    } catch (e: any) {
      setIntentMsg(`✗ ${e.message}`);
    }
  }

  async function approveIntent(id: string) {
    setActionMsg("");
    const r = await fetch(API(`/api/nexora/binance/live/intent/${id}/approve`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "admin_ui_approved" }),
    });
    const d = await r.json();
    setActionMsg(d.ok ? `✓ Approved ${id}` : `✗ ${d.error}`);
    await loadIntents();
  }

  async function rejectIntent(id: string) {
    setActionMsg("");
    const r = await fetch(API(`/api/nexora/binance/live/intent/${id}/reject`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "admin_ui_rejected" }),
    });
    const d = await r.json();
    setActionMsg(d.ok ? `✓ Rejected ${id}` : `✗ ${d.error}`);
    await loadIntents();
  }

  async function placeOrder() {
    setOrderMsg("");
    setOrderResult(null);
    try {
      const r = await fetch(API("/api/nexora/binance/live/order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: orderIntentId,
          symbol: newSymbol,
          side: newSide,
          quantityStr: orderQty,
          equityAud: orderEquityAud,
        }),
      });
      const d = await r.json();
      setOrderResult(d);
      setOrderMsg(d.ok ? `✓ ${d.dryRun ? "DRY RUN" : "LIVE"} order: ${d.orderId}` : `✗ ${d.reason}`);
      await loadIntents();
      await loadAudit();
    } catch (e: any) {
      setOrderMsg(`✗ ${e.message}`);
    }
  }

  const card: React.CSSProperties = {
    background: "#1a1a22",
    border: "1px solid #2a2a3a",
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
  };

  const label: React.CSSProperties = {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
  };

  const input: React.CSSProperties = {
    background: "#111",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e8e4dc",
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
  };

  const btn = (color = "#2563eb"): React.CSSProperties => ({
    background: color,
    border: "none",
    borderRadius: 6,
    color: "#fff",
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  });

  const tab = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: "6px 6px 0 0",
    border: "none",
    background: active ? "#1a1a22" : "transparent",
    color: active ? "#C9A84C" : "#6b7280",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    borderBottom: active ? "2px solid #C9A84C" : "2px solid transparent",
  });

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: "#e8e4dc", padding: 24, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#C9A84C", marginBottom: 4 }}>
        Binance Live Trading — LIVE-READY-1
      </h1>

      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
        Restricted API key path · No withdrawals · Capital ladder enforced · All gates logged
      </p>

      <div style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {safety && (
            <>
              <Badge label="Live Enabled" ok={safety.liveEnabled} />
              <Badge label="Withdrawals Locked" ok={safety.withdrawalsLocked} />
              <Badge label="Kill Switch Clear" ok={!safety.killSwitchArmed} />
              <Badge label="Dry-Run Mode" ok={safety.dryRunMode} />
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btn(safety?.killSwitchArmed ? "#16a34a" : "#dc2626")} onClick={toggleKillSwitch}>
            {safety?.killSwitchArmed ? "🔓 Clear Kill Switch" : "🛑 Arm Kill Switch"}
          </button>

          <button style={btn(safety?.dryRunMode ? "#ca8a04" : "#2563eb")} onClick={toggleDryRun}>
            {safety?.dryRunMode ? "🟡 Dry-Run ON → Arm Live" : "🔴 LIVE ARMED → Switch to Dry-Run"}
          </button>

          <button style={btn("#374151")} onClick={runReadinessCheck} disabled={readinessLoading}>
            {readinessLoading ? "Checking…" : "Run Readiness Check"}
          </button>
        </div>

        {readiness && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <div style={{ color: readiness.ready ? "#16a34a" : "#dc2626", fontWeight: 700, marginBottom: 6 }}>
              {readiness.ready ? "✓ READY FOR LIVE ORDERS" : "✗ NOT READY"}
            </div>

            {readiness.blockedReasons.map((r, i) => (
              <div key={i} style={{ color: "#dc2626" }}>• {r}</div>
            ))}

            {readiness.ready && (
              <div style={{ color: "#6b7280", marginTop: 4 }}>
                Balance: {readiness.balanceUsdt.toFixed(2)} USDT ≈ ${readiness.balanceAud.toFixed(2)} AUD
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 0, borderBottom: "1px solid #2a2a3a" }}>
        <button style={tab(activeTab === "queue")} onClick={() => setActiveTab("queue")}>Intent Queue</button>
        <button style={tab(activeTab === "order")} onClick={() => setActiveTab("order")}>Place Order</button>
        <button style={tab(activeTab === "audit")} onClick={() => { setActiveTab("audit"); loadAudit(); }}>Audit Log</button>
      </div>

      {activeTab === "queue" && (
        <div style={{ ...card, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Create Intent</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={label}>Symbol</div>
              <input style={input} value={newSymbol} onChange={e => setNewSymbol(e.target.value)} />
            </div>

            <div>
              <div style={label}>Side</div>
              <select style={input} value={newSide} onChange={e => setNewSide(e.target.value as "BUY" | "SELL")}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

            <div>
              <div style={label}>Notional (AUD)</div>
              <input style={input} type="number" value={newNotionalAud} onChange={e => setNewNotionalAud(Number(e.target.value))} />
            </div>

            <div>
              <div style={label}>Equity (AUD)</div>
              <input style={input} type="number" value={newEquityAud} onChange={e => setNewEquityAud(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={label}>Reason</div>
            <input style={input} value={newReason} onChange={e => setNewReason(e.target.value)} />
          </div>

          <button style={btn()} onClick={createIntent}>Create Intent</button>

          {intentMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: intentMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
              {intentMsg}
            </div>
          )}

          {actionMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: actionMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
              {actionMsg}
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>
            All Intents ({intents.length})
          </h3>

          {intents.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>No intents yet.</div>}

          {intents.map((intent) => (
            <div key={intent.id} style={{ border: "1px solid #2a2a3a", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <StatusPill status={intent.status} />

              <div style={{ flex: 1, fontSize: 13, minWidth: 220 }}>
                <strong>{intent.symbol}</strong> {intent.side} — ${intent.notionalAud} AUD
                <span style={{ color: "#6b7280", marginLeft: 8, fontSize: 11 }}>tier: {intent.capitalTier}</span>
                <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                  {intent.id.slice(0, 18)}… · {new Date(intent.createdAt).toLocaleTimeString()}
                </div>
              </div>

              {intent.status === "pending" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btn("#16a34a")} onClick={() => approveIntent(intent.id)}>Approve</button>
                  <button style={btn("#dc2626")} onClick={() => rejectIntent(intent.id)}>Reject</button>
                </div>
              )}

              {intent.status === "approved" && (
                <div style={{ fontSize: 11, color: "#16a34a" }}>Ready → copy ID to Place Order</div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "order" && (
        <div style={{ ...card, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Place Gated Order
            {safety?.dryRunMode && (
              <span style={{ marginLeft: 10, fontSize: 11, background: "#ca8a0422", color: "#ca8a04", padding: "2px 8px", borderRadius: 4, border: "1px solid #ca8a0444" }}>
                DRY-RUN — will NOT send to Binance
              </span>
            )}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={label}>Intent ID (approved)</div>
              <input style={input} value={orderIntentId} onChange={e => setOrderIntentId(e.target.value)} placeholder="paste approved intent id" />
            </div>

            <div>
              <div style={label}>Quantity String</div>
              <input style={input} value={orderQty} onChange={e => setOrderQty(e.target.value)} placeholder="e.g. 0.00012" />
            </div>

            <div>
              <div style={label}>Current Equity (AUD)</div>
              <input style={input} type="number" value={orderEquityAud} onChange={e => setOrderEquityAud(Number(e.target.value))} />
            </div>
          </div>

          <button style={btn(safety?.dryRunMode ? "#ca8a04" : "#dc2626")} onClick={placeOrder}>
            {safety?.dryRunMode ? "🟡 Simulate Order (Dry-Run)" : "🔴 PLACE LIVE ORDER"}
          </button>

          {orderMsg && (
            <div style={{ marginTop: 10, fontSize: 13, color: orderMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
              {orderMsg}
            </div>
          )}

          {orderResult && (
            <pre style={{ marginTop: 12, background: "#111", border: "1px solid #2a2a3a", borderRadius: 8, padding: 12, fontSize: 11, color: "#a09880", overflow: "auto" }}>
              {JSON.stringify(orderResult, null, 2)}
            </pre>
          )}
        </div>
      )}

      {activeTab === "audit" && (
        <div style={{ ...card, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Audit Log ({auditEvents.length})</h3>
            <button style={btn("#374151")} onClick={loadAudit}>Refresh</button>
          </div>

          {auditEvents.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>No audit events yet.</div>}

          {auditEvents.map((ev) => {
            const typeColors: Record<string, string> = {
              ORDER_GATE_BLOCK: "#dc2626",
              ORDER_ERROR: "#dc2626",
              ORDER_REJECT: "#dc2626",
              KILL_SWITCH_ARMED: "#dc2626",
              DAILY_LOSS_STOP: "#dc2626",
              STREAK_STOP: "#dc2626",
              ORDER_GATE_PASS: "#16a34a",
              ORDER_FILL: "#16a34a",
              INTENT_APPROVED: "#16a34a",
              DRY_RUN_SIMULATED: "#ca8a04",
              INTENT_CREATED: "#2563eb",
              READINESS_CHECK: "#6b7280",
            };
            const color = typeColors[ev.type] || "#6b7280";

            return (
              <div key={ev.id} style={{ borderBottom: "1px solid #2a2a3a", padding: "8px 0", fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color, fontWeight: 700, minWidth: 200, fontSize: 11 }}>{ev.type}</span>
                <span style={{ color: "#6b7280", minWidth: 80 }}>{new Date(ev.ts).toLocaleTimeString()}</span>
                <span style={{ color: "#a09880" }}>{ev.reason}</span>
                {ev.symbol && <span style={{ color: "#6b7280" }}>{ev.symbol}</span>}
                {ev.notionalAud && <span style={{ color: "#6b7280" }}>${ev.notionalAud} AUD</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
