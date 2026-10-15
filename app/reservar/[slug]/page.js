'use client';

import { useEffect, useState } from 'react';
import { LOGO_DATA_URI } from '../../../lib/logo';
import { fmtMoney } from '../../../lib/stats';
import { resumenHorarios, fechaCorta, sumarDias } from '../../../lib/disponibilidad';
import { hoyAR } from '../../../lib/fechas';
import LoadingSkeleton from '../../LoadingSkeleton';
import PlataformaFooter from '../../PlataformaFooter';
import Avatar from '../../Avatar';
import SelectorDias, { GrillaHorarios } from '../../SelectorDias';

const DIAS_POR_TANDA = 21;

function nombreServicio(s) {
  return (s || '').replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ');
}

// Reserva pública en pasos: profesional (con los días y horarios que atiende) → servicio → día
// (próximas fechas con la cantidad de turnos libres) → horario → datos de contacto.
export default function ReservarPage({ params }) {
  const slug = params.slug;
  const [empresa, setEmpresa] = useState(null);
  const [profesionales, setProfesionales] = useState([]);
  const [loadingProfs, setLoadingProfs] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [volvioDePago, setVolvioDePago] = useState(false);

  const [profesional, setProfesional] = useState('');
  const [servicio, setServicio] = useState('');
  const [desde, setDesde] = useState(null);
  const [dias, setDias] = useState(null);
  const [cargandoDias, setCargandoDias] = useState(false);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');

  const [pacienteNombre, setPacienteNombre] = useState('');
  const [pacienteTelefono, setPacienteTelefono] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    setVolvioDePago(new URLSearchParams(window.location.search).get('pago') === 'ok');
    fetch('/api/public/profesionales?empresa=' + encodeURIComponent(slug))
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); setErrorMsg(data.error); return; }
        setEmpresa(data.empresa);
        setProfesionales(data.profesionales || []);
      })
      .catch(() => setErrorMsg('No pudimos cargar los profesionales. Probá de nuevo en un minuto.'))
      .finally(() => setLoadingProfs(false));
  }, [slug]);

  const profData = profesionales.find(p => p.nombre === profesional);
  const servicioData = profData?.servicios.find(s => s.nombre === servicio);
  const diaElegido = dias?.find(d => d.fecha === fecha);

  // Días con lugar para el profesional y servicio elegidos (según la duración del servicio).
  useEffect(() => {
    if (!profesional || !servicioData) { setDias(null); return; }
    const inicio = desde || hoyAR();
    setCargandoDias(true);
    setHora('');
    fetch(`/api/public/disponibilidad-rango?empresa=${encodeURIComponent(slug)}&profesional=${encodeURIComponent(profesional)}&duracion=${servicioData.duracion}&desde=${inicio}&dias=${DIAS_POR_TANDA}`)
      .then(r => r.json())
      .then(data => {
        const lista = data.dias || [];
        setDias(lista);
        // Se preselecciona el primer día con lugar, así los horarios aparecen enseguida.
        setFecha(f => (lista.some(d => d.fecha === f && d.libres > 0) ? f : (lista.find(d => d.libres > 0)?.fecha || '')));
      })
      .catch(() => setDias([]))
      .finally(() => setCargandoDias(false));
  }, [profesional, servicioData, desde, slug]);

  function elegirProfesional(nombre) {
    setProfesional(nombre); setServicio(''); setDesde(null); setFecha(''); setHora('');
    const p = profesionales.find(x => x.nombre === nombre);
    if (p?.servicios.length === 1) setServicio(p.servicios[0].nombre);
  }

  async function confirmar() {
    setConfirmando(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/public/reservar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: slug, profesional, fecha, hora, servicio, duracion: servicioData.duracion, pacienteNombre, pacienteTelefono })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.pagoUrl) {
        // El turno ya quedó reservado (bloquea el horario); falta la seña para confirmarlo del todo.
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

  const puedeConfirmar = profesional && servicio && fecha && hora && pacienteNombre.trim() && pacienteTelefono.replace(/\D/g, '').length >= 8;
  const proximoLibre = dias?.find(d => d.libres > 0);

  if (notFound) {
    return (
      <Shell empresa={null}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 18 }}>No encontramos este centro</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Revisá el link de reserva que te compartieron.</p>
        </div>
      </Shell>
    );
  }

  if (volvioDePago || confirmado) {
    return (
      <Shell empresa={empresa}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="success-badge">✓</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>{volvioDePago ? '¡Listo, gracias!' : '¡Turno reservado!'}</h2>
          {volvioDePago ? (
            <p style={{ color: 'var(--text-2)' }}>Recibimos tu pago y tu turno queda confirmado.</p>
          ) : (
            <p style={{ color: 'var(--text-2)' }}>
              {nombreServicio(servicio)} con {profesional}<br />
              <b style={{ color: 'var(--text)' }}>{fechaCorta(fecha)} a las {hora}</b>
            </p>
          )}
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 16 }}>
            Si necesitás cambiar o cancelar el turno, comunicate con el centro.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell empresa={empresa}>
      <div className="card reserva">
        <h1 className="reserva-titulo">Reservá tu turno</h1>

        {loadingProfs ? <LoadingSkeleton lines={3} /> : (
          <>
            <section className="reserva-paso">
              <h2><span className="reserva-num">1</span> ¿Con quién?</h2>
              <div className="prof-opciones" role="radiogroup" aria-label="Profesional">
                {profesionales.map(p => {
                  const horarioTexto = resumenHorarios(p.horarios);
                  return (
                    <button key={p.nombre} type="button" role="radio" aria-checked={profesional === p.nombre}
                      className={'prof-opcion' + (profesional === p.nombre ? ' activo' : '')}
                      onClick={() => elegirProfesional(p.nombre)}>
                      <Avatar nombre={p.nombre} size={40} />
                      <span className="prof-opcion-texto">
                        <span className="prof-opcion-nombre">{p.nombre}</span>
                        <span className="prof-opcion-horario">{horarioTexto ? `Atiende ${horarioTexto}` : 'Consultá los días de atención'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {profData && (
              <section className="reserva-paso">
                <h2><span className="reserva-num">2</span> ¿Qué consulta?</h2>
                <div className="serv-opciones" role="radiogroup" aria-label="Servicio">
                  {profData.servicios.map(s => (
                    <button key={s.nombre} type="button" role="radio" aria-checked={servicio === s.nombre}
                      className={'serv-opcion' + (servicio === s.nombre ? ' activo' : '')}
                      onClick={() => { setServicio(s.nombre); setHora(''); }}>
                      <span>{nombreServicio(s.nombre)}</span>
                      <span className="serv-opcion-dur">{s.duracion} min</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {servicioData && (
              <section className="reserva-paso">
                <h2><span className="reserva-num">3</span> ¿Qué día?</h2>
                {!cargandoDias && proximoLibre && (
                  <p className="reserva-nota">Próximo turno libre: <b>{fechaCorta(proximoLibre.fecha)} a las {proximoLibre.horarios[0]}</b></p>
                )}
                {!cargandoDias && dias && !proximoLibre && (
                  <p className="reserva-nota">No hay turnos libres en estas fechas. Probá con las siguientes.</p>
                )}
                <SelectorDias dias={dias || []} cargando={cargandoDias} seleccionada={fecha}
                  onElegir={f => { setFecha(f); setHora(''); }} />
                <div className="reserva-mas-dias">
                  {desde && desde > hoyAR() && (
                    <button type="button" className="icon-btn" onClick={() => setDesde(d => { const n = sumarDias(d, -DIAS_POR_TANDA); return n <= hoyAR() ? null : n; })}>← Fechas anteriores</button>
                  )}
                  <button type="button" className="icon-btn" onClick={() => setDesde(sumarDias(desde || hoyAR(), DIAS_POR_TANDA))}>Fechas siguientes →</button>
                </div>
              </section>
            )}

            {diaElegido && diaElegido.libres > 0 && (
              <section className="reserva-paso">
                <h2><span className="reserva-num">4</span> ¿A qué hora? <span className="reserva-h2-sub">{fechaCorta(fecha)}</span></h2>
                <GrillaHorarios horarios={diaElegido.horarios} seleccionado={hora} onElegir={setHora} />
              </section>
            )}

            {hora && (
              <section className="reserva-paso">
                <h2><span className="reserva-num">5</span> Tus datos</h2>
                <div className="manual-grid">
                  <label className="field"><span>Tu nombre y apellido</span><input value={pacienteNombre} onChange={e => setPacienteNombre(e.target.value)} autoComplete="name" /></label>
                  <label className="field"><span>Tu celular (con código de área)</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="299 555 1234" value={pacienteTelefono} onChange={e => setPacienteTelefono(e.target.value)} /></label>
                </div>
                <p className="reserva-resumen">
                  {nombreServicio(servicio)} con <b>{profesional}</b> · <b>{fechaCorta(fecha)} a las {hora}</b>
                </p>
                {empresa?.seniaMonto > 0 && (
                  <p className="reserva-nota">
                    Para confirmar el turno se pide una seña de <b>{fmtMoney(empresa.seniaMonto)}</b> por Mercado Pago: te llevamos a pagarla en el siguiente paso.
                  </p>
                )}
                <button className="icon-btn primary reserva-confirmar" disabled={!puedeConfirmar || confirmando} onClick={confirmar}>
                  {confirmando ? 'Confirmando…' : (empresa?.seniaMonto > 0 ? 'Pagar seña y confirmar' : 'Confirmar turno')}
                </button>
              </section>
            )}

            {errorMsg && <p className="status-msg err" role="alert" style={{ marginTop: 12 }}>{errorMsg}</p>}
          </>
        )}
      </div>
    </Shell>
  );
}

function Shell({ empresa, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)' }}>
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
      <div className="wrap" style={{ maxWidth: 560 }}>
        {children}
        <PlataformaFooter />
      </div>
    </div>
  );
}
