'use client';

import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import LoadingSkeleton from './LoadingSkeleton';
import SidePanel from './SidePanel';

const TIPOS_CAMPO = [
  { value: 'texto', label: 'Texto corto' },
  { value: 'texto_largo', label: 'Texto largo' },
  { value: 'numero', label: 'Número' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'select', label: 'Opción múltiple' },
  { value: 'nombre_paciente', label: 'Nombre del paciente' },
  { value: 'email', label: 'Email' },
  { value: 'telefono', label: 'Teléfono' },
];
const TIPO_LABEL = Object.fromEntries(TIPOS_CAMPO.map(t => [t.value, t.label]));

function nuevoCampoId() { return 'campo_' + Math.random().toString(36).slice(2, 9); }

// Apartado de Cuestionarios: formularios públicos configurables desde el panel (sin tocar
// código), de los que la Entrevista de prefiltro es el primero. Cada cuestionario define sus
// propios campos y se comparte con un link público propio (/cuestionario/<empresa>/<slug>,
// salvo el de prefiltro que mantiene su URL histórica /prefiltro/<empresa>).
export default function CuestionariosAdmin({ empresaSlug }) {
  const [cuestionarios, setCuestionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [editando, setEditando] = useState(null); // null | {} (nuevo) | cuestionario existente
  const [viendoRespuestasDe, setViendoRespuestasDe] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cuestionarios');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCuestionarios(data.cuestionarios || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function toggleActivo(c) {
    const activar = !c.activo;
    setConfirmando({
      mensaje: activar ? `¿Volver a activar "${c.nombre}"? El link público vuelve a funcionar.` : `¿Desactivar "${c.nombre}"? El link público deja de aceptar respuestas nuevas, pero las que ya llegaron no se borran.`,
      textoConfirmar: activar ? 'Activar' : 'Desactivar',
      onConfirm: async () => {
        await fetch(`/api/admin/cuestionarios/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: activar }) });
        cargar();
      }
    });
  }

  function borrar(c) {
    setConfirmando({
      mensaje: `¿Borrar definitivamente "${c.nombre}"? Se pierden también las ${c.cantidadRespuestas} respuesta(s) ya recibidas.`,
      destructivo: true, textoConfirmar: 'Borrar',
      onConfirm: async () => {
        await fetch(`/api/admin/cuestionarios/${c.id}`, { method: 'DELETE' });
        cargar();
      }
    });
  }

  function linkPublico(c) {
    if (typeof window === 'undefined' || !empresaSlug) return '';
    const base = window.location.origin;
    return c.slug === 'prefiltro' ? `${base}/prefiltro/${empresaSlug}` : `${base}/cuestionario/${empresaSlug}/${c.slug}`;
  }

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Cuestionarios</h2>
        <span className="note">prefiltro, seguimiento, satisfacción — formularios públicos que armás vos, sin tocar código</span></div>

      <div style={{ marginBottom: 16 }}>
        <button className="icon-btn primary" onClick={() => setEditando({})}>+ Nuevo cuestionario</button>
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      {loading ? <LoadingSkeleton lines={3} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cuestionarios.map(c => (
            <div key={c.id} className="prof-card">
              <div className="prof-card-head" style={{ cursor: 'default' }}>
                <div className="nombre" style={{ opacity: c.activo ? 1 : 0.5 }}>{c.nombre}</div>
                {!c.activo && <span className="tag rust">inactivo</span>}
                <span className="tag sage">{c.cantidadRespuestas} respuesta{c.cantidadRespuestas === 1 ? '' : 's'}</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.descripcion && <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0 }}>{c.descripcion}</p>}
                <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0, wordBreak: 'break-all' }}>
                  Link público: <a href={linkPublico(c)} target="_blank" rel="noreferrer">{linkPublico(c)}</a>
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="icon-btn" onClick={() => setViendoRespuestasDe(c)}>Ver respuestas</button>
                  <button className="icon-btn" onClick={() => setEditando(c)}>Editar preguntas</button>
                  <button className="icon-btn" onClick={() => toggleActivo(c)}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                  <button className="icon-btn destructivo" onClick={() => borrar(c)}>Borrar</button>
                </div>
              </div>
            </div>
          ))}
          {!cuestionarios.length && (
            <div className="empty-state">
              <span className="icon">📋</span>
              <span className="title">Todavía no hay cuestionarios</span>
              <span className="hint">Creá el primero — por ejemplo, la entrevista de prefiltro para pacientes nuevos.</span>
            </div>
          )}
        </div>
      )}

      {editando && (
        <CuestionarioEditor cuestionario={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); cargar(); }} />
      )}
      {viendoRespuestasDe && (
        <RespuestasViewer cuestionario={viendoRespuestasDe} onClose={() => setViendoRespuestasDe(null)} />
      )}
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}

function CuestionarioEditor({ cuestionario, onClose, onSaved }) {
  const esNuevo = !cuestionario.id;
  const [nombre, setNombre] = useState(cuestionario.nombre || '');
  const [descripcion, setDescripcion] = useState(cuestionario.descripcion || '');
  const [vinculaPaciente, setVinculaPaciente] = useState(cuestionario.vincula_paciente ?? true);
  const [campos, setCampos] = useState(cuestionario.campos?.length ? cuestionario.campos : [{ id: nuevoCampoId(), etiqueta: '', tipo: 'texto', requerido: false }]);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  function cambiarCampo(i, patch) {
    setCampos(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function agregarCampo() { setCampos(cs => [...cs, { id: nuevoCampoId(), etiqueta: '', tipo: 'texto', requerido: false }]); }
  function quitarCampo(i) { setCampos(cs => cs.filter((_, idx) => idx !== i)); }
  function moverCampo(i, delta) {
    setCampos(cs => {
      const j = i + delta;
      if (j < 0 || j >= cs.length) return cs;
      const copia = [...cs];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  async function guardar() {
    if (!nombre.trim()) { setErrorMsg('Ponele un nombre al cuestionario.'); return; }
    if (!campos.some(c => c.etiqueta.trim())) { setErrorMsg('Agregá al menos una pregunta.'); return; }
    setGuardando(true);
    setErrorMsg('');
    try {
      const camposLimpios = campos.filter(c => c.etiqueta.trim()).map(c => ({
        id: c.id, etiqueta: c.etiqueta.trim(), tipo: c.tipo, requerido: !!c.requerido,
        ...(c.tipo === 'select' ? { opciones: (c.opciones || []).filter(Boolean) } : {})
      }));
      const body = { nombre: nombre.trim(), descripcion: descripcion.trim(), vinculaPaciente, campos: camposLimpios };
      const url = esNuevo ? '/api/admin/cuestionarios' : `/api/admin/cuestionarios/${cuestionario.id}`;
      const res = await fetch(url, { method: esNuevo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SidePanel open onClose={onClose} title={esNuevo ? 'Nuevo cuestionario' : 'Editar cuestionario'} width={560}>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Nombre</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Seguimiento mensual" />
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Descripción (opcional, se muestra arriba del formulario)</label>
        <input value={descripcion} onChange={e => setDescripcion(e.target.value)} />
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
          <input type="checkbox" checked={vinculaPaciente} onChange={e => setVinculaPaciente(e.target.checked)} />
          Buscar o crear la ficha del paciente a partir de la respuesta
        </label>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>
          Necesita al menos un campo de tipo "Nombre del paciente" para funcionar.
        </div>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>Preguntas</h3>
      {campos.map((c, i) => (
        <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="Pregunta / etiqueta" value={c.etiqueta} onChange={e => cambiarCampo(i, { etiqueta: e.target.value })} style={{ flex: 1 }} />
            <select value={c.tipo} onChange={e => cambiarCampo(i, { tipo: e.target.value })} style={{ width: 170 }}>
              {TIPOS_CAMPO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {c.tipo === 'select' && (
            <input placeholder="Opciones separadas por coma" value={(c.opciones || []).join(', ')}
              onChange={e => cambiarCampo(i, { opciones: e.target.value.split(',').map(s => s.trim()) })}
              style={{ width: '100%', marginBottom: 8 }} />
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 400 }}>
              <input type="checkbox" checked={!!c.requerido} onChange={e => cambiarCampo(i, { requerido: e.target.checked })} /> Obligatoria
            </label>
            <div style={{ flex: 1 }} />
            <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} disabled={i === 0} onClick={() => moverCampo(i, -1)}>↑</button>
            <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} disabled={i === campos.length - 1} onClick={() => moverCampo(i, 1)}>↓</button>
            <button className="icon-btn destructivo" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => quitarCampo(i)}>Quitar</button>
          </div>
        </div>
      ))}
      <button className="icon-btn" style={{ marginBottom: 16 }} onClick={agregarCampo}>+ Agregar pregunta</button>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 12.5 }}>{errorMsg}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="icon-btn" onClick={onClose}>Cancelar</button>
        <button className="icon-btn primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </SidePanel>
  );
}

function RespuestasViewer({ cuestionario, onClose }) {
  const [respuestas, setRespuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    fetch(`/api/admin/cuestionarios/${cuestionario.id}/respuestas`).then(r => r.json())
      .then(d => setRespuestas(d.respuestas || [])).finally(() => setLoading(false));
  }, [cuestionario.id]);

  const campoNombre = (cuestionario.campos || []).find(c => c.tipo === 'nombre_paciente');

  return (
    <SidePanel open onClose={onClose} title={`Respuestas — ${cuestionario.nombre}`} width={520}>
      {loading ? <LoadingSkeleton lines={3} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {respuestas.map(r => {
            const nombre = r.paciente_nombre || (campoNombre ? r.respuestas?.[campoNombre.id] : null) || 'Respuesta';
            const abiertaAca = abierta === r.id;
            return (
              <div key={r.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setAbierta(abiertaAca ? null : r.id)}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{nombre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>{(r.created_at || '').slice(0, 10)}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{abiertaAca ? '▾' : '▸'}</span>
                </div>
                {abiertaAca && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(cuestionario.campos || []).filter(c => r.respuestas?.[c.id]).map(c => (
                      <div key={c.id}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>{c.etiqueta}</div>
                        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.respuestas[c.id]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!respuestas.length && (
            <div className="empty-state">
              <span className="icon">📭</span>
              <span className="title">Todavía no hay respuestas</span>
            </div>
          )}
        </div>
      )}
    </SidePanel>
  );
}
