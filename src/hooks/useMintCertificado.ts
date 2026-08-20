import { useState } from 'react';
import { useUmi } from './useUmi';
import { mintV1 } from '@metaplex-foundation/mpl-bubblegum';
import { publicKey as umiPublicKey, none } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { PublicKey } from '@solana/web3.js';

interface MintCertificadoParams {
  merkleTreeAddress: string; // Dirección del Merkle Tree desplegado
  receptorAddress: string;   // Wallet del propietario inicial / cliente
  metadataUri: string;       // URI del JSON subido a Arweave/IPFS
  titulo: string;            // Nombre del producto/certificado
}

/**
 * Traduce errores técnicos de Solana / Bubblegum a mensajes entendibles para el usuario final.
 */
function parseMintError(err: any): string {
  const msg = err?.message || String(err);

  if (msg.includes("User rejected") || msg.includes("4001") || err?.code === 4001) {
    return "La transacción fue rechazada por el usuario en la wallet.";
  }
  if (msg.includes("insufficient lamports") || msg.includes("0x1") || msg.includes("custom program error: 0x1")) {
    return "Fondos insuficientes (SOL) en tu wallet para cubrir las tarifas de transacción en Devnet.";
  }
  if (msg.includes("TreeFull") || msg.includes("0x1771")) {
    return "El Merkle Tree actual ha alcanzado su capacidad máxima de certificados.";
  }
  if (msg.includes("TreeAuthorityIncorrect") || msg.includes("0x1776")) {
    return "No tienes permisos de autoridad para mintear en este Merkle Tree. Verifica que el árbol sea público o que tu wallet sea el creador del árbol.";
  }
  if (msg.includes("Invalid public key") || msg.includes("publicKey")) {
    return "La dirección de la wallet del receptor o del Merkle Tree es inválida.";
  }
  if (msg.includes("Blockhash not found") || msg.includes("TransactionExpiredBlockheightExceededError")) {
    return "La red Solana tardó en responder (Blockhash expirado). Por favor, reintenta la operación.";
  }

  return msg || "Ocurrió un error inesperado al procesar la firma de la transacción on-chain.";
}

export function useMintCertificado() {
  const umi = useUmi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emitirCertificado = async ({
    merkleTreeAddress,
    receptorAddress,
    metadataUri,
    titulo,
  }: MintCertificadoParams): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      // 1. VALIDACIÓN PREVIA DE AUTENTICACIÓN
      if (!umi.identity.publicKey) {
        throw new Error("Por favor conecta tu wallet (Phantom/Solflare) antes de continuar.");
      }

      // 2. VALIDACIÓN DE CLAVES PÚBLICAS (Solana web3.js + Umi)
      const cleanTreeAddr = merkleTreeAddress?.trim();
      if (!cleanTreeAddr) {
        throw new Error("La dirección del Merkle Tree no está configurada.");
      }
      try {
        new PublicKey(cleanTreeAddr);
      } catch {
        throw new Error(`La dirección del Merkle Tree es una clave pública inválida: ${cleanTreeAddr}`);
      }

      const cleanReceptorAddr = receptorAddress?.trim();
      if (!cleanReceptorAddr) {
        throw new Error("Ingresa la wallet pública del receptor/propietario inicial.");
      }
      try {
        new PublicKey(cleanReceptorAddr);
      } catch {
        throw new Error(`La wallet del receptor no es una clave pública válida de Solana: ${cleanReceptorAddr}`);
      }

      // 3. MINADO DE CNFT EN EL MERKLE TREE CON BUBBLEGUM
      console.log("Enviando instrucción mintV1 a Solana Devnet...");
      const mintTx = await mintV1(umi, {
        merkleTree: umiPublicKey(cleanTreeAddr),
        leafOwner: umiPublicKey(cleanReceptorAddr),
        leafDelegate: umiPublicKey(cleanReceptorAddr),
        metadata: {
          name: titulo,
          symbol: 'CERT',
          uri: metadataUri,
          sellerFeeBasisPoints: 0,
          collection: none(),
          creators: [
            {
              address: umi.identity.publicKey,
              verified: true,
              share: 100,
            },
          ],
        },
      }).sendAndConfirm(umi);

      // 4. CONVERSIÓN ULTRA-CONFIABLE DE LA FIRMA A BASE58
      let signatureBase58 = "";
      if (typeof mintTx.signature === 'string') {
        signatureBase58 = mintTx.signature;
      } else if (mintTx.signature instanceof Uint8Array || ArrayBuffer.isView(mintTx.signature)) {
        signatureBase58 = base58.deserialize(mintTx.signature)[0];
      } else if (Array.isArray(mintTx.signature)) {
        signatureBase58 = base58.deserialize(new Uint8Array(mintTx.signature))[0];
      } else {
        throw new Error("El formato de la firma retornado por la red no es compatible.");
      }

      console.log("Transacción confirmada en la red:", signatureBase58);
      return signatureBase58;

    } catch (err: any) {
      console.error("Error detallado al emitir cNFT:", err);
      const userFriendlyError = parseMintError(err);
      setError(userFriendlyError);
      throw new Error(userFriendlyError);
    } finally {
      setLoading(false);
    }
  };

  return { emitirCertificado, loading, error };
}