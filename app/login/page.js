'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
      <form onSubmit={handleSubmit} className="card" style={{
        padding: '36px 32px', width: 340, boxShadow: 'var(--shadow)'
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--primary)', marginBottom: 4 }}>NUTRIO</div>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: 'var(--ink)' }}>Panel de gestión</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 22px' }}>Plataforma para centros de nutrición y deporte</p>

        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>Usuario</label>
        <input value={username} onChange={e => setUsername(e.target.value)} autoFocus
          style={{ width: '100%', marginBottom: 16 }} />

        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', marginBottom: 20 }} />

        {error && <div style={{ color: 'var(--rust)', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <button type="submit" className="icon-btn primary" disabled={loading} style={{ width: '100%', padding: '10px 0' }}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
