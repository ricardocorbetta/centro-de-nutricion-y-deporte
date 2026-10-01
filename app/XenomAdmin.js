'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function slugPreview(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const emptyForm = {
  nombre: '', nombreCorto: '', ciudad: '', slug: '',
  directorUsername: '', directorPassword: '', directorNombre: ''
};

export default function XenomAdmin({ name, username }) {
  const router = useRouter();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState({ msg: '', err: false });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function cargarEmpresas() {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/xenom/empresas');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmpresas(data.empresas || []);
    } catch (err) {
      setErrorMsg('No se pudo cargar la lista de empresas: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarEmpresas(); }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function submitForm(e) {
    e.preventDefault();
    setFormStatus({ msg: '', err: false });
    if (!form.nombre || !form.directorUsername || !form.directorPassword || !form.directorNombre) {
      setFormStatus({ msg: 'Completá al menos: nombre del centro, y usuario/contraseña/nombre del director.', err: true });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/xenom/empresas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFormStatus({ msg: `Listo: "${data.empresa.nombre}" creado. Link de reserva: /reservar/${data.empresa.slug}`, err: false });
      setForm(emptyForm);
      setShowForm(false);
      cargarEmpresas();
    } catch (err) {
      setFormStatus({ msg: err.message, err: true });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(emp) {
    setBusyId(emp.id);
    try {
      const res = await fetch(`/api/xenom/empresas/${emp.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !emp.activo })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmpresas(prev => prev.map(e => e.id === emp.id ? { ...e, activo: data.empresa.activo } : e));
    } catch (err) {
      setErrorMsg('No se pudo actualizar el estado: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <div className="topbar-title">
              <span className="app-name" style={{ color: '#1F7A68', fontWeight: 800 }}>NUTRIO</span>
              <span className="app-sub">Panel de plataforma — administración de clínicas</span>
            </div>
          </div>
          <div className="topbar-spacer" />
          <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{name}</span>
          <button className="icon-btn" onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div className="wrap">
        <section><div className="card">
          <div className="section-head">
            <span className="dot" /><h2>Empresas (clientes de la plataforma)</h2>
            <span className="note">{empresas.length} en total</span>
          </div>

          {errorMsg && <p style={{ color: '#C0562F', fontSize: 13 }}>{errorMsg}</p>}

          <button className="icon-btn primary" onClick={() => setShowForm(v => !v)} style={{ marginBottom: 18 }}>
            {showForm ? 'Cancelar' : '+ Nueva empresa'}
          </button>

          {showForm && (
            <form onSubmit={submitForm} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-strong, #E3EAE7)' }}>
              <div className="manual-grid">
                <div className="field"><label>Nombre del centro</label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Centro de Nutrición y Deporte" />
                </div>
                <div className="field"><label>Nombre corto</label>
                  <input value={form.nombreCorto} onChange={e => setForm(f => ({ ...f, nombreCorto: e.target.value }))} placeholder="CND" />
                </div>
                <div className="field"><label>Ciudad</label>
                  <input value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} placeholder="Cipolletti, Río Negro" />
                </div>
                <div className="field"><label>Slug del link de reserva (opcional)</label>
                  <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto: se genera del nombre" />
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                    {origin}/reservar/{slugPreview(form.slug || form.nombreCorto || form.nombre) || '...'}
                  </div>
                </div>
                <div className="field"><label>Usuario del director</label>
                  <input value={form.directorUsername} onChange={e => setForm(f => ({ ...f, directorUsername: e.target.value }))} placeholder="mariana" />
                </div>
                <div className="field"><label>Contraseña del director</label>
                  <input type="text" value={form.directorPassword} onChange={e => setForm(f => ({ ...f, directorPassword: e.target.value }))} placeholder="contraseña inicial" />
                </div>
                <div className="field"><label>Nombre del director</label>
                  <input value={form.directorNombre} onChange={e => setForm(f => ({ ...f, directorNombre: e.target.value }))} placeholder="Mariana Eulalia" />
                </div>
              </div>
              <button type="submit" className="icon-btn primary" disabled={saving} style={{ marginTop: 4 }}>
                {saving ? 'Creando…' : 'Crear empresa'}
              </button>
            </form>
          )}

          {formStatus.msg && (
            <div style={{ marginBottom: 18 }}>
              <span className={'status-msg' + (formStatus.err ? ' err' : '')}>{formStatus.msg}</span>
            </div>
          )}

          {loading ? (
            <p style={{ color: 'var(--ink-faint)' }}>Cargando…</p>
          ) : (
            <table className="plain">
              <thead>
                <tr><th>Centro</th><th>Ciudad</th><th>Plan</th><th>Usuarios</th><th>Link de reserva</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {empresas.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{emp.nombre}</div>
                      {emp.nombre_corto && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{emp.nombre_corto}</div>}
                    </td>
                    <td>{emp.ciudad || '-'}</td>
                    <td>{emp.plan}</td>
                    <td>
                      {(emp.usuarios || []).map(u => (
                        <div key={u.username} style={{ fontSize: 12.5 }}>{u.name} <span style={{ color: 'var(--ink-faint)' }}>({u.role})</span></div>
                      ))}
                      {!emp.usuarios?.length && <span style={{ color: 'var(--ink-faint)' }}>sin usuarios</span>}
                    </td>
                    <td>
                      <a href={`/reservar/${emp.slug}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        /reservar/{emp.slug}
                      </a>
                    </td>
                    <td>
                      <span className={'tag' + (emp.activo ? '' : ' rust')}>{emp.activo ? 'Activo' : 'Suspendido'}</span>
                    </td>
                    <td>
                      <button className="icon-btn" disabled={busyId === emp.id} onClick={() => toggleActivo(emp)}>
                        {emp.activo ? 'Suspender' : 'Reactivar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!empresas.length && <tr><td colSpan={7} style={{ color: 'var(--ink-faint)' }}>Todavía no hay empresas cargadas.</td></tr>}
              </tbody>
            </table>
          )}
        </div></section>

        <footer>NUTRIO — panel de administración de la plataforma</footer>
      </div>
    </>
  );
}
