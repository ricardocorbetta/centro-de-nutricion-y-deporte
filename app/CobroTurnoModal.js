'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/stats';

function todayISO() { return new Date().toISOString().slice(0, 10); }

const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'MercadoPago'];
const TIPO_COBRO = [
  { value: 'anticipo', label: 'Anticipo / seña' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'completo', label: 'Pago completo' }
];

// Modal de cobro de un turno puntual: muestra precio total / cobrado / saldo pendiente (según los
// cobros ya vinculados a ese turno, vengan de Mercado Pago o cargados a mano), deja generar un link
// de pago de Mercado Pago, o registrar un cobro manual (con comprobante adjunto si corresponde —
// por ejemplo una transferencia a nombre de un tercero).
export default function CobroTurnoModal({ turno, onClose, onChanged }) {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [generandoMP, setGenerandoMP] = useState(false);

  const [tipoCobro, setTipoCobro] = useState('anticipo');
  const [monto, setMonto] = useState('');
  const [medioPago, setMedioPago] = useState('Efectivo');
  const [comprobante, setComprobante] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/turnos/${turno.id}/cobros`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEstado(data);
      setTipoCobro(data.totalCobrado > 0 ? 'saldo' : 'anticipo');
      if (data.saldoPendiente !== null) setMonto(String(data.saldoPendiente));
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (turno) cargar(); }, [turno?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!turno) return null;

  async function cobrarPorMP() {
    setGenerandoMP(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/turnos/${turno.id}/cobrar-mp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.open(data.link, '_blank');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGenerandoMP(false);
    }
  }

  async function registrarManual() {
    if (!monto || Number(monto) <= 0) { setErrorMsg('Ingresá un monto válido.'); return; }
    setGuardando(true);
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('monto', monto);
      form.append('medioPago', medioPago);
      form.append('tipoCobro', tipoCobro);
      form.append('fecha', todayISO());
      if (comprobante) form.append('comprobante', comprobante);
      const res = await fetch(`/api/turnos/${turno.id}/cobros`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setComprobante(null);
      await cargar();
      onChanged?.();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,39,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55 }} onClick={onClose}>
      <div className="card" style={{ width: 460, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="section-head"><span className="dot" /><h2>Cobrar turno</h2></div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '-8px 0 14px' }}>
          {turno.paciente_nombre || 'Paciente'} · {turno.resource} · {(turno.service || '').replace('Nutrición / ', '')}
        </p>

        {loading ? (
          <div className="skeleton skeleton-block" />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <div className="kpi" style={{ flex: 1 }}><div className="label">Precio</div><div className="value" style={{ fontSize: 16 }}>{estado.precioTotal !== null ? fmtMoney(estado.precioTotal) : '—'}</div></div>
              <div className="kpi" style={{ flex: 1 }}><div className="label">Cobrado</div><div className="value" style={{ fontSize: 16 }}>{fmtMoney(estado.totalCobrado)}</div></div>
              <div className="kpi" style={{ flex: 1 }}><div className="label">Saldo</div><div className="value" style={{ fontSize: 16, color: estado.saldoPendiente > 0 ? 'var(--rust)' : 'var(--primary)' }}>{estado.saldoPendiente !== null ? fmtMoney(estado.saldoPendiente) : '—'}</div></div>
            </div>

            {estado.cobros.length > 0 && (
              <table className="plain" style={{ marginBottom: 16 }}>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Medio</th><th></th></tr></thead>
                <tbody>
                  {estado.cobros.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{c.fecha}</td>
                      <td style={{ fontSize: 12 }}>{TIPO_COBRO.find(t => t.value === c.tipo_cobro)?.label || c.tipo_cobro}</td>
                      <td>{fmtMoney(c.monto)}</td>
                      <td style={{ fontSize: 12 }}>{c.medio_pago}</td>
                      <td>{c.comprobanteUrl && <a href={c.comprobanteUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5 }}>Comprobante</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {estado.saldoPendiente === 0 && estado.precioTotal !== null ? (
              <div className="empty-state" style={{ marginBottom: 10 }}>
                <span className="icon">✅</span>
                <span className="title">Ya está todo cobrado</span>
              </div>
            ) : (
              <>
                <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 13 }}>Cobrar por Mercado Pago</h2></div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '-6px 0 10px' }}>
                  Genera un link/QR de pago por el saldo pendiente, de la cuenta de Mercado Pago de la clínica.
                </p>
                <button className="icon-btn primary" disabled={generandoMP} onClick={cobrarPorMP} style={{ marginBottom: 20 }}>
                  {generandoMP ? 'Generando…' : 'Generar link de Mercado Pago'}
                </button>

                <div className="section-head"><span className="dot" /><h2 style={{ fontSize: 13 }}>Registrar cobro manual</h2></div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '-6px 0 10px' }}>
                  Para pagos en efectivo, transferencia, o cuando el pago lo hizo un tercero — adjuntá el comprobante si lo tenés.
                </p>
                <div className="manual-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
                  <div className="field"><label>Tipo</label>
                    <select value={tipoCobro} onChange={e => setTipoCobro(e.target.value)}>
                      {TIPO_COBRO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Monto</label>
                    <input type="number" value={monto} onChange={e => setMonto(e.target.value)} />
                  </div>
                  <div className="field"><label>Medio de pago</label>
                    <select value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                      {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Comprobante (opcional)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setComprobante(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <button className="icon-btn primary" disabled={guardando} onClick={registrarManual}>
                  {guardando ? 'Guardando…' : 'Registrar cobro'}
                </button>
              </>
            )}
          </>
        )}

        {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13, marginTop: 10 }}>{errorMsg}</p>}

        <div style={{ marginTop: 18 }}>
          <button className="icon-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
