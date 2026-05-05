import json
import math
import sys
import datetime
from pathlib import Path

loop = int(sys.argv[1])
out = Path(sys.argv[2])

config_path = Path("data/nexora/local/paper-practice/markets.json")

try:
    cfg = json.loads(config_path.read_text())
    markets = cfg.get("markets", [])
except Exception:
    markets = []

if not markets:
    markets = [{
        "symbol": "BTC / Polymarket",
        "market": "btc_prediction_market",
        "asset": "BTC",
        "basePrice": 77500,
        "strategyBias": "momentum_liquidity"
    }]

market = markets[(loop - 1) % len(markets)]

base_price = float(market.get("basePrice", 77500))
price = base_price + math.sin(loop / 3) * (base_price * 0.0015) + loop * (base_price * 0.00005)
confidence = max(35, min(92, 58 + math.sin(loop / 4) * 22))
paper_pnl = round(math.sin(loop / 2.5) * 4.5 + (1.2 if confidence > 65 else -0.4), 2)
risk_triggered = confidence < 42 or paper_pnl < -4

if risk_triggered:
    result = "risk_triggered_watch"
elif paper_pnl > 1:
    result = "paper_success"
elif paper_pnl < -1:
    result = "paper_loss"
else:
    result = "paper_neutral"

payload = {
    "mode": "paper_learning",
    "source": "nexora_paper_practice_loop",
    "domain": "polymarket",
    "product": "Phantom X / Polymarket",
    "action": "paper_trade_intent_practice",
    "result": result,
    "loop": loop,
    "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
    "market": market.get("market"),
    "symbol": market.get("symbol"),
    "asset": market.get("asset"),
    "strategyBias": market.get("strategyBias"),
    "strategyUsed": "moondev_ranked_strategy_plus_nexora_risk_gate",
    "paperSignal": "PAPER_LONG_YES" if confidence >= 60 else "PAPER_HOLD",
    "side": "YES",
    "confidence": round(confidence, 2),
    "pnl": paper_pnl,
    "riskTriggered": risk_triggered,
    "metrics": {
        "paperPnl": paper_pnl,
        "confidence": round(confidence, 2),
        "referencePrice": round(price, 4),
        "loop": loop,
        "asset": market.get("asset")
    },
    "maxStakeUsd": 0,
    "liveTrading": False,
    "paperOnly": True,
    "humanApproved": True,
    "humanApprovalRequired": True,
    "externalSignerRequired": True,
    "privateKeysInsideNexora": False,
    "walletSigningInsideNexora": False
}

out.write_text(json.dumps(payload, separators=(",", ":")))
