'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/stats';
import { ESTADO_LABEL } from '../lib/agendaEstados';

function todayISO() { return new Date().toISOString().slice(0, 10); }

const CAMPOS_FICHA = [
  { key: 'nombre', label: 'Nombre', required: true },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'dni', label: 'DNI' },
  { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date' },
  { key: 'financiador', label: 'Financiador / Obra social' },
];

// Listado de pacientes + ficha con historial. "statsSlot" es contenido opcional (las
// estadísticas de ausentismo/pacientes nuevos que ya existían) que se muestra como
// una segunda pestaña, para no perder esa vista.
export default function PacientesPanel({ statsSlot }) {
  const [tab, setTab] = useState('listado');
  const [pacientes, setPacientes] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [seleccionado, setSeleccionado] = useState(null); // id del paciente abierto
  const [creando, setCreando] = useState(false);
  const [entrevistas, setEntrevistas] = useState([]);

  async function cargarEntrevistas() {
    try {
      const res = await fetch('/api/prefiltro?sinRevisar=1');
      const data = await res.json();
      if (!data.error) setEntrevistas(data.entrevistas || []);
    } catch (e) {}
  }

  async function marcarRevisada(id) {
    try {
      await fetch(`/api/prefiltro/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisado: true }) });
      setEntrevistas(prev => prev.filter(e => e.id !== id));
    } catch (e) {}
  }

  useEffect(() => { cargarEntrevistas(); }, []);

  async function cargar(q) {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/pacientes' + (q ? '?q=' + encodeURIComponent(q) : ''));
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPacientes(data.pacientes || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => cargar(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Pacientes</h2>
        <span className="note">{pacientes.length} {query ? 'coincidencias' : 'recientes'}</span></div>

      <div className="tabbar">
        <button className={tab === 'listado' ? 'active' : ''} onClick={() => setTab('listado')}>Listado</button>
        <button className={tab === 'entrevistas' ? 'active' : ''} onClick={() => setTab('entrevistas')}>
          Entrevistas nuevas {entrevistas.length ? <span style={{ opacity: .6 }}>({entrevistas.length})</span> : ''}
        </button>
        {statsSlot && <button className={tab === 'estadisticas' ? 'active' : ''} onClick={() => setTab('estadisticas')}>Estadísticas</button>}
      </div>

      {tab === 'estadisticas' && statsSlot}

      {tab === 'entrevistas' && (
        <table className="plain">
          <thead><tr><th>Recibida</th><th>Nombre</th><th>WhatsApp</th><th>Primera consulta</th><th>Motivo</th><th></th></tr></thead>
          <tbody>
            {entrevistas.map(e => (
              <tr key={e.id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{(e.created_at || '').slice(0, 10)}</td>
                <td style={{ fontWeight: 600 }}>{e.nombre}</td>
                <td>{e.whatsapp || '-'}</td>
                <td>{e.fecha_primera_consulta || '-'}</td>
                <td style={{ maxWidth: 260, fontSize: 12.5 }}>{e.motivo_consulta || '-'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {e.paciente_id && <button className="icon-btn" onClick={() => setSeleccionado(e.paciente_id)}>Ver ficha</button>}
                  <button className="icon-btn" onClick={() => marcarRevisada(e.id)}>Marcar vista</button>
                </td>
              </tr>
            ))}
            {!entrevistas.length && <tr><td colSpan={6} style={{ color: 'var(--ink-faint)' }}>No hay entrevistas nuevas sin revisar.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'listado' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono…" style={{ flex: 1, minWidth: 220 }}
            />
            <button className="icon-btn primary" onClick={() => setCreando(true)}>+ Nuevo paciente</button>
          </div>

          {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

          <table className="plain">
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Financiador</th><th>Alta</th><th></th></tr></thead>
            <tbody>
              {pacientes.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td>{p.telefono || '-'}</td>
                  <td>{p.financiador || '-'}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{(p.created_at || '').slice(0, 10)}</td>
                  <td><button className="icon-btn" onClick={() => setSeleccionado(p.id)}>Ver ficha</button></td>
                </tr>
              ))}
              {!loading && !pacientes.length && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <span className="icon">🗂️</span>
                    <span className="title">{query ? 'Sin coincidencias' : 'Todavía no hay pacientes cargados'}</span>
                    <span className="hint">
                      {query ? 'Probá con otro nombre o teléfono.' : 'Se van a ir sumando solos desde la agenda, la caja y la reserva pública — o cargá uno manualmente.'}
                    </span>
                  </div>
                </td></tr>
              )}
              {loading && (
                <tr><td colSpan={5}>
                  <div className="skeleton skeleton-line" style={{ width: '65%' }} />
                  <div className="skeleton skeleton-line" style={{ width: '50%' }} />
                </td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {creando && (
        <PacienteFormModal
          onClose={() => setCreando(false)}
          onSaved={(p) => { setCreando(false); cargar(query); setSeleccionado(p.id); }}
        />
      )}

      {seleccionado && (
        <FichaPacienteModal id={seleccionado} onClose={() => setSeleccionado(null)} onUpdated={() => cargar(query)} />
      )}
    </>
  );
}

function PacienteFormModal({ onClose, onSaved, inicial }) {
  const [valores, setValores] = useState({
    nombre: inicial?.nombre || '', telefono: inicial?.telefono || '', email: inicial?.email || '',
    dni: inicial?.dni || '', fechaNacimiento: inicial?.fecha_nacimiento || '', financiador: inicial?.financiador || '',
    notas: inicial?.notas || ''
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function guardar() {
    if (!valores.nombre.trim()) { setErrorMsg('Falta el nombre.'); return; }
    setSaving(true);
    setErrorMsg('');
    try {
      const url = inicial ? `/api/pacientes/${inicial.id}` : '/api/pacientes';
      const method = inicial ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valores) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSaved(data.paciente);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,39,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: 420, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <div className="section-head"><span className="dot" /><h2>{inicial ? 'Editar paciente' : 'Nuevo paciente'}</h2></div>
        <div className="manual-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {CAMPOS_FICHA.map(c => (
            <div className="field" key={c.key} style={c.key === 'nombre' ? { gridColumn: '1 / -1' } : undefined}>
              <label>{c.label}{c.required ? ' *' : ''}</label>
              <input type={c.type || 'text'} value={valores[c.key]} onChange={e => setValores(v => ({ ...v, [c.key]: e.target.value }))} />
            </div>
          ))}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Notas</label>
            <input value={valores.notas} onChange={e => setValores(v => ({ ...v, notas: e.target.value }))} />
          </div>
        </div>
        {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="icon-btn primary" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : 'Guardar'}</button>
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function FichaPacienteModal({ id, onClose, onUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [editando, setEditando] = useState(false);

  async function cargar() {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/pacientes/${id}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,39,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: 560, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {loading ? (
          <>
            <div className="skeleton skeleton-line" style={{ width: '40%', height: 20 }} />
            <div className="skeleton skeleton-block" style={{ marginBottom: 14 }} />
            <div className="skeleton skeleton-block" />
          </>
        ) : errorMsg ? <p style={{ color: 'var(--rust)' }}>{errorMsg}</p> : data && (
          <>
            <div className="section-head">
              <span className="dot" /><h2>{data.paciente.nombre}</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto', fontSize: 11.5, padding: '4px 10px' }} onClick={() => setEditando(true)}>Editar</button>
            </div>

            <table className="plain" style={{ marginBottom: 18 }}>
              <tbody>
                <tr><th style={{ width: 140 }}>Teléfono</th><td>{data.paciente.telefono || '-'}</td></tr>
                <tr><th>Email</th><td>{data.paciente.email || '-'}</td></tr>
                <tr><th>DNI</th><td>{data.paciente.dni || '-'}</td></tr>
                <tr><th>Nacimiento</th><td>{data.paciente.fecha_nacimiento || '-'}</td></tr>
                <tr><th>Financiador</th><td>{data.paciente.financiador || '-'}</td></tr>
                {data.paciente.notas && <tr><th>Notas</th><td>{data.paciente.notas}</td></tr>}
              </tbody>
            </table>

            {data.entrevistas.length > 0 && (
              <>
                <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 14 }}>Entrevista de prefiltro</h2></div>
                {data.entrevistas.map(e => (
                  <table className="plain" key={e.id} style={{ marginBottom: 18 }}>
                    <tbody>
                      {e.fecha_primera_consulta && <tr><th style={{ width: 140 }}>Primera consulta</th><td>{e.fecha_primera_consulta}</td></tr>}
                      {e.deporte && <tr><th>Deporte</th><td>{e.deporte}</td></tr>}
                      {e.gimnasio && <tr><th>Gimnasio</th><td>{e.gimnasio}</td></tr>}
                      {e.como_conocio && <tr><th>Cómo nos conoció</th><td>{e.como_conocio}</td></tr>}
                      {e.motivo_consulta && <tr><th>Motivo de consulta</th><td>{e.motivo_consulta}</td></tr>}
                    </tbody>
                  </table>
                ))}
              </>
            )}

            <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 14 }}>Turnos</h2></div>
            <table className="plain" style={{ marginBottom: 18 }}>
              <thead><tr><th>Fecha</th><th>Profesional</th><th>Servicio</th><th>Estado</th></tr></thead>
              <tbody>
                {data.turnos.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'var(--mono)' }}>{t.day} {t.time}</td>
                    <td>{t.resource}</td>
                    <td>{t.service}</td>
                    <td>{ESTADO_LABEL[t.status] || t.status}</td>
                  </tr>
                ))}
                {!data.turnos.length && <tr><td colSpan={4} style={{ color: 'var(--ink-faint)' }}>Sin turnos cargados desde este sistema todavía.</td></tr>}
              </tbody>
            </table>

            <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 14 }}>Cobros</h2></div>
            <table className="plain">
              <thead><tr><th>Fecha</th><th>Profesional</th><th>Monto</th><th>Medio</th></tr></thead>
              <tbody>
                {data.cobros.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--mono)' }}>{c.fecha}</td>
                    <td>{c.profesional}</td>
                    <td>{fmtMoney(c.monto)}</td>
                    <td>{c.medio_pago}</td>
                  </tr>
                ))}
                {!data.cobros.length && <tr><td colSpan={4} style={{ color: 'var(--ink-faint)' }}>Sin cobros registrados todavía.</td></tr>}
              </tbody>
            </table>

            <div style={{ marginTop: 16 }}>
              <button className="icon-btn" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>

      {editando && data && (
        <PacienteFormModal
          inicial={data.paciente}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); cargar(); onUpdated?.(); }}
        />
      )}
    </div>
  );
}
