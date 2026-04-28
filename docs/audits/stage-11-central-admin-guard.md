# Stage 11 Central Admin Guard

## Status

Created a reusable server-side admin guard at:

`server/security/adminGuard.ts`

## Why

Stage 10 found many admin areas still using mixed auth patterns:
- session-based admin auth
- `x-tcd-admin-auth`
- token-based protection
- client-side `sessionStorage` checks

## Guard behaviour

Development/local:
- allows existing session admin
- allows existing `x-tcd-admin-auth: true`
- allows admin token if configured

Production:
- allows real admin session
- allows `x-tcd-admin-token` / bearer token matching `TCD_ADMIN_API_TOKEN`, `ADMIN_API_TOKEN`, or `ADMIN_TOKEN`
- does not rely on client-side `sessionStorage`

## Important

This stage does not remove pipeline, outreach, trading, procurement, or existing admin routes.

Next stages should migrate admin route groups one at a time:
1. competitor quote admin routes already have token protection
2. procurement admin routes
3. outreach/admin automation routes
4. pipeline/deal routes
5. trading monitor routes
6. product/catalog routes
7. client-side admin gates cleanup
