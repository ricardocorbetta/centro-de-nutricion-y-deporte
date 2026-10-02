'use client';

import { useEffect, useMemo, useState } from 'react';
import LoadingSkeleton from './LoadingSkeleton';
import PedirContactoModal from './PedirContactoModal';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function fmtDiaLargo(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${DOW[d.getDay()]} ${d.getDate()}`;
}

// Cola de recordatorios: junta los turnos de hoy y los próximos días que todavía no tienen
// recordatorio enviado, para que el día se arranque mandando los WhatsApp de una sola pasada
// en vez de ir turno por turno dentro de la agenda. No manda nada automático (no hay WhatsApp
// Business API contratada): abre el link de wa.me con el mensaje ya armado y deja registrado
// que se envió, para no duplicar ni perder de vista a quién falta avisar.
export default function RecordatoriosPanel({ empresaNombre }) {
  const [dias, setDias] = useState(2); // "hoy y mañana" por defecto
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [pidiendoContacto, setPidiendoContacto] = useState(null);

  const desde = todayISO();
  const hasta = addDaysISO(desde, dias - 1);

  async function cargar() {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/agenda/rango?desde=${desde}&hasta=${hasta}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTurnos((data.turnos || []).filter(t => t.id && t.status === 'booked'));
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
    turnos.forEach(t => { (m[t.day] = m[t.day] || []).push(t); });
    Object.values(m).forEach(arr => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    return m;
  }, [turnos]);
  const diasConTurnos = Object.keys(porDia).sort();

  const pendientes = turnos.filter(t => !t.recordatorio_enviado_at);
  const enviados = turnos.filter(t => t.recordatorio_enviado_at);

  async function marcarEnviado(turno, enviado) {
    setTurnos(prev => prev.map(t => t.id === turno.id ? { ...t, recordatorio_enviado_at: enviado ? new Date().toISOString() : null } : t));
    try {
      await fetch(`/api/turnos/${turno.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordatorioEnviado: enviado })
      });
    } catch (e) { /* mejor esfuerzo: si falla, el próximo refresco lo corrige */ }
  }

  function abrirWhatsApp(turno, nombre, telefono) {
    const texto = `Hola ${nombre}! Te recordamos tu turno en ${empresaNombre || 'el centro'} el ${turno.day} a las ${turno.time} con ${turno.resource} (${turno.service}). Cualquier cambio avisanos por este medio. ¡Te esperamos!`;
    const url = telefono
      ? `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  function enviar(turno) {
    if (turno.paciente_nombre || turno.paciente_telefono) {
      abrirWhatsApp(turno, turno.paciente_nombre || '', turno.paciente_telefono || '');
    } else {
      setPidiendoContacto({ onConfirm: (nombre, telefono) => abrirWhatsApp(turno, nombre, telefono) });
    }
  }

  return (
    <>
      <div className="section-head">
        <span className="dot" /><h2>Recordatorios</h2>
        <select className="pill-select" style={{ marginLeft: 'auto' }} value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={1}>Hoy</option>
          <option value={2}>Hoy y mañana</option>
          <option value={3}>Próximos 3 días</option>
          <option value={7}>Próximos 7 días</option>
        </select>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -8, marginBottom: 16 }}>
        Mandá los recordatorios de WhatsApp del día de una sola pasada: "WhatsApp" abre el chat con el mensaje ya armado,
        y "Marcar enviado" lo deja registrado acá recién después de que lo mandaste de verdad.
      </p>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}
      {loading ? <LoadingSkeleton lines={3} /> : !turnos.length ? (
        <div className="empty-state">
          <span className="icon">✅</span>
          <span className="title">No hay turnos confirmados en este rango</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span className="tag" style={{ background: pendientes.length ? 'var(--rust-soft)' : 'var(--sage-soft)', color: pendientes.length ? 'var(--rust)' : 'var(--sage)' }}>
              {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}
            </span>
            <span className="tag">{enviados.length} ya enviado{enviados.length === 1 ? '' : 's'}</span>
          </div>

          {diasConTurnos.map(dia => (
            <div key={dia} style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{fmtDiaLargo(dia)}</h3>
              <table className="plain">
                <thead><tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Teléfono</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {porDia[dia].map(t => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'var(--mono)' }}>{t.time}</td>
                      <td>{t.paciente_nombre || '—'}</td>
                      <td>{t.resource}</td>
                      <td>{t.paciente_telefono || '—'}</td>
                      <td>
                        {t.recordatorio_enviado_at
                          ? <span className="tag" style={{ background: 'var(--sage-soft)', color: 'var(--sage)' }}>Enviado</span>
                          : <span className="tag" style={{ background: 'var(--rust-soft)', color: 'var(--rust)' }}>Pendiente</span>}
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="icon-btn wa" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => enviar(t)}>WhatsApp</button>
                        {t.recordatorio_enviado_at ? (
                          <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => marcarEnviado(t, false)}>Deshacer</button>
                        ) : (
                          <button className="icon-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => marcarEnviado(t, true)}>Marcar enviado</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      <PedirContactoModal data={pidiendoContacto} onClose={() => setPidiendoContacto(null)} />
    </>
  );
}
