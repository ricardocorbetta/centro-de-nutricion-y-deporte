'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_DATA_URI } from '../../lib/logo';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg, #F4F7F6)', fontFamily: "'Inter', sans-serif"
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', border: '1px solid #E3EAE7', borderRadius: 16,
        padding: '36px 32px', width: 340, boxShadow: '0 12px 28px -16px rgba(21,39,42,.18)'
      }}>
        <img src={LOGO_DATA_URI} alt="CND" style={{ height: 34, marginBottom: 22, display: 'block' }} />
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: '#15272A' }}>Panel de gestión</h1>
        <p style={{ fontSize: 13, color: '#5C6E70', margin: '0 0 22px' }}>Centro de Nutrición y Deporte</p>

        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B9A9B', marginBottom: 6 }}>Usuario</label>
        <input value={username} onChange={e => setUsername(e.target.value)} autoFocus
          style={{ width: '100%', padding: '9px 12px', marginBottom: 16, background: '#EEF3F1', border: '1px solid #D3DEDA', borderRadius: 10, fontSize: 14 }} />

        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B9A9B', marginBottom: 6 }}>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', marginBottom: 20, background: '#EEF3F1', border: '1px solid #D3DEDA', borderRadius: 10, fontSize: 14 }} />

        {error && <div style={{ color: '#C0562F', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '10px 0', background: '#1F7A68', color: '#fff', border: 'none',
          borderRadius: 999, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', opacity: loading ? .7 : 1
        }}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </div>
  );
}
