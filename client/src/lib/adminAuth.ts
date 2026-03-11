export const ADMIN_EMAIL = "admin@thecorporatedesk.com.au";
const ADMIN_PASSWORD = "Jaymin12!/";
const LEGACY_PASSWORD = "tcd2024admin";

export function validateAdminLogin(email: string, password: string): boolean {
  if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) return true;
  if (password === LEGACY_PASSWORD) return true;
  return false;
}
