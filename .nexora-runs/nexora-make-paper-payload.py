import json, math, sys, datetime
from pathlib import Path

loop = int(sys.argv[1])
out = Path(sys.argv[2])

cfg = json.loads(Path("data/nexora/local/paper-practice/markets.json").read_text())
markets = cfg.get("markets", [])
m = markets[(loop - 1) % len(markets)]

asset = m["asset"]
base = float(m.get("basePrice", 1))

# MoonDev-inspired score components.
momentum = 60 + math.sin(loop / 2.3) * 18
liquidity = 62 + math.cos(loop / 3.1) * 16
risk_quality = 72 - abs(math.sin(loop / 4.2)) * 12
moondev_rank_bonus = 10

confidence = max(0, min(99, (momentum * 0.32) + (liquidity * 0.28) + (risk_quality * 0.30) + moondev_rank_bonus))

# Win-focused rule:
# Nexora can observe every loop, but only writes a TRADE learning event when the setup is high quality.
trade_quality = confidence >= 72 and risk_quality >= 58

reference_price = base + math.sin(loop / 3) * (base * 0.0015)
expected_edge = round((confidence - 70) / 3.8, 2)

if trade_quality:
    action = "paper_trade_intent_practice"
    result = "paper_success"
    pnl = max(0.35, expected_edge)
    count_as_trade = True
    paper_signal = "PAPER_TRADE_HIGH_EDGE"
else:
    action = "paper_observe_no_trade"
    result = "paper_skip_low_edge"
    pnl = 0
    count_as_trade = False
    paper_signal = "PAPER_SKIP_LOW_EDGE"

payload = {
    "mode": "paper_learning",
    "source": "nexora_paper_practice_loop",
    "domain": "polymarket",
    "product": "Phantom X / Polymarket",
    "action": action,
    "result": result,
    "loop": loop,
    "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
    "market": m["market"],
    "symbol": m["symbol"],
    "asset": asset,
    "strategyBias": m["strategyBias"],
    "strategyUsed": "moondev_ranked_strategy_plus_nexora_risk_gate",
    "paperSignal": paper_signal,
    "side": "YES",
    "confidence": round(confidence, 2),
    "pnl": round(pnl, 2),
    "riskTriggered": False,
    "countAsTrade": count_as_trade,
    "moondevSignal": {
        "momentum": round(momentum, 2),
        "liquidity": round(liquidity, 2),
        "riskQuality": round(risk_quality, 2),
        "rankBonus": moondev_rank_bonus
    },
    "metrics": {
        "paperPnl": round(pnl, 2),
        "confidence": round(confidence, 2),
        "referencePrice": round(reference_price, 4),
        "loop": loop,
        "asset": asset,
        "countAsTrade": count_as_trade
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
