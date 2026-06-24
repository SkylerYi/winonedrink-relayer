import { ClobClient, Side, OrderType, PartialCreateOrderOptions } from '@polymarket/clob-client-v2';
import dotenv from 'dotenv';

dotenv.config();

const BUILDER_CODE = process.env.POLY_BUILDER_CODE;
const CLOB_HOST = process.env.POLY_CLOB_HOST || 'https://clob.polymarket.com';
const CHAIN_ID = Number(process.env.POLY_CHAIN_ID || 137);

if (!BUILDER_CODE) {
  console.warn('Warning: POLY_BUILDER_CODE is not set');
}

let clobClient: ClobClient | null = null;

export function getClobClient(): ClobClient {
  if (!clobClient) {
    clobClient = new ClobClient({
      host: CLOB_HOST,
      chain: CHAIN_ID,
    });
  }
  return clobClient;
}

export async function placeOrder(params: {
  tokenId: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
}) {
  const client = getClobClient();

  const orderArgs = {
    tokenID: params.tokenId,
    price: params.price,
    size: params.size,
    side: params.side === 'BUY' ? Side.BUY : Side.SELL,
    builderCode: BUILDER_CODE,
  };

  const options: PartialCreateOrderOptions = {
    tickSize: '0.01',
    negRisk: false,
  };

  try {
    const response = await client.createAndPostOrder(orderArgs, options, OrderType.GTC);
    console.log('Order placed:', response.orderID);
    return response;
  } catch (error: any) {
    console.error('Order failed:', error.message);
    throw error;
  }
}
