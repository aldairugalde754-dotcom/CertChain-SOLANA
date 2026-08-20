// Re-exportamos y extendemos utilidades desde solanaWallet.ts para mantener compatibilidad total con Solflare y Phantom
export {
  getPhantomProvider,
  getSolflareProvider,
  getAnySolanaWalletProvider,
  connectPhantomWallet,
  connectSolflareWallet,
  connectAnySolanaWallet,
  signAuthMessage
} from './solanaWallet';