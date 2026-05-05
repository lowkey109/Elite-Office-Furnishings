import { useEffect, useState } from "react";

type Summary = {
  ok: boolean;
  wallet?: any;
  performance?: any;
  risk?: any;
  strategyStats?: Record<string, any>;
  recentTrades?: any[];
};

const api = async (path: string, init?: RequestInit) => {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return res.json();
};

export default function AdminBinancePaper() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [intents, setIntents] = useState<any[]>([]);

  async function refresh() {
    const [s, st, live] = await Promise.all([
      api("/api/nexora/binance/paper/summary"),
      api("/api/nexora/binance/status"),
      api("/api/nexora/binance/live/intents"),
    ]);
    setSummary(s);
    setStatus(st);
    setIntents(live?.intents || []);
  }

  async function runStrategy(strategy: string) {
    setBusy(true);
    try {
      const out = await api("/api/nexora/binance/paper/run-strategy", {
        method: "POST",
        body: JSON.stringify({
          symbol: "BTCUSDT",
          interval: "5m",
          limit: 100,
          strategy,
        }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function openPaperTrade() {
    setBusy(true);
    try {
      const out = await api("/api/nexora/binance/paper/open", {
        method: "POST",
        body: JSON.stringify({
          symbol: "BTCUSDT",
          side: "BUY",
          price: 65000,
          notionalUsdt: 100,
          strategy: "manual",
          confidence: 1,
          reason: "manual_admin_test",
        }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function evaluate() {
    setBusy(true);
    try {
      const out = await api("/api/nexora/binance/paper/evaluate", {
        method: "POST",
        body: JSON.stringify({ markPrice: 67600 }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function autoCycle() {
    setBusy(true);
    try {
      const out = await api("/api/nexora/binance/paper/auto-cycle", {
        method: "POST",
        body: JSON.stringify({
          symbol: "BTCUSDT",
          interval: "5m",
          limit: 120,
        }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createLiveIntent() {
    setBusy(true);
    try {
      const out = await api("/api/nexora/binance/live/intent", {
        method: "POST",
        body: JSON.stringify({
          symbol: "BTCUSDT",
          side: "BUY",
          notionalUsdt: 25,
          reason: "admin supervised live intent test",
        }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approveIntent(id: string) {
    setBusy(true);
    try {
      const out = await api(`/api/nexora/binance/live/intent/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ note: "approved from admin UI" }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function rejectIntent(id: string) {
    setBusy(true);
    try {
      const out = await api(`/api/nexora/binance/live/intent/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note: "rejected from admin UI" }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function dryRunExecuteIntent(id: string) {
    setBusy(true);
    try {
      const out = await api(`/api/nexora/binance/live/intent/${id}/execute`, {
        method: "POST",
        body: JSON.stringify({ ownerConfirm: "EXECUTE_APPROVED_BINANCE_INTENT" }),
      });
      setLog(JSON.stringify(out, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const wallet = summary?.wallet || {};
  const perf = summary?.performance || {};
  const risk = summary?.risk || {};
  const trades = summary?.recentTrades || [];

  return (
    <div style={{ minHeight: "100vh", background: "#05070d", color: "#f8fafc", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <p style={{ color: "#38bdf8", letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
          Nexora / Binance Paper Learning
        </p>

        <h1 style={{ fontSize: 36, margin: "8px 0" }}>Binance Paper Trading Engine</h1>
        <p style={{ color: "#94a3b8", maxWidth: 760 }}>
          Binance is wired for market data and paper learning. This page runs fake-money strategy tests and tracks PnL before any real funds are used.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 24 }}>
          <Card title="Paper Equity" value={`$${Number(wallet.equity || wallet.usdt || 0).toFixed(2)}`} />
          <Card title="Paper USDT" value={`$${Number(wallet.usdt || 0).toFixed(2)}`} />
          <Card title="Realised PnL" value={`$${Number(perf.realisedPnl || 0).toFixed(2)}`} />
          <Card title="Win Rate" value={`${Math.round(Number(perf.winRate || 0) * 100)}%`} />
          <Card title="Open Trades" value={String(perf.openTrades || 0)} />
          <Card title="Closed Trades" value={String(perf.closedTrades || 0)} />
        </div>

        <section style={panel}>
          <h2>Controls</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={() => runStrategy("trend_follow")} style={btn}>Run Trend</button>
            <button disabled={busy} onClick={() => runStrategy("breakout")} style={btn}>Run Breakout</button>
            <button disabled={busy} onClick={() => runStrategy("rsi_reversal")} style={btn}>Run RSI</button>
            <button disabled={busy} onClick={() => runStrategy("volatility_guard")} style={btn}>Run Volatility</button>
            <button disabled={busy} onClick={openPaperTrade} style={btn}>Open Test Paper Trade</button>
            <button disabled={busy} onClick={evaluate} style={btn}>Evaluate Stops/Targets</button>
            <button disabled={busy} onClick={autoCycle} style={primaryBtn}>Run Nexora Auto-Cycle</button>
            <button disabled={busy} onClick={createLiveIntent} style={dangerBtn}>Create Live Intent</button>
            <button disabled={busy} onClick={refresh} style={btn}>Refresh</button>
          </div>
        </section>

        <section style={panel}>
          <h2>Risk Rules</h2>
          <pre style={pre}>{JSON.stringify(risk, null, 2)}</pre>
        </section>


        <section style={panel}>
          <h2>Supervised Live Intents</h2>
          <p style={{ color: "#94a3b8" }}>
            This is the live execution readiness lane. Intents can be created, approved, rejected, and dry-run executed. Real execution still depends on env flags.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Created", "Status", "Symbol", "Side", "Est. Notional", "Reason", "Actions"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intents.map((i: any) => (
                  <tr key={i.id}>
                    <td style={td}>{i.createdAt?.slice(0, 19)}</td>
                    <td style={td}>{i.status}</td>
                    <td style={td}>{i.symbol}</td>
                    <td style={td}>{i.side}</td>
                    <td style={td}>${Number(i.estimatedNotional || 0).toFixed(2)}</td>
                    <td style={td}>{i.reason}</td>
                    <td style={td}>
                      <button disabled={busy} onClick={() => approveIntent(i.id)} style={miniBtn}>Approve</button>{" "}
                      <button disabled={busy} onClick={() => rejectIntent(i.id)} style={miniBtn}>Reject</button>{" "}
                      <button disabled={busy} onClick={() => dryRunExecuteIntent(i.id)} style={miniBtn}>Dry Run</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={panel}>
          <h2>Recent Paper Trades</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Time", "Symbol", "Side", "Status", "Entry", "Exit", "Notional", "PnL", "Strategy"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((t: any) => (
                  <tr key={t.id}>
                    <td style={td}>{t.createdAt?.slice(0, 19)}</td>
                    <td style={td}>{t.symbol}</td>
                    <td style={td}>{t.side}</td>
                    <td style={td}>{t.status}</td>
                    <td style={td}>{Number(t.entryPrice || 0).toFixed(2)}</td>
                    <td style={td}>{t.exitPrice ? Number(t.exitPrice).toFixed(2) : "-"}</td>
                    <td style={td}>${Number(t.notional || 0).toFixed(2)}</td>
                    <td style={td}>${Number(t.pnl || 0).toFixed(2)}</td>
                    <td style={td}>{t.strategy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={panel}>
          <h2>Last Action Output</h2>
          <pre style={pre}>{log || JSON.stringify({ status, summary }, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={panel}>
      <div style={{ color: "#94a3b8", fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{value}</div>
    </div>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,.22)",
  borderRadius: 18,
  padding: 18,
  background: "linear-gradient(180deg, rgba(15,23,42,.95), rgba(2,6,23,.95))",
  boxShadow: "0 20px 60px rgba(0,0,0,.35)",
  marginTop: 18,
};

const btn: React.CSSProperties = {
  border: "1px solid rgba(56,189,248,.45)",
  background: "rgba(14,165,233,.14)",
  color: "#e0f2fe",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(34,197,94,.65)",
  background: "linear-gradient(135deg, rgba(34,197,94,.28), rgba(14,165,233,.18))",
  color: "#dcfce7",
};

const dangerBtn: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(251,113,133,.65)",
  background: "rgba(127,29,29,.35)",
  color: "#ffe4e6",
};

const miniBtn: React.CSSProperties = {
  ...btn,
  padding: "6px 9px",
  fontSize: 12,
};

const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "#020617",
  border: "1px solid rgba(148,163,184,.15)",
  borderRadius: 12,
  padding: 14,
  color: "#cbd5e1",
  maxHeight: 420,
  overflow: "auto",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  color: "#93c5fd",
  borderBottom: "1px solid rgba(148,163,184,.18)",
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid rgba(148,163,184,.12)",
  color: "#e2e8f0",
};
