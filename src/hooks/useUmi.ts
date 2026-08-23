import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SOLANA_ENDPOINT } from '../config';

export function useUmi() {
  const wallet = useWallet();
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || SOLANA_ENDPOINT || "https://api.devnet.solana.com";

  const [umi, setUmi] = useState<any>(() => {
    // initial fallback stub to avoid runtime render errors
    return {
      use: () => umi,
      rpc: {
        getAsset: async () => { throw new Error('UMI no disponible aún') },
        getAssetProof: async () => { throw new Error('UMI no disponible aún') },
      }
    }
  });

  useEffect(() => {
    let mounted = true;

    async function initUmi() {
      try {
        const [{ createUmi }, { dasApi }, { mplBubblegum }, { walletAdapterIdentity }] = await Promise.all([
          import('@metaplex-foundation/umi-bundle-defaults'),
          import('@metaplex-foundation/digital-asset-standard-api'),
          import('@metaplex-foundation/mpl-bubblegum'),
          import('@metaplex-foundation/umi-signer-wallet-adapters')
        ])

        const umiInstance = createUmi(endpoint)
          .use(dasApi())
          .use(mplBubblegum());

        if (wallet.connected && wallet.publicKey) {
          umiInstance.use(walletAdapterIdentity(wallet));
        }

        if (mounted) setUmi(umiInstance);
      } catch (err) {
        console.warn('Error inicializando UMI dinámicamente:', err);
      }
    }

    initUmi();

    return () => { mounted = false }
  }, [endpoint, wallet.connected, wallet.publicKey]);

  return umi;
}