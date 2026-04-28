# Stage 27 — Vendor Split Speed Hardening

## Result

Stage 27 splits large frontend vendor dependencies into smaller production chunks.

## Purpose

Previous stages moved route pages and global widgets into lazy-loaded chunks. The remaining speed issue was large shared/vendor bundles. This stage improves browser caching and reduces giant vendor payload concentration.

## Verification

Required checks:

- `npm run check`
- `npm run build`
- production bundle inspection using largest files in `dist/public/assets`

## Notes

This does not remove functionality. It only changes Vite/Rollup chunk grouping.
