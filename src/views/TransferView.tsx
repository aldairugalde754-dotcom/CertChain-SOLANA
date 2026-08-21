import React, { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useUmi } from '../hooks/useUmi'
import { transfer as bubblegumTransfer } from '@metaplex-foundation/mpl-bubblegum'
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi'
import { TopBar, Badge, MOCK_PRODUCTS, SectionTitle } from '../components/Shared'
import { API_BASE_URL } from '../config'

import { resolveAssetImage, DEFAULT_ASSET_IMAGE } from '../utils/metadata'

type DasAsset = any

const RPC_URL = process.env.REACT_APP_DAS_RPC || process.env.VITE_DAS_RPC || 'https://devnet.helius-rpc.com/?api-key=568c37da-25db-4b18-b55c-143df09820c1'
const CERTCHAIN_MERKLE_TREE_PUBKEY = process.env.REACT_APP_CERTCHAIN_MERKLE || '3dhSvYubK3XUhE5QdfYTgxJnc3rCdyU5Nt1TcjeC6K6a'

function shortAssetId(id: string) {
  if (!id) return ''
  const clean = id.toString()
  return `0x${clean.slice(0, 4)}...${clean.slice(-4)}`
}

function getImageFromAsset(asset: DasAsset) {
  if (!asset) return DEFAULT_ASSET_IMAGE;
  return resolveAssetImage(asset) || DEFAULT_ASSET_IMAGE;
}

export default function TransferView(): JSX.Element {
  const { publicKey } = useWallet()
  const umi = useUmi()

  const [loading, setLoading] = useState(false)
  const [assets, setAssets] = useState<DasAsset[]>([])
  const [error, setError] = useState<string | null>(null)

  const [selectedCert, setSelectedCert] = useState<DasAsset | null>(null)
  const [destination, setDestination] = useState('')
  const [transferType, setTransferType] = useState<'sale' | 'transfer' | 'guarantee' | 'donation'>('transfer')
  const [priceSol, setPriceSol] = useState('')
  const [processing, setProcessing] = useState(false)

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
        id: 'transfer-inventory',
        method: 'getAssetsByOwner',
        params: { ownerAddress: publicKey.toString(), page: 1, limit: 1000 },
      }

      try {
        const res = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal })
        if (!res.ok) throw new Error('RPC error ' + res.status)
        const json = await res.json()
        const candidates = json.result?.assets || json.result?.items || json.result || json.assets || []
        const rawAssets: DasAsset[] = Array.isArray(candidates) ? candidates : (Array.isArray(json.result?.data) ? json.result.data : [])

        // Apply strict filters: compressed, not burnt, and identification for CertChain
        const compressedAssets: DasAsset[] = rawAssets.filter((a: any) => a?.compression?.compressed === true)

        const filtered = compressedAssets.filter((asset: any) => {
          const isCompressed = asset?.compression?.compressed === true
          const isNotBurnt = asset?.burnt === false || asset?.burnt === undefined
          if (!isCompressed || !isNotBurnt) return false

          const metadata = asset?.content?.metadata || {}
          const symbol = (metadata?.symbol || '').toString()
          const hasCertSymbol = symbol.toUpperCase() === 'CERT'

          const attrs: any[] = Array.isArray(metadata?.attributes) ? metadata.attributes : (Array.isArray(asset?.content?.attributes) ? asset.content.attributes : [])
          const hasPlatformTag = attrs.some((attr: any) => {
            const t = String(attr.trait_type || attr.traitType || attr.type || '').toLowerCase()
            const v = String(attr.value || attr.value_string || attr.trait_value || '').toLowerCase()
            return (t === 'plataforma' && v === 'certchain') || (t === 'tipo' && v === 'certificado de autenticidad')
          })

          const treeMatch = String(asset?.compression?.tree || '') === String(CERTCHAIN_MERKLE_TREE_PUBKEY)

          return isCompressed && isNotBurnt && (hasCertSymbol || hasPlatformTag || treeMatch)
        })

        if (!aborted) setAssets(filtered)
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('Error fetching assets', err)
        if (!aborted) setError(err.message || String(err))
      } finally {
        if (!aborted) setLoading(false)
      }
    }

    fetchAssets()
    return () => { aborted = true; controller.abort() }
  }, [publicKey])

  const handleSelect = (asset: DasAsset) => {
    setSelectedCert(asset)
  }

  const handleTransfer = async () => {
    setError(null)
    if (!selectedCert) { setError('Selecciona un certificado.'); return }
    if (!destination) { setError('Ingresa la wallet destino.'); return }
    if (!publicKey) { setError('Conecta tu wallet.'); return }

    // Validate destination pubkey
    let destPub: PublicKey
    try {
      destPub = new PublicKey(destination)
    } catch (e) {
      setError('La dirección destino no es una PublicKey válida de Solana.');
      return
    }

    // For sale flow: require price
    if (transferType === 'sale' && (!priceSol || Number(priceSol) <= 0)) {
      setError('Ingresa un precio de venta válido en SOL.');
      return
    }

    setProcessing(true)

    try {
      // 1) Obtain merkle proof via DAS API getAssetProof (try `id` then fallback to `assetId`)
      const primaryPayload = { jsonrpc: '2.0', id: 'get-proof', method: 'getAssetProof', params: { id: selectedCert.id || selectedCert.assetId || selectedCert.id } }
      let proofRes = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(primaryPayload) })
      if (!proofRes.ok) throw new Error('No se pudo obtener proof: ' + proofRes.status)
      let proofJson = await proofRes.json()

      if (proofJson?.error && String(proofJson.error?.message || '').toLowerCase().includes('unknown field') && String(proofJson.error?.message || '').toLowerCase().includes('id')) {
        // retry with legacy param name
        console.warn('Primary getAssetProof rejected `id` field; retrying with `assetId`')
        const fallbackPayload = { jsonrpc: '2.0', id: 'get-proof', method: 'getAssetProof', params: { assetId: selectedCert.id || selectedCert.assetId || selectedCert.id } }
        proofRes = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fallbackPayload) })
        if (!proofRes.ok) throw new Error('No se pudo obtener proof (fallback): ' + proofRes.status)
        proofJson = await proofRes.json()
      }

      console.debug('getAssetProof response:', proofJson)
      if (proofJson?.error) {
        const msg = proofJson.error?.message || JSON.stringify(proofJson.error)
        setError('getAssetProof RPC error: ' + msg)
        setProcessing(false)
        return
      }

      const proof = proofJson.result || proofJson
      if (!proof) throw new Error('Proof vacío desde DAS API')

      // Helper: try several locations to find a numeric index/nonce
      const extractNodeIndex = (p: any) => {
        const candidates = [
          p?.node_index,
          p?.index,
          p?.nonce,
          p?.leaf_index,
          p?.leaf?.index,
          p?.leaf?.node_index,
          p?.leaf?.nonce,
          p?.node?.index,
        ]
        for (const c of candidates) {
          if (c !== undefined && c !== null) return c
        }
        // try shallow search
        for (const k of Object.keys(p || {})) {
          const v = p[k]
          if (v && typeof v === 'object') {
            for (const kk of ['node_index', 'index', 'nonce', 'leaf_index']) {
              if (v[kk] !== undefined) return v[kk]
            }
          }
        }
        return undefined
      }

      // 2) Build and send transfer instruction via Bubblegum
      // Note: transfer requires several proof fields coming from getAssetProof
      const merkleTreePubkey = selectedCert.compression?.tree || CERTCHAIN_MERKLE_TREE_PUBKEY

      // Validate proof fields and convert types where necessary
      const nodeIndexRaw = extractNodeIndex(proof)
      if (nodeIndexRaw === undefined || nodeIndexRaw === null) {
        console.error('Proof object (for debugging):', proof)
        throw new Error('Proof missing node index/nonce (node_index/index). Cannot build transfer. Revisa la respuesta de getAssetProof en la consola.')
      }

      let nodeIndexBig: bigint
      try {
        nodeIndexBig = BigInt(nodeIndexRaw)
      } catch (e) {
        throw new Error('No se pudo convertir node index/nonce a BigInt: ' + String(nodeIndexRaw))
      }

      const proofArray = proof.proof || proof.proofs || proof.leaf_proof || proof.proof_nodes
      if (!Array.isArray(proofArray)) {
        console.error('Proof array inesperado:', proofArray)
        throw new Error('Proof format inesperado: se esperaba un arreglo de nodos de prueba.')
      }

      let txBuilder: any
      try {
        txBuilder = await bubblegumTransfer(umi, {
          leafOwner: umi.identity.publicKey,
          newLeafOwner: umiPublicKey(destPub.toString()),
          merkleTree: umiPublicKey(merkleTreePubkey),
          root: proof.root,
          dataHash: proof.data_hash || proof.dataHash,
          creatorHash: proof.creator_hash || proof.creatorHash,
          nonce: nodeIndexBig,
          index: nodeIndexBig,
          proof: proofArray,
        }).sendAndConfirm(umi)
      } catch (txErr: any) {
        console.error('Bubblegum transfer error:', txErr)
        // If error exposes getLogs(), call it for richer diagnostics
        try {
          if (typeof txErr.getLogs === 'function') {
            const logs = await txErr.getLogs()
            console.error('Transaction logs from error.getLogs():', logs)
            // Inspect logs for common failures
            const joined = Array.isArray(logs) ? logs.join('\n') : String(logs)
            if (joined.includes('LeafIndexOutOfBounds') || joined.includes('Leaf index of concurrent merkle tree is out of bounds')) {
              setError('Transfer failed: LeafIndexOutOfBounds. Verifica que el `nonce/index` y `merkleTree` coincidan con el asset proof.')
            } else if (joined.includes('NoCreatorsPresent') || joined.toLowerCase().includes('no creators')) {
              setError('Transfer failed: NoCreatorsPresent. El asset proof o metadata puede carecer de creators; verifica creatorHash/dataHash en la proof.')
            } else {
              setError('Transfer failed. Revisa la consola para logs detallados.')
            }
          } else {
            setError(txErr.message || String(txErr))
          }
        } catch (inner) {
          console.error('Error fetching tx logs:', inner)
          setError(txErr.message || String(txErr))
        }
        setProcessing(false)
        return
      }

      // Extract signature
      const signature = (txBuilder as any)?.signature || txBuilder
      console.log('Transfer TX signature', signature)

      // 3) Optional: if sale, payment handling must be done by buyer; here we only perform transfer on-chain (seller initiated)

      // 4) Update backend off-chain
      try {
        await fetch(`${API_BASE_URL}/api/certificates/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: selectedCert.id, previous_owner: publicKey.toString(), new_owner: destPub.toString(), transfer_type: transferType, tx_hash: signature })
        })
      } catch (err) {
        console.warn('No se pudo notificar al backend:', err)
      }

      alert('Transferencia enviada. Ver en Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet')
      // reset
      setSelectedCert(null)
      setDestination('')
      setPriceSol('')
    } catch (err: any) {
      console.error('Error transfer:', err)
      setError(err.message || String(err))
    } finally {
      setProcessing(false)
    }
  }

  // Present a layout similar to the original CompanyTransferCert design
  const usePlaceholders = process.env.REACT_APP_USE_PLACEHOLDERS === 'true'
  const showItems = (assets.length > 0) || usePlaceholders

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <TopBar title="Transferir Certificado" subtitle="Selecciona el certificado a transferir" />
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24 }}>
          <div>
            <div className="glow-border-violet" style={{ background: '#0c0f1d', borderRadius: 14, padding: '24px', border: '1px solid rgba(124,58,237,0.2)' }}>
              <SectionTitle sub="Completa los datos de la transferencia">Datos de Transferencia</SectionTitle>

              <div style={{ marginTop: 8 }}>
                {loading ? (
                  <div>Cargando certificados...</div>
                ) : showItems ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {(assets.length > 0 ? assets : MOCK_PRODUCTS.slice(0,5)).map((a: any) => (
                      <div key={a.id} onClick={() => handleSelect(a)} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 10, cursor: 'pointer', background: selectedCert?.id === a.id ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.03)', border: selectedCert?.id === a.id ? '1px solid rgba(124,58,237,0.18)' : '1px solid rgba(124,58,237,0.06)' }}>
                        <img src={getImageFromAsset(a) || (a.image || '')} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, color: '#dde3f0' }}>{a.content?.metadata?.name || a.name}</div>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#8a93b8' }}>{shortAssetId(a.id || a.cert || a.id)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>No tienes certificados emitidos por CertChain en esta wallet</div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Wallet del destinatario *</label>
                <input className="input-base" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ej. Hx2BvP9J5zXNTRKx..." />
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Motivo de la transferencia</label>
                <select className="input-base" value={transferType} onChange={e => setTransferType(e.target.value as any)}>
                  <option value="transfer">Transferencia interna</option>
                  <option value="sale">Venta directa</option>
                  <option value="guarantee">Garantía / Devolución</option>
                  <option value="donation">Donación</option>
                </select>
              </div>

              {transferType === 'sale' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Precio de Venta (SOL)</label>
                  <input className="input-base" value={priceSol} onChange={e => setPriceSol(e.target.value)} placeholder="0.5" />
                </div>
              )}

              {error && <div style={{ marginTop: 12, color: 'salmon' }}>{error}</div>}

              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <button type="button" className="btn-accent" disabled={!selectedCert || !destination || processing} onClick={handleTransfer}>{processing ? 'Procesando transferencia...' : 'TRANSFERIR CERTIFICADO'}</button>
                <button type="button" className="btn-ghost" onClick={() => { setSelectedCert(null); setDestination(''); setPriceSol('') }}>CANCELAR</button>
              </div>
            </div>
          </div>

          <div>
            <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 14, padding: 20 }}>
              <SectionTitle sub="Resumen">Resumen</SectionTitle>
              {!selectedCert ? (
                <div style={{ padding: 18 }}>Selecciona un certificado a la izquierda para ver el resumen.</div>
              ) : (
                <div style={{ display: 'flex', gap: 16 }}>
                  <img src={getImageFromAsset(selectedCert) || (selectedCert.image || '')} alt="" style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                  <div>
                    <div style={{ fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700 }}>{selectedCert.content?.metadata?.name || selectedCert.name}</div>
                    <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8a93b8' }}>ID: {shortAssetId(selectedCert.id || selectedCert.cert || '')}</div>
                    <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8a93b8' }}>Categoría: {selectedCert.content?.metadata?.attributes?.find((x:any)=>x.trait_type==='Categoría')?.value || '-'}</div>
                    <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#8a93b8' }}>Valor: ${selectedCert.content?.metadata?.attributes?.find((x:any)=> ['Valor Estimado (USD)', 'Valor estimado (USD)', 'Valor de Mercado (USD)', 'Valor'].includes(x.trait_type))?.value || '-'}</div>
                    <div style={{ marginTop: 12 }}><Badge color="#22c55e">EN CARTERA</Badge></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
