'use client';

import { useEffect, useMemo, useState } from 'react';
import { ESTADO_LABEL, ESTADO_CLASS, ESTADO_TABS, ESTADOS_VALIDOS } from '../lib/agendaEstados';

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

// Vista de lista tipo drApp: tabs por estado + tabla con un dropdown de estado por fila.
// Props: fecha, setFecha, turnos, loading, errorMsg, empresaNombre, onCambiarEstado, onAbrirRecordatorio
export default function AgendaLista({ fecha, setFecha, turnos, loading, errorMsg, onCambiarEstado, onAbrirRecordatorio }) {
  const [tab, setTab] = useState('todos');

  const counts = useMemo(() => {
    const c = { todos: turnos.length };
    ESTADOS_VALIDOS.forEach(e => { c[e] = turnos.filter(t => t.status === e).length; });
    return c;
  }, [turnos]);

  const filtrados = useMemo(() => {
    const arr = tab === 'todos' ? turnos : turnos.filter(t => t.status === tab);
    return [...arr].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [turnos, tab]);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="icon-btn" onClick={() => setFecha(addDaysISO(fecha, -1))}>◀</button>
        <button className={'icon-btn' + (fecha === todayISO() ? ' primary' : '')} onClick={() => setFecha(todayISO())}>Hoy</button>
        <button className={'icon-btn' + (fecha === addDaysISO(todayISO(), 1) ? ' primary' : '')} onClick={() => setFecha(addDaysISO(todayISO(), 1))}>Mañana</button>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <button className="icon-btn" onClick={() => setFecha(addDaysISO(fecha, 1))}>▶</button>
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', textTransform: 'capitalize' }}>{fechaLarga(fecha)}</span>
      </div>

      <div className="tabbar" style={{ flexWrap: 'wrap' }}>
        {ESTADO_TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label} {counts[t.id] ? <span style={{ opacity: .6 }}>({counts[t.id]})</span> : ''}
          </button>
        ))}
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      <table className="plain" style={{ marginTop: 10 }}>
        <thead>
          <tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Servicio</th><th>Modalidad</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          {filtrados.map((t, idx) => (
            <tr key={t.id || `imp-${idx}`}>
              <td style={{ fontFamily: 'var(--mono)' }}>{t.time}</td>
              <td>{t.paciente_nombre || '-'}</td>
              <td>{t.resource}</td>
              <td>{(t.service || '').replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ')}</td>
              <td>{t.modalidad === 'videollamada' ? 'Videollamada' : 'Presencial'}</td>
              <td>
                {t.id ? (
                  <select value={t.status} onChange={e => onCambiarEstado(t, e.target.value)} style={{ fontSize: 12 }}>
                    {ESTADOS_VALIDOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                  </select>
                ) : (
                  <span className={'tag' + (ESTADO_CLASS[t.status] ? ' ' + ESTADO_CLASS[t.status] : '')}>
                    {ESTADO_LABEL[t.status] || t.status}
                  </span>
                )}
              </td>
              <td>
                {t.id ? (
                  <button className="icon-btn" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => onAbrirRecordatorio(t)}>WhatsApp</button>
                ) : (
                  <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>importado</span>
                )}
              </td>
            </tr>
          ))}
          {!filtrados.length && !loading && (
            <tr><td colSpan={7} style={{ color: 'var(--ink-faint)' }}>No hay turnos en esta categoría para el día elegido.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
