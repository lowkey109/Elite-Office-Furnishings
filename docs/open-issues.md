# Open Issues — The Corporate Desk Platform

**Last Updated:** March 2026

---

## Active Issues

### P2 — Partner Dashboard: No Traditional Auth
**Status:** By design (documented), monitoring recommended  
**Detail:** Partners access their dashboard via email lookup only — no password required. Anyone with a partner's email address can view their dashboard.  
**Risk:** Low — dashboard shows non-sensitive data (opportunity status, commission estimates). No PII beyond what the partner submitted.  
**Future Fix:** Add email-based magic link (OTP) or standard password auth. The email-lookup pattern is acceptable for MVP.

---

### P2 — Nexora Loop State Reset on Server Restart
**Status:** Documented — mitigated by pg-boss  
**Detail:** In-memory loop toggle resets on restart. pg-boss NEXORA_LOOP queue continues running every 30 minutes independently.  
**Future Fix:** Persist loop config to DB, restore on startup. See `docs/nexora-loop-open-issues.md`.

---

### P3 — No Email Notification on Referral Submission
**Status:** Not implemented  
**Detail:** When a referral is submitted via `/submit-deal`, no email is sent to the admin or the partner. Referrals sit in the DB until the admin checks the dashboard.  
**Future Fix:** On `POST /api/partners/referrals`, send email via SMTP to `sales@thecorporatedesk.com.au` with the referral summary.

---

### P3 — Agreement/Document System Incomplete
**Status:** Schema exists, routes missing  
**Detail:** `partnerDocuments` table exists. `POST /api/partners/:id/agreement/send` route exists in schema design but was not built (stub only).  
**Future Fix:** Build agreement generation (PDF template), email delivery, and signature tracking.

---

### P3 — Partner Commission Payout History Not Shown in Admin
**Status:** Partial  
**Detail:** Commissions tab in AdminPartners.tsx shows commission records. Clicking "Mark Paid" calls `POST /api/referrals/:id/mark-paid`. The new `POST /api/referrals/:id/commission/pay` route is also available for more granular payment tracking with payment reference numbers.  
**Future Fix:** Unify both endpoints and expose payment reference field in the admin UI.

---

### P3 — No Automatic AI Scoring on Referral Submission
**Status:** Optional — manual trigger available  
**Detail:** `autoScoreOnSubmit` is a configurable setting in `partnerSettings`. Default behaviour is manual trigger via admin. Auto-scoring on submit requires a background job to be wired.  
**Future Fix:** On submit, push to a `referral.score` pg-boss queue that calls `partnerReferralAI.scoreReferral()`.

---

### P3 — Trade Portal Not Linked from Main Navigation
**Status:** Low priority  
**Detail:** `/trade-customers-portal` is accessible from footer ("Trade & Project Procurement") and from `/partners` page referral section. It is NOT in the main header nav.  
**Decision:** Not added to header nav — header is already at capacity. Footer link + contextual links are sufficient.

---

### P4 — Run History Pagination
**Status:** Low priority  
**Detail:** `GET /api/nexora/history` returns last 50 runs (hardcoded). Adequate for current volume.  
**Future Fix:** Add cursor-based pagination when run volume exceeds 200.

---

## Resolved Issues

| Issue | Resolution | Date |
|-------|-----------|------|
| `serial is not defined` crash | Added `serial` to drizzle-orm imports | Mar 2026 |
| Express route ordering — `/admin/partners/settings` returning 404 | Moved specific routes before `/:id` wildcard | Mar 2026 |
| `commission/pay` endpoint missing | Added `POST /api/referrals/:id/commission/pay` | Mar 2026 |
| Trade portal page missing | Created `TradeCustomersPortal.tsx` | Mar 2026 |
| PartnerDashboard using old aesthetic | Upgraded to dark gold premium design | Mar 2026 |
| Footer missing trade portal link | Added "Trade & Project Procurement" to footer | Mar 2026 |
| Duplicate admin partner routes | Removed duplicate blocks at lines 4849–4926 | Mar 2026 |
| EADDRINUSE port conflict | Restarted workflow to clear process | Mar 2026 |
