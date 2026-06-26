import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { providers } from 'ethers';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { polygon } from 'viem/chains';

type WalletCtx = {
  eoaAddress?: string;
  ethersSigner: providers.JsonRpcSigner | null;
  walletClient: WalletClient | null;
  embeddedWallet: ReturnType<typeof useWallets>['wallets'][number] | undefined;
  walletReady: boolean;
  ready: boolean;
  authenticated: boolean;
};

const Ctx = createContext<WalletCtx>({
  ethersSigner: null,
  walletClient: null,
  embeddedWallet: undefined,
  walletReady: false,
  ready: false,
  authenticated: false,
});

export function useWallet() {
  return useContext(Ctx);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const [ethersSigner, setEthersSigner] = useState<providers.JsonRpcSigner | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const embeddedWallet = useMemo(
    () => wallets.find((w) => w.walletClientType === 'privy') || wallets[0],
    [wallets],
  );

  const eoaAddress = authenticated && embeddedWallet?.address ? embeddedWallet.address : undefined;

  useEffect(() => {
    if (!ready || !authenticated || wallets.length > 0) return;
    createWallet().catch((err) => console.error('createWallet failed', err));
  }, [ready, authenticated, wallets.length, createWallet]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!embeddedWallet || !ready || !authenticated || !walletsReady || !eoaAddress) {
        if (alive) {
          setEthersSigner(null);
          setWalletClient(null);
        }
        return;
      }
      try {
        await embeddedWallet.switchChain(polygon.id);
        const provider = await embeddedWallet.getEthereumProvider();
        await provider.request({ method: 'eth_requestAccounts' });

        const account = eoaAddress as `0x${string}`;
        const viemClient = createWalletClient({
          account,
          chain: polygon,
          transport: custom(provider),
        });

        const web3 = new providers.Web3Provider(provider, polygon.id);
        const signer = web3.getSigner(account);

        if (alive) {
          setWalletClient(viemClient);
          setEthersSigner(signer);
        }
      } catch (err) {
        console.error('wallet init failed', err);
        if (alive) {
          setEthersSigner(null);
          setWalletClient(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [embeddedWallet, ready, authenticated, walletsReady, eoaAddress]);

  const walletReady = Boolean(walletClient && ethersSigner && eoaAddress);

  return (
    <Ctx.Provider
      value={{
        eoaAddress,
        ethersSigner,
        walletClient,
        embeddedWallet,
        walletReady,
        ready,
        authenticated,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
