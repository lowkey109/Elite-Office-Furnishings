export const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";

export async function serverLogin(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) return false;
    return Boolean(data?.ok || data?.authenticated);
  } catch {
    return false;
  }
}

export function validateAdminEmail(email: string): boolean {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function validateAdminLogin(_email: string, _password: string): boolean {
  return false;
}

export async function serverLogout(): Promise<boolean> {
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore network/logout errors; local client state can still clear.
  }

  try {
    localStorage.removeItem("tcd_admin_auth");
    localStorage.removeItem("admin-authenticated");
    sessionStorage.removeItem("tcd_admin_auth");
    sessionStorage.removeItem("admin-authenticated");
  } catch {
    // Ignore storage errors.
  }

  return true;
}
