import React, { useState } from "react";
import { ADMIN_EMAIL, serverLogin, serverLogout } from "@/lib/adminAuth";

type AdminAuthGateProps = {
  children?: React.ReactNode;
};

function isAuthed() {
  try {
    return (
      localStorage.getItem("tcd_admin_auth") === "true" ||
      localStorage.getItem("admin-authenticated") === "true" ||
      sessionStorage.getItem("tcd_admin_auth") === "true" ||
      sessionStorage.getItem("admin-authenticated") === "true"
    );
  } catch {
    return false;
  }
}

function setAuthed() {
  localStorage.setItem("tcd_admin_auth", "true");
  localStorage.setItem("admin-authenticated", "true");
  sessionStorage.setItem("tcd_admin_auth", "true");
  sessionStorage.setItem("admin-authenticated", "true");
}

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setError("");

    const ok = await serverLogin(email, password);

    setBusy(false);

    if (!ok) {
      setError("Incorrect credentials. Please try again.");
      return;
    }

    setAuthed();
    window.location.reload();
  }

  async function handleLogout() {
    await serverLogout();
    window.location.reload();
  }

  if (isAuthed()) {
    if (children) return <>{children}</>;

    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07090d", color: "#fff" }}>
        <section style={{ textAlign: "center" }}>
          <h1>Admin authenticated</h1>
          <p>You are signed in.</p>
          <a href="/admin" style={{ color: "#e2b72f" }}>Open Admin Dashboard</a>
          <br />
          <button onClick={handleLogout} style={{ marginTop: 16 }}>Logout</button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07090d", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
      <section style={{ width: 390, maxWidth: "92vw", border: "1px solid #2a2f3a", borderRadius: 16, padding: 24, background: "#11151d" }}>
        <h1 style={{ marginTop: 0, textAlign: "center", fontFamily: "serif", letterSpacing: "0.08em" }}>THE CORPORATE<br />DESK</h1>
        <h2 style={{ textAlign: "center", marginBottom: 4 }}>Admin Dashboard</h2>
        <p style={{ textAlign: "center", color: "#9da5b4", marginTop: 0 }}>Authorised access only</p>

        <label style={{ display: "block", marginTop: 18, color: "#b6bdc8" }}>Admin Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #333a47" }}
        />

        <label style={{ display: "block", marginTop: 14, color: "#b6bdc8" }}>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #6b2d36", background: "#151922", color: "#fff" }}
        />

        {error && <p style={{ color: "#ff6b7a", fontSize: 13 }}>{error}</p>}

        <button
          onClick={handleLogin}
          disabled={busy}
          style={{ width: "100%", marginTop: 18, padding: 13, borderRadius: 6, border: 0, background: "#e2b72f", color: "#101010", fontWeight: 800 }}
        >
          {busy ? "Checking..." : "Access Dashboard"}
        </button>
      </section>
    </main>
  );
}

export default AdminAuthGate;
