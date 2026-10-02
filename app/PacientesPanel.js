'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/stats';
import { ESTADO_LABEL } from '../lib/agendaEstados';
import ConfirmModal from './ConfirmModal';
import LoadingSkeleton from './LoadingSkeleton';
import CobroTurnoModal from './CobroTurnoModal';
import EvolucionChart from './EvolucionChart';

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

  // La ficha del paciente ahora reemplaza el listado en el mismo lugar de la pantalla (con un
  // botón "Volver") en vez de abrirse como un modal flotante encima de todo.
  if (seleccionado) {
    return (
      <FichaPaciente
        id={seleccionado} empresaSlug={empresaSlug}
        onBack={() => setSeleccionado(null)}
        onUpdated={() => cargar(query)}
      />
    );
  }

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

// Ficha de un paciente — reemplaza el listado en el mismo lugar de la pantalla (ver arriba),
// con un botón "Volver" en vez de ser un modal flotante.
function FichaPaciente({ id, empresaSlug, onBack, onUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [editando, setEditando] = useState(false);
  const [cobrandoTurno, setCobrandoTurno] = useState(null);

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
    <>
      <div style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={onBack}>← Volver al listado</button>
      </div>

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

            <EvolucionPaciente pacienteId={id} />

            <PlanNutricional pacienteId={id} />

            <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 14 }}>Turnos</h2></div>
            <table className="plain" style={{ marginBottom: 18 }}>
              <thead><tr><th>Fecha</th><th>Profesional</th><th>Servicio</th><th>Estado</th><th>Saldo</th><th></th></tr></thead>
              <tbody>
                {data.turnos.map(t => {
                  const cobrado = data.cobros.filter(c => c.turno_id === t.id).reduce((acc, c) => acc + Number(c.monto || 0), 0);
                  const saldo = t.precio_total != null ? Math.max(0, t.precio_total - cobrado) : null;
                  return (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'var(--mono)' }}>{t.day} {t.time}</td>
                      <td>{t.resource}</td>
                      <td>{t.service}</td>
                      <td>{ESTADO_LABEL[t.status] || t.status}</td>
                      <td style={{ color: saldo > 0 ? 'var(--rust)' : 'var(--ink-faint)' }}>{saldo !== null ? fmtMoney(saldo) : '—'}</td>
                      <td>
                        {t.status !== 'cancelled' && (
                          <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setCobrandoTurno(t)}>Cobrar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!data.turnos.length && <tr><td colSpan={6} style={{ color: 'var(--ink-faint)' }}>Sin turnos cargados desde este sistema todavía.</td></tr>}
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
              <button className="icon-btn" onClick={onBack}>← Volver al listado</button>
            </div>

            <CobroTurnoModal turno={cobrandoTurno} onClose={() => setCobrandoTurno(null)} onChanged={cargar} />
          </>
        )}

      {editando && data && (
        <PacienteFormModal
          inicial={data.paciente}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); cargar(); onUpdated?.(); }}
        />
      )}
    </>
  );
}

// Portal de pacientes (Sector A): acceso (usuario/clave) y vigencia (18 meses desde la última consulta cumplida).
function AccesoPortal({ pacienteId, empresaSlug, pacienteNombre, pacienteTelefono }) {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [credenciales, setCredenciales] = useState(null); // { username, password } recién generadas
  const [errorMsg, setErrorMsg] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function copiarCredenciales() {
    try {
      await navigator.clipboard.writeText(`Usuario: ${credenciales.username} · Clave: ${credenciales.password}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {}
  }

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
              <div style={{ color: 'var(--ink-faint)', marginBottom: 8 }}>Guardala ahora — no se vuelve a mostrar. Copiala o pasásela al paciente por WhatsApp:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="icon-btn" onClick={copiarCredenciales}>{copiado ? 'Copiado ✓' : 'Copiar usuario y clave'}</button>
                {telWhatsapp ? (
                  <a className="icon-btn primary" href={`https://wa.me/${telWhatsapp}?text=${mensajeWhatsapp}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
                ) : (
                  <span style={{ color: 'var(--ink-faint)', alignSelf: 'center' }}>Este paciente no tiene teléfono cargado.</span>
                )}
              </div>
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

// Evolución del paciente: historial de peso/medidas con gráfico, visible acá y en el portal del
// paciente. Es el reemplazo de "subir un PDF de antropometría" por datos reales y comparables.
function EvolucionPaciente({ pacienteId }) {
  const [mediciones, setMediciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [metrica, setMetrica] = useState('peso');
  const [confirmando, setConfirmando] = useState(null);

  const vacio = { fecha: todayISO(), peso: '', altura: '', perimetroCintura: '', perimetroCadera: '', pctGrasa: '', pctMusculo: '', notas: '' };
  const [form, setForm] = useState(vacio);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/mediciones`);
      const data = await res.json();
      if (!data.error) setMediciones(data.mediciones || []);
    } catch (e) {} finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  function campo(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function guardar() {
    setGuardando(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/mediciones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setForm(vacio);
      setAbierto(false);
      cargar();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function borrar(m) {
    setConfirmando({
      mensaje: `¿Quitar el control del ${m.fecha}?`, destructivo: true, textoConfirmar: 'Quitar',
      onConfirm: async () => {
        await fetch(`/api/pacientes/${pacienteId}/mediciones/${m.id}`, { method: 'DELETE' });
        cargar();
      }
    });
  }

  const METRICAS = [
    { value: 'peso', label: 'Peso', unidad: ' kg' },
    { value: 'pct_grasa', label: '% Grasa', unidad: '%' },
    { value: 'pct_musculo', label: '% Músculo', unidad: '%' },
    { value: 'perimetro_cintura', label: 'Cintura', unidad: ' cm' },
    { value: 'perimetro_cadera', label: 'Cadera', unidad: ' cm' }
  ];
  const metricaInfo = METRICAS.find(m => m.value === metrica);
  const puntos = mediciones.map(m => ({ fecha: m.fecha, y: m[metrica] !== null ? Number(m[metrica]) : null }));
  const conDatos = METRICAS.filter(m => mediciones.some(med => med[m.value] !== null));

  return (
    <>
      <div className="section-head">
        <span className="dot" /><h2 style={{ fontSize: 14 }}>Evolución</h2>
        <button className="icon-btn primary" style={{ marginLeft: 'auto', fontSize: 11.5, padding: '4px 10px' }} onClick={() => setAbierto(v => !v)}>
          {abierto ? 'Cancelar' : '+ Cargar control'}
        </button>
      </div>

      {loading ? <LoadingSkeleton lines={2} /> : mediciones.length === 0 && !abierto ? (
        <div className="empty-state" style={{ padding: '16px 10px', marginBottom: 14 }}>
          <span className="icon">📈</span>
          <span className="title">Sin controles cargados todavía</span>
          <span className="hint">Cargá el peso y las medidas en cada consulta para ver la evolución acá y en el portal del paciente.</span>
        </div>
      ) : mediciones.length > 0 && (
        <>
          {conDatos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {conDatos.map(m => (
                <button key={m.value} className={'icon-btn' + (metrica === m.value ? ' primary' : '')}
                  style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => setMetrica(m.value)}>{m.label}</button>
              ))}
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <EvolucionChart points={puntos} unidad={metricaInfo.unidad} />
          </div>
          <table className="plain" style={{ marginBottom: 14 }}>
            <thead><tr><th>Fecha</th><th>Peso</th><th>% Grasa</th><th>% Músculo</th><th>Cintura</th><th>Cadera</th><th>Notas</th><th></th></tr></thead>
            <tbody>
              {[...mediciones].reverse().map(m => (
                <tr key={m.id}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{m.fecha}</td>
                  <td>{m.peso ?? '-'}</td>
                  <td>{m.pct_grasa ?? '-'}</td>
                  <td>{m.pct_musculo ?? '-'}</td>
                  <td>{m.perimetro_cintura ?? '-'}</td>
                  <td>{m.perimetro_cadera ?? '-'}</td>
                  <td style={{ fontSize: 12 }}>{m.notas || '-'}</td>
                  <td><button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => borrar(m)}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {abierto && (
        <div className="manual-grid" style={{ marginBottom: 18 }}>
          <div className="field"><label>Fecha</label><input type="date" value={form.fecha} onChange={e => campo('fecha', e.target.value)} /></div>
          <div className="field"><label>Peso (kg)</label><input type="number" step="0.1" value={form.peso} onChange={e => campo('peso', e.target.value)} /></div>
          <div className="field"><label>Altura (cm)</label><input type="number" step="0.1" value={form.altura} onChange={e => campo('altura', e.target.value)} /></div>
          <div className="field"><label>% Grasa</label><input type="number" step="0.1" value={form.pctGrasa} onChange={e => campo('pctGrasa', e.target.value)} /></div>
          <div className="field"><label>% Músculo</label><input type="number" step="0.1" value={form.pctMusculo} onChange={e => campo('pctMusculo', e.target.value)} /></div>
          <div className="field"><label>Cintura (cm)</label><input type="number" step="0.1" value={form.perimetroCintura} onChange={e => campo('perimetroCintura', e.target.value)} /></div>
          <div className="field"><label>Cadera (cm)</label><input type="number" step="0.1" value={form.perimetroCadera} onChange={e => campo('perimetroCadera', e.target.value)} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Notas</label><input value={form.notas} onChange={e => campo('notas', e.target.value)} /></div>
          {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 12.5, gridColumn: '1 / -1' }}>{errorMsg}</p>}
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="icon-btn primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar control'}</button>
          </div>
        </div>
      )}

      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}

// Plan nutricional estructurado: reemplaza el PDF suelto por un plan armado con secciones
// (ej. Desayuno, Almuerzo) que el paciente ve ordenado en su portal.
function PlanNutricional({ pacienteId }) {
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [editor, setEditor] = useState(null); // null = cerrado, {} = nuevo, plan = editando
  const [confirmando, setConfirmando] = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/planes`);
      const data = await res.json();
      if (!data.error) setPlanes(data.planes || []);
    } catch (e) {} finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  function activar(plan) {
    setConfirmando({
      mensaje: `¿Poner "${plan.titulo}" como el plan activo del paciente? El paciente lo va a ver en su portal.`, textoConfirmar: 'Activar',
      onConfirm: async () => {
        await fetch(`/api/pacientes/${pacienteId}/planes/${plan.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: true })
        });
        cargar();
      }
    });
  }

  function borrar(plan) {
    setConfirmando({
      mensaje: `¿Borrar el plan "${plan.titulo}"?`, destructivo: true, textoConfirmar: 'Borrar',
      onConfirm: async () => {
        await fetch(`/api/pacientes/${pacienteId}/planes/${plan.id}`, { method: 'DELETE' });
        cargar();
      }
    });
  }

  return (
    <>
      <div className="section-head">
        <span className="dot" /><h2 style={{ fontSize: 14 }}>Plan nutricional</h2>
        <button className="icon-btn primary" style={{ marginLeft: 'auto', fontSize: 11.5, padding: '4px 10px' }} onClick={() => setEditor({})}>+ Nuevo plan</button>
      </div>

      {loading ? <LoadingSkeleton lines={2} /> : planes.length === 0 ? (
        <div className="empty-state" style={{ padding: '16px 10px', marginBottom: 14 }}>
          <span className="icon">🥗</span>
          <span className="title">Sin plan cargado todavía</span>
          <span className="hint">Armá un plan con secciones (Desayuno, Almuerzo…) y el paciente lo va a ver ordenado en su portal, sin descargar nada.</span>
        </div>
      ) : (
        <table className="plain" style={{ marginBottom: 18 }}>
          <thead><tr><th>Plan</th><th>Fecha</th><th>Profesional</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {planes.map(p => (
              <tr key={p.id}>
                <td>{p.titulo}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{p.fecha}</td>
                <td>{p.profesional || '-'}</td>
                <td>{p.activo ? <span className="tag" style={{ background: 'var(--sage-soft)', color: 'var(--sage)' }}>Activo (visible al paciente)</span> : <span className="tag">Archivado</span>}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setEditor(p)}>Editar</button>
                  {!p.activo && <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => activar(p)}>Activar</button>}
                  <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => borrar(p)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editor && (
        <PlanEditorModal
          pacienteId={pacienteId}
          plan={editor.id ? editor : null}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); cargar(); }}
        />
      )}
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}

// Modal para armar/editar un plan: título + secciones libres (nombre + texto de items), para no
// forzar una estructura rígida de "comida/alimento" que no se ajuste a cómo arma el plan cada profesional.
function PlanEditorModal({ pacienteId, plan, onClose, onSaved }) {
  const [titulo, setTitulo] = useState(plan?.titulo || 'Plan nutricional');
  const [notasGenerales, setNotasGenerales] = useState(plan?.notas_generales || '');
  const [secciones, setSecciones] = useState(plan?.secciones?.length ? plan.secciones : [{ nombre: 'Desayuno', contenido: '' }]);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  function cambiarSeccion(i, key, value) {
    setSecciones(s => s.map((sec, idx) => idx === i ? { ...sec, [key]: value } : sec));
  }
  function agregarSeccion() { setSecciones(s => [...s, { nombre: '', contenido: '' }]); }
  function quitarSeccion(i) { setSecciones(s => s.filter((_, idx) => idx !== i)); }

  async function guardar() {
    if (!titulo.trim()) { setErrorMsg('Ponele un título al plan.'); return; }
    setGuardando(true);
    setErrorMsg('');
    try {
      const body = { titulo, notasGenerales, secciones: secciones.filter(s => s.nombre.trim() || s.contenido.trim()) };
      const url = plan ? `/api/pacientes/${pacienteId}/planes/${plan.id}` : `/api/pacientes/${pacienteId}/planes`;
      const method = plan ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,39,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto', zIndex: 60 }}>
      <div className="card" style={{ width: '100%', maxWidth: 620 }}>
        <div className="section-head"><span className="dot" /><h2>{plan ? 'Editar plan' : 'Nuevo plan nutricional'}</h2></div>

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Título</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="ej: Plan Octubre 2026" />
        </div>

        {secciones.map((sec, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input placeholder="Nombre de la sección (ej: Desayuno)" value={sec.nombre} onChange={e => cambiarSeccion(i, 'nombre', e.target.value)} style={{ flex: 1 }} />
              <button className="icon-btn" style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => quitarSeccion(i)}>Quitar</button>
            </div>
            <textarea rows={3} placeholder="Detalle (alimentos, cantidades, indicaciones)" value={sec.contenido}
              onChange={e => cambiarSeccion(i, 'contenido', e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        ))}
        <button className="icon-btn" style={{ marginBottom: 14 }} onClick={agregarSeccion}>+ Agregar sección</button>

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Notas generales (opcional)</label>
          <textarea rows={2} value={notasGenerales} onChange={e => setNotasGenerales(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
        </div>

        {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 12.5 }}>{errorMsg}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
          <button className="icon-btn primary" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar plan'}</button>
        </div>
      </div>
    </div>
  );
}
