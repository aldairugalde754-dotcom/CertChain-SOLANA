// Tipado global para extensiones de wallet de Solana (Phantom, Solflare, etc.)
declare global {
  interface Window {
    solana?: any;
    solflare?: any;
  }
}

/**
 * Obtiene el proveedor de Phantom Wallet si está disponible en la extensión de Chrome.
 */
export const getPhantomProvider = () => {
  if ('solana' in window) {
    const provider = window.solana;
    if (provider?.isPhantom) {
      return provider;
    }
  }
  return null;
};

/**
 * Obtiene el proveedor de Solflare Wallet si está disponible en la extensión de Chrome.
 */
export const getSolflareProvider = () => {
  if ('solflare' in window) {
    const provider = window.solflare;
    if (provider?.isSolflare) {
      return provider;
    }
  }
  if ('solana' in window && window.solana?.isSolflare) {
    return window.solana;
  }
  return null;
};

/**
 * Detecta y obtiene cualquier wallet de Solana disponible (Solflare o Phantom).
 */
export const getAnySolanaWalletProvider = () => {
  const solflare = getSolflareProvider();
  if (solflare) return { provider: solflare, name: 'Solflare' };

  const phantom = getPhantomProvider();
  if (phantom) return { provider: phantom, name: 'Phantom' };

  if ('solana' in window && window.solana) {
    return { provider: window.solana, name: 'Solana Wallet' };
  }

  return null;
};

/**
 * Conecta Phantom Wallet y devuelve la clave pública en formato Base58.
 */
export const connectPhantomWallet = async (): Promise<string | null> => {
  const provider = getPhantomProvider();
  if (!provider) {
    alert('Phantom Wallet no está instalada. Instala la extensión oficial en Chrome.');
    window.open('https://phantom.app/', '_blank');
    return null;
  }

  try {
    const response = await provider.connect();
    return response.publicKey ? response.publicKey.toString() : (provider.publicKey?.toString() || null);
  } catch (err: any) {
    console.error('Error al conectar Phantom Wallet:', err);
    return null;
  }
};

/**
 * Conecta Solflare Wallet y devuelve la clave pública en formato Base58.
 */
export const connectSolflareWallet = async (): Promise<string | null> => {
  const provider = getSolflareProvider();
  if (!provider) {
    alert('Solflare Wallet no está instalada. Instala la extensión oficial en Chrome.');
    window.open('https://solflare.com/', '_blank');
    return null;
  }

  try {
    const response = await provider.connect();
    // Solflare responde con objeto o activa provider.publicKey
    if (response && response.publicKey) {
      return response.publicKey.toString();
    }
    if (provider.publicKey) {
      return provider.publicKey.toString();
    }
    return null;
  } catch (err: any) {
    console.error('Error al conectar Solflare Wallet:', err);
    return null;
  }
};

/**
 * Auto-detecta y conecta la wallet disponible (Solflare o Phantom) para auto-completar el formulario.
 */
export const connectAnySolanaWallet = async (): Promise<{ address: string; walletName: string } | null> => {
  const detected = getAnySolanaWalletProvider();

  if (!detected) {
    alert('No se detectó ninguna extensión de wallet (Solflare o Phantom) en Chrome.');
    window.open('https://solflare.com/', '_blank');
    return null;
  }

  try {
    let pubKeyStr: string | null = null;
    const { provider, name } = detected;

    if (name === 'Solflare') {
      pubKeyStr = await connectSolflareWallet();
    } else if (name === 'Phantom') {
      pubKeyStr = await connectPhantomWallet();
    } else {
      const resp = await provider.connect();
      pubKeyStr = resp?.publicKey?.toString() || provider.publicKey?.toString() || null;
    }

    if (pubKeyStr) {
      return { address: pubKeyStr, walletName: name };
    }
    return null;
  } catch (err: any) {
    console.error('Error al conectar la wallet detectada:', err);
    return null;
  }
};

/**
 * Firma un mensaje con la wallet seleccionada (Solflare o Phantom) para autenticar al usuario.
 */
export const signAuthMessage = async (
  message: string,
  targetWallet: 'solflare' | 'phantom' | 'any' = 'any'
): Promise<{ signature: string; publicKey: string } | null> => {
  let provider: any = null;

  if (targetWallet === 'solflare') {
    provider = getSolflareProvider();
  } else if (targetWallet === 'phantom') {
    provider = getPhantomProvider();
  } else {
    const anyW = getAnySolanaWalletProvider();
    provider = anyW?.provider;
  }

  if (!provider) {
    alert('Wallet no disponible para firmar mensaje.');
    return null;
  }

  try {
    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await provider.signMessage(encodedMessage, 'utf8');
    
    // Extraer firma en Uint8Array
    const signatureBytes = signedMessage.signature || signedMessage;
    const signatureHex = Buffer.from(signatureBytes).toString('hex');
    const pubKeyStr = signedMessage.publicKey?.toString() || provider.publicKey?.toString();

    return {
      signature: signatureHex,
      publicKey: pubKeyStr,
    };
  } catch (err: any) {
    console.error('Firma cancelada por el usuario:', err);
    return null;
  }
};
