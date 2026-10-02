'use client';

import { useEffect, useMemo, useState } from 'react';
import { ESTADO_LABEL, ESTADO_CLASS, ESTADOS_VALIDOS } from '../lib/agendaEstados';
import LoadingSkeleton from './LoadingSkeleton';
import CobroTurnoModal from './CobroTurnoModal';
import PedirContactoModal from './PedirContactoModal';
import ConfirmModal from './ConfirmModal';

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

// Una tarjeta de turno, reusada tanto en la grilla de 7 columnas (desktop) como en la
// lista de un solo día (mobile) — mismo contenido, el tamaño lo ajusta el CSS según pantalla.
export function TurnoCard({ t, onCambiarEstado, onCobrar, onRecordatorio }) {
  return (
    <div className={'turno-card' + (t.status === 'cancelled' ? ' cancelado' : '')}>
      <div className="time">{t.time}</div>
      <div className="nombre">{t.paciente_nombre || '(sin nombre)'}</div>
      <div className="prof">{t.resource}</div>
      {t.id ? (
        <div className="estado-row">
          <select value={t.status} onChange={e => onCambiarEstado(t, e.target.value)}>
            {ESTADOS_VALIDOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </select>
        </div>
      ) : (
        <div className="estado-row">
          <span className={'tag' + (ESTADO_CLASS[t.status] ? ' ' + ESTADO_CLASS[t.status] : '')}>
            {ESTADO_LABEL[t.status] || t.status}
          </span>
        </div>
      )}
      {t.id && (
        <div className="acciones">
          {t.status !== 'cancelled' && (
            <button className="icon-btn primary" onClick={() => onCobrar(t)}>Cobrar</button>
          )}
          <button className="icon-btn wa" title="Recordatorio por WhatsApp" onClick={() => onRecordatorio(t)}>WA</button>
        </div>
      )}
    </div>
  );
}

// Vista semanal tipo "Calendario" de drApp: 7 columnas (Lun a Dom) en desktop; en pantallas
// chicas, en vez de apretar 7 columnas se muestra un selector de día (pills) y la lista de
// turnos de ese día sola, a todo el ancho — igual de legible que la vista Lista.
// Props: empresaNombre, onNuevoEnDia(fechaISO)
export default function AgendaSemana({ empresaNombre, onNuevoEnDia }) {
  const [anchor, setAnchor] = useState(todayISO());
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [cobrandoTurno, setCobrandoTurno] = useState(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(todayISO());
  const [confirmando, setConfirmando] = useState(null);
  const [pidiendoContacto, setPidiendoContacto] = useState(null);

  const monday = useMemo(() => mondayOf(anchor), [anchor]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const desde = toISO(dias[0]);
  const hasta = toISO(dias[6]);

  // Si la semana mostrada cambia, el día seleccionado (para la vista mobile) pasa a ser
  // hoy si cae en esta semana, o si no el lunes de la semana.
  useEffect(() => {
    setDiaSeleccionado(prev => (prev >= desde && prev <= hasta) ? prev : desde);
  }, [desde, hasta]);

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

  async function aplicarEstado(turno, status) {
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

  // Cancelar un turno (o revertir una cancelación, que vuelve a ocupar el horario) se confirma
  // siempre, acá y en AgendaLista — son los dos únicos cambios de estado con consecuencias
  // difíciles de deshacer a simple vista.
  function cambiarEstado(turno, status) {
    if (!turno.id) return;
    if (status === 'cancelled') {
      setConfirmando({
        mensaje: `¿Cancelar el turno de ${turno.paciente_nombre || 'este paciente'} (${turno.day} ${turno.time})?`,
        destructivo: true, textoConfirmar: 'Cancelar turno',
        onConfirm: () => aplicarEstado(turno, status)
      });
    } else if (turno.status === 'cancelled') {
      setConfirmando({
        mensaje: `¿Reactivar este turno cancelado para ${turno.day} ${turno.time}? Vuelve a ocupar ese horario.`,
        textoConfirmar: 'Reactivar',
        onConfirm: () => aplicarEstado(turno, status)
      });
    } else {
      aplicarEstado(turno, status);
    }
  }

  function abrirRecordatorio(turno) {
    if (turno.paciente_nombre || turno.paciente_telefono) {
      enviarWhatsApp(turno, turno.paciente_nombre || '', turno.paciente_telefono || '');
    } else {
      setPidiendoContacto({ onConfirm: (nombre, telefono) => enviarWhatsApp(turno, nombre, telefono) });
    }
  }

  function enviarWhatsApp(turno, nombre, telefono) {
    const texto = `Hola ${nombre}! Te recordamos tu turno en ${empresaNombre || 'el centro'} el ${turno.day} a las ${turno.time} con ${turno.resource} (${turno.service}). Cualquier cambio avisanos por este medio. ¡Te esperamos!`;
    const url = telefono
      ? `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  const itemsDiaSeleccionado = porDia[diaSeleccionado] || [];

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="icon-btn" onClick={() => setAnchor(toISO(addDays(monday, -7)))}>◀ Semana anterior</button>
        <button className="icon-btn" onClick={() => setAnchor(todayISO())}>Esta semana</button>
        <button className="icon-btn" onClick={() => setAnchor(toISO(addDays(monday, 7)))}>Semana siguiente ▶</button>
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtDia(dias[0])} – {fmtDia(dias[6])}</span>
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}
      {loading && <LoadingSkeleton lines={1} widths={['30%']} />}

      {/* Selector de día — solo visible en pantallas chicas (ver globals.css) */}
      <div className="semana-day-pills">
        {dias.map(d => {
          const iso = toISO(d);
          return (
            <button
              key={iso}
              className={(iso === diaSeleccionado ? 'active' : '') + (iso === todayISO() ? ' hoy' : '')}
              onClick={() => setDiaSeleccionado(iso)}
            >
              {DOW_CORTO[d.getDay()]} {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Vista de un solo día — mobile */}
      <div className="semana-day-mobile">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>{fmtDia(new Date(diaSeleccionado + 'T00:00:00'))}</h3>
          <button className="icon-btn" onClick={() => onNuevoEnDia(diaSeleccionado)}>+ Nuevo turno</button>
        </div>
        {itemsDiaSeleccionado.map((t, idx) => (
          <TurnoCard key={t.id || `imp-${idx}`} t={t} onCambiarEstado={cambiarEstado} onCobrar={setCobrandoTurno} onRecordatorio={abrirRecordatorio} />
        ))}
        {!itemsDiaSeleccionado.length && (
          <div className="empty-state">
            <span className="icon">🗓️</span>
            <span className="title">Sin turnos este día</span>
          </div>
        )}
      </div>

      {/* Grilla de 7 columnas — desktop */}
      <div className="semana-grid">
        {dias.map(d => {
          const iso = toISO(d);
          const esHoy = iso === todayISO();
          const items = porDia[iso] || [];
          return (
            <div key={iso} className={'semana-col' + (esHoy ? ' hoy' : '')}>
              <div className="semana-col-head">
                <div>
                  <div className="dow">{DOW_CORTO[d.getDay()]}</div>
                  <div className="num">{fmtDia(d)}</div>
                </div>
                <button className="icon-btn" style={{ padding: '4px 9px', fontSize: 13, minHeight: 'unset' }} title="Nuevo turno este día" onClick={() => onNuevoEnDia(iso)}>+</button>
              </div>

              {items.map((t, idx) => (
                <TurnoCard key={t.id || `imp-${idx}`} t={t} onCambiarEstado={cambiarEstado} onCobrar={setCobrandoTurno} onRecordatorio={abrirRecordatorio} />
              ))}
              {!items.length && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Sin turnos</div>}
            </div>
          );
        })}
      </div>

      <CobroTurnoModal turno={cobrandoTurno} onClose={() => setCobrandoTurno(null)} onChanged={cargar} />
      <PedirContactoModal data={pidiendoContacto} onClose={() => setPidiendoContacto(null)} />
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}
