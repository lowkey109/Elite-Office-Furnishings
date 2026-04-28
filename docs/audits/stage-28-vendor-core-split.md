# Stage 28 — Vendor Core Split

Goal: reduce first-load pressure by splitting vendor-core into smaller cacheable vendor chunks.

Actions:
- Kept React runtime isolated.
- Split router, query, icons, Radix, forms/validation, UI utilities, motion, charts, and date helpers.
- Confirmed TypeScript check passes.
- Confirmed production build passes.
- Confirmed old 1MB lazy route chunk is not directly referenced by index.html.

Notes:
- The remaining largest direct first-load file should be vendor-core.
- If vendor-core remains large, the next stage should inspect exact package contents with a bundle visualizer or temporarily remove first-load app-shell imports.
