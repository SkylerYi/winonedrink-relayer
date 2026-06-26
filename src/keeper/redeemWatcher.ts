/**
 * Keeper skeleton: logs active whitelist markets for ops monitoring.
 * Run with: npm run keeper
 *
 * Per-user redeem requires RelayClient signatures in the browser.
 */
import dotenv from 'dotenv';
import { getAllowedMarkets } from '../lib/markets.js';

dotenv.config();

const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS || 60_000);

async function tick() {
  const markets = await getAllowedMarkets();
  console.log(
    `[keeper] active whitelist: ${markets.length}`,
    markets.map((m) => `${m.asset} ${m.slug}`),
  );
}

async function main() {
  console.log(`[keeper] polling every ${INTERVAL_MS}ms`);
  await tick();
  setInterval(() => {
    tick().catch((err) => console.error('[keeper] tick failed', err));
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error('[keeper] fatal', err);
  process.exit(1);
});
