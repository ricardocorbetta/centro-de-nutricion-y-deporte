'use client';

import { useEffect, useState } from 'react';
import { LOGO_DATA_URI } from '../../lib/logo';

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function ReservarPage() {
  const [profesionales, setProfesionales] = useState([]);
  const [loadingProfs, setLoadingProfs] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [profesional, setProfesional] = useState('');
  const [servicio, setServicio] = useState('');
  const [fecha, setFecha] = useState('');
  const [horarios, setHorarios] = useState([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [hora, setHora] = useState('');

  const [pacienteNombre, setPacienteNombre] = useState('');
  const [pacienteTelefono, setPacienteTelefono] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    fetch('/api/public/profesionales')
      .then(r => r.json())
      .then(data => { if (!data.error) setProfesionales(data.profesionales || []); else setErrorMsg(data.error); })
      .catch(e => setErrorMsg(e.message))
      .finally(() => setLoadingProfs(false));
  }, []);

  const profData = profesionales.find(p => p.nombre === profesional);
  const servicioData = profData?.servicios.find(s => s.nombre === servicio);

  useEffect(() => {
    if (!profesional || !fecha || !servicioData) { setHorarios([]); return; }
    setLoadingHorarios(true);
    setHora('');
    fetch(`/api/public/disponibilidad?profesional=${encodeURIComponent(profesional)}&fecha=${fecha}&duracion=${servicioData.duracion}`)
      .then(r => r.json())
      .then(data => setHorarios(data.horarios || []))
      .catch(() => setHorarios([]))
      .finally(() => setLoadingHorarios(false));
  }, [profesional, fecha, servicioData]);

  async function confirmar() {
    setConfirmando(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/public/reservar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesional, fecha, hora, servicio, duracion: servicioData.duracion,
          pacienteNombre, pacienteTelefono
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfirmado(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setConfirmando(false);
    }
  }

  const puedeConfirmar = profesional && servicio && fecha && hora && pacienteNombre.trim();

  if (confirmado) {
    return (
      <Shell>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>¡Turno reservado!</h2>
          <p style={{ color: 'var(--ink-soft)' }}>
            {servicio.replace('Nutrición / ', '').replace('Nutrición Infantil / ', '')} con {profesional}<br />
            {fecha} a las {hora}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 16 }}>
            Si necesitás cambiar o cancelar el turno, comunicate con el centro.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="card">
        <div className="section-head"><span className="dot" /><h2>Reservar un turno</h2></div>

        {loadingProfs ? <p>Cargando…</p> : (
          <>
            <div className="manual-grid">
              <div className="field">
                <label>Profesional</label>
                <select value={profesional} onChange={e => { setProfesional(e.target.value); setServicio(''); }}>
                  <option value="">Elegí un profesional</option>
                  {profesionales.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Servicio</label>
                <select value={servicio} onChange={e => setServicio(e.target.value)} disabled={!profesional}>
                  <option value="">Elegí un servicio</option>
                  {profData?.servicios.map(s => (
                    <option key={s.nombre} value={s.nombre}>{s.nombre.replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ')} ({s.duracion} min)</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Fecha</label>
                <input type="date" min={todayISO()} value={fecha} onChange={e => setFecha(e.target.value)} disabled={!servicio} />
              </div>
            </div>

            {fecha && servicioData && (
              <>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 10 }}>Horarios disponibles</h3>
                {loadingHorarios ? <p style={{ color: 'var(--ink-faint)' }}>Buscando horarios…</p> : (
                  horarios.length === 0 ? <p style={{ color: 'var(--ink-faint)' }}>No hay horarios libres ese día. Probá otra fecha.</p> : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                      {horarios.map(h => (
                        <button key={h} type="button"
                          className={'icon-btn' + (hora === h ? ' primary' : '')}
                          onClick={() => setHora(h)}>{h}</button>
                      ))}
                    </div>
                  )
                )}
              </>
            )}

            {hora && (
              <>
                <div className="manual-grid">
                  <div className="field"><label>Tu nombre</label><input value={pacienteNombre} onChange={e => setPacienteNombre(e.target.value)} /></div>
                  <div className="field"><label>Tu teléfono (opcional)</label><input value={pacienteTelefono} onChange={e => setPacienteTelefono(e.target.value)} /></div>
                </div>
                <button className="icon-btn primary" disabled={!puedeConfirmar || confirmando} onClick={confirmar}>
                  {confirmando ? 'Confirmando…' : 'Confirmar turno'}
                </button>
              </>
            )}

            {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13, marginTop: 12 }}>{errorMsg}</p>}
          </>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #F4F7F6)', fontFamily: "'Inter', sans-serif" }}>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img src={LOGO_DATA_URI} alt="CND" />
            <div className="topbar-title">
              <span className="app-name">Reservar turno</span>
              <span className="app-sub">Centro de Nutrición y Deporte · Cipolletti</span>
            </div>
          </div>
        </div>
      </div>
      <div className="wrap" style={{ maxWidth: 520 }}>{children}</div>
    </div>
  );
}
