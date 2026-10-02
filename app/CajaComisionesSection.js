'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/stats';
import LoadingSkeleton from './LoadingSkeleton';
import ConfirmModal from './ConfirmModal';
import Avatar from './Avatar';

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

function fmtFechaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function imprimirCierre({ fecha, resumen, cerradoPor, cerradoEn }) {
  const profRows = Object.entries(resumen.porProfesional || {})
    .map(([name, d]) => `<tr><td>${name}</td><td>$${Math.round(d.monto).toLocaleString('es-AR')}</td><td>$${Math.round(d.comision).toLocaleString('es-AR')}</td><td>${d.count}</td></tr>`).join('');
  const medioRows = Object.entries(resumen.porMedioPago || {})
    .map(([medio, monto]) => `<tr><td>${medio}</td><td>$${Math.round(monto).toLocaleString('es-AR')}</td></tr>`).join('');
  const w = window.open('', '_blank', 'width=460,height=700');
  w.document.write(`
    <html><head><title>Cierre de caja — ${fecha}</title>
    <style>
      body{font-family:sans-serif;padding:28px;color:#15272A;}
      h1{font-size:16px;margin:0 0 2px;text-transform:capitalize;}
      .sub{font-size:11px;color:#5C6E70;margin-bottom:18px;}
      h2{font-size:12.5px;margin:18px 0 6px;}
      table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:10px;}
      td,th{padding:5px 0;border-bottom:1px solid #eee;text-align:left;}
      .total{font-size:17px;font-weight:700;margin-top:12px;}
      .firma{margin-top:50px;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#5C6E70;width:220px;}
    </style></head><body>
    <h1>Cierre de caja — ${fmtFechaLarga(fecha)}</h1>
    <div class="sub">Cerrado por ${cerradoPor || '-'}${cerradoEn ? ' · ' + new Date(cerradoEn).toLocaleString('es-AR') : ''}</div>
    <h2>Por medio de pago</h2>
    <table><tbody>${medioRows || '<tr><td>Sin cobros</td></tr>'}</tbody></table>
    <h2>Por profesional (comisiones)</h2>
    <table><thead><tr><th>Profesional</th><th>Cobrado</th><th>Comisión</th><th>Turnos</th></tr></thead><tbody>${profRows || '<tr><td colSpan=4>Sin cobros</td></tr>'}</tbody></table>
    <div class="total">Total cobrado: $${Math.round(resumen.totalCobrado).toLocaleString('es-AR')}</div>
    <div>Comisiones a pagar: $${Math.round(resumen.totalComisionProfesionales).toLocaleString('es-AR')}</div>
    <div>Queda para el centro: $${Math.round(resumen.totalCentro).toLocaleString('es-AR')}</div>
    <div class="firma">Firma</div>
    <script>window.print();</script>
    </body></html>
  `);
  w.document.close();
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
  const [modo, setModo] = useState('dia'); // 'dia' | 'mes' | 'rango'
  const [mes, setMes] = useState(currentMonthKey());
  const [desde, setDesde] = useState(firstOfMonthISO());
  const [hasta, setHasta] = useState(todayISO());
  const [fechaDia, setFechaDia] = useState(todayISO());
  const [cierreDia, setCierreDia] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const [confirmando, setConfirmando] = useState(null);
  const [pctGuardadoOk, setPctGuardadoOk] = useState(null);
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

  async function cargarDia(fecha) {
    const f = fecha || fechaDia;
    setLoading(true);
    setErrorMsg('');
    try {
      const [resRes, cfgRes, cierreRes] = await Promise.all([
        fetch(`/api/caja-resumen?desde=${f}&hasta=${f}`),
        fetch('/api/comisiones-config'),
        fetch(`/api/caja/cierre?fecha=${f}`)
      ]);
      const resData = await resRes.json();
      const cfgData = await cfgRes.json();
      const cierreData = await cierreRes.json();
      if (resData.error) throw new Error(resData.error);
      setResumen(resData);
      setConfig(cfgData.config || []);
      setCierreDia(cierreData.cierre || null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDia(todayISO());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMesChange(m) {
    setMes(m);
    const { desde: d, hasta: h } = monthRange(m);
    setDesde(d); setHasta(h);
    cargar(d, h);
  }

  function handleModoChange(m) {
    setModo(m);
    if (m === 'dia') cargarDia(fechaDia);
    else if (m === 'mes') { const { desde: d, hasta: h } = monthRange(mes); setDesde(d); setHasta(h); cargar(d, h); }
    else cargar(desde, hasta);
  }

  function handleFechaDiaChange(f) {
    setFechaDia(f);
    cargarDia(f);
  }

  async function cerrarCaja() {
    setCerrando(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/caja/cierre', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fecha: fechaDia }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCierreDia(data.cierre);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCerrando(false);
    }
  }

  async function reabrirCaja() {
    setCerrando(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/caja/cierre?fecha=${fechaDia}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCierreDia(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCerrando(false);
    }
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
      setPctGuardadoOk(profesional);
      setTimeout(() => setPctGuardadoOk(prev => (prev === profesional ? null : prev)), 1800);
    } catch (e) {}
  }

  function pedirCerrarCaja() {
    setConfirmando({
      mensaje: `¿Cerrar la caja del ${fmtFechaLarga(fechaDia)}? Queda un resumen fijo del día (${resumen?.cantidadCobros || 0} cobro(s) por ${fmtMoney(resumen?.totalCobrado || 0)}). Podés reabrirla después si hace falta.`,
      textoConfirmar: 'Cerrar caja',
      onConfirm: cerrarCaja
    });
  }

  function pedirReabrirCaja() {
    setConfirmando({
      mensaje: `¿Reabrir la caja del ${fmtFechaLarga(fechaDia)}? El resumen cerrado se borra; se vuelve a calcular en vivo a partir de los cobros.`,
      destructivo: true, textoConfirmar: 'Reabrir',
      onConfirm: reabrirCaja
    });
  }

  const defaultPct = config.find(c => c.profesional === '__default__')?.pct_profesional ?? 60;
  const profesionalRows = resumen ? Object.entries(resumen.porProfesional || {}) : [];
  const medioPagoRows = resumen ? Object.entries(resumen.porMedioPago || {}) : [];

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Caja y comisiones</h2>
        <span className="note">visible solo para dirección</span></div>

      <div className="tabbar">
        <button className={modo === 'dia' ? 'active' : ''} onClick={() => handleModoChange('dia')}>Cierre del día</button>
        <button className={modo === 'mes' ? 'active' : ''} onClick={() => handleModoChange('mes')}>Por mes</button>
        <button className={modo === 'rango' ? 'active' : ''} onClick={() => handleModoChange('rango')}>Rango personalizado</button>
      </div>

      {modo === 'dia' ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4 }}>Día</label>
            <input type="date" value={fechaDia} onChange={e => handleFechaDiaChange(e.target.value)} />
          </div>
          {loading && <div style={{ width: 90 }}><LoadingSkeleton lines={1} widths={['100%']} /></div>}
        </div>
      ) : modo === 'mes' ? (
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

      {modo === 'dia' && resumen && (
        <div className={'caja-status' + (cierreDia ? ' cerrada' : '')}>
          {cierreDia ? (
            <>
              <span className="icon-circle">✅</span>
              <div style={{ flex: 1 }}>
                <div className="titulo">Caja cerrada</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Por {cierreDia.cerrado_por || '-'} a las {fmtHora(cierreDia.cerrado_en)} · Total {fmtMoney(cierreDia.total_cobrado)}
                </div>
              </div>
              <button className="icon-btn" onClick={() => imprimirCierre({ fecha: fechaDia, resumen, cerradoPor: cierreDia.cerrado_por, cerradoEn: cierreDia.cerrado_en })}>Imprimir cierre</button>
              <button className="icon-btn" disabled={cerrando} onClick={pedirReabrirCaja}>{cerrando ? 'Reabriendo…' : 'Reabrir'}</button>
            </>
          ) : (
            <>
              <span className="icon-circle">🔓</span>
              <div style={{ flex: 1 }}>
                <div className="titulo">Caja todavía abierta</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  {resumen.cantidadCobros} cobro(s) por {fmtMoney(resumen.totalCobrado)} hasta ahora. Cerrala cuando termine el día.
                </div>
              </div>
              <button className="icon-btn primary" disabled={cerrando} onClick={pedirCerrarCaja}>{cerrando ? 'Cerrando…' : 'Cerrar caja del día'}</button>
            </>
          )}
        </div>
      )}

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
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar nombre={name} size={22} />
                            {name}
                          </div>
                        </td>
                        <td>{fmtMoney(d.monto)}</td><td>{fmtMoney(d.comision)}</td><td>{d.count}</td>
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
            <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min="0" max="100" style={{ width: 70 }} defaultValue={defaultPct}
                onBlur={e => savePct('__default__', parseFloat(e.target.value) || 0)} />
              {pctGuardadoOk === '__default__' && <span style={{ fontSize: 11.5, color: 'var(--sage)' }}>Guardado ✓</span>}
            </td>
            <td>{100 - defaultPct}%</td>
          </tr>
          {config.filter(c => c.profesional !== '__default__').map(c => (
            <tr key={c.profesional}>
              <td>{c.profesional}</td>
              <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min="0" max="100" style={{ width: 70 }} defaultValue={c.pct_profesional}
                  onBlur={e => savePct(c.profesional, parseFloat(e.target.value) || 0)} />
                {pctGuardadoOk === c.profesional && <span style={{ fontSize: 11.5, color: 'var(--sage)' }}>Guardado ✓</span>}
              </td>
              <td>{100 - c.pct_profesional}%</td>
            </tr>
          ))}
          {profesionalRows.filter(([name]) => !config.some(c => c.profesional === name)).map(([name]) => (
            <tr key={name}>
              <td>{name}</td>
              <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min="0" max="100" style={{ width: 70 }} defaultValue={defaultPct}
                  onBlur={e => savePct(name, parseFloat(e.target.value) || 0)} />
                {pctGuardadoOk === name && <span style={{ fontSize: 11.5, color: 'var(--sage)' }}>Guardado ✓</span>}
              </td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </>
  );
}
