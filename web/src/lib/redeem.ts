import {
  OperationType,
  type SafeTransaction,
} from '@polymarket/builder-relayer-client';
import { encodeFunctionData } from 'viem';
import { CTF, NEG_RISK_ADAPTER, USDC_E } from '../constants/polymarket';

const ctfAbi = [
  {
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'parentCollectionId', type: 'bytes32' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'indexSets', type: 'uint256[]' },
    ],
    name: 'redeemPositions',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const negRiskAdapterAbi = [
  {
    inputs: [
      { name: 'conditionId', type: 'bytes32' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    name: 'redeemPositions',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export type RedeemParams = {
  conditionId: string;
  outcomeIndex: number;
  negativeRisk?: boolean;
  size?: number;
};

export function createRedeemTx(params: RedeemParams): SafeTransaction {
  const { conditionId, outcomeIndex, negativeRisk = false, size = 0 } = params;

  if (negativeRisk) {
    const tokenAmount = BigInt(Math.floor(size * 1e6));
    const amounts: bigint[] = [BigInt(0), BigInt(0)];
    amounts[outcomeIndex] = tokenAmount;

    return {
      to: NEG_RISK_ADAPTER,
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: negRiskAdapterAbi,
        functionName: 'redeemPositions',
        args: [conditionId as `0x${string}`, amounts],
      }),
      value: '0',
    };
  }

  const indexSet = BigInt(1 << outcomeIndex);
  return {
    to: CTF,
    operation: OperationType.Call,
    data: encodeFunctionData({
      abi: ctfAbi,
      functionName: 'redeemPositions',
      args: [
        USDC_E,
        `0x${'0'.repeat(64)}`,
        conditionId as `0x${string}`,
        [indexSet],
      ],
    }),
    value: '0',
  };
}
