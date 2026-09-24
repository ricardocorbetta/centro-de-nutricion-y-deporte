'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_DATA_URI } from '../lib/logo';
import {
  DOW_ES, DOW_ORDER, HOURS,
  fmtMoney, fmtHoras, isPriceConfirmed,
  computeStats, computeStatsManual, topBottom,
  simulateScenario, goalProgress,
  eventsFromCSV, consumersFromCSV, monthKeyFromEvents
} from '../lib/stats';
import SecretariaView from './SecretariaView';
import CajaComisionesSection from './CajaComisionesSection';

export default function AppClient({ role, name, username }) {
  if (role === 'secretaria') return <SecretariaView name={name} username={username} />;
  return <DirectorApp name={name} username={username} />;
}

function DirectorApp({ name, username }) {
  const router = useRouter();
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [config, setConfig] = useState({ consultorios: 2, horasConsultorio: 24, precios: {} });
  const [periods, setPeriods] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [eventsCache, setEventsCache] = useState({}); // { monthKey: { events } | { isManual, manualSummary } }
  const [consumersSummary, setConsumersSummary] = useState({ total_count: 0, data: { weekly: {}, financiadores: {} } });
  const [goals, setGoals] = useState({});
  const [showConfig, setShowConfig] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState('csv');
  const [uploadStatus, setUploadStatus] = useState({ msg: '', err: false });
  const [trendStats, setTrendStats] = useState({});

  const fileEventsRef = useRef(null);
  const fileConsumersRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [bootRes, goalsRes] = await Promise.all([fetch('/api/bootstrap'), fetch('/api/goals')]);
        const data = await bootRes.json();
        const goalsData = await goalsRes.json();
        if (data.error) throw new Error(data.error);
        setConfig(data.config);
        setPeriods(data.periods || []);
        setConsumersSummary(data.consumers || { total_count: 0, data: { weekly: {}, financiadores: {} } });
        setGoals(goalsData.goals || {});
        setCurrentMonth(data.latestKey);
        if (data.latestKey) {
          setEventsCache(prev => ({ ...prev, [data.latestKey]: data.latestManualSummary
            ? { isManual: true, manualSummary: data.latestManualSummary }
            : { events: data.latestEvents || [] } }));
        }
      } catch (err) {
        setErrorMsg('No se pudo conectar con la base de datos: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentMonth || eventsCache[currentMonth]) return;
    (async () => {
      const res = await fetch('/api/period/' + encodeURIComponent(currentMonth));
      const data = await res.json();
      setEventsCache(prev => ({ ...prev, [currentMonth]: data.isManual
        ? { isManual: true, manualSummary: data.manualSummary }
        : { events: data.events || [] } }));
    })();
  }, [currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (periods.length < 2) return;
    const missing = periods.map(p => p.month_key).filter(k => !eventsCache[k]);
    if (!missing.length) return;
    (async () => {
      const results = await Promise.all(missing.map(async k => {
        const res = await fetch('/api/period/' + encodeURIComponent(k));
        const data = await res.json();
        return [k, data.isManual ? { isManual: true, manualSummary: data.manualSummary } : { events: data.events || [] }];
      }));
      setEventsCache(prev => {
        const next = { ...prev };
        results.forEach(([k, ev]) => { next[k] = ev; });
        return next;
      });
    })();
  }, [periods]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    if (!currentMonth || !eventsCache[currentMonth]) return null;
    const entry = eventsCache[currentMonth];
    if (entry.isManual) return computeStatsManual(entry.manualSummary, consumersSummary, config);
    return computeStats(entry.events, consumersSummary, config);
  }, [currentMonth, eventsCache, consumersSummary, config]);

  useEffect(() => {
    if (periods.length < 2) { setTrendStats({}); return; }
    const t = {};
    periods.forEach(p => {
      const entry = eventsCache[p.month_key];
      if (!entry) return;
      const s = entry.isManual
        ? computeStatsManual(entry.manualSummary, consumersSummary, config)
        : computeStats(entry.events, consumersSummary, config);
      t[p.month_key] = { revenue: s.revenue, isManual: !!entry.isManual };
    });
    setTrendStats(t);
  }, [periods, eventsCache, consumersSummary, config]);

  async function persistConfig(next) {
    setConfig(next);
    try {
      await fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next)
      });
    } catch (e) {}
  }
  function handlePrecioChange(dur, value) {
    persistConfig({ ...config, precios: { ...config.precios, [dur]: parseFloat(value) || 0 } });
  }
  function handleConsultoriosChange(value) {
    persistConfig({ ...config, consultorios: parseInt(value, 10) || 1 });
  }
  function handleHorasChange(value) {
    persistConfig({ ...config, horasConsultorio: parseFloat(value) || 1 });
  }

  async function saveGoal(monthKey, revenueTarget, occupancyTarget) {
    setGoals(prev => ({ ...prev, [monthKey]: { month_key: monthKey, revenue_target: revenueTarget, occupancy_target: occupancyTarget } }));
    try {
      await fetch('/api/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, revenueTarget, occupancyTarget })
      });
    } catch (e) {}
  }

  async function handleUploadCSV() {
    setUploadStatus({ msg: '', err: false });
    const evFile = fileEventsRef.current?.files?.[0];
    const coFile = fileConsumersRef.current?.files?.[0];
    if (!evFile) { setUploadStatus({ msg: 'Falta el archivo de turnos (events).', err: true }); return; }
    try {
      const evText = await evFile.text();
      const events = eventsFromCSV(evText);
      let consumers = null;
      if (coFile) { consumers = consumersFromCSV(await coFile.text()); }
      const key = monthKeyFromEvents(events);
      if (!key) { setUploadStatus({ msg: 'No se pudo determinar el período del archivo.', err: true }); return; }
      const res = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events, consumers })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEventsCache(prev => ({ ...prev, [key]: { events } }));
      setPeriods(prev => {
        const others = prev.filter(p => p.month_key !== key);
        return [{ month_key: key, event_count: events.length, uploaded_at: new Date().toISOString(), is_manual: false }, ...others]
          .sort((a, b) => b.month_key.localeCompare(a.month_key));
      });
      if (consumers) {
        const boot = await (await fetch('/api/bootstrap')).json();
        if (!boot.error) setConsumersSummary(boot.consumers);
      }
      setCurrentMonth(key);
      setUploadStatus({ msg: `Período ${key} cargado (${events.length} turnos).`, err: false });
    } catch (err) {
      setUploadStatus({ msg: 'Error al procesar: ' + err.message, err: true });
    }
  }

  async function handleManualSave(monthKey, summary) {
    setUploadStatus({ msg: '', err: false });
    try {
      const res = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true, monthKey, manualSummary: summary })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEventsCache(prev => ({ ...prev, [monthKey]: { isManual: true, manualSummary: { ...summary, monthKey } } }));
      setPeriods(prev => {
        const others = prev.filter(p => p.month_key !== monthKey);
        return [{ month_key: monthKey, event_count: summary.booked || 0, uploaded_at: new Date().toISOString(), is_manual: true }, ...others]
          .sort((a, b) => b.month_key.localeCompare(a.month_key));
      });
      setCurrentMonth(monthKey);
      setUploadStatus({ msg: `Período ${monthKey} cargado manualmente.`, err: false });
    } catch (err) {
      setUploadStatus({ msg: 'Error al guardar: ' + err.message, err: true });
    }
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'var(--sans)' }}>Cargando panel…</div>;
  if (errorMsg) return <div style={{ padding: 40, fontFamily: 'var(--sans)', color: '#C0562F' }}>{errorMsg}</div>;

  return (
    <Dashboard
      config={config} periods={periods} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
      stats={stats} trendStats={trendStats} goals={goals} saveGoal={saveGoal}
      showConfig={showConfig} setShowConfig={setShowConfig}
      showUpload={showUpload} setShowUpload={setShowUpload}
      uploadTab={uploadTab} setUploadTab={setUploadTab}
      onConsultoriosChange={handleConsultoriosChange} onHorasChange={handleHorasChange}
      onPrecioChange={handlePrecioChange}
      fileEventsRef={fileEventsRef} fileConsumersRef={fileConsumersRef}
      onUploadCSV={handleUploadCSV} onManualSave={handleManualSave} uploadStatus={uploadStatus}
      name={name} username={username} onLogout={handleLogout}
    />
  );
}

const SECTIONS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'capacidad', label: 'Capacidad y objetivo' },
  { id: 'equipo', label: 'Profesionales' },
  { id: 'horarios', label: 'Horarios' },
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'simulador', label: 'Simulador' },
  { id: 'tendencia', label: 'Tendencia' },
  { id: 'oportunidad', label: 'Oportunidad' },
];

function Dashboard({
  config, periods, currentMonth, setCurrentMonth, stats, trendStats, goals, saveGoal,
  showConfig, setShowConfig, showUpload, setShowUpload, uploadTab, setUploadTab,
  onConsultoriosChange, onHorasChange, onPrecioChange,
  fileEventsRef, fileConsumersRef, onUploadCSV, onManualSave, uploadStatus,
  name, username, onLogout
}) {
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img src={LOGO_DATA_URI} alt="CND" />
            <div className="topbar-title">
              <span className="app-name">Panel de Ocupación &amp; Facturación</span>
              <span className="app-sub">Centro de Nutrición y Deporte · Cipolletti</span>
            </div>
          </div>
          <div className="topbar-spacer" />
          <select className="pill-select" value={currentMonth || ''} onChange={e => setCurrentMonth(e.target.value)}>
            {periods.map(p => <option key={p.month_key} value={p.month_key}>{p.month_key}{p.is_manual ? ' (manual)' : ''}</option>)}
          </select>
          <button className="icon-btn" onClick={() => setShowConfig(v => !v)}>⚙ Configurar</button>
          <button className="icon-btn primary" onClick={() => setShowUpload(v => !v)}>+ Cargar período</button>
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginLeft: 4 }}>{name}</span>
          <button className="icon-btn" onClick={onLogout}>Salir</button>
        </div>
      </div>

      <nav className="section-nav">
        {SECTIONS.map(s => <a key={s.id} href={'#' + s.id}>{s.label}</a>)}
        <a href="#caja">Caja y comisiones</a>
      </nav>

      <div className="wrap">
        {showConfig && (
          <section className="card">
            <ConfigPanel config={config} onConsultoriosChange={onConsultoriosChange}
              onHorasChange={onHorasChange} onPrecioChange={onPrecioChange} />
          </section>
        )}

        {showUpload && (
          <section className="card">
            <UploadPanel uploadTab={uploadTab} setUploadTab={setUploadTab}
              fileEventsRef={fileEventsRef} fileConsumersRef={fileConsumersRef}
              onUploadCSV={onUploadCSV} onManualSave={onManualSave} uploadStatus={uploadStatus} />
          </section>
        )}

        {!stats ? (
          <div style={{ padding: '40px 0', fontFamily: 'var(--mono)' }}>Cargando datos del período…</div>
        ) : (
          <>
            <section id="resumen"><div className="card"><KPISection stats={stats} /></div></section>
            <section id="capacidad"><div className="card">
              <CapacitySection stats={stats} goal={goals[currentMonth]} onSaveGoal={(rt, ot) => saveGoal(currentMonth, rt, ot)} />
            </div></section>
            {!stats.isManual && (
              <section id="equipo"><div className="card"><ResourceServiceSection stats={stats} /></div></section>
            )}
            {!stats.isManual && (
              <section id="horarios"><div className="card"><HeatmapSection stats={stats} /></div></section>
            )}
            <section id="pacientes"><div className="card"><StatusPatientsSection stats={stats} /></div></section>
            <section id="simulador"><div className="card">
              <SimulatorSection stats={stats} config={config} currentMonth={currentMonth} onSaveGoal={(rt, ot) => saveGoal(currentMonth, rt, ot)} />
            </div></section>
            {periods.length >= 2 && (
              <section id="tendencia"><div className="card"><TrendSection periods={periods} trendStats={trendStats} /></div></section>
            )}
            {!stats.isManual && (
              <section id="oportunidad"><div className="card"><RecoSection stats={stats} /></div></section>
            )}
          </>
        )}

        <section id="caja"><div className="card"><CajaComisionesSection /></div></section>

        <footer>Xenom — panel de gestión para Centro de Nutrición y Deporte · datos en Supabase, actualizables desde este panel</footer>
      </div>
    </>
  );
}

function ConfigPanel({ config, onConsultoriosChange, onHorasChange, onPrecioChange }) {
  const durations = Object.keys(config.precios || {}).sort((a, b) => a - b);
  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Configuración</h2><span className="note">se guarda en Supabase</span></div>
      <div className="cols2">
        <div>
          <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Capacidad instalada</h3>
          <table className="plain">
            <tbody>
              <tr><th>Consultorios</th><td><input type="number" min="1" style={{ width: 70 }} value={config.consultorios} onChange={e => onConsultoriosChange(e.target.value)} /></td></tr>
              <tr><th>Horas / semana por consultorio</th><td><input type="number" min="1" style={{ width: 70 }} value={config.horasConsultorio} onChange={e => onHorasChange(e.target.value)} /></td></tr>
              <tr><th>Capacidad semanal total (calc.)</th><td style={{ fontFamily: 'var(--mono)' }}>{config.consultorios * config.horasConsultorio} h/semana</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Ajustá esto si suman un consultorio, extienden el horario o cambia la dotación.</p>
        </div>
        <div>
          <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Precios por duración de consulta</h3>
          <table className="plain">
            <thead><tr><th>Duración</th><th>Precio</th><th></th></tr></thead>
            <tbody>
              {durations.map(d => (
                <tr key={d}>
                  <td>{d} min</td>
                  <td><input type="number" step="1000" style={{ width: 90 }} value={config.precios[d]} onChange={e => onPrecioChange(d, e.target.value)} /></td>
                  <td>{!isPriceConfirmed(d) && <span className="tag">sin confirmar</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function UploadPanel({ uploadTab, setUploadTab, fileEventsRef, fileConsumersRef, onUploadCSV, onManualSave, uploadStatus }) {
  const [mMonth, setMMonth] = useState('');
  const [mBooked, setMBooked] = useState('');
  const [mCancelled, setMCancelled] = useState('');
  const [mNoshow, setMNoshow] = useState('');
  const [mHoras, setMHoras] = useState('');
  const [mRevenue, setMRevenue] = useState('');
  const [mWeeks, setMWeeks] = useState('4');

  function submitManual() {
    if (!mMonth) return;
    onManualSave(mMonth, {
      booked: parseInt(mBooked, 10) || 0,
      cancelled: parseInt(mCancelled, 10) || 0,
      noshow: parseInt(mNoshow, 10) || 0,
      horasOcupadas: parseFloat(mHoras) || 0,
      revenue: parseFloat(mRevenue) || 0,
      weeks: parseFloat(mWeeks) || 4
    });
  }

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Cargar período</h2></div>
      <div className="tabbar">
        <button className={uploadTab === 'csv' ? 'active' : ''} onClick={() => setUploadTab('csv')}>Desde CSV (drManager)</button>
        <button className={uploadTab === 'manual' ? 'active' : ''} onClick={() => setUploadTab('manual')}>Carga manual (mes sin CSV)</button>
      </div>

      {uploadTab === 'csv' ? (
        <div className="upload-block">
          <div className="upload-item"><label>Export de turnos (events-*.csv)</label><input type="file" accept=".csv" ref={fileEventsRef} /></div>
          <div className="upload-item"><label>Export de pacientes (consumers-*.csv)</label><input type="file" accept=".csv" ref={fileConsumersRef} /></div>
          <button className="icon-btn primary" onClick={onUploadCSV}>Procesar y guardar</button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>
            Para meses de los que no tenés el CSV de drManager, cargá los totales a mano. No vas a tener el desglose por
            profesional ni el mapa de calor de ese mes, pero sí entra en la facturación y la tendencia.
          </p>
          <div className="manual-grid">
            <div className="field"><label>Mes</label><input type="month" value={mMonth} onChange={e => setMMonth(e.target.value)} /></div>
            <div className="field"><label>Turnos reservados</label><input type="number" value={mBooked} onChange={e => setMBooked(e.target.value)} /></div>
            <div className="field"><label>Cancelados</label><input type="number" value={mCancelled} onChange={e => setMCancelled(e.target.value)} /></div>
            <div className="field"><label>Ausentes</label><input type="number" value={mNoshow} onChange={e => setMNoshow(e.target.value)} /></div>
            <div className="field"><label>Horas ocupadas totales</label><input type="number" value={mHoras} onChange={e => setMHoras(e.target.value)} /></div>
            <div className="field"><label>Facturación estimada ($)</label><input type="number" value={mRevenue} onChange={e => setMRevenue(e.target.value)} /></div>
            <div className="field"><label>Semanas del período</label><input type="number" value={mWeeks} onChange={e => setMWeeks(e.target.value)} /></div>
          </div>
          <button className="icon-btn primary" onClick={submitManual}>Guardar período manual</button>
        </>
      )}
      {uploadStatus.msg && <div style={{ marginTop: 12 }}><span className={'status-msg' + (uploadStatus.err ? ' err' : '')}>{uploadStatus.msg}</span></div>}
    </>
  );
}

function KPISection({ stats: s }) {
  const items = [
    { label: 'Facturación estimada', value: fmtMoney(s.revenue), foot: s.isManual ? 'carga manual' : (s.revenuePlaceholder > 0 ? `incluye ${fmtMoney(s.revenuePlaceholder)} con tarifa sin confirmar` : 'sobre turnos reservados'), cls: '' },
    { label: 'Ocupación de consultorios', value: s.ocupacionPct.toFixed(1) + '%', foot: `${fmtHoras(s.totalMin)} de ${s.capacidadTotalHoras.toFixed(0)}h disponibles`, cls: s.ocupacionPct < 55 ? 'rust' : 'gold' },
    { label: 'Facturación potencial a full', value: fmtMoney(s.revenuePotencial), foot: 'con la misma mezcla de hoy', cls: 'gold' },
    { label: 'Turnos reservados', value: s.booked, foot: `${s.cancelled} cancelados · ${s.noshow} ausentes`, cls: '' },
    { label: 'Ticket promedio', value: fmtMoney(s.booked ? s.revenue / s.booked : 0), foot: 'por consulta', cls: '' },
    { label: 'Pacientes en base', value: s.pacientesTotal.toLocaleString('es-AR'), foot: 'histórico acumulado', cls: '' },
  ];
  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Resumen del período</h2>
        <span className="note">{s.isManual ? 'carga manual' : `${s.dayMin} → ${s.dayMax}`} · {s.weeks.toFixed(1)} semanas</span></div>
      <div className="kpi-grid">
        {items.map((i, idx) => (
          <div className={'kpi' + (i.cls ? ' ' + i.cls : '')} key={idx}>
            <div className="label">{i.label}</div>
            <div className={'value' + (i.cls ? ' ' + i.cls : '')}>{i.value}</div>
            <div className="foot">{i.foot}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function CapacitySection({ stats: s, goal, onSaveGoal }) {
  const pct = s.ocupacionPct;
  const horasLibres = Math.max(0, s.capacidadTotalHoras - s.horasOcupadas);
  const [rt, setRt] = useState(goal?.revenue_target || '');
  const [ot, setOt] = useState(goal?.occupancy_target || '');
  const prog = goalProgress(s, goal);

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Uso de la capacidad instalada</h2></div>
      <div className="cap-bar-track">
        <div className="cap-bar-fill" style={{ width: pct + '%' }}><span className="cap-bar-label">{pct.toFixed(1)}%</span></div>
      </div>
      <div className="cap-legend">
        <span><span className="dot-sm sage" /> Horas ocupadas</span>
        <span><span className="dot-sm gold" /> Horas disponibles sin turno</span>
      </div>
      <div className="gap-callout">
        {pct < 100 ? (
          <>Quedan <b>{horasLibres.toFixed(0)} horas</b> libres en el período — a la tarifa promedio actual
            ({fmtMoney(s.revenuePorHora)}/h) son <b>{fmtMoney(horasLibres * s.revenuePorHora)}</b> sin facturar,
            solo llenando la agenda existente.</>
        ) : (
          <>Los consultorios están al límite de la capacidad configurada. El paso siguiente es sumar horas,
            un consultorio, o un profesional.</>
        )}
      </div>

      <div className="goal-box">
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 12, color: 'var(--primary-dark)' }}>Objetivo comercial de este mes</div>
        <div className="goal-row">
          <span className="glabel">Facturación objetivo</span>
          <input type="number" step="10000" placeholder="ej: 8000000" style={{ width: 130 }} value={rt}
            onChange={e => setRt(e.target.value)} onBlur={() => onSaveGoal(parseFloat(rt) || 0, parseFloat(ot) || 0)} />
          {prog?.revenuePct != null && (
            <>
              <div className="goal-track"><div className={'goal-fill' + (prog.revenuePct >= 100 ? ' over' : '')} style={{ width: Math.min(100, prog.revenuePct) + '%' }} /></div>
              <span className="goal-val">{prog.revenuePct.toFixed(0)}%</span>
            </>
          )}
        </div>
        <div className="goal-row">
          <span className="glabel">Ocupación objetivo</span>
          <input type="number" step="1" placeholder="ej: 70" style={{ width: 130 }} value={ot}
            onChange={e => setOt(e.target.value)} onBlur={() => onSaveGoal(parseFloat(rt) || 0, parseFloat(ot) || 0)} />
          {prog?.occupancyPct != null && (
            <>
              <div className="goal-track"><div className={'goal-fill' + (prog.occupancyPct >= 100 ? ' over' : '')} style={{ width: Math.min(100, prog.occupancyPct) + '%' }} /></div>
              <span className="goal-val">{prog.occupancyPct.toFixed(0)}%</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ResourceServiceSection({ stats: s }) {
  const resArr = Object.entries(s.porProfesional).sort((a, b) => b[1].min - a[1].min);
  const resMax = resArr.length ? resArr[0][1].min : 1;
  const svcArr = Object.entries(s.porServicio).sort((a, b) => b[1].revenue - a[1].revenue);
  const svcMax = svcArr.length ? svcArr[0][1].revenue : 1;
  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Profesionales y mezcla de servicios</h2></div>
      <div className="cols2">
        <div>
          <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Horas reservadas por profesional</h3>
          <div className="barlist">
            {resArr.map(([name, d]) => (
              <div className="barrow" key={name}>
                <div className="name">{name}</div>
                <div className="track"><div className="fill" style={{ width: (d.min / resMax * 100) + '%' }} /></div>
                <div className="val">{fmtHoras(d.min)} · {d.count}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Facturación por tipo de consulta</h3>
          <div className="barlist">
            {svcArr.map(([name, d]) => (
              <div className="barrow" key={name}>
                <div className="name">{name.replace('Nutrición / ', '').replace('Nutrición Infantil / ', 'Infantil: ')}</div>
                <div className="track"><div className={'fill' + (isPriceConfirmed(d.duration) ? '' : ' gold')} style={{ width: (d.revenue / svcMax * 100) + '%' }} /></div>
                <div className="val">{fmtMoney(d.revenue)} · {d.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function HeatmapSection({ stats: s }) {
  const maxVal = Math.max(1, ...DOW_ORDER.flatMap(d => HOURS.map(h => s.heat[d][h])));
  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Mapa de calor: día × horario</h2><span className="note">turnos reservados</span></div>
      <div className="heatmap">
        <table className="heat">
          <thead><tr><th className="rowlabel"></th>{HOURS.map(h => <th key={h}>{h}h</th>)}</tr></thead>
          <tbody>
            {DOW_ORDER.map(d => (
              <tr key={d}>
                <td className="rowlabel">{DOW_ES[d]}</td>
                {HOURS.map(h => {
                  const v = s.heat[d][h];
                  const intensity = v / maxVal;
                  const bg = v === 0 ? 'var(--surface-alt)' : `rgba(31,122,104,${0.18 + intensity * 0.7})`;
                  const color = intensity > 0.5 ? '#fff' : 'var(--primary-dark)';
                  return <td key={h} style={{ background: bg, color }}>{v || ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusPatientsSection({ stats: s }) {
  const total = s.totalEvents || 1;
  const rows = [
    ['Reservados (booked)', s.booked, s.booked / total],
    ['Cancelados', s.cancelled, s.cancelled / total],
    ['Ausentes (no-show)', s.noshow, s.noshow / total],
  ];
  const weeks = Object.keys(s.pacientesWeekly).sort();
  const last = weeks.slice(-10);
  const max = Math.max(1, ...last.map(k => s.pacientesWeekly[k]));
  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Ausentismo, cancelaciones y base de pacientes</h2></div>
      <div className="cols2">
        <div>
          <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Estado de los turnos</h3>
          <table className="plain">
            <tbody>
              <tr><th>Estado</th><th>Turnos</th><th>%</th></tr>
              {rows.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{(r[2] * 100).toFixed(1)}%</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Pacientes nuevos por semana</h3>
          <div className="trend-row" style={{ height: 100 }}>
            {last.map(k => (
              <div className="trend-col" key={k}>
                <div className="amt">{s.pacientesWeekly[k]}</div>
                <div className="bar" style={{ height: (s.pacientesWeekly[k] / max * 70) + 8 }} />
                <div className="lbl">{k.slice(5)}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 8 }}>
            La primera semana suele incluir la migración histórica de pacientes al sistema, no altas orgánicas puntuales.
          </p>
        </div>
      </div>
    </>
  );
}

function SimulatorSection({ stats: s, config, currentMonth, onSaveGoal }) {
  const [ocupacion, setOcupacion] = useState(Math.round(s.ocupacionPct) || 50);
  const [consultorios, setConsultorios] = useState(config.consultorios);
  const [horas, setHoras] = useState(config.horasConsultorio);
  const [precioMult, setPrecioMult] = useState(1);

  useEffect(() => { setOcupacion(Math.round(s.ocupacionPct) || 50); }, [s.ocupacionPct]);
  useEffect(() => { setConsultorios(config.consultorios); setHoras(config.horasConsultorio); }, [config.consultorios, config.horasConsultorio]);

  const proj = simulateScenario(s, {
    ocupacionObjetivoPct: ocupacion, consultorios, horasConsultorio: horas,
    multiplicadorPrecio: precioMult, weeks: s.weeks
  });
  const deltaVsActual = proj.revenueProyectado - s.revenue;

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Simulador de escenarios</h2>
        <span className="note">a partir de la facturación por hora actual ({fmtMoney(s.revenuePorHora)}/h)</span></div>
      <div className="sim-grid">
        <div>
          <div className="sim-control">
            <label>Ocupación objetivo <b>{ocupacion}%</b></label>
            <input type="range" min="10" max="100" value={ocupacion} onChange={e => setOcupacion(parseInt(e.target.value, 10))} />
          </div>
          <div className="sim-control">
            <label>Consultorios <b>{consultorios}</b></label>
            <input type="range" min="1" max="6" value={consultorios} onChange={e => setConsultorios(parseInt(e.target.value, 10))} />
          </div>
          <div className="sim-control">
            <label>Horas / semana por consultorio <b>{horas}h</b></label>
            <input type="range" min="8" max="60" value={horas} onChange={e => setHoras(parseInt(e.target.value, 10))} />
          </div>
          <div className="sim-control">
            <label>Ajuste general de tarifas <b>{precioMult === 1 ? 'sin cambio' : (precioMult > 1 ? '+' : '') + Math.round((precioMult - 1) * 100) + '%'}</b></label>
            <input type="range" min="0.7" max="1.5" step="0.01" value={precioMult} onChange={e => setPrecioMult(parseFloat(e.target.value))} />
          </div>
        </div>
        <div className="sim-result">
          <div className="lbl">Facturación proyectada / mes*</div>
          <div className="big">{fmtMoney(proj.revenueProyectado)}</div>
          <div className="delta">
            vs. facturación actual del período: <b>{deltaVsActual >= 0 ? '+' : ''}{fmtMoney(deltaVsActual)}</b>
          </div>
          <div className="delta">Capacidad total simulada: {proj.capacidadTotalHoras.toFixed(0)}h · horas a ocupar: {proj.horasProyectadas.toFixed(0)}h</div>
          <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 14 }}>*Proyección lineal sobre {s.weeks.toFixed(1)} semanas, asumiendo que la facturación por hora se mantiene constante al cambiar ocupación o capacidad. El ajuste de tarifas sí multiplica directamente ese valor.</p>
          <button className="icon-btn primary" style={{ marginTop: 8 }}
            onClick={() => onSaveGoal(proj.revenueProyectado, ocupacion)}>
            Usar este escenario como objetivo de {currentMonth}
          </button>
        </div>
      </div>
    </>
  );
}

function TrendSection({ periods, trendStats }) {
  const keys = periods.map(p => p.month_key).slice().sort();
  const max = Math.max(1, ...keys.map(k => trendStats[k]?.revenue || 0));
  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Evolución mes a mes</h2><span className="note">arena = carga manual</span></div>
      <div className="trend-row">
        {keys.map(k => {
          const t = trendStats[k];
          return (
            <div className="trend-col" key={k}>
              <div className="amt">{t ? fmtMoney(t.revenue) : '…'}</div>
              <div className={'bar' + (t?.isManual ? ' manual' : '')} style={{ height: ((t?.revenue || 0) / max * 110) + 6 }} />
              <div className="lbl">{k}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function RecoSection({ stats: s }) {
  const tb = topBottom(s);
  const horasLibres = Math.max(0, s.capacidadTotalHoras - s.horasOcupadas);
  const particularShare = s.booked ? ((s.porFinanciador['Particular'] || 0) / s.booked * 100) : 0;
  const financiadorEntries = Object.entries(s.porFinanciador);

  const cards = [
    { h: 'Llenar la agenda antes que buscar pacientes nuevos',
      p: `Hoy se usa ${s.ocupacionPct.toFixed(0)}% de la capacidad. Cerrar esa brecha (${horasLibres.toFixed(0)}h libres) vale ${fmtMoney(horasLibres * s.revenuePorHora)} adicionales con la base que ya tienen.` },
    { h: `${DOW_ES[tb.bottom.d]} está subutilizado`,
      p: `Frente a ${DOW_ES[tb.top.d]} (el día más ocupado), ${DOW_ES[tb.bottom.d]} es candidato para promociones puntuales o actividades grupales.` },
    { h: `Franja de ${tb.idleHour.h}:00 con menos demanda`,
      p: `Puede reservarse para seguimientos cortos por videollamada, nutrición infantil, o cerrarse si no compensa.` },
    { h: 'Auditar financiadores / convenios',
      p: `${particularShare.toFixed(0)}% de los turnos identificados figuran "Particular"${financiadorEntries.length <= 1 ? ' (el resto sin cargar)' : ''}. Vale revisar convenios con obras sociales o prepagas.` },
    { h: 'Nuevas unidades: deporte + nutrición',
      p: `Convenios con clubes locales, planes corporativos de bienestar y talleres grupales — facturables en las franjas hoy más vacías.` },
    { h: 'Bioimpedancia y antropometría como upsell',
      p: `Servicios cortos (20–30 min), hoy con precio sin confirmar. Como complemento pago del control, suman sin ocupar franjas completas.` },
  ];

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Dónde está la oportunidad</h2></div>
      <div className="reco-grid">
        {cards.map((c, i) => (
          <div className="reco" key={i}>
            <div className="idx">{String(i + 1).padStart(2, '0')}</div>
            <h3>{c.h}</h3>
            <p>{c.p}</p>
          </div>
        ))}
      </div>
    </>
  );
}
