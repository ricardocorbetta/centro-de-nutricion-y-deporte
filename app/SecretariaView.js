'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_DATA_URI } from '../lib/logo';
import { fmtMoney } from '../lib/stats';
import AgendaBuilder from './AgendaBuilder';

function todayISO() { return new Date().toISOString().slice(0, 10); }

const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'MercadoPago'];

export default function SecretariaView({ name, username, empresa }) {
  const router = useRouter();
  const [tab, setTab] = useState('agenda');

  const [cobros, setCobros] = useState([]);
  const [form, setForm] = useState({
    fecha: todayISO(), pacienteNombre: '', pacienteTelefono: '',
    profesional: '', servicio: '', monto: '', medioPago: 'Efectivo'
  });
  const [formStatus, setFormStatus] = useState({ msg: '', err: false });

  const [resumenHoy, setResumenHoy] = useState(null);
  const [profesionales, setProfesionales] = useState([]);

  async function cargarCobrosHoy() {
    try {
      const res = await fetch(`/api/cobros?desde=${todayISO()}&hasta=${todayISO()}`);
      const data = await res.json();
      setCobros(data.cobros || []);
    } catch (e) {}
  }

  async function cargarResumenHoy() {
    try {
      const res = await fetch(`/api/caja-resumen?desde=${todayISO()}&hasta=${todayISO()}`);
      const data = await res.json();
      if (!data.error) setResumenHoy(data);
    } catch (e) {}
  }

  useEffect(() => { cargarCobrosHoy(); cargarResumenHoy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!empresa?.slug) return;
    fetch('/api/public/profesionales?empresa=' + encodeURIComponent(empresa.slug)).then(r => r.json())
      .then(data => { if (!data.error) setProfesionales((data.profesionales || []).map(p => p.nombre).sort()); })
      .catch(() => {});
  }, [empresa?.slug]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function submitCobro(e) {
    e.preventDefault();
    setFormStatus({ msg: '', err: false });
    if (!form.profesional || !form.monto || !form.medioPago) {
      setFormStatus({ msg: 'Completá profesional, monto y medio de pago.', err: true });
      return;
    }
    try {
      const res = await fetch('/api/cobros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFormStatus({ msg: 'Cobro guardado.', err: false });
      setForm(f => ({ ...f, pacienteNombre: '', pacienteTelefono: '', servicio: '', monto: '' }));
      cargarCobrosHoy();
      cargarResumenHoy();
    } catch (err) {
      setFormStatus({ msg: err.message, err: true });
    }
  }

  function imprimirRecibo(cobro) {
    const w = window.open('', '_blank', 'width=420,height=600');
    w.document.write(`
      <html><head><title>Recibo</title>
      <style>
        body{font-family:sans-serif;padding:28px;color:#15272A;}
        h1{font-size:16px;margin:0 0 2px;}
        .sub{font-size:11px;color:#5C6E70;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        td{padding:6px 0;border-bottom:1px solid #eee;}
        td:first-child{color:#5C6E70;width:40%;}
        .total{font-size:18px;font-weight:700;margin-top:18px;}
        .firma{margin-top:60px;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#5C6E70;width:220px;}
      </style></head><body>
      <h1>${empresa?.nombre || 'Centro'}</h1>
      <div class="sub">${empresa?.ciudad ? empresa.ciudad + ' — ' : ''}Recibo de pago</div>
      <table>
        <tr><td>Fecha</td><td>${cobro.fecha}</td></tr>
        <tr><td>Paciente</td><td>${cobro.paciente_nombre || '-'}</td></tr>
        <tr><td>Profesional</td><td>${cobro.profesional}</td></tr>
        <tr><td>Servicio</td><td>${cobro.servicio || '-'}</td></tr>
        <tr><td>Medio de pago</td><td>${cobro.medio_pago}</td></tr>
      </table>
      <div class="total">Total: $${Math.round(cobro.monto).toLocaleString('es-AR')}</div>
      <div class="firma">Firma</div>
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img src={empresa?.logoUrl || LOGO_DATA_URI} alt={empresa?.nombreCorto || 'logo'} />
            <div className="topbar-title">
              <span className="app-name">Gestión diaria</span>
              <span className="app-sub">{empresa?.nombre || ''}</span>
            </div>
          </div>
          <div className="topbar-spacer" />
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{name}</span>
          <button className="icon-btn" onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div className="mobile-tabs" style={{ display: 'flex' }}>
        <button className={tab === 'agenda' ? 'active' : ''} onClick={() => setTab('agenda')}>Agenda</button>
        <button className={tab === 'caja' ? 'active' : ''} onClick={() => setTab('caja')}>Caja del día</button>
      </div>

      <div className="wrap">
        {tab === 'agenda' && (
          <section><div className="card">
            <AgendaBuilder empresaSlug={empresa?.slug} />
          </div></section>
        )}

        {tab === 'caja' && (
          <>
            <section><div className="card">
              <div className="section-head"><span className="dot" /><h2>Cargar cobro</h2></div>
              <form onSubmit={submitCobro} className="manual-grid">
                <div className="field"><label>Fecha</label><input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
                <div className="field"><label>Profesional</label>
                  <input list="profesionales-list" value={form.profesional} onChange={e => setForm(f => ({ ...f, profesional: e.target.value }))} />
                  <datalist id="profesionales-list">{profesionales.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div className="field"><label>Servicio</label><input value={form.servicio} onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))} /></div>
                <div className="field"><label>Monto</label><input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} /></div>
                <div className="field"><label>Medio de pago</label>
                  <select value={form.medioPago} onChange={e => setForm(f => ({ ...f, medioPago: e.target.value }))}>
                    {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field"><label>Paciente (opcional)</label><input value={form.pacienteNombre} onChange={e => setForm(f => ({ ...f, pacienteNombre: e.target.value }))} /></div>
                <div className="field"><label>Teléfono (opcional)</label><input value={form.pacienteTelefono} onChange={e => setForm(f => ({ ...f, pacienteTelefono: e.target.value }))} /></div>
              </form>
              <button className="icon-btn primary" onClick={submitCobro} style={{ marginTop: 4 }}>Guardar cobro</button>
              {formStatus.msg && <div style={{ marginTop: 10 }}><span className={'status-msg' + (formStatus.err ? ' err' : '')}>{formStatus.msg}</span></div>}
            </div></section>

            <section><div className="card">
              <div className="section-head"><span className="dot" /><h2>Cobros de hoy</h2></div>
              <table className="plain">
                <thead><tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Monto</th><th>Medio</th><th></th></tr></thead>
                <tbody>
                  {cobros.map(c => (
                    <tr key={c.id}>
                      <td>{new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{c.paciente_nombre || '-'}</td>
                      <td>{c.profesional}</td>
                      <td>{fmtMoney(c.monto)}</td>
                      <td>{c.medio_pago}</td>
                      <td><button className="icon-btn" onClick={() => imprimirRecibo(c)}>Recibo</button></td>
                    </tr>
                  ))}
                  {!cobros.length && <tr><td colSpan={6} style={{ color: 'var(--ink-faint)' }}>Todavía no cargaste cobros hoy.</td></tr>}
                </tbody>
              </table>
            </div></section>

            <section><div className="card">
              <div className="section-head"><span className="dot" /><h2>Cierre del día</h2></div>
              {resumenHoy ? (
                <>
                  <div className="kpi-grid" style={{ marginBottom: 18 }}>
                    <div className="kpi"><div className="label">Total cobrado</div><div className="value">{fmtMoney(resumenHoy.totalCobrado)}</div><div className="foot">{resumenHoy.cantidadCobros} cobros</div></div>
                  </div>
                  <MensajeCierre resumen={resumenHoy} fecha={todayISO()} />
                </>
              ) : <p style={{ color: 'var(--ink-faint)' }}>Sin datos todavía.</p>}
            </div></section>
          </>
        )}

        <footer>Xenom — panel de gestión para {empresa?.nombre || 'tu centro'}</footer>
      </div>
    </>
  );
}

function MensajeCierre({ resumen, fecha }) {
  const medios = Object.entries(resumen.porMedioPago || {}).map(([m, v]) => `${m}: ${fmtMoney(v)}`).join(' · ');
  const texto = `Cierre de caja ${fecha}\nTotal cobrado: ${fmtMoney(resumen.totalCobrado)}\n${medios}\nCobros registrados: ${resumen.cantidadCobros}`;
  return (
    <>
      <textarea readOnly value={texto} rows={5} style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 12.5, padding: 10, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-alt)' }} />
      <button className="icon-btn primary" style={{ marginTop: 10 }}
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')}>
        Enviar por WhatsApp a la dirección
      </button>
    </>
  );
}
