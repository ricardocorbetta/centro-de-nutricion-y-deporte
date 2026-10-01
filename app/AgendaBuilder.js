'use client';

import { useEffect, useMemo, useState } from 'react';
import { ESTADO_LABEL, ESTADO_CLASS } from '../lib/agendaEstados';
import AgendaLista from './AgendaLista';
import AgendaSemana from './AgendaSemana';
import AgendaCrearTurnoModal from './AgendaCrearTurnoModal';

const STEP_MIN = 10;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function timeToMinutes(t) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); }
function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function rangeSlots(start, end, step) {
  const out = [];
  for (let t = timeToMinutes(start); t < timeToMinutes(end); t += step) out.push(minutesToTime(t));
  return out;
}

const VISTAS = [
  { id: 'lista', label: 'Lista' },
  { id: 'grilla', label: 'Grilla' },
  { id: 'semana', label: 'Semana' }
];

// Componente principal de agenda: switcher Lista / Grilla / Semana (como Agenda / Calendario en drApp),
// menú rápido "+ Nuevo" (Nuevo turno / Nueva videoconsulta / Nuevo paciente) y el modal de creación
// compartido por las tres vistas.
export default function AgendaBuilder({ empresaSlug }) {
  const [vista, setVista] = useState('lista');
  const [fecha, setFecha] = useState(todayISO());
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [profesionales, setProfesionales] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [compartirMenuOpen, setCompartirMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  async function cargarProfesionales(f) {
    if (!empresaSlug) return;
    try {
      const res = await fetch(`/api/public/profesionales?empresa=${encodeURIComponent(empresaSlug)}&fecha=${f}`);
      const data = await res.json();
      if (!data.error) {
        setProfesionales(data.profesionales || []);
        if (data.empresa?.nombre) setEmpresaNombre(data.empresa.nombre);
      }
    } catch (e) {}
  }

  async function cargarTurnos(f) {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/agenda?fecha=' + f);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTurnos(data.turnos || []);
    } catch (err) {
      setErrorMsg(err.message);
      setTurnos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarProfesionales(fecha); cargarTurnos(fecha); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cambiarEstado(turno, status) {
    if (!turno.id) return;
    try {
      const res = await fetch(`/api/turnos/${turno.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      cargarTurnos(fecha);
    } catch (err) {
      alert(err.message);
    }
  }

  function abrirRecordatorio(turno) {
    const nombre = turno.paciente_nombre || window.prompt('Nombre del paciente para el recordatorio:') || '';
    const telefono = turno.paciente_telefono || window.prompt('Teléfono (con código de país, ej: 5492995551234):') || '';
    const texto = `Hola ${nombre}! Te recordamos tu turno en ${empresaNombre || 'el centro'} el ${turno.day} a las ${turno.time} con ${turno.resource} (${turno.service}). Cualquier cambio avisanos por este medio. ¡Te esperamos!`;
    const url = telefono
      ? `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  async function cobrarMP(turno) {
    if (!turno.id) return;
    try {
      const res = await fetch(`/api/turnos/${turno.id}/cobrar-mp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.open(data.link, '_blank');
    } catch (err) {
      alert(err.message);
    }
  }

  function compartirLinkReserva() {
    const origen = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origen}/reservar/${empresaSlug}`;
    const texto = `Hola! Te paso el link para que saques tu turno en ${empresaNombre || 'el centro'} cuando te quede más cómodo: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    setCompartirMenuOpen(false);
  }

  function compartirLinkPrefiltro() {
    const origen = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origen}/prefiltro/${empresaSlug}`;
    const texto = `Hola! Antes de tu primera consulta en ${empresaNombre || 'el centro'} te pedimos que completes estos datos, no te lleva más de un minuto: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    setCompartirMenuOpen(false);
  }

  function abrirModal(initial) {
    setModalInitial(initial || { fecha });
    setModalOpen(true);
    setQuickMenuOpen(false);
  }

  function nuevoTurnoRapido() { abrirModal({ fecha, modalidad: 'presencial' }); }
  function nuevaVideoconsultaRapida() { abrirModal({ fecha, modalidad: 'videollamada' }); }
  function nuevoPacienteRapido() {
    setQuickMenuOpen(false);
    const seguir = window.confirm(
      'Todavía no hay una ficha de pacientes separada: los datos del paciente se guardan junto con el turno. ' +
      '¿Querés cargar un turno nuevo para este paciente ahora?'
    );
    if (seguir) abrirModal({ fecha, modalidad: 'presencial' });
  }

  function onTurnoCreado() {
    cargarTurnos(fecha);
  }

  // ---- vista Grilla (armado por horario, clic en celda vacía) ----
  const profesDelDia = useMemo(() => profesionales.filter(p => p.horarioHoy), [profesionales]);
  const { horaMin, horaMax } = useMemo(() => {
    const activos = profesDelDia.length ? profesDelDia : profesionales;
    if (!activos.length) return { horaMin: '08:00', horaMax: '20:00' };
    let min = 24 * 60, max = 0;
    activos.forEach(p => {
      const h = p.horarioHoy;
      if (!h) return;
      min = Math.min(min, timeToMinutes(h.horaInicio));
      max = Math.max(max, timeToMinutes(h.horaFin));
    });
    if (min > max) return { horaMin: '08:00', horaMax: '20:00' };
    return { horaMin: minutesToTime(min), horaMax: minutesToTime(max) };
  }, [profesDelDia, profesionales]);
  const slots = rangeSlots(horaMin, horaMax, STEP_MIN);

  const { starts, covered } = useMemo(() => {
    const starts = {};
    const covered = new Set();
    turnos.forEach(t => {
      if (t.status === 'cancelled') return;
      const key = `${t.time}|${t.resource}`;
      starts[key] = t;
      const startMin = timeToMinutes(t.time);
      for (let m = startMin + STEP_MIN; m < startMin + (t.duration || STEP_MIN); m += STEP_MIN) {
        covered.add(`${minutesToTime(m)}|${t.resource}`);
      }
    });
    return { starts, covered };
  }, [turnos]);

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Agenda</h2>
        <span className="note">armado de turnos por profesional</span></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div className="tabbar" style={{ marginBottom: 0 }}>
          {VISTAS.map(v => (
            <button key={v.id} className={vista === v.id ? 'active' : ''} onClick={() => setVista(v.id)}>{v.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setCompartirMenuOpen(v => !v)}>Compartir por WhatsApp ▾</button>
            {compartirMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setCompartirMenuOpen(false)} />
                <div style={{
                  position: 'absolute', top: '110%', left: 0, zIndex: 41, background: 'var(--surface)',
                  border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 28px -16px rgba(21,39,42,.25)',
                  minWidth: 240, overflow: 'hidden'
                }}>
                  {[
                    ['Link para agendar un turno', compartirLinkReserva],
                    ['Entrevista de prefiltro (primera vez)', compartirLinkPrefiltro]
                  ].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                      border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13
                    }}>{label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ position: 'relative' }}>
          <button className="icon-btn primary" onClick={() => setQuickMenuOpen(v => !v)}>+ Nuevo ▾</button>
          {quickMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setQuickMenuOpen(false)} />
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 41, background: 'var(--surface)',
                border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 28px -16px rgba(21,39,42,.25)',
                minWidth: 200, overflow: 'hidden'
              }}>
                {[
                  ['Nuevo turno', nuevoTurnoRapido],
                  ['Nueva videoconsulta', nuevaVideoconsultaRapida],
                  ['Nuevo paciente', nuevoPacienteRapido]
                ].map(([label, fn]) => (
                  <button key={label} onClick={fn} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                    border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13
                  }}>{label}</button>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {vista === 'lista' && (
        <AgendaLista
          fecha={fecha} setFecha={setFecha} turnos={turnos} loading={loading} errorMsg={errorMsg}
          onCambiarEstado={cambiarEstado} onAbrirRecordatorio={abrirRecordatorio} onCobrarMP={cobrarMP}
        />
      )}

      {vista === 'semana' && (
        <AgendaSemana empresaNombre={empresaNombre} onNuevoEnDia={(f) => abrirModal({ fecha: f, modalidad: 'presencial' })} />
      )}

      {vista === 'grilla' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>

          {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

          {!profesDelDia.length && !loading ? (
            <p style={{ color: 'var(--ink-faint)' }}>Ningún profesional atiende este día de la semana.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="plain" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}></th>
                    {profesDelDia.map(p => <th key={p.nombre} style={{ textAlign: 'center' }}>{p.nombre}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {slots.map(hora => (
                    <tr key={hora}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-faint)' }}>{hora}</td>
                      {profesDelDia.map(p => {
                        const key = `${hora}|${p.nombre}`;
                        if (covered.has(key)) return null;
                        const turno = starts[key];
                        const dentroHorario = p.horarioHoy && timeToMinutes(hora) >= timeToMinutes(p.horarioHoy.horaInicio) && timeToMinutes(hora) < timeToMinutes(p.horarioHoy.horaFin);
                        if (turno) {
                          const rowSpan = Math.max(1, Math.round((turno.duration || STEP_MIN) / STEP_MIN));
                          return (
                            <td key={p.nombre} rowSpan={rowSpan} style={{
                              verticalAlign: 'top', padding: 6,
                              background: turno.status === 'cancelled' ? 'var(--surface-alt)' : 'rgba(31,122,104,0.08)',
                              border: '1px solid var(--border-strong)', borderRadius: 8
                            }}>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{turno.paciente_nombre || '(sin nombre)'}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                                {(turno.service || '').replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ')}
                              </div>
                              <div style={{ fontSize: 10.5, marginTop: 2 }}>
                                <span className={'tag' + (ESTADO_CLASS[turno.status] ? ' ' + ESTADO_CLASS[turno.status] : '')}>
                                  {ESTADO_LABEL[turno.status] || turno.status}
                                </span>
                              </div>
                              {turno.id && turno.status !== 'cancelled' && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                  <button className="icon-btn" style={{ padding: '2px 6px', fontSize: 10.5 }} onClick={() => abrirRecordatorio(turno)}>WhatsApp</button>
                                  <button className="icon-btn" style={{ padding: '2px 6px', fontSize: 10.5 }} onClick={() => cobrarMP(turno)}>Cobrar MP</button>
                                  {turno.status !== 'cumplido' && <button className="icon-btn" style={{ padding: '2px 6px', fontSize: 10.5 }} onClick={() => cambiarEstado(turno, 'cumplido')}>Atendido</button>}
                                  <button className="icon-btn" style={{ padding: '2px 6px', fontSize: 10.5 }} onClick={() => { if (window.confirm('¿Cancelar este turno?')) cambiarEstado(turno, 'cancelled'); }}>Cancelar</button>
                                </div>
                              )}
                              {!turno.id && (
                                <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 4 }}>importado de drManager</div>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={p.nombre} style={{ padding: 0, border: '1px solid var(--border-strong)', height: 26 }}>
                            {dentroHorario && (
                              <button
                                onClick={() => abrirModal({ fecha, hora, profesional: p.nombre })}
                                style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 13 }}
                                title={`Agendar con ${p.nombre} a las ${hora}`}
                              >+</button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <AgendaCrearTurnoModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        profesionales={profesionales} initial={modalInitial} onCreated={onTurnoCreado}
        empresaSlug={empresaSlug}
      />
    </>
  );
}
