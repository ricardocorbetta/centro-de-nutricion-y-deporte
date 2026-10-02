'use client';

import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import LoadingSkeleton from './LoadingSkeleton';
import Avatar from './Avatar';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIA_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lunes primero, Domingo al final

export default function ProfesionalesAdmin() {
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');

  async function cargar() {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/profesionales');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProfesionales(data.profesionales || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function crearProfesional() {
    if (!nuevoNombre.trim()) return;
    try {
      const res = await fetch('/api/admin/profesionales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nuevoNombre.trim() })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNuevoNombre('');
      cargar();
    } catch (err) { alert(err.message); }
  }

  async function toggleActivo(nombre, activo) {
    try {
      await fetch(`/api/admin/profesionales/${encodeURIComponent(nombre)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo })
      });
      cargar();
    } catch (e) {}
  }

  return (
    <>
      <div className="section-head"><span className="dot" /><h2>Profesionales</h2>
        <span className="note">horarios, excepciones y servicios de cada profesional</span></div>

      {errorMsg && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{errorMsg}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input placeholder="Nombre del profesional (Apellido, Nombre)" value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)} style={{ flex: 1 }} />
        <button className="icon-btn primary" onClick={crearProfesional}>+ Agregar profesional</button>
      </div>

      {loading ? <LoadingSkeleton lines={3} widths={['100%', '100%', '70%']} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profesionales.map(p => (
            <div key={p.nombre} className={'prof-card' + (abierto === p.nombre ? ' abierto' : '')}>
              <div className="prof-card-head" onClick={() => setAbierto(abierto === p.nombre ? null : p.nombre)}>
                <span className="chev">{abierto === p.nombre ? '▾' : '▸'}</span>
                <Avatar nombre={p.nombre} size={28} />
                <div className="nombre" style={{ opacity: p.activo ? 1 : 0.5 }}>{p.nombre}</div>
                {!p.activo && <span className="tag rust">inactivo</span>}
                <button className="icon-btn" onClick={e => { e.stopPropagation(); toggleActivo(p.nombre, !p.activo); }}>
                  {p.activo ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
              {abierto === p.nombre && <ProfesionalDetalle profesional={p} onChange={cargar} />}
            </div>
          ))}
          {!profesionales.length && <p style={{ color: 'var(--ink-faint)' }}>Todavía no hay profesionales cargados.</p>}
        </div>
      )}
    </>
  );
}

function ProfesionalDetalle({ profesional: p, onChange }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <HorariosSemanales profesional={p.nombre} horarios={p.horarios} onChange={onChange} />
      <ExcepcionesPuntuales profesional={p.nombre} excepciones={p.excepciones} onChange={onChange} />
      <Servicios profesional={p.nombre} servicios={p.servicios} onChange={onChange} />
    </div>
  );
}

function HorariosSemanales({ profesional, horarios, onChange }) {
  const [nuevo, setNuevo] = useState({}); // { [dia]: {horaInicio, horaFin} } mientras se edita un día sin horario
  const [confirmando, setConfirmando] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState(null);

  async function guardarNuevo(dia) {
    const v = nuevo[dia];
    if (!v?.horaInicio || !v?.horaFin) return;
    await fetch('/api/admin/horarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesional, diaSemana: dia, horaInicio: v.horaInicio, horaFin: v.horaFin })
    });
    setNuevo(n => ({ ...n, [dia]: undefined }));
    onChange();
  }

  async function actualizar(id, patch) {
    await fetch(`/api/admin/horarios/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    onChange();
    setGuardadoOk(id);
    setTimeout(() => setGuardadoOk(prev => (prev === id ? null : prev)), 1800);
  }

  function borrar(id, dia) {
    setConfirmando({
      mensaje: `¿Quitar el horario del ${DIAS[dia]}? Ese día deja de estar disponible para reservar turnos online.`,
      destructivo: true, textoConfirmar: 'Quitar',
      onConfirm: async () => {
        await fetch(`/api/admin/horarios/${id}`, { method: 'DELETE' });
        onChange();
      }
    });
  }

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Horario semanal</h3>
      <table className="plain">
        <tbody>
          {DIA_ORDER.map(dia => {
            const h = horarios.find(x => x.dia_semana === dia);
            return (
              <tr key={dia}>
                <th style={{ width: 90 }}>{DIAS[dia]}</th>
                {h ? (
                  <>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="time" defaultValue={h.hora_inicio} style={{ width: 90 }}
                        onBlur={e => actualizar(h.id, { horaInicio: e.target.value })} /> a{' '}
                      <input type="time" defaultValue={h.hora_fin} style={{ width: 90 }}
                        onBlur={e => actualizar(h.id, { horaFin: e.target.value })} />
                      {guardadoOk === h.id && <span style={{ fontSize: 11.5, color: 'var(--sage)' }}>Guardado ✓</span>}
                    </td>
                    <td><button className="icon-btn" onClick={() => borrar(h.id, dia)}>Quitar</button></td>
                  </>
                ) : (
                  <>
                    <td style={{ color: 'var(--ink-faint)' }}>
                      <input type="time" style={{ width: 90 }}
                        onChange={e => setNuevo(n => ({ ...n, [dia]: { ...n[dia], horaInicio: e.target.value } }))} /> a{' '}
                      <input type="time" style={{ width: 90 }}
                        onChange={e => setNuevo(n => ({ ...n, [dia]: { ...n[dia], horaFin: e.target.value } }))} />
                    </td>
                    <td><button className="icon-btn" onClick={() => guardarNuevo(dia)}>+ Agregar horario</button></td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </div>
  );
}

function ExcepcionesPuntuales({ profesional, excepciones, onChange }) {
  const [fecha, setFecha] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [cerrado, setCerrado] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  async function agregar() {
    if (!fecha) return;
    if (!cerrado && (!horaInicio || !horaFin)) return;
    await fetch('/api/admin/horarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesional, fecha, horaInicio, horaFin, activo: !cerrado })
    });
    setFecha(''); setHoraInicio(''); setHoraFin(''); setCerrado(false);
    onChange();
  }

  function borrar(id, fecha) {
    setConfirmando({
      mensaje: `¿Quitar la excepción del ${fecha}? Ese día vuelve a usar el horario semanal habitual.`,
      destructivo: true, textoConfirmar: 'Quitar',
      onConfirm: async () => {
        await fetch(`/api/admin/horarios/${id}`, { method: 'DELETE' });
        onChange();
      }
    });
  }

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Excepciones puntuales</h3>
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 0 }}>
        Para un día específico que cambia el horario habitual, o en el que no atiende.
      </p>
      <table className="plain" style={{ marginBottom: 10 }}>
        <tbody>
          {excepciones.map(e => (
            <tr key={e.id}>
              <td>{e.fecha}</td>
              <td>{e.activo ? `${e.hora_inicio} a ${e.hora_fin}` : <span className="tag rust">no atiende</span>}</td>
              <td><button className="icon-btn" onClick={() => borrar(e.id, e.fecha)}>Quitar</button></td>
            </tr>
          ))}
          {!excepciones.length && <tr><td colSpan={3} style={{ color: 'var(--ink-faint)' }}>Sin excepciones cargadas.</td></tr>}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={cerrado} onChange={e => setCerrado(e.target.checked)} /> No atiende ese día
        </label>
        {!cerrado && (
          <>
            <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} style={{ width: 90 }} /> a
            <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} style={{ width: 90 }} />
          </>
        )}
        <button className="icon-btn primary" onClick={agregar}>Agregar excepción</button>
      </div>
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </div>
  );
}

function Servicios({ profesional, servicios, onChange }) {
  const [nombre, setNombre] = useState('');
  const [duracion, setDuracion] = useState('40');
  const [confirmando, setConfirmando] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState(null);

  async function agregar() {
    if (!nombre.trim()) return;
    await fetch('/api/admin/servicios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesional, nombre: nombre.trim(), duracion })
    });
    setNombre(''); setDuracion('40');
    onChange();
  }

  async function actualizar(id, patch) {
    await fetch(`/api/admin/servicios/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    onChange();
    setGuardadoOk(id);
    setTimeout(() => setGuardadoOk(prev => (prev === id ? null : prev)), 1800);
  }

  function borrar(id) {
    setConfirmando({
      mensaje: '¿Quitar este servicio?', destructivo: true, textoConfirmar: 'Quitar',
      onConfirm: async () => {
        await fetch(`/api/admin/servicios/${id}`, { method: 'DELETE' });
        onChange();
      }
    });
  }

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Servicios</h3>
      <table className="plain" style={{ marginBottom: 10 }}>
        <thead><tr><th>Servicio</th><th>Duración</th><th>Activo</th><th></th></tr></thead>
        <tbody>
          {servicios.map(s => (
            <tr key={s.id}>
              <td><input defaultValue={s.nombre} onBlur={e => actualizar(s.id, { nombre: e.target.value })} /></td>
              <td><input type="number" step="5" style={{ width: 70 }} defaultValue={s.duracion}
                onBlur={e => actualizar(s.id, { duracion: e.target.value })} /> min
                {guardadoOk === s.id && <span style={{ fontSize: 11.5, color: 'var(--sage)', marginLeft: 8 }}>Guardado ✓</span>}</td>
              <td><input type="checkbox" checked={s.activo} onChange={e => actualizar(s.id, { activo: e.target.checked })} /></td>
              <td><button className="icon-btn" onClick={() => borrar(s.id)}>Quitar</button></td>
            </tr>
          ))}
          {!servicios.length && <tr><td colSpan={4} style={{ color: 'var(--ink-faint)' }}>Sin servicios cargados.</td></tr>}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input placeholder="Nombre del servicio (ej: Nutrición / Control y seguimiento)" value={nombre}
          onChange={e => setNombre(e.target.value)} style={{ flex: 1 }} />
        <input type="number" step="5" style={{ width: 80 }} value={duracion} onChange={e => setDuracion(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>min</span>
        <button className="icon-btn primary" onClick={agregar}>Agregar servicio</button>
      </div>
      <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
    </div>
  );
}
