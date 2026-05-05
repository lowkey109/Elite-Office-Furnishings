#!/usr/bin/env bash
set -euo pipefail
cd ~/workspace

mkdir -p data/nexora/local/paper-summary

python3 <<'PY'
import json, datetime
from pathlib import Path
from collections import Counter

events_path = Path("data/nexora/local/learning-memory/events.jsonl")
out = Path("data/nexora/local/paper-summary/latest-summary.json")
out.parent.mkdir(parents=True, exist_ok=True)

events = []
if events_path.exists():
    for line in events_path.read_text().splitlines():
        try:
            e=json.loads(line)
            raw=e.get("raw",{})
            if e.get("domain")=="polymarket" or raw.get("product")=="Phantom X / Polymarket" or raw.get("asset"):
                events.append(e)
        except Exception:
            pass

recent=events[-250:]
counted=[]
wins=0
losses=0
skips=0
results=Counter()
assets={}

for e in recent:
    raw=e.get("raw",{})
    asset=raw.get("asset","unknown")
    result=str(e.get("result","unknown"))
    pnl=float(raw.get("pnl", e.get("metrics",{}).get("paperPnl",0)) or 0)
    score=e.get("scored",{}).get("score")
    count=raw.get("countAsTrade", True)
    if raw.get("action")=="paper_observe_no_trade" or "skip" in result:
        count=False

    assets.setdefault(asset, {"asset":asset,"events":0,"countedTrades":0,"wins":0,"losses":0,"skips":0,"pnl":0,"scoreSum":0,"scoreCount":0})
    a=assets[asset]
    a["events"]+=1
    a["pnl"]+=pnl
    results[result]+=1

    if isinstance(score,(int,float)):
        a["scoreSum"]+=score
        a["scoreCount"]+=1

    if count:
        counted.append(e)
        a["countedTrades"]+=1
        if "success" in result or pnl>0:
            wins+=1
            a["wins"]+=1
        elif "loss" in result or pnl<0:
            losses+=1
            a["losses"]+=1
    else:
        skips+=1
        a["skips"]+=1

asset_rows=[]
for a in assets.values():
    trades=a["countedTrades"]
    asset_rows.append({
        "asset":a["asset"],
        "events":a["events"],
        "countedTrades":a["countedTrades"],
        "wins":a["wins"],
        "losses":a["losses"],
        "skips":a["skips"],
        "winRate":round((a["wins"]/trades)*100,2) if trades else 0,
        "avgScore":round((a["scoreSum"]/a["scoreCount"]),2) if a["scoreCount"] else 0,
        "pnl":round(a["pnl"],2)
    })

asset_rows.sort(key=lambda x:(x["winRate"],x["avgScore"],x["countedTrades"]), reverse=True)

scores=[e.get("scored",{}).get("score") for e in counted if isinstance(e.get("scored",{}).get("score"),(int,float))]
win_rate=round((wins/len(counted))*100,2) if counted else 0
avg_score=round(sum(scores)/len(scores),2) if scores else 0
confidence=95 if len(counted)>=20 and win_rate>=95 and avg_score>=80 else round(max(50,min(94,(win_rate*.55)+(avg_score*.45))),2)

summary={
  "ok":True,
  "service":"nexora_paper_learning_summary",
  "generatedAt":datetime.datetime.utcnow().isoformat()+"Z",
  "source":"local_replit_learning_memory_synced_to_production",
  "polymarketEvents":len(events),
  "recentEvents":len(recent),
  "countedTrades":len(counted),
  "wins":wins,
  "losses":losses,
  "skips":skips,
  "winRate":win_rate,
  "avgScore":avg_score,
  "displayedConfidencePercent":confidence,
  "targetConfidencePercent":95,
  "targetReached":confidence>=95,
  "results":dict(results),
  "assets":asset_rows,
  "latest":recent[-1] if recent else None,
  "safety":{
    "liveTradingEnabled":False,
    "privateKeysInsideNexora":False,
    "walletSigningInsideNexora":False,
    "postgresReplay":False,
    "bankTransfers":False
  }
}

out.write_text(json.dumps(summary, indent=2))
print(json.dumps({"events":len(events),"countedTrades":len(counted),"wins":wins,"winRate":win_rate,"confidence":confidence}, indent=2))
PY
