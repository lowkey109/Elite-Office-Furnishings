# Stage 31 — Remove vendor-core first-load

Stage 31 passed.

## Verification

- TypeScript check passed.
- Production build passed.
- First-load vendor-core removed.
- vendor-core is no longer directly loaded by dist/public/index.html.
- First-load JavaScript is now 235,111 bytes.
- First-load CSS is 204,853 bytes.

## Direct first-load files

- assets/index-6LjiY7RO.css
- assets/index-BLcgs2dx.js
- assets/vendor-query-C2sTNx8B.js
- assets/vendor-react-cP4UD8Zc.js
- assets/vendor-router-CQEF0Hqz.js

## Notes

The remaining large chunks are lazy-loaded route chunks, not first-load blockers. The next possible optimisation would be targeted route optimisation for OfficeWalkthrough, MarketMap, and CSS, but the main app shell is now much faster.
