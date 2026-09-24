'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/stats';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function CajaComisionesSection() {
  const [desde, setDesde] = useState(firstOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [resumen, setResumen] = useState(null);
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function cargar() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [resRes, cfgRes] = await Promise.all([
        fetch(`/api/caja-resumen?desde=${desde}&hasta=${hasta}`),
        fetch('/api/comisiones-config')
      ]);
      const resData = await resRes.json();
      const cfgData = await cfgRes.json();
      if (resData.error) throw new Error(resData.error);
      setResumen(resData);
      setConfig(cfgData.config || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePct(profesional, pct) {
    setConfig(prev => {
      const others = prev.filter(c => c.profesional !== profesional);
      return [...others, { profesional, pct_profesional: pct }];
    });
    try {
      await fetch('/api/comisiones-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesional, pctProfesional: pct })
      });
    } catch (e) {}
  }

  const defaultPct = config.find(c => c.profesional === '__default__')?.pct_profesional ?? 60;
  const profesionalRows = resumen ? Object.entries(resumen.porProfesional || {}) : [];
  const medioPagoRows = resumen ? Object.entries(resumen.porMedioPago || {}) : [];

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Caja y comisiones</h2>
        <span className="note">visible solo para dirección</span></div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4 }}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4 }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <button className="icon-btn primary" onClick={cargar}>{loading ? 'Cargando…' : 'Actualizar'}</button>
      </div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      {resumen && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <div className="kpi">
              <div className="label">Total cobrado</div>
              <div className="value">{fmtMoney(resumen.totalCobrado)}</div>
              <div className="foot">{resumen.cantidadCobros} cobros registrados</div>
            </div>
            <div className="kpi">
              <div className="label">Comisiones a pagar</div>
              <div className="value gold">{fmtMoney(resumen.totalComisionProfesionales)}</div>
              <div className="foot">a profesionales, según % configurado</div>
            </div>
            <div className="kpi">
              <div className="label">Queda para el centro</div>
              <div className="value">{fmtMoney(resumen.totalCentro)}</div>
              <div className="foot">total cobrado − comisiones</div>
            </div>
          </div>

          <div className="cols2">
            <div>
              <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Por profesional</h3>
              <table className="plain">
                <thead><tr><th>Profesional</th><th>Cobrado</th><th>Comisión</th><th>Turnos</th></tr></thead>
                <tbody>
                  {profesionalRows.map(([name, d]) => (
                    <tr key={name}><td>{name}</td><td>{fmtMoney(d.monto)}</td><td>{fmtMoney(d.comision)}</td><td>{d.count}</td></tr>
                  ))}
                  {!profesionalRows.length && <tr><td colSpan={4} style={{ color: 'var(--ink-faint)' }}>Sin cobros registrados en el rango.</td></tr>}
                </tbody>
              </table>
            </div>
            <div>
              <h3 style={{ marginTop: 0, fontSize: 13.5, fontWeight: 700 }}>Por medio de pago</h3>
              <table className="plain">
                <thead><tr><th>Medio</th><th>Monto</th></tr></thead>
                <tbody>
                  {medioPagoRows.map(([medio, monto]) => (
                    <tr key={medio}><td>{medio}</td><td>{fmtMoney(monto)}</td></tr>
                  ))}
                  {!medioPagoRows.length && <tr><td colSpan={2} style={{ color: 'var(--ink-faint)' }}>Sin cobros registrados en el rango.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <h3 style={{ fontSize: 13.5, fontWeight: 700, marginTop: 28 }}>Configuración de comisiones (% para el profesional)</h3>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: -6 }}>
        Por defecto es {defaultPct}% para el profesional / {100 - defaultPct}% para el centro. Se puede definir un % distinto por profesional.
      </p>
      <table className="plain">
        <thead><tr><th>Profesional</th><th>% profesional</th><th>% centro</th></tr></thead>
        <tbody>
          <tr>
            <td><i>Por defecto (todos los que no tengan un % propio)</i></td>
            <td><input type="number" min="0" max="100" style={{ width: 70 }} defaultValue={defaultPct}
              onBlur={e => savePct('__default__', parseFloat(e.target.value) || 0)} /></td>
            <td>{100 - defaultPct}%</td>
          </tr>
          {config.filter(c => c.profesional !== '__default__').map(c => (
            <tr key={c.profesional}>
              <td>{c.profesional}</td>
              <td><input type="number" min="0" max="100" style={{ width: 70 }} defaultValue={c.pct_profesional}
                onBlur={e => savePct(c.profesional, parseFloat(e.target.value) || 0)} /></td>
              <td>{100 - c.pct_profesional}%</td>
            </tr>
          ))}
          {profesionalRows.filter(([name]) => !config.some(c => c.profesional === name)).map(([name]) => (
            <tr key={name}>
              <td>{name}</td>
              <td><input type="number" min="0" max="100" style={{ width: 70 }} defaultValue={defaultPct}
                onBlur={e => savePct(name, parseFloat(e.target.value) || 0)} /></td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
