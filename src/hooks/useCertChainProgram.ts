import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { useUmi } from './useUmi';
import idl from '../idl/certchain.json';
import { getErrorMessageFromCode } from '../idl/errorMap';
import { 
  CERTCHAIN_PROGRAM_ID, 
  BUBBLEGUM_PROGRAM_ID, 
  COMPRESSION_PROGRAM_ID, 
  NOOP_PROGRAM_ID 
} from '../config';

export function useCertChainProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const umi = useUmi();

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      preflightCommitment: 'confirmed',
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    // Program constructor expects the program ID as the second argument and provider as the third
  return new Program(idl as Certchain, provider);
  }, [provider]);

  const getRegistroPda = () => {
    return PublicKey.findProgramAddressSync([Buffer.from('registro_global')], CERTCHAIN_PROGRAM_ID)[0];
  };

  const getEmisorPda = (autoridad: PublicKey) => {
    return PublicKey.findProgramAddressSync([Buffer.from('emisor'), autoridad.toBuffer()], CERTCHAIN_PROGRAM_ID)[0];
  };

  const getCertificadoPda = (assetId: PublicKey) => {
    return PublicKey.findProgramAddressSync([Buffer.from('certificado'), assetId.toBuffer()], CERTCHAIN_PROGRAM_ID)[0];
  };

  async function comprarDirectoCpi({ assetIdStr, vendedorStr, adminStr }: { assetIdStr: string; vendedorStr: string; adminStr: string }) {
    if (!program || !wallet) throw new Error('Programa o Wallet no inicializada');

    try {
      const assetId = new PublicKey(assetIdStr);
      const vendedor = new PublicKey(vendedorStr);
      const admin = new PublicKey(adminStr);

      // Obtener Proof y Metadatos mediante la API DAS de Umi
      const asset = await umi.rpc.getAsset(umiPublicKey(assetIdStr));
      const proof = await umi.rpc.getAssetProof(umiPublicKey(assetIdStr));

      const root = Array.from(Buffer.from(proof.root, 'hex'));
      const dataHash = Array.from(Buffer.from(asset.compression.data_hash, 'hex'));
      const creatorHash = Array.from(Buffer.from(asset.compression.creator_hash, 'hex'));
      const nonce = new BN(asset.compression.leaf_id);
      const index = asset.compression.leaf_id;

      const certificado = getCertificadoPda(assetId);
      const registroGlobal = getRegistroPda();

      const remainingAccounts = proof.proof.map((p: string) => ({
        pubkey: new PublicKey(p),
        isSigner: false,
        isWritable: false,
      }));

      return await program.methods
        .comprarDirecto(root, dataHash, creatorHash, nonce, index)
        .accounts({
          certificado,
          registroGlobal,
          comprador: wallet.publicKey,
          vendedor,
          admin,
          treeConfig: new PublicKey(proof.tree_id),
          merkleTree: new PublicKey(proof.tree_id),
          logWrapper: NOOP_PROGRAM_ID,
          compressionProgram: COMPRESSION_PROGRAM_ID,
          bubblegumProgram: BUBBLEGUM_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();
    } catch (err: any) {
      const code = err?.error?.code || err?.code || null;
      const mapped = code ? getErrorMessageFromCode(Number(code)) : null;
      throw new Error(mapped || err.message || String(err));
    }
  }

  return { 
    program, 
    provider, 
    wallet,
    getRegistroPda,
    getEmisorPda,
    getCertificadoPda,
    comprarDirectoCpi,
  };
}