# winonedrink-relayer

A single backend service: a Fastify + TypeScript "relayer" that authenticates callers via Privy and places trading orders on the Polymarket CLOB on their behalf.

## Cursor Cloud specific instructions

### Service overview
- One process only (no DB, no queue, no containers). Fastify HTTP API on `PORT` (default `3001`, binds `0.0.0.0`).
- Endpoints: `GET /health` (open) and `POST /api/orders` (requires `Authorization: Bearer <Privy access token>`; body validated by Zod: `tokenId`, `price`, `size`, `side`).
- External dependencies are remote SaaS APIs reached at request time: Privy (token verification) and Polymarket CLOB (order placement). There is no local mock/offline mode.

### Run / build / typecheck
Use the npm scripts in `package.json`:
- Dev (hot reload): `npm run dev` (`tsx watch`).
- Type check / lint: `npm run build` (`tsc`); there is no separate lint or test command.
- Prod: `npm run build` then `npm start`.

### Gotchas
- The process **throws on startup** if `PRIVY_APP_ID` or `PRIVY_APP_SECRET` are missing (`src/lib/privy.ts`), so a populated `.env` is required even just to boot.
- `.env` is gitignored (see `.gitignore`) and is NOT in the repo; it is provisioned into the VM and holds the real Privy/Polymarket credentials. Do not commit it. `.env.example` is the template.
- Full end-to-end order placement requires a real Privy access token minted by a logged-in user (from the separate frontend), which is not available server-side. The auth path can still be verified with any Bearer token: an invalid token returns HTTP 500 `Invalid Privy access token` (`ERR_JWS_INVALID`), proving the Privy client is live.
- The frontend is a separate repo (Vite dev on `:5173` / Netlify); CORS is pre-allowed for those origins in `src/index.ts`.
