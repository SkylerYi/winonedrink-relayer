import { useEffect, useState } from 'react';
import { useFundWallet } from '@privy-io/react-auth';
import { polygon } from 'viem/chains';
import { readUsdcBalance } from '../lib/approvals';

export function useSafeBalance(safeAddress?: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!safeAddress) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
      setBalance(await readUsdcBalance(safeAddress));
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 15000);
    return () => window.clearInterval(t);
  }, [safeAddress]);

  return { balance, loading, refresh };
}

export function useDeposit(onDone?: () => void) {
  const { fundWallet } = useFundWallet();

  const deposit = async (address: string, amountUsd = '20') => {
    await fundWallet(address, {
      amount: amountUsd,
      chain: polygon,
      asset: 'USDC',
      card: { preferredProvider: 'moonpay' },
    });
    onDone?.();
  };

  return { deposit };
}
