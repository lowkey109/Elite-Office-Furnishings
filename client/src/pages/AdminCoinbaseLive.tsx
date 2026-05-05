import { useEffect, useState } from "react";

const API = (p: string) => p;

export default function AdminCoinbaseLive() {
  const [status, setStatus] = useState<any>(null);
  const [intents, setIntents] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [paperStats, setPaperStats] = useState<any>(null);
  const [paperTrades, setPaperTrades] = useState<any[]>([]);
  const [autopilotState, setAutopilotState] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const [productId, setProductId] = useState("BTC-USD");
  const [side, setSide] = useState("BUY");
  const [notionalAud, setNotionalAud] = useState(1);
  const [equityAud, setEquityAud] = useState(50);
  const [intentId, setIntentId] = useState("");
  const [quantityStr, setQuantityStr] = useState("0.0001");

  async function load() {
    const s = await fetch(API("/api/nexora/coinbase/live-readiness/status")).then(r => r.json()).catch(() => null);
    const i = await fetch(API("/api/nexora/coinbase/live/intents")).then(r => r.json()).catch(() => null);
    const a = await fetch(API("/api/nexora/coinbase/live/audit")).then(r => r.json()).catch(() => null);
    setStatus(s);
    setIntents(i?.intents || []);
    setAudit(a?.events || []);

    const ps = await fetch(API("/api/nexora/coinbase/paper/stats"))
      .then(r => r.json())
      .catch(() => null);

    const pt = await fetch(API("/api/nexora/coinbase/paper/trades"))
      .then(r => r.json())
      .catch(() => null);

    setPaperStats(ps?.stats || null);
    setPaperTrades(pt?.trades || []);

    const ap = await fetch(API("/api/nexora/coinbase/paper/autopilot"))
      .then(r => r.json())
      .catch(() => null);

    setAutopilotState(ap?.state || null);
  }

  useEffect(() => {
    load();
  }, []);

  async function createIntent() {
    const r = await fetch(API("/api/nexora/coinbase/live/intents/create"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, side, notionalAud, equityAud, reason: "admin_coinbase_live_ui" }),
    });
    const d = await r.json();
    setMsg(d.ok ? `Created intent: ${d.intent.id}` : `Failed: ${d.error || d.reason}`);
    await load();
  }

  async function approve(id: string) {
    const r = await fetch(API(`/api/nexora/coinbase/live/intents/${id}/approve`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "admin_ui_approved" }),
    });
    const d = await r.json();
    setMsg(d.ok ? `Approved: ${id}` : `Failed: ${d.error || d.reason}`);
    await load();
  }

  async function placeOrder() {
    const r = await fetch(API("/api/nexora/coinbase/live/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId, productId, side, quantityStr, equityAud }),
    });
    const d = await r.json();
    setMsg(JSON.stringify(d));
    await load();
  }

  const card = { background: "#111827", border: "1px solid #374151", borderRadius: 10, padding: 16, marginBottom: 16 };
  const input = { background: "#020617", color: "#e5e7eb", border: "1px solid #374151", borderRadius: 6, padding: 8, width: "100%" };
  const btn = { background: "#2563eb", color: "white", border: 0, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontWeight: 700 };

  return (
    <div style={{ padding: 24, color: "#e5e7eb", maxWidth: 1000 }}>
      <h1 style={{ color: "#C9A84C" }}>Coinbase Live — COINBASE-LIVE-1</h1>

      <div style={card}>
        <h3>Safety</h3>
        <pre>{JSON.stringify(status?.safety || {}, null, 2)}</pre>
      </div>

      <div style={card}>
        <h3>Create Intent</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <input style={input} value={productId} onChange={e => setProductId(e.target.value)} />
          <select style={input} value={side} onChange={e => setSide(e.target.value)}>
            <option>BUY</option>
            <option>SELL</option>
          </select>
          <input style={input} type="number" value={notionalAud} onChange={e => setNotionalAud(Number(e.target.value))} />
          <input style={input} type="number" value={equityAud} onChange={e => setEquityAud(Number(e.target.value))} />
        </div>
        <br />
        <button style={btn} onClick={createIntent}>Create Intent</button>
      </div>

      <div style={card}>
        <h3>Intents</h3>
        {intents.map((i) => (
          <div key={i.id} style={{ borderBottom: "1px solid #374151", padding: 8 }}>
            <b>{i.productId}</b> {i.side} ${i.notionalAud} AUD — {i.status}
            <br />
            <small>{i.id}</small>
            {i.status === "pending" && <button style={{ ...btn, marginLeft: 10 }} onClick={() => approve(i.id)}>Approve</button>}
          </div>
        ))}
      </div>

      <div style={card}>
        <h3>Place Dry-Run Order</h3>
        <input style={input} placeholder="approved intent id" value={intentId} onChange={e => setIntentId(e.target.value)} />
        <br /><br />
        <input style={input} placeholder="quantity e.g. 0.0001" value={quantityStr} onChange={e => setQuantityStr(e.target.value)} />
        <br /><br />
        <button style={btn} onClick={placeOrder}>Place Order</button>
      </div>

      {msg && <div style={card}><pre>{msg}</pre></div>}



      <div style={card}>
        <h3>Autopilot</h3>

        <pre>{JSON.stringify(autopilotState || {}, null, 2)}</pre>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={btn}
            onClick={async () => {
              await fetch(API("/api/nexora/coinbase/paper/autopilot/start"), {
                method: "POST",
              });
              await load();
            }}
          >
            Start Autopilot
          </button>

          <button
            style={{ ...btn, background: "#dc2626" }}
            onClick={async () => {
              await fetch(API("/api/nexora/coinbase/paper/autopilot/stop"), {
                method: "POST",
              });
              await load();
            }}
          >
            Stop Autopilot
          </button>
        </div>
      </div>


      <div style={card}>
        <h3>Paper Trading Stats</h3>

        <pre>{JSON.stringify(paperStats || {}, null, 2)}</pre>

        <h3 style={{ marginTop: 20 }}>Paper Trades</h3>

        <pre>{JSON.stringify(paperTrades.slice(0, 20), null, 2)}</pre>
      </div>

      <div style={card}>
        <h3>Audit</h3>
        <pre>{JSON.stringify(audit.slice(0, 20), null, 2)}</pre>
      </div>
    </div>
  );
}
