import { useState, useEffect, type FormEvent } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Search, ShoppingCart, Heart, TrendingUp, ArrowUpRight, Package, Send, AlertCircle, CheckCircle2, Zap, RefreshCw, Trash2 } from 'lucide-react'
import { getAssetWithProof, transfer as bubblegumTransfer } from '@metaplex-foundation/mpl-bubblegum'
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi'
import { TopBar, StatCard, SectionTitle, Badge, HashDisplay, MOCK_PRODUCTS } from '../components/Shared'
import { resolveAssetImage, DEFAULT_ASSET_IMAGE } from '../utils/metadata'
import { API_BASE_URL, DAS_RPC_URL, DEFAULT_MERKLE_TREE_PUBKEY } from '../config'
import { useMarketplaceCheckout } from '../hooks/useMarketplaceCheckout'
import { useUmi } from '../hooks/useUmi'
import { useCertChainProgram } from '../hooks/useCertChainProgram'
import { subscribeToDataRefresh, triggerDataRefresh } from '../utils/dataRefresh'
import { QrCode, Copy, Check, ExternalLink, X } from 'lucide-react'

function getCertificateIdFromAuction(auction: any) {
  if (!auction) return ''

  const candidates = [
    auction.certificate_id,
    auction.cert_id,
    auction.cert_hash,
    auction.certHash,
    auction.asset_id,
    auction.assetId,
    auction.id,
    auction._id,
  ]

  const value = candidates.find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim() !== '')
  return value ? String(value) : ''
}

async function sendBubblegumTransferWithRetry(umi: any, transferInput: any) {
  const attempts = 3

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await bubblegumTransfer(umi, transferInput).sendAndConfirm(umi)
    } catch (txErr: any) {
      const message = txErr?.message || String(txErr)
      const logs = typeof txErr.getLogs === 'function' ? await txErr.getLogs().catch(() => []) : []
      const joined = Array.isArray(logs) ? logs.join('\n') : String(logs)

      const isBlockhashIssue = message.includes('Blockhash not found') || joined.includes('Blockhash not found') || message.includes('blockhash')
      if (isBlockhashIssue && attempt < attempts - 1) {
        continue
      }

      throw txErr
    }
  }

  throw new Error('No se pudo enviar la transferencia después de reintentar por blockhash expirado.')
}

// ─── MARKETPLACE ─────────────────────────────────────────────────────────────

export function ClientMarketplace() {
  const { publicKey } = useWallet()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [cart, setCart] = useState<Record<string, any>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutState, setCheckoutState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const categories = ['Todos', 'Relojería', 'Cosmética', 'Electrónica', 'Moda']

  useEffect(() => {
    let mounted = true
    async function loadListings() {
      setLoadingProducts(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/marketplace/listings`)
        if (!res.ok) throw new Error('No listings')
        const json = await res.json()
        if (!Array.isArray(json)) {
          if (mounted) setProducts([])
          return
        }

        const mapped = json.map((r: any) => {
          const id = String(r.asset_id || r.id || r.assetId || r.listing_id || r._id || '')
          return {
            id,
            name: r.title || r.product_name || r.name || `Certificado ${id}`,
            category: r.category || 'General',
            price: r.price_usd !== undefined ? r.price_usd : (r.price || r.amount || 0),
            company: r.company || r.seller_name || r.seller_wallet || 'Empresa',
            cert: r.cert_hash || r.cert || id,
            image: resolveAssetImage(r) || r.image || DEFAULT_ASSET_IMAGE,
            raw: r,
          }
        })
        if (mounted) setProducts(mapped)
      } catch (e) {
        console.warn('Could not fetch marketplace listings', e)
        if (mounted) setProducts([])
      } finally {
        if (mounted) setLoadingProducts(false)
      }
    }

    loadListings()
    const off = subscribeToDataRefresh(() => {
      loadListings()
    }, ['all', 'marketplace'])
    return () => { mounted = false; off() }
  }, [])

  const addToCart = (product: any) => {
    setCart(prev => {
      const next = { ...prev }
      if (next[product.id]) {
        delete next[product.id]
        return next
      }
      next[product.id] = product
      return next
    })
  }

  const cartItems = Object.values(cart)
  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0)
  const fee = subtotal * 0.04
  const total = subtotal + fee

  const { processCheckout: executeCheckout, processing: checkoutProcessing } = useMarketplaceCheckout()

  const handleCheckout = async () => {
    if (!publicKey) {
      setCheckoutMessage('Conecta tu wallet para pagar')
      setCheckoutState('error')
      return
    }

    if (!cartItems.length) return

    setCheckoutState('processing')
    setCheckoutMessage('Procesando pago y transferencia de certificados...')

    try {
      const success = await executeCheckout(cartItems, total)
      
      if (success) {
        const purchasedIds = new Set(cartItems.map(item => item.id))
        setProducts(prev => prev.filter(product => !purchasedIds.has(product.id)))
        setCart({})
        triggerDataRefresh('marketplace')
        triggerDataRefresh('inventory')
        setCheckoutState('success')
        setCheckoutMessage('¡Compra completada! Los certificados han sido transferidos a tu wallet.')
        setTimeout(() => setCartOpen(false), 2000)
      } else {
        setCheckoutState('error')
      }
    } catch (error: any) {
      console.error('Checkout error', error)
      setCheckoutState('error')
      setCheckoutMessage(error?.message || 'No se pudo completar la compra')
    }
  }

  const filtered = products.filter(p => {
    const matchCat = category === 'Todos' || p.category === category
    const matchSearch = (p.name || '').toString().toLowerCase().includes(search.toLowerCase()) || (p.company || '').toString().toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar
        title="Marketplace"
        subtitle="Marketplace de certificados"
        actions={
          <button
            aria-label="Abrir carrito"
            onClick={() => setCartOpen(true)}
            style={{
              position: 'relative',
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#8a93b8',
            }}
          >
            <ShoppingCart size={14} color="#8a93b8" />
            {cartItems.length > 0 && (
              <div style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#00c8ff', color: '#000',
                fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartItems.length}</div>
            )}
          </button>
        }
      />

      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5a6485' }} />
            <input
              className="input-base"
              style={{ paddingLeft: 36 }}
              placeholder="Buscar productos o empresas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  background: category === c ? 'rgba(0,200,255,0.12)' : 'transparent',
                  border: `1px solid ${category === c ? 'rgba(0,200,255,0.3)' : 'rgba(0,200,255,0.12)'}`,
                  color: category === c ? '#00c8ff' : '#5a6485',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'Rajdhani', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                }}
              >{c}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6485' }}>{filtered.length} productos encontrados</span>
          <span style={{ color: 'rgba(0,200,255,0.2)' }}>|</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6485' }}>Todos certificados en blockchain</span>
        </div>

        {loadingProducts ? (
          <div style={{ padding: '30px 20px', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12, textAlign: 'center' }}>
            Cargando productos...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '42px 20px', border: '1px dashed rgba(0,200,255,0.2)', borderRadius: 12, textAlign: 'center', background: 'rgba(0,200,255,0.03)' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#f0f4f9' }}>No hay artículos en venta</div>
            <div style={{ color: '#8a93b8', fontSize: 13 }}>Cuando una empresa publique certificados, aparecerán aquí.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                inCart={Boolean(cart[product.id])}
                onAddCart={() => addToCart(product)}
              />
            ))}
          </div>
        )}
      </div>

      {cartOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.68)', zIndex: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <div role="dialog" aria-label="Carrito de compras" style={{ width: 420, maxWidth: '100%', background: '#0b0f1a', borderLeft: '1px solid rgba(0,200,255,0.12)', boxShadow: '-20px 0 50px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(0,200,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, letterSpacing: '0.06em' }}>CARRITO</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6485' }}>{cartItems.length} artículos</div>
              </div>
              <button aria-label="Cerrar carrito" onClick={() => setCartOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(0,200,255,0.15)', color: '#8a93b8', width: 30, height: 30, borderRadius: 8, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              {!cartItems.length ? (
                <div style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 12, padding: 18, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Tu carrito está vacío</div>
                  <div style={{ color: '#8a93b8', fontSize: 12 }}>Agrega certificados para continuar checkout.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {cartItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,200,255,0.08)', borderRadius: 12, padding: 10 }}>
                      <img src={item.image} alt={item.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', textTransform: 'uppercase' }}>{item.category}</div>
                        <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, margin: '2px 0 4px' }}>{item.name}</div>
                        <div style={{ color: '#8a93b8', fontSize: 11 }}>{item.company}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                          <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: '#00c8ff' }}>${Number(item.price || 0)}</span>
                          <button onClick={() => addToCart(item)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8a93b8', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Quitar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(0,200,255,0.08)', padding: '20px 22px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8a93b8' }}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8a93b8' }}><span>Procesamiento</span><span>${fee.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700 }}><span>Total</span><span style={{ color: '#00c8ff' }}>${total.toFixed(2)}</span></div>
              </div>

              {checkoutMessage && (
                <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: checkoutState === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${checkoutState === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, color: checkoutState === 'error' ? '#fca5a5' : '#86efac', fontSize: 12 }}>
                  {checkoutMessage}
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={!cartItems.length || checkoutState === 'processing' || checkoutProcessing}
                className="btn-primary"
                style={{ width: '100%', marginTop: 16, opacity: !cartItems.length || checkoutState === 'processing' || checkoutProcessing ? 0.6 : 1, cursor: !cartItems.length || checkoutState === 'processing' || checkoutProcessing ? 'not-allowed' : 'pointer' }}
              >
                {checkoutState === 'processing' || checkoutProcessing ? 'PROCESANDO PAGO...' : 'CHECKOUT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, inCart, onAddCart }: { product: any; inCart: boolean; onAddCart: () => void }) {
  const [liked, setLiked] = useState(false)
  const [qrVisible, setQrVisible] = useState<{ visible: boolean; url: string; title: string }>({ visible: false, url: '', title: '' })

  return (
    <div className="card-hover glow-border" style={{
      background: '#0c0f1d', borderRadius: 12,
      border: '1px solid rgba(0,200,255,0.12)',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'relative', height: 180, background: '#0a0c18' }}>
        <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(7,9,15,0.7) 0%, transparent 60%)',
        }} />
        <button
          onClick={() => setLiked(!liked)}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(7,9,15,0.7)', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Heart size={13} color={liked ? '#ff6b6b' : '#8a93b8'} fill={liked ? '#ff6b6b' : 'none'} />
        </button>
        <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
          <Badge color="#22c55e">Certificado</Badge>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>{product.category} • {product.company}</div>
        <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, letterSpacing: '0.03em', marginBottom: 8, lineHeight: 1.2 }}>{product.name}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485' }}>CERT:</span>
          <HashDisplay hash={product.cert} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', display: 'block' }}>PRECIO</span>
            <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 22, color: '#00c8ff', letterSpacing: '0.03em' }}>${product.price}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {product.id && (
              <a
                href={`${window.location.origin}/traceability/${encodeURIComponent(product.id)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(0,200,255,0.2)',
                  borderRadius: 8,
                  background: 'rgba(0,200,255,0.05)',
                  color: '#8ad9ff',
                  padding: '7px 10px',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Historial
              </a>
            )}
            <button
              onClick={onAddCart}
              className={inCart ? 'btn-ghost' : 'btn-primary'}
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              {inCart ? 'EN CARRITO' : 'AGREGAR'}
            </button>
          </div>
        </div>
      </div>
      {qrVisible.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#071026', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', minWidth: 320, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700 }}>{qrVisible.title || 'Verificar Certificado'}</div>
              <button type="button" onClick={() => setQrVisible({ visible: false, url: '', title: '' })} className="btn-ghost">×</button>
            </div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrVisible.url)}`} alt="QR" style={{ width: 300, height: 300 }} />
            <div style={{ marginTop: 12, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8a93b8' }}>{qrVisible.url}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AUCTIONS ─────────────────────────────────────────────────────────────────

function truncateAddress(addr: string, start = 4, end = 3) {
  if (!addr) return ''
  if (addr.length <= start + end) return addr
  return `${addr.slice(0, start)}...${addr.slice(-end)}`
}

export function ClientAuctions() {
  const { publicKey, sendTransaction } = useWallet()
  const { comprarDirectoCpi, program, getRegistroPda } = useCertChainProgram()
  const [auctions, setAuctions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState<Record<string, string>>({})
  const [bidError, setBidError] = useState<Record<string, string>>({})
  const [bidSuccess, setBidSuccess] = useState<Record<string, boolean>>({})
  const [countdowns, setCountdowns] = useState<Record<string, { h: string; m: string; s: string }>>({})
  const [bidValidation, setBidValidation] = useState<Record<string, string>>({})
  const [userBidHistory, setUserBidHistory] = useState<any[]>([])
  const [userBidHistoryLoading, setUserBidHistoryLoading] = useState(false)

  // Refresco silencioso de subastas en tiempo real sin reiniciar la página ni unmount de componentes
  async function fetchAuctions(isSilent = false) {
    if (!isSilent && auctions.length === 0) {
      setLoading(true)
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auctions/listings`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setAuctions(data)
          const newCountdowns: Record<string, { h: string; m: string; s: string }> = {}
          data.forEach((auction: any) => {
            const idKey = String(auction.id || auction.asset_id || auction._id || '')
            if (auction.end_time) {
              const diffMs = new Date(auction.end_time).getTime() - Date.now()
              const h = Math.max(0, Math.floor(diffMs / 3600000))
              const m = Math.max(0, Math.floor((diffMs % 3600000) / 60000))
              const s = Math.max(0, Math.floor((diffMs % 60000) / 1000))
              newCountdowns[idKey] = {
                h: String(h).padStart(2, '0'),
                m: String(m).padStart(2, '0'),
                s: String(s).padStart(2, '0')
              }
            }
          })
          setCountdowns(prev => ({ ...newCountdowns, ...prev }))
        }
      }
    } catch (e) {
      console.warn('Could not fetch backend auctions', e)
    } finally {
      if (!isSilent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchAuctions(false)
    // Polling estático en tiempo real cada 1.5s (1500ms) para capturar los últimos segundos críticos
    const pollInterval = setInterval(() => {
      fetchAuctions(true)
    }, 1500)

    const off = subscribeToDataRefresh(() => {
      fetchAuctions(true)
    }, ['all', 'auctions'])

    return () => {
      clearInterval(pollInterval)
      off()
    }
  }, [])

  useEffect(() => {
    if (!publicKey) {
      setUserBidHistory([])
      return
    }

    let mounted = true
    async function fetchUserBidHistory(isSilent = false) {
      const walletAddress = publicKey?.toString()
      if (!walletAddress) {
        setUserBidHistory([])
        if (!isSilent) setUserBidHistoryLoading(false)
        return
      }

      if (!isSilent && userBidHistory.length === 0) {
        setUserBidHistoryLoading(true)
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/auctions/my-bids/${walletAddress}`)
        if (!res.ok) throw new Error('No se pudo cargar el historial')
        const data = await res.json()
        if (mounted) setUserBidHistory(Array.isArray(data) ? data : [])
      } catch (error) {
        console.warn('Could not fetch user auction bids', error)
        if (mounted && !isSilent) setUserBidHistory([])
      } finally {
        if (mounted && !isSilent) setUserBidHistoryLoading(false)
      }
    }

    fetchUserBidHistory(false)
    const historyInterval = setInterval(() => {
      fetchUserBidHistory(true)
    }, 3000)

    return () => {
      mounted = false
      clearInterval(historyInterval)
    }
  }, [publicKey?.toString()])

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prevCountdowns => {
        const updated = { ...prevCountdowns }
        auctions.forEach(auction => {
          const idKey = String(auction.id || auction.asset_id || auction._id || '')
          if (!idKey || !auction.end_time) return

          const diffMs = new Date(auction.end_time).getTime() - Date.now()
          if (diffMs <= 0) {
            updated[idKey] = { h: '00', m: '00', s: '00' }
          } else {
            const h = Math.floor(diffMs / 3600000)
            const m = Math.floor((diffMs % 3600000) / 60000)
            const s = Math.floor((diffMs % 60000) / 1000)
            updated[idKey] = {
              h: String(h).padStart(2, '0'),
              m: String(m).padStart(2, '0'),
              s: String(s).padStart(2, '0')
            }
          }
        })
        return updated
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [auctions])

  const handleBid = async (id: string, assetId?: string, currentPrice?: number) => {
    const amountStr = bidAmount[id]
    if (!amountStr) {
      setBidValidation(prev => ({ ...prev, [id]: 'Ingresa monto' }))
      return
    }

    const bidVal = Number(amountStr)
    if (isNaN(bidVal) || bidVal <= 0) {
      setBidValidation(prev => ({ ...prev, [id]: 'Monto inválido' }))
      return
    }

    const minBid = Number(currentPrice || 0) * 1.05
    if (bidVal < minBid) {
      setBidValidation(prev => ({ ...prev, [id]: `Mínimo $${minBid.toFixed(2)}` }))
      return
    }

    setBidValidation(prev => ({ ...prev, [id]: '' }))
    setBidError(prev => ({ ...prev, [id]: '' }))

    if (!publicKey) {
      setBidError(prev => ({ ...prev, [id]: 'Conecta tu wallet' }))
      return
    }

    if (assetId) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auctions/bid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset_id: assetId,
            bidder_wallet: publicKey.toString(),
            bid_amount: bidVal
          })
        })
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error || 'Error al enviar puja')
        }
        setBidSuccess(prev => ({ ...prev, [id]: true }))
        setBidAmount(prev => ({ ...prev, [id]: '' }))
        setTimeout(() => {
          setBidSuccess(prev => ({ ...prev, [id]: false }))
        }, 3000)
        await fetchAuctions(true)
        triggerDataRefresh('auctions')
        const walletAddress = publicKey?.toString()
        if (walletAddress) {
          const historyRes = await fetch(`${API_BASE_URL}/api/auctions/my-bids/${walletAddress}`)
          if (historyRes.ok) {
            const historyData = await historyRes.json()
            setUserBidHistory(Array.isArray(historyData) ? historyData : [])
          }
        }
      } catch (err: any) {
        console.error('Error submitting bid', err)
        setBidError(prev => ({ ...prev, [id]: err.message || String(err) }))
      }
    }
  }

  const handleClaimAuction = async (auction: any) => {
    const auctionKey = auction.id || auction.asset_id
    if (!publicKey || !sendTransaction) {
      return setBidError(prev => ({ ...prev, [auctionKey]: 'Conecta tu wallet' }))
    }

    try {
      setBidError(prev => ({ ...prev, [auctionKey]: '' }))
      const priceUSD = Number(auction.current_bid || auction.highest_bid || auction.price_usd || 0)
      if (!priceUSD || priceUSD <= 0) throw new Error('Monto no válido')

      let solUsdRate = 150
      try {
        const rateRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
        if (rateRes.ok) {
          const rateData = await rateRes.json()
          if (rateData?.solana?.usd) solUsdRate = Number(rateData.solana.usd)
        }
      } catch (rateErr) {
        console.warn('Tasa de cambio fallback 150 SOL/USD', rateErr)
      }

      const solAmount = priceUSD / solUsdRate
      const lamports = Math.max(Math.ceil(solAmount * LAMPORTS_PER_SOL), 1000)

      if (!auction.seller_wallet) throw new Error('Wallet vendedora no encontrada')
      const sellerPubkey = new PublicKey(auction.seller_wallet)
      const rpcUrl = process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')

      let paymentSignature: string | null = null
      let adminPub = ''
      let registroExists = false

      try {
        if (program && getRegistroPda) {
          const registroPda = getRegistroPda()
          const registroAccount = (program.account as any)?.registroGlobal
          if (registroAccount) {
            const registroData: any = await registroAccount.fetch(registroPda)
            adminPub = registroData?.admin?.toString() || ''
            registroExists = true
          }
        }
      } catch (e) {
        registroExists = false
      }

      if (registroExists && comprarDirectoCpi) {
        try {
          paymentSignature = await comprarDirectoCpi({
            assetIdStr: String(auction.asset_id),
            vendedorStr: auction.seller_wallet,
            adminStr: adminPub,
          })
        } catch (cpiErr: any) {
          console.warn('Fallback a pago directo en SOL', cpiErr)
        }
      }

      if (!paymentSignature) {
        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        const paymentTx = new Transaction({ recentBlockhash, feePayer: publicKey }).add(
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: sellerPubkey, lamports })
        )
        paymentSignature = await sendTransaction(paymentTx, connection)
        await connection.confirmTransaction(paymentSignature, 'confirmed')
      }

      const claimRes = await fetch(`${API_BASE_URL}/api/auctions/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: auction.asset_id,
          buyer_wallet: publicKey.toString(),
          tx_hash: paymentSignature,
          bid_amount: priceUSD,
        }),
      })

      if (!claimRes.ok) {
        const claimErrJson = await claimRes.json().catch(() => ({ error: 'Error al reclamar' }))
        throw new Error(claimErrJson.error || 'Error al reclamar')
      }

      triggerDataRefresh('auctions')
      triggerDataRefresh('inventory')
      triggerDataRefresh('all')
      await fetchAuctions(true)
    } catch (err: any) {
      console.error('Error claiming auction:', err)
      setBidError(prev => ({ ...prev, [auctionKey]: err.message || String(err) }))
    }
  }

  const userWalletStr = publicKey ? publicKey.toString().toLowerCase() : ''

  // REGLA CRÍTICA DE SUBASTAS:
  // Al terminarse una subasta, debe desaparecer/ocultarse para TODOS los usuarios salvo para el ganador (quien debe reclamar y pagar).
  const itemsToDisplay = auctions.filter((auction: any) => {
    const isEnded = auction.end_time
      ? (new Date(auction.end_time).getTime() <= Date.now())
      : (auction.status === 'ended' || auction.status === 'sold')

    const winnerWallet = (auction.current_bidder_wallet || '').toString().toLowerCase()
    const isWinner = Boolean(userWalletStr && winnerWallet && userWalletStr === winnerWallet)

    if (isEnded) {
      // Ocultar la subasta a todos EXCEPTO al ganador
      return isWinner
    }

    // Subastas activas -> visibles para todos
    return true
  })

  const liveAuctionsCount = itemsToDisplay.filter((a: any) => {
    const isEnded = a.end_time ? (new Date(a.end_time).getTime() <= Date.now()) : (a.status === 'ended')
    return !isEnded
  }).length

  const wonPendingCount = itemsToDisplay.filter((a: any) => {
    const isEnded = a.end_time ? (new Date(a.end_time).getTime() <= Date.now()) : (a.status === 'ended')
    const winnerWallet = (a.current_bidder_wallet || '').toString().toLowerCase()
    return isEnded && Boolean(userWalletStr && winnerWallet && userWalletStr === winnerWallet)
  }).length

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Subastas en Vivo" subtitle="Participa en subastas en tiempo real" />
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#22c55e', letterSpacing: '0.08em', fontWeight: 600 }}>
              {liveAuctionsCount} SUBASTAS EN VIVO
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#00c8ff', background: 'rgba(0,200,255,0.08)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,200,255,0.2)' }}>
            </span>
          </div>
          {wonPendingCount > 0 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#eab308', fontWeight: 700, background: 'rgba(234,179,8,0.12)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(234,179,8,0.3)' }}>
                  🏆 {wonPendingCount} {wonPendingCount === 1 ? 'SUBASTA GANADA (PENDIENTE RECLAMO)' : 'SUBASTAS GANADAS (PENDIENTES)'}
                </span>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '20px', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
            Cargando subastas...
          </div>
        ) : itemsToDisplay.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed rgba(0,200,255,0.2)', borderRadius: 12, background: 'rgba(0,200,255,0.03)' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, color: '#f0f4f9', marginBottom: 8 }}>No hay subastas activas</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8a93b8' }}>Vuelve más tarde o crea una nueva subasta desde tu panel empresarial.</div>
          </div>
        ) : (
          /* Ancho ajustado para panel lateral de 220px */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 18, alignItems: 'start' }}>
            
            {/* Grilla principal de subastas horizontales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {itemsToDisplay.map((auction: any) => {
                const idKey = String(auction.id || auction.asset_id || auction._id || '')
                const certId = getCertificateIdFromAuction(auction)
                const traceId = certId || idKey
                const title = auction.title || auction.name || `Certificado ${traceId}`
                const currentBidVal = auction.current_bid !== undefined ? auction.current_bid : auction.currentBid
                const startingVal = auction.starting_price !== undefined ? auction.starting_price : auction.minBid
                const displayBid = Number(currentBidVal || startingVal || 0).toFixed(2)
                const minNextBid = Number(currentBidVal || startingVal || 0) * 1.05
                const imageUrl = resolveAssetImage(auction) || auction.image || DEFAULT_ASSET_IMAGE
                const isEnded = auction.end_time ? (new Date(auction.end_time).getTime() <= Date.now()) : (auction.status === 'ended')
                const winnerWallet = (auction.current_bidder_wallet || '').toString().toLowerCase()
                const isWinner = Boolean(userWalletStr && winnerWallet && userWalletStr === winnerWallet)
                const isEnding = !isEnded && (countdowns[idKey]?.h === '00' && Number(countdowns[idKey]?.m || 0) < 15)
                const timeLeftObj = countdowns[idKey] || { h: '00', m: '00', s: '00' }
                const bidErrorMsg = bidError[idKey] || ''
                const validationError = bidValidation[idKey] || ''
                const isSuccess = bidSuccess[idKey]
                const shortCertId = truncateAddress(certId || idKey)

                return (
                  <div
                    key={idKey}
                    className="card-hover"
                    style={{
                      background: isEnded ? 'rgba(234,179,8,0.04)' : '#0c0f1d',
                      border: `1px solid ${isEnded ? 'rgba(234,179,8,0.4)' : isEnding ? 'rgba(245,158,11,0.3)' : 'rgba(0,200,255,0.12)'}`,
                      borderRadius: 10,
                      overflow: 'hidden',
                      boxShadow: isEnded ? '0 0 20px rgba(234,179,8,0.15)' : '0 4px 18px rgba(0,0,0,0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {/* Imagen y Badges */}
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#070913', overflow: 'hidden' }}>
                      <img
                        src={imageUrl}
                        alt={title}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_ASSET_IMAGE }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      
                      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          background: isEnded ? '#eab308' : isEnding ? '#d97706' : '#16a34a',
                          color: isEnded ? '#000000' : '#ffffff',
                          fontWeight: 800,
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontFamily: 'JetBrains Mono',
                          letterSpacing: '0.05em',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.6)'
                        }}>
                          {isEnded ? '🏆 GANASTE ESTA SUBASTA' : isEnding ? 'TERMINANDO' : 'EN VIVO'}
                        </span>
                      </div>

                      {/* Contador Cuadrado / Tech estilo Display LCD */}
                      <div style={{ 
                        position: 'absolute', 
                        bottom: 8, 
                        left: 8, 
                        right: 8, 
                        background: 'rgba(5, 7, 15, 0.9)', 
                        backdropFilter: 'blur(6px)', 
                        padding: '6px 8px', 
                        borderRadius: 4,
                        border: `1px solid ${isEnded ? 'rgba(234, 179, 8, 0.3)' : 'rgba(0, 200, 255, 0.2)'}`,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.6)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 3, alignItems: 'center' }}>
                          {isEnded ? (
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#eab308', fontWeight: 700, letterSpacing: '0.05em' }}>
                              SUBASTA FINALIZADA
                            </span>
                          ) : (
                            [timeLeftObj.h, timeLeftObj.m, timeLeftObj.s].map((val: string, i: number) => (
                              <span key={`${idKey}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ 
                                  fontSize: 14, 
                                  fontWeight: 800, 
                                  color: isEnding ? '#f59e0b' : '#00e5ff', 
                                  fontFamily: "'Share Tech Mono', 'Orbitron', 'JetBrains Mono', monospace",
                                  letterSpacing: '1px',
                                  background: 'rgba(0, 229, 255, 0.08)',
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  border: '1px solid rgba(0, 229, 255, 0.2)',
                                  textShadow: '0 0 6px rgba(0, 229, 255, 0.5)'
                                }}>
                                  {val}
                                </span>
                                {i < 2 && <span style={{ color: '#00c8ff', fontFamily: "'Share Tech Mono', monospace", fontSize: 13, fontWeight: 700 }}>:</span>}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detalle y Botón Historial */}
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, color: '#f0f4f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {title}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#64748b' }}>
                            Cert: <span style={{ color: '#cbd5e1' }}>{shortCertId}</span>
                          </div>
                          
                          <a 
                            href={`${window.location.origin}/traceability/${encodeURIComponent(traceId)}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ textDecoration: 'none' }}
                          >
                            <button 
                              style={{ 
                                padding: '3px 8px', 
                                fontSize: 10, 
                                fontFamily: 'Rajdhani, sans-serif',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                background: 'rgba(0, 200, 255, 0.12)',
                                border: '1px solid rgba(0, 200, 255, 0.4)',
                                borderRadius: 4,
                                color: '#00c8ff',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                            >
                              HISTORIAL ↗
                            </button>
                          </a>
                        </div>

                        {/* Bloque Precios */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, padding: '6px 8px', background: isEnded ? 'rgba(234,179,8,0.08)' : 'rgba(0,200,255,0.04)', borderRadius: 6, border: `1px solid ${isEnded ? 'rgba(234,179,8,0.2)' : 'rgba(0,200,255,0.08)'}` }}>
                          <div>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: '#64748b', textTransform: 'uppercase' }}>{isEnded ? 'Puja Ganadora' : 'Puja Actual'}</div>
                            <div style={{ fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 15, color: isEnded ? '#eab308' : '#00c8ff' }}>${displayBid}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: '#64748b', textTransform: 'uppercase' }}>{isEnded ? 'Estado' : 'Mín Siguiente'}</div>
                            <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, color: '#22c55e' }}>{isEnded ? 'Ganada' : `$${minNextBid.toFixed(2)}`}</div>
                          </div>
                        </div>
                      </div>

                      {/* Acciones Pujar / Reclamar */}
                      {isSuccess ? (
                        <div style={{ padding: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, textAlign: 'center', color: '#22c55e', fontSize: 11, fontFamily: 'Rajdhani', fontWeight: 700 }}>
                          ✓ PUJA ENVIADA (TIEMPO REAL)
                        </div>
                      ) : (() => {
                        if (isEnded && isWinner) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ padding: '4px 6px', background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 4, textAlign: 'center', color: '#facc15', fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700 }}>
                                ¡Eres el ganador! Reclama tu cNFT
                              </div>
                              <button className="btn-accent" style={{ width: '100%', padding: '7px 10px', fontSize: 11, fontWeight: 700 }} onClick={() => handleClaimAuction(auction)}>
                                💳 RECLAMAR Y PAGAR
                              </button>
                            </div>
                          )
                        }

                        return (
                          <div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input
                                className="input-base"
                                type="number"
                                placeholder={`$${minNextBid.toFixed(2)}`}
                                value={bidAmount[idKey] || ''}
                                onChange={e => {
                                  setBidAmount(prev => ({ ...prev, [idKey]: e.target.value }))
                                  setBidValidation(prev => ({ ...prev, [idKey]: '' }))
                                }}
                                style={{
                                  fontFamily: 'JetBrains Mono',
                                  fontSize: 11,
                                  padding: '5px 6px',
                                  width: '100%',
                                  border: validationError ? '1px solid #ef4444' : undefined
                                }}
                                disabled={isEnded}
                              />
                              <button
                                className={isEnding ? 'btn-gold' : 'btn-primary'}
                                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                                onClick={() => handleBid(idKey, auction.asset_id || auction.id, currentBidVal || startingVal)}
                              >
                                PUJAR
                              </button>
                            </div>
                            {(validationError || bidErrorMsg) && (
                              <div style={{ fontSize: 9, color: '#ef4444', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                                {validationError || bidErrorMsg}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Historial Compacto Ajustado */}
            <div style={{ background: '#0c0f1d', borderRadius: 10, border: '1px solid rgba(0,200,255,0.1)', padding: 10 }}>
              <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#f0f4f9', marginBottom: 1 }}>Mis Pujas</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#64748b', marginBottom: 8 }}>Historial reciente</div>

              <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {userBidHistoryLoading ? (
                  <div style={{ padding: 8, color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: 10 }}>Cargando...</div>
                ) : userBidHistory.length > 0 ? (
                  userBidHistory.map((bid: any) => {
                    const rawTitle = bid.title || bid.asset_id || ''
                    const displayTitle = rawTitle.startsWith('Subasta ') || rawTitle.length > 12 
                      ? truncateAddress(rawTitle, 5, 3) 
                      : rawTitle

                    return (
                      <div
                        key={`${bid.asset_id}-${bid.bid_hash || bid.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 7px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.03)'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1, paddingRight: 4 }}>
                          <div style={{ fontWeight: 600, fontFamily: 'Rajdhani', fontSize: 11, color: '#dde3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {displayTitle}
                          </div>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: '#64748b' }}>
                            {bid.created_at ? new Date(bid.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 12, color: '#00c8ff' }}>
                          ${Number(bid.bid_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div style={{ padding: 8, color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: 10 }}>Sin pujas registradas.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PRODUCT HISTORY ──────────────────────────────────────────────────────────

const HISTORY_DATA = [
  { event: 'Certificado emitido', date: '2024-03-15 09:42', actor: 'LuxeTime SA', hash: '0x4a2f...8e91', type: 'mint' },
  { event: 'Transferencia de propiedad', date: '2024-04-01 14:18', actor: '0x742d...3b9a', hash: '0x91bc...3f2a', type: 'transfer' },
  { event: 'Listado en marketplace', date: '2024-04-12 11:05', actor: '0x742d...3b9a', hash: '0x2d8c...7b14', type: 'market' },
  { event: 'Compra confirmada', date: '2024-05-20 16:33', actor: '0x8f3c...2a11', hash: '0x5e3a...9c77', type: 'purchase' },
  { event: 'Verificación de autenticidad', date: '2024-06-01 08:50', actor: 'Sistema CertChain', hash: '0x7f1d...4e22', type: 'verify' },
]

export function ClientHistory() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!query) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setSearched(true) }, 1200)
  }

  const typeColors: Record<string, string> = {
    mint: '#00c8ff', transfer: '#7c3aed', market: '#f59e0b', purchase: '#22c55e', verify: '#8a93b8',
  }
  const typeLabels: Record<string, string> = {
    mint: 'Mint NFT', transfer: 'Transferencia', market: 'Marketplace', purchase: 'Compra', verify: 'Verificación',
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Historial de Producto" subtitle="Trazabilidad completa en blockchain" />
      <div style={{ padding: '28px 32px' }}>
        {/* Search form */}
        <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: '28px', marginBottom: 32 }}>
          <SectionTitle sub="Ingresa el ID o hash del certificado para ver su trazabilidad completa">Buscar por ID de Producto</SectionTitle>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5a6485' }} />
                <input
                  className="input-base"
                  style={{ paddingLeft: 36, fontFamily: 'JetBrains Mono', fontSize: 13 }}
                  placeholder="PRD-001 o 0x4a2f8e91bc3f..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px 28px' }}>
                {loading ? 'BUSCANDO...' : 'BUSCAR'}
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
            {['PRD-001', 'PRD-003', 'AUC-002'].map(s => (
              <button key={s} onClick={() => setQuery(s)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6485',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ color: '#00c8ff', opacity: 0.5 }}>#</span>{s}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {searched && (
          <>
            {/* Product summary */}
            <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: '24px', marginBottom: 24, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <img src={MOCK_PRODUCTS[0].image} alt="product" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.08em', marginBottom: 4 }}>RESULTADO PARA: {query}</div>
                <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 20, letterSpacing: '0.04em', marginBottom: 6 }}>Reloj Automático Heritage</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge color="#22c55e">Autenticado</Badge>
                  <Badge color="#00c8ff">Propietario actual: 0x8f3c...2a11</Badge>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485' }}>CERTIFICADO</div>
                <HashDisplay hash="0x4a2f8b9e91bc3f2a2d8c7b14" />
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485', marginTop: 4 }}>Bloque #18,432,091</div>
              </div>
            </div>

            {/* Timeline */}
            <SectionTitle sub={`${HISTORY_DATA.length} eventos registrados en la blockchain`}>Trazabilidad</SectionTitle>
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 1, background: 'rgba(0,200,255,0.1)' }} />

              {HISTORY_DATA.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 16, position: 'relative' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: `${typeColors[ev.type]}15`,
                    border: `2px solid ${typeColors[ev.type]}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[ev.type] }} />
                  </div>
                  <div className="glow-border" style={{
                    flex: 1, background: '#0c0f1d', borderRadius: 10, padding: '14px 18px',
                    border: `1px solid ${typeColors[ev.type]}20`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em' }}>{ev.event}</span>
                        <Badge color={typeColors[ev.type]}>{typeLabels[ev.type]}</Badge>
                      </div>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>{ev.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#8a93b8' }}>Actor: <span style={{ color: '#dde3f0' }}>{ev.actor}</span></div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#8a93b8' }}>TX: <HashDisplay hash={ev.hash} /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!searched && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#5a6485' }}>
            <Search size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
            <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>INGRESA UN ID DE PRODUCTO</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>Consulta el historial completo de cualquier producto certificado</div>
          </div>
        )}
      </div>
    </div>
  )
}

/// WALEET cNFT Inventory Component ///

// Utilidad para formatear valores monetarios de forma segura
function formatCurrency(val: number): string {
  if (isNaN(val) || val < 0) return '$0'
  return `$${val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function getAssetValue(asset: any) {
  const attrs = asset?.content?.metadata?.attributes || asset?.content?.attributes || []
  const candidates = ['Valor estimado (USD)', 'Valor', 'Precio (USD)', 'valor estimado', 'price_usd']

  for (const key of candidates) {
    const found = attrs.find((attribute: any) => {
      const trait = String(attribute?.trait_type || attribute?.traitType || attribute?.type || '').toLowerCase()
      const value = String(attribute?.value || attribute?.value_string || attribute?.trait_value || '').toLowerCase()
      return trait === key.toLowerCase() || value === key.toLowerCase()
    })

    if (found) {
      const raw = found.value ?? found.value_string ?? found.trait_value ?? null
      const parsed = Number(String(raw).replace(/[$,]/g, ''))
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed
    }
  }

  const fallback = Number(String(asset?.price_usd ?? asset?.price ?? 0).replace(/[$,]/g, ''))
  return Number.isNaN(fallback) || fallback < 0 ? 0 : fallback
}

function getAssetCategory(asset: any) {
  const attrs = asset?.content?.metadata?.attributes || asset?.content?.attributes || []
  const found = attrs.find((attribute: any) => {
    const trait = String(attribute?.trait_type || attribute?.traitType || attribute?.type || '').toLowerCase()
    return trait === 'categoria' || trait === 'category' || trait === 'tipo'
  })

  if (found) return String(found.value || found.value_string || found.trait_value || 'General')
  return 'General'
}

function getAssetImage(asset: any) {
  const image = resolveAssetImage?.(asset) || asset?.content?.links?.image || DEFAULT_ASSET_IMAGE
  return image || DEFAULT_ASSET_IMAGE
}

export function ClientWallet() {
  const { publicKey } = useWallet()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marketplaceListings, setMarketplaceListings] = useState<any[]>([])
  const [auctionListings, setAuctionListings] = useState<any[]>([])
  const [copiedWallet, setCopiedWallet] = useState(false)
  
  // Estado para el modal de QR
  const [qrModal, setQrModal] = useState<{ open: boolean; url: string; title: string; assetId: string }>({
    open: false,
    url: '',
    title: '',
    assetId: ''
  })

  useEffect(() => {
    let cancelled = false

    async function fetchWalletAssets() {
      if (!publicKey) {
        setAssets([])
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const payload = {
          jsonrpc: '2.0',
          id: 'client-wallet-assets',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: publicKey.toString(),
            page: 1,
            limit: 100,
          },
        }

        const res = await fetch(DAS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error(`Error RPC ${res.status}`)

        const json = await res.json()
        const candidates = json.result?.assets || json.result?.items || json.result || []
        const assetsList = Array.isArray(candidates) ? candidates : []

        const filtered = assetsList.filter((asset: any) => {
          const isCompressed = asset?.compression?.compressed === true || asset?.interface === 'V1_NFT'
          const notBurnt = asset?.burnt !== true
          if (!isCompressed || !notBurnt) return false

          const metadata = asset?.content?.metadata || {}
          const symbol = String(metadata?.symbol || '').toUpperCase()
          const attrs = Array.isArray(metadata?.attributes) ? metadata.attributes : Array.isArray(asset?.content?.attributes) ? asset.content.attributes : []
          const hasCertSymbol = symbol === 'CERT'
          const hasPlatformTag = attrs.some((attribute: any) => {
            const trait = String(attribute?.trait_type || attribute?.traitType || attribute?.type || '').toLowerCase()
            const value = String(attribute?.value || attribute?.value_string || attribute?.trait_value || '').toLowerCase()
            return (trait === 'plataforma' && value === 'certchain') || (trait === 'tipo' && value.includes('certificado'))
          })
          const treeMatch = String(asset?.compression?.tree || '') === String(DEFAULT_MERKLE_TREE_PUBKEY)

          return hasCertSymbol || hasPlatformTag || treeMatch
        })

        if (!cancelled) setAssets(filtered)
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error fetching wallet assets', err)
          setAssets([])
          setError(err?.message || 'No se pudo consultar la wallet.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchWalletAssets()

    async function fetchExternalLists() {
      try {
        const [mRes, aRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/marketplace/listings`),
          fetch(`${API_BASE_URL}/api/auctions/listings`)
        ])
        if (mRes.ok) {
          const mJson = await mRes.json()
          if (Array.isArray(mJson) && !cancelled) setMarketplaceListings(mJson)
        }
        if (aRes.ok) {
          const aJson = await aRes.json()
          if (Array.isArray(aJson) && !cancelled) setAuctionListings(aJson)
        }
      } catch (e) {
        // ignore
      }
    }
    fetchExternalLists()
    return () => { cancelled = true }
  }, [publicKey])

  const totalValue = assets.reduce((sum, asset) => sum + getAssetValue(asset), 0)
  const walletAddress = publicKey ? publicKey.toString() : ''

  const handleCopyWallet = () => {
    if (!walletAddress) return
    navigator.clipboard?.writeText(walletAddress).then(() => {
      setCopiedWallet(true)
      setTimeout(() => setCopiedWallet(false), 2000)
    }).catch(() => {})
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#070913', minHeight: '100vh', color: '#f0f4f9' }}>
      <TopBar title="Mi Wallet" subtitle="Certificados cNFT en mi propiedad" />

      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        
        {/* METRICS METRICS METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatCard label="Total de cNFTs" value={String(assets.length)} icon={<Package size={18} />} color="#00c8ff" />
          <StatCard label="Valor estimado" value={formatCurrency(totalValue)} icon={<TrendingUp size={18} />} color="#7c3aed" delta={assets.length > 0 ? '+12.4%' : '0%'} />
          <StatCard label="Red blockchain" value="Solana Devnet" icon={<Zap size={18} />} color="#f59e0b" />
        </div>

        {/* FULL WALLET ADDRESS BANNER */}
        <div className="glow-border" style={{ background: '#0d1126', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 14, padding: '18px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#00c8ff', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 6 }}>
              DIRECCIÓN DE WALLET CONECTADA
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#ffffff', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              {walletAddress || 'Sin wallet conectada'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {walletAddress && (
              <button
                type="button"
                onClick={handleCopyWallet}
                className="btn-ghost"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono',
                  background: copiedWallet ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 200, 255, 0.1)',
                  border: `1px solid ${copiedWallet ? '#22c55e' : 'rgba(0, 200, 255, 0.3)'}`,
                  color: copiedWallet ? '#22c55e' : '#00c8ff',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {copiedWallet ? <Check size={14} /> : <Copy size={14} />}
                {copiedWallet ? 'Copiado' : 'Copiar'}
              </button>
            )}
            <Badge color={publicKey ? '#22c55e' : '#f59e0b'}>
              {publicKey ? 'Conectada' : 'Sin conectar'}
            </Badge>
          </div>
        </div>

        {/* SECTION HEADER */}
        <SectionTitle sub="Coleccion de Certificados cNFT">
          Mis Certificados cNFT
        </SectionTitle>

        {/* CONTENT STATES */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
            Consultando activos en la blockchain...
          </div>
        ) : error ? (
          <div style={{ padding: '20px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#fecaca', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
            {error}
          </div>
        ) : !publicKey ? (
          <div style={{ padding: '60px 20px', border: '1px dashed rgba(0,200,255,0.2)', borderRadius: 14, textAlign: 'center', background: 'rgba(0,200,255,0.02)' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Conecta tu wallet</div>
            <div style={{ color: '#8a93b8', fontSize: 13 }}>Necesitas conectar tu Phantom o Solflare Wallet para gestionar tus cNFTs.</div>
          </div>
        ) : assets.length === 0 ? (
          <div style={{ padding: '60px 20px', border: '1px dashed rgba(0,200,255,0.2)', borderRadius: 14, textAlign: 'center', background: 'rgba(0,200,255,0.02)' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>No tienes certificados cNFT</div>
            <div style={{ color: '#8a93b8', fontSize: 13 }}>Cuando emitas o adquieras un certificado verificado, aparecerá aquí.</div>
          </div>
        ) : (
          /* GRID DE CARDS */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 24 }}>
            {assets.map((asset: any, idx: number) => {
              const name = asset?.content?.metadata?.name || `Certificado ${String(asset?.id || asset?.assetId || idx)}`
              const category = getAssetCategory(asset)
              const value = getAssetValue(asset)
              const acquired = asset?.created_at ? new Date(asset.created_at).toLocaleDateString('es-ES') : 'N/D'
              const image = getAssetImage(asset)
              const assetId = String(asset?.id || asset?.assetId || '')

              // Validación del estado del Certificado
              const inMarketplace = marketplaceListings.some((l: any) => String(l.asset_id || l.assetId || l.id || '') === assetId)
              const inAuction = auctionListings.some((a: any) => String(a.asset_id || a.assetId || a.id || '') === assetId)

              const historyUrl = `${window.location.origin}/traceability/${encodeURIComponent(assetId)}`
              const traceUrl = `${window.location.origin}/verify/${encodeURIComponent(assetId)}`

              return (
                <div
                  key={`${assetId || idx}`}
                  style={{
                    background: '#0e1225',
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.07)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s, border-color 0.2s'
                  }}
                  className="card-hover"
                >
                  {/* IMAGEN DE CARD CON PROPORCIÓN ADECUADA */}
                  <div style={{ position: 'relative', width: '100%', height: 210, background: '#05070f', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img
                      src={image}
                      alt={name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0e1225 0%, transparent 60%)' }} />
                    
                    {/* ID BADGE */}
                    <div style={{ position: 'absolute', top: 12, left: 12 }}>
                      <Badge color="#00c8ff">{assetId ? `${assetId.slice(0, 6)}...` : `CNFT-${idx + 1}`}</Badge>
                    </div>

                    {/* STATUS BADGE */}
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                      {inAuction ? (
                        <Badge color="#f59e0b">En Subasta</Badge>
                      ) : inMarketplace ? (
                        <Badge color="#f97316">En Marketplace</Badge>
                      ) : (
                        <Badge color="#22c55e">En Wallet</Badge>
                      )}
                    </div>
                  </div>

                  {/* CONTENIDO DE LA CARD */}
                  <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: '#ffffff', letterSpacing: '0.02em', marginBottom: 2 }}>
                      {name}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#00c8ff', marginBottom: 16 }}>
                      {category}
                    </div>

                    {/* METRADOS ADQUIRIDO / VALOR */}
                    {acquired && acquired !== 'N/D' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#6c7a9c', marginBottom: 2, letterSpacing: '0.05em' }}>ADQUIRIDO</div>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#dde3f0', fontWeight: 600 }}>{acquired}</div>
                        </div>
                        <div style={{ background: 'rgba(124,58,237,0.08)', borderRadius: 10, padding: '10px', border: '1px solid rgba(124,58,237,0.2)' }}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#a78bfa', marginBottom: 2, letterSpacing: '0.05em' }}>VALOR ESTIMADO</div>
                          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, color: '#a78bfa' }}>{formatCurrency(value)}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ background: 'rgba(124,58,237,0.08)', borderRadius: 10, padding: '14px', border: '1px solid rgba(124,58,237,0.2)' }}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#a78bfa', marginBottom: 6, letterSpacing: '0.05em' }}>VALOR ESTIMADO</div>
                          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: '#a78bfa' }}>{formatCurrency(value)}</div>
                        </div>
                      </div>
                    )}

                    {/* HASH COMPONENT CLEANUP */}
                    <div style={{ marginBottom: 18, background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485' }}>HASH:</span>
                      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#a0aec0' }}>
                        {assetId}
                      </div>
                    </div>

                    {/* BOTONES DE ACCIÓN REDISEÑADOS */}
                    <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => window.open(historyUrl, '_blank')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 600,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <ArrowUpRight size={14} /> Historial
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrModal({ open: true, url: traceUrl, title: name, assetId })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '10px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #00c8ff 0%, #0088ff 100%)',
                          border: 'none',
                          color: '#000000',
                          cursor: 'pointer'
                        }}
                      >
                        <QrCode size={14} /> Código QR
                      </button>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL GENERADOR CÓDIGO QR DE VERIFICACIÓN */}
      {qrModal.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(3, 5, 12, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0e1225', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <button
              onClick={() => setQrModal({ open: false, url: '', title: '', assetId: '' })}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#8a93b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#fff' }}>Verificación en Blockchain</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#00c8ff', marginBottom: 20 }}>{qrModal.title}</div>

            {/* INTEGRACIÓN DE QR (Mediante API de Google Charts o Canvas QR) */}
            <div style={{ background: '#ffffff', padding: 16, borderRadius: 14, display: 'inline-block', marginBottom: 20 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrModal.url)}`}
                alt="QR Code"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </div>

            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#6c7a9c', marginBottom: 16, wordBreak: 'break-all' }}>
              ID: {qrModal.assetId}
            </div>

            <a
              href={qrModal.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                background: 'rgba(0, 200, 255, 0.12)',
                border: '1px solid rgba(0, 200, 255, 0.3)',
                color: '#00c8ff',
                fontFamily: 'JetBrains Mono',
                fontSize: 12,
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              <ExternalLink size={14} /> Abrir verificación pública
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CLIENT TRANSFER / SELL ───────────────────────────────────────────────────

export function ClientTransfer() {
  const { publicKey } = useWallet()
  const umi = useUmi()
  
  const [mode, setMode] = useState<'transfer' | 'sell'>('transfer')
  const [assets, setAssets] = useState<any[]>([])
  const [myListings, setMyListings] = useState<any[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedNft, setSelectedNft] = useState('')
  const [destination, setDestination] = useState('')
  const [note, setNote] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [description, setDescription] = useState('')
  
  const [submitted, setSubmitted] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Fetch Wallet Assets
  useEffect(() => {
    let cancelled = false

    async function fetchWalletAssets() {
      if (!publicKey) {
        setAssets([])
        setError(null)
        setLoading(false)
        setSelectedNft('')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const payload = {
          jsonrpc: '2.0',
          id: 'client-transfer-assets',
          method: 'getAssetsByOwner',
          params: { ownerAddress: publicKey.toString(), page: 1, limit: 100 },
        }

        const res = await fetch(DAS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error(`RPC error ${res.status}`)

        const json = await res.json()
        const candidates = json.result?.assets || json.result?.items || json.result || []
        const list = Array.isArray(candidates) ? candidates : []

        // Also fetch public marketplace listings to avoid allowing transfer/listing of already-listed assets
        let listedSet = new Set()
        try {
          const listRes = await fetch(`${API_BASE_URL}/api/marketplace/listings`)
          if (listRes.ok) {
            const listJson = await listRes.json()
            if (Array.isArray(listJson)) {
              const ids = listJson.map((a: any) => String(a.asset_id || a.id || a.assetId || ''))
              listedSet = new Set(ids)
            }
          }
        } catch (e) {
          // ignore listing fetch errors - we'll still show assets but operations will be blocked server-side
        }

        const filtered = list.filter((asset: any) => {
            const assetIdStr = String(asset?.id || asset?.assetId || asset?.mint || '')
            if (assetIdStr && listedSet.has(assetIdStr)) return false

            const isCompressed = asset?.compression?.compressed === true || asset?.interface === 'V1_NFT'
            const notBurnt = asset?.burnt !== true
            if (!isCompressed || !notBurnt) return false

            const metadata = asset?.content?.metadata || {}
            const symbol = String(metadata?.symbol || '').toUpperCase()
            const attrs = Array.isArray(metadata?.attributes) ? metadata.attributes : Array.isArray(asset?.content?.attributes) ? asset.content.attributes : []
            const hasCertSymbol = symbol === 'CERT'
            const hasPlatformTag = attrs.some((attribute: any) => {
              const trait = String(attribute?.trait_type || attribute?.traitType || attribute?.type || '').toLowerCase()
              const value = String(attribute?.value || attribute?.value_string || attribute?.trait_value || '').toLowerCase()
              return (trait === 'plataforma' && value === 'certchain') || (trait === 'tipo' && value.includes('certificado'))
            })
            const treeMatch = String(asset?.compression?.tree || '') === String(DEFAULT_MERKLE_TREE_PUBKEY)

            return hasCertSymbol || hasPlatformTag || treeMatch
          })

        if (!cancelled) {
          setAssets(filtered)
          if (!filtered.some((asset: any) => String(asset?.id || asset?.assetId) === selectedNft)) {
            setSelectedNft(filtered[0]?.id || filtered[0]?.assetId || '')
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error fetching transfer assets', err)
          setAssets([])
          setError(err?.message || 'No se pudo consultar tus certificados.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchWalletAssets()
    return () => { cancelled = true }
  }, [publicKey])

  // Fetch My Marketplace Listings
  const fetchMyListings = async () => {
    if (!publicKey) return
    setLoadingListings(true)
    try {
      // Backend exposes seller listings at /api/marketplace/seller/:wallet
      const res = await fetch(`${API_BASE_URL}/api/marketplace/seller/${encodeURIComponent(publicKey.toString())}`)
      if (res.ok) {
        const data = await res.json()
        setMyListings(Array.isArray(data) ? data : (data?.listings || []))
      }
    } catch (err) {
      console.warn('Error fetching listings:', err)
    } finally {
      setLoadingListings(false)
    }
  }

  useEffect(() => {
    if (mode === 'sell' && publicKey) {
      fetchMyListings()
    }
  }, [mode, publicKey])

  // Eliminar / Cancelar listado del marketplace
  const handleRemoveListing = async (listingId: string) => {
    if (!confirm('¿Estás seguro de quitar este artículo del marketplace?')) return
    try {
      const assetId = listingId || ''
      const res = await fetch(`${API_BASE_URL}/api/marketplace/list/${encodeURIComponent(assetId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Error al cancelar el listado')
      }
      fetchMyListings()
      triggerDataRefresh('marketplace')
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el artículo.')
    }
  }

  const selectedAsset = assets.find((asset: any) => String(asset?.id || asset?.assetId) === selectedNft) || null
  const selectedAssetImage = selectedAsset ? selectedAsset.content?.links?.image || selectedAsset.content?.files?.[0]?.uri || '' : ''
  const selectedAssetName = selectedAsset?.content?.metadata?.name || 'Certificado'

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!publicKey) {
      setError('Conecta tu wallet para continuar.')
      return
    }

    if (!selectedAsset) {
      setError('Selecciona un certificado cNFT.')
      return
    }

    if (mode === 'transfer') {
      if (!destination.trim()) {
        setError('Ingresa la wallet del destinatario.')
        return
      }
      try {
        new PublicKey(destination.trim())
      } catch {
        setError('La wallet destino no es una PublicKey válida de Solana.')
        return
      }
    }

    if (mode === 'sell') {
      const parsedPrice = Number(priceUsd)
      if (!priceUsd || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
        setError('Ingresa un precio válido para el listado.')
        return
      }
    }

    setProcessing(true)

    try {
      if (mode === 'transfer') {
        const destinationPubkey = new PublicKey(destination.trim())
        const assetId = String(selectedAsset.id || selectedAsset.assetId || selectedAsset.mint || '')
        if (!assetId) throw new Error('No se pudo resolver el asset_id.')

        // Security: do not allow transferring an asset that is currently listed in the marketplace
        try {
          const listingsCheck = await fetch(`${API_BASE_URL}/api/marketplace/listings`)
          if (listingsCheck.ok) {
            const listingsJson = await listingsCheck.json()
            if (Array.isArray(listingsJson)) {
              const isListed = listingsJson.some((l: any) => String(l.asset_id || l.assetId || l.id || '') === assetId)
              if (isListed) throw new Error('No se puede transferir un certificado que está listado en el marketplace.')
            }
          }
        } catch (e) {
          // If the listings check fails, we avoid silently allowing transfers; fail safe and continue to try transfer
          // but prefer to surface the error from the on-chain transfer if any. Do not block here on fetch failure.
        }

        const assetWithProof = await getAssetWithProof(umi, assetId, { truncateCanopy: true })
        const currentOwner = umi.identity?.publicKey ?? publicKey
        const merkleTreePubkey = String(assetWithProof.merkleTree?.toString?.() || DEFAULT_MERKLE_TREE_PUBKEY)

        const txBuilder = await sendBubblegumTransferWithRetry(umi, {
          leafOwner: currentOwner,
          leafDelegate: currentOwner,
          newLeafOwner: umiPublicKey(destinationPubkey.toString()),
          merkleTree: umiPublicKey(merkleTreePubkey),
          root: assetWithProof.root,
          dataHash: assetWithProof.dataHash,
          creatorHash: assetWithProof.creatorHash,
          nonce: assetWithProof.nonce,
          index: assetWithProof.index,
          proof: assetWithProof.proof,
        })

        const signature = txBuilder?.signature || txBuilder

        await fetch(`${API_BASE_URL}/api/certificates/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset_id: assetId,
            previous_owner: publicKey.toString(),
            new_owner: destinationPubkey.toString(),
            transfer_type: 'transfer',
            tx_hash: signature,
            note: note || null,
          }),
        }).catch((err: any) => console.warn('No se pudo notificar al backend:', err))

        triggerDataRefresh('inventory')
        triggerDataRefresh('marketplace')
        triggerDataRefresh('auctions')
      }

      if (mode === 'sell') {
        const res = await fetch(`${API_BASE_URL}/api/marketplace/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset_id: selectedAsset.id || selectedAsset.assetId,
            seller_wallet: publicKey.toString(),
            price_usd: Number(priceUsd),
            description: description || note || 'Certificado listado por el usuario.',
            title: selectedAsset.content?.metadata?.name || 'Certificado CertChain',
            image: selectedAsset.content?.links?.image || selectedAsset.content?.files?.[0]?.uri || '',
            category: selectedAsset.content?.metadata?.attributes?.find((attribute: any) => ['categoria', 'category', 'tipo'].includes(String(attribute?.trait_type || attribute?.traitType || attribute?.type || '').toLowerCase()))?.value || 'General',
          }),
        })

        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || 'No se pudo listar el certificado.')

        triggerDataRefresh('marketplace')
        triggerDataRefresh('inventory')
        fetchMyListings()
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err?.message || 'No se pudo completar la operación.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', paddingBottom: 40 }}>
      <TopBar title="Transferir / Vender" subtitle="Transfiere o vende tus certificados" />
      
      <div style={{ padding: '28px 32px' }}>
        {/* Selector de Modo */}
        <div style={{ display: 'flex', background: '#0c0f1d', borderRadius: 10, padding: 4, marginBottom: 24, border: '1px solid rgba(0,200,255,0.1)', width: 'fit-content' }}>
          {(['transfer', 'sell'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSubmitted(false); setError(null) }}
              style={{
                padding: '9px 24px', borderRadius: 7, cursor: 'pointer',
                background: mode === m ? (m === 'transfer' ? 'rgba(0,200,255,0.12)' : 'rgba(245,158,11,0.12)') : 'none',
                border: mode === m ? `1px solid ${m === 'transfer' ? 'rgba(0,200,255,0.3)' : 'rgba(245,158,11,0.3)'}` : '1px solid transparent',
                fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em',
                color: mode === m ? (m === 'transfer' ? '#00c8ff' : '#f59e0b') : '#5a6485',
                transition: 'all 0.2s',
              }}
            >
              {m === 'transfer' ? '⇄ TRANSFERIR' : '$ PONER EN VENTA'}
            </button>
          ))}
        </div>

        {/* Layout en Grid: Formulario a la Izquierda, Preview a la Derecha */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          
          {/* Panel Izquierdo: Formulario Principal */}
          <div>
            {submitted ? (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '40px', textAlign: 'center' }}>
                <CheckCircle2 size={48} color="#22c55e" style={{ marginBottom: 16 }} />
                <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>
                  {mode === 'transfer' ? 'TRANSFERENCIA PREPARADA' : 'PRODUCTO LISTADO'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#5a6485', marginBottom: 20 }}>
                  {mode === 'transfer'
                    ? 'La solicitud de transferencia quedó preparada y lista para confirmarse en tu wallet.'
                    : 'El certificado ya quedó registrado en el marketplace con el precio indicado.'}
                </div>
                <HashDisplay hash={selectedAsset ? String(selectedAsset.id || selectedAsset.assetId) : 'transfer'} />
                <div style={{ marginTop: 20 }}>
                  <button className="btn-ghost" onClick={() => { setSubmitted(false); setDestination(''); setNote(''); setPriceUsd(''); setDescription('') }}>
                    NUEVA OPERACIÓN
                  </button>
                </div>
              </div>
            ) : (
              <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: '28px' }}>
                <SectionTitle sub={mode === 'transfer' ? 'Transfiere la propiedad de un cNFT a otro usuario' : 'Lista tu producto en el marketplace para venta'}>
                  {mode === 'transfer' ? 'Transferir Propiedad' : 'Poner en Venta'}
                </SectionTitle>

                {!publicKey ? (
                  <div style={{ padding: '24px 12px', border: '1px dashed rgba(0,200,255,0.2)', borderRadius: 12, textAlign: 'center', background: 'rgba(0,200,255,0.03)', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                    Conecta tu wallet para consultar tus certificados.
                  </div>
                ) : loading ? (
                  <div style={{ padding: '24px', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>Cargando certificados...</div>
                ) : assets.length === 0 ? (
                  <div style={{ padding: '24px 12px', border: '1px dashed rgba(0,200,255,0.2)', borderRadius: 12, textAlign: 'center', background: 'rgba(0,200,255,0.03)' }}>
                    <div style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#f0f4f9' }}>No tienes certificados cNFT</div>
                    <div style={{ color: '#8a93b8', fontSize: 13 }}>Cuando poseas algún certificado verificado, aparecerá aquí tu inventario.</div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                        Seleccionar cNFT
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {assets.map((asset: any) => {
                          const assetId = String(asset?.id || asset?.assetId || '')
                          const itemName = asset?.content?.metadata?.name || `Certificado ${assetId.slice(0, 8)}`
                          const img = asset.content?.links?.image || asset.content?.files?.[0]?.uri || ''
                          const value = getAssetValue(asset)

                          return (
                            <button
                              key={assetId}
                              type="button"
                              onClick={() => setSelectedNft(assetId)}
                              style={{
                                background: selectedNft === assetId ? 'rgba(0,200,255,0.08)' : 'rgba(0,200,255,0.03)',
                                border: `1px solid ${selectedNft === assetId ? 'rgba(0,200,255,0.35)' : 'rgba(0,200,255,0.12)'}`,
                                borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <img src={img || DEFAULT_ASSET_IMAGE} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontFamily: 'Rajdhani', fontSize: 13, fontWeight: 700, color: '#dde3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemName}</div>
                                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#5a6485' }}>{assetId.slice(0, 8)}</div>
                                </div>
                              </div>
                              <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#00c8ff' }}>${value.toLocaleString()}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {mode === 'transfer' ? (
                      <>
                        <div>
                          <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                            Dirección del Destinatario
                          </label>
                          <input
                            className="input-base"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="0x742d35Cc6634C0532925a3b8D4C9..."
                            style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                            Nota (opcional)
                          </label>
                          <textarea
                            className="input-base"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Mensaje para el destinatario..."
                            rows={3}
                            style={{ resize: 'none' }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <div>
                            <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                              Precio de venta (USD)
                            </label>
                            <input
                              className="input-base"
                              type="number"
                              value={priceUsd}
                              onChange={(e) => setPriceUsd(e.target.value)}
                              placeholder="2500"
                              required
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                              Duración del listado
                            </label>
                            <select className="input-base" value="7 días" style={{ cursor: 'pointer' }}>
                              <option>7 días</option>
                              <option>14 días</option>
                              <option>30 días</option>
                              <option>Indefinido</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                            Descripción para el marketplace
                          </label>
                          <textarea
                            className="input-base"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Describe el estado y características del producto..."
                            style={{ resize: 'none' }}
                          />
                        </div>
                      </>
                    )}

                    {error && (
                      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)', color: '#fecaca', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                        {error}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 8 }}>
                      <AlertCircle size={14} color="#00c8ff" />
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#8a93b8' }}>
                        {mode === 'transfer'
                          ? 'Esta acción requiere confirmar la transferencia desde tu wallet conectada.'
                          : 'Se cobrará una comisión del 2.5% al completarse la venta.'}
                      </span>
                    </div>

                    <button type="submit" disabled={processing || !selectedAsset} className={mode === 'transfer' ? 'btn-primary' : 'btn-gold'} style={{ padding: '13px', fontSize: 15, opacity: processing || !selectedAsset ? 0.7 : 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {processing ? 'PROCESANDO...' : mode === 'transfer' ? <><Send size={15} /> CONFIRMAR TRANSFERENCIA</> : <><TrendingUp size={15} /> LISTAR EN MARKETPLACE</>}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Panel Derecho: Preview del cNFT Seleccionado */}
          <div>
            {!submitted && publicKey && selectedAsset ? (
              <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: 20, position: 'sticky', top: 20 }}>
                <SectionTitle sub="Información detallada del cNFT activo">Resumen del cNFT</SectionTitle>
                <div style={{ marginTop: 12 }}>
                  <img src={selectedAssetImage || DEFAULT_ASSET_IMAGE} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(0,200,255,0.15)', marginBottom: 16 }} />
                  <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>{selectedAssetName}</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8a93b8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>ID:</span>
                      <span style={{ color: '#dde3f0' }}>{String(selectedAsset.id || selectedAsset.assetId).slice(0, 10)}...</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Categoría:</span>
                      <span style={{ color: '#dde3f0' }}>{getAssetCategory(selectedAsset)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Valor Estimado:</span>
                      <span style={{ color: '#00c8ff', fontWeight: 700 }}>${getAssetValue(selectedAsset).toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
                    <Badge color="#22c55e">EN CARTERA</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 14, padding: 20, textAlign: 'center', color: '#5a6485', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                Selecciona un cNFT
              </div>
            )}
          </div>

        </div>

        {/* Sección Inferior: Listado de Artículos que Puse a la Venta */}
        {mode === 'sell' && publicKey && (
          <div style={{ marginTop: 40 }}>
            <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <SectionTitle sub="Gestión de certificados publicados actualmente en la plataforma">
                  Mis Artículos en Venta
                </SectionTitle>
                <button className="btn-ghost" onClick={fetchMyListings} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <RefreshCw size={12} /> Actualizar
                </button>
              </div>

              {loadingListings ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#8a93b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                  Cargando tus publicaciones...
                </div>
              ) : myListings.length === 0 ? (
                <div style={{ padding: '30px 12px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, textAlign: 'center', color: '#5a6485', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                  No tienes ningún artículo publicado en el marketplace actualmente.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0,200,255,0.12)', color: '#5a6485', textTransform: 'uppercase', fontSize: 10 }}>
                        <th style={{ padding: '12px 10px' }}>Artículo</th>
                        <th style={{ padding: '12px 10px' }}>Precio (USD)</th>
                        <th style={{ padding: '12px 10px' }}>Categoría</th>
                        <th style={{ padding: '12px 10px' }}>Estado</th>
                        <th style={{ padding: '12px 10px', textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myListings.map((item: any) => (
                        <tr key={item.id || item.asset_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img src={item.image || DEFAULT_ASSET_IMAGE} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                              <div>
                                <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, color: '#f0f4f9' }}>{item.title || 'Certificado'}</div>
                                <div style={{ fontSize: 10, color: '#5a6485' }}>ID: {String(item.asset_id || '').slice(0, 10)}...</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px', fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
                            ${Number(item.price_usd || item.price).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#8a93b8' }}>
                            {item.category || 'General'}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <Badge color="#f59e0b">LISTADO</Badge>
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveListing(item.asset_id || item.id)}
                              style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                color: '#f87171', borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                                fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4,
                                transition: 'all 0.2s'
                              }}
                            >
                              <Trash2 size={12} /> Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}