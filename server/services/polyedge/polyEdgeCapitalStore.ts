import fs from "fs/promises";
import path from "path";

type CapitalLedgerEntry = {
  id: string;
  type: "real" | "paper";
  amount: number;
  note: string;
  createdAt: string;
};

type CapitalState = {
  realMoneyBalance: number;
  paperMoneyBalance: number;
  ledger: CapitalLedgerEntry[];
  updatedAt: string;
};

const STORE_FILE = path.resolve(process.cwd(), ".data/polyedge/capital-store.json");

const DEFAULT_STATE: CapitalState = {
  realMoneyBalance: 0,
  paperMoneyBalance: 100000,
  ledger: [],
  updatedAt: new Date().toISOString(),
};

function cleanAmount(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("Amount must be a valid number.");
  if (n <= 0) throw new Error("Amount must be greater than zero.");
  if (n > 1000000000) throw new Error("Amount is too large.");
  return Math.round(n * 100) / 100;
}

async function ensureDir() {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
}

export async function getPolyEdgeCapitalState(): Promise<CapitalState> {
  await ensureDir();

  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      realMoneyBalance: Number(parsed.realMoneyBalance || 0),
      paperMoneyBalance: Number(parsed.paperMoneyBalance || 0),
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger.slice(0, 100) : [],
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    return DEFAULT_STATE;
  }
}

export async function addPolyEdgeCapital(params: {
  type: "real" | "paper";
  amount: unknown;
  note?: string;
}) {
  const type = params.type;
  if (type !== "real" && type !== "paper") {
    throw new Error("Capital type must be real or paper.");
  }

  const amount = cleanAmount(params.amount);
  const state = await getPolyEdgeCapitalState();

  const entry: CapitalLedgerEntry = {
    id: `poly-cap-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    amount,
    note: String(params.note || "").slice(0, 160),
    createdAt: new Date().toISOString(),
  };

  if (type === "real") {
    state.realMoneyBalance = Math.round((state.realMoneyBalance + amount) * 100) / 100;
  } else {
    state.paperMoneyBalance = Math.round((state.paperMoneyBalance + amount) * 100) / 100;
  }

  state.ledger = [entry, ...state.ledger].slice(0, 100);
  state.updatedAt = new Date().toISOString();

  await ensureDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(state, null, 2));

  return {
    ok: true,
    paperOnlyTrading: true,
    liveTradingAffected: false,
    message:
      type === "real"
        ? "Real-money balance recorded for tracking only. No funds moved."
        : "Paper-money balance added for simulation and learning.",
    state,
  };
}

export async function resetPolyEdgePaperCapital(amount: unknown) {
  const value = cleanAmount(amount);
  const state = await getPolyEdgeCapitalState();

  const entry: CapitalLedgerEntry = {
    id: `poly-cap-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "paper",
    amount: value,
    note: "Paper capital reset",
    createdAt: new Date().toISOString(),
  };

  state.paperMoneyBalance = value;
  state.ledger = [entry, ...state.ledger].slice(0, 100);
  state.updatedAt = new Date().toISOString();

  await ensureDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(state, null, 2));

  return {
    ok: true,
    paperOnlyTrading: true,
    liveTradingAffected: false,
    message: "Paper-money balance reset for simulation and learning.",
    state,
  };
}
