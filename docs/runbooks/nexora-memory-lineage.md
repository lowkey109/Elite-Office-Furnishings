# Nexora Durable Memory / Decision Lineage

Stage 3E adds the durable lineage structure for Nexora decisions.

## Captured Fields

- decision id
- correlation id
- module key
- intent
- policy class
- gate decision
- action taken
- related entity
- revenue impact
- margin impact
- outcome
- evidence JSON
- learning update JSON

## Purpose

This supports the closed loop:

Signal → Decision → Action → Outcome → Learning → Better Decision

## Table

The helper creates `nexora_decision_lineage` if it does not already exist.

## Safe Behavior

If the database write fails, it logs a fallback event and does not break the business flow.
