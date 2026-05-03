import { queueNexoraTask, recordNexoraHeartbeat } from "./nexoraAutonomyFoundation";
import { runNexoraSupervisorCycle } from "./nexoraAutonomySupervisor";

type Schedule = {
  id: string;
  name: string;
  worker: string;
  area: "office" | "trading" | "learning" | "safety" | "core";
  action: string;
  everyMinutes: number;
  enabled: boolean;
  risk: "safe" | "medium" | "high";
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
};

const schedules: Schedule[] = [];

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function seedDefaultSchedules() {
  if (schedules.length > 0) return;

  schedules.push(
    {
      id: makeId("schedule"),
      name: "Office lead health check",
      worker: "office_receptionist",
      area: "office",
      action: "check_new_leads_and_qualify",
      everyMinutes: 15,
      enabled: true,
      risk: "safe",
      lastRunAt: null,
      runCount: 0,
      createdAt: now(),
    },
    {
      id: makeId("schedule"),
      name: "Paper trading scanner check",
      worker: "prediction_scanner",
      area: "trading",
      action: "memory_only_prediction_scan",
      everyMinutes: 30,
      enabled: true,
      risk: "safe",
      lastRunAt: null,
      runCount: 0,
      createdAt: now(),
    },
    {
      id: makeId("schedule"),
      name: "DB health gate check",
      worker: "db_health_gate",
      area: "safety",
      action: "check_db_recovery_status",
      everyMinutes: 10,
      enabled: true,
      risk: "safe",
      lastRunAt: null,
      runCount: 0,
      createdAt: now(),
    },
    {
      id: makeId("schedule"),
      name: "Supervisor cycle",
      worker: "nexora_autonomy_supervisor",
      area: "core",
      action: "run_supervisor_cycle",
      everyMinutes: 60,
      enabled: true,
      risk: "safe",
      lastRunAt: null,
      runCount: 0,
      createdAt: now(),
    }
  );
}

export function getNexoraSchedules() {
  seedDefaultSchedules();

  return {
    ok: true,
    service: "nexora_scheduler_control",
    nexoraBrain: true,
    count: schedules.length,
    schedules,
    updatedAt: now(),
  };
}

export function updateNexoraSchedule(input: any = {}) {
  seedDefaultSchedules();

  const id = String(input.id || "");
  const schedule = schedules.find((s) => s.id === id || s.name === input.name);

  if (!schedule) {
    return {
      ok: false,
      service: "nexora_scheduler_control",
      error: "Schedule not found.",
      schedules,
      updatedAt: now(),
    };
  }

  if (typeof input.enabled === "boolean") schedule.enabled = input.enabled;
  if (Number.isFinite(Number(input.everyMinutes))) schedule.everyMinutes = Math.max(1, Number(input.everyMinutes));

  return {
    ok: true,
    service: "nexora_scheduler_control",
    updated: schedule,
    updatedAt: now(),
  };
}

export function runNexoraScheduledTick(input: any = {}) {
  seedDefaultSchedules();

  const due = schedules.filter((s) => s.enabled);

  const queued = due.map((schedule) => {
    schedule.lastRunAt = now();
    schedule.runCount += 1;

    if (schedule.worker === "nexora_autonomy_supervisor") {
      return runNexoraSupervisorCycle({ source: "scheduler_control" });
    }

    return queueNexoraTask({
      worker: schedule.worker,
      area: schedule.area,
      action: schedule.action,
      risk: schedule.risk,
      payload: {
        source: "scheduler_control",
        scheduleId: schedule.id,
        manual: input.manual === true,
      },
    });
  });

  recordNexoraHeartbeat({
    worker: "nexora_scheduler_control",
    area: "core",
    status: "alive",
    message: `Scheduler tick processed ${queued.length} enabled schedules.`,
  });

  return {
    ok: true,
    service: "nexora_scheduler_control",
    nexoraBrain: true,
    processedSchedules: due.length,
    results: queued,
    schedules,
    rule: "Scheduler only queues safe/gated work. High-risk schedules must stay disabled or approval-gated.",
    updatedAt: now(),
  };
}

export function createNexoraSchedule(input: any = {}) {
  seedDefaultSchedules();

  const schedule: Schedule = {
    id: makeId("schedule"),
    name: String(input.name || "Custom Nexora schedule"),
    worker: String(input.worker || "unknown_worker"),
    area: input.area || "core",
    action: String(input.action || "custom_action"),
    everyMinutes: Math.max(1, Number(input.everyMinutes || 60)),
    enabled: input.enabled !== false,
    risk: input.risk || "safe",
    lastRunAt: null,
    runCount: 0,
    createdAt: now(),
  };

  schedules.unshift(schedule);

  return {
    ok: true,
    service: "nexora_scheduler_control",
    created: schedule,
    updatedAt: now(),
  };
}
