import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraProbeCooldownTable() {
  await db.execute(sql`
    create table if not exists nexora_probe_cooldowns (
      id text primary key,
      symbol text not null,
      strategy text not null,
      direction text not null,
      reason text,
      blocked_until timestamptz not null,
      updated_at timestamptz not null default now()
    );
  `);
}

export async function setNexoraProbeCooldown(input: {
  symbol: string;
  strategy: string;
  direction: string;
  seconds?: number;
  reason?: string;
}) {
  await ensureNexoraProbeCooldownTable();

  const id = [input.symbol, input.strategy, input.direction].join("|");
  const seconds = Math.max(60, Math.min(900, Number(input.seconds || 180)));

  await db.execute(sql`
    insert into nexora_probe_cooldowns (id, symbol, strategy, direction, reason, blocked_until, updated_at)
    values (${id}, ${input.symbol}, ${input.strategy}, ${input.direction}, ${input.reason || "Probe cooldown active."}, now() + (${seconds} || ' seconds')::interval, now())
    on conflict(id)
    do update set reason = excluded.reason, blocked_until = excluded.blocked_until, updated_at = now();
  `);

  return { ok: true, service: "nexora_probe_cooldown", id, seconds, updatedAt: new Date().toISOString() };
}

export async function isNexoraProbeCoolingDown(input: {
  symbol: string;
  strategy: string;
  direction: string;
}) {
  await ensureNexoraProbeCooldownTable();

  const id = [input.symbol, input.strategy, input.direction].join("|");
  const result: any = await db.execute(sql`
    select *
    from nexora_probe_cooldowns
    where id = ${id}
      and blocked_until > now()
    limit 1;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  return rows[0] || null;
}
