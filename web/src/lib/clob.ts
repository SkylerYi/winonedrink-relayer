import { BrowserProvider } from 'ethers';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client-v2';
import { CONFIG } from '../config';

export async function createAuthedClobClient(provider: unknown, address: string) {
  const browser = new BrowserProvider(provider as any);
  const signer = await browser.getSigner();

  const bootstrap = new ClobClient({
    host: CONFIG.CLOB_HOST,
    chain: CONFIG.CHAIN_ID,
    signer: signer as any,
  });

  const creds = await bootstrap.createOrDeriveApiKey();

  const client = new ClobClient({
    host: CONFIG.CLOB_HOST,
    chain: CONFIG.CHAIN_ID,
    signer: signer as any,
    creds,
    builderConfig: { builderCode: CONFIG.BUILDER_CODE },
  });

  return { client, creds, address };
}

export async function buildSignedBuyOrder(params: {
  client: ClobClient;
  tokenId: string;
  price: number;
  sizeUsd: number;
  tickSize?: string;
  negRisk?: boolean;
}) {
  const price = Math.min(0.99, Math.max(0.01, params.price));
  const size = Math.max(5, Math.floor((params.sizeUsd / price) * 100) / 100);

  const signedOrder = await params.client.createOrder(
    {
      tokenID: params.tokenId,
      price,
      size,
      side: Side.BUY,
      builderCode: CONFIG.BUILDER_CODE,
    } as any,
    {
      tickSize: (params.tickSize ?? '0.01') as '0.01',
      negRisk: params.negRisk ?? false,
    },
  );

  return { signedOrder, price, size };
}

export async function submitOrderViaBackend(params: {
  accessToken: string;
  signedOrder: unknown;
  tokenId: string;
  apiCreds: { key: string; secret: string; passphrase: string };
}) {
  const res = await fetch(`${CONFIG.BACKEND_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      signedOrder: params.signedOrder,
      orderType: OrderType.GTC,
      tokenId: params.tokenId,
      apiCreds: params.apiCreds,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
