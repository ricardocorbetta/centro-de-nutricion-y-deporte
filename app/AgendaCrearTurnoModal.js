'use client';

import { useEffect, useState } from 'react';
import { MODALIDADES } from '../lib/agendaEstados';

function todayISO() { return new Date().toISOString().slice(0, 10); }

// Modal de creación de turno, compartido entre la vista de Lista, Grilla y Semana,
// y por el menú rápido "+ Nuevo" (Nuevo Turno / Nueva Videoconsulta).
// Una vez elegidos profesional + servicio + fecha, muestra los horarios realmente
// libres de ese profesional ese día (mismo cálculo que usa la reserva pública),
// en vez de pedir la hora a mano.
// Props:
//   open: boolean
//   onClose: () => void
//   profesionales: [{ nombre, servicios: [{nombre, duracion}] }]
//   initial: { fecha?, hora?, profesional?, modalidad? }  — precarga opcional (ej: clic en una celda de la grilla)
//   onCreated: (turno) => void
//   empresaSlug: string — necesario para consultar disponibilidad
export default function AgendaCrearTurnoModal({ open, onClose, profesionales, initial, onCreated, empresaSlug }) {
  const [fecha, setFecha] = useState(initial?.fecha || todayISO());
  const [hora, setHora] = useState(initial?.hora || '');
  const [profesional, setProfesional] = useState(initial?.profesional || '');
  const [servicio, setServicio] = useState('');
  const [modalidad, setModalidad] = useState(initial?.modalidad || 'presencial');
  const [pacienteNombre, setPacienteNombre] = useState('');
  const [pacienteTelefono, setPacienteTelefono] = useState('');
  const [financiador, setFinanciador] = useState('Particular');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [slots, setSlots] = useState(null); // null = todavía no se consultó
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [atiendeEseDia, setAtiendeEseDia] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFecha(initial?.fecha || todayISO());
    setHora(initial?.hora || '');
    setProfesional(initial?.profesional || '');
    setServicio('');
    setModalidad(initial?.modalidad || 'presencial');
    setPacienteNombre('');
    setPacienteTelefono('');
    setFinanciador('Particular');
    setErrorMsg('');
    setSlots(null);
  }, [open, initial]);

  const profData = profesionales.find(p => p.nombre === profesional);
  const svcData = profData?.servicios.find(s => s.nombre === servicio);

  // Cada vez que cambia profesional / servicio / fecha, recalcula los horarios libres reales.
  useEffect(() => {
    if (!open || !empresaSlug || !profesional || !servicio || !fecha || !svcData) { setSlots(null); return; }
    let cancelado = false;
    setLoadingSlots(true);
    fetch(`/api/public/disponibilidad?empresa=${encodeURIComponent(empresaSlug)}&profesional=${encodeURIComponent(profesional)}&fecha=${fecha}&duracion=${svcData.duracion}`)
      .then(r => r.json())
      .then(data => {
        if (cancelado) return;
        if (data.error) { setSlots([]); setAtiendeEseDia(true); return; }
        setSlots(data.horarios || []);
        setAtiendeEseDia(!!data.atiende);
        // si la hora precargada (ej. clic en la grilla) sigue libre, la dejamos seleccionada
        if (hora && !(data.horarios || []).includes(hora)) setHora('');
      })
      .catch(() => { if (!cancelado) setSlots([]); })
      .finally(() => { if (!cancelado) setLoadingSlots(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresaSlug, profesional, servicio, fecha, svcData?.duracion]);

  if (!open) return null;

  const puedeGuardar = fecha && hora && profesional && servicio && pacienteNombre.trim();

  async function confirmar() {
    if (!svcData || !puedeGuardar) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha, hora, profesional, servicio: svcData.nombre, duracion: svcData.duracion,
          pacienteNombre, pacienteTelefono, financiador, modalidad
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCreated?.(data.turno);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(21,39,42,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 50
    }} onClick={onClose}>
      <div className="card" style={{ width: 440, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="section-head"><span className="dot" /><h2>Nuevo turno</h2></div>

        <div className="manual-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field"><label>Fecha</label>
            <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setHora(''); }} />
          </div>
          <div className="field"><label>Profesional</label>
            <select value={profesional} onChange={e => { setProfesional(e.target.value); setServicio(''); setHora(''); }}>
              <option value="">Elegí</option>
              {profesionales.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Servicio</label>
            <select value={servicio} onChange={e => { setServicio(e.target.value); setHora(''); }} disabled={!profData}>
              <option value="">{profData ? 'Elegí un servicio' : 'Elegí primero un profesional'}</option>
              {profData?.servicios.map(s => (
                <option key={s.nombre} value={s.nombre}>
                  {s.nombre.replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ')} ({s.duracion} min)
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Horario disponible</label>
            {!profesional || !servicio ? (
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '4px 0 0' }}>
                Elegí profesional y servicio para ver los horarios libres.
              </p>
            ) : loadingSlots ? (
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '4px 0 0' }}>Buscando horarios libres…</p>
            ) : !atiendeEseDia ? (
              <p style={{ fontSize: 12, color: 'var(--rust)', margin: '4px 0 0' }}>Este profesional no atiende ese día de la semana.</p>
            ) : slots && slots.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--rust)', margin: '4px 0 0' }}>No quedan horarios libres ese día — probá con otra fecha.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {(slots || []).map(h => (
                  <button key={h} type="button"
                    onClick={() => setHora(h)}
                    className={'icon-btn' + (hora === h ? ' primary' : '')}
                    style={{ padding: '4px 10px', fontSize: 12.5 }}
                  >{h}</button>
                ))}
              </div>
            )}
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Modalidad</label>
            <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
              {MODALIDADES.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 400 }}>
                  <input type="radio" name="modalidad" checked={modalidad === m.id} onChange={() => setModalidad(m.id)} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Paciente</label>
            <input value={pacienteNombre} onChange={e => setPacienteNombre(e.target.value)} autoFocus={!!hora} />
          </div>
          <div className="field"><label>Teléfono (opcional)</label>
            <input value={pacienteTelefono} onChange={e => setPacienteTelefono(e.target.value)} />
          </div>
          <div className="field"><label>Financiador</label>
            <input value={financiador} onChange={e => setFinanciador(e.target.value)} />
          </div>
        </div>

        {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="icon-btn primary" disabled={saving || !puedeGuardar} onClick={confirmar}>
            {saving ? 'Guardando…' : 'Guardar turno'}
          </button>
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
