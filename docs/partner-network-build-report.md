# Partner Referral Network — Build Report

**Project:** The Corporate Desk — Partner Network  
**Build Date:** March 2026  
**Commission Rate:** 7.5% flat (all approved, invoice-confirmed deals)  
**Contact:** Ben Mumford | 0408 407 166 | sales@thecorporatedesk.com.au

---

## What Was Built

A full end-to-end Partner Referral Network integrated into The Corporate Desk platform, operating as both a public-facing acquisition system and an internal partner management tool.

---

## Database Schema

### Extended Tables

**`partners`** — Extended with:
- `abn` — Australian Business Number
- `linkedinUrl` — LinkedIn profile for validation
- `onboardingStatus` — `lead | applying | active | paused | rejected`
- `agreementStatus` — `not_sent | sent | signed | countersigned`
- `referralRate` — Decimal override per partner (default: 0.075)

**`partnerReferrals`** — Extended with full AI enrichment fields:
- `clientCompany`, `contactName`, `contactEmail`, `contactPhone`
- `officeLocation`, `officeSizeSqm`, `staffCount`
- `projectType`, `projectStage`, `estimatedValue`
- `aiFitScore` (0–100), `aiSummary`, `aiNextBestAction`
- `aiRiskFlagsJson`, `aiEnrichmentJson`
- `assignedTo`, `assignedAt`, `wonAt`, `lostAt`

### New Tables

| Table | Purpose |
|-------|---------|
| `partnerReferralEvents` | Audit trail of all referral status changes |
| `partnerCommissions` | Commission records created on deal-won |
| `partnerDocuments` | Agreement document tracking |
| `partnerSettings` | Global partner network configuration |

---

## AI Services

**`server/services/partnerReferralAI.ts`**

- `scoreReferral(referralId)` — GPT-4o scoring:
  - `aiFitScore` (0–100 fit quality)
  - `aiSummary` (2-sentence opportunity brief)
  - `aiNextBestAction` (recommended next step)
  - `aiRiskFlagsJson` (array of risk signals)
  - Full enrichment data in `aiEnrichmentJson`

Uses the Replit AI integration (required pattern: `apiKey: AI_INTEGRATIONS_OPENAI_API_KEY`, `baseURL: AI_INTEGRATIONS_OPENAI_BASE_URL`).

---

## Backend Routes

### Public Routes (no auth)
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/partners/apply` | Public partner application form info |
| `POST` | `/api/partners/apply` | Submit partner application |
| `POST` | `/api/partners/referrals` | Submit a deal referral (no account required) |

### Admin Routes (auth required)
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/partners` | All registered partners |
| `GET` | `/api/admin/partners/referrals` | All referral submissions |
| `GET` | `/api/admin/partners/commissions` | All commission records |
| `GET` | `/api/admin/partners/stats` | Summary stats dashboard |
| `GET` | `/api/admin/partners/settings` | Network configuration |
| `PATCH` | `/api/admin/partners/settings` | Update network configuration |

### Referral Lifecycle Routes (auth required)
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/referrals/:id/score` | Run AI scoring on a referral |
| `POST` | `/api/referrals/:id/status` | Update referral status |
| `POST` | `/api/referrals/:id/mark-won` | Mark deal won + create commission |
| `POST` | `/api/referrals/:id/mark-lost` | Mark deal lost |
| `POST` | `/api/referrals/:id/mark-paid` | Mark commission as paid |
| `GET` | `/api/referrals/:id/commission` | Calculate commission preview |

---

## Frontend Pages

| Route | Component | Access |
|-------|-----------|--------|
| `/partners` | `Partners.tsx` | Public |
| `/submit-deal` | `SubmitDeal.tsx` | Public |
| `/admin/partners` | `AdminPartners.tsx` | Admin |
| `/partner/login` | `PartnerOnboarding.tsx` | Public |
| `/partner/dashboard` | `PartnerDashboard.tsx` | Partner |

### Partners.tsx (`/partners`)
Public recruitment page. Covers:
- Value proposition + commission structure
- Partner type categories (agents, architects, fit-out specialists, etc.)
- Social proof / benefits
- Application CTA → `/partner/login`
- "Have a deal now?" → `/submit-deal`

### SubmitDeal.tsx (`/submit-deal`)
Frictionless deal submission — no account required.
- Client details (company, contact, email, phone)
- Project details (location, sqm, staff count, type, stage, estimated value, notes)
- Referring partner details (optional name/email)
- Success state with referral ID confirmation

### AdminPartners.tsx (`/admin/partners`)
Tabbed admin dashboard:
- **Referrals** — view all submissions, AI score, update status, mark won/lost, create commissions
- **Partners** — view all registered partners with onboarding/agreement status
- **Commissions** — view all commission records, mark as paid
- **Settings** — configure default rate, payout policy, agreement version

---

## Commission Flow

```
Deal submitted → AI scored → Status: reviewing → qualified → quoted
→ Admin marks "Won" (enters deal value) 
→ Commission record created automatically
   (dealValue × referralRate, default 7.5%)
→ Status: pending → invoiced → paid
→ Admin clicks "Mark Paid" → commission.paymentStatus = "paid"
```

---

## Referral Status Lifecycle

```
submitted → reviewing → qualified → quoted → won → paid
                                           ↘ lost
```

Events are logged to `partnerReferralEvents` on every status change.

---

## Configuration

Partner network settings are stored in `partnerSettings` table:
- `defaultReferralRate` — default 0.075 (7.5%)
- `payoutRuleText` — policy text displayed to partners
- `agreementTemplateVersion` — version of the standard agreement
- `autoScoreOnSubmit` — enable/disable auto AI scoring on new submissions
- `requireAbnForApplication` — ABN validation toggle

---

## Testing Checklist

- [ ] Submit deal via `/submit-deal` — verify referral appears in admin
- [ ] Run AI score on referral — verify score, summary, and risk flags appear
- [ ] Mark referral as won — verify commission record created
- [ ] Mark commission as paid — verify status updates
- [ ] Apply as partner via `/partners` → `/partner/login`
- [ ] Update settings in `/admin/partners` Settings tab
