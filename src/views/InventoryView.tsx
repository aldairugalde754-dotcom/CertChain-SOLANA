import React, { JSX, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { TopBar, SectionTitle, StatCard, Badge } from '../components/Shared'

type DasAsset = any

function shortAssetId(id: string) {
  if (!id) return ''
  const clean = id.toString()
  return `0x${clean.slice(0, 4)}...${clean.slice(-4)}`
}

function getImageFromAsset(asset: DasAsset) {
  if (!asset || !asset.content) return null
  const content = asset.content
  if (content.links && content.links.image) return content.links.image
  if (content.files && Array.isArray(content.files) && content.files.length > 0) return content.files[0].uri
  if (content.image) return content.image
  return null
}

function getAttributeValue(asset: DasAsset, keyNames: string[]) {
  try {
    const attrs = asset.content?.metadata?.attributes || asset.content?.attributes || []
    for (const k of keyNames) {
      const found = attrs.find((a: any) => String(a.trait_type || a.traitType || a.type) === k)
      if (found) return found.value || found.value_string || found.trait_value || null
    }
    return null
  } catch {
    return null
  }
}

// Iconos vectoriales para la interfaz
const Icons = {
  Total: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  ),
  Wallet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3" />
      <path d="M18 12h4v4h-4z" />
    </svg>
  ),
  Marketplace: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  ),
  Auction: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 13 5 5" />
      <path d="m16 11 4-4" />
      <path d="m8 17 2.5-2.5" />
      <path d="M3 21h18" />
      <path d="m3 7 4-4 6 6-4 4z" />
    </svg>
  ),
  Qr: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h1" />
      <path d="M21 12v.01" />
      <path d="M12 21v-1" />
    </svg>
  ),
  ExternalLink: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export default function InventoryView(): JSX.Element {
  const { publicKey } = useWallet()
  const [loading, setLoading] = useState(false)
  const [assets, setAssets] = useState<DasAsset[]>([])
  const [listedAssetIds, setListedAssetIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const RPC_URL = process.env.REACT_APP_DAS_RPC || process.env.VITE_DAS_RPC || 'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1'
  const CERTCHAIN_MERKLE_TREE_PUBKEY = process.env.REACT_APP_CERTCHAIN_MERKLE || '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a'
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL || 'http://localhost:4000'

  useEffect(() => {
    let aborted = false
    const controller = new AbortController()

    async function fetchAssets() {
      setError(null)
      setAssets([])
      if (!publicKey) return
      setLoading(true)

      const payload = {
        jsonrpc: '2.0',
        id: 'my-inventory',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: publicKey.toString(),
          page: 1,
          limit: 1000,
        },
      }

      try {
        const res = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        if (!res.ok) throw new Error(`RPC error ${res.status}`)
        const json = await res.json()

        const candidates = json.result?.assets || json.result?.items || json.result || json.assets || []
        const rawAssets: DasAsset[] = Array.isArray(candidates) ? candidates : (Array.isArray(json.result?.data) ? json.result.data : [])

        const compressedAssets: DasAsset[] = rawAssets.filter((a: any) => a?.compression?.compressed === true)

        const filteredCertificates = compressedAssets.filter((asset: any) => {
          const isCompressed = asset?.compression?.compressed === true
          const isNotBurnt = asset?.burnt === false || asset?.burnt === undefined

          if (!isCompressed || !isNotBurnt) return false

          const metadata = asset?.content?.metadata || {}
          const symbol = (metadata?.symbol || '').toString()

          const hasCertSymbol = symbol.toUpperCase() === 'CERT'

          const attrs: any[] = Array.isArray(metadata?.attributes)
            ? metadata.attributes
            : Array.isArray(asset?.content?.attributes)
            ? asset.content.attributes
            : []

          const hasPlatformTag = attrs.some((attr: any) => {
            const trait = String(attr.trait_type || attr.traitType || attr.type || '').toLowerCase()
            const value = String(attr.value || attr.value_string || attr.trait_value || '').toLowerCase()
            return (trait === 'plataforma' && value === 'certchain') || (trait === 'tipo' && value === 'certificado de autenticidad')
          })

          const treeMatch = String(asset?.compression?.tree || '').toString() === String(CERTCHAIN_MERKLE_TREE_PUBKEY)

          return isCompressed && isNotBurnt && (hasCertSymbol || hasPlatformTag || treeMatch)
        })

        if (!aborted) setAssets(filteredCertificates)
        // fetch marketplace listings to determine which assets are listed
        try {
          fetch(`${API_BASE_URL}/api/marketplace/listings`).then(r => r.ok ? r.json() : Promise.resolve([])).then((list: any[]) => {
            if (!aborted && Array.isArray(list)) {
              const s = new Set(list.map(l => String(l.asset_id)));
              setListedAssetIds(s)
            }
          }).catch(e => { /* ignore */ })
        } catch (e) {
          // ignore
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('Error fetching DAS assets', err)
        if (!aborted) setError(err.message || String(err))
      } finally {
        if (!aborted) setLoading(false)
      }
    }

    fetchAssets()

    return () => {
      aborted = true
      controller.abort()
    }
  }, [publicKey, RPC_URL])

  const total = assets.length
  const inWallet = assets.length
  const inMarketplace = assets.filter(a => listedAssetIds.has(String(a.id || a.assetId))).length
  const inAuction = 0

  const [qrOpen, setQrOpen] = useState(false)
  const [qrAsset, setQrAsset] = useState<DasAsset | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)

  const openQr = (asset: DasAsset) => {
    setQrAsset(asset)
    setQrError(null)
    setQrOpen(true)
  }

  const closeQr = () => {
    setQrOpen(false)
    setQrAsset(null)
    setQrLoading(false)
    setQrError(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && qrOpen) closeQr()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [qrOpen])

  const getVerificationUrl = (asset: DasAsset) => {
    const id = asset?.id || asset?.assetId || ''
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://certchain.app'
    return `${origin.replace(/\/$/, '')}/verify/${encodeURIComponent(id)}`
  }

  const getQrImageUrl = (verificationUrl: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verificationUrl)}`
  }

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setQrError('Enlace copiado al portapapeles')
      setTimeout(() => setQrError(null), 2000)
    } catch (e) {
      setQrError('No se pudo copiar el enlace')
    }
  }

  const handleDownloadQr = async (url: string, assetId: string) => {
    setQrLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('No se pudo descargar la imagen QR')
      const blob = await res.blob()
      const a = document.createElement('a')
      const objectUrl = URL.createObjectURL(blob)
      a.href = objectUrl
      const safeId = assetId.replace(/[^a-zA-Z0-9-_]/g, '')
      a.download = `QR_Certificado_${safeId}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e: any) {
      console.error('Error downloading QR', e)
      setQrError(e.message || String(e))
    } finally {
      setQrLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Inventario" subtitle="cNFTs comprimidos pertenecientes a tu wallet" />
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
          <StatCard label="Total cNFTs" value={String(total)} icon={Icons.Total} color="#00c8ff" />
          <StatCard label="En cartera" value={String(inWallet)} icon={Icons.Wallet} color="#22c55e" />
          <StatCard label="En marketplace" value={String(inMarketplace)} icon={Icons.Marketplace} color="#7c3aed" />
          <StatCard label="En subasta" value={String(inAuction)} icon={Icons.Auction} color="#f59e0b" />
        </div>

        {!publicKey ? (
          <div style={{ padding: 24, borderRadius: 12, background: 'rgba(0,0,0,0.06)' }}>Conecta tu wallet para consultar tu inventario</div>
        ) : loading ? (
          <div style={{ padding: 24 }}>Cargando inventario...</div>
        ) : error ? (
          <div style={{ padding: 24, color: 'salmon' }}>Error: {error}</div>
        ) : (
          <>
            <SectionTitle sub="Todos tus cNFTs" />
            <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 12, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Valor</th>
                    <th>Hash</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'center', paddingRight: 20 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 20 }}>No tienes certificados emitidos por CertChain en esta wallet</td>
                    </tr>
                  ) : (
                    assets.map((a, i) => {
                      const image = getImageFromAsset(a) || ''
                      const name = a.content?.metadata?.name || a.content?.metadata?.title || 'Sin nombre'
                      const category = getAttributeValue(a, ['Categoría', 'categoria', 'Category']) || 'General'
                      const valor = getAttributeValue(a, ['Valor estimado (USD)', 'Valor']) || '-'
                      const assetShort = shortAssetId(a.id || a.assetId || '')
                      const isListed = listedAssetIds.has(String(a.id || a.assetId))
                      const state = isListed ? 'EN MARKETPLACE' : 'EN Wallet'

                      return (
                        <tr key={a.id || i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img src={image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>{assetShort}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: '#8a93b8' }}>{category}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', color: '#00c8ff', fontWeight: 500 }}>${valor}</td>
                          <td><code style={{ fontFamily: 'JetBrains Mono' }}>{assetShort}</code></td>
                          <td><Badge color={isListed ? '#7c3aed' : '#22c55e'}>{state}</Badge></td>
                          <td style={{ textAlign: 'right', paddingRight: 16 }}>
                            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                              <button
                                aria-label="QR"
                                title="Generar código QR"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'left',
                                  gap: 6,
                                  background: 'rgba(124,58,237,0.1)',
                                  border: '1px solid rgba(124,58,237,0.3)',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  cursor: 'pointer',
                                  color: '#c084fc',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  transition: 'all 0.2s'
                                }}
                                onClick={() => openQr(a)}
                              >
                                {Icons.Qr}
                                QR
                              </button>
                              <button
                                title="Ver en Solana Explorer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: 'rgba(0,200,255,0.08)',
                                  border: '1px solid rgba(0,200,255,0.2)',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  cursor: 'pointer',
                                  color: '#00c8ff',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  transition: 'all 0.2s'
                                }}
                                onClick={() => window.open(`https://explorer.solana.com/address/${a.id || a.assetId || ''}?cluster=devnet`, '_blank')}
                              >
                                {Icons.ExternalLink}
                                VER
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {qrOpen && qrAsset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={closeQr}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '92%', background: '#071023', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 14, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: '#e6eef8' }}>Código QR del Certificado</div>
                <div style={{ fontSize: 13, color: '#8a93b8' }}>{qrAsset.content?.metadata?.name || 'Sin nombre'}</div>
              </div>
              <button onClick={closeQr} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#8a93b8', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 240px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: 10, padding: 12, margin: '0 auto' }}>
                <img src={getQrImageUrl(getVerificationUrl(qrAsset))} alt="QR" style={{ width: 216, height: 216, objectFit: 'contain' }} />
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: '#5a6485', textTransform: 'uppercase', tracking: '0.05em', marginBottom: 2 }}>Asset ID</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#00c8ff', marginBottom: 16 }}>
                  {shortAssetId(qrAsset.id || qrAsset.assetId || '')}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <button className="btn-accent" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '8px 12px' }} onClick={() => handleDownloadQr(getQrImageUrl(getVerificationUrl(qrAsset)), qrAsset.id || qrAsset.assetId || '')} disabled={qrLoading}>
                    {qrLoading ? 'Descargando...' : 'Descargar QR (PNG)'}
                  </button>
                  <button className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '8px 12px' }} onClick={() => handleCopyLink(getVerificationUrl(qrAsset))}>
                    Copiar enlace
                  </button>
                </div>

                {qrError && (
                  <div style={{ color: qrError.includes('copiado') ? '#4ade80' : '#fca5a5', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                    {qrError}
                  </div>
                )}

                <div style={{ fontSize: 11, color: '#5a6485', marginBottom: 4 }}>URL de Verificación Pública:</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#8a93b8', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 4 }}>
                  {getVerificationUrl(qrAsset)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}