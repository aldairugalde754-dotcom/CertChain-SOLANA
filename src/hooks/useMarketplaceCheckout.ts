import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { API_BASE_URL } from '../config'
import { useCertChainProgram } from './useCertChainProgram'

const RPC_URL = process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const SOL_USD_RATE = 600

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

      for (const item of items) {
        // Obtener info del listing
        const listingRes = await fetch(`${API_BASE_URL}/api/marketplace/listings`)
        if (!listingRes.ok) throw new Error('No se pudo obtener listings')
        
        const listings = await listingRes.json()
        const listing = listings.find((l: any) => String(l.asset_id) === String(item.id))
        
        if (!listing || !listing.seller_wallet) {
          throw new Error(`Vendedor no encontrado para asset ${item.id}`)
        }

        // Calcular pago en SOL
        const priceUSD = Number(item.price || listing.price_usd || 0)
        const solAmount = priceUSD / SOL_USD_RATE
        const lamports = Math.ceil(solAmount * LAMPORTS_PER_SOL)
        const sellerPubkey = new PublicKey(listing.seller_wallet)

        let paymentSignature: string | null = null

        // If the Anchor program is available, call comprarDirecto to perform
        // the SOL transfers and the Bubblegum CPI transfer atomically.
        if (comprarDirectoCpi && program && getRegistroPda) {
          try {
            // Fetch registro_global to obtain admin pubkey required by the instruction
            let adminPub = ''
            let registroExists = false
            try {
              const registroPda = getRegistroPda()
              const registroData: any = await program.account.registroGlobal.fetch(registroPda)
              adminPub = registroData?.admin?.toString() || ''
              registroExists = true
            } catch (e) {
              // registro_global not found or unreadable on this network
              console.warn('registro_global no disponible, se usará fallback a transferencia simple:', e)
              registroExists = false
            }

            if (!registroExists) {
              // Fallback to simple transfer if the on-chain registro is not initialized
              const recentBlockhash = (await connection.getLatestBlockhash()).blockhash
              const paymentTx = new Transaction({ recentBlockhash, feePayer: publicKey }).add(
                SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: sellerPubkey, lamports })
              )
              paymentSignature = await sendTransaction(paymentTx, connection)
              await connection.confirmTransaction(paymentSignature, 'confirmed')
              console.log('Fallback pago simple realizado porque registro_global no existe:', paymentSignature)
            } else {
              paymentSignature = await comprarDirectoCpi({ assetIdStr: String(item.id), vendedorStr: listing.seller_wallet, adminStr: adminPub })
              console.log('Compra directa on-chain completada:', paymentSignature)
            }
          } catch (cpiErr: any) {
            // Fallback: intentar envío simple de transfer si CPI falla
            console.warn('comprarDirectoCpi falló, intentando transferencia simple:', cpiErr?.message || cpiErr)
            const recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            const paymentTx = new Transaction({ recentBlockhash, feePayer: publicKey }).add(
              SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: sellerPubkey, lamports })
            )
            paymentSignature = await sendTransaction(paymentTx, connection)
            await connection.confirmTransaction(paymentSignature, 'confirmed')
          }
        } else {
          // No hay programa disponible: enviar transferencia directa a vendedor
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

        // Registrar compra en backend
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
          console.log('Compra registrada:', result)
        } catch (bdErr: any) {
          throw new Error(`Fallo registro: ${bdErr?.message}`)
        }
      }

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
