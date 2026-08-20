// Central API and RPC Configuration for CertChain

export const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.VITE_BACKEND_URL ||
  'http://localhost:4000';

export const DAS_RPC_URL =
  process.env.REACT_APP_DAS_RPC ||
  process.env.VITE_DAS_RPC ||
  'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1';

export const DEFAULT_MERKLE_TREE_PUBKEY =
  process.env.REACT_APP_CERTCHAIN_MERKLE ||
  '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a';

// Solana RPC endpoint (used as a fallback when import.meta.env.VITE_SOLANA_RPC_URL is not set)
export const SOLANA_ENDPOINT =
  process.env.REACT_APP_SOLANA_RPC ||
  process.env.VITE_SOLANA_RPC ||
  'https://api.devnet.solana.com';