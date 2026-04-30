# Real Intelligence Replacement Runbook

Stage 3D goal: synthetic/demo evidence must not drive production autonomy.

## Approved production evidence

- company_event
- job_ad
- lease_signal
- building_data
- supplier_quote
- customer_quote_upload
- reply_event
- payment_event
- manual_admin

## Blocked / capped evidence

synthetic_demo is blocked for production autonomy and capped at low confidence.

## Target flow

Real source ingestion
→ evidence normalization
→ confidence scoring
→ Nexora decision
→ action
→ outcome
→ learning
