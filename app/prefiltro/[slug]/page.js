'use client';

import { useEffect, useState } from 'react';
import { LOGO_DATA_URI } from '../../../lib/logo';
import PlataformaFooter from '../../PlataformaFooter';

function todayISO() { return new Date().toISOString().slice(0, 10); }

const COMO_CONOCIO_OPCIONES = [
  'Instagram', 'Google', 'Recomendación de otro paciente', 'Recomendación de un profesional', 'Otro'
];

// Entrevista de prefiltro para pacientes nuevos, previa a la primera consulta.
// Se comparte por WhatsApp (junto con o en vez del link de reserva) para tener la info
// básica del paciente antes de que se siente con el profesional.
export default function PrefiltroPage({ params }) {
  const slug = params.slug;
  const [empresa, setEmpresa] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);

  const [form, setForm] = useState({
    fechaPrimeraConsulta: '', nombre: '', fechaNacimiento: '', edad: '',
    email: '', whatsapp: '', comoConocio: '', deporte: '', gimnasio: '', motivoConsulta: ''
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/public/profesionales?empresa=' + encodeURIComponent(slug))
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); return; }
        setEmpresa(data.empresa);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingEmpresa(false));
  }, [slug]);

  function campo(key, value) { setForm(f => ({ ...f, [key]: value })); }

  const puedeEnviar = form.nombre.trim().length > 0;

  async function enviar() {
    if (!puedeEnviar) return;
    setEnviando(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/public/prefiltro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: slug, ...form })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEnviado(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (notFound) {
    return (
      <Shell empresa={null}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 16 }}>No encontramos este centro</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Revisá el link que te compartieron.</p>
        </div>
      </Shell>
    );
  }

  if (enviado) {
    return (
      <Shell empresa={empresa}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="success-badge">✅</div>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>¡Gracias, {form.nombre.split(' ')[0]}!</h2>
          <p style={{ color: 'var(--ink-soft)' }}>
            Recibimos tus datos. Nos vemos en la primera consulta{form.fechaPrimeraConsulta ? ` el ${form.fechaPrimeraConsulta}` : ''}.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell empresa={empresa}>
      <div className="card">
        <div className="section-head"><span className="dot" /><h2>Antes de tu primera consulta</h2></div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -6, marginBottom: 16 }}>
          Completá estos datos para que el profesional te conozca un poco antes de la consulta. No hace falta que te
          extiendas, en la consulta profundizamos todo.
        </p>

        {loadingEmpresa ? <p>Cargando…</p> : (
          <>
            <div className="manual-grid">
              <div className="field"><label>Fecha de la primera consulta</label>
                <input type="date" min={todayISO()} value={form.fechaPrimeraConsulta} onChange={e => campo('fechaPrimeraConsulta', e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Nombre y apellido *</label>
                <input value={form.nombre} onChange={e => campo('nombre', e.target.value)} />
              </div>
              <div className="field"><label>Fecha de nacimiento</label>
                <input type="date" value={form.fechaNacimiento} onChange={e => campo('fechaNacimiento', e.target.value)} />
              </div>
              <div className="field"><label>Edad</label>
                <input type="number" min="0" value={form.edad} onChange={e => campo('edad', e.target.value)} />
              </div>
              <div className="field"><label>Mail</label>
                <input type="email" value={form.email} onChange={e => campo('email', e.target.value)} />
              </div>
              <div className="field"><label>WhatsApp</label>
                <input value={form.whatsapp} onChange={e => campo('whatsapp', e.target.value)} placeholder="ej: 2995551234" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>¿Cómo llegaste a conocernos?</label>
                <select value={form.comoConocio} onChange={e => campo('comoConocio', e.target.value)}>
                  <option value="">Elegí una opción</option>
                  {COMO_CONOCIO_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field"><label>Deporte que practicás</label>
                <input value={form.deporte} onChange={e => campo('deporte', e.target.value)} />
              </div>
              <div className="field"><label>¿Vas al gimnasio? ¿Cuál?</label>
                <input value={form.gimnasio} onChange={e => campo('gimnasio', e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Motivo de consulta</label>
                <textarea rows={4} value={form.motivoConsulta} onChange={e => campo('motivoConsulta', e.target.value)}
                  placeholder="Contalo con tus palabras, en la consulta profundizamos" style={{ width: '100%', resize: 'vertical' }} />
              </div>
            </div>

            {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13, marginTop: 4 }}>{errorMsg}</p>}

            <button className="icon-btn primary" disabled={!puedeEnviar || enviando} onClick={enviar} style={{ marginTop: 14 }}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
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
              <span className="app-name">Entrevista de prefiltro</span>
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
