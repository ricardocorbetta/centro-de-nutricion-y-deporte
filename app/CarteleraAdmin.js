'use client';

import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import LoadingSkeleton from './LoadingSkeleton';

function todayISO() { return new Date().toISOString().slice(0, 10); }

const TIPO = [
  { value: 'taller', label: 'Taller / capacitación' },
  { value: 'efemeride', label: 'Efeméride / saludo' },
  { value: 'receta', label: 'Receta de temporada' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'comunidad', label: 'Comunidad CND' },
  { value: 'otro', label: 'Otro' }
];
const TIPO_LABEL = Object.fromEntries(TIPO.map(t => [t.value, t.label]));

// Cartelera pública (Sector C): talleres, efemérides, recetas de temporada y flyers, visibles sin
// login en una página pública — cartelera educativa y de marketing para cualquiera que la visite.
export default function CarteleraAdmin({ empresaSlug }) {
  const [cartelera, setCartelera] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [creando, setCreando] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch('/api/cartelera');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCartelera(data.cartelera || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function toggleActivo(item) {
    const activar = !item.activo;
    setConfirmando({
      mensaje: activar ? `¿Volver a publicar "${item.titulo}"?` : `¿Ocultar "${item.titulo}" de la cartelera pública?`,
      textoConfirmar: activar ? 'Publicar' : 'Ocultar',
      onConfirm: async () => {
        await fetch(`/api/cartelera/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: activar }) });
        cargar();
      }
    });
  }

  async function toggleDestacar(item) {
    await fetch(`/api/cartelera/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destacar: !item.destacar }) });
    cargar();
  }

  function borrar(item) {
    setConfirmando({
      mensaje: `¿Borrar definitivamente "${item.titulo}"?`, destructivo: true, textoConfirmar: 'Borrar',
      onConfirm: async () => {
        await fetch(`/api/cartelera/${item.id}`, { method: 'DELETE' });
        cargar();
      }
    });
  }

  const link = empresaSlug && typeof window !== 'undefined' ? `${window.location.origin}/cartelera/${empresaSlug}` : '';

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Cartelera pública</h2>
        <span className="note">talleres, efemérides, recetas de temporada — sin login</span></div>

      {link && (
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -8, marginBottom: 14 }}>
          Página pública: <a href={link} target="_blank" rel="noreferrer">{link}</a>
        </p>
      )}

      <div style={{ marginBottom: 16 }}>
        <button className="icon-btn primary" onClick={() => setCreando(true)}>+ Publicar en la cartelera</button>
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      {loading ? <LoadingSkeleton lines={4} /> : (
        <table className="plain">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Título</th><th></th><th></th></tr></thead>
          <tbody>
            {cartelera.map(c => (
              <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.5 }}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.fecha}</td>
                <td><span className="tag">{TIPO_LABEL[c.tipo] || c.tipo}</span></td>
                <td style={{ fontWeight: 600 }}>{c.titulo}{c.destacar ? ' ⭐' : ''}</td>
                <td><button className="icon-btn" onClick={() => toggleDestacar(c)}>{c.destacar ? 'Quitar destacado' : 'Destacar'}</button></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" onClick={() => toggleActivo(c)}>{c.activo ? 'Ocultar' : 'Publicar'}</button>
                  <button className="icon-btn" onClick={() => borrar(c)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!cartelera.length && (
              <tr><td colSpan={5}>
                <div className="empty-state">
                  <span className="icon">📣</span>
                  <span className="title">Todavía no hay nada publicado</span>
                  <span className="hint">Talleres, saludos por fechas patrias, recetas de temporada…</span>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {creando && <PublicarModal onClose={() => setCreando(false)} onCreated={() => { setCreando(false); cargar(); }} />}
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}

function PublicarModal({ onClose, onCreated }) {
  const [tipo, setTipo] = useState('comunidad');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [destacar, setDestacar] = useState(false);
  const [image, setImage] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function guardar() {
    if (!titulo.trim()) { setErrorMsg('Falta el título.'); return; }
    setGuardando(true);
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('tipo', tipo);
      form.append('titulo', titulo.trim());
      form.append('descripcion', descripcion);
      form.append('fecha', fecha);
      form.append('destacar', String(destacar));
      if (image) form.append('image', image);
      const res = await fetch('/api/cartelera', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCreated();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,39,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: 460, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="section-head"><span className="dot" /><h2>Publicar en la cartelera</h2></div>

        <div className="manual-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
          <div className="field"><label>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: ¡Feliz día de la primavera!" />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Descripción (opcional)</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Imagen / flyer (opcional)</label>
            <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
              <input type="checkbox" checked={destacar} onChange={e => setDestacar(e.target.checked)} /> Destacar arriba de todo
            </label>
          </div>
        </div>

        {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="icon-btn primary" disabled={guardando} onClick={guardar}>{guardando ? 'Publicando…' : 'Publicar'}</button>
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
