#!/usr/bin/env bash
set -e

echo "=================================================="
echo "TCD / NEXORA AI ADMIN AUDIT"
echo "=================================================="
echo ""

echo "1) PROJECT STATUS"
echo "--------------------------------------------------"
pwd
git status --short || true
echo ""

echo "2) PACKAGE SCRIPTS"
echo "--------------------------------------------------"
cat package.json | grep -A 20 '"scripts"' || true
echo ""

echo "3) ADMIN FRONTEND PAGES FOUND"
echo "--------------------------------------------------"
ls client/src/pages | grep -E "Admin|Nexora|AI|Intelligence|Deal|Office|Trading|Profit|Lead|Partner|Supplier" | sort || true
echo ""

echo "4) ROUTES POINTING TO ADMIN / AI PAGES"
echo "--------------------------------------------------"
grep -R "AdminNexora\|AdminAI\|AdminCommand\|AdminDeal\|AdminOffice\|AdminTrading\|NexoraMonitor\|admin/" -n client/src server/routes.ts server/index.ts 2>/dev/null | head -200 || true
echo ""

echo "5) BACKEND ADMIN/API ROUTES"
echo "--------------------------------------------------"
grep -n "app\.get\|app\.post\|app\.put\|app\.patch\|app\.delete" server/routes.ts | grep -Ei "admin|nexora|ai|intelligence|deal|office|trading|lead|partner|supplier|scanner|scheduler|autonomous|approval|queue|monitor" | head -250 || true
echo ""

echo "6) NEXORA / AI ENGINE FILES"
echo "--------------------------------------------------"
find server -type f | grep -Ei "nexora|ai|intelligence|scheduler|orchestrator|agent|automation|dealHunter|officeMov|officeMove|scanner|prediction|trading|approval|queue" | sort || true
echo ""

echo "7) NEXORA EXECUTION FUNCTIONS"
echo "--------------------------------------------------"
grep -R "runNexora\|run.*Engine\|orchestrator\|scheduler\|setInterval\|setTimeout\|cron\|queue\|approval\|auto" -n server/services server/routes.ts 2>/dev/null | head -300 || true
echo ""

echo "8) CHECK FOR DEMO / FAKE / SYNTHETIC DATA PATHS"
echo "--------------------------------------------------"
grep -R "demo\|fake\|mock\|synthetic\|sample\|hardcoded\|random\|placeholder" -n server/services server/routes.ts client/src/pages 2>/dev/null | grep -Ei "nexora|ai|intelligence|deal|office|radar|trading|admin|lead|scanner|scheduler|orchestrator|signal" | head -300 || true
echo ""

echo "9) APPROVAL / HUMAN-GATE BLOCKERS"
echo "--------------------------------------------------"
grep -R "approval\|pending approval\|requiresApproval\|human approval\|manual approval\|review queue\|awaiting" -n server client/src 2>/dev/null | head -300 || true
echo ""

echo "10) ENV VARS REFERENCED BY AI SYSTEM"
echo "--------------------------------------------------"
grep -R "process\.env" -n server 2>/dev/null | grep -Ei "OPENAI|AI|NEXORA|DATABASE|PINECONE|WEAVIATE|ADZUNA|STRIPE|RESEND|EMAIL|WHATSAPP|TRADING" | sort | head -250 || true
echo ""

echo "11) DATABASE / STORAGE REFERENCES"
echo "--------------------------------------------------"
grep -R "db\.|storage\.|drizzle|DATABASE_URL|create.*Record|insert|select|update" -n server/services server/routes.ts 2>/dev/null | grep -Ei "nexora|ai|intelligence|deal|office|lead|approval|trading|signal|scanner|scheduler" | head -300 || true
echo ""

echo "12) RUN TYPESCRIPT CHECK"
echo "--------------------------------------------------"
npm run check || true
echo ""

echo "13) BUILD CHECK"
echo "--------------------------------------------------"
npm run build || true
echo ""

echo "14) LIVE SERVER HEALTH CHECK"
echo "--------------------------------------------------"
curl -s http://localhost:5000/api/health || true
echo ""
curl -s http://localhost:5000/api/admin/nexora/monitor || true
echo ""
curl -s http://localhost:5000/api/admin/trading/monitor || true
echo ""
curl -s http://localhost:5000/api/admin/intelligence/status || true
echo ""

echo "=================================================="
echo "AUDIT COMPLETE"
echo "=================================================="
