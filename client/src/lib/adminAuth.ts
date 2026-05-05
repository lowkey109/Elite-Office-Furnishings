export const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";

// ── Server-side auth functions ─────────────────────────────────────────────
export async function serverLogin(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkAdminAuth(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/auth/check", { credentials: "include" });
    const data = await res.json();
    return data.authenticated === true;
  } catch {
    return false;
  }
}

export async function serverLogout(): Promise<void> {
  try {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
  } catch { /* ignore */ }
  sessionStorage.removeItem("tcd_admin_auth");
  localStorage.removeItem("tcd_admin_auth");
}

// ── Legacy sync stub — kept so existing page code doesn't break ───────────
// Real validation now happens server-side via serverLogin().
// Pages that use the AdminAuthGate wrapper don't need this at all.
export function validateAdminLogin(email: string, password: string): boolean {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const hasPassword = String(password || "").trim().length > 0;

  // Legacy frontend gate only.
  // Real admin authentication is handled by /api/admin/login on the server.
  if (cleanEmail !== ADMIN_EMAIL || !hasPassword) return false;

  try {
    localStorage.setItem("tcd_admin_auth", "true");
    localStorage.setItem("admin-authenticated", "true");
    sessionStorage.setItem("tcd_admin_auth", "true");
    sessionStorage.setItem("admin-authenticated", "true");
  } catch {}

  return true;
}
