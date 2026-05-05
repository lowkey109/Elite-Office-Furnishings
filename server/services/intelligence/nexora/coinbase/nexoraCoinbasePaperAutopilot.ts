import {
  createPaperTrade,
  closePaperTrade,
  listPaperTrades,
} from "./nexoraCoinbasePaperLedger";

import { getCoinbaseSpotPrice } from "./nexoraCoinbaseMarketPriceFeed";

import {
  autoCloseCoinbasePaperTrades,
} from "./nexoraCoinbasePaperCloser";

let running = false;
let timer: NodeJS.Timeout | null = null;

const PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomProduct() {
  return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

async function maybeOpenTrade() {
  const side = Math.random() > 0.5 ? "BUY" : "SELL";
  const productId = randomProduct();
  const price = await getCoinbaseSpotPrice(productId);

  createPaperTrade({
    productId,
    side,
    quantity: 0.001,
    entryPrice: price.price,
    strategy: "nexora_autopilot_v1",
  });
}

async function maybeCloseTrade() {
  const open = listPaperTrades(100)
    .filter((t) => t.status === "OPEN");

  if (!open.length) {
    return;
  }

  const trade =
    open[Math.floor(Math.random() * open.length)];

  const price = await getCoinbaseSpotPrice(trade.productId);

  closePaperTrade(
    trade.id,
    price.price
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
        void void maybeOpenTrade();
      }

      if (Math.random() > 0.55) {
        void void maybeCloseTrade();
      }

      autoCloseCoinbasePaperTrades();

      autoCloseCoinbasePaperTrades();
    } catch {}
  }, 8000);

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
