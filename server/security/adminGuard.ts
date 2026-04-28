import type { Request, Response, NextFunction } from "express";

/**
 * TCD_STAGE_11_CENTRAL_ADMIN_GUARD
 *
 * Central server-side admin guard foundation.
 *
 * Rules:
 * - Dev/local can still use existing session/header flow.
 * - Production should require a real session OR admin token.
 * - This does not delete existing pipeline/outreach/admin routes.
 * - Route groups can migrate to this guard safely one-by-one.
 */
export function isAdminRequest(req: Request): boolean {
  const anyReq = req as any;

  const sessionAdmin =
    anyReq?.session?.adminAuthenticated === true ||
    anyReq?.session?.isAdmin === true;

  const legacyLocalHeader =
    req.headers?.["x-tcd-admin-auth"] === "true" ||
    String(req.headers?.["x-tcd-admin-auth"] || "") === "true";

  const expectedToken =
    process.env.TCD_ADMIN_API_TOKEN ||
    process.env.ADMIN_API_TOKEN ||
    process.env.ADMIN_TOKEN ||
    "";

  const providedToken =
    String(req.headers?.["x-tcd-admin-token"] || "") ||
    String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");

  const tokenAdmin = Boolean(expectedToken && providedToken && providedToken === expectedToken);

  if (process.env.NODE_ENV !== "production") {
    return Boolean(sessionAdmin || legacyLocalHeader || tokenAdmin);
  }

  return Boolean(sessionAdmin || tokenAdmin);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (isAdminRequest(req)) return next();

  return res.status(401).json({
    ok: false,
    error: "Admin authentication required"
  });
}

export function requireAdminJson(req: Request, res: Response): boolean {
  if (isAdminRequest(req)) return true;

  res.status(401).json({
    ok: false,
    error: "Admin authentication required"
  });

  return false;
}
