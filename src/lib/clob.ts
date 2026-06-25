import { ClobClient, OrderType, ApiKeyCreds } from '@polymarket/clob-client-v2';
import dotenv from 'dotenv';

dotenv.config();

const BUILDER_CODE = process.env.POLY_BUILDER_CODE;
const CLOB_HOST = process.env.POLY_CLOB_HOST || 'https://clob.polymarket.com';
const CHAIN_ID = Number(process.env.POLY_CHAIN_ID || 137);

if (!BUILDER_CODE) {
  console.warn('Warning: POLY_BUILDER_CODE is not set');
}

export function getPostingClient(creds: ApiKeyCreds): ClobClient {
  return new ClobClient({
    host: CLOB_HOST,
    chain: CHAIN_ID,
    creds,
    builderConfig: BUILDER_CODE ? { builderCode: BUILDER_CODE } : undefined,
  });
}

export async function postSignedOrder(params: {
  signedOrder: Record<string, unknown>;
  orderType: OrderType;
  creds: ApiKeyCreds;
}) {
  const client = getPostingClient(params.creds);
  const response = await client.postOrder(params.signedOrder as any, params.orderType);
  return response;
}

export function assertBuilderOnOrder(order: Record<string, unknown>) {
  const builder = String(order.builder ?? order.builderCode ?? '');
  if (!BUILDER_CODE) return;
  if (builder.toLowerCase() !== BUILDER_CODE.toLowerCase()) {
    throw new Error('Order missing correct builderCode');
  }
}
