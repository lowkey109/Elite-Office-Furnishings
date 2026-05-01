import { runNexoraSimpleBacktest } from "../backtest/nexoraBacktestEngine";

export async function runNexoraWalkForwardValidation(input: {
  symbol: string;
  timeframe: string;
  strategy: string;
  direction: "long" | "short";
}) {
  const train = await runNexoraSimpleBacktest({
    symbol: input.symbol,
    timeframe: input.timeframe,
    strategy: input.strategy,
    direction: input.direction,
    limit: 120,
  });

  const test = await runNexoraSimpleBacktest({
    symbol: input.symbol,
    timeframe: input.timeframe,
    strategy: input.strategy,
    direction: input.direction,
    limit: 200,
  });

  const trainPass = Boolean(train.ok && Number(train.winRate || 0) >= 50 && Number(train.pnl || 0) > 0);
  const testPass = Boolean(test.ok && Number(test.winRate || 0) >= 50 && Number(test.pnl || 0) > 0);

  const status =
    trainPass && testPass ? "passed" :
    trainPass && !testPass ? "overfit_warning" :
    "failed";

  return {
    ok: status === "passed",
    service: "nexora_walk_forward_validator",
    symbol: input.symbol,
    timeframe: input.timeframe,
    strategy: input.strategy,
    direction: input.direction,
    status,
    train: {
      ok: train.ok,
      trades: train.trades,
      winRate: train.winRate,
      pnl: train.pnl,
    },
    test: {
      ok: test.ok,
      trades: test.trades,
      winRate: test.winRate,
      pnl: test.pnl,
    },
    reason:
      status === "passed"
        ? "Setup passed train and test windows."
        : status === "overfit_warning"
          ? "Setup worked in train window but failed broader test window."
          : "Setup failed walk-forward validation.",
    updatedAt: new Date().toISOString(),
  };
}
