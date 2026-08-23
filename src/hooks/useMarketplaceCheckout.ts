import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { API_BASE_URL } from '../config'
import { useCertChainProgram } from './useCertChainProgram'
import { triggerDataRefresh } from '../utils/dataRefresh'

const RPC_URL = process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

async function fetchSolUsdRate(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    if (res.ok) {
      const data = await res.json()
      if (data?.solana?.usd) return Number(data.solana.usd)
    }
  } catch (e) {
    // fallback
  }
  return 150 // Fallback SOL/USD rate
}

export function useMarketplaceCheckout() {
  const { publicKey, sendTransaction } = useWallet()
  const { comprarDirectoCpi, program, getRegistroPda } = useCertChainProgram()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const processCheckout = async (items: any[], totalUSD: number) => {
    if (!publicKey || !sendTransaction) {
      setError('Conecta tu wallet para pagar')
      return false
    }

    if (!items.length) {
      setError('No hay artículos en el carrito')
      return false
    }

    setProcessing(true)
    setError(null)
    setSuccess(false)

    try {
      const connection = new Connection(RPC_URL, 'confirmed')
      const solUsdRate = await fetchSolUsdRate()

      for (const item of items) {
        // Obtener info del listing
        const listingRes = await fetch(`${API_BASE_URL}/api/marketplace/listings`)
        if (!listingRes.ok) throw new Error('No se pudo obtener listings')
        
        const listings = await listingRes.json()
        const listing = listings.find((l: any) => String(l.asset_id) === String(item.id))
        
        if (!listing || !listing.seller_wallet) {
          throw new Error(`Vendedor no encontrado para asset ${item.id}`)
        }

        // Calcular precio exacto en SOL en función del precio total en USD
        const priceUSD = totalUSD && totalUSD > 0 ? (totalUSD / items.length) : Number(item.price || listing.price_usd || 0)
        const solAmount = priceUSD / solUsdRate
        const lamports = Math.max(Math.ceil(solAmount * LAMPORTS_PER_SOL), 1000)
        const sellerPubkey = new PublicKey(listing.seller_wallet)

        let paymentSignature: string | null = null

        // If the Anchor program is available and registro_global exists, call comprarDirecto CPI.
        if (comprarDirectoCpi && program && getRegistroPda) {
          try {
            let adminPub = ''
            let registroExists = false
            try {
              const registroPda = getRegistroPda()
              const registroData: any = await program.account.registroGlobal.fetch(registroPda)
              adminPub = registroData?.admin?.toString() || ''
              registroExists = true
            } catch (e) {
              registroExists = false
            }

            if (!registroExists) {
              const recentBlockhash = (await connection.getLatestBlockhash()).blockhash
              const paymentTx = new Transaction({ recentBlockhash, feePayer: publicKey }).add(
                SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: sellerPubkey, lamports })
              )
              paymentSignature = await sendTransaction(paymentTx, connection)
              await connection.confirmTransaction(paymentSignature, 'confirmed')
              console.log('Pago simple SOL realizado:', paymentSignature)
            } else {
              paymentSignature = await comprarDirectoCpi({ assetIdStr: String(item.id), vendedorStr: listing.seller_wallet, adminStr: adminPub })
              console.log('Compra directa on-chain completada:', paymentSignature)
            }
          } catch (cpiErr: any) {
            console.warn('comprarDirectoCpi falló, ejecutando transferencia directa de SOL:', cpiErr?.message || cpiErr)
            const recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            const paymentTx = new Transaction({ recentBlockhash, feePayer: publicKey }).add(
              SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: sellerPubkey, lamports })
            )
            paymentSignature = await sendTransaction(paymentTx, connection)
            await connection.confirmTransaction(paymentSignature, 'confirmed')
          }
        } else {
          // No hay programa disponible: enviar transferencia directa de SOL
          const recentBlockhash = (await connection.getLatestBlockhash()).blockhash
          const paymentTx = new Transaction({ recentBlockhash, feePayer: publicKey }).add(
            SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: sellerPubkey, lamports })
          )
          try {
            paymentSignature = await sendTransaction(paymentTx, connection)
            await connection.confirmTransaction(paymentSignature, 'confirmed')
            console.log('Pago confirmado:', paymentSignature)
          } catch (paymentErr: any) {
            throw new Error(`Fallo al pagar: ${paymentErr?.message}`)
          }
        }

        // Registrar compra en backend y ejecutar transferencia de cNFT on-chain
        try {
          const buyRes = await fetch(`${API_BASE_URL}/api/marketplace/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              asset_id: item.id,
              buyer_wallet: publicKey.toString(),
              tx_hash: paymentSignature,
            }),
          })

          if (!buyRes.ok) {
            const buyError = await buyRes.json().catch(() => ({ error: 'Error registrando compra' }))
            throw new Error(buyError.error || 'Error registrando compra')
          }

          const result = await buyRes.json()
          console.log('Compra registrada y transferida:', result)
        } catch (bdErr: any) {
          throw new Error(`Fallo registro: ${bdErr?.message}`)
        }
      }

      triggerDataRefresh('all')
      setSuccess(true)
      return true
    } catch (err: any) {
      console.error('Checkout error:', err)
      setError(err?.message || 'Error al procesar el pago')
      return false
    } finally {
      setProcessing(false)
    }
  }

  return {
    processCheckout,
    processing,
    error,
    success,
    setError,
    setSuccess,
  }
}
