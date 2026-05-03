import fs from "fs";
import path from "path";
import {
  captureNexoraFallbackEvent,
  safeCreateNexoraTaskOrFallback,
} from "../resilience/nexoraResilienceCore";

const ROOT = path.resolve(process.cwd(), "data/nexora/filebus");
const DIRS = {
  inbox: path.join(ROOT, "inbox"),
  outbox: path.join(ROOT, "outbox"),
  delayed: path.join(ROOT, "delayed"),
  processed: path.join(ROOT, "processed"),
  dead: path.join(ROOT, "dead"),
};

type BusChannel = keyof typeof DIRS;

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function ensureDirs() {
  fs.mkdirSync(ROOT, { recursive: true });
  for (const dir of Object.values(DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function filePath(channel: BusChannel, itemId: string) {
  return path.join(DIRS[channel], `${safeName(itemId)}.json`);
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJsonAtomic(file: string, value: any) {
  const tmp = `${file}.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function listChannel(channel: BusChannel) {
  ensureDirs();
  return fs.readdirSync(DIRS[channel])
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(DIRS[channel], name))
    .sort();
}

function moveFile(source: string, channel: BusChannel, suffix = "") {
  ensureDirs();
  const base = path.basename(source, ".json");
  const target = path.join(DIRS[channel], `${base}${suffix}.json`);
  fs.renameSync(source, target);
  return target;
}

export function getNexoraFileBusStatus() {
  ensureDirs();

  const counts = Object.fromEntries(
    Object.keys(DIRS).map((key) => [
      key,
      listChannel(key as BusChannel).length,
    ]),
  );

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_file_bus",
    generatedAt: now(),
    root: ROOT,
    counts,
    channels: Object.keys(DIRS),
    safety: {
      dbIndependent: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
    },
  };
}

export function enqueueNexoraFileBusMessage(input: any = {}) {
  ensureDirs();

  const itemId = String(input.id || id("bus"));
  const channel: BusChannel = input.channel === "outbox" ? "outbox" : input.channel === "delayed" ? "delayed" : "inbox";

  const item = {
    ok: true,
    nexoraBrain: true,
    id: itemId,
    channel,
    type: String(input.type || "message"),
    worker: String(input.worker || "nexora_filebus_worker"),
    area: String(input.area || "operations"),
    action: String(input.action || "process_filebus_message"),
    risk: String(input.risk || "safe"),
    priority: Number(input.priority || 50),
    payload: input.payload || {},
    notBefore: input.notBefore || null,
    attempts: 0,
    maxAttempts: Number(input.maxAttempts || 3),
    createdAt: now(),
    updatedAt: now(),
  };

  writeJsonAtomic(filePath(channel, itemId), item);

  return {
    ok: true,
    nexoraBrain: true,
    enqueued: true,
    item,
  };
}

export function scheduleNexoraDelayedJob(input: any = {}) {
  const delayMs = Number(input.delayMs || 60000);
  const notBefore = new Date(Date.now() + delayMs).toISOString();

  return enqueueNexoraFileBusMessage({
    ...input,
    channel: "delayed",
    type: input.type || "delayed_job",
    notBefore,
  });
}

export function getNexoraFileBusMessages(input: any = {}) {
  ensureDirs();

  const channel = String(input.channel || "inbox") as BusChannel;
  const limit = Number(input.limit || 50);

  if (!DIRS[channel]) {
    return {
      ok: false,
      nexoraBrain: true,
      error: `Unknown channel ${channel}`,
      validChannels: Object.keys(DIRS),
    };
  }

  const rows = listChannel(channel)
    .slice(0, limit)
    .map((file) => {
      try {
        return readJson(file);
      } catch (error) {
        return {
          ok: false,
          file,
          corrupted: true,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

  return {
    ok: true,
    nexoraBrain: true,
    channel,
    count: rows.length,
    rows,
  };
}

export async function processNexoraFileBus(input: any = {}) {
  ensureDirs();

  const limit = Number(input.limit || 10);
  const nowDate = new Date();
  const results: any[] = [];

  const delayedFiles = listChannel("delayed");

  for (const file of delayedFiles) {
    try {
      const item = readJson(file);
      if (item.notBefore && new Date(item.notBefore) <= nowDate) {
        const target = moveFile(file, "inbox", "_released");
        results.push({
          id: item.id,
          released: true,
          from: "delayed",
          to: "inbox",
          target,
        });
      }
    } catch (error) {
      const target = moveFile(file, "dead", "_corrupt");
      results.push({
        ok: false,
        file,
        movedTo: target,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const inboxFiles = listChannel("inbox").slice(0, limit);

  for (const file of inboxFiles) {
    try {
      const item = readJson(file);

      item.attempts = Number(item.attempts || 0) + 1;
      item.updatedAt = now();

      const task = await safeCreateNexoraTaskOrFallback({
        worker: item.worker,
        area: item.area,
        action: item.action,
        risk: item.risk,
        priority: item.priority,
        payload: {
          fileBusItem: item,
          processedAt: now(),
        },
        approvalRequired: item.risk === "high" || item.risk === "critical",
        source: "nexora.filebus.processor",
      });

      const outbox = enqueueNexoraFileBusMessage({
        channel: "outbox",
        type: "processed_result",
        worker: "nexora_filebus_processor",
        area: "operations",
        action: "filebus_processed_result",
        risk: "safe",
        priority: item.priority,
        payload: {
          item,
          task,
        },
      });

      const target = moveFile(file, "processed", "_done");

      results.push({
        ok: true,
        id: item.id,
        task,
        outbox,
        movedTo: target,
      });
    } catch (error) {
      let movedTo = null;

      try {
        const item = readJson(file);
        item.attempts = Number(item.attempts || 0) + 1;
        item.lastError = error instanceof Error ? error.message : String(error);
        item.updatedAt = now();

        if (item.attempts >= Number(item.maxAttempts || 3)) {
          writeJsonAtomic(file, item);
          movedTo = moveFile(file, "dead", "_failed");
        } else {
          writeJsonAtomic(file, item);
        }
      } catch {
        movedTo = moveFile(file, "dead", "_corrupt");
      }

      await captureNexoraFallbackEvent({
        type: "filebus_processing_error",
        worker: "nexora_filebus_processor",
        area: "operations",
        action: "filebus_processing_error",
        risk: "safe",
        payload: {
          file,
          movedTo,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      results.push({
        ok: false,
        file,
        movedTo,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_filebus_processor",
    limit,
    processed: results.length,
    results,
    status: getNexoraFileBusStatus(),
  };
}

export function purgeNexoraFileBusChannel(input: any = {}) {
  ensureDirs();

  const channel = String(input.channel || "") as BusChannel;
  const confirm = String(input.confirm || "");

  if (!DIRS[channel]) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Invalid channel.",
      validChannels: Object.keys(DIRS),
    };
  }

  if (confirm !== `purge-${channel}`) {
    return {
      ok: false,
      nexoraBrain: true,
      error: `Confirmation required: purge-${channel}`,
    };
  }

  const files = listChannel(channel);
  for (const file of files) {
    fs.unlinkSync(file);
  }

  return {
    ok: true,
    nexoraBrain: true,
    purged: channel,
    count: files.length,
    status: getNexoraFileBusStatus(),
  };
}
