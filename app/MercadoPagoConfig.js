'use client';

import { useEffect, useState } from 'react';
import LoadingSkeleton from './LoadingSkeleton';

export default function MercadoPagoConfig() {
  const [loading, setLoading] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [seniaMonto, setSeniaMonto] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [savingSenia, setSavingSenia] = useState(false);
  const [status, setStatus] = useState({ msg: '', err: false });

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch('/api/config/mercadopago');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConectado(!!data.conectado);
      setSeniaMonto(data.seniaMonto || '');
    } catch (e) {
      setStatus({ msg: e.message, err: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function guardarToken() {
    setSavingToken(true);
    setStatus({ msg: '', err: false });
    try {
      const res = await fetch('/api/config/mercadopago', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConectado(data.conectado);
      setAccessToken('');
      setStatus({ msg: data.conectado ? `Conectado${data.cuenta?.email ? ' — cuenta: ' + data.cuenta.email : ''}.` : 'Desconectado.', err: false });
    } catch (e) {
      setStatus({ msg: e.message, err: true });
    } finally {
      setSavingToken(false);
    }
  }

  async function guardarSenia() {
    setSavingSenia(true);
    setStatus({ msg: '', err: false });
    try {
      const res = await fetch('/api/config/mercadopago', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seniaMonto: parseFloat(seniaMonto) || null })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatus({ msg: 'Guardado.', err: false });
    } catch (e) {
      setStatus({ msg: e.message, err: true });
    } finally {
      setSavingSenia(false);
    }
  }

  if (loading) return <LoadingSkeleton lines={3} />;

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Mercado Pago</h2>
        <span className="note">{conectado ? 'conectado' : 'no conectado'}</span></div>

      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: -6 }}>
        Conectá la cuenta de Mercado Pago <b>de la clínica</b> (la plata entra directo ahí, nunca pasa por NUTRIO).
        Con esto activo podés: pedir una seña para confirmar reservas online, y generar un link/QR de cobro para
        cualquier turno desde la agenda — ambos casos cargan el cobro solo en la caja del día cuando el paciente paga.
      </p>

      <ol style={{ fontSize: 12.5, color: 'var(--ink-soft)', paddingLeft: 18, marginBottom: 18 }}>
        <li>Entrá a <code style={{ background: 'var(--surface-alt)', padding: '1px 6px', borderRadius: 5 }}>mercadopago.com.ar/developers/panel</code> con la cuenta de Mercado Pago de la clínica.</li>
        <li>"Tus integraciones" → creá una aplicación (o usá una existente) → pestaña "Credenciales de producción".</li>
        <li>Copiá el <b>Access Token</b> de producción (empieza con <code style={{ background: 'var(--surface-alt)', padding: '1px 6px', borderRadius: 5 }}>APP_USR-</code>) y pegalo acá.</li>
      </ol>

      <div className="manual-grid" style={{ gridTemplateColumns: '2fr auto' }}>
        <div className="field"><label>Access Token</label>
          <input type="password" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder={conectado ? '•••••••••••••••• (ya conectado)' : 'APP_USR-...'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="icon-btn primary" disabled={savingToken || !accessToken.trim()} onClick={guardarToken}>
            {savingToken ? 'Validando…' : 'Conectar'}
          </button>
        </div>
      </div>

      {conectado && (
        <>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, marginTop: 22 }}>Seña para confirmar reservas online</h3>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: -4 }}>
            Si cargás un monto, en /reservar/{'<slug>'} el paciente va a tener que pagar esa seña por Mercado Pago para
            confirmar el turno. Dejalo vacío para que la reserva online siga confirmándose sin pago.
          </p>
          <div className="manual-grid" style={{ gridTemplateColumns: '200px auto' }}>
            <div className="field"><label>Monto de la seña ($)</label>
              <input type="number" min="0" step="1000" value={seniaMonto} onChange={e => setSeniaMonto(e.target.value)} placeholder="ej: 10000" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="icon-btn" disabled={savingSenia} onClick={guardarSenia}>{savingSenia ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </>
      )}

      {status.msg && <div style={{ marginTop: 10 }}><span className={'status-msg' + (status.err ? ' err' : '')}>{status.msg}</span></div>}
    </>
  );
}
