import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ClientMarketplace, ClientAuctions, ClientTransfer } from './views/ClientViews'
import { CompanyCertify } from './views/CompanyViews'
import InventoryView from './views/InventoryView'
import { TopBar } from './components/Shared'

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: { toString: () => 'wallet-test-123', toBase58: () => 'wallet-test-123' },
  }),
  useConnection: () => ({ connection: { getSlot: async () => 123 } }),
}))

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: () => <button type="button">Wallet</button>,
}))

vi.mock('./hooks/useUmi', () => ({
  useUmi: () => ({ identity: { publicKey: 'identity-key' } }),
}))

vi.mock('./hooks/useMintCertificado', () => ({
  useMintCertificado: () => ({
    emitirCertificado: vi.fn(),
    loading: false,
    error: null,
  }),
}))

const mockFetch = vi.fn()

global.fetch = mockFetch as any

describe('ClientMarketplace cart flow', () => {
  beforeEach(() => {
    cleanup()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          asset_id: 'asset-1',
          title: 'Reloj',
          price_usd: 120,
          category: 'Relojería',
          seller_wallet: 'seller-1',
          company: 'Audemars',
          cert_hash: 'abc123',
          image: 'https://example.com/image.png',
        }
      ]
    })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('adds a product to the cart and opens the cart panel with totals', async () => {
    render(<ClientMarketplace user={{}} />)

    const addButton = await screen.findByRole('button', { name: /agregar/i })
    fireEvent.click(addButton)

    fireEvent.click(screen.getByLabelText(/abrir carrito/i))

    const dialog = screen.getByRole('dialog', { name: /carrito de compras/i })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /checkout/i })).toBeInTheDocument()
  })

  it('shows an empty state when there are no active auctions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    })

    render(<ClientAuctions user={{}} />)

    expect(await screen.findByText(/no hay subastas activas/i)).toBeInTheDocument()
    expect(screen.queryByText(/colección de arte digital/i)).not.toBeInTheDocument()
  })

  it('shows an empty wallet state in transfer view when the user has no cNFTs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { assets: [] } })
    })

    render(<ClientTransfer user={{}} />)

    expect(await screen.findByText(/no tienes certificados cNFT/i)).toBeInTheDocument()
  })

  it('shows the auction price and status for assets without metadata price', async () => {
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            assets: [{
              id: 'asset-auction-1',
              compression: { compressed: true },
              burnt: false,
              content: {
                metadata: {
                  name: 'Anillo de Plata',
                  symbol: 'CERT',
                  attributes: [{ trait_type: 'Categoría', value: 'Joyería' }],
                },
              },
            }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          asset_id: 'asset-auction-1',
          starting_price: 150,
          current_bid: 180,
          status: 'live',
          title: 'Anillo de Plata',
        }],
      })

    render(<InventoryView />)

    expect(await screen.findByText(/Anillo de Plata/i)).toBeInTheDocument()
    expect(screen.getByText('$180')).toBeInTheDocument()
    expect(screen.getByText(/EN SUBASTA/i)).toBeInTheDocument()
  })

  it('opens user profile and notifications panels from the top bar', async () => {
    localStorage.setItem('certchain_user', JSON.stringify({
      email: 'cliente@certchain.com',
      name: 'Cliente Demo',
      role: 'client'
    }))

    render(<TopBar title="Mi Wallet" subtitle="Certificados cNFT" />)

    fireEvent.click(screen.getByLabelText(/abrir notificaciones/i))
    expect(screen.getByText(/notificaciones/i)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/abrir perfil/i))
    expect(screen.getByText(/mi perfil/i)).toBeInTheDocument()
    expect(screen.getByText(/cliente demo/i)).toBeInTheDocument()
  })

  it('blocks company minting when the connected wallet does not match the registered wallet', async () => {
    localStorage.setItem('certchain_token', 'demo-token')
    localStorage.setItem('certchain_user', JSON.stringify({
      role: 'company',
      company_name: 'ACME Gold',
      wallet_address: 'registered-wallet-abc',
    }))

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'La wallet conectada no coincide con la wallet registrada para esta cuenta.' }),
    })

    render(
      <CompanyCertify
        user={{
          role: 'company',
          company_name: 'ACME Gold',
          wallet_address: 'registered-wallet-abc',
        }}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/anillo de plata matrimonio/i), { target: { value: 'Reloj Test' } })
    fireEvent.change(document.querySelectorAll('select')[0], { target: { value: 'Joyería' } })
    fireEvent.change(screen.getByPlaceholderText(/plt-rj400/i), { target: { value: 'SER-001' } })
    fireEvent.change(screen.getByPlaceholderText(/descripción detallada, pureza del metal, incrustaciones/i), { target: { value: 'Descripción de prueba' } })
    fireEvent.change(screen.getByPlaceholderText(/ej\. hx2bvp9j5zxntrkx/i), { target: { value: 'owner-wallet-xyz' } })

    fireEvent.click(screen.getByRole('button', { name: /emitir certificado blockchain/i }))

    expect(await screen.findByText(/cambia la wallet conectada/i)).toBeInTheDocument()
  })
})
