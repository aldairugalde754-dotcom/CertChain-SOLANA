import React, { useState } from 'react';
import { API_BASE_URL } from '../config';
import { 
  Building2, 
  User, 
  Wallet, 
  ArrowRight, 
  Lock, 
  Mail, 
  CheckCircle2, 
  Boxes,
  Zap,
  Sparkles,
  X,
  Fingerprint,
  Link2,
  Store,
  Gavel,
  Layers,
  Palette,
  Rocket,
  Gem,
  HelpCircle,
  ExternalLink,
  Check,
  Download,
  KeyRound,
  Copy
} from 'lucide-react';
import { connectPhantomWallet, connectSolflareWallet, connectAnySolanaWallet } from '../utils/solanaWallet';
import { Camera } from 'lucide-react';


type Role = 'client' | 'company';
type AuthMode = 'login' | 'register';

interface LandingProps {
  onEnter: (role: 'client' | 'company', userData?: any) => void;
}

export default function Landing({ onEnter }: LandingProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterPickerOpen, setIsRegisterPickerOpen] = useState(false);

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWalletHelp, setShowWalletHelp] = useState(false);
  const [formError, setFormError] = useState('');

  const handleOpenAuth = (role: Role, mode: AuthMode = 'register') => {
    setSelectedRole(role);
    setAuthMode(mode);
    setIsModalOpen(true);
    setFormError('');
  };

  const handleConnectPhantom = async () => {
    const address = await connectPhantomWallet();
    if (address) {
      setWalletAddress(address);
    }
  };

  const handleConnectSolflare = async () => {
    const address = await connectSolflareWallet();
    if (address) {
      setWalletAddress(address);
    }
  };

  const handleConnectAnyWallet = async () => {
    const res = await connectAnySolanaWallet();
    if (res?.address) {
      setWalletAddress(res.address);
    }
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedRole) return;

  setLoading(true);
  setFormError('');

  // Recuperar wallet desde el DOM o estado
  const walletInput = document.getElementById('solana-wallet-input') as HTMLInputElement | null;
  const finalWalletAddress = walletInput && walletInput.value.trim() !== '' 
    ? walletInput.value.trim() 
    : walletAddress.trim();

  const dbRole = selectedRole === 'client' ? 'buyer' : 'company';
  
  // VERIFICACIÓN CLAVE: Endpoint dinámico según authMode
  const isRegister = authMode === 'register';
  const endpoint = isRegister 
    ? `${API_BASE_URL}/api/auth/register` 
    : `${API_BASE_URL}/api/auth/login`;

  const payload = isRegister ? {
    email,
    password,
    role: dbRole,
    company_name: selectedRole === 'company' ? companyName : null,
    wallet_address: finalWalletAddress || null,
    walletAddress: finalWalletAddress || null
  } : {
    email,
    password
  };

  console.log("Enviando Payload a:", endpoint, payload); // Para depuración en consola F12

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('certchain_token', data.token);
      localStorage.setItem('certchain_user', JSON.stringify(data.user));

      const activeRole = data.user.role === 'company' ? 'company' : 'client';
      setIsModalOpen(false);
      onEnter(activeRole, data.user);
    } else {
      setFormError(data.error || 'Error en la petición. Revisa tus datos e intenta de nuevo.');
    }
  } catch (error) {
    console.error(error);
    setFormError(`No pudimos conectar con el servidor (${API_BASE_URL}). Verifica tu conexión e intenta de nuevo.`);
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 0%, #150a2e 0%, #05010d 60%, #020006 100%)',
      color: '#e4e2f0',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <style>{`
        @keyframes pulse-dot { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(20,241,149,0.6); } 50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(20,241,149,0); } }
        @keyframes drift { 0% { transform: translate(0,0); } 50% { transform: translate(20px,-15px); } 100% { transform: translate(0,0); } }
        @keyframes glow-breathe { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.06); } }
      `}</style>

      {/* Malla de nodos + orbes de gradiente Solana */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(153,69,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.07) 1px, transparent 1px)',
        backgroundSize: '42px 42px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)'
      }} />
      <div style={{
        position: 'absolute', top: '-8%', left: '8%', width: '520px', height: '520px',
        background: 'radial-gradient(circle, rgba(153,69,255,0.30) 0%, transparent 70%)',
        filter: 'blur(70px)', pointerEvents: 'none', animation: 'drift 14s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute', top: '2%', right: '6%', width: '480px', height: '480px',
        background: 'radial-gradient(circle, rgba(20,241,149,0.22) 0%, transparent 70%)',
        filter: 'blur(70px)', pointerEvents: 'none', animation: 'drift 18s ease-in-out infinite reverse'
      }} />

      {/* NAVBAR */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '22px 48px',
        maxWidth: '1280px',
        margin: '0 auto',
        borderBottom: '1px solid rgba(153, 69, 255, 0.12)',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '8px 16px',
            borderRadius: '14px',
            background: 'rgba(153, 69, 255, 0.08)',
            border: '1px solid rgba(153, 69, 255, 0.18)',
          }}>
            <img
              src="/images/logo.png"
              alt="CertChain logo"
              style={{
                width: '38px',
                height: '38px',
                objectFit: 'contain',
                display: 'block',
                filter: 'drop-shadow(0 0 8px rgba(153, 69, 255, 0.15))',
              }}
            />
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '1px',
            }}>
              <span style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '0.02em',
                color: '#f4f0ff',
              }}>
                CertChain
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.14em',
                color: '#a88dd7',
                textTransform: 'uppercase'
              }}>
                Solana Diamonds
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: 'rgba(20, 241, 149, 0.06)',
            border: '1px solid rgba(20, 241, 149, 0.22)',
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#14F195', animation: 'pulse-dot 2s infinite'
            }} />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: '#8ff5c6',
              textTransform: 'uppercase'
            }}>
              Solana Devnet · Red Activa
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
          <button 
            onClick={() => handleOpenAuth('client', 'login')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(153, 69, 255, 0.4)',
              color: '#f4f0ff',
              padding: '10px 20px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.03em',
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(153, 69, 255, 0.1)'; e.currentTarget.style.borderColor = '#9945FF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(153, 69, 255, 0.4)'; }}
          >
            <Wallet size={14} /> Iniciar Sesión
          </button>

          <button
            onClick={() => setIsRegisterPickerOpen(v => !v)}
            style={{
              background: 'linear-gradient(135deg, #9945FF 0%, #14F195 130%)',
              border: 'none',
              color: '#05010d',
              padding: '11px 22px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '0.03em',
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 6px 22px rgba(153, 69, 255, 0.35)',
              transition: 'transform 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Crear Cuenta <ArrowRight size={14} />
          </button>

        </div>
      </header>

     {/* SELECTOR FLOTANTE DE REGISTRO */}
{isRegisterPickerOpen && (
  <div
    onClick={() => setIsRegisterPickerOpen(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 5, 20, 0.78)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 900,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: '760px',
        background:
          'linear-gradient(145deg, #110c27 0%, #0d0920 100%)',
        border: '1px solid rgba(153, 69, 255, 0.35)',
        borderRadius: '24px',
        padding: '34px',
        boxShadow:
          '0 30px 100px rgba(0, 0, 0, 0.7), 0 0 60px rgba(110, 60, 220, 0.08)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >

      {/* BRILLO DECORATIVO SUPERIOR */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '420px',
          height: '200px',
          background:
            'radial-gradient(circle, rgba(153,69,255,0.14), transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      {/* HEADER */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          marginBottom: '30px'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '10px',
            color: '#8f88a8',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: '10px'
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#14F195',
              boxShadow: '0 0 10px rgba(20,241,149,0.7)'
            }}
          />
          CertChain
        </div>

        <div
          style={{
            fontSize: '25px',
            fontWeight: 800,
            color: '#f7f4ff',
            letterSpacing: '-0.02em',
            marginBottom: '8px'
          }}
        >
          Crea tu cuenta
        </div>

        <div
          style={{
            fontSize: '13px',
            color: '#85809d',
            lineHeight: '1.5'
          }}
        >
          Selecciona el tipo de cuenta que deseas utilizar
        </div>
      </div>

      {/* TARJETAS */}
      <div
        className="register-picker-options"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '18px',
          position: 'relative'
        }}
      >

        {/* ================= COMPRADOR ================= */}
        <button
          onClick={() => {
            setIsRegisterPickerOpen(false);
            handleOpenAuth('client', 'register');
          }}
          style={{
            position: 'relative',
            minHeight: '235px',
            borderRadius: '18px',
            padding: '26px 24px',
            border: '1px solid rgba(20, 241, 149, 0.28)',
            background:
              'linear-gradient(145deg, rgba(20,241,149,0.09), rgba(20,241,149,0.025))',
            color: '#f4f0ff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            transition: 'all 0.25s ease',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.borderColor =
              'rgba(20, 241, 149, 0.65)';
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(20,241,149,0.14), rgba(20,241,149,0.045))';
            e.currentTarget.style.boxShadow =
              '0 15px 40px rgba(20,241,149,0.10)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor =
              'rgba(20, 241, 149, 0.28)';
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(20,241,149,0.09), rgba(20,241,149,0.025))';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >

          {/* BADGE */}
          <div
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              fontSize: '8px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#14F195',
              background: 'rgba(20,241,149,0.10)',
              border: '1px solid rgba(20,241,149,0.22)',
              borderRadius: '20px',
              padding: '5px 8px'
            }}
          >
            Popular
          </div>

          {/* ICONO */}
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'linear-gradient(145deg, rgba(20,241,149,0.16), rgba(20,241,149,0.06))',
              border: '1px solid rgba(20,241,149,0.30)',
              boxShadow:
                '0 8px 25px rgba(20,241,149,0.08)',
              marginBottom: '18px'
            }}
          >
            <User
              size={30}
              strokeWidth={1.8}
              color="#14F195"
            />
          </div>

          {/* TITULO */}
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#f7f4ff',
              marginBottom: '8px'
            }}
          >
            Comprador / Coleccionista
          </div>

          {/* DESCRIPCIÓN */}
          <div
            style={{
              maxWidth: '240px',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#918ba8'
            }}
          >
            Explora, descubre y colecciona
            <br />
            piezas certificadas.
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: '18px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#14F195',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            Crear cuenta
            <span style={{ fontSize: '14px' }}>→</span>
          </div>
        </button>


        {/* ================= EMPRESA ================= */}
        <button
          onClick={() => {
            setIsRegisterPickerOpen(false);
            handleOpenAuth('company', 'register');
          }}
          style={{
            position: 'relative',
            minHeight: '235px',
            borderRadius: '18px',
            padding: '26px 24px',
            border: '1px solid rgba(153, 69, 255, 0.32)',
            background:
              'linear-gradient(145deg, rgba(153,69,255,0.11), rgba(153,69,255,0.025))',
            color: '#f4f0ff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            transition: 'all 0.25s ease',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.borderColor =
              'rgba(153,69,255,0.68)';
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(153,69,255,0.16), rgba(153,69,255,0.045))';
            e.currentTarget.style.boxShadow =
              '0 15px 40px rgba(153,69,255,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor =
              'rgba(153,69,255,0.32)';
            e.currentTarget.style.background =
              'linear-gradient(145deg, rgba(153,69,255,0.11), rgba(153,69,255,0.025))';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >

          {/* ICONO */}
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'linear-gradient(145deg, rgba(153,69,255,0.18), rgba(153,69,255,0.06))',
              border: '1px solid rgba(153,69,255,0.32)',
              boxShadow:
                '0 8px 25px rgba(153,69,255,0.08)',
              marginBottom: '18px'
            }}
          >
            <Building2
              size={30}
              strokeWidth={1.8}
              color="#c9a3ff"
            />
          </div>

          {/* TITULO */}
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#f7f4ff',
              marginBottom: '8px'
            }}
          >
            Empresa / Emisor
          </div>

          {/* DESCRIPCIÓN */}
          <div
            style={{
              maxWidth: '240px',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#918ba8'
            }}
          >
            Certifica y emite tus
            <br />
            productos.
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: '18px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#c9a3ff',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            Crear cuenta
            <span style={{ fontSize: '14px' }}>→</span>
          </div>
        </button>

      </div>

      {/* FOOTER */}
      <div
        style={{
          marginTop: '25px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <button
          onClick={() => setIsRegisterPickerOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#716c86',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '6px 14px',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#aaa4bf';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#716c86';
          }}
        >
          Cancelar
        </button>
      </div>

    </div>
  </div>
)}

      {/* HERO SECTION */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 24px 60px', textAlign: 'center' }}>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          background: 'rgba(153, 69, 255, 0.08)',
          border: '1px solid rgba(153, 69, 255, 0.3)',
          padding: '7px 18px',
          borderRadius: '18px',
          color: '#c9b8ff',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '28px',
        }}>
          <Sparkles size={14} color="#14F195" /> Certificación On-Chain de Productos de Lujo
        </div>

        {/* HERO EN DOS COLUMNAS: TEXTO + IMAGEN */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1.1fr) minmax(260px, 1fr)',
          gap: '40px',
          alignItems: 'center',
          textAlign: 'left',
          maxWidth: '1080px',
          margin: '0 auto 40px auto',
        }}>
          <div>
            <h1 style={{
              fontSize: '46px',
              fontWeight: 800,
              lineHeight: '1.1',
              fontFamily: 'Rajdhani, sans-serif',
              letterSpacing: '-0.05em',
              margin: '0 0 18px 0',
              background: 'linear-gradient(90deg, #ffffff 15%, #b98bff 55%, #14F195 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 12px 40px rgba(153, 69, 255, 0.25)',
            }}>
              Autenticidad Inmutable y Subastas Descentralizadas
            </h1>

            <p style={{
              color: '#a5a0c4',
              fontSize: '17px',
              margin: '0 0 28px 0',
              lineHeight: '1.6',
            }}>
              Convierte tu joya, obra de arte o pieza de colección en un certificado imposible de falsificar. Un hash único, una firma en Solana, una historia de propiedad que nadie puede reescribir.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '30px' }}>
              <button
                onClick={() => setIsRegisterPickerOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #9945FF 0%, #14F195 130%)',
                  border: 'none', color: '#05010d', padding: '18px 32px', borderRadius: '14px',
                  cursor: 'pointer', fontWeight: 800, fontSize: '16px', fontFamily: "'Rajdhani', sans-serif",
                  display: 'flex', alignItems: 'center', gap: '10px',
                  boxShadow: '0 14px 40px rgba(153, 69, 255, 0.45)',
                  transition: 'all 0.25s',
                  letterSpacing: '0.05em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 18px 50px rgba(153, 69, 255, 0.55)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 14px 40px rgba(153, 69, 255, 0.45)';
                }}
              >
                Certificar mi Pieza <ArrowRight size={18} />
              </button>
              <button
                onClick={() => handleOpenAuth('client', 'register')}
                style={{
                  background: 'rgba(153, 69, 255, 0.12)', border: '2px solid rgba(153, 69, 255, 0.35)', color: '#e4e2f0',
                  padding: '18px 32px', borderRadius: '14px', cursor: 'pointer', fontWeight: 800, fontSize: '16px',
                  fontFamily: "'Rajdhani', sans-serif",
                  transition: 'all 0.25s',
                  letterSpacing: '0.05em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(153, 69, 255, 0.22)';
                  e.currentTarget.style.borderColor = '#9945FF';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(153, 69, 255, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(153, 69, 255, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(153, 69, 255, 0.35)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Explorar Marketplace
              </button>
            </div>

            {/* TRUST BAR COMPACTA */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {[
                { icon: <Link2 size={12} />, label: 'Solana Devnet' },
                { icon: <Layers size={12} />, label: 'SPL Tokens' },
                { icon: <Fingerprint size={12} />, label: 'Anchor Framework' },
              ].map((tag, i) => (
                <div key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '999px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(153, 69, 255, 0.2)',
                  color: '#9891b8', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.05em', textTransform: 'uppercase'
                }}>
                  <span style={{ color: '#14F195' }}>{tag.icon}</span>
                  {tag.label}
                </div>
              ))}
            </div>
          </div>

          {/* MARCO DE IMAGEN: PIEZA CERTIFICADA */}
          <div style={{
            position: 'relative',
            borderRadius: '22px',
            padding: '2px',
            background: 'linear-gradient(160deg, rgba(153,69,255,0.6), rgba(20,241,149,0.4))',
          }}>
            <div style={{
              borderRadius: '20px',
              overflow: 'hidden',
              aspectRatio: '4 / 5',
              backgroundImage: 'url(/images/ImagenDiamante.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#0d0620',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, transparent 40%, rgba(5,1,13,0.92) 100%)'
              }} />
              <div style={{
                position: 'absolute', bottom: '18px', left: '18px', right: '18px',
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(5,1,13,0.6)', border: '1px solid rgba(20,241,149,0.3)',
                borderRadius: '12px', padding: '10px 14px', backdropFilter: 'blur(6px)'
              }}>
                <CheckCircle2 size={16} color="#14F195" />
                <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#c8f5da', letterSpacing: '0.04em' }}>
                  Certificado verificado on-chain
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CÓMO FUNCIONA LA CERTIFICACIÓN */}
        <div style={{ marginBottom: '72px', marginTop: '80px' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#c9a3ff', marginBottom: '10px', fontWeight: 700
          }}>
            De la pieza física al activo digital
          </div>
          <h2 style={{
            fontSize: '32px', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif',
            color: '#f4f2ff', marginBottom: '40px', letterSpacing: '-0.02em'
          }}>
            Certifica, coleccioná y subasta — todo on-chain
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
            marginBottom: '28px',
          }}>
            {[
              {
                icon: <Fingerprint size={26} color="#14F195" />,
                title: 'Certificado Inmutable',
                text: 'Cada pieza recibe una huella digital única grabada en Solana. Imposible de duplicar o alterar.'
              },
              {
                icon: <Layers size={26} color="#c9a3ff" />,
                title: 'Coleccionables NFT',
                text: 'Tu certificado se acuña como token en tu wallet: propiedad verificable, transferible y coleccionable.'
              },
              {
                icon: <Store size={26} color="#14F195" />,
                title: 'Marketplace P2P',
                text: 'Publica, descubre y transfiere piezas certificadas directamente entre wallets, sin intermediarios.'
              },
              {
                icon: <Gavel size={26} color="#c9a3ff" />,
                title: 'Subastas en Vivo',
                text: 'Lleva tus piezas más exclusivas a subasta descentralizada y deja que el mercado defina su valor real.'
              },
            ].map((f, i) => (
              <div key={i} style={{
                background: 'linear-gradient(180deg, rgba(153,69,255,0.06), rgba(20,241,149,0.03))',
                border: '1px solid rgba(153, 69, 255, 0.18)',
                borderRadius: '16px',
                padding: '28px 22px',
                textAlign: 'left',
              }}>
                <div style={{ marginBottom: '16px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', fontFamily: 'Rajdhani' }}>
                  {f.title}
                </h3>
                <p style={{ color: '#8b88a3', fontSize: '13.5px', lineHeight: '1.55' }}>
                  {f.text}
                </p>
              </div>
            ))}
          </div>

          {/* MARCO DE IMAGEN: BANNER MARKETPLACE / SUBASTAS */}
          <div style={{
            position: 'relative',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid rgba(153, 69, 255, 0.25)',
            aspectRatio: '21 / 8',
            backgroundImage: 'url(/images/banner.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#0d0620',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, rgba(5,1,13,0.88) 0%, rgba(5,1,13,0.35) 55%, transparent 100%)',
              display: 'flex', alignItems: 'center', padding: '0 36px'
            }}>
              <div style={{ maxWidth: '380px', textAlign: 'left' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#14F195', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>
                  En vivo ahora
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>
                  Subastas y marketplace P2P para coleccionables certificados
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PARA QUIÉN ES CERTCHAIN */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#14F195', marginBottom: '10px', fontWeight: 700
          }}>
            Hecho para quienes crean valor real
          </div>
          <h2 style={{
            fontSize: '32px', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif',
            color: '#f4f2ff', marginBottom: '12px', letterSpacing: '-0.02em'
          }}>
            Tu autenticidad, respaldada por blockchain
          </h2>
          <p style={{ color: '#8b88a3', fontSize: '15px', maxWidth: '620px', margin: '0 auto 40px auto', lineHeight: '1.6' }}>
            Si creas, curas o coleccionas piezas de valor, tu reputación es tu activo más importante. CertChain la vuelve verificable, transferible y a prueba de falsificaciones.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '18px',
          }}>
            {[
              {
                image: '/images/art.png',
                icon: <Palette size={20} color="#14F195" />,
                bg: 'rgba(20, 241, 149, 0.1)',
                title: 'Artistas Independientes',
                text: 'Firma cada pieza con tu identidad on-chain. Protege tu obra de copias y demuestra su origen para siempre.'
              },
              {
                image: '/images/joyas.png',
                icon: <Gem size={20} color="#c9a3ff" />,
                bg: 'rgba(153, 69, 255, 0.12)',
                title: 'Joyerías y Marcas',
                text: 'Emite certificados digitales por lote, elimina la falsificación y da a tus clientes prueba verificable de valor.'
              },
              {
                image: '/images/coleccion.png',
                icon: <Layers size={20} color="#14F195" />,
                bg: 'rgba(20, 241, 149, 0.1)',
                title: 'Coleccionistas',
                text: 'Compra y transfiere piezas con procedencia clara. Cada certificado viaja contigo, directo a tu wallet.'
              },
              {
                image: '/images/empresas.png',
                icon: <Rocket size={20} color="#c9a3ff" />,
                bg: 'rgba(153, 69, 255, 0.12)',
                title: 'Emprendedores',
                text: 'Lanza tu catálogo certificado sin infraestructura propia. Solana hace el trabajo pesado, tú te enfocas en crecer.'
              },
            ].map((card, i) => (
              <div key={i} style={{
                background: 'rgba(13, 18, 32, 0.6)',
                border: '1px solid rgba(153, 69, 255, 0.15)',
                borderRadius: '16px',
                overflow: 'hidden',
                textAlign: 'left',
              }}>
                <div style={{
                  aspectRatio: '16 / 10',
                  backgroundImage: `url(${card.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#0d0620',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, transparent 50%, rgba(13,18,32,0.85) 100%)'
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '10px', left: '10px',
                    background: card.bg, width: '38px', height: '38px', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    {card.icon}
                  </div>
                </div>
                <div style={{ padding: '20px 20px 22px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', fontFamily: 'Rajdhani' }}>
                    {card.title}
                  </h3>
                  <p style={{ color: '#8b88a3', fontSize: '13.5px', lineHeight: '1.55' }}>
                    {card.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CIERRE: RECORDATORIO DE REGISTRO */}
        <div style={{
          borderRadius: '20px',
          border: '1px solid rgba(153, 69, 255, 0.25)',
          background: 'linear-gradient(135deg, rgba(153,69,255,0.1), rgba(20,241,149,0.06))',
          padding: '36px 32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
              ¿Listo para certificar tu primera pieza?
            </div>
            <div style={{ color: '#8b88a3', fontSize: '14px' }}>
              Crea tu cuenta gratis y conecta tu wallet en menos de un minuto.
            </div>
          </div>
          <button
            onClick={() => setIsRegisterPickerOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #9945FF 0%, #14F195 130%)',
              border: 'none', color: '#05010d', padding: '14px 28px', borderRadius: '12px',
              cursor: 'pointer', fontWeight: 800, fontSize: '14px', fontFamily: "'JetBrains Mono', monospace",
              display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap',
              boxShadow: '0 10px 30px rgba(153, 69, 255, 0.35)'
            }}
          >
            Crear Cuenta Gratis <ArrowRight size={16} />
          </button>
        </div>
      </main>

      {/* FOOTER: REDES SOCIALES */}
      <footer style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '28px 48px 40px',
        borderTop: '1px solid rgba(153, 69, 255, 0.12)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        position: 'relative'
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.08em',
          color: '#716c86',
        }}>
          © {new Date().getFullYear()} CertChain · Certificación on-chain en Solana
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: '#8b88a3',
            textTransform: 'uppercase',
            marginRight: '4px'
          }}>
            Síguenos
          </span>
          {/* TODO: reemplaza estos href "#" por tus perfiles reales */}
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de CertChain"
            title="Instagram"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(153, 69, 255, 0.08)',
              border: '1px solid rgba(153, 69, 255, 0.25)',
              color: '#c9a3ff',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(153, 69, 255, 0.18)'; e.currentTarget.style.borderColor = '#9945FF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(153, 69, 255, 0.08)'; e.currentTarget.style.borderColor = 'rgba(153, 69, 255, 0.25)'; }}
          >
            <Camera size={17} />
          </a>
          <a
            href="https://x.com/CertChain_PJ"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X CertChain"
            title="X (Twitter)"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(20, 241, 149, 0.06)',
              border: '1px solid rgba(20, 241, 149, 0.25)',
              color: '#8ff5c6',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20, 241, 149, 0.16)'; e.currentTarget.style.borderColor = '#14F195'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(20, 241, 149, 0.06)'; e.currentTarget.style.borderColor = 'rgba(20, 241, 149, 0.25)'; }}
          >
            {/* Ícono de X dibujado a mano (lucide no incluye el logo oficial) */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </footer>

      {/* MODAL DE REGISTRO / LOGIN */}
      {isModalOpen && selectedRole && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0b0f19',
            border: `1px solid ${selectedRole === 'client' ? 'rgba(20, 241, 149, 0.3)' : 'rgba(153, 69, 255, 0.3)'}`,
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            padding: '36px',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            maxHeight: '88vh',
            overflowY: 'auto'
          }}>
            {/* Cerrar Modal */}
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            {/* Selector Tab Login / Registro */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '4px',
              borderRadius: '10px',
              marginBottom: '28px'
            }}>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setFormError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: '8px',
                  background: authMode === 'register' ? (selectedRole === 'client' ? '#14F195' : '#9945FF') : 'transparent',
                  color: authMode === 'register' ? '#ffffff' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Crear Cuenta
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setFormError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: '8px',
                  background: authMode === 'login' ? (selectedRole === 'client' ? '#14F195' : '#9945FF') : 'transparent',
                  color: authMode === 'login' ? '#ffffff' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Iniciar Sesión
              </button>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', fontFamily: 'Rajdhani' }}>
              {authMode === 'register' ? 'Registro' : 'Bienvenido de nuevo'} ({selectedRole === 'client' ? 'Cliente' : 'Empresa'})
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
              {authMode === 'register' ? 'Ingresa tus credenciales para vincular tu wallet.' : 'Accede a tu panel con tu correo registrado.'}
            </p>

            {formError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#fca5a5',
                fontSize: '12.5px',
                lineHeight: '1.5',
                marginBottom: '18px'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {authMode === 'register' && selectedRole === 'company' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Nombre de la Organización</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Joyería Luxury S.A." 
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  placeholder="certchainofficial@gmail.com" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="username" 
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wallet de Solana (opcional)</label>
                      <button
                        type="button"
                        onClick={() => setShowWalletHelp(v => !v)}
                        title="¿Cómo consigo una wallet?"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: showWalletHelp ? 'rgba(153, 69, 255, 0.18)' : 'transparent',
                          border: '1px solid rgba(153, 69, 255, 0.35)',
                          color: '#c9a3ff',
                          borderRadius: '999px',
                          padding: '2px 8px 2px 6px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <HelpCircle size={11} /> ¿Cómo obtengo una?
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleConnectSolflare}
                        title="Conectar Solflare Wallet Extension"
                        style={{
                          background: 'rgba(252, 114, 26, 0.15)',
                          border: '1px solid #fc721a',
                          color: '#fc721a',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Wallet size={11} /> Solflare
                      </button>
                      <button
                        type="button"
                        onClick={handleConnectPhantom}
                        title="Conectar Phantom Wallet Extension"
                        style={{
                          background: 'rgba(171, 159, 242, 0.15)',
                          border: '1px solid #ab9ff2',
                          color: '#ab9ff2',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Wallet size={11} /> Phantom
                      </button>
                    </div>
                  </div>

                  {/* MINI TUTORIAL: CÓMO CREAR UNA WALLET SOLFLARE */}
                  {showWalletHelp && (
                    <div style={{
                      background: 'rgba(252, 114, 26, 0.06)',
                      border: '1px solid rgba(252, 114, 26, 0.25)',
                      borderRadius: '10px',
                      padding: '14px 14px 12px',
                      marginBottom: '10px'
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '11.5px', fontWeight: 800, color: '#fc9a52', marginBottom: '10px',
                        textTransform: 'uppercase', letterSpacing: '0.04em'
                      }}>
                        <KeyRound size={13} /> Crea tu wallet Solflare en 4 pasos
                      </div>
                      <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        <li style={{ fontSize: '12px', color: '#c7c2dc', lineHeight: '1.5' }}>
                          Instala la extensión oficial de Solflare en tu navegador (o la app móvil).
                        </li>
                        <li style={{ fontSize: '12px', color: '#c7c2dc', lineHeight: '1.5' }}>
                          Elige "Crear nueva wallet" y guarda tu frase semilla (12-24 palabras) en un lugar seguro, offline. Nunca la compartas con nadie.
                        </li>
                        <li style={{ fontSize: '12px', color: '#c7c2dc', lineHeight: '1.5' }}>
                          Define una contraseña para desbloquear la extensión en este dispositivo.
                        </li>
                        <li style={{ fontSize: '12px', color: '#c7c2dc', lineHeight: '1.5' }}>
                          Copia tu dirección pública (clave pública) desde Solflare y pégala abajo, o simplemente presiona el botón "Solflare" para conectarla automáticamente.
                        </li>
                      </ol>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <a
                          href="https://solflare.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '11px', fontWeight: 700, color: '#fc9a52', textDecoration: 'none'
                          }}
                        >
                          <Download size={12} /> Descargar Solflare <ExternalLink size={10} />
                        </a>
                        <a
                          href="https://phantom.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '11px', fontWeight: 700, color: '#ab9ff2', textDecoration: 'none'
                          }}
                        >
                          <Download size={12} /> Descargar Phantom <ExternalLink size={10} />
                        </a>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#8b88a3', marginTop: '10px', lineHeight: '1.5' }}>
                        Este campo es opcional: si aún no tienes una wallet, puedes crear tu cuenta ahora y vincularla más adelante desde tu perfil.
                      </div>
                    </div>
                  )}

                  <input 
                      id="solana-wallet-input"
                      type="text" 
                      placeholder="Conecta Solflare / Phantom o pega tu clave pública" 
                      value={walletAddress}
                      onChange={e => setWalletAddress(e.target.value)}
                      autoComplete="off"
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${walletAddress ? 'rgba(20, 241, 149, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: '8px',
                        padding: '12px 14px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />

                  {walletAddress ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      marginTop: '7px', fontSize: '11px', color: '#8ff5c6'
                    }}>
                      <Check size={12} /> Wallet lista: {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                    </div>
                  ) : (
                    <div style={{ marginTop: '7px', fontSize: '11px', color: '#716c86' }}>
                      Puedes agregarla luego desde tu perfil si no tienes una a mano.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Contraseña</label>
               <input 
                  type="password" 
                  placeholder="••••••••••••" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={authMode === 'register' ? "new-password" : "current-password"} 
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {authMode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: '6px' }}>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      style={{ fontSize: '11.5px', color: '#9891b8', textDecoration: 'none' }}
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: selectedRole === 'client' 
                    ? 'linear-gradient(135deg, #14F195 0%, #0dbf78 100%)' 
                    : 'linear-gradient(135deg, #9945FF 0%, #7a2fd9 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginTop: '10px',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'PROCESANDO...' : (authMode === 'register' ? 'COMPLETAR REGISTRO' : 'INGRESAR AL DASHBOARD')}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#716c86' }}>
                {authMode === 'register' ? (
                  <>¿Ya tienes cuenta?{' '}
                    <span
                      onClick={() => { setAuthMode('login'); setFormError(''); }}
                      style={{ color: selectedRole === 'client' ? '#14F195' : '#c9a3ff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Inicia sesión
                    </span>
                  </>
                ) : (
                  <>¿Aún no tienes cuenta?{' '}
                    <span
                      onClick={() => { setAuthMode('register'); setFormError(''); }}
                      style={{ color: selectedRole === 'client' ? '#14F195' : '#c9a3ff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Regístrate
                    </span>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}