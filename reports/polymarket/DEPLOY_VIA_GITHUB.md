# Deploy via GitHub

Railway CLI deploy from Replit shell was skipped because the shell session was blanking during `railway up`.

Deployment path:
- Push to GitHub
- Railway auto-deploys from connected GitHub repo

Safety:
- No Postgres migration/replay
- No live trading enable
- No private keys
- No wallet signing inside Nexora
