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

// Disabled on purpose. Password checks must happen on the server.
export function validateAdminLogin(_email: string, _password: string): boolean {
  return false;
}
