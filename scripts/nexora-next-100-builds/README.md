# Nexora Next 100 Builds

Generated build files: `nexora-build-166.sh` through `nexora-build-265.sh`.

Rules:
- Extension-only.
- No deploy.
- Create files only if missing.
- Backup route file before patching.
- Patch route registrar if absent.
- Run `npm run check`.
- Commit only touched Nexora files.
- Safe while Postgres is full.
