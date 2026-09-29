'use client';

import { useEffect, useState } from 'react';

export default function GoogleCalendarConfig() {
  const [loading, setLoading] = useState(true);
  const [calendarId, setCalendarId] = useState('');
  const [savedCalendarId, setSavedCalendarId] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [disponible, setDisponible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ msg: '', err: false });

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch('/api/config/google-calendar');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCalendarId(data.calendarId || '');
      setSavedCalendarId(data.calendarId || '');
      setServiceAccountEmail(data.serviceAccountEmail || '');
      setDisponible(!!data.disponibleEnLaPlataforma);
    } catch (e) {
      setStatus({ msg: e.message, err: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setSaving(true);
    setStatus({ msg: '', err: false });
    try {
      const res = await fetch('/api/config/google-calendar', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedCalendarId(data.calendarId);
      setStatus({ msg: data.calendarId ? 'Conectado. Los próximos turnos ya se cargan en ese calendario.' : 'Desconectado.', err: false });
    } catch (e) {
      setStatus({ msg: e.message, err: true });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--ink-faint)' }}>Cargando…</p>;

  if (!disponible) {
    return (
      <>
        <div className="section-head"><span className="dot" /><h2>Google Calendar</h2></div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Esta funcionalidad todavía no está habilitada en la plataforma (falta configurar el Service Account de
          Google del lado del servidor). Avisale a Xenom para activarla.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Google Calendar</h2>
        <span className="note">{savedCalendarId ? 'conectado' : 'no conectado'}</span></div>

      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: -6 }}>
        Conectá un Google Calendar para que cada turno que se cargue (desde la agenda o desde el link público de
        reserva) se agende ahí automáticamente. Al cancelar un turno, el evento se borra solo.
      </p>

      <ol style={{ fontSize: 12.5, color: 'var(--ink-soft)', paddingLeft: 18, marginBottom: 18 }}>
        <li>Abrí Google Calendar, creá (o elegí) el calendario que va a usar la clínica.</li>
        <li>En "Configuración y uso compartido" de ese calendario, agregá como persona con acceso a:
          {' '}<code style={{ background: 'var(--surface-alt)', padding: '1px 6px', borderRadius: 5 }}>{serviceAccountEmail}</code>
          {' '}con permiso <b>"Hacer cambios en los eventos"</b>.
        </li>
        <li>Copiá el "ID del calendario" (en la misma pantalla, más abajo) y pegalo acá.</li>
      </ol>

      <div className="manual-grid" style={{ gridTemplateColumns: '2fr auto' }}>
        <div className="field"><label>ID del calendario</label>
          <input value={calendarId} onChange={e => setCalendarId(e.target.value)} placeholder="ejemplo@group.calendar.google.com" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="icon-btn primary" disabled={saving} onClick={guardar}>
            {saving ? 'Guardando…' : (calendarId ? 'Conectar' : 'Guardar')}
          </button>
        </div>
      </div>

      {status.msg && <div style={{ marginTop: 10 }}><span className={'status-msg' + (status.err ? ' err' : '')}>{status.msg}</span></div>}
    </>
  );
}
