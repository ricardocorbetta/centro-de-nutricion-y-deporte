'use client';

import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import LoadingSkeleton from './LoadingSkeleton';
import Avatar from './Avatar';

const TIPO_TAG_CLASS = { receta: 'sage', pauta_general: 'rust' };

function todayISO() { return new Date().toISOString().slice(0, 10); }

const TIPO = [
  { value: 'receta', label: 'Receta' },
  { value: 'material_educativo', label: 'Material educativo' },
  { value: 'pauta_general', label: 'Pauta general' },
  { value: 'tip', label: 'Tip' }
];
const TIPO_LABEL = Object.fromEntries(TIPO.map(t => [t.value, t.label]));

const VISIBILIDAD = [
  { value: 'propios', label: 'Pacientes del profesional', hint: 'solo quienes ya tuvieron un turno con ese profesional' },
  { value: 'todos_cnd', label: 'Todos los pacientes de CND', hint: 'cualquier paciente con acceso al portal' },
  { value: 'especificos', label: 'Pacientes específicos', hint: 'elegís a mano quiénes lo ven' }
];

// Biblioteca semiprivada (Sector B): recetas, material educativo, pautas y tips que cada profesional
// publica y pone a disposición de sus pacientes (o de pacientes puntuales, o de todo CND).
export default function BibliotecaAdmin({ empresaSlug }) {
  const [contenido, setContenido] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [creando, setCreando] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch('/api/biblioteca');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setContenido(data.contenido || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    if (empresaSlug) {
      fetch('/api/public/profesionales?empresa=' + encodeURIComponent(empresaSlug))
        .then(r => r.json()).then(d => setProfesionales((d.profesionales || []).map(p => p.nombre)))
        .catch(() => {});
    }
  }, [empresaSlug]);

  function toggleActivo(item) {
    const activar = !item.activo;
    setConfirmando({
      mensaje: activar ? `¿Volver a publicar "${item.titulo}"?` : `¿Ocultar "${item.titulo}"? Deja de verse en el portal, pero no se borra.`,
      textoConfirmar: activar ? 'Publicar' : 'Ocultar',
      onConfirm: async () => {
        await fetch(`/api/biblioteca/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: activar }) });
        cargar();
      }
    });
  }

  function borrar(item) {
    setConfirmando({
      mensaje: `¿Borrar definitivamente "${item.titulo}"?`, destructivo: true, textoConfirmar: 'Borrar',
      onConfirm: async () => {
        await fetch(`/api/biblioteca/${item.id}`, { method: 'DELETE' });
        cargar();
      }
    });
  }

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Biblioteca</h2>
        <span className="note">recetas, material educativo y pautas para los pacientes</span></div>

      <div style={{ marginBottom: 16 }}>
        <button className="icon-btn primary" onClick={() => setCreando(true)}>+ Publicar contenido</button>
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      {loading ? <LoadingSkeleton lines={4} /> : (
        <table className="plain">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Título</th><th>Profesional</th><th>Visibilidad</th><th></th></tr></thead>
          <tbody>
            {contenido.map(c => (
              <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.5 }}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.fecha}</td>
                <td><span className={'tag' + (TIPO_TAG_CLASS[c.tipo] ? ' ' + TIPO_TAG_CLASS[c.tipo] : '')}>{TIPO_LABEL[c.tipo] || c.tipo}</span></td>
                <td style={{ fontWeight: 600 }}>{c.titulo}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar nombre={c.profesional} size={22} />
                    {c.profesional}
                  </div>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                  {c.visibilidad === 'propios' && 'Pacientes del profesional'}
                  {c.visibilidad === 'todos_cnd' && 'Todos CND'}
                  {c.visibilidad === 'especificos' && `${c.pacientesIds?.length || 0} paciente(s)`}
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" onClick={() => toggleActivo(c)}>{c.activo ? 'Ocultar' : 'Publicar'}</button>
                  <button className="icon-btn destructivo" onClick={() => borrar(c)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!contenido.length && (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <span className="icon">📚</span>
                  <span className="title">Todavía no hay contenido publicado</span>
                  <span className="hint">Recetas, pautas o material educativo para tus pacientes.</span>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {creando && (
        <PublicarModal profesionales={profesionales} onClose={() => setCreando(false)} onCreated={() => { setCreando(false); cargar(); }} />
      )}
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}

function PublicarModal({ profesionales, onClose, onCreated }) {
  const [profesional, setProfesional] = useState(profesionales[0] || '');
  const [tipo, setTipo] = useState('receta');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [visibilidad, setVisibilidad] = useState('propios');
  const [file, setFile] = useState(null);
  const [pacientesQuery, setPacientesQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [elegidos, setElegidos] = useState([]); // [{id, nombre}]
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!pacientesQuery.trim()) { setResultados([]); return; }
    const t = setTimeout(() => {
      fetch('/api/pacientes?q=' + encodeURIComponent(pacientesQuery.trim()))
        .then(r => r.json()).then(d => setResultados(d.pacientes || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [pacientesQuery]);

  function agregarPaciente(p) {
    if (!elegidos.find(e => e.id === p.id)) setElegidos(prev => [...prev, { id: p.id, nombre: p.nombre }]);
    setPacientesQuery('');
    setResultados([]);
  }

  async function guardar() {
    if (!profesional || !titulo.trim()) { setErrorMsg('Falta el profesional o el título.'); return; }
    if (visibilidad === 'especificos' && !elegidos.length) { setErrorMsg('Elegí al menos un paciente.'); return; }
    setGuardando(true);
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('profesional', profesional);
      form.append('tipo', tipo);
      form.append('titulo', titulo.trim());
      form.append('descripcion', descripcion);
      form.append('fecha', fecha);
      form.append('visibilidad', visibilidad);
      form.append('pacientesIds', JSON.stringify(elegidos.map(e => e.id)));
      if (file) form.append('file', file);
      const res = await fetch('/api/biblioteca', { method: 'POST', body: form });
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
      <div className="card" style={{ width: 480, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="section-head"><span className="dot" /><h2>Publicar contenido</h2></div>

        <div className="manual-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
          <div className="field">
            <label>Profesional</label>
            <select value={profesional} onChange={e => setProfesional(e.target.value)}>
              {profesionales.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Torre de panqueques fit" />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Descripción (opcional)</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Texto corto, o dejalo vacío si el archivo habla solo" />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="field">
            <label>Archivo (PDF o imagen, opcional)</label>
            <input type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>¿Quién lo ve?</label>
          <select value={visibilidad} onChange={e => setVisibilidad(e.target.value)}>
            {VISIBILIDAD.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>
            {VISIBILIDAD.find(v => v.value === visibilidad)?.hint}
          </div>
        </div>

        {visibilidad === 'especificos' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {elegidos.map(p => (
                <span key={p.id} className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {p.nombre}
                  <button type="button" onClick={() => setElegidos(prev => prev.filter(e => e.id !== p.id))}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 12 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <input value={pacientesQuery} onChange={e => setPacientesQuery(e.target.value)} placeholder="Buscar paciente por nombre o teléfono…" style={{ width: '100%' }} />
              {resultados.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, maxHeight: 180, overflowY: 'auto' }}>
                  {resultados.map(p => (
                    <button key={p.id} type="button" onClick={() => agregarPaciente(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                      {p.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="icon-btn primary" disabled={guardando} onClick={guardar}>{guardando ? 'Publicando…' : 'Publicar'}</button>
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
