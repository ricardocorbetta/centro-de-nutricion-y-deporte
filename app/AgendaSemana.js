'use client';

import { useEffect, useMemo, useState } from 'react';
import { ESTADO_LABEL, ESTADO_CLASS, ESTADOS_VALIDOS } from '../lib/agendaEstados';

const DOW_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function toISO(d) { return d.toISOString().slice(0, 10); }
function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay(); // 0=domingo
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function fmtDia(d) { return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); }

// Vista semanal tipo "Calendario" de drApp: 7 columnas (Lun a Dom), cada una con
// los turnos del día ordenados por hora. Navegación semana anterior/siguiente.
// Props: empresaNombre, onNuevoEnDia(fechaISO)
export default function AgendaSemana({ empresaNombre, onNuevoEnDia }) {
  const [anchor, setAnchor] = useState(todayISO());
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const monday = useMemo(() => mondayOf(anchor), [anchor]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const desde = toISO(dias[0]);
  const hasta = toISO(dias[6]);

  async function cargar() {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/agenda/rango?desde=${desde}&hasta=${hasta}`);
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

  useEffect(() => { cargar(); }, [desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const porDia = useMemo(() => {
    const m = {};
    dias.forEach(d => { m[toISO(d)] = []; });
    turnos.forEach(t => { if (m[t.day]) m[t.day].push(t); });
    Object.values(m).forEach(arr => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    return m;
  }, [turnos, dias]);

  async function cambiarEstado(turno, status) {
    if (!turno.id) return;
    try {
      const res = await fetch(`/api/turnos/${turno.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      cargar();
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

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="icon-btn" onClick={() => setAnchor(toISO(addDays(monday, -7)))}>◀ Semana anterior</button>
        <button className="icon-btn" onClick={() => setAnchor(todayISO())}>Esta semana</button>
        <button className="icon-btn" onClick={() => setAnchor(toISO(addDays(monday, 7)))}>Semana siguiente ▶</button>
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtDia(dias[0])} – {fmtDia(dias[6])}</span>
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}
      {loading && <p style={{ color: 'var(--ink-faint)' }}>Cargando…</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: 10, overflowX: 'auto' }}>
        {dias.map(d => {
          const iso = toISO(d);
          const esHoy = iso === todayISO();
          const dow = d.getDay();
          const items = porDia[iso] || [];
          return (
            <div key={iso} style={{
              border: '1px solid var(--border-strong)', borderRadius: 10, padding: 8,
              background: esHoy ? 'rgba(31,122,104,0.06)' : 'transparent', minHeight: 160
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)' }}>{DOW_CORTO[dow]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtDia(d)}</div>
                </div>
                <button className="icon-btn" style={{ padding: '2px 7px', fontSize: 13 }} title="Nuevo turno este día" onClick={() => onNuevoEnDia(iso)}>+</button>
              </div>

              {items.map((t, idx) => (
                <div key={t.id || `imp-${idx}`} style={{
                  background: t.status === 'cancelled' ? 'var(--surface-alt)' : 'rgba(31,122,104,0.08)',
                  border: '1px solid var(--border-strong)', borderRadius: 8, padding: '5px 7px', marginBottom: 6, fontSize: 11.5
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{t.time}</div>
                  <div style={{ fontWeight: 600 }}>{t.paciente_nombre || '(sin nombre)'}</div>
                  <div style={{ color: 'var(--ink-soft)' }}>{t.resource}</div>
                  <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    {t.id ? (
                      <select value={t.status} onChange={e => cambiarEstado(t, e.target.value)} style={{ fontSize: 10.5, padding: '1px 2px' }}>
                        {ESTADOS_VALIDOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                      </select>
                    ) : (
                      <span className={'tag' + (ESTADO_CLASS[t.status] ? ' ' + ESTADO_CLASS[t.status] : '')} style={{ fontSize: 10 }}>
                        {ESTADO_LABEL[t.status] || t.status}
                      </span>
                    )}
                    {t.id && (
                      <button className="icon-btn" style={{ padding: '1px 5px', fontSize: 10 }} onClick={() => abrirRecordatorio(t)}>WA</button>
                    )}
                  </div>
                </div>
              ))}
              {!items.length && <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Sin turnos</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
