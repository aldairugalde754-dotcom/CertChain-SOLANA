import React, { FC, ReactNode, useMemo, createContext, useContext, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
// Wallet adapters are loaded dynamically below to remain compatible
// with differing installed package versions and avoid bundling errors.
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';

import { SOLANA_ENDPOINT } from './config';
import '@solana/wallet-adapter-react-ui/styles.css';

const UmiContext = createContext<any>(null);

export const useUmi = () => {
  const context = useContext(UmiContext);
  if (!context) throw new Error("useUmi debe usarse dentro de SolanaAppProvider");
  return context.umi;
};

const UmiBridgeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const wallet = useWallet();

  const umi = useMemo(() => {
    const u = createUmi(SOLANA_ENDPOINT)
      .use(mplBubblegum())
      .use(dasApi());

    if (wallet.publicKey) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
  }, [wallet.publicKey, wallet.connected]);

  return (
    <UmiContext.Provider value={{ umi }}>
      {children}
    </UmiContext.Provider>
  );
};

export const SolanaAppProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [wallets, setWallets] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    import('@solana/wallet-adapter-wallets')
      .then((mod) => {
        if (!mounted) return;
        const adapters: any[] = [];
        try { if (mod.PhantomWalletAdapter) adapters.push(new mod.PhantomWalletAdapter()); } catch {}
        try { if (mod.SlopeWalletAdapter) adapters.push(new mod.SlopeWalletAdapter()); } catch {}
        setWallets(adapters);
      })
      .catch((err) => console.warn('Failed to load wallet adapters dynamically:', err));
    return () => { mounted = false; };
  }, []);

  return (
    <ConnectionProvider endpoint={SOLANA_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect onError={(err) => console.warn('WalletConnectionError:', err)}>
        <WalletModalProvider>
          <UmiBridgeProvider>
            {children}
          </UmiBridgeProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};