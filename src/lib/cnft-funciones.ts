import { createTree, mintV1 } from '@metaplex-foundation/mpl-bubblegum';
import { generateSigner, publicKey as umiPublicKey, none } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';

// Crear el Árbol Merkle On-Chain directamente en Devnet
export async function crearArbol(umi: any) {
  const merkleTree = generateSigner(umi);
  
  // Parámetros recomendados en tu manual (maxDepth: 14 = 16,384 cNFTs)
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    canopyDepth: 11, // Evita errores de "Transaction too large"
  });

  await builder.sendAndConfirm(umi);
  console.log("¡Árbol creado exitosamente!", merkleTree.publicKey.toString());
  
  return { merkleTree: merkleTree.publicKey.toString() };
}

// Mintear cNFT en el Merkle Tree especificado
export async function mintearCnft(umi: any, merkleTreeAddress: string, metadataInput: any) {
  try {
    const mintTx = await mintV1(umi, {
      merkleTree: umiPublicKey(merkleTreeAddress),
      leafOwner: umi.identity.publicKey,
      leafDelegate: umi.identity.publicKey,
      metadata: {
        name: metadataInput.name,
        symbol: metadataInput.symbol || 'CERT',
        uri: metadataInput.uri,
        sellerFeeBasisPoints: metadataInput.sellerFeeBasisPoints || 0,
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

    let signatureBase58 = "";
    if (typeof mintTx.signature === 'string') {
      signatureBase58 = mintTx.signature;
    } else if (mintTx.signature instanceof Uint8Array || ArrayBuffer.isView(mintTx.signature)) {
      signatureBase58 = base58.deserialize(mintTx.signature)[0];
    } else if (Array.isArray(mintTx.signature)) {
      signatureBase58 = base58.deserialize(new Uint8Array(mintTx.signature))[0];
    }

    return {
      signature: signatureBase58,
      assetId: signatureBase58,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('AccountNotInitialized') || msg.includes('0xbc4') || msg.includes('tree_authority') || msg.includes('3012')) {
      const customErr: any = new Error(
        `El Merkle Tree (${merkleTreeAddress}) no está inicializado en la red Solana (AccountNotInitialized: 0xbc4).`
      );
      customErr.originalError = err;
      customErr.isAccountNotInitialized = true;
      throw customErr;
    }
    throw err;
  }
}