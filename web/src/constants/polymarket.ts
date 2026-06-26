export const POLYGON_CHAIN_ID = 137;

export const RELAYER_URL = 'https://relayer-v2.polymarket.com/';
export const CLOB_API_URL = 'https://clob.polymarket.com';
export const POLYGON_RPC_URL =
  (import.meta.env.VITE_POLYGON_RPC_URL as string) || 'https://polygon-rpc.com';

export const REMOTE_SIGNING_URL = () =>
  `${(import.meta.env.VITE_BACKEND_URL as string)?.replace(/\/$/, '')}/api/builder/sign`;

export const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;
export const CTF = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045' as const;
export const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const;
export const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const;
export const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const;
