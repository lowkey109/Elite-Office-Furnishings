import {
  createPaperTrade,
  closePaperTrade,
  listPaperTrades,
} from "./nexoraCoinbasePaperLedger";

let running = false;
let timer: NodeJS.Timeout | null = null;

const PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomProduct() {
  return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

function maybeOpenTrade() {
  const side = Math.random() > 0.5 ? "BUY" : "SELL";

  createPaperTrade({
    productId: randomProduct(),
    side,
    quantity: 0.0001,
    entryPrice: rand(50000, 120000),
    strategy: "nexora_autopilot_v1",
  });
}

function maybeCloseTrade() {
  const open = listPaperTrades(100)
    .filter((t) => t.status === "OPEN");

  if (!open.length) {
    return;
  }

  const trade =
    open[Math.floor(Math.random() * open.length)];

  closePaperTrade(
    trade.id,
    rand(50000, 120000)
  );
}

export function startCoinbasePaperAutopilot() {
  if (running) {
    return {
      ok: true,
      alreadyRunning: true,
    };
  }

  running = true;

  timer = setInterval(() => {
    try {
      if (Math.random() > 0.45) {
        maybeOpenTrade();
      }

      if (Math.random() > 0.55) {
        maybeCloseTrade();
      }
    } catch {}
  }, 15000);

  return {
    ok: true,
    started: true,
  };
}

export function stopCoinbasePaperAutopilot() {
  running = false;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  return {
    ok: true,
    stopped: true,
  };
}

export function coinbasePaperAutopilotState() {
  return {
    running,
  };
}
