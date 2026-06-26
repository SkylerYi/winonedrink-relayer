import { RelayClient, RelayerTransactionState } from '@polymarket/builder-relayer-client';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import type { WalletClient } from 'viem';
import type { providers } from 'ethers';
import {
  CLOB_API_URL,
  POLYGON_CHAIN_ID,
  RELAYER_URL,
  REMOTE_SIGNING_URL,
} from '../constants/polymarket';
import { checkAllApprovals, createAllApprovalTxs } from './approvals';
import type { TradingSession } from './session';

export function deriveSafeAddress(eoaAddress: string): string {
  const config = getContractConfig(POLYGON_CHAIN_ID);
  return deriveSafe(eoaAddress, config.SafeContracts.SafeFactory);
}

export function createBuilderConfig() {
  return new BuilderConfig({
    remoteBuilderConfig: { url: REMOTE_SIGNING_URL() },
  });
}

export function createRelayClient(signer: providers.JsonRpcSigner | WalletClient) {
  return new RelayClient(RELAYER_URL, POLYGON_CHAIN_ID, signer as any, createBuilderConfig());
}

export async function isSafeDeployed(relayClient: RelayClient, safeAddr: string): Promise<boolean> {
  try {
    const deployed = await (relayClient as any).getDeployed(safeAddr);
    return Boolean(deployed);
  } catch {
    return false;
  }
}

export async function deploySafe(relayClient: RelayClient): Promise<string> {
  const response = await relayClient.deploy();
  const result = await relayClient.pollUntilState(
    response.transactionID,
    [
      RelayerTransactionState.STATE_MINED,
      RelayerTransactionState.STATE_CONFIRMED,
      RelayerTransactionState.STATE_FAILED,
    ],
    '60',
    3000,
  );
  if (!result) throw new Error('Safe 部署失败');
  return result.proxyAddress;
}

export async function deriveOrCreateApiCreds(signer: providers.JsonRpcSigner) {
  const temp = new ClobClient(CLOB_API_URL, POLYGON_CHAIN_ID, signer);
  const derived = await temp.deriveApiKey().catch(() => null);
  if (derived?.key && derived.secret && derived.passphrase) return derived;
  return temp.createApiKey();
}

export async function setAllApprovals(relayClient: RelayClient) {
  const txs = createAllApprovalTxs();
  const response = await relayClient.execute(txs, 'Set token approvals for trading');
  await response.wait();
}

export async function checkBuilderSignBackend(): Promise<string | null> {
  try {
    const res = await fetch(`${REMOTE_SIGNING_URL()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'GET', path: '/health-check', body: '' }),
    });
    if (res.status === 404) {
      return '后端未部署最新代码（/api/builder/sign 不存在），需要 push GitHub 让 Railway 重新部署';
    }
    if (res.status === 503) {
      return 'Railway 缺少 POLYMARKET_BUILDER_API_KEY / SECRET / PASSPHRASE';
    }
    if (!res.ok) return `后端签名服务异常 (${res.status})`;
    return null;
  } catch {
    return '无法连接后端签名服务，请检查 VITE_BACKEND_URL';
  }
}

export async function initTradingSession(
  eoaAddress: string,
  walletClient: WalletClient,
  ethersSigner: providers.JsonRpcSigner,
  onStep: (step: string) => void,
  existing?: TradingSession | null,
): Promise<TradingSession> {
  const backendErr = await checkBuilderSignBackend();
  if (backendErr) throw new Error(backendErr);

  onStep('checking');
  const relayClient = createRelayClient(walletClient);
  const safeAddress = deriveSafeAddress(eoaAddress);

  let deployed = await isSafeDeployed(relayClient, safeAddress);
  if (!deployed) {
    onStep('deploying');
    await deploySafe(relayClient);
    deployed = true;
  }

  onStep('credentials');
  let apiCredentials = existing?.apiCredentials;
  if (!apiCredentials?.key || !apiCredentials.secret || !apiCredentials.passphrase) {
    apiCredentials = await deriveOrCreateApiCreds(ethersSigner);
  }

  onStep('approvals');
  const approvalStatus = await checkAllApprovals(safeAddress);
  let hasApprovals = approvalStatus.allApproved;
  if (!hasApprovals) {
    await setAllApprovals(relayClient);
    hasApprovals = true;
  }

  onStep('complete');
  return {
    eoaAddress,
    safeAddress,
    isSafeDeployed: deployed,
    hasApiCredentials: true,
    hasApprovals,
    apiCredentials,
    lastChecked: Date.now(),
  };
}

export function createTradingClobClient(
  signer: providers.JsonRpcSigner,
  session: TradingSession,
) {
  if (!session.apiCredentials) throw new Error('Missing API credentials');
  return new ClobClient(
    CLOB_API_URL,
    POLYGON_CHAIN_ID,
    signer,
    session.apiCredentials,
    2,
    session.safeAddress,
    undefined,
    false,
    createBuilderConfig(),
  );
}

export async function placeBuyOrder(params: {
  client: ClobClient;
  tokenId: string;
  price: number;
  sizeUsd: number;
  tickSize?: string;
  negRisk?: boolean;
}) {
  const price = Math.min(0.99, Math.max(0.01, params.price));
  const size = Math.max(5, Math.floor((params.sizeUsd / price) * 100) / 100);

  const signed = await params.client.createOrder(
    {
      tokenID: params.tokenId,
      price,
      size,
      side: Side.BUY,
    },
    {
      tickSize: (params.tickSize ?? '0.01') as '0.01',
      negRisk: params.negRisk ?? false,
    },
  );

  const result = await params.client.postOrder(signed, OrderType.GTC);
  return { result, price, size };
}
