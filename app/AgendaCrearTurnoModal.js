'use client';

import { useEffect, useState } from 'react';
import { MODALIDADES } from '../lib/agendaEstados';

function todayISO() { return new Date().toISOString().slice(0, 10); }

// Modal de creación de turno, compartido entre la vista de Lista, Grilla y Semana,
// y por el menú rápido "+ Nuevo" (Nuevo Turno / Nueva Videoconsulta).
// Props:
//   open: boolean
//   onClose: () => void
//   profesionales: [{ nombre, servicios: [{nombre, duracion}] }]
//   initial: { fecha?, hora?, profesional?, modalidad? }  — precarga opcional (ej: clic en una celda de la grilla)
//   onCreated: (turno) => void
export default function AgendaCrearTurnoModal({ open, onClose, profesionales, initial, onCreated }) {
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
  }, [open, initial]);

  if (!open) return null;

  const profData = profesionales.find(p => p.nombre === profesional);
  const puedeGuardar = fecha && hora && profesional && servicio && pacienteNombre.trim();

  async function confirmar() {
    const svc = profData?.servicios.find(s => s.nombre === servicio);
    if (!svc || !puedeGuardar) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/turnos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha, hora, profesional, servicio: svc.nombre, duracion: svc.duracion,
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
      <div className="card" style={{ width: 420, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="section-head"><span className="dot" /><h2>Nuevo turno</h2></div>

        <div className="manual-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field"><label>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="field"><label>Hora</label>
            <input type="time" step="600" value={hora} onChange={e => setHora(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Profesional</label>
            <select value={profesional} onChange={e => { setProfesional(e.target.value); setServicio(''); }}>
              <option value="">Elegí un profesional</option>
              {profesionales.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Servicio</label>
            <select value={servicio} onChange={e => setServicio(e.target.value)} disabled={!profData}>
              <option value="">{profData ? 'Elegí un servicio' : 'Elegí primero un profesional'}</option>
              {profData?.servicios.map(s => (
                <option key={s.nombre} value={s.nombre}>
                  {s.nombre.replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ')} ({s.duracion} min)
                </option>
              ))}
            </select>
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
            <input value={pacienteNombre} onChange={e => setPacienteNombre(e.target.value)} />
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
