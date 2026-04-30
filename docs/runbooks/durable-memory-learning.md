# Durable Memory / Learning Runbook

Stage 3E goal: every autonomous action should become learning evidence.

## Required lineage

- decision id
- input evidence
- Nexora score / confidence
- module key
- intent
- action taken
- outcome
- revenue result
- margin result
- time-to-outcome
- learning delta
- threshold adjustment

## Closed loop

Signal
→ Decision
→ Action
→ Outcome
→ Learning
→ Better Decision

## Current implementation

`decisionMemoryService.ts` provides the canonical event shape and scoring foundation.

Next production step is to persist these events into PostgreSQL and wire them into Nexora thresholds.
