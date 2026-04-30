import { startNexoraLoop, getNexoraLoopState } from "../nexoraLoop";

/**
 * Central worker registry facade.
 *
 * Durable worker registration currently lives behind startNexoraLoop(), which
 * registers pg-boss workers and schedules repeat jobs. This facade gives the
 * app a single structural entrypoint for controlled workers.
 */
export async function registerControlledWorkers(): Promise<ReturnType<typeof getNexoraLoopState>> {
  startNexoraLoop();
  return getNexoraLoopState();
}

export function getControlledWorkerState() {
  return getNexoraLoopState();
}
