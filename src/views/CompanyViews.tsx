import { useState, useRef, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useUmi } from '../hooks/useUmi'
import { useMintCertificado } from '../hooks/useMintCertificado'
import { buildCertificateMetadata, uploadMetadataToStorage, resolveAssetImage, DEFAULT_ASSET_IMAGE } from '../utils/metadata'
import { crearArbol, mintearCnft } from '../lib/cnft-funciones'

import { TopBar, SectionTitle, HashDisplay, StatCard, Badge } from '../components/Shared'
import {
  Upload, Image, X, CheckCircle2, FileCheck, ArrowUpRight, AlertCircle, Plus, Gavel, TrendingUp, BarChart3, Zap, Eye, Trash2, Package, Users, Send, Edit
} from 'lucide-react'

// Merkle Tree pre-desplegado en Solana Devnet para CertChain
const DEFAULT_MERKLE_TREE_PUBKEY = "3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a";

// Backend base URL (use env when available)
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL || 'http://localhost:4000';

function normalizeWalletAddress(value?: string | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.toLowerCase() : null;
}

function formatWalletLabel(value?: string | null) {
  const wallet = String(value ?? '').trim();
  if (!wallet) return 'Sin wallet registrada';
  return wallet.length > 12 ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : wallet;
}

export function CompanyCertify({ user }: { user?: any } = {}) {
  const { connection } = useConnection()
  const { publicKey: walletPublicKey } = useWallet()
  const umi = useUmi()
  const { emitirCertificado, loading: mintLoading, error: mintError } = useMintCertificado()

  const storedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('certchain_user') || 'null') : null;
  const registeredWallet = normalizeWalletAddress(user?.wallet_address || storedUser?.wallet_address);
  const connectedWallet = normalizeWalletAddress(walletPublicKey?.toBase58() || walletPublicKey?.toString());
  const walletMatchesRegistration = !registeredWallet || !connectedWallet || registeredWallet === connectedWallet;

  const validateCompanyWalletForAction = async () => {
    const friendlyWalletMismatch = (details?: string) => {
      const fallback = 'Tu wallet no está autorizada para esta cuenta. Cambia la wallet conectada para continuar.';
      setUiError(details ? `${details} Cambia la wallet conectada para continuar.` : fallback);
    };

    if (!walletPublicKey) {
      friendlyWalletMismatch('Tu cuenta está vinculada a una wallet autorizada.');
      return false;
    }

    if (!connectedWallet) {
      friendlyWalletMismatch('No pudimos leer tu wallet conectada.');
      return false;
    }

    if (registeredWallet && connectedWallet !== registeredWallet) {
      friendlyWalletMismatch(`Esta cuenta está vinculada a otra wallet (${formatWalletLabel(user?.wallet_address || storedUser?.wallet_address)}).`);
      return false;
    }

    try {
      const token = localStorage.getItem('certchain_token');
      const verifyRes = await fetch(`${API_BASE_URL}/api/auth/verify-company-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ wallet_address: walletPublicKey.toString() }),
      });

      const verifyData = verifyRes.ok ? await verifyRes.json() : null;

      if (!verifyRes.ok) {
        const errData = verifyData || { error: 'Tu wallet no está autorizada para esta cuenta.' };
        const rawMessage = errData.error || errData.message || 'Tu wallet no está autorizada para esta cuenta.';
        friendlyWalletMismatch(rawMessage);
        return false;
      }

      if (verifyData && verifyData.verified && verifyData.company_name && user?.company_name && verifyData.company_name !== user.company_name) {
        friendlyWalletMismatch('Esta wallet está registrada para otra empresa.');
        return false;
      }

      if (verifyData && verifyData.registered_wallet) {
        const verifiedWallet = normalizeWalletAddress(verifyData.registered_wallet);
        if (registeredWallet && verifiedWallet && verifiedWallet !== registeredWallet) {
          friendlyWalletMismatch('La wallet registrada en tu cuenta y la wallet conectada no coinciden.');
          return false;
        }
      }
    } catch (error) {
      console.error('Error validando wallet de empresa:', error);
      friendlyWalletMismatch('No pudimos validar tu wallet de empresa en este momento.');
      return false;
    }

    return true;
  };

  const [merkleTreeAddr, setMerkleTreeAddr] = useState<string>(
    localStorage.getItem('certchain_tree') || DEFAULT_MERKLE_TREE_PUBKEY
  );
  const [loadingTree, setLoadingTree] = useState(false);

  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [serie, setSerie] = useState('')
  const [anio, setAnio] = useState(new Date().getFullYear().toString())
  const [origen, setOrigen] = useState('México')
  const [descripcion, setDescripcion] = useState('')
  const [valor, setValor] = useState('')
  const [edicion, setEdicion] = useState('')
  const [walletPropietario, setWalletPropietario] = useState('')

  const [material, setMaterial] = useState('Acero inoxidable 316L')
  const [acabado, setAcabado] = useState('Pulido y satinado')
  const [garantia, setGarantia] = useState('5 años')
  const [peso, setPeso] = useState('180g')

  const [images, setImages] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [uiError, setUiError] = useState<string | null>(null)
  const [txDetails, setTxDetails] = useState<any>(null)
  // URI pública raw de GitHub para metadata (Metaplex V1). Cambia USER/REPO según corresponda.
  const [metadataUri, setMetadataUri] = useState<string>(
    'https://raw.githubusercontent.com/aldairugalde754-dotcom/metadata/refs/heads/main/Ring1'
  );
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setImages(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(f)
    })
    // keep the first dropped file as the primary upload
    if (files.length > 0) setSelectedFile(files[0])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((f, idx) => {
      const reader = new FileReader()
      reader.onload = ev => setImages(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(f)
      // keep the first selected file as the primary upload
      if (idx === 0) setSelectedFile(f)
    })
  }

  const handleUseImageUrl = () => {
    const trimmed = imageUrlInput.trim()
    if (!trimmed) return
    setImages([trimmed, ...images])
    // clear selected file so backend will use image_url instead
    setSelectedFile(null)
    setImageUrlInput('')
  }

  const handleCrearArbol = async () => {
    if (!walletPublicKey) {
      setUiError("Conecta tu wallet primero en la barra superior.");
      return;
    }

    const walletOk = await validateCompanyWalletForAction();
    if (!walletOk) return;

    setUiError(null);
    try {
      setLoadingTree(true);
      setStatusMessage("Creando e inicializando un nuevo Merkle Tree en Solana Devnet...");
      const res = await crearArbol(umi);
      setMerkleTreeAddr(res.merkleTree);
      localStorage.setItem('certchain_tree', res.merkleTree);
    } catch (err: any) {
      console.error("Error creando árbol:", err);
      setUiError("Fallo al crear el Merkle Tree: " + (err.message || String(err)));
    } finally {
      setLoadingTree(false);
      setStatusMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUiError(null)
    setStatusMessage(null)

    const walletOk = await validateCompanyWalletForAction();
    if (!walletOk) return;

    const walletEmisorStr = walletPublicKey?.toBase58();
    if (!walletPublicKey || !walletEmisorStr || !umi.identity.publicKey) {
      setUiError("Por favor, conecta tu wallet Phantom/Solflare desde la barra superior antes de continuar.");
      return
    }

    // 2. Validar wallet destino / propietario
    const trimmedWalletPropietario = walletPropietario ? walletPropietario.trim() : '';
    if (!trimmedWalletPropietario) {
      setUiError("Por favor, ingresa la dirección de wallet del propietario inicial.");
      return;
    }

    try {
      new PublicKey(trimmedWalletPropietario);
    } catch {
      setUiError("La dirección de la wallet del propietario no es una clave pública válida de Solana.");
      return;
    }

    try {
      setLoading(true)

      // 3. Saltar backend local: usar metadataUri público desde estado (GitHub Raw)
      setStatusMessage('1/2 Validando metadata pública y minteando cNFT...');

      // Validar que la metadata pública en GitHub cumpla la estructura esperada
      let metadataJson: any = null;
      try {
        const metaRes = await fetch(metadataUri, { cache: 'no-store' });
        if (!metaRes.ok) throw new Error('No se pudo obtener metadata desde ' + metadataUri);
        metadataJson = await metaRes.json();
      } catch (mErr) {
        console.warn('Fallo al obtener/parsear metadata.json:', mErr);
        setUiError('No se pudo leer la metadata pública en: ' + metadataUri + '. Revisa la URL raw de GitHub.');
        setLoading(false);
        return;
      }

      // Asegurar campos mínimos y usar fallback de formulario
      const metaName = metadataJson.name || nombre || 'Certificado CertChain';
      const metaSymbol = metadataJson.symbol || 'CERT';
      const sellerFee = metadataJson.seller_fee_basis_points || metadataJson.sellerFeeBasisPoints || 0;
      const metaImage = metadataJson.image || null;

      // Mintear usando la metadata pública validada
      const mintResult = await mintearCnft(umi, merkleTreeAddr, {
        name: metaName,
        symbol: metaSymbol,
        uri: metadataUri,
        sellerFeeBasisPoints: sellerFee,
      });

      // Extraer firma y asset id de la respuesta (varios formatos soportados)
      const txSignature =
        mintResult?.signature ||
        mintResult?.txSignature ||
        mintResult?.tx?.signature ||
        mintResult?.transactionHash ||
        (typeof mintResult === 'string' ? mintResult : undefined);

      const assetId =
        mintResult?.assetId ||
        mintResult?.asset?.id ||
        mintResult?.id ||
        mintResult?.minted?.id ||
        null;

      console.log('Mint tx signature:', txSignature);
      console.log('Minted asset id:', assetId);

      // (Opcional) Guardar resultado en backend local
      if (txSignature && assetId) {
        try {
          await fetch(API_BASE_URL + '/api/certificates/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: nombre,
              blockchain_tx: txSignature,
              asset_id: assetId,
              metadata_url: metadataUri,
              image_url: metaImage || undefined,
              owner_wallet: trimmedWalletPropietario,
            }),
          });
          console.log('Registro guardado en backend local (opcional).');
        } catch (saveErr) {
          console.warn('No se pudo guardar en backend local:', saveErr);
        }
      }

      // Actualizar UI con detalles de transacción
      const currentSlot = await connection.getSlot().catch(() => 0);
      setTxDetails({
        id: `CNFT-${assetId || Math.floor(Math.random() * 9000 + 1000)}`,
        hash: txSignature,
        block: currentSlot ? `#${currentSlot.toLocaleString()}` : '#Devnet',
        network: 'Solana Devnet',
        timestamp: new Date().toLocaleString(),
      });

    } catch (error: any) {
      console.error('Error durante el minteo directo:', error);
      setUiError(error?.message || 'Fallo al mintear el cNFT.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  if (txDetails) {
    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <TopBar title="Certificar Producto" subtitle="Emitir certificado en la blockchain de Solana" />
        <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
          <div style={{ background: '#0c0f1d', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: '48px', textAlign: 'center', maxWidth: 480 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={32} color="#22c55e" />
            </div>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, letterSpacing: '0.06em', color: '#22c55e', marginBottom: 8 }}>CERTIFICADO EMITIDO</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#5a6485', marginBottom: 20 }}>El registro inmutable ha sido minteado en Solana</div>
            <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
              {[
                ['ID Certificado', txDetails.id], 
                ['Hash TX', txDetails.hash.slice(0, 12) + '...'], 
                ['Bloque', txDetails.block], 
                ['Red', txDetails.network], 
                ['Timestamp', txDetails.timestamp]
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.06em' }}>{l}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#00c8ff' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-ghost" onClick={() => { setTxDetails(null); setImages([]); setUiError(null); }}>NUEVO CERTIFICADO</button>
              <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={() => window.open(`https://explorer.solana.com/tx/${txDetails.hash}?cluster=devnet`, '_blank')}>
                VER EN EXPLORER <ArrowUpRight size={13} style={{ display: 'inline', marginLeft: 4 }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Certificar Producto" subtitle="Emitir certificado inmutable (cNFT) en la blockchain de Solana" />
      <div style={{ padding: '28px 32px' }}>
        
        {/* Banner de Estado de Merkle Tree */}
        <div style={{ background: '#0c0f1d', border: '1px solid rgba(0, 200, 255, 0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, color: '#00c8ff', letterSpacing: '0.05em' }}>ESTADO DEL MERKLE TREE</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6485', marginTop: 4 }}>
              Árbol Activo: <code style={{ color: '#dde3f0' }}>{merkleTreeAddr}</code>
            </div>
          </div>
          <button 
            type="button"
            className="btn-ghost"
            onClick={handleCrearArbol}
            disabled={loadingTree}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            {loadingTree ? "Inicializando..." : "Crear Nuevo Merkle Tree"}
          </button>
        </div>

        {(uiError || mintError) && (
          <div style={{ marginBottom: 20, padding: '16px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={18} color="#fca5a5" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, color: '#fef2f2', letterSpacing: '0.04em' }}>
                Wallet no autorizada
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#fca5a5' }}>
                {(uiError || mintError)}
              </div>
            </div>
          </div>
        )}

        {!walletMatchesRegistration && registeredWallet && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#fca5a5' }}>
              Wallet registrada: {formatWalletLabel(user?.wallet_address || storedUser?.wallet_address)}
            </div>
          </div>
        )}

        {registeredWallet && connectedWallet && walletMatchesRegistration && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#86efac' }}>
              Wallet verificada: {formatWalletLabel(connectedWallet)}
            </div>
          </div>
        )}

        {statusMessage && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid #00c8ff', borderTopColor: 'transparent', borderRadius: '50%' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#00c8ff' }}>{statusMessage}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
          
          <form onSubmit={handleSubmit}>
            <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: '28px' }}>
              <SectionTitle sub="Información técnica registrada en el contrato inteligente">Datos del Producto</SectionTitle>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Nombre del Producto *</label>
                    <input className="input-base" placeholder="Anillo de Plata Matrimonio" value={nombre} onChange={e => setNombre(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Categoría *</label>
                    <select className="input-base" value={categoria} onChange={e => setCategoria(e.target.value)} required>
                      <option value="">Seleccionar...</option>
                      {['Joyería', 'Relojería', 'Cosmética', 'Electrónica', 'Moda', 'Arte', 'Otro'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>No. de Serie *</label>
                    <input className="input-base" placeholder="PLT-Rj400" value={serie} onChange={e => setSerie(e.target.value)} required style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Año de Fabricación</label>
                    <input className="input-base" type="number" value={anio} onChange={e => setAnio(e.target.value)} placeholder="2026" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>País de Origen</label>
                    <input className="input-base" value={origen} onChange={e => setOrigen(e.target.value)} placeholder="México" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Descripción del Producto *</label>
                  <textarea className="input-base" rows={3} required value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción detallada, pureza del metal, incrustaciones..." style={{ resize: 'none' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Valor de Mercado (USD)</label>
                    <input className="input-base" type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="2500" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Edición / Tiraje</label>
                    <input className="input-base" value={edicion} onChange={e => setEdicion(e.target.value)} placeholder="Pieza Única" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Atributos Adicionales</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', marginBottom: 4 }}>Material principal</div>
                      <input className="input-base" value={material} onChange={e => setMaterial(e.target.value)} style={{ fontSize: 12 }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', marginBottom: 4 }}>Acabado</div>
                      <input className="input-base" value={acabado} onChange={e => setAcabado(e.target.value)} style={{ fontSize: 12 }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', marginBottom: 4 }}>Garantía</div>
                      <input className="input-base" value={garantia} onChange={e => setGarantia(e.target.value)} style={{ fontSize: 12 }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', marginBottom: 4 }}>Peso</div>
                      <input className="input-base" value={peso} onChange={e => setPeso(e.target.value)} style={{ fontSize: 12 }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Wallet del Propietario Inicial (Solana PubKey) *</label>
                  <input className="input-base" value={walletPropietario} onChange={e => setWalletPropietario(e.target.value)} placeholder="Ej. Hx2BvP9J5zXNTRKx..." style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} required />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <button type="submit" className="btn-accent" disabled={loading || mintLoading} style={{ flex: 1, padding: '14px', fontSize: 16, cursor: (loading || mintLoading) ? 'not-allowed' : 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <FileCheck size={16} /> {(loading || mintLoading) ? "PROCESANDO FIRMA EN WALLET..." : "EMITIR CERTIFICADO BLOCKCHAIN"}
                </span>
              </button>
            </div>
          </form>

          {/* Panel de subida de imágenes */}
          <div>
            <div className="glow-border-violet" style={{ background: '#0c0f1d', borderRadius: 14, padding: '24px', border: '1px solid rgba(124,58,237,0.2)' }}>
              <SectionTitle sub="Imágenes que aparecerán en el certificado">Imágenes de Soporte</SectionTitle>

              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'rgba(124,58,237,0.6)' : 'rgba(124,58,237,0.25)'}`,
                  borderRadius: 10, padding: '28px 20px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragging ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.02)',
                  transition: 'all 0.2s',
                  marginBottom: 16,
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Upload size={20} color="#7c3aed" />
                </div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 15, fontWeight: 700, color: '#dde3f0', marginBottom: 4 }}>ARRASTRA O SELECCIONA</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>PNG, JPG, WEBP · Máx. 10MB</div>
                <input ref={fileRef} name="image" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileInput} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input
                    value={imageUrlInput}
                    onChange={e => setImageUrlInput(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="Pega URL pública de imagen (https://...)"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-ghost" onClick={(e) => { e.stopPropagation(); handleUseImageUrl(); }} style={{ padding: '6px 10px' }}>
                    Usar URL
                  </button>
                </div>
              </div>

              {images.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {images.slice(0, 6).map((src, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#080a12' }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={10} color="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ aspectRatio: '1', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Image size={16} color="#3a2d5a" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// Helper to abbreviate long ids (e.g. S3e3...cCF)
function shortId(id: any) {
  if (!id && id !== 0) return ''
  const s = String(id)
  if (s.length <= 10) return s
  return `${s.slice(0, 4)}...${s.slice(-4)}`
}



// ─── COMPANY AUCTIONS MANAGEMENT ─────────────────────────────────────────────

const COMPANY_AUCTIONS = [
  { id: 'AUC-001', name: 'Anillo Oro Blanco 18k Solitario', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=300&fit=crop&auto=format', currentBid: '3,200', totalBids: 18, endTime: { h: '04', m: '12', s: '45' }, status: 'live' },
  { id: 'AUC-002', name: 'Reloj Chronograph Edición Especial', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop&auto=format', currentBid: '8,500', totalBids: 32, endTime: { h: '00', m: '45', s: '10' }, status: 'ending' },
];

export function CompanyAuctionDash() {
  const [showCreate, setShowCreate] = useState(false);
  const { publicKey } = useWallet()
  const [ownedCerts, setOwnedCerts] = useState<any[]>([])
  const [auctions, setAuctions] = useState<any[]>([])
  const [marketplaceIds, setMarketplaceIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [selectedAsset, setSelectedAsset] = useState<string>('')
  const [startingPrice, setStartingPrice] = useState<string>('')
  const [reservePrice, setReservePrice] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [auctionDesc, setAuctionDesc] = useState<string>('')
  const [auctionTitle, setAuctionTitle] = useState<string>('')

  const RPC_URL = process.env.REACT_APP_DAS_RPC || process.env.VITE_DAS_RPC || 'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1'

  const refreshAuctions = async () => {
    if (!publicKey) return
    setLoading(true)
    try {
      const [rows, statsJson] = await Promise.all([
        fetch(`${API_BASE_URL}/api/auctions/seller/${publicKey.toString()}`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/auctions/stats`).then(r => r.ok ? r.json() : null)
      ])
      const nextAuctions = Array.isArray(rows) ? rows : []
      setAuctions(nextAuctions)
      setStats(statsJson)
      setError(null)
      if (selectedAsset && nextAuctions.some((a: any) => String(a.asset_id || a.id) === String(selectedAsset))) {
        setSelectedAsset('')
      }
    } catch (e) {
      console.error('Error loading auctions', e)
      setAuctions([])
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!publicKey) return

    fetch(`${API_BASE_URL}/api/marketplace/listings`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        const ids = new Set((Array.isArray(rows) ? rows : []).map((row: any) => String(row.asset_id || row.id || '')).filter(Boolean))
        setMarketplaceIds(ids)
      })
      .catch(() => setMarketplaceIds(new Set()))

    const payload = { jsonrpc: '2.0', id: 'company-owner-assets', method: 'getAssetsByOwner', params: { ownerAddress: publicKey.toString(), page: 1, limit: 1000 } }
    fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        const candidates = json.result?.assets || json.result?.items || json.result || json.assets || []
        const rawAssets = Array.isArray(candidates) ? candidates : (Array.isArray(json.result?.data) ? json.result.data : [])
        const compressed = rawAssets.filter((a: any) => a?.compression?.compressed === true && (a?.burnt === false || a?.burnt === undefined))
        const CERTCHAIN_MERKLE_TREE_PUBKEY = process.env.REACT_APP_CERTCHAIN_MERKLE || '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a'
        const filtered = compressed.filter((asset: any) => {
          const symbol = (asset?.content?.metadata?.symbol || '').toString().toUpperCase();
          const tree = String(asset?.compression?.tree || '');
          if (symbol === 'CERT') return true;
          if (tree === CERTCHAIN_MERKLE_TREE_PUBKEY) return true;
          const attrs = asset?.content?.metadata?.attributes || asset?.content?.attributes || [];
          return Array.isArray(attrs) && attrs.some((t: any) => String(t.value || t.trait_value || '').toLowerCase().includes('certchain'));
        })
        setOwnedCerts(filtered)
      }).catch(e => { console.error('Error loading owner certs from DAS', e); setOwnedCerts([]) })

    refreshAuctions()
  }, [publicKey])

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) { alert('Conecta tu wallet'); return }
    if (!selectedAsset || !startingPrice || !endTime) { alert('Completa activo, precio inicial y fecha de fin'); return }
    try {
      const parsedDate = new Date(endTime);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error('La fecha de cierre no es válida');
      }
      const normalizedEndTime = parsedDate.toISOString().slice(0, 19).replace('T', ' ');
      const selectedAssetInfo = ownedCerts.find((asset: any) => String(asset.asset_id || asset.id) === String(selectedAsset));
      const resolvedImage = resolveAssetImage(selectedAssetInfo) || DEFAULT_ASSET_IMAGE;
      const resolvedTitle = auctionTitle || selectedAssetInfo?.content?.metadata?.name || selectedAssetInfo?.product_name || selectedAssetInfo?.name || `Subasta ${selectedAsset}`;
      const payload = {
        asset_id: selectedAsset,
        seller_wallet: publicKey.toString(),
        starting_price: Number(startingPrice),
        reserve_price: Number(reservePrice || startingPrice),
        end_time: normalizedEndTime,
        description: auctionDesc || null,
        title: resolvedTitle,
        image: resolvedImage,
        category: 'General',
      };
      const res = await fetch(`${API_BASE_URL}/api/auctions/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'No se pudo crear la subasta' }));
        if (res.status === 409) {
          setShowCreate(false);
          setSelectedAsset('');
          setStartingPrice('');
          setReservePrice('');
          setEndTime('');
          setAuctionDesc('');
          setAuctionTitle('');
          await refreshAuctions();
          return;
        }
        if (res.status === 404) {
          throw new Error('El backend no está disponible en ' + API_BASE_URL + '. Inicia el servidor en puerto 4000.');
        }
        throw new Error(err.error || 'Error creando subasta');
      }
      setShowCreate(false);
      setSelectedAsset('');
      setStartingPrice('');
      setReservePrice('');
      setEndTime('');
      setAuctionDesc('');
      setAuctionTitle('');
      await refreshAuctions();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error creando subasta');
    }
  }

  const handleDeleteAuction = async (assetId: string) => {
    if (!confirm('¿Eliminar esta subasta?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auctions/list/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error eliminando');
      refreshAuctions();
    } catch (err: any) {
      console.error('Error deleting auction', err);
      alert(err.message || 'Error eliminando subasta');
    }
  }

  const statusColor: Record<string, string> = {
    live: '#22c55e', ending: '#f59e0b', upcoming: '#00c8ff', ended: '#5a6485',
  };
  const statusLabel: Record<string, string> = {
    live: 'En vivo', ending: 'Terminando', upcoming: 'Próximamente', ended: 'Finalizada',
  };

  const activeAuctionIds = new Set(
    auctions
      .filter((auction: any) => !!auction?.asset_id || !!auction?.id)
      .map((auction: any) => String(auction.asset_id || auction.id || ''))
      .filter(Boolean)
  );
  const blockedAssetIds = new Set([...activeAuctionIds, ...marketplaceIds])
  const availableToAuction = ownedCerts.filter((asset: any) => {
    const assetId = String(asset.asset_id || asset.id || '')
    return assetId ? !blockedAssetIds.has(assetId) : true
  })

  useEffect(() => {
    if (selectedAsset && availableToAuction.every((asset: any) => String(asset.asset_id || asset.id || '') !== String(selectedAsset))) {
      setSelectedAsset('')
    }
  }, [availableToAuction, selectedAsset])

  const renderStatus = (auction: any) => {
    const isEnded = new Date(auction.end_time).getTime() <= Date.now();
    const status = isEnded ? 'ended' : 'live';
    return <Badge color={statusColor[status]}>{statusLabel[status]}</Badge>;
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar
        title="Gestión de Subastas"
        subtitle="Controla y monitorea tus subastas activas"
        actions={
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setShowCreate(true)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> CREAR SUBASTA</span>
          </button>
        }
      />
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
          <StatCard label="Subastas activas" value={String(stats?.total_auctions ?? auctions.filter((a: any) => new Date(a.end_time).getTime() > Date.now()).length)} icon={<Gavel size={16} />} color="#22c55e" />
          <StatCard label="Pujas totales" value={String(stats?.total_bids ?? 0)} icon={<TrendingUp size={16} />} color="#00c8ff" />
          <StatCard label="Monto total pujas (USD)" value={`$${Number(stats?.total_bid_value || 0).toFixed(2)}`} icon={<BarChart3 size={16} />} color="#7c3aed" />
          <StatCard label="Tasa de éxito" value="87%" icon={<Zap size={16} />} color="#f59e0b" />
        </div>

        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#0c0f1d', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 520 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, letterSpacing: '0.06em' }}>CREAR SUBASTA</div>
                <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6485' }}><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateAuction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Producto (cNFT)</label>
                  <select className="input-base" value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}>
                    <option value="">Seleccionar cNFT...</option>
                    {availableToAuction.map((pr: any) => (
                      <option key={pr.asset_id || pr.id} value={pr.asset_id || pr.id}>{pr.content?.metadata?.name || pr.product_name || pr.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Título</label>
                  <input className="input-base" value={auctionTitle} onChange={(e) => setAuctionTitle(e.target.value)} placeholder="Ej. Anillo Oro Blanco" />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Precio inicial (USD)</label>
                  <input className="input-base" type="number" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} placeholder="1000" />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Precio de reserva (USD)</label>
                  <input className="input-base" type="number" value={reservePrice} onChange={(e) => setReservePrice(e.target.value)} placeholder="1200" />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Fecha de cierre</label>
                  <input className="input-base" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Descripción</label>
                  <textarea className="input-base" rows={3} value={auctionDesc} onChange={(e) => setAuctionDesc(e.target.value)} placeholder="Describe la pieza y el estado" style={{ resize: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>CANCELAR</button>
                  <button type="submit" className="btn-accent" style={{ flex: 1 }}>PUBLICAR</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <SectionTitle sub="Todas tus subastas">Mis Subastas</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: 20 }}>Cargando subastas...</div>
          ) : error ? (
            <div style={{ gridColumn: '1 / -1', padding: 20, color: 'salmon' }}>{error}</div>
          ) : auctions.filter((a: any) => new Date(a.end_time).getTime() > Date.now()).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: 20 }}>No tienes subastas activas</div>
          ) : auctions.filter((a: any) => new Date(a.end_time).getTime() > Date.now()).map((a: any) => {
                const timeLeft = new Date(a.end_time).getTime() - Date.now();
                const hours = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
                const minutes = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
                const seconds = Math.max(0, Math.floor((timeLeft % (1000 * 60)) / 1000));
                const ended = timeLeft <= 0;
                const imageUrl = resolveAssetImage(a) || DEFAULT_ASSET_IMAGE;
                return (
                  <div key={a.id || a.asset_id} className="glow-border card-hover" style={{ background: '#0c0f1d', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ height: 160, position: 'relative' }}>
                      <img
                        src={imageUrl}
                        alt={a.title || `Cert ${a.asset_id}`}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_ASSET_IMAGE; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82 }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,9,15,0.82), transparent)' }} />
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>{renderStatus(a)}</div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, letterSpacing: '0.03em', marginBottom: 4 }}>{a.title || `Cert ${a.asset_id}`}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>{shortId(a.asset_id)}</div>
                        <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: '#00c8ff' }}>${Number(a.current_bid || a.starting_price || 0).toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', textTransform: 'uppercase' }}>Puja</div>
                          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, color: '#00c8ff' }}>${Number(a.current_bid || a.starting_price || 0).toFixed(2)}</div>
                        </div>
                        <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', textTransform: 'uppercase' }}>Tiempo</div>
                          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#dde3f0' }}>
                            {ended ? 'Finalizada' : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn-ghost" style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Eye size={11} /> VER</span>
                        </button>
                        <button type="button" onClick={() => handleDeleteAuction(a.asset_id)} style={{ padding: '6px 10px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 6, cursor: 'pointer', color: '#ff6b6b' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
        </div>
      </div>
    </div>
  );
}

// ─── COMPANY MARKETPLACE MANAGEMENT ──────────────────────────────────────────

export function CompanyMarketDash() {
  const [showAdd, setShowAdd] = useState(false);
  const { publicKey } = useWallet()
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownedCerts, setOwnedCerts] = useState<any[]>([])
  const [availableToList, setAvailableToList] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

  const [selectedToList, setSelectedToList] = useState<string | null>(null)
  const [priceToList, setPriceToList] = useState<string>('')
  const [descToList, setDescToList] = useState<string>('')
  const [catToList, setCatToList] = useState<string>('General')
  const [showEdit, setShowEdit] = useState(false)
  const [editListing, setEditListing] = useState<any | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editPrice, setEditPrice] = useState<string>('')
  const [editDesc, setEditDesc] = useState<string>('')
  const [editCat, setEditCat] = useState<string>('General')
  const [editImage, setEditImage] = useState<string>('')

  const RPC_URL = process.env.REACT_APP_DAS_RPC || process.env.VITE_DAS_RPC || 'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1'

  useEffect(() => {
    if (!publicKey) return
    // Fetch owner cNFTs from DAS (compressed CertChain assets) for listing modal
    const payload = { jsonrpc: '2.0', id: 'company-owner-assets', method: 'getAssetsByOwner', params: { ownerAddress: publicKey.toString(), page: 1, limit: 1000 } }
    fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        const candidates = json.result?.assets || json.result?.items || json.result || json.assets || []
        const rawAssets = Array.isArray(candidates) ? candidates : (Array.isArray(json.result?.data) ? json.result.data : [])
        const compressed = rawAssets.filter((a: any) => a?.compression?.compressed === true && (a?.burnt === false || a?.burnt === undefined))
        const CERTCHAIN_MERKLE_TREE_PUBKEY = process.env.REACT_APP_CERTCHAIN_MERKLE || '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a'
        const filtered = compressed.filter((asset: any) => {
          const symbol = (asset?.content?.metadata?.symbol || '').toString().toUpperCase()
          const tree = String(asset?.compression?.tree || '')
          if (symbol === 'CERT') return true
          if (tree === CERTCHAIN_MERKLE_TREE_PUBKEY) return true
          const attrs = asset?.content?.metadata?.attributes || asset?.content?.attributes || []
          return Array.isArray(attrs) && attrs.some((t: any) => String(t.value || t.trait_value || '').toLowerCase().includes('certchain'))
        })
        setOwnedCerts(filtered)
      }).catch(e => { console.error('Error loading owner certs from DAS', e); setOwnedCerts([]) })
  }, [publicKey])

  useEffect(() => {
    // compute available to list by excluding existing listings
    try {
      const listed = new Set(listings.map(l => String(l.asset_id)))
      const avail = ownedCerts.filter(c => !listed.has(String(c.asset_id || c.id)))
      setAvailableToList(avail)
    } catch (e) {
      setAvailableToList(ownedCerts)
    }
  }, [ownedCerts, listings])

  useEffect(() => {
    if (!publicKey) return
    setLoading(true)
    fetch(`${API_BASE_URL}/api/marketplace/seller/${publicKey.toString()}`).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(json => {
      setListings(Array.isArray(json) ? json : [])
    }).catch(e => { console.error('Error loading listings', e); setError(String(e)) }).finally(() => setLoading(false))
    // fetch stats for KPI cards
    fetch(`${API_BASE_URL}/api/marketplace/stats`).then(r => r.ok ? r.json() : Promise.resolve(null)).then(json => setStats(json)).catch(e => console.warn('Error fetching marketplace stats', e))
  }, [publicKey])

  const handleDelete = async (assetId: string) => {
    if (!confirm('¿Eliminar listado?')) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplace/list/${encodeURIComponent(assetId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminando')
      setListings(prev => prev.filter(l => l.asset_id !== assetId))
    } catch (e: any) {
      console.error(e); alert('Error eliminando: ' + (e.message || e))
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar
        title="Gestión de Marketplace"
        subtitle="Productos en venta al público"
        actions={
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setShowAdd(true)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> LISTAR PRODUCTO</span>
          </button>
        }
      />
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
          <StatCard label="En venta" value={String(stats?.total_listings ?? listings.length)} icon={<Package size={16} />} color="#00c8ff" />
          <StatCard label="Listados 30d" value={String(stats?.recent_listings ?? 0)} icon={<TrendingUp size={16} />} color="#22c55e" delta={stats?.recent_listings ? `+${stats.recent_listings}` : undefined} />
          <StatCard label="Valor potencial 30d (USD)" value={`$${Number(stats?.recent_value || 0).toFixed(2)}`} icon={<BarChart3 size={16} />} color="#7c3aed" />
          <StatCard label="Nuevos certificados 30d" value={String(stats?.new_certs ?? 0)} icon={<Users size={16} />} color="#f59e0b" />
        </div>

        {showAdd && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#0c0f1d', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, letterSpacing: '0.06em' }}>LISTAR EN MARKETPLACE</div>
                <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6485' }}><X size={18} /></button>
              </div>
              <form onSubmit={async (e) => { e.preventDefault();
                  if (!selectedToList) { alert('Selecciona un cNFT para listar'); return }
                  if (!priceToList || Number(priceToList) <= 0) { alert('Ingresa un precio válido'); return }
                  try {
                    const asset = (availableToList.length ? availableToList : ownedCerts).find((c:any) => String(c.asset_id || c.id) === String(selectedToList))
                    const title = asset?.content?.metadata?.name || asset?.product_name || asset?.name || `Cert ${selectedToList}`
                    const image = resolveAssetImage(asset) || DEFAULT_ASSET_IMAGE
                    const payload = { asset_id: selectedToList, seller_wallet: publicKey?.toString(), price_usd: Number(priceToList), description: descToList || null, title, image, category: catToList }
                    const res = await fetch(`${API_BASE_URL}/api/marketplace/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                    if (!res.ok) {
                      const err = await res.json().catch(()=>({}));
                      throw new Error(err.error || 'Error publicando listing ' + res.status)
                    }
                    // refresh seller listings
                    setShowAdd(false)
                    setSelectedToList(null); setPriceToList(''); setDescToList(''); setCatToList('General')
                    // reload listings
                    setLoading(true)
                    fetch(`${API_BASE_URL}/api/marketplace/seller/${publicKey.toString()}`).then(r => r.ok ? r.json() : []).then(json => setListings(Array.isArray(json) ? json : [])).catch(e => console.error('Error reloading listings', e)).finally(() => setLoading(false))
                  } catch (err:any) { console.error('Error publicando listing', err); alert(err.message || String(err)) }
                }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Producto cNFT</label>
                  <select className="input-base" value={selectedToList || ''} onChange={e => setSelectedToList(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {(availableToList.length === 0 ? ownedCerts : availableToList).map((c: any) => (
                      <option key={c.asset_id || c.id} value={c.asset_id || c.id}>{(c.content?.metadata?.name || c.product_name || c.id)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Precio (USD)</label>
                  <input className="input-base" type="number" placeholder="2500" required value={priceToList} onChange={e => setPriceToList(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Descripción de venta</label>
                  <textarea className="input-base" rows={3} placeholder="Describe el estado del producto..." style={{ resize: 'none' }} value={descToList} onChange={e => setDescToList(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>CANCELAR</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>PUBLICAR</button>
                </div>
              </form>
            </div>
          </div>
        )}

          {showEdit && editListing && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: '#0c0f1d', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 16, padding: '28px', width: '100%', maxWidth: 520 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700 }}>EDITAR LISTADO</div>
                  <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6485' }}><X size={18} /></button>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editListing) return;
                  try {
                    const payload = { title: editTitle, price_usd: Number(editPrice), description: editDesc || null, category: editCat, image: editImage || null }
                    const res = await fetch(`${API_BASE_URL}/api/marketplace/list/${encodeURIComponent(editListing.asset_id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                    if (!res.ok) {
                      const err = await res.json().catch(()=>({}));
                      throw new Error(err.error || 'Error actualizando listing ' + res.status)
                    }
                    setShowEdit(false)
                    setEditListing(null)
                    // refresh listings
                    setLoading(true)
                    fetch(`${API_BASE_URL}/api/marketplace/seller/${publicKey.toString()}`).then(r => r.ok ? r.json() : []).then(json => setListings(Array.isArray(json) ? json : [])).catch(e => console.error('Error reloading listings', e)).finally(() => setLoading(false))
                  } catch (err:any) { console.error('Error actualizando listing', err); alert(err.message || String(err)) }
                }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', marginBottom: 6 }}>Título</label>
                    <input className="input-base" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', marginBottom: 6 }}>Precio (USD)</label>
                    <input className="input-base" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', marginBottom: 6 }}>Descripción</label>
                    <textarea className="input-base" rows={3} value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ resize: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', marginBottom: 6 }}>Categoría</label>
                    <input className="input-base" value={editCat} onChange={e => setEditCat(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', marginBottom: 6 }}>Imagen (URL)</label>
                    <input className="input-base" value={editImage} onChange={e => setEditImage(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowEdit(false)}>CANCELAR</button>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>GUARDAR</button>
                  </div>
                </form>
              </div>
            </div>
          )}

        <SectionTitle sub="Todos tus productos publicados">Productos Activos</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {loading ? (
            <div>Cargando listings...</div>
          ) : error ? (
            <div style={{ color: 'salmon' }}>{error}</div>
          ) : listings.length === 0 ? (
            <div>No tienes productos publicados en el marketplace</div>
          ) : listings.map(p => (
            <div key={p.asset_id} className="glow-border card-hover" style={{ background: '#0c0f1d', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ height: 120, position: 'relative' }}>
                <img
                  src={resolveAssetImage(p) || DEFAULT_ASSET_IMAGE}
                  alt={p.title || p.asset_id}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_ASSET_IMAGE; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,9,15,0.8), transparent)' }} />
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  <Badge color="#22c55e">Activo</Badge>
                </div>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, letterSpacing: '0.03em', marginBottom: 4 }}>{p.title || (`Cert ${p.asset_id}`)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>{shortId(p.asset_id)}</div>
                  <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: '#00c8ff' }}>${Number(p.price_usd).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" style={{ flex: 1, padding: '6px 8px', fontSize: 11 }} onClick={() => {
                    setEditListing(p)
                    setEditTitle(p.title || '')
                    setEditPrice(String(p.price_usd || ''))
                    setEditDesc(p.description || '')
                    setEditCat(p.category || 'General')
                    setEditImage(p.image || '')
                    setShowEdit(true)
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Edit size={11} /> EDITAR</span>
                  </button>
                  <button onClick={() => handleDelete(p.asset_id)} style={{ padding: '6px 10px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 6, cursor: 'pointer', color: '#ff6b6b' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COMPANY INVENTORY ────────────────────────────────────────────────────────

export function CompanyInventory() {
  const { publicKey } = useWallet()
  const [inventory, setInventory] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicKey) return
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE_URL}/api/certificates/owner/${publicKey.toString()}`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE_URL}/api/marketplace/seller/${publicKey.toString()}`).then(r => r.ok ? r.json() : [])
    ]).then(([certs, listed]) => {
      setInventory(Array.isArray(certs) ? certs : [])
      setListings(Array.isArray(listed) ? listed : [])
    }).catch(e => { console.error(e); setError(String(e)) }).finally(() => setLoading(false))
  }, [publicKey])

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Inventario" subtitle="Catálogo de todos tus productos certificados" />
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
          <StatCard label="Total cNFTs" value={String(inventory.length)} icon={<Package size={16} />} color="#00c8ff" />
          <StatCard label="En marketplace" value={String(listings.length)} icon={<TrendingUp size={16} />} color="#22c55e" />
          <StatCard label="En subasta" value="2" icon={<Gavel size={16} />} color="#f59e0b" />
          <StatCard label="En cartera" value="-" icon={<Zap size={16} />} color="#7c3aed" />
        </div>

        <SectionTitle sub="Todos los cNFTs emitidos por tu empresa">Mis Productos Certificados</SectionTitle>
        <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 12, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Valor</th>
                <th>Hash Cert.</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20 }}>Cargando certificados...</td></tr>
              ) : error ? (
                <tr><td colSpan={6} style={{ padding: 20, color: 'salmon' }}>{String(error)}</td></tr>
              ) : inventory.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20 }}>No se encontraron certificados para esta wallet</td></tr>
              ) : (
                inventory.map((p, i) => {
                  const isListed = listings.some(l => String(l.asset_id) === String(p.asset_id || p.id))
                  const state = isListed ? 'En marketplace' : 'En cartera'
                  return (
                    <tr key={p.id || p.asset_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src={resolveAssetImage(p) || DEFAULT_ASSET_IMAGE} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.product_name || `Cert ${p.id}`}</div>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>{shortId(p.asset_id || p.id)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: '#8a93b8' }}>{p.category || '-'}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', color: '#00c8ff', fontWeight: 500 }}>${p.market_value || '-'}</td>
                      <td><HashDisplay hash={String(p.asset_id || p.blockchain_tx || p.id).slice(0, 12)} /></td>
                      <td><Badge color={isListed ? '#22c55e' : '#00c8ff'}>{state}</Badge></td>
                      <td>
                        <button style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#00c8ff' }}>
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── COMPANY TRANSFER CERTIFICATE ─────────────────────────────────────────────

export function CompanyTransferCert() {
  const [selectedCert, setSelectedCert] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { publicKey } = useWallet()
  const [ownedCerts, setOwnedCerts] = useState<any[]>([])

  useEffect(() => {
    if (!publicKey) return
    fetch(`${API_BASE_URL}/api/certificates/owner/${publicKey.toString()}`).then(r => r.ok ? r.json() : []).then(json => setOwnedCerts(Array.isArray(json) ? json : [])).catch(e => console.error('Error loading owner certs', e))
  }, [publicKey])

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Transferir Certificado" subtitle="Transfiere la propiedad de un cNFT a un usuario" />
      <div style={{ padding: '28px 32px', maxWidth: 760 }}>
        {submitted ? (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '48px', textAlign: 'center' }}>
            <CheckCircle2 size={48} color="#22c55e" style={{ marginBottom: 16 }} />
            <div style={{ fontFamily: 'Rajdhani', fontSize: 24, fontWeight: 700, letterSpacing: '0.06em', color: '#22c55e', marginBottom: 8 }}>TRANSFERENCIA COMPLETADA</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#5a6485', marginBottom: 20 }}>El certificado ha sido transferido exitosamente al destinatario</div>
            <div style={{ background: '#0c0f1d', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 10, padding: '16px 20px', display: 'inline-block', marginBottom: 24 }}>
              <HashDisplay hash="0x8f3c2a117f1d4e22a3b1c4d5e6f7a8b9" />
            </div>
            <div>
              <button className="btn-ghost" onClick={() => { setSubmitted(false); setSelectedCert(''); }}>NUEVA TRANSFERENCIA</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24, padding: '16px 20px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={15} color="#7c3aed" />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#8a93b8' }}>
                La transferencia de certificados es permanente e irreversible en la blockchain.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
              <div className="glow-border-violet" style={{ background: '#0c0f1d', borderRadius: 14, padding: '28px', border: '1px solid rgba(124,58,237,0.2)' }}>
                <SectionTitle sub="Completa los datos de la transferencia">Datos de Transferencia</SectionTitle>
                <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                      Seleccionar Certificado
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ownedCerts.slice(0, 8).map((p: any) => (
                        <button
                          key={p.asset_id || p.id}
                          type="button"
                          onClick={() => setSelectedCert(String(p.asset_id || p.id))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                            background: selectedCert === String(p.asset_id || p.id) ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.03)',
                            border: `1px solid ${selectedCert === String(p.asset_id || p.id) ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.1)'}`,
                            textAlign: 'left', transition: 'all 0.2s',
                          }}
                        >
                          <img src={resolveAssetImage(p) || DEFAULT_ASSET_IMAGE} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, color: '#dde3f0', letterSpacing: '0.03em' }}>{p.product_name || `Cert ${p.id}`}</div>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', marginTop: 2 }}>{p.asset_id || p.id} • {p.category || '-'}</div>
                          </div>
                          <HashDisplay hash={String(p.asset_id || p.blockchain_tx || p.id).slice(0, 12)} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Wallet del Destinatario *
                    </label>
                    <input className="input-base" placeholder="0x742d35Cc6634C0532925a3b..." style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} required />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                      Motivo de la Transferencia
                    </label>
                    <select className="input-base">
                      {['Venta directa', 'Garantía / devolución', 'Donación', 'Transferencia interna', 'Otro'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>

                  <button type="submit" className="btn-accent" style={{ padding: '14px', fontSize: 15 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Send size={15} /> EJECUTAR TRANSFERENCIA
                    </span>
                  </button>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 12, padding: '20px' }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.08em', marginBottom: 14 }}>RESUMEN</div>
                  {selectedCert ? (
                    (() => {
                      const p = ownedCerts.find(x => String(x.asset_id || x.id) === String(selectedCert)) || null;
                      if (!p) return <div style={{ padding: 12 }}>No se encontró el certificado seleccionado</div>
                      return (
                        <div>
                          <img src={resolveAssetImage(p) || DEFAULT_ASSET_IMAGE} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 12, opacity: 0.8 }} />
                          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, letterSpacing: '0.04em', marginBottom: 4 }}>{p.product_name || `Cert ${p.id}`}</div>
                          {[['ID', p.asset_id || p.id], ['Categoría', p.category || '-'], ['Valor', `$${p.market_value || '-'}`], ['Cert.', String(p.asset_id || p.blockchain_tx || p.id).slice(0, 10) + '...']].map(([l, v]) => (
                            <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,200,255,0.06)' }}>
                              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>{l}</span>
                              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#dde3f0' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ textAlign: 'center', color: '#5a6485', padding: '20px 0' }}>
                      <Package size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>Selecciona un certificado</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}