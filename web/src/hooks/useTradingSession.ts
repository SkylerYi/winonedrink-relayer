import { useCallback, useEffect, useState } from 'react';
import type { RelayClient } from '@polymarket/builder-relayer-client';
import {
  clearSession,
  loadSession,
  saveSession,
  type SessionStep,
  type TradingSession,
  STEP_LABELS,
} from '../lib/session';
import {
  createRelayClient,
  createTradingClobClient,
  initTradingSession,
} from '../lib/trading';
import { useWallet } from '../providers/WalletProvider';

export function useTradingSession() {
  const { eoaAddress, ethersSigner, walletClient, walletReady, authenticated } = useWallet();
  const [session, setSession] = useState<TradingSession | null>(null);
  const [step, setStep] = useState<SessionStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [relayClient, setRelayClient] = useState<RelayClient | null>(null);

  useEffect(() => {
    if (!eoaAddress) {
      setSession(null);
      setStep('idle');
      return;
    }
    setSession(loadSession(eoaAddress));
  }, [eoaAddress]);

  const ready =
    Boolean(session?.isSafeDeployed && session.hasApiCredentials && session.hasApprovals);

  const initialize = useCallback(async () => {
    if (!eoaAddress || !ethersSigner || !walletClient) {
      throw new Error('钱包还在初始化，请等 2 秒后重试');
    }
    setBusy(true);
    setError(null);
    try {
      const next = await initTradingSession(
        eoaAddress,
        walletClient,
        ethersSigner,
        (s) => setStep(s as SessionStep),
        session,
      );
      saveSession(eoaAddress, next);
      setSession(next);
      setRelayClient(createRelayClient(walletClient));
      setStep('complete');
      return next;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStep('idle');
      throw e;
    } finally {
      setBusy(false);
    }
  }, [eoaAddress, ethersSigner, walletClient, session]);

  const reset = useCallback(() => {
    if (eoaAddress) clearSession(eoaAddress);
    setSession(null);
    setRelayClient(null);
    setStep('idle');
    setError(null);
  }, [eoaAddress]);

  const clobClient =
    ready && session && ethersSigner ? createTradingClobClient(ethersSigner, session) : null;

  return {
    session,
    step,
    stepLabel: STEP_LABELS[step],
    error,
    busy,
    ready,
    walletReady,
    relayClient,
    clobClient,
    safeAddress: session?.safeAddress,
    initialize,
    reset,
    authenticated,
  };
}
