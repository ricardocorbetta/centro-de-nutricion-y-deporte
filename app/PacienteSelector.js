'use client';

import { useEffect, useRef, useState } from 'react';

// Buscador de pacientes con autocompletar + alta rápida inline.
// value: paciente seleccionado ({ id, nombre, telefono }) o null
// onChange(paciente | null)
export default function PacienteSelector({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickFuera(e) { if (boxRef.current && !boxRef.current.contains(e.target)) { setAbierto(false); setCreando(false); } }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  useEffect(() => {
    if (!query.trim() || value) { setResultados([]); return; }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(() => {
      fetch('/api/pacientes?q=' + encodeURIComponent(query.trim()))
        .then(r => r.json())
        .then(data => { if (!cancelado) setResultados(data.pacientes || []); })
        .catch(() => {})
        .finally(() => { if (!cancelado) setBuscando(false); });
    }, 300);
    return () => { cancelado = true; clearTimeout(t); };
  }, [query, value]);

  function elegir(p) {
    onChange({ id: p.id, nombre: p.nombre, telefono: p.telefono });
    setQuery('');
    setAbierto(false);
    setCreando(false);
  }

  function quitar() {
    onChange(null);
    setQuery('');
  }

  async function crearNuevo() {
    if (!query.trim()) return;
    setErrorMsg('');
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: query.trim(), telefono: nuevoTelefono || null })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      elegir(data.paciente);
      setNuevoTelefono('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  if (value) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-alt)',
        border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '7px 10px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value.nombre}</div>
          {value.telefono && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{value.telefono}</div>}
        </div>
        <button type="button" className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={quitar}>Cambiar</button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setAbierto(true); setCreando(false); }}
        onFocus={() => setAbierto(true)}
        placeholder="Buscar por nombre o teléfono…"
        style={{ width: '100%' }}
      />
      {abierto && query.trim() && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10,
          boxShadow: '0 12px 28px -16px rgba(21,39,42,.25)', maxHeight: 260, overflowY: 'auto'
        }}>
          {buscando && <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-faint)' }}>Buscando…</div>}
          {!buscando && resultados.map(p => (
            <button key={p.id} type="button" onClick={() => elegir(p)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
              border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13
            }}>
              <div style={{ fontWeight: 600 }}>{p.nombre}</div>
              {p.telefono && <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{p.telefono}</div>}
            </button>
          ))}
          {!buscando && !resultados.length && !creando && (
            <button type="button" onClick={() => setCreando(true)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--primary)'
            }}>+ Crear paciente nuevo: &quot;{query.trim()}&quot;</button>
          )}
          {creando && (
            <div style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Nuevo paciente: <b>{query.trim()}</b></div>
              <input placeholder="Teléfono (opcional)" value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
              {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 11.5, margin: '0 0 6px' }}>{errorMsg}</p>}
              <button type="button" className="icon-btn primary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={crearNuevo}>Crear y usar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
