import { ASSETS } from '../config';

export type MarketRow = {
  slug: string;
  conditionId: string;
  pUp: number;
  pDown: number;
  tokenUp: string;
  tokenDown: string;
  endTs: number;
};

export type SpotRow = {
  price: number;
  changePct: number;
};

function parseTokens(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function parsePrices(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw).map(Number);
    } catch {
      return [];
    }
  }
  return [];
}

function mapMarket(m: any): MarketRow | null {
  const tokens = parseTokens(m.clobTokenIds);
  const prices = parsePrices(m.outcomePrices);
  if (tokens.length < 2) return null;
  const upIdx = 0;
  const downIdx = 1;
  return {
    slug: m.slug,
    conditionId: m.conditionId,
    pUp: prices[upIdx] || 0,
    pDown: prices[downIdx] || 0,
    tokenUp: tokens[upIdx],
    tokenDown: tokens[downIdx],
    endTs: m.endDate ? Math.floor(new Date(m.endDate).getTime() / 1000) : 0,
  };
}

function windowStart() {
  return Math.floor(Date.now() / 1000 / 300) * 300;
}

async function fetchJson(url: string, timeout = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchBySlug(slug: string) {
  const data = await fetchJson(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`);
  const event = Array.isArray(data) ? data[0] : data;
  const market = event?.markets?.[0];
  return market ? mapMarket(market) : null;
}

export async function loadMarkets(): Promise<Record<string, MarketRow | null>> {
  const out: Record<string, MarketRow | null> = {};
  const base = windowStart();

  await Promise.all(
    ASSETS.map(async (asset) => {
      const slugs: string[] = [];
      for (const offset of [0, 300, 600, -300]) {
        for (const prefix of asset.prefixes) slugs.push(`${prefix}-${base + offset}`);
      }
      for (const slug of slugs) {
        const row = await fetchBySlug(slug);
        if (row) {
          out[asset.key] = row;
          return;
        }
      }
      out[asset.key] = null;
    }),
  );

  return out;
}

export async function loadSpot(): Promise<Record<string, SpotRow>> {
  const out: Record<string, SpotRow> = {};
  await Promise.all(
    ASSETS.map(async (asset) => {
      try {
        const [ticker, klines] = await Promise.all([
          fetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${asset.binance}`),
          fetchJson(`https://api.binance.com/api/v3/klines?symbol=${asset.binance}&interval=1m&limit=30`),
        ]);
        const price = Number(ticker.price);
        const first = Number(klines[0]?.[4] ?? price);
        out[asset.key] = { price, changePct: first ? ((price - first) / first) * 100 : 0 };
      } catch {
        out[asset.key] = { price: 0, changePct: 0 };
      }
    }),
  );
  return out;
}

export function fmtUsd(n: number, dp = 2) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function shortAddr(a?: string | null) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

export function countdown(endTs: number, now: number) {
  const n = endTs ? Math.max(0, Math.min(300, endTs - now)) : 0;
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
