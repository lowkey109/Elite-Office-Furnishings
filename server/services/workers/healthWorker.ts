export async function runHealthWorker() {
  return {
    ok: true,
    worker: "health",
    checkedAt: new Date().toISOString(),
  };
}
