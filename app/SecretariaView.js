'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtMoney } from '../lib/stats';
import AgendaBuilder from './AgendaBuilder';
import PacienteSelector from './PacienteSelector';
import AppShell from './AppShell';
import Avatar from './Avatar';
import FeedbackBoton from './FeedbackBoton';
import InicioPendientes from './InicioPendientes';
import { hoyAR } from '../lib/fechas';

function todayISO() { return hoyAR(); }

const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'MercadoPago'];

export default function SecretariaView({ name, username, empresa }) {
  const router = useRouter();
  const [tab, setTab] = useState('inicio');

  const [cobros, setCobros] = useState([]);
  const [form, setForm] = useState({
    fecha: todayISO(), profesional: '', servicio: '', monto: '', medioPago: 'Efectivo'
  });
  const [pacienteCobro, setPacienteCobro] = useState(null);
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
        body: JSON.stringify({ ...form, pacienteId: pacienteCobro?.id || null })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFormStatus({ msg: 'Cobro guardado.', err: false });
      setForm(f => ({ ...f, servicio: '', monto: '' }));
      setPacienteCobro(null);
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
    <AppShell empresa={empresa} nombre={name} rol="secretaria"
      destinos={[
        { id: 'inicio', label: 'Inicio', icono: 'inicio' },
        { id: 'agenda', label: 'Agenda', icono: 'agenda' },
        { id: 'caja', label: 'Caja del día', icono: 'caja' }
      ]}
      activo={tab} onIr={setTab}
      menu={[
        { id: 'contrasena', label: 'Cambiar contraseña', icono: 'llave', onClick: () => window.dispatchEvent(new CustomEvent('cambiar-contrasena')) },
        { id: 'sugerencias', label: 'Sugerencias', icono: 'sugerencias', onClick: () => window.dispatchEvent(new CustomEvent('abrir-sugerencias')) },
        { id: 'salir', label: 'Salir', icono: 'salir', onClick: handleLogout }
      ]}>
        {tab === 'inicio' && <InicioPendientes nombre={name} onIr={s => setTab(s === 'caja' ? 'caja' : 'agenda')} />}

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
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Paciente (opcional)</label>
                  <PacienteSelector value={pacienteCobro} onChange={setPacienteCobro} />
                </div>
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
                      <td>
                        {c.paciente_nombre ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar nombre={c.paciente_nombre} size={22} />
                            {c.paciente_nombre}
                          </div>
                        ) : '-'}
                      </td>
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
              <div className="section-head"><h2>Cierre del día</h2></div>
              {resumenHoy ? (
                <>
                  <div className="kpi-grid" style={{ marginBottom: 18 }}>
                    <div className="kpi"><div className="label">Total cobrado</div><div className="value">{fmtMoney(resumenHoy.totalCobrado)}</div><div className="foot">{resumenHoy.cantidadCobros} cobros</div></div>
                    {Object.entries(resumenHoy.porMedioPago || {}).map(([medio, monto]) => (
                      <div key={medio} className="kpi"><div className="label">{medio}</div><div className="value">{fmtMoney(monto)}</div></div>
                    ))}
                  </div>
                  <CierreCajaHoy fecha={todayISO()} hayCobros={resumenHoy.cantidadCobros > 0} />
                  <MensajeCierre resumen={resumenHoy} fecha={todayISO()} />
                </>
              ) : <p style={{ color: 'var(--ink-faint)' }}>Sin datos todavía.</p>}
            </div></section>
          </>
        )}

      <FeedbackBoton pantalla={{ inicio: 'Inicio (secretaría)', agenda: 'Agenda (secretaría)', caja: 'Caja (secretaría)' }[tab]} />
    </AppShell>
  );
}

// Cierre formal de la caja del día: guarda la foto de los totales con quién y cuándo cerró.
// Si después entra un cobro, se puede volver a cerrar para actualizar la foto. Reabrir una caja
// cerrada (borrar el cierre) queda solo para dirección.
function CierreCajaHoy({ fecha, hayCobros }) {
  const [cierre, setCierre] = useState(undefined);
  const [estado, setEstado] = useState({ ocupado: false, msg: '', err: false });

  async function cargar() {
    try {
      const res = await fetch('/api/caja/cierre?fecha=' + fecha);
      const data = await res.json();
      setCierre(data.cierre || null);
    } catch (e) { setCierre(null); }
  }
  useEffect(() => { cargar(); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cerrar() {
    setEstado({ ocupado: true, msg: '', err: false });
    try {
      const res = await fetch('/api/caja/cierre', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sin-aviso': '1' }, body: JSON.stringify({ fecha }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cerrar la caja.');
      setCierre(data.cierre);
      setEstado({ ocupado: false, msg: 'Caja cerrada.', err: false });
    } catch (err) { setEstado({ ocupado: false, msg: err.message, err: true }); }
  }

  if (cierre === undefined) return null;
  const hora = cierre?.cerrado_en ? new Date(cierre.cerrado_en).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className={'cierre-estado' + (cierre ? ' cerrado' : '')}>
      <div>
        <b>{cierre ? 'Caja de hoy cerrada' : 'La caja de hoy está abierta'}</b>
        <span>{cierre
          ? `Cerró ${cierre.cerrado_por} a las ${hora} · ${fmtMoney(cierre.total_cobrado)} en ${cierre.cantidad_cobros} cobros. Si entra otro cobro, volvé a cerrar para actualizarla.`
          : 'Al terminar el día, revisá los cobros y cerrá la caja: queda registrado quién la cerró y con qué totales.'}</span>
      </div>
      <div className="mej-acciones">
        {estado.msg && <span className={'status-msg' + (estado.err ? ' err' : '')} role="status">{estado.msg}</span>}
        <button className={'icon-btn' + (cierre ? '' : ' primary')} disabled={estado.ocupado || (!hayCobros && !cierre)} onClick={cerrar}>
          {estado.ocupado ? 'Cerrando…' : cierre ? 'Actualizar cierre' : 'Cerrar la caja de hoy'}
        </button>
      </div>
    </div>
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
