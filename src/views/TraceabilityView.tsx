import React, { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { TopBar, Badge } from '../components/Shared'
import { API_BASE_URL, DAS_RPC_URL } from '../config'

type DasAsset = any

function getImageFromAsset(asset: DasAsset) {
  if (!asset || !asset.content) return null
  const content = asset.content
  if (content.links && content.links.image) return content.links.image
  if (content.files && Array.isArray(content.files) && content.files.length > 0) return content.files[0].uri
  if (content.image) return content.image
  return null
}

function shortAddr(a?: string) {
  if (!a) return ''
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-6)}` : a
}

function resolveCreatorWallet(asset: DasAsset) {
  const creators = asset?.content?.metadata?.properties?.creators || asset?.content?.metadata?.creators || asset?.content?.creators || asset?.creators || []
  const firstCreator = Array.isArray(creators) ? creators[0] : null
  return firstCreator?.address || asset?.ownership?.creator || asset?.owner || null
}

function resolveMetadataAttributes(asset: DasAsset) {
  const list = asset?.content?.metadata?.attributes || []
  return Array.isArray(list) ? list : []
}

function buildTimeline(
  asset: DasAsset,
  signatures: any[] = [],
  companyName?: string,
  ownerWallet?: string,
  backendHistory: any[] = []
) {
  const creatorWallet = resolveCreatorWallet(asset)
  const currentOwner = ownerWallet || asset?.ownership?.owner || asset?.owner || 'Desconocido'
  const events: any[] = []

  if (Array.isArray(backendHistory) && backendHistory.length > 0) {
    backendHistory.forEach((ev: any, idx: number) => {
      if (ev.type === 'mint') {
        events.push({
          title: companyName ? `Certificado emitido por ${companyName}` : (ev.from ? `Certificado emitido por ${ev.from}` : 'Certificado emitido'),
          subtitle: creatorWallet ? `Wallet del emisor: ${shortAddr(creatorWallet)}` : `Propietario inicial: ${shortAddr(ev.to)}`,
          date: ev.created_at ? new Date(ev.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Origen / Mint',
          tx: ev.tx_hash ? `Tx: ${ev.tx_hash}` : (creatorWallet || 'mint'),
          type: 'origin',
        })
      } else {
        const titleMap: Record<string, string> = {
          marketplace_sale: 'Venta en Marketplace',
          auction_sale: 'Ganador de Subasta / Reclamación',
          transfer: 'Transferencia Directa',
          guarantee: 'Transferencia por Garantía',
          donation: 'Transferencia por Donación'
        }
        const title = titleMap[ev.type] || ev.title || 'Transferencia de Custodia'
        const subtitle = ev.from && ev.to
          ? `De ${shortAddr(ev.from)} ➔ ${shortAddr(ev.to)}`
          : (ev.to ? `Transferido a ${shortAddr(ev.to)}` : 'Movimiento de propiedad')

        events.push({
          title,
          subtitle,
          date: ev.created_at ? new Date(ev.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : `Transferencia #${idx}`,
          tx: ev.tx_hash ? `Tx: ${ev.tx_hash}` : 'Registro de movimiento en la blockchain',
          type: 'transfer',
        })
      }
    })
  } else {
    events.push({
      title: companyName ? `Certificado emitido por ${companyName}` : 'Certificado emitido',
      subtitle: creatorWallet ? `Wallet del emisor: ${shortAddr(creatorWallet)}` : 'Emisor registrado en blockchain',
      date: 'Origen / Mint',
      tx: creatorWallet || 'mint',
      type: 'origin',
    })

    if (Array.isArray(signatures) && signatures.length > 0) {
      signatures.slice().reverse().forEach((sig: any) => {
        events.push({
          title: sig?.type || 'Transferencia On-Chain',
          subtitle: sig?.signature ? `Tx: ${shortAddr(sig.signature)}` : 'Registro de movimiento en la blockchain',
          date: sig?.blockTime ? new Date(sig.blockTime * 1000).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Blockchain',
          tx: sig?.signature || 'tx',
          type: 'transfer',
        })
      })
    }
  }

  // Si el propietario actual difiere del emisor original y no hay transferencias intermedias explícitas, inferir el paso
  const hasTransferEvent = events.some(e => e.type === 'transfer')
  if (!hasTransferEvent && creatorWallet && currentOwner && creatorWallet !== currentOwner && currentOwner !== 'Desconocido') {
    events.push({
      title: 'Transferencia de Custodia',
      subtitle: `De ${shortAddr(creatorWallet)} ➔ ${shortAddr(currentOwner)}`,
      date: 'Movimiento On-Chain',
      tx: 'Registro de transferencia en la blockchain',
      type: 'transfer',
    })
  }

  events.push({
    title: 'Estado actual',
    subtitle: `En posesión de ${shortAddr(currentOwner)}`,
    date: 'Propietario presente',
    tx: currentOwner,
    type: 'current',
  })

  return events
}

function Timeline({ events }: { events: any[] }) {
  if (!events || events.length === 0) return <div style={{ color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>No hay eventos históricos.</div>

  return (
    <div style={{ position: 'relative', paddingLeft: 12 }}>
      <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'rgba(0,200,255,0.14)' }} />
      {events.map((ev, idx) => (
        <div key={`${ev.title}-${idx}`} style={{ position: 'relative', display: 'flex', gap: 18, marginBottom: 18, alignItems: 'flex-start' }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: ev.type === 'current' ? '#22c55e' : ev.type === 'origin' ? '#00c8ff' : '#a78bfa',
            border: '3px solid #09111d',
            position: 'relative', zIndex: 1,
            boxShadow: ev.type === 'current' ? '0 0 0 4px rgba(34,197,94,0.12)' : '0 0 0 4px rgba(0,200,255,0.12)'
          }} />
          <div style={{ flex: 1, background: 'rgba(13,18,29,0.9)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#7f8fa6', marginBottom: 4 }}>{ev.date}</div>
            <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 17, color: '#edf6ff' }}>{ev.title}</div>
            {ev.subtitle && <div style={{ marginTop: 6, color: '#a2b1cf', fontSize: 12 }}>{ev.subtitle}</div>}
            {ev.tx && <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 10, color: '#6eaaff', wordBreak: 'break-all' }}>{ev.tx}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TraceabilityView({ assetId: assetIdProp }: { assetId?: string } = {}): JSX.Element {
  const params = useParams<{ assetId: string }>()
  const location = useLocation()
  const initialAssetId = assetIdProp || params?.assetId || (location && (location.state as any)?.assetId) || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('assetId') : null) || undefined

  const [searchId, setSearchId] = useState(initialAssetId || '')
  const [loading, setLoading] = useState(false)
  const [asset, setAsset] = useState<DasAsset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<any | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [ownedAssets, setOwnedAssets] = useState<any[]>([])

  useEffect(() => {
    const wallet = (window as any)?.solana?.publicKey?.toString?.()
    if (wallet) fetchOwnedAssets(wallet)
  }, [])

  useEffect(() => {
    if (initialAssetId) handleSearch(initialAssetId)
  }, [initialAssetId])

  async function fetchOwnedAssets(wallet: string) {
    try {
      const payload = { jsonrpc: '2.0', id: 'owned-assets', method: 'getAssetsByOwner', params: { ownerAddress: wallet, page: 1, limit: 8 } }
      const res = await fetch(DAS_RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) return
      const json = await res.json()
      const raw = json.result?.assets || json.result?.items || json.result || []
      setOwnedAssets(Array.isArray(raw) ? raw.slice(0, 8) : [])
    } catch (err) {
      console.warn('Could not load assets', err)
    }
  }

  async function handleSearch(targetId?: string) {
    const id = (targetId || searchId || '').trim()
    if (!id) {
      setAsset(null)
      setCompany(null)
      setEvents([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setAsset(null)
    setCompany(null)
    setEvents([])

    try {
      const [assetRes, sigsRes, historyRes] = await Promise.all([
        fetch(DAS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'trace-get-asset', method: 'getAsset', params: { id } }),
        }),
        fetch(DAS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'trace-get-sigs', method: 'getSignaturesForAsset', params: { id } }),
        }),
        fetch(`${API_BASE_URL}/api/certificates/history/${encodeURIComponent(id)}`).catch(() => null),
      ])

      if (!assetRes.ok) throw new Error('Error al consultar la blockchain')
      const assetJson = await assetRes.json()
      if (assetJson?.error) throw new Error(assetJson.error?.message || 'Asset no encontrado')
      const resultAsset = assetJson.result || assetJson
      if (!resultAsset || resultAsset.burnt === true) throw new Error('⚠️ Certificado No Encontrado o Inválido')

      const sigsJson = sigsRes.ok ? await sigsRes.json() : null
      const signatures = Array.isArray(sigsJson?.result) ? sigsJson.result : []
      const historyJson = historyRes && historyRes.ok ? await historyRes.json().catch(() => null) : null
      const backendHistory = Array.isArray(historyJson?.history) ? historyJson.history : []

      const ownerWallet = resultAsset?.ownership?.owner || resultAsset?.owner || resultAsset?.ownership?.currentOwner || null
      const creatorWallet = resolveCreatorWallet(resultAsset)

      let verifiedCompany: any = { verified: false }
      if (creatorWallet) {
        try {
          const companyRes = await fetch(`${API_BASE_URL}/api/companies/verify-wallet/${encodeURIComponent(creatorWallet)}`)
          if (companyRes.ok) {
            const data = await companyRes.json()
            verifiedCompany = { verified: !!data?.verified, ...data }
          } else if (companyRes.status === 404) {
            verifiedCompany = { verified: false }
          }
        } catch (error) {
          verifiedCompany = { verified: false }
        }
      }

      setAsset(resultAsset)
      setCompany(verifiedCompany)
      setEvents(buildTimeline(resultAsset, signatures, verifiedCompany?.company_name, ownerWallet, backendHistory))
    } catch (err: any) {
      setError(err?.message || 'Error al consultar el certificado')
      setAsset(null)
      setCompany(null)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const attributes = resolveMetadataAttributes(asset)
  const explorerUrl = (id: string) => `https://explorer.solana.com/address/${id}?cluster=devnet`

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'rgba(9,14,24,1)' }}>
      <TopBar title="Historial de Producto" subtitle="Trazabilidad completa en blockchain" />

      <div style={{ padding: '28px 32px' }}>
        <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: '24px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Pega el Asset ID o Hash"
                style={{
                  width: '100%', border: '1px solid rgba(0,200,255,0.18)', background: '#0b1220', borderRadius: 10,
                  padding: '12px 14px', color: '#eaf3ff', fontFamily: 'JetBrains Mono', fontSize: 13, outline: 'none'
                }}
              />
            </div>
            <button onClick={() => handleSearch()} className="btn-primary" style={{ padding: '12px 24px', fontSize: 12 }}>BUSCAR</button>
          </div>

          {ownedAssets.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              {ownedAssets.map((item: any, idx: number) => {
                const label = item.content?.metadata?.name || `#${String(item.id || item.assetId || item.mint || '').slice(0, 8)}`
                return (
                  <button
                    key={`${label}-${idx}`}
                    onClick={() => setSearchId(String(item.id || item.assetId || item.mint || ''))}
                    style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.18)', color: '#7ad9ff', borderRadius: 999, padding: '6px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
            Consultando la blockchain y la empresa emisora...
          </div>
        ) : error ? (
          <div style={{ padding: '16px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.25)', color: '#fecaca', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
            {error}
          </div>
        ) : asset ? (
          <div style={{ display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: 20 }}>
            <div style={{ background: '#0b1220', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Badge color="#22c55e">✓ CERTIFICADO VERIFICADO EN SOLANA</Badge>
              </div>

              <div style={{ background: '#f4f4f4', borderRadius: 10, padding: 12, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={getImageFromAsset(asset) || ''} alt="asset" style={{ width: '100%', maxWidth: 320, height: 220, objectFit: 'cover', borderRadius: 8, background: '#eef2f7' }} />
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, letterSpacing: '0.04em', color: '#edf6ff' }}>{asset.content?.metadata?.name || 'Sin nombre'}</div>
                <div style={{ color: '#8a93b8', fontSize: 13, marginTop: 8 }}>{asset.content?.metadata?.description || 'Certificado digital inmutable de autenticidad.'}</div>
              </div>

              <div style={{ marginTop: 16, color: '#8a93b8', fontSize: 12 }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#7f8fa6', marginBottom: 10 }}>Empresa emisora</div>
                {company && company.verified ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#65d6a5', fontWeight: 700 }}>✓ Emitido por: {company.company_name}</div>
                    <div style={{ color: '#b7c0d4', fontFamily: 'JetBrains Mono', fontSize: 11 }}>Wallet Emisora: {shortAddr(company.wallet_address)}</div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d', borderRadius: 8, padding: '10px 12px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                    ⚠️ Creador On-Chain No Registrado en CertChain
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button
                  className="btn-accent"
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/verify/${encodeURIComponent(searchId)}`)}
                  style={{ padding: '10px 16px', fontSize: 12 }}
                >
                  COPIAR ENLACE FICHA PÚBLICA
                </button>
                <a href={explorerUrl(searchId)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <button className="btn-ghost" style={{ padding: '10px 16px', fontSize: 12 }}>VER EN EXPLORER</button>
                </a>
              </div>
            </div>

            <div style={{ background: '#0b1220', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 18 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, color: '#edf6ff', letterSpacing: '0.04em' }}>Detalles</div>
                <div style={{ color: '#7f8fa6', fontFamily: 'JetBrains Mono', fontSize: 11, marginTop: 4 }}>Detalles del certificado</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {attributes.length > 0 ? (
                  attributes.map((attr: any, idx: number) => (
                    <div key={`${attr.trait_type || attr.traitType || attr.type || 'propiedad'}-${idx}`} style={{ background: 'rgba(11,18,32,0.85)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 }}>
                      <div style={{ color: '#7f8fa6', fontFamily: 'JetBrains Mono', fontSize: 10, marginBottom: 8, textTransform: 'uppercase' }}>{attr.trait_type || attr.traitType || attr.type || 'Propiedad'}</div>
                      <div style={{ color: '#edf6ff', fontWeight: 700, fontSize: 14 }}>{String(attr.value || attr.value_string || attr.trait_value || '-')}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ gridColumn: '1 / -1', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>Sin metadatos adicionales.</div>
                )}
              </div>

              <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: '#edf6ff', letterSpacing: '0.04em' }}>Cadena de Custodia</div>
                <div style={{ marginTop: 16 }}>
                  <Timeline events={events} />
                </div>
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#7f8fa6', marginBottom: 8 }}>Blockchain</div>
                <div style={{ color: '#dbe8ff', fontFamily: 'JetBrains Mono', fontSize: 12, wordBreak: 'break-all' }}>{searchId}</div>
                <div style={{ marginTop: 12, color: '#dbe8ff', fontSize: 13 }}>
                  <strong>Propietario actual:</strong> <span style={{ color: '#9cb0d6', fontFamily: 'JetBrains Mono' }}>{asset?.ownership?.owner || asset?.owner || 'Desconocido'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#5a6485' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>INGRESA UN ID DE PRODUCTO</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>Consulta el historial completo de cualquier producto certificado</div>
          </div>
        )}
      </div>
    </div>
  )
}
