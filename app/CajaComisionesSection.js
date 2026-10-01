'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/stats';
import LoadingSkeleton from './LoadingSkeleton';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}
function monthRange(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const desde = `${monthKey}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // día 0 del mes siguiente = último día del mes actual
  const hasta = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  return { desde, hasta };
}
function buildMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = -2; i < 40; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(d.toISOString().slice(0, 7));
  }
  return opts;
}

function imprimirLiquidacion({ profesional, desde, hasta, monto, comision, pct, count }) {
  const w = window.open('', '_blank', 'width=420,height=600');
  w.document.write(`
    <html><head><title>Liquidación — ${profesional}</title>
    <style>
      body{font-family:sans-serif;padding:28px;color:#15272A;}
      h1{font-size:16px;margin:0 0 2px;}
      .sub{font-size:11px;color:#5C6E70;margin-bottom:20px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      td{padding:6px 0;border-bottom:1px solid #eee;}
      td:first-child{color:#5C6E70;width:50%;}
      .total{font-size:18px;font-weight:700;margin-top:18px;}
      .firma{margin-top:60px;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#5C6E70;width:220px;}
    </style></head><body>
    <h1>Liquidación de comisión</h1>
    <div class="sub">${profesional} · ${desde} a ${hasta}</div>
    <table>
      <tr><td>Turnos cobrados</td><td>${count}</td></tr>
      <tr><td>Total cobrado</td><td>$${Math.round(monto).toLocaleString('es-AR')}</td></tr>
      <tr><td>% de comisión</td><td>${pct}%</td></tr>
    </table>
    <div class="total">A liquidar: $${Math.round(comision).toLocaleString('es-AR')}</div>
    <div class="firma">Firma</div>
    <script>window.print();</script>
    </body></html>
  `);
  w.document.close();
}

export default function CajaComisionesSection() {
  const [modo, setModo] = useState('mes'); // 'mes' | 'rango'
  const [mes, setMes] = useState(currentMonthKey());
  const [desde, setDesde] = useState(firstOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [resumen, setResumen] = useState(null);
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const monthOptions = buildMonthOptions();

  async function cargar(desdeArg, hastaArg) {
    const d = desdeArg || desde, h = hastaArg || hasta;
    setLoading(true);
    setErrorMsg('');
    try {
      const [resRes, cfgRes] = await Promise.all([
        fetch(`/api/caja-resumen?desde=${d}&hasta=${h}`),
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

  useEffect(() => {
    const { desde: d, hasta: h } = monthRange(mes);
    setDesde(d); setHasta(h);
    cargar(d, h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMesChange(m) {
    setMes(m);
    const { desde: d, hasta: h } = monthRange(m);
    setDesde(d); setHasta(h);
    cargar(d, h);
  }

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

      <div className="tabbar">
        <button className={modo === 'mes' ? 'active' : ''} onClick={() => setModo('mes')}>Por mes</button>
        <button className={modo === 'rango' ? 'active' : ''} onClick={() => setModo('rango')}>Rango personalizado</button>
      </div>

      {modo === 'mes' ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4 }}>Mes de cierre</label>
            <select className="pill-select" value={mes} onChange={e => handleMesChange(e.target.value)}>
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {loading && <div style={{ width: 90 }}><LoadingSkeleton lines={1} widths={['100%']} /></div>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4 }}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4 }}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <button className="icon-btn primary" onClick={() => cargar()}>{loading ? 'Cargando…' : 'Actualizar'}</button>
        </div>
      )}

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      {resumen && resumen.cantidadEstimados > 0 && (
        <div className="gap-callout" style={{ marginBottom: 18 }}>
          De los {resumen.cantidadCobros} cobros de este período, <b>{resumen.cantidadEstimados}</b> ({fmtMoney(resumen.totalEstimado)}) son
          estimados a partir de la agenda (sin medio de pago real cargado) — todavía no hay cobros reales cargados por la secretaria para este mes.
        </div>
      )}

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
                <thead><tr><th>Profesional</th><th>Cobrado</th><th>Comisión</th><th>Turnos</th><th></th></tr></thead>
                <tbody>
                  {profesionalRows.map(([name, d]) => {
                    const pct = config.find(c => c.profesional === name)?.pct_profesional ?? defaultPct;
                    return (
                      <tr key={name}>
                        <td>{name}</td><td>{fmtMoney(d.monto)}</td><td>{fmtMoney(d.comision)}</td><td>{d.count}</td>
                        <td>
                          <button className="icon-btn" style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => imprimirLiquidacion({ profesional: name, desde, hasta, monto: d.monto, comision: d.comision, pct, count: d.count })}>
                            Recibo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!profesionalRows.length && <tr><td colSpan={5} style={{ color: 'var(--ink-faint)' }}>Sin cobros registrados en el rango.</td></tr>}
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
