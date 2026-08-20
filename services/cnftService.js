import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { publicKey } from '@metaplex-foundation/umi';

const rawRpc = process.env.SOLANA_RPC_URL;
const RPC_HELIUS = (rawRpc && !rawRpc.includes('TU_HELIUS_KEY'))
  ? rawRpc
  : 'https://api.devnet.solana.com';

export const umi = createUmi(RPC_HELIUS)
  .use(mplBubblegum())
  .use(dasApi());


/**
 * Obtiene el proof y los hashes necesarios para transferir/comprar un cNFT en Anchor
 */
export async function obtenerProofCNFT(assetIdString) {
  const assetId = publicKey(assetIdString);
  
  // 1. Obtener Metadatos y Hashes
  const asset = await umi.rpc.getAsset(assetId);
  const proof = await umi.rpc.getAssetProof(assetId);

  // 2. Extraer los arrays de 32 bytes de buffer para Anchor
  const root = Array.from(Buffer.from(proof.root, 'hex'));
  const dataHash = Array.from(Buffer.from(asset.compression.data_hash, 'hex'));
  const creatorHash = Array.from(Buffer.from(asset.compression.creator_hash, 'hex'));

  return {
    root,
    dataHash,
    creatorHash,
    nonce: asset.compression.leaf_id,
    index: asset.compression.leaf_id,
    treeConfig: proof.tree_id, // Deberás derivar el TreeConfig PDA
    merkleTree: proof.tree_id,
    proofPath: proof.proof.map(p => ({ pubkey: new PublicKey(p), isSigner: false, isWritable: false }))
  };
}