import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Building2, UserCheck, Key, Mail, Lock } from 'lucide-react';

export function LoginView() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<'company' | 'buyer'>('buyer');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      await register({ email, password, role, company_name: role === 'company' ? companyName : null });
    } else {
      await login(email, password);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#07090f', minHeight: '100vh' }}>
      <div className="glow-border" style={{ background: '#0c0f1d', borderRadius: 16, padding: '40px', width: '100%', maxWidth: 440 }}>
        
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldCheck size={28} color="#00c8ff" />
          </div>
          <h2 style={{ fontFamily: 'Rajdhani', fontSize: 26, fontWeight: 700, letterSpacing: '0.05em' }}>
            {isRegister ? 'CREAR CUENTA' : 'INICIAR SESIÓN'}
          </h2>
          <p style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6485', marginTop: 4 }}>
            {isRegister ? 'Selecciona tu tipo de perfil' : 'Ingresa tus credenciales para continuar'}
          </p>
        </div>

        {isRegister && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setRole('buyer')}
              style={{
                padding: '12px', borderRadius: 10, cursor: 'pointer',
                background: role === 'buyer' ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${role === 'buyer' ? '#00c8ff' : 'rgba(255,255,255,0.08)'}`,
                color: role === 'buyer' ? '#00c8ff' : '#5a6485', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
              }}
            >
              <UserCheck size={18} />
              <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13 }}>COMPRADOR</span>
            </button>

            <button
              type="button"
              onClick={() => setRole('company')}
              style={{
                padding: '12px', borderRadius: 10, cursor: 'pointer',
                background: role === 'company' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${role === 'company' ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`,
                color: role === 'company' ? '#7c3aed' : '#5a6485', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
              }}
            >
              <Building2 size={18} />
              <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13 }}>EMPRESA</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isRegister && role === 'company' && (
            <div>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Nombre de la Empresa</label>
              <input className="input-base" placeholder="Ej. Luxury Jewelry Corp" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Correo Electrónico</label>
            <input className="input-base" type="email" placeholder="usuario@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6485', textTransform: 'uppercase', marginBottom: 6 }}>Contraseña</label>
            <input className="input-base" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '14px', fontSize: 15, marginTop: 8 }}>
            {isRegister ? 'REGISTRARME' : 'INGRESAR'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={() => setIsRegister(!isRegister)}
            style={{ background: 'none', border: 'none', color: '#00c8ff', fontFamily: 'JetBrains Mono', fontSize: 11, cursor: 'pointer' }}
          >
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>

      </div>
    </div>
  );
}