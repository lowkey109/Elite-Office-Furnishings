
import type { Express, Request, Response } from "express";
import {
  buildMoonDevStrategyRecords,
  collectClobOrderbookSnapshot,
  discoverPolymarketGammaMarkets,
  getBinanceWsCollectorRuntimeStatus,
  simulatePaperFillFromSnapshot,
} from "../services/intelligence/nexora/polymarket/polymarketBatch2Collectors";

function fail(res: Response, error: unknown): void {
  res.status(502).json({
    ok: false,
    mode: "readonly-paper-only",
    liveTradingEnabled: false,
    privateKeysAllowed: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraPolymarketBatch2Routes(app: Express): void {
  app.get("/api/nexora/polymarket/batch2/status", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      batch: "2/3",
      systems: [
        "moondev-strategy-records",
        "binance-ws-runtime-confirmation",
        "gamma-clob-readonly-market-discovery",
        "clob-orderbook-snapshot-collector",
        "snapshot-paper-fill-simulator",
      ],
      mode: "paper-readonly",
      liveTradingEnabled: false,
      walletSigningEnabled: false,
      privateKeysAllowed: false,
      generatedAt: new Date().toISOString(),
    });
  });

  app.get("/api/nexora/polymarket/batch2/moondev/strategy-records", (_req: Request, res: Response) => {
    res.json(buildMoonDevStrategyRecords());
  });

  app.get("/api/nexora/polymarket/batch2/binance/ws/status", (_req: Request, res: Response) => {
    res.json(getBinanceWsCollectorRuntimeStatus());
  });

  app.get("/api/nexora/polymarket/batch2/gamma/markets", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      res.json(await discoverPolymarketGammaMarkets(limit));
    } catch (error) {
      fail(res, error);
    }
  });

  app.get("/api/nexora/polymarket/batch2/clob/book", async (req: Request, res: Response) => {
    try {
      const tokenId = String(req.query.tokenId ?? "");
      res.json(await collectClobOrderbookSnapshot(tokenId));
    } catch (error) {
      fail(res, error);
    }
  });

  app.get("/api/nexora/polymarket/batch2/paper/fill", async (req: Request, res: Response) => {
    try {
      const tokenId = String(req.query.tokenId ?? "");
      const side = String(req.query.side ?? "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
      const size = Number(req.query.size ?? 10);
      const snapshot = await collectClobOrderbookSnapshot(tokenId);
      res.json({
        snapshot,
        paperFill: simulatePaperFillFromSnapshot(snapshot, side, size),
      });
    } catch (error) {
      fail(res, error);
    }
  });
}
