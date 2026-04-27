import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");

type StoreRow = {
  store_key: string;
  data: any;
  created_at?: string;
  updated_at?: string;
};

let poolPromise: Promise<any> | null = null;

function dynamicImport(moduleName: string): Promise<any> {
  const importer = new Function("moduleName", "return import(moduleName)");
  return importer(moduleName);
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!poolPromise) {
    poolPromise = dynamicImport("pg").then(({ Pool }) => {
      return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : undefined,
      });
    });
  }

  return poolPromise;
}

export async function ensureProductionDataStore() {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      configured: false,
      error: "DATABASE_URL is not configured",
    };
  }

  const pool = await getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nexora_runtime_stores (
      store_key TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nexora_runtime_stores_updated_at
    ON nexora_runtime_stores(updated_at DESC);
  `);

  return {
    ok: true,
    configured: true,
    table: "nexora_runtime_stores",
  };
}

export async function getProductionDataStatus() {
  const status: any = {
    ok: true,
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    tableReady: false,
    connected: false,
    stores: [],
  };

  if (!process.env.DATABASE_URL) {
    status.message = "DATABASE_URL is not configured. Local runtime files are still the active fallback.";
    return status;
  }

  try {
    await ensureProductionDataStore();
    const pool = await getPool();

    const result = await pool.query(`
      SELECT
        store_key,
        jsonb_typeof(data) AS data_type,
        pg_column_size(data) AS size_bytes,
        created_at,
        updated_at
      FROM nexora_runtime_stores
      ORDER BY updated_at DESC
      LIMIT 100;
    `);

    status.connected = true;
    status.tableReady = true;
    status.stores = result.rows;

    return status;
  } catch (error: any) {
    status.ok = false;
    status.connected = false;
    status.error = error?.message || String(error);
    return status;
  }
}

function keyFromFileName(fileName: string) {
  return fileName
    .replace(/\.jsonl$/i, "")
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function readLocalRuntimeFile(fileName: string) {
  const filePath = path.join(DATA_DIR, fileName);
  const raw = await fs.readFile(filePath, "utf8");

  if (fileName.endsWith(".jsonl")) {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      type: "jsonl",
      fileName,
      lines,
    };
  }

  return JSON.parse(raw);
}

export async function upsertRuntimeStore(storeKey: string, data: any) {
  await ensureProductionDataStore();

  const pool = await getPool();

  await pool.query(
    `
    INSERT INTO nexora_runtime_stores (store_key, data, created_at, updated_at)
    VALUES ($1, $2::jsonb, NOW(), NOW())
    ON CONFLICT (store_key)
    DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = NOW();
    `,
    [storeKey, JSON.stringify(data ?? {})],
  );

  return {
    ok: true,
    storeKey,
  };
}

export async function getRuntimeStore(storeKey: string, fallback: any = {}) {
  if (!process.env.DATABASE_URL) {
    return fallback;
  }

  await ensureProductionDataStore();

  const pool = await getPool();

  const result = await pool.query(
    "SELECT data FROM nexora_runtime_stores WHERE store_key = $1 LIMIT 1",
    [storeKey],
  );

  return result.rows?.[0]?.data ?? fallback;
}

export async function listRuntimeStores() {
  await ensureProductionDataStore();

  const pool = await getPool();

  const result = await pool.query(`
    SELECT
      store_key,
      data,
      created_at,
      updated_at
    FROM nexora_runtime_stores
    ORDER BY updated_at DESC;
  `);

  return {
    ok: true,
    count: result.rows.length,
    stores: result.rows,
  };
}

export async function migrateLocalRuntimeDataToPostgres() {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      configured: false,
      error: "DATABASE_URL is not configured",
    };
  }

  await ensureProductionDataStore();

  let files: string[] = [];

  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    return {
      ok: true,
      configured: true,
      migrated: 0,
      files: [],
      message: ".nexora-data directory does not exist yet.",
    };
  }

  const candidates = files.filter((fileName) => fileName.endsWith(".json") || fileName.endsWith(".jsonl"));
  const migrated: any[] = [];
  const failed: any[] = [];

  for (const fileName of candidates) {
    const storeKey = keyFromFileName(fileName);

    try {
      const data = await readLocalRuntimeFile(fileName);
      await upsertRuntimeStore(storeKey, data);

      migrated.push({
        fileName,
        storeKey,
      });
    } catch (error: any) {
      failed.push({
        fileName,
        storeKey,
        error: error?.message || String(error),
      });
    }
  }

  return {
    ok: failed.length === 0,
    configured: true,
    migrated: migrated.length,
    failed: failed.length,
    migratedFiles: migrated,
    failedFiles: failed,
    message: "Local runtime files were copied into Postgres. Local files were not deleted.",
  };
}

export async function readRuntimeStoreWithLocalFallback(storeKey: string, localFileName: string, fallback: any) {
  if (process.env.DATABASE_URL && process.env.NEXORA_USE_POSTGRES_RUNTIME === "true") {
    const data = await getRuntimeStore(storeKey, null);

    if (data !== null && data !== undefined) {
      return data;
    }
  }

  try {
    return await readLocalRuntimeFile(localFileName);
  } catch {
    return fallback;
  }
}

export async function writeRuntimeStoreWithLocalMirror(storeKey: string, localFileName: string, data: any) {
  if (process.env.DATABASE_URL) {
    await upsertRuntimeStore(storeKey, data);
  }

  if (process.env.NEXORA_DISABLE_LOCAL_RUNTIME_WRITES !== "true") {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, localFileName), JSON.stringify(data, null, 2), "utf8");
  }

  return {
    ok: true,
    storeKey,
    mirroredLocal: process.env.NEXORA_DISABLE_LOCAL_RUNTIME_WRITES !== "true",
    postgres: Boolean(process.env.DATABASE_URL),
  };
}
