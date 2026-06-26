import {
  OperationType,
  type SafeTransaction,
} from '@polymarket/builder-relayer-client';
import { createPublicClient, encodeFunctionData, erc20Abi, http } from 'viem';
import { polygon } from 'viem/chains';
import {
  CTF,
  CTF_EXCHANGE,
  NEG_RISK_ADAPTER,
  NEG_RISK_CTF_EXCHANGE,
  POLYGON_RPC_URL,
  USDC_E,
} from '../constants/polymarket';

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const erc1155Abi = [
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC_URL),
});

const USDC_SPENDERS = [
  { address: CTF, name: 'CTF' },
  { address: NEG_RISK_ADAPTER, name: 'NegRiskAdapter' },
  { address: CTF_EXCHANGE, name: 'CTFExchange' },
  { address: NEG_RISK_CTF_EXCHANGE, name: 'NegRiskExchange' },
] as const;

const OUTCOME_SPENDERS = [
  { address: CTF_EXCHANGE, name: 'CTFExchange' },
  { address: NEG_RISK_CTF_EXCHANGE, name: 'NegRiskExchange' },
  { address: NEG_RISK_ADAPTER, name: 'NegRiskAdapter' },
] as const;

async function usdcApproved(safe: string, spender: string) {
  try {
    const allowance = await publicClient.readContract({
      address: USDC_E,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [safe as `0x${string}`, spender as `0x${string}`],
    });
    return allowance >= BigInt('1000000000000');
  } catch {
    return false;
  }
}

async function outcomeApproved(safe: string, spender: string) {
  try {
    return publicClient.readContract({
      address: CTF,
      abi: erc1155Abi,
      functionName: 'isApprovedForAll',
      args: [safe as `0x${string}`, spender as `0x${string}`],
    });
  } catch {
    return false;
  }
}

export async function checkAllApprovals(safeAddress: string) {
  const usdcApprovals: Record<string, boolean> = {};
  const outcomeTokenApprovals: Record<string, boolean> = {};

  await Promise.all(
    USDC_SPENDERS.map(async ({ address, name }) => {
      usdcApprovals[name] = await usdcApproved(safeAddress, address);
    }),
  );
  await Promise.all(
    OUTCOME_SPENDERS.map(async ({ address, name }) => {
      outcomeTokenApprovals[name] = await outcomeApproved(safeAddress, address);
    }),
  );

  const allApproved =
    Object.values(usdcApprovals).every(Boolean) &&
    Object.values(outcomeTokenApprovals).every(Boolean);

  return { allApproved, usdcApprovals, outcomeTokenApprovals };
}

export function createAllApprovalTxs(): SafeTransaction[] {
  const txs: SafeTransaction[] = [];

  for (const { address } of USDC_SPENDERS) {
    txs.push({
      to: USDC_E,
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [address as `0x${string}`, BigInt(MAX_UINT256)],
      }),
      value: '0',
    });
  }

  for (const { address } of OUTCOME_SPENDERS) {
    txs.push({
      to: CTF,
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: erc1155Abi,
        functionName: 'setApprovalForAll',
        args: [address as `0x${string}`, true],
      }),
      value: '0',
    });
  }

  return txs;
}

export async function readUsdcBalance(address: string): Promise<number> {
  const raw = await publicClient.readContract({
    address: USDC_E,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
  return Number(raw) / 1e6;
}
