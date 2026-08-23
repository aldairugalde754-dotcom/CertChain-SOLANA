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
    try {
      const umiInstance = createUmi(endpoint)
        .use(dasApi())
        .use(mplBubblegum());

      if (wallet.connected && wallet.publicKey) {
        umiInstance.use(walletAdapterIdentity(wallet));
      }

      return umiInstance;
    } catch (err) {
      console.warn('Falló la creación de UMI, usando fallback seguro:', err);
      const fallback: any = {
        use: () => fallback,
        rpc: {
          getAsset: async () => { throw new Error('UMI no disponible') },
          getAssetProof: async () => { throw new Error('UMI no disponible') },
        }
      };
      return fallback as any;
    }
  }, [wallet.connected, wallet.publicKey, wallet.adapter, endpoint]);

  return umi;
}