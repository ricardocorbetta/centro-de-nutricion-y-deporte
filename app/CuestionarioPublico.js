'use client';

import { useEffect, useState } from 'react';
import { LOGO_DATA_URI } from '../lib/logo';
import PlataformaFooter from './PlataformaFooter';

// Formulario público para cualquier cuestionario configurable (prefiltro, seguimiento,
// satisfacción, anamnesis, etc.) — los campos salen de lo que se armó en el panel, en vez de
// estar hardcodeados por tipo de cuestionario. Compartido por /prefiltro/[slug] (mantiene el
// link ya en uso) y por /cuestionario/[slug]/[cuestionarioSlug] (cualquier cuestionario nuevo).
function inputProps(campo) {
  switch (campo.tipo) {
    case 'email': return { type: 'email' };
    case 'telefono': return { type: 'text', placeholder: 'ej: 2995551234' };
    case 'numero': return { type: 'number', min: '0' };
    case 'fecha': return { type: 'date' };
    default: return { type: 'text' };
  }
}

export default function CuestionarioPublico({ empresaSlug, cuestionarioSlug }) {
  const [empresa, setEmpresa] = useState(null);
  const [cuestionario, setCuestionario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [respuestas, setRespuestas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch(`/api/public/cuestionarios?empresa=${encodeURIComponent(empresaSlug)}&cuestionario=${encodeURIComponent(cuestionarioSlug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); return; }
        setEmpresa(data.empresa);
        setCuestionario(data.cuestionario);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [empresaSlug, cuestionarioSlug]);

  function campo(id, value) { setRespuestas(r => ({ ...r, [id]: value })); }

  const campoNombre = cuestionario?.campos?.find(c => c.tipo === 'nombre_paciente');
  const puedeEnviar = (cuestionario?.campos || []).every(c => !c.requerido || String(respuestas[c.id] || '').trim());

  async function enviar() {
    if (!puedeEnviar) return;
    setEnviando(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/public/cuestionarios/responder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: empresaSlug, cuestionario: cuestionarioSlug, respuestas })
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
      <Shell empresa={null} titulo="Cuestionario">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 16 }}>No encontramos este cuestionario</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Revisá el link que te compartieron.</p>
        </div>
      </Shell>
    );
  }

  if (enviado) {
    const nombrePaciente = campoNombre ? String(respuestas[campoNombre.id] || '').split(' ')[0] : '';
    return (
      <Shell empresa={empresa} titulo={cuestionario?.nombre}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="success-badge">✅</div>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>{nombrePaciente ? `¡Gracias, ${nombrePaciente}!` : '¡Gracias!'}</h2>
          <p style={{ color: 'var(--ink-soft)' }}>Recibimos tus datos.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell empresa={empresa} titulo={cuestionario?.nombre || 'Cuestionario'}>
      <div className="card">
        <div className="section-head"><span className="dot" /><h2>{cuestionario?.nombre || 'Cuestionario'}</h2></div>
        {cuestionario?.descripcion && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -6, marginBottom: 16 }}>{cuestionario.descripcion}</p>
        )}

        {loading ? <p>Cargando…</p> : (
          <>
            <div className="manual-grid">
              {(cuestionario?.campos || []).map(c => (
                <div className="field" key={c.id} style={(c.tipo === 'texto_largo' || c.tipo === 'nombre_paciente') ? { gridColumn: '1 / -1' } : undefined}>
                  <label>{c.etiqueta}{c.requerido ? ' *' : ''}</label>
                  {c.tipo === 'texto_largo' ? (
                    <textarea rows={4} value={respuestas[c.id] || ''} onChange={e => campo(c.id, e.target.value)}
                      style={{ width: '100%', resize: 'vertical' }} />
                  ) : c.tipo === 'select' ? (
                    <select value={respuestas[c.id] || ''} onChange={e => campo(c.id, e.target.value)}>
                      <option value="">Elegí una opción</option>
                      {(c.opciones || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={respuestas[c.id] || ''} onChange={e => campo(c.id, e.target.value)} {...inputProps(c)} />
                  )}
                </div>
              ))}
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

function Shell({ empresa, titulo, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #F4F7F6)', fontFamily: "'Inter', sans-serif" }}>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img src={empresa?.logoUrl || LOGO_DATA_URI} alt={empresa?.nombreCorto || 'logo'} />
            <div className="topbar-title">
              <span className="app-name">{titulo}</span>
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
