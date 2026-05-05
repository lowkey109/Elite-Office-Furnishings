export const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";

export async function serverLogin(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => null);
    return Boolean(response.ok && (data?.ok || data?.authenticated));
  } catch {
    return false;
  }
}

export async function serverLogout(): Promise<boolean> {
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {}

  try {
    localStorage.removeItem("tcd_admin_auth");
    localStorage.removeItem("admin-authenticated");
    sessionStorage.removeItem("tcd_admin_auth");
    sessionStorage.removeItem("admin-authenticated");
  } catch {}

  return true;
}

export function validateAdminEmail(email: string): boolean {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

/**
 * Legacy compatibility for older admin pages that still call validateAdminLogin().
 * Real authentication is handled by /api/admin/login.
 *
 * This function must not check a hardcoded password.
 * It only allows the legacy page to continue after the operator enters
 * the correct admin email and a non-empty password.
 */
export function validateAdminLogin(email: string, password: string): boolean {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const hasPassword = String(password || "").trim().length > 0;

  if (cleanEmail !== ADMIN_EMAIL || !hasPassword) return false;

  try {
    localStorage.setItem("tcd_admin_auth", "true");
    localStorage.setItem("admin-authenticated", "true");
    sessionStorage.setItem("tcd_admin_auth", "true");
    sessionStorage.setItem("admin-authenticated", "true");
  } catch {}

  return true;
}
