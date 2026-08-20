import { useMemo } from 'react';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { useWallet } from '@solana/wallet-adapter-react';
import { SOLANA_ENDPOINT } from '../config';

export function useUmi() {
  const wallet = useWallet();
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || SOLANA_ENDPOINT || "https://api.devnet.solana.com";

  const umi = useMemo(() => {
    const umiInstance = createUmi(endpoint)
      .use(dasApi())
      .use(mplBubblegum());

    if (wallet.connected && wallet.publicKey) {
      umiInstance.use(walletAdapterIdentity(wallet));
    }

    return umiInstance;
  }, [wallet.connected, wallet.publicKey, wallet.adapter, endpoint]);

  return umi;
}