import React, { useState, useEffect } from 'react';

// STYLES FOR 2150 TERMINAL (Using inline styles to guarantee look without relying on specific CSS frameworks)
const styles = {
    container: { backgroundColor: '#050a0f', color: '#00ffff', fontFamily: '"Courier New", Courier, monospace', minHeight: '100vh', padding: '20px', boxSizing: 'border-box' as const },
    header: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #005555', paddingBottom: '10px', marginBottom: '20px' },
    title: { margin: 0, textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#00ffff', textShadow: '0 0 5px #00ffff' },
    statusStrip: { fontSize: '12px', color: '#00aa00' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' },
    panel: { backgroundColor: '#0a1118', border: '1px solid #004444', padding: '15px', borderRadius: '4px', boxShadow: 'inset 0 0 10px rgba(0, 255, 255, 0.05)' },
    panelTitle: { borderBottom: '1px solid #003333', paddingBottom: '5px', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' as const, color: '#00cccc' },
    button: { backgroundColor: '#002222', border: '1px solid #00ffff', color: '#00ffff', padding: '8px 12px', margin: '5px', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase' as const },
    buttonDisabled: { backgroundColor: '#111', border: '1px solid #444', color: '#444', padding: '8px 12px', margin: '5px', cursor: 'not-allowed', fontSize: '12px' },
    dataRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' },
    alertText: { color: '#ffcc00' },
    dangerText: { color: '#ff3333' }
};

export default function PolyEdgeAetherforge() {
    const [data, setData] = useState<any>({});
    const [logs, setLogs] = useState<string[]>(['SYSTEM INITIALIZED...', 'AWAITING TELEMETRY...']);

    const log = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 10));

    const fetchData = async (endpoint: string, key: string) => {
        try {
            log(`FETCHING: ${endpoint}`);
            const res = await fetch(endpoint);
            const json = await res.json();
            setData(prev => ({ ...prev, [key]: json }));
            log(`SUCCESS: ${endpoint}`);
        } catch (err) {
            log(`ERROR: ${endpoint}`);
        }
    };

    const action = async (endpoint: string, method: string = 'POST') => {
        try {
            log(`EXECUTING [${method}]: ${endpoint}`);
            await fetch(endpoint, { method });
            log(`COMPLETED: ${endpoint}`);
        } catch (err) {
            log(`FAILED: ${endpoint}`);
        }
    };

    useEffect(() => {
        fetchData('/api/nexora/poly-paper-summary/latest', 'paperSummary');
        fetchData('/api/nexora/capital-ladder/status', 'capitalLadder');
        fetchData('/api/nexora/poly-edge-fixed/state', 'edgeState');
    }, []);

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>POLY/EDGE Quantum Hyperintelligence Terminal</h1>
                <div style={styles.statusStrip}>
                    SYS: ONLINE | DB: SYNCED | LIVE TRADING: <span style={styles.dangerText}>LOCKED</span>
                </div>
            </header>

            {/* ACTION RIBBON */}
            <div style={styles.panel}>
                <h2 style={styles.panelTitle}>COMMAND CONSOLE</h2>
                <button style={styles.button} onClick={() => action('/api/nexora/paper-practice/start')}>Start Paper Loop</button>
                <button style={styles.button} onClick={() => action('/api/nexora/paper-practice/stop')}>Stop Paper Loop</button>
                <button style={styles.button} onClick={() => fetchData('/api/nexora/ping', 'ping')}>Status Ping</button>
                <button style={styles.button} onClick={() => fetchData('/api/nexora/poly-paper-summary/latest', 'paperSummary')}>Sync Summary</button>
                <button style={styles.button} onClick={() => fetchData('/api/nexora/binance/status', 'binanceStatus')}>Binance Status</button>
                <button style={styles.button} onClick={() => fetchData('/api/nexora/capital-ladder/status', 'capitalLadder')}>Capital Check</button>
                <button style={styles.buttonDisabled} disabled>Live Money Lock</button>
                <button style={styles.buttonDisabled} disabled>Bank Transfer (UNAVAILABLE)</button>
            </div>

            <div style={styles.grid}>
                {/* TRUTHFUL PERFORMANCE PANEL */}
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>PAPER PERFORMANCE LOGIC (REAL DATA ONLY)</h2>
                    <div style={styles.dataRow}><span>Events:</span> <span>{data.paperSummary?.polymarketEvents || 'WAITING FOR REAL DATA'}</span></div>
                    <div style={styles.dataRow}><span>Counted Trades:</span> <span>{data.paperSummary?.countedTrades || 'WAITING FOR REAL DATA'}</span></div>
                    <div style={styles.dataRow}><span>Wins:</span> <span>{data.paperSummary?.wins || 'WAITING FOR REAL DATA'}</span></div>
                    <div style={styles.dataRow}><span>Win Rate:</span> <span>{data.paperSummary?.winRate || 'WAITING FOR REAL DATA'}</span></div>
                    <div style={styles.dataRow}><span>Current Confidence:</span> <span>{data.paperSummary?.displayedConfidence || 'WAITING FOR REAL DATA'}</span></div>
                    <div style={styles.dataRow}><span>Target Reached:</span> <span>{data.paperSummary?.targetReached ? 'TRUE' : 'FALSE'}</span></div>
                </div>

                {/* CAPITAL LADDER PANEL */}
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>RISK FORTRESS & CAPITAL LADDER</h2>
                    <div style={styles.dataRow}><span>Current Paper Equity:</span> <span>${data.capitalLadder?.state?.currentCapital || 'WAITING FOR REAL DATA'} AUD</span></div>
                    <div style={styles.dataRow}><span>Max Allowed Trade:</span> <span>${data.capitalLadder?.maxAllowedTrade || 'WAITING FOR REAL DATA'} AUD</span></div>
                    <div style={styles.dataRow}><span>Martingale Rules:</span> <span style={styles.dangerText}>STRICTLY DISABLED</span></div>
                    <div style={styles.dataRow}><span>Live Execution:</span> <span style={styles.dangerText}>DISABLED</span></div>
                </div>

                {/* BINANCE / MARKET DATA (No Fake Data) */}
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>MULTIVERSE LIQUIDITY DEPTH</h2>
                    <div style={styles.dataRow}><span>Order Book Status:</span> <span style={styles.alertText}>WAITING FOR REAL DATA</span></div>
                    <div style={styles.dataRow}><span>Live Candles:</span> <span style={styles.alertText}>WAITING FOR REAL DATA</span></div>
                    <div style={styles.dataRow}><span>Wallet Flow:</span> <span style={styles.alertText}>WAITING FOR REAL DATA</span></div>
                    <div style={styles.dataRow}><span>Realized PnL:</span> <span style={styles.alertText}>WAITING FOR REAL DATA</span></div>
                </div>

                {/* SYSTEM DECISION STREAM */}
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>DECISION STREAM & ALERTS</h2>
                    {logs.map((l, i) => (
                        <div key={i} style={{...styles.dataRow, color: i === 0 ? '#00ffff' : '#006666'}}>
                            &gt; {l}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* BOTTOM TICKER */}
            <div style={{ marginTop: '20px', borderTop: '1px solid #005555', paddingTop: '10px', fontSize: '11px', textAlign: 'center', opacity: 0.7 }}>
                PRIVATE KEYS: UNLOADED | SIGNING: DISABLED | ENV: PRODUCTION-LOCKED
            </div>
        </div>
    );
}
