# The Corporate Desk — One Nexora Brain System Map

## Core rule

Nexora is the only final decision brain.

Everything else must be one of:

- signal module
- action module
- specialist module
- memory/evidence module
- dashboard/UI
- wrapper into Nexora
- legacy/demo review

No more separate brains.

---

## Main brain to keep

- server/services/intelligence/nexoraOrchestrator.ts
- server/services/intelligence/nexora/nexora-support.ts
- server/services/intelligence/nexora/nexora-types.ts
- server/services/intelligence/nexoraAI.ts

---

## Wrappers into Nexora

These should call Nexora, not act as separate brains:

- server/services/nexoraLoop.ts
- server/services/nexoraAI.ts
- client/src/lib/nexoraEngine.ts

---

## Business signal modules

These collect and score evidence for Nexora:

- Office Move Radar
- Deal Hunter
- Lead Intelligence
- Company Intelligence
- Property Intelligence
- Relocation Intelligence
- Workspace Intelligence
- Supplier Intelligence
- Market Intelligence
- Website / visitor tracking
- Partner Network

---

## Trading / Phantom X module

Phantom X is not its own brain.

It should be:

- market scanner
- wallet monitor
- paper trading executor
- trading evidence collector
- risk evidence reporter
- trading outcome reporter

Nexora makes the final decision.

---

## Action modules

These should only act after Nexora decides:

- outreach
- follow-ups
- WhatsApp
- email
- procurement RFQs
- supplier messages
- proposal generation
- quote actions
- Dev Studio repair actions
- Phantom X paper trading actions

---

## Memory and learning

Central memory should be:

- nexora_decisions
- nexora_outcomes
- nexora_knowledge
- audit_logs

Specialist tables can stay, but they are evidence tables, not separate brains.

---

## Startup rule

Only one system should auto-start:

Nexora.

Everything else should run only when:

- Nexora calls it
- admin manually triggers it
- a controlled job runner triggers it under Nexora rules

---

## Build order

1. Freeze current working UI and code state.
2. Create central Nexora module registry.
3. Create central Nexora action router.
4. Register every system as a Nexora module.
5. Convert Phantom X into a Nexora module.
6. Convert outreach/follow-ups into Nexora action modules.
7. Convert procurement/supplier tools into Nexora action modules.
8. Convert Office Move Radar / Deal Hunter / intelligence scanners into Nexora signal modules.
9. Control startup loops.
10. Add one unified Nexora health dashboard.
11. Run full check/build.
