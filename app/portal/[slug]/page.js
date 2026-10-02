'use client';

import { useEffect, useState } from 'react';
import { LOGO_DATA_URI } from '../../../lib/logo';
import LoadingSkeleton from '../../LoadingSkeleton';
import PlataformaFooter from '../../PlataformaFooter';
import EvolucionChart from '../../EvolucionChart';

const TIPO_LABEL = { plan: 'Plan alimentario', bioimpedancia: 'Bioimpedancia', antropometria: 'Antropometría' };

function fmtFecha(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function PortalPage({ params }) {
  const slug = params.slug;
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState(null); // null = no logueado
  const [errorMsg, setErrorMsg] = useState('');

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [marca, setMarca] = useState(null);

  useEffect(() => {
    fetch('/api/public/empresa?empresa=' + encodeURIComponent(slug))
      .then(r => r.json())
      .then(d => { if (!d.error) setMarca(d.empresa); })
      .catch(() => {});
  }, [slug]);

  async function cargarMe() {
    try {
      const res = await fetch('/api/portal/me');
      if (!res.ok) { setMe(null); return; }
      const data = await res.json();
      if (data.error) { setMe(null); return; }
      setMe(data);
    } catch (e) {
      setMe(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { cargarMe(); }, []);

  async function entrar(e) {
    e.preventDefault();
    setErrorMsg('');
    setEntrando(true);
    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaSlug: slug, usuario, password })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await cargarMe();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setEntrando(false);
    }
  }

  async function salir() {
    await fetch('/api/portal/logout', { method: 'POST' });
    setMe(null);
    setUsuario(''); setPassword('');
  }

  const colorPrimario = me?.empresa?.colorPrimario || 'var(--primary)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #F4F7F6)', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 18px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <img src={marca?.logoUrl || LOGO_DATA_URI} alt="" style={{ height: 34 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{marca?.nombreCorto || marca?.nombre || ''}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Portal de pacientes</div>
          </div>
        </div>

        {checking ? (
          <LoadingSkeleton lines={4} />
        ) : !me ? (
          <form onSubmit={entrar} className="card" style={{ padding: '28px 24px' }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: 'var(--ink)' }}>Ingresá a tu cuenta</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
              Usá el usuario y la clave que te dio el centro.
            </p>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>Usuario</label>
            <input value={usuario} onChange={e => setUsuario(e.target.value)} autoFocus style={{ width: '100%', marginBottom: 16 }} />
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>Clave</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 20 }} />
            {errorMsg && <div style={{ color: 'var(--rust)', fontSize: 12.5, marginBottom: 14 }}>{errorMsg}</div>}
            <button type="submit" className="icon-btn primary" disabled={entrando} style={{ width: '100%', padding: '10px 0' }}>
              {entrando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <PortalApp me={me} onLogout={salir} colorPrimario={colorPrimario} />
        )}

        <PlataformaFooter />
      </div>
    </div>
  );
}

const BIBLIOTECA_TIPO_LABEL = { receta: 'Receta', material_educativo: 'Material educativo', pauta_general: 'Pauta general', tip: 'Tip' };

function PortalApp({ me, onLogout, colorPrimario }) {
  const [tab, setTab] = useState(me.vigente ? 'plan' : 'biblioteca');
  const [consultas, setConsultas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [biblioteca, setBiblioteca] = useState([]);
  const [plan, setPlan] = useState(null);
  const [mediciones, setMediciones] = useState([]);
  const [metrica, setMetrica] = useState('peso');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    const calls = [fetch('/api/portal/biblioteca').then(r => r.json())];
    if (me.vigente) {
      calls.push(fetch('/api/portal/historial').then(r => r.json()));
      calls.push(fetch('/api/portal/archivos').then(r => r.json()));
      calls.push(fetch('/api/portal/plan').then(r => r.json()));
      calls.push(fetch('/api/portal/evolucion').then(r => r.json()));
    }
    Promise.all(calls).then(([b, h, a, p, ev]) => {
      setBiblioteca(b.contenido || []);
      if (h) setConsultas(h.consultas || []);
      if (a) setArchivos(a.archivos || []);
      if (p) setPlan(p.plan || null);
      if (ev) setMediciones(ev.mediciones || []);
    }).catch(e => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, [me.vigente]);

  const METRICAS = [
    { value: 'peso', label: 'Peso', unidad: ' kg' },
    { value: 'pct_grasa', label: '% Grasa', unidad: '%' },
    { value: 'pct_musculo', label: '% Músculo', unidad: '%' },
    { value: 'perimetro_cintura', label: 'Cintura', unidad: ' cm' },
    { value: 'perimetro_cadera', label: 'Cadera', unidad: ' cm' }
  ];
  const metricaInfo = METRICAS.find(m => m.value === metrica);
  const conDatos = METRICAS.filter(m => mediciones.some(med => med[m.value] !== null));
  const puntosChart = mediciones.map(m => ({ fecha: m.fecha, y: m[metrica] !== null ? Number(m[metrica]) : null }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={me.empresa.logoUrl || LOGO_DATA_URI} alt="" style={{ height: 30 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Hola, {me.paciente.nombre.split(' ')[0]}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{me.empresa.nombreCorto || me.empresa.nombre}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={onLogout}>Salir</button>
      </div>

      <div className="tabbar" style={{ marginBottom: 16 }}>
        <button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>Mi plan</button>
        <button className={tab === 'evolucion' ? 'active' : ''} onClick={() => setTab('evolucion')}>Mi evolución</button>
        <button className={tab === 'historial' ? 'active' : ''} onClick={() => setTab('historial')}>Historial</button>
        <button className={tab === 'archivos' ? 'active' : ''} onClick={() => setTab('archivos')}>Mis archivos</button>
        <button className={tab === 'biblioteca' ? 'active' : ''} onClick={() => setTab('biblioteca')}>Biblioteca</button>
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      {(tab === 'plan' || tab === 'evolucion' || tab === 'historial' || tab === 'archivos') && !me.vigente ? (
        <div className="card" style={{ padding: 20 }}>
          <div className="empty-state">
            <span className="icon">🔒</span>
            <span className="title">Tu acceso venció</span>
            <span className="hint">
              Pasaron más de 18 meses desde tu última consulta{me.ultimaConsulta ? ` (${fmtFecha(me.ultimaConsulta)})` : ''}.
              Coordiná una consulta con tu profesional para recuperar el acceso a tus planes y evaluaciones.
              La Biblioteca sigue disponible mientras tanto.
            </span>
          </div>
        </div>
      ) : loading ? <LoadingSkeleton lines={4} /> : tab === 'plan' ? (
        plan ? (
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colorPrimario, textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {fmtFecha(plan.fecha)}{plan.profesional ? ` · ${plan.profesional}` : ''}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: '4px 0 14px' }}>{plan.titulo}</div>
            {(plan.secciones || []).map((sec, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{sec.nombre}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>{sec.contenido}</div>
              </div>
            ))}
            {plan.notas_generales && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--ink-soft)' }}>
                {plan.notas_generales}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <span className="icon">🥗</span>
            <span className="title">Todavía no tenés un plan cargado</span>
            <span className="hint">Tu profesional va a armar acá tu plan nutricional.</span>
          </div>
        )
      ) : tab === 'evolucion' ? (
        mediciones.length > 0 ? (
          <div className="card" style={{ padding: '18px 20px' }}>
            {conDatos.length > 1 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {conDatos.map(m => (
                  <button key={m.value} className={'icon-btn' + (metrica === m.value ? ' primary' : '')}
                    style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => setMetrica(m.value)}>{m.label}</button>
                ))}
              </div>
            )}
            <EvolucionChart points={puntosChart} unidad={metricaInfo.unidad} color={colorPrimario} />
          </div>
        ) : (
          <div className="empty-state">
            <span className="icon">📈</span>
            <span className="title">Todavía no hay controles cargados</span>
            <span className="hint">Tu profesional va a ir registrando tu peso y medidas en cada consulta.</span>
          </div>
        )
      ) : tab === 'historial' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {consultas.map((c, i) => (
            <div key={i} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtFecha(c.day)} · {c.time}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{c.resource}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{(c.service || '').replace('Nutrición / ', '')}</div>
            </div>
          ))}
          {!consultas.length && (
            <div className="empty-state">
              <span className="icon">📅</span>
              <span className="title">Todavía no hay consultas registradas</span>
            </div>
          )}
        </div>
      ) : tab === 'archivos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {archivos.map(a => (
            <a key={a.id} href={a.url || '#'} target="_blank" rel="noreferrer" className="card"
              style={{ padding: '14px 16px', display: 'block', textDecoration: 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colorPrimario, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                {TIPO_LABEL[a.tipo] || a.tipo}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', margin: '2px 0' }}>{a.categoria || a.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{fmtFecha(a.fecha)} · Descargar ↓</div>
            </a>
          ))}
          {!archivos.length && (
            <div className="empty-state">
              <span className="icon">📄</span>
              <span className="title">Todavía no hay archivos cargados</span>
              <span className="hint">Tu profesional va a ir subiendo acá tus planes y evaluaciones.</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {biblioteca.map(b => (
            <a key={b.id} href={b.url || undefined} target={b.url ? '_blank' : undefined} rel="noreferrer" className="card"
              style={{ padding: '14px 16px', display: 'block', textDecoration: 'none', cursor: b.url ? 'pointer' : 'default' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colorPrimario, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                {BIBLIOTECA_TIPO_LABEL[b.tipo] || b.tipo}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', margin: '2px 0' }}>{b.titulo}</div>
              {b.descripcion && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 2 }}>{b.descripcion}</div>}
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{b.profesional} · {fmtFecha(b.fecha)}{b.url ? ' · Ver ↓' : ''}</div>
            </a>
          ))}
          {!biblioteca.length && (
            <div className="empty-state">
              <span className="icon">📚</span>
              <span className="title">Todavía no hay contenido publicado</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
