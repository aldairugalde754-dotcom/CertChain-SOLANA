import React, { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { TopBar, SectionTitle, Badge } from '../components/Shared'
import { API_BASE_URL } from '../config'
import { resolveAssetImage, DEFAULT_ASSET_IMAGE } from '../utils/metadata'

type DasAsset = any

const RPC_URL = process.env.REACT_APP_DAS_RPC || process.env.VITE_DAS_RPC || 'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1'

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

export default function MarketplaceView(): JSX.Element {
  const { publicKey } = useWallet()
  const [loading, setLoading] = useState(false)
  const [listings, setListings] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  // Modal state for listing a new item
  const [listModalOpen, setListModalOpen] = useState(false)
  const [availableAssets, setAvailableAssets] = useState<DasAsset[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [priceUsd, setPriceUsd] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [listingLoading, setListingLoading] = useState(false)

  useEffect(() => {
    if (!publicKey) return
    fetchSellerListings()
  }, [publicKey])

  async function fetchSellerListings() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplace/seller/${publicKey?.toString()}`)
      if (!res.ok) throw new Error('No se pudo obtener listings: ' + res.status)
      const json = await res.json()
      let fetched = Array.isArray(json) ? json : json.listings || []

      // Verify ownership via DAS: only keep listings whose asset_id is present in the wallet
      try {
        const payload = { jsonrpc: '2.0', id: 'marketplace-verify', method: 'getAssetsByOwner', params: { ownerAddress: publicKey?.toString(), page: 1, limit: 1000 } }
        const r = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (r.ok) {
          const j = await r.json()
          const candidates = j.result?.assets || j.result?.items || j.result || j.assets || []
          const rawAssets = Array.isArray(candidates) ? candidates : (Array.isArray(j.result?.data) ? j.result.data : [])
          const compressed = rawAssets.filter((a: any) => a?.compression?.compressed === true && (a?.burnt === false || a?.burnt === undefined))
          const ownedSet = new Set(compressed.map((a: any) => String(a.id || a.assetId)))
          fetched = fetched.filter((f: any) => ownedSet.has(String(f.asset_id)))
        }
      } catch (e) {
        // If verification fails, fall back to DB results but log
        console.warn('DAS verification failed for seller listings', e)
      }

      setListings(fetched)
    } catch (e: any) {
      console.error('Error fetching seller listings', e)
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  // Open modal and load user's cNFTs via DAS (filter compressed, not burnt, CertChain)
  const openListModal = async () => {
    if (!publicKey) { setError('Conecta tu wallet'); return }
    setListModalOpen(true)
    setAvailableAssets([])
    try {
      const payload = { jsonrpc: '2.0', id: 'list-assets', method: 'getAssetsByOwner', params: { ownerAddress: publicKey.toString(), page: 1, limit: 1000 } }
      const res = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('RPC error ' + res.status)
      const json = await res.json()
      const candidates = json.result?.assets || json.result?.items || json.result || json.assets || []
      const rawAssets = Array.isArray(candidates) ? candidates : (Array.isArray(json.result?.data) ? json.result.data : [])
      const compressed = rawAssets.filter((a: any) => a?.compression?.compressed === true && (a?.burnt === false || a?.burnt === undefined))
      // Further filter CertChain-like assets (symbol CERT or merkle tree match)
      const CERTCHAIN_MERKLE_TREE_PUBKEY = process.env.REACT_APP_CERTCHAIN_MERKLE || '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a'
      const filtered = compressed.filter((asset: any) => {
        const symbol = (asset?.content?.metadata?.symbol || '').toString().toUpperCase()
        const tree = String(asset?.compression?.tree || '')
        if (symbol === 'CERT') return true
        if (tree === CERTCHAIN_MERKLE_TREE_PUBKEY) return true
        const attrs = asset?.content?.metadata?.attributes || asset?.content?.attributes || []
        return Array.isArray(attrs) && attrs.some((t: any) => String(t.value || t.trait_value || '').toLowerCase().includes('certchain'))
      })
      // Exclude those already listed (by asset_id) globally
      let globalListed = new Set<string>()
      try {
        const glRes = await fetch(`${API_BASE_URL}/api/marketplace/listings`)
        if (glRes.ok) {
          const glJson = await glRes.json()
          globalListed = new Set((glJson || []).map((l: any) => String(l.asset_id)))
        }
      } catch (e) {
        // ignore
      }
      const notListed = filtered.filter((a: any) => !globalListed.has(String(a.id || a.assetId)))
      setAvailableAssets(notListed)
    } catch (e: any) {
      console.error('Error fetching assets for listing', e)
      setError(e.message || String(e))
    }
  }

  const handlePublish = async () => {
    if (!selectedAssetId) { setError('Selecciona un producto'); return }
    if (!priceUsd || Number(priceUsd) <= 0) { setError('Ingresa un precio válido'); return }
    if (!description || description.trim() === '') { setError('Agrega una descripción'); return }
    if (!publicKey) { setError('Conecta tu wallet'); return }

    setListingLoading(true)
    try {
      // Find selected asset metadata to include title/image
      const asset = availableAssets.find(a => (a.id || a.assetId) === selectedAssetId)
      const title = asset?.content?.metadata?.name || asset?.name || 'Sin nombre'
      const imageUri = getImageFromAsset(asset) || ''
      const payload = {
        asset_id: selectedAssetId,
        seller_wallet: publicKey.toString(),
        price_usd: parseFloat(priceUsd),
        description,
        title,
        image: imageUri,
        category
      }

      const res = await fetch(`${API_BASE_URL}/api/marketplace/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Error publicando listing: ' + res.status)
      await fetchSellerListings()
      // close modal and reset
      setListModalOpen(false)
      setSelectedAssetId(null)
      setPriceUsd('')
      setDescription('')
    } catch (e: any) {
      console.error('Error publishing listing', e)
      setError(e.message || String(e))
    } finally {
      setListingLoading(false)
    }
  }

  const handleDeleteListing = async (assetId: string) => {
    if (!confirm('¿Eliminar listing? Esta acción no puede deshacerse.')) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplace/list/${encodeURIComponent(assetId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminando listing: ' + res.status)
      await fetchSellerListings()
    } catch (e: any) {
      console.error('Error deleting listing', e)
      setError(e.message || String(e))
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Marketplace — Gestión" subtitle="Administra tus publicaciones" />
      <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <SectionTitle sub="Tus publicaciones activas">Productos Activos</SectionTitle>
          <div>
            <button className="btn-accent" onClick={openListModal}>Listar en Marketplace</button>
          </div>
        </div>

        {loading ? (
          <div>Cargando publicaciones...</div>
        ) : error ? (
          <div style={{ color: 'salmon' }}>{error}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {listings.map((l: any) => (
              <div key={l.asset_id} style={{ background: '#071023', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.02)' }}>
                <img
                  src={resolveAssetImage(l) || l.image || DEFAULT_ASSET_IMAGE}
                  alt=""
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_ASSET_IMAGE; }}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{l.title}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#9fb0d6' }}>{shortAssetId(l.asset_id)}</div>
                  </div>
                  <Badge color="#22c55e">ACTIVO</Badge>
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>${Number(l.price_usd).toFixed(2)}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" onClick={() => { /* TODO: open edit modal */ alert('Editar aún no implementado en frontend') }}>EDITAR</button>
                    <button className="btn-ghost" onClick={() => handleDeleteListing(l.asset_id)}>ELIMINAR</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {listModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setListModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 720, maxWidth: '96%', background: '#071023', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Listar en Marketplace</div>
                <div style={{ fontSize: 12, color: '#9fb0d6' }}>Selecciona un cNFT y publica tu oferta.</div>
              </div>
              <button onClick={() => setListModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9fb0d6' }}>Cerrar ✕</button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              <label style={{ fontSize: 12, color: '#9fb0d6' }}>Producto cNFT</label>
              <select value={selectedAssetId || ''} onChange={e => setSelectedAssetId(e.target.value)} style={{ padding: 10, borderRadius: 8, background: '#061426', color: '#e6eef8' }}>
                <option value="">-- Selecciona un producto --</option>
                {availableAssets.map(a => (
                  <option key={a.id || a.assetId} value={a.id || a.assetId}>{(a.content?.metadata?.name || a.name) + ' — ' + shortAssetId(a.id || a.assetId)}</option>
                ))}
              </select>

              <div>
                <label style={{ fontSize: 12, color: '#9fb0d6' }}>Precio (USD)</label>
                <input value={priceUsd} onChange={e => setPriceUsd(e.target.value)} placeholder="0.00" style={{ width: 180, padding: 10, borderRadius: 8, background: '#061426', color: '#e6eef8' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#9fb0d6' }}>Categoría</label>
                <input value={category} onChange={e => setCategory(e.target.value)} style={{ padding: 10, borderRadius: 8, background: '#061426', color: '#e6eef8' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#9fb0d6' }}>Descripción</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={{ width: '100%', padding: 10, borderRadius: 8, background: '#061426', color: '#e6eef8' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => setListModalOpen(false)}>CANCELAR</button>
                <button className="btn-accent" onClick={handlePublish} disabled={listingLoading}>{listingLoading ? 'PUBLICANDO...' : 'PUBLICAR'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/*
  Backend endpoint signatures (Express) expected by this frontend:

  // List a new marketplace item
  POST /api/marketplace/list
  Body JSON:
  {
    asset_id: string,
    seller_wallet: string,
    price_usd: number,
    description: string,
    title: string,
    image: string,
    category: string
  }
  Response: 200 OK with created listing object

  // Get seller listings
  GET /api/marketplace/seller/:wallet
  Response: 200 OK with array of listings for seller

  // Delete a listing
  DELETE /api/marketplace/list/:assetId
  Response: 200 OK on success

  // Optional: Update listing
  PUT /api/marketplace/list/:assetId
  Body JSON: { price_usd?: number, description?: string, category?: string }
  Response: 200 OK with updated listing

  app.post('/api/marketplace/list', async (req, res) => { // validar entrada, insertar en BD, retornar objeto })
  app.get('/api/marketplace/seller/:wallet', async (req, res) => { // query listings where seller_wallet = :wallet })
  app.delete('/api/marketplace/list/:assetId', async (req, res) => { // delete where asset_id = :assetId })
  app.put('/api/marketplace/list/:assetId', async (req, res) => { // update listing })

*/
