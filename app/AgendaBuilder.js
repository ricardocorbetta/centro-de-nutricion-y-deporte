'use client';

import { useEffect, useMemo, useState } from 'react';

const STEP_MIN = 10;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDaysISO(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function fechaLarga(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}
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

const ESTADO_LABEL = { booked: 'Reservado', cumplido: 'Atendido', cancelled: 'Cancelado', noshow: 'Ausente' };
const ESTADO_CLASS = { booked: '', cumplido: 'gold', cancelled: 'rust', noshow: 'rust' };

export default function AgendaBuilder({ empresaSlug }) {
  const [fecha, setFecha] = useState(todayISO());
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [profesionales, setProfesionales] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [formOpen, setFormOpen] = useState(null); // { profesional, hora } | null
  const [form, setForm] = useState({ servicio: '', pacienteNombre: '', pacienteTelefono: '', financiador: 'Particular' });
  const [saving, setSaving] = useState(false);

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

  // horarioHoy ya viene resuelto por el servidor (respeta excepciones puntuales por sobre el horario semanal)
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

  // turno que empieza en cada (hora, profesional); y set de celdas cubiertas por un turno más largo
  const { starts, covered } = useMemo(() => {
    const starts = {}; // `${hora}|${prof}` -> turno
    const covered = new Set(); // `${hora}|${prof}`
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

  function abrirForm(profesional, hora) {
    setForm({ servicio: '', pacienteNombre: '', pacienteTelefono: '', financiador: 'Particular' });
    setFormOpen({ profesional, hora });
  }

  async function confirmarTurno() {
    const profData = profesionales.find(p => p.nombre === formOpen.profesional);
    const svc = profData?.servicios.find(s => s.nombre === form.servicio);
    if (!svc || !form.pacienteNombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha, hora: formOpen.hora, profesional: formOpen.profesional,
          servicio: svc.nombre, duracion: svc.duracion,
          pacienteNombre: form.pacienteNombre, pacienteTelefono: form.pacienteTelefono,
          financiador: form.financiador
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFormOpen(null);
      cargarTurnos(fecha);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

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

  const profData = formOpen ? profesionales.find(p => p.nombre === formOpen.profesional) : null;

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Agenda</h2>
        <span className="note">armado de turnos por profesional</span></div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="icon-btn" onClick={() => setFecha(addDaysISO(fecha, -1))}>◀</button>
        <button className={'icon-btn' + (fecha === todayISO() ? ' primary' : '')} onClick={() => setFecha(todayISO())}>Hoy</button>
        <button className={'icon-btn' + (fecha === addDaysISO(todayISO(), 1) ? ' primary' : '')} onClick={() => setFecha(addDaysISO(todayISO(), 1))}>Mañana</button>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <button className="icon-btn" onClick={() => setFecha(addDaysISO(fecha, 1))}>▶</button>
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', textTransform: 'capitalize' }}>{fechaLarga(fecha)}</span>
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
                            onClick={() => abrirForm(p.nombre, hora)}
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

      {formOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(21,39,42,0.45)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 50
        }} onClick={() => setFormOpen(null)}>
          <div className="card" style={{ width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="section-head"><span className="dot" /><h2>Nuevo turno</h2></div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -6 }}>
              {formOpen.profesional} · {fecha} a las {formOpen.hora}
            </p>
            <div className="manual-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label>Servicio</label>
                <select value={form.servicio} onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))}>
                  <option value="">Elegí un servicio</option>
                  {profData?.servicios.map(s => (
                    <option key={s.nombre} value={s.nombre}>
                      {s.nombre.replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ')} ({s.duracion} min)
                    </option>
                  ))}
                </select>
              </div>
              <div className="field"><label>Paciente</label>
                <input value={form.pacienteNombre} onChange={e => setForm(f => ({ ...f, pacienteNombre: e.target.value }))} />
              </div>
              <div className="field"><label>Teléfono (opcional)</label>
                <input value={form.pacienteTelefono} onChange={e => setForm(f => ({ ...f, pacienteTelefono: e.target.value }))} />
              </div>
              <div className="field"><label>Financiador</label>
                <input value={form.financiador} onChange={e => setForm(f => ({ ...f, financiador: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="icon-btn primary" disabled={saving || !form.servicio || !form.pacienteNombre.trim()} onClick={confirmarTurno}>
                {saving ? 'Guardando…' : 'Guardar turno'}
              </button>
              <button className="icon-btn" onClick={() => setFormOpen(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
