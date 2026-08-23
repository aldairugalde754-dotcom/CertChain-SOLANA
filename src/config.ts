// Central API and RPC Configuration for CertChain

const getBackendUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_API_URL) return process.env.VITE_API_URL as string;
    if (process.env.VITE_BACKEND_URL) return process.env.VITE_BACKEND_URL as string;
    if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL as string;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
    // En Vercel / producción en línea, return '' para que las llamadas a /api/ 
    // sean redirigidas automáticamente por el rewrite de vercel.json a Render
    return '';
  }
  return '';
};

export const API_BASE_URL = getBackendUrl();

export const DAS_RPC_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DAS_RPC) ||
  process.env.REACT_APP_DAS_RPC ||
  process.env.VITE_DAS_RPC ||
  'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1';

export const DEFAULT_MERKLE_TREE_PUBKEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MERKLE_TREE_PUBKEY) ||
  process.env.REACT_APP_CERTCHAIN_MERKLE ||
  '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a';

// Solana RPC endpoint (used as a fallback when import.meta.env.VITE_SOLANA_RPC_URL is not set)
export const SOLANA_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOLANA_RPC_URL) ||
  process.env.REACT_APP_SOLANA_RPC ||
  process.env.VITE_SOLANA_RPC ||
  'https://api.devnet.solana.com';

// Program IDs and related constants (export as PublicKey for consumers)
import { PublicKey, SystemProgram } from '@solana/web3.js';

function getEnvVar(name: string) {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) return import.meta.env[name];
  if (typeof process !== 'undefined' && (process.env as any)[name]) return (process.env as any)[name];
  return undefined;
}

export const CERTCHAIN_PROGRAM_ID = new PublicKey(
  getEnvVar('VITE_CERTCHAIN_PROGRAM_ID') || getEnvVar('REACT_APP_CERTCHAIN_PROGRAM_ID') || '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a'
);

export const BUBBLEGUM_PROGRAM_ID = new PublicKey(
  getEnvVar('VITE_BUBBLEGUM_PROGRAM_ID') || getEnvVar('REACT_APP_BUBBLEGUM_PROGRAM_ID') || SystemProgram.programId.toBase58()
);

export const COMPRESSION_PROGRAM_ID = new PublicKey(
  getEnvVar('VITE_COMPRESSION_PROGRAM_ID') || getEnvVar('REACT_APP_COMPRESSION_PROGRAM_ID') || SystemProgram.programId.toBase58()
);

export const NOOP_PROGRAM_ID = new PublicKey(
  getEnvVar('VITE_NOOP_PROGRAM_ID') || getEnvVar('REACT_APP_NOOP_PROGRAM_ID') || SystemProgram.programId.toBase58()
);