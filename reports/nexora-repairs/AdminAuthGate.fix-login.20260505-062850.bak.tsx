export default function AdminPolyEdgeAetherforge() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#02060b",
        color: "#dffaff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #12364a",
          background: "#07131d",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: "0.12em", color: "#80f7ff", fontWeight: 800 }}>
            NEXORA POLYEDGE LIVE
          </div>
          <div style={{ fontSize: 12, color: "#7aa9b7" }}>
            MoonDev strategy brain · paper trader · learning memory · real-money locked
          </div>
        </div>
        <a
          href="/nexora/operator/poly-edge"
          style={{
            color: "#02060b",
            background: "#77ffae",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Open Fixed Dashboard
        </a>
      </div>

      <iframe
        title="Nexora PolyEdge Fixed Dashboard"
        src="/nexora/operator/poly-edge"
        style={{
          width: "100%",
          height: "calc(100vh - 56px)",
          border: 0,
          display: "block",
          background: "#02060b",
        }}
      />
    </main>
  );
}
