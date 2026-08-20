import React, { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { TopBar, SectionTitle, Badge } from '../components/Shared'

type DasAsset = any

const RPC_URL = process.env.REACT_APP_DAS_RPC || process.env.VITE_DAS_RPC || 'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1'

function getImageFromAsset(asset: DasAsset) {
  if (!asset || !asset.content) return null
  const content = asset.content
  if (content.links && content.links.image) return content.links.image
  if (content.files && Array.isArray(content.files) && content.files.length > 0) return content.files[0].uri
  if (content.image) return content.image
  return null
}

export default function PublicVerifyView({ assetId: assetIdProp }: { assetId?: string } = {}): JSX.Element {
  const params = useParams<{ assetId: string }>()
  const location = useLocation()
  const initialFromQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('assetId') : undefined
  const initialAssetId = assetIdProp || params?.assetId || (location && (location.state as any)?.assetId) || initialFromQuery || undefined

  const [selectedId, setSelectedId] = useState<string | undefined>(initialAssetId)
  const [loading, setLoading] = useState(true)
  const [asset, setAsset] = useState<DasAsset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verifyCounter, setVerifyCounter] = useState(0)

  useEffect(() => {
    let aborted = false
    if (!selectedId) {
      setError(null)
      setAsset(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function fetchAsset() {
      setLoading(true)
      setError(null)
      try {
        const payload = {
          jsonrpc: '2.0',
          id: 'public-verify',
          method: 'getAsset',
          params: { id: selectedId },
        }

        const res = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal })
        if (!res.ok) throw new Error('RPC error ' + res.status)
        const json = await res.json()
        if (json?.error) throw new Error(json.error?.message || JSON.stringify(json.error))
        const result = json.result || json
        if (!result) throw new Error('Asset no encontrado')
        if (result.burnt === true) {
          setError('⚠️ Certificado No Encontrado o Inválido (burnt)')
          setAsset(null)
        } else {
          setAsset(result)
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('Error fetching asset', err)
        setError(err.message || String(err))
        setAsset(null)
      } finally {
        if (!aborted) setLoading(false)
      }
    }

    fetchAsset()
    return () => { aborted = true; controller.abort() }
  }, [selectedId, verifyCounter])

  const explorerUrl = (id: string) => `https://explorer.solana.com/address/${id}?cluster=devnet`

  const handleVerifyClick = () => {
    // trigger a refetch by updating selectedId (useEffect watches selectedId)
    setLoading(true)
    setError(null)
    setVerifyCounter(c => c + 1)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Verificar Certificado" subtitle="Comprobación pública en la blockchain" />
      <div style={{ padding: 28 }}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Pega el Asset ID aquí" value={selectedId || ''} onChange={e => setSelectedId(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#071023', border: '1px solid rgba(255,255,255,0.04)', color: '#e6eef8' }} />
          <button className="btn-accent" onClick={handleVerifyClick} style={{ padding: '10px 14px' }}>Verificar</button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, margin: '0 auto', background: 'linear-gradient(90deg,#0ea5a4,#60a5fa)' }} />
            <div style={{ marginTop: 12, color: '#9fb0d6' }}>Consultando la blockchain...</div>
          </div>
        ) : error ? (
          <div style={{ padding: 24, borderRadius: 10, background: '#3b0b0b', color: '#ffdede', border: '1px solid rgba(255,100,100,0.12)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠️ Certificado No Encontrado o Inválido</div>
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        ) : asset ? (
          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
            <div style={{ background: '#071023', borderRadius: 12, padding: 18, border: '1px solid rgba(124,58,237,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Badge color="#22c55e">✓ CERTIFICADO VERIFICADO EN SOLANA</Badge>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img src={getImageFromAsset(asset) || ''} alt="asset" style={{ width: 360, height: 240, objectFit: 'cover', borderRadius: 8, background: '#0b1726' }} />
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700 }}>{asset.content?.metadata?.name || 'Sin nombre'}</div>
                <div style={{ fontSize: 13, color: '#9fb0d6', marginTop: 6 }}>{asset.content?.metadata?.description || ''}</div>
              </div>
            </div>

            <div style={{ background: '#071023', borderRadius: 12, padding: 18, border: '1px solid rgba(124,58,237,0.06)' }}>
              <SectionTitle sub="Detalles del certificado">Detalles</SectionTitle>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                {(Array.isArray(asset.content?.metadata?.attributes) ? asset.content.metadata.attributes : []).map((attr: any, idx: number) => (
                  <div key={idx} style={{ background: '#081428', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: 11, color: '#7f8fa6', marginBottom: 4 }}>{attr.trait_type || attr.traitType || attr.type || 'Propiedad'}</div>
                    <div style={{ fontSize: 14, color: '#e6eef8', fontWeight: 600 }}>{String(attr.value || attr.value_string || attr.trait_value || '-')}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <SectionTitle sub="Blockchain" />
                <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 13, color: '#9fb0d6', wordBreak: 'break-all' }}>{selectedId}</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <strong>Propietario actual:</strong> <span style={{ fontFamily: 'JetBrains Mono', color: '#9fb0d6' }}>{asset?.ownership?.owner || asset?.owner || asset?.ownership?.currentOwner || 'Desconocido'}</span>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <a href={explorerUrl(selectedId || '')} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="btn-accent">Ver en Explorer</button>
                  </a>
                  <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copiar enlace</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>Sin datos disponibles.</div>
        )}
      </div>
    </div>
  )
}
