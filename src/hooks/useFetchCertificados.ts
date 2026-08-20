import { useState, useEffect, useCallback } from 'react';
import { useUmi } from './useUmi';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { PublicKey } from '@solana/web3.js';

export interface CNFTAsset {
  id: string;
  interface: string;
  content?: {
    json_uri?: string;
    metadata?: {
      name?: string;
      symbol?: string;
      description?: string;
      attributes?: Array<{ trait_type: string; value: any }>;
    };
    links?: {
      image?: string;
    };
  };
  ownership?: {
    owner: string;
    delegated: boolean;
    delegate?: string;
  };
  compression?: {
    eligible: boolean;
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
    tree: string;
    seq: number;
    leaf_id: number;
  };
}

/**
 * Hook para consultar e indexar cNFTs minteados por una wallet específica usando DAS API.
 */
export function useFetchCertificados(ownerWalletStr?: string) {
  const umi = useUmi();
  const [certificates, setCertificates] = useState<CNFTAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificates = useCallback(async () => {
    if (!ownerWalletStr || !ownerWalletStr.trim()) {
      setCertificates([]);
      return;
    }

    // Validar clave pública de la wallet a consultar
    try {
      new PublicKey(ownerWalletStr.trim());
    } catch {
      setError("La clave pública provista para consultar no es válida.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let assets: any;
      
      // Consultar DAS API mediante getAssetsByOwner
      if (typeof (umi.rpc as any).getAssetsByOwner === 'function') {
        assets = await (umi.rpc as any).getAssetsByOwner({
          owner: umiPublicKey(ownerWalletStr.trim()),
          page: 1,
          limit: 100,
        });
      } else {
        // Invocación RPC directa para DAS API
        assets = await umi.rpc.call('getAssetsByOwner', [
          {
            ownerAddress: ownerWalletStr.trim(),
            page: 1,
            limit: 100,
          },
        ]);
      }

      const rawItems = assets?.items || assets || [];
      const compressedItems: CNFTAsset[] = rawItems.filter(
        (asset: any) => asset.compression?.compressed === true || asset.interface === 'V1_NFT'
      );

      setCertificates(compressedItems);
    } catch (err: any) {
      console.error("Error consultando cNFTs mediante DAS API:", err);
      setError(err.message || "Error al comunicarse con la DAS API para obtener los activos.");
    } finally {
      setLoading(false);
    }
  }, [umi, ownerWalletStr]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  return { certificates, loading, error, refetch: fetchCertificates };
}
