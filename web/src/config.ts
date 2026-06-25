export const CONFIG = {
  PRIVY_APP_ID: import.meta.env.VITE_PRIVY_APP_ID as string,
  BACKEND_URL: (import.meta.env.VITE_BACKEND_URL as string)?.replace(/\/$/, ''),
  BUILDER_CODE: import.meta.env.VITE_POLY_BUILDER_CODE as string,
  BUILDER_TAKER_BPS: Number(import.meta.env.VITE_BUILDER_TAKER_BPS || 100),
  DEFAULT_USD: 5,
  CLOB_HOST: 'https://clob.polymarket.com',
  CHAIN_ID: 137 as const,
  PUSD: '0xC011a7E12a19f7B1f670d46f03b03f3342E82dfb',
};

export const ASSETS = [
  { key: 'BTC', name: 'BTC 涨跌预估', binance: 'BTCUSDT', prefixes: ['btc-updown-5m'], color: '#F7931A', dp: 0 },
  { key: 'ETH', name: 'ETH 涨跌预估', binance: 'ETHUSDT', prefixes: ['eth-updown-5m'], color: '#627EEA', dp: 2 },
] as const;

export type AssetKey = (typeof ASSETS)[number]['key'];
