# Bank Provider Plan Ready

## Purpose

Prepare safe read-only bank/provider integration.

## Rules

- No raw card numbers
- No CVV
- No bank passwords
- No automatic transfers
- Provider metadata only
- Human approval required
- External provider required

## Routes

- /api/nexora/bank-provider-plan/status
- /api/nexora/bank-provider-plan/checklist
- /api/nexora/bank-provider-plan/readiness
