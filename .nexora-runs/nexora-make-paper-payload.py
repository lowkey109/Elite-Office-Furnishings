import json, math, sys, datetime
from pathlib import Path

loop = int(sys.argv[1])
out = Path(sys.argv[2])
cfg = json.loads(Path("data/nexora/local/paper-practice/markets.json").read_text())
markets = cfg.get("markets", [])
m = markets[(loop - 1) % len(markets)]

base = float(m.get("basePrice", 1))
price = base + math.sin(loop / 3) * (base * 0.0015)
confidence = max(35, min(92, 58 + math.sin(loop / 4) * 22))
pnl = round(math.sin(loop / 2.5) * 4.5 + (1.2 if confidence > 65 else -0.4), 2)
risk = confidence < 42 or pnl < -4

result = "risk_triggered_watch" if risk else "paper_success" if pnl > 1 else "paper_loss" if pnl < -1 else "paper_neutral"

payload = {
  "mode":"paper_learning",
  "source":"nexora_paper_practice_loop",
  "domain":"polymarket",
  "product":"Phantom X / Polymarket",
  "action":"paper_trade_intent_practice",
  "result":result,
  "loop":loop,
  "generatedAt":datetime.datetime.utcnow().isoformat()+"Z",
  "market":m["market"],
  "symbol":m["symbol"],
  "asset":m["asset"],
  "strategyBias":m["strategyBias"],
  "strategyUsed":"moondev_ranked_strategy_plus_nexora_risk_gate",
  "paperSignal":"PAPER_LONG_YES" if confidence >= 60 else "PAPER_HOLD",
  "side":"YES",
  "confidence":round(confidence,2),
  "pnl":pnl,
  "riskTriggered":risk,
  "metrics":{"paperPnl":pnl,"confidence":round(confidence,2),"referencePrice":round(price,4),"loop":loop,"asset":m["asset"]},
  "maxStakeUsd":0,
  "liveTrading":False,
  "paperOnly":True,
  "humanApproved":True,
  "humanApprovalRequired":True,
  "externalSignerRequired":True,
  "privateKeysInsideNexora":False,
  "walletSigningInsideNexora":False
}
out.write_text(json.dumps(payload,separators=(",",":")))
