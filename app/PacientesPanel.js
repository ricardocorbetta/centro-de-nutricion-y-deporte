'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/stats';
import { ESTADO_LABEL } from '../lib/agendaEstados';
import ConfirmModal from './ConfirmModal';
import LoadingSkeleton from './LoadingSkeleton';

const TIPO_ARCHIVO = [
  { value: 'plan', label: 'Plan alimentario' },
  { value: 'bioimpedancia', label: 'Bioimpedancia' },
  { value: 'antropometria', label: 'Antropometría' }
];
const TIPO_ARCHIVO_LABEL = Object.fromEntries(TIPO_ARCHIVO.map(t => [t.value, t.label]));

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
export default function PacientesPanel({ statsSlot, empresaSlug }) {
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
        <FichaPacienteModal id={seleccionado} empresaSlug={empresaSlug} onClose={() => setSeleccionado(null)} onUpdated={() => cargar(query)} />
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

function FichaPacienteModal({ id, empresaSlug, onClose, onUpdated }) {
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

            <AccesoPortal pacienteId={id} empresaSlug={empresaSlug} pacienteNombre={data.paciente.nombre} pacienteTelefono={data.paciente.telefono} />

            <ArchivosPaciente pacienteId={id} />

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

// Portal de pacientes (Sector A): acceso (usuario/clave) y vigencia (18 meses desde la última consulta cumplida).
function AccesoPortal({ pacienteId, empresaSlug, pacienteNombre, pacienteTelefono }) {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [credenciales, setCredenciales] = useState(null); // { username, password } recién generadas
  const [errorMsg, setErrorMsg] = useState('');

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/portal`);
      const data = await res.json();
      if (!data.error) setEstado(data);
    } catch (e) {} finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generar() {
    setGenerando(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/portal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCredenciales(data);
      cargar();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGenerando(false);
    }
  }

  const link = empresaSlug && typeof window !== 'undefined' ? `${window.location.origin}/portal/${empresaSlug}` : '';
  const mensajeWhatsapp = credenciales ? encodeURIComponent(
    `Hola ${pacienteNombre.split(' ')[0]}! Ya tenés acceso a tu portal de CND, donde vas a encontrar tus planes y evaluaciones.\n\n` +
    `Entrá acá: ${link}\nUsuario: ${credenciales.username}\nClave: ${credenciales.password}`
  ) : '';
  const telWhatsapp = (pacienteTelefono || '').replace(/\D/g, '');

  return (
    <>
      <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 14 }}>Portal del paciente</h2></div>
      {loading ? <LoadingSkeleton lines={2} /> : (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 18 }}>
          {estado?.tieneAcceso ? (
            <>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                Usuario: <b style={{ fontFamily: 'var(--mono)' }}>{estado.username}</b>
              </div>
              <div style={{ fontSize: 12.5, color: estado.vigente ? 'var(--primary)' : 'var(--rust)', marginBottom: 10 }}>
                {estado.ultimaConsulta
                  ? (estado.vigente ? `Vigente hasta ${estado.venceEl} (18 meses desde la última consulta).` : `Vencido desde el ${estado.venceEl}.`)
                  : 'Todavía no tiene consultas cumplidas registradas — sin acceso a archivos hasta la primera.'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>Este paciente todavía no tiene acceso al portal.</div>
          )}

          {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 12.5, marginBottom: 8 }}>{errorMsg}</p>}

          {!credenciales ? (
            <button className="icon-btn primary" disabled={generando} onClick={generar}>
              {generando ? 'Generando…' : estado?.tieneAcceso ? 'Regenerar clave' : 'Generar acceso'}
            </button>
          ) : (
            <div style={{ background: 'var(--surface-alt)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5 }}>
              <div style={{ marginBottom: 6 }}>Usuario: <b style={{ fontFamily: 'var(--mono)' }}>{credenciales.username}</b> · Clave: <b style={{ fontFamily: 'var(--mono)' }}>{credenciales.password}</b></div>
              <div style={{ color: 'var(--ink-faint)', marginBottom: 8 }}>Guardala ahora — no se vuelve a mostrar. Pasásela al paciente por WhatsApp:</div>
              {telWhatsapp ? (
                <a className="icon-btn primary" href={`https://wa.me/${telWhatsapp}?text=${mensajeWhatsapp}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
              ) : (
                <span style={{ color: 'var(--ink-faint)' }}>Este paciente no tiene teléfono cargado — copiá usuario y clave manualmente.</span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Archivos del paciente (planes en PDF, bioimpedancia, antropometría) — los carga el profesional
// y quedan disponibles para el paciente en su portal mientras su acceso esté vigente.
function ArchivosPaciente({ pacienteId }) {
  const [archivos, setArchivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  const [tipo, setTipo] = useState('plan');
  const [categoria, setCategoria] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [file, setFile] = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/archivos`);
      const data = await res.json();
      if (!data.error) setArchivos(data.archivos || []);
    } catch (e) {} finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function subir() {
    if (!file) { setErrorMsg('Elegí un archivo (PDF).'); return; }
    setSubiendo(true);
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('tipo', tipo);
      form.append('categoria', categoria);
      form.append('nombre', categoria || file.name);
      form.append('fecha', fecha);
      const res = await fetch(`/api/pacientes/${pacienteId}/archivos`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCategoria(''); setFile(null);
      cargar();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  function borrar(archivo) {
    setConfirmando({
      mensaje: `¿Quitar "${archivo.categoria || archivo.nombre}" de los archivos del paciente?`, destructivo: true, textoConfirmar: 'Quitar',
      onConfirm: async () => {
        await fetch(`/api/pacientes/${pacienteId}/archivos/${archivo.id}`, { method: 'DELETE' });
        cargar();
      }
    });
  }

  return (
    <>
      <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 14 }}>Archivos (planes y evaluaciones)</h2></div>

      {loading ? <LoadingSkeleton lines={2} /> : (
        <table className="plain" style={{ marginBottom: 12 }}>
          <thead><tr><th>Tipo</th><th>Nombre</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            {archivos.map(a => (
              <tr key={a.id}>
                <td><span className="tag">{TIPO_ARCHIVO_LABEL[a.tipo] || a.tipo}</span></td>
                <td>{a.categoria || a.nombre}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{a.fecha}</td>
                <td><button className="icon-btn" onClick={() => borrar(a)}>Quitar</button></td>
              </tr>
            ))}
            {!archivos.length && <tr><td colSpan={4} style={{ color: 'var(--ink-faint)' }}>Sin archivos cargados todavía.</td></tr>}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <select className="pill-select" value={tipo} onChange={e => setTipo(e.target.value)}>
          {TIPO_ARCHIVO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input placeholder="Nombre (ej: Plan de pretemporada)" value={categoria} onChange={e => setCategoria(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button className="icon-btn primary" disabled={subiendo} onClick={subir}>{subiendo ? 'Subiendo…' : 'Subir'}</button>
      </div>
      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 12.5, marginTop: -10 }}>{errorMsg}</p>}

      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}
