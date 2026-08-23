import React, { useEffect, useState, type ReactNode } from 'react'
import {
  Store, Gavel, Search, Wallet, ArrowRightLeft,
  FileCheck, LogOut,
  TrendingUp, ShieldCheck, Boxes
} from 'lucide-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Bell } from 'lucide-react'; 

export type ClientView = 'marketplace' | 'auctions' | 'history' | 'wallet' | 'transfer'
export type CompanyView = 'certify' | 'auction-dash' | 'market-dash' | 'inventory' | 'transfer-cert'
export type AppView = 'landing' | 'client' | 'company'


interface SidebarProps {
  role: 'client' | 'company'
  activeView: ClientView | CompanyView
  onNavigate: (v: ClientView | CompanyView) => void
  onLogout: () => void
}

const clientNavItems: { id: ClientView; label: string; icon: ReactNode }[] = [
  { id: 'marketplace', label: 'Marketplace', icon: <Store size={16} /> },
  { id: 'auctions', label: 'Subastas', icon: <Gavel size={16} /> },
  { id: 'history', label: 'Historial', icon: <Search size={16} /> },
  { id: 'wallet', label: 'Mi Wallet', icon: <Wallet size={16} /> },
  { id: 'transfer', label: 'Transferir', icon: <ArrowRightLeft size={16} /> },
]

const companyNavItems: { id: CompanyView; label: string; icon: ReactNode }[] = [
  { id: 'certify', label: 'Certificar Producto', icon: <FileCheck size={16} /> },
  { id: 'auction-dash', label: 'Mis Subastas', icon: <Gavel size={16} /> },
  { id: 'market-dash', label: 'Marketplace', icon: <Store size={16} /> },
  { id: 'inventory', label: 'Inventario', icon: <Boxes size={16} /> },
  { id: 'transfer-cert', label: 'Transferir Cert.', icon: <ArrowRightLeft size={16} /> },
]

export function Sidebar({ role, activeView, onNavigate, onLogout }: SidebarProps) {
  const items = role === 'client' ? clientNavItems : companyNavItems
  const roleLabel = role === 'client' ? 'Cliente' : 'Empresa'
  const roleColor = role === 'client' ? '#00c8ff' : '#7c3aed'

  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: '#080a12',
      borderRight: '1px solid rgba(0,200,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 18px 20px', borderBottom: '1px solid rgba(0,200,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <img
            src="/images/logo.png"
            alt="CertChain logo"
            style={{
              width: 52,
              height: 52,
              objectFit: 'contain',
              display: 'block',
              filter: 'drop-shadow(0 0 12px rgba(0,200,255,0.2))',
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.05 }}>
            <span style={{
              fontFamily: 'Rajdhani',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.03em',
              color: '#eef5ff',
            }}>
              CertChain
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: 9,
              letterSpacing: '0.16em',
              color: '#8aa1c6',
              textTransform: 'uppercase',
              marginTop: 3,
            }}>
              SOLANA Diamonds
            </span>
          </div>
        </div>
        {/* Role badge */}
        <div style={{
          background: `${roleColor}15`,
          border: `1px solid ${roleColor}30`,
          borderRadius: 6,
          padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor }} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: roleColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{roleLabel}</span>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(item => (
          <button
            key={item.id}
            className={`nav-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id as ClientView & CompanyView)}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            {React.isValidElement(item.icon) ? item.icon : <span style={{ display: 'inline-block', width: 16, height: 16 }} />}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(0,200,255,0.08)' }}>
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 8,
            background: 'none', border: 'none',
            cursor: 'pointer', width: '100%',
            fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            color: '#5a6485',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5a6485' }}
        >
          {typeof LogOut === 'function' ? <LogOut size={16} /> : <span style={{ display: 'inline-block', width: 16, height: 16 }} />}
          Salir
        </button>
      </div>
    </aside>
  )
}

interface TopBarProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  user?: any;
}

const DEFAULT_NOTIFICATIONS = [
  { title: 'Transferencia confirmada', description: 'Tu certificado se movió a una nueva wallet.', time: 'Hace 3 min' },
  { title: 'Nuevo certificado emitido', description: 'Se validó un nuevo asset en blockchain.', time: 'Hace 28 min' },
  { title: 'Marketplace', description: 'Hay dos productos con interés reciente.', time: 'Hace 1 hora' },
]

export function TopBar({ title, subtitle, actions, user: userProp }: TopBarProps) {
  const [user, setUser] = useState<any>(userProp || null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    if (userProp) {
      setUser(userProp)
      return
    }

    try {
      const stored = localStorage.getItem('certchain_user')
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch {
      setUser(null)
    }
  }, [userProp])

  const displayName = user?.name || user?.company_name || user?.email || 'Usuario'
  const shortName = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'U'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 32px',
      borderBottom: '1px solid rgba(0,200,255,0.08)',
      background: 'rgba(7,9,15,0.8)',
      backdropFilter: 'blur(8px)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <style>{`
        .custom-solana-wallet-btn .wallet-adapter-button {
          background: rgba(0, 200, 255, 0.05) !important;
          border: 1px solid rgba(0, 200, 255, 0.2) !important;
          color: #00c8ff !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          letter-spacing: 0.06em !important;
          height: 34px !important;
          padding: 0 16px !important;
          border-radius: 8px !important;
          transition: all 0.25s ease-in-out !important;
        }
        .custom-solana-wallet-btn .wallet-adapter-button:hover {
          background: rgba(0, 200, 255, 0.15) !important;
          border-color: #00c8ff !important;
          box-shadow: 0 0 12px rgba(0, 200, 255, 0.2) !important;
        }
        .custom-solana-wallet-btn .wallet-adapter-button-trigger {
          background-color: transparent;
        }
      `}</style>

      <div>
        <h1 style={{ fontFamily: 'Rajdhani', fontSize: 22, fontWeight: 700, letterSpacing: '0.04em', margin: 0, lineHeight: 1.1 }}>{title}</h1>
        {subtitle && <p style={{ margin: 0, color: '#5a6485', fontSize: 12, fontFamily: 'JetBrains Mono', letterSpacing: '0.06em', marginTop: 2 }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        {actions}

        <div className="custom-solana-wallet-btn">
          <WalletMultiButton />
        </div>

        <div aria-label="Abrir notificaciones" onClick={() => { setNotificationsOpen(v => !v); setProfileOpen(false) }} style={{
          width: 34, height: 34, borderRadius: 8,
          background: notificationsOpen ? 'rgba(0,200,255,0.12)' : 'rgba(0,200,255,0.06)',
          border: '1px solid rgba(0,200,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative',
        }}>
          {typeof Bell === 'function' ? <Bell size={14} color="#8a93b8" /> : <span style={{ display: 'inline-block', width: 14, height: 14 }} />}
          <span style={{ position: 'absolute', top: -4, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid #07111b' }} />
        </div>

        {notificationsOpen && (
          <div style={{ position: 'absolute', top: 52, right: 54, width: 300, background: '#0b1120', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 12, boxShadow: '0 18px 35px rgba(0,0,0,0.35)', padding: 12, zIndex: 40 }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, marginBottom: 10, color: '#edf6ff' }}>Notificaciones</div>
            {DEFAULT_NOTIFICATIONS.map((notification, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 8px', borderBottom: index < DEFAULT_NOTIFICATIONS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, color: '#dfeaff' }}>{notification.title}</div>
                <div style={{ color: '#8a93b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}>{notification.description}</div>
                <div style={{ color: '#5a6485', fontSize: 10, fontFamily: 'JetBrains Mono' }}>{notification.time}</div>
              </div>
            ))}
          </div>
        )}

        <div aria-label="Abrir perfil" onClick={() => { setProfileOpen(v => !v); setNotificationsOpen(false) }} style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00c8ff, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#fff',
          cursor: 'pointer', position: 'relative', userSelect: 'none',
        }}>
          {shortName}
        </div>

        {profileOpen && (
          <div style={{ position: 'absolute', top: 52, right: 0, width: 260, background: '#0b1120', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 12, boxShadow: '0 18px 35px rgba(0,0,0,0.35)', padding: 16, zIndex: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #00c8ff, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Rajdhani', fontWeight: 700, color: '#fff' }}>
                {shortName}
              </div>
              <div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: '#edf6ff' }}>Mi perfil</div>
                <div style={{ color: '#8a93b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}>{user?.role || 'client'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ color: '#5a6485', fontFamily: 'JetBrains Mono', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nombre</div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 15, fontWeight: 700, color: '#edf6ff' }}>{displayName}</div>
              </div>
              <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ color: '#5a6485', fontFamily: 'JetBrains Mono', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Email</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#dfeaff' }}>{user?.email || 'usuario@certchain.app'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


export function StatCard({ label, value, icon, color = '#00c8ff', delta }: {
  label: string; value: string; icon: ReactNode; color?: string; delta?: string
}) {
  return (
    <div className="stat-card card-hover glow-border" style={{ cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${color}15`,
          border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {React.isValidElement(icon) ? icon : <span style={{ display: 'inline-block', width: 16, height: 16 }} />}
        </div>
        {delta && <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#22c55e' }}>{delta}</span>}
      </div>
      <div style={{ fontFamily: 'Rajdhani', fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5a6485', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', margin: 0, lineHeight: 1.1 }}>{children}</h2>
      {sub && <p style={{ margin: '4px 0 0', color: '#5a6485', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{sub}</p>}
    </div>
  )
}

export function Badge({ children, color = '#00c8ff' }: { children: ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.08em',
      textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4,
      background: `${color}18`, border: `1px solid ${color}35`, color,
    }}>{children}</span>
  )
}

export function HashDisplay({ hash }: { hash: any }) {
  if (!hash) return null
  const str = String(hash)
  return (
    <span style={{
      fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6485',
      background: 'rgba(0,200,255,0.04)', padding: '1px 6px', borderRadius: 4,
    }}>
      {str.length > 10 ? `${str.slice(0, 6)}...${str.slice(-4)}` : str}
    </span>
  )
}

export const PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=400&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=300&fit=crop&auto=format',
]

export const MOCK_PRODUCTS = [
  { id: 'PRD-001', name: 'Reloj Automático Heritage', category: 'Relojería', price: '2,450', company: 'LuxeTime SA', cert: '0x4a2f...8e91', image: PRODUCT_IMAGES[0] },
  { id: 'PRD-002', name: 'Perfume Noir Intense', category: 'Cosmética', price: '320', company: 'AromaCo', cert: '0x91bc...3f2a', image: PRODUCT_IMAGES[1] },
  { id: 'PRD-003', name: 'Cámara Analógica Vintage', category: 'Electrónica', price: '890', company: 'RetroLens', cert: '0x2d8c...7b14', image: PRODUCT_IMAGES[2] },
  { id: 'PRD-004', name: 'Zapatilla Edición Limitada', category: 'Moda', price: '1,200', company: 'SoleArt', cert: '0x5e3a...9c77', image: PRODUCT_IMAGES[3] },
  { id: 'PRD-005', name: 'Crema Antienvejecimiento', category: 'Cosmética', price: '185', company: 'BioSkin', cert: '0x7f1d...4e22', image: PRODUCT_IMAGES[4] },
  { id: 'PRD-006', name: 'Auriculares Pro Studio', category: 'Electrónica', price: '650', company: 'SoundLab', cert: '0x3b9e...6d88', image: PRODUCT_IMAGES[5] },
]

export const MOCK_AUCTIONS = [
  { id: 'AUC-001', name: 'Colección de Arte Digital', currentBid: '5,800', minBid: '6,000', bids: 23, endTime: { h: '02', m: '34', s: '17' }, image: PRODUCT_IMAGES[6], status: 'live' },
  { id: 'AUC-002', name: 'Reloj Patek Philippe 1972', currentBid: '42,000', minBid: '43,000', bids: 8, endTime: { h: '12', m: '05', s: '44' }, image: PRODUCT_IMAGES[0], status: 'live' },
  { id: 'AUC-003', name: 'Lente Canon EF 50mm L', currentBid: '1,200', minBid: '1,300', bids: 15, endTime: { h: '00', m: '18', s: '02' }, image: PRODUCT_IMAGES[2], status: 'ending' },
  { id: 'AUC-004', name: 'Sneaker Nike Air Jordan OG', currentBid: '8,400', minBid: '8,500', bids: 41, endTime: { h: '05', m: '51', s: '29' }, image: PRODUCT_IMAGES[3], status: 'live' },
]
