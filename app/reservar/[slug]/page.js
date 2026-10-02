'use client';

import { useEffect, useState } from 'react';
import { LOGO_DATA_URI } from '../../../lib/logo';
import { fmtMoney } from '../../../lib/stats';
import LoadingSkeleton from '../../LoadingSkeleton';
import PlataformaFooter from '../../PlataformaFooter';

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function ReservarPage({ params }) {
  const slug = params.slug;
  const [empresa, setEmpresa] = useState(null);
  const [profesionales, setProfesionales] = useState([]);
  const [loadingProfs, setLoadingProfs] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [notFound, setNotFound] = useState(false);

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
    fetch('/api/public/profesionales?empresa=' + encodeURIComponent(slug))
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); setErrorMsg(data.error); return; }
        setEmpresa(data.empresa);
        setProfesionales(data.profesionales || []);
      })
      .catch(e => setErrorMsg(e.message))
      .finally(() => setLoadingProfs(false));
  }, [slug]);

  const profData = profesionales.find(p => p.nombre === profesional);
  const servicioData = profData?.servicios.find(s => s.nombre === servicio);

  useEffect(() => {
    if (!profesional || !fecha || !servicioData) { setHorarios([]); return; }
    setLoadingHorarios(true);
    setHora('');
    fetch(`/api/public/disponibilidad?empresa=${encodeURIComponent(slug)}&profesional=${encodeURIComponent(profesional)}&fecha=${fecha}&duracion=${servicioData.duracion}`)
      .then(r => r.json())
      .then(data => setHorarios(data.horarios || []))
      .catch(() => setHorarios([]))
      .finally(() => setLoadingHorarios(false));
  }, [profesional, fecha, servicioData, slug]);

  async function confirmar() {
    setConfirmando(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/public/reservar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: slug, profesional, fecha, hora, servicio, duracion: servicioData.duracion,
          pacienteNombre, pacienteTelefono
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.pagoUrl) {
        // El turno ya quedó reservado (bloquea el horario); lo que falta es la seña para
        // confirmarlo del todo. Mandamos directo al checkout de Mercado Pago.
        window.location.href = data.pagoUrl;
        return;
      }
      setConfirmado(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setConfirmando(false);
    }
  }

  const puedeConfirmar = profesional && servicio && fecha && hora && pacienteNombre.trim();
  const volvioDePago = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pago') === 'ok';

  if (notFound) {
    return (
      <Shell empresa={null}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 16 }}>No encontramos este centro</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Revisá el link de reserva que te compartieron.</p>
        </div>
      </Shell>
    );
  }

  if (volvioDePago) {
    return (
      <Shell empresa={empresa}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="success-badge">✅</div>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>¡Listo, gracias!</h2>
          <p style={{ color: 'var(--ink-soft)' }}>
            Recibimos tu pago y tu turno queda confirmado. Si no te llega la confirmación en unos minutos, comunicate con el centro.
          </p>
        </div>
      </Shell>
    );
  }

  if (confirmado) {
    return (
      <Shell empresa={empresa}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="success-badge">✅</div>
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
    <Shell empresa={empresa}>
      <div className="card">
        <div className="section-head"><span className="dot" /><h2>Reservar un turno</h2></div>

        {loadingProfs ? <LoadingSkeleton lines={3} /> : (
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
                {loadingHorarios ? <LoadingSkeleton lines={1} widths={['100%']} /> : (
                  horarios.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px 10px' }}>
                      <span className="icon">🗓️</span>
                      <span className="title">No hay horarios libres ese día</span>
                      <span className="hint">Probá con otra fecha.</span>
                    </div>
                  ) : (
                    <div className="timeslot-grid">
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
                {empresa?.seniaMonto > 0 && (
                  <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -4 }}>
                    Para confirmar este turno se pide una seña de <b>{fmtMoney(empresa.seniaMonto)}</b> por Mercado Pago — te vamos a llevar a pagarla en el siguiente paso.
                  </p>
                )}
                <button className="icon-btn primary" disabled={!puedeConfirmar || confirmando} onClick={confirmar}>
                  {confirmando ? 'Confirmando…' : (empresa?.seniaMonto > 0 ? 'Pagar seña y confirmar' : 'Confirmar turno')}
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

function Shell({ empresa, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #F4F7F6)', fontFamily: "'Inter', sans-serif" }}>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img src={empresa?.logoUrl || LOGO_DATA_URI} alt={empresa?.nombreCorto || 'logo'} />
            <div className="topbar-title">
              <span className="app-name">Reservar turno</span>
              <span className="app-sub">{empresa ? `${empresa.nombre}${empresa.ciudad ? ' · ' + empresa.ciudad : ''}` : ''}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="wrap" style={{ maxWidth: 520 }}>
        {children}
        <PlataformaFooter />
      </div>
    </div>
  );
}
