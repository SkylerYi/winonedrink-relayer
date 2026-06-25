const GAMMA = 'https://gamma-api.polymarket.com';

const ASSETS = [
  { key: 'BTC', prefixes: ['btc-updown-5m'] },
  { key: 'ETH', prefixes: ['eth-updown-5m'] },
] as const;

export type AllowedMarket = {
  asset: string;
  slug: string;
  conditionId: string;
  tokenUp: string;
  tokenDown: string;
  tickSize: string;
  minSize: number;
  negRisk: boolean;
};

function parseTokens(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function windowStart(): number {
  return Math.floor(Date.now() / 1000 / 300) * 300;
}

async function fetchEventBySlug(slug: string) {
  const res = await fetch(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const event = Array.isArray(data) ? data[0] : data;
  return event?.markets?.[0] ?? null;
}

async function resolveAsset(prefixes: readonly string[]): Promise<AllowedMarket | null> {
  const base = windowStart();
  const slugs: string[] = [];
  for (const offset of [0, 300, 600, -300]) {
    for (const prefix of prefixes) {
      slugs.push(`${prefix}-${base + offset}`);
    }
  }

  for (const slug of slugs) {
    const market = await fetchEventBySlug(slug);
    if (!market?.acceptingOrders) continue;
    const tokens = parseTokens(market.clobTokenIds);
    if (tokens.length < 2) continue;
    return {
      asset: prefixes[0].split('-')[0].toUpperCase(),
      slug: market.slug,
      conditionId: market.conditionId,
      tokenUp: tokens[0],
      tokenDown: tokens[1],
      tickSize: String(market.orderPriceMinTickSize ?? '0.01'),
      minSize: Number(market.orderMinSize ?? 5),
      negRisk: Boolean(market.negRisk),
    };
  }
  return null;
}

let cache: { at: number; markets: AllowedMarket[]; tokenIds: Set<string> } | null = null;

export async function getAllowedMarkets(): Promise<AllowedMarket[]> {
  const now = Date.now();
  if (cache && now - cache.at < 30_000) return cache.markets;

  const markets = (
    await Promise.all(ASSETS.map((a) => resolveAsset(a.prefixes)))
  ).filter((m): m is AllowedMarket => m !== null);

  cache = {
    at: now,
    markets,
    tokenIds: new Set(markets.flatMap((m) => [m.tokenUp, m.tokenDown])),
  };
  return markets;
}

export async function isAllowedTokenId(tokenId: string): Promise<boolean> {
  const { tokenIds } = cache ?? { tokenIds: new Set<string>() };
  if (!cache || Date.now() - cache.at > 30_000) {
    await getAllowedMarkets();
    return cache!.tokenIds.has(tokenId);
  }
  return tokenIds.has(tokenId);
}
