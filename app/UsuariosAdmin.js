'use client';

import { useEffect, useState } from 'react';
import SidePanel from './SidePanel';
import Avatar from './Avatar';
import { ROLES, etiquetaRol } from '../lib/roles';

// Configuración → Usuarios: quién entra al sistema de la clínica y con qué rol.
// Solo dirección. Los permisos de cada rol están definidos en lib/roles.js.

function fmtIngreso(iso) {
  if (!iso) return 'Nunca entró';
  return new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Contraseña inicial sugerida: la genera el navegador de quien da el alta.
function generarContrasena() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  const azar = (pool, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => pool[x % pool.length]).join('');
  return azar(letras, 4) + azar(nums, 2) + azar(letras, 4) + azar(nums, 2);
}

export default function UsuariosAdmin() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  async function cargar() {
    setError('');
    try {
      const res = await fetch('/api/admin/usuarios');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los usuarios.');
      setDatos(data);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { cargar(); }, []);

  const editando = datos?.usuarios.find(u => u.id === editandoId) || null;

  return (
    <>
      <div className="section-head">
        <h2>Usuarios</h2>
        <button className="icon-btn primary" style={{ marginLeft: 'auto' }} onClick={() => setCreando(true)}>+ Nuevo usuario</button>
      </div>
      <p className="nota-suave" style={{ marginTop: -6 }}>Cada persona entra con su propio usuario: así queda registrado quién da cada turno, cobro y cierre de caja.</p>

      {error ? (
        <div className="empty-state"><div className="title">{error}</div><button className="icon-btn" onClick={cargar}>Reintentar</button></div>
      ) : !datos ? (
        <p className="nota-suave">Cargando…</p>
      ) : (
        <ul className="usuarios-lista">
          {datos.usuarios.map(u => (
            <li key={u.id} className={'usuario-fila' + (u.activo ? '' : ' inactivo')}>
              <Avatar nombre={u.name} size={36} />
              <div className="usuario-datos">
                <span className="usuario-nombre">{u.name}{u.id === datos.yo && <span className="usuario-yo"> (vos)</span>}</span>
                <span className="usuario-sub">{u.username} · Último ingreso: {fmtIngreso(u.ultimo_ingreso)}</span>
              </div>
              <span className={'tag ' + (u.role === 'director' ? 'sage' : 'info')}>{etiquetaRol(u.role)}</span>
              {!u.activo && <span className="tag rust">De baja</span>}
              <button className="icon-btn" onClick={() => setEditandoId(u.id)}>Editar</button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="roles-titulo">Qué puede hacer cada rol</h3>
      <div className="roles-grid">
        {Object.entries(ROLES).map(([id, r]) => (
          <div key={id} className="rol-tarjeta">
            <b>{r.label}</b>
            <span className="rol-desc">{r.descripcion}</span>
            <ul>{r.puede.map(p => <li key={p}>{p}</li>)}</ul>
            {r.noPuede && <><span className="rol-no">No puede:</span><ul className="rol-no-lista">{r.noPuede.map(p => <li key={p}>{p}</li>)}</ul></>}
          </div>
        ))}
      </div>

      <SidePanel open={creando} onClose={() => setCreando(false)} title="Nuevo usuario" width={480}>
        {creando && <FormNuevo onListo={() => { setCreando(false); cargar(); }} />}
      </SidePanel>

      <SidePanel open={!!editando} onClose={() => setEditandoId(null)} title={editando?.name || ''} subtitle={editando?.username} width={480}>
        {editando && <FormEditar usuario={editando} esYo={editando.id === datos?.yo} onListo={() => cargar()} />}
      </SidePanel>
    </>
  );
}

function SelectorRol({ valor, onChange, deshabilitado }) {
  return (
    <fieldset className="rol-opciones" disabled={deshabilitado}>
      <legend>Rol</legend>
      {Object.entries(ROLES).map(([id, r]) => (
        <label key={id} className={'rol-opcion' + (valor === id ? ' activo' : '')}>
          <input type="radio" name="rol" value={id} checked={valor === id} onChange={() => onChange(id)} />
          <span className="rol-opcion-titulo">{r.label}</span>
          <span className="rol-opcion-desc">{r.descripcion}</span>
        </label>
      ))}
    </fieldset>
  );
}

function CampoContrasena({ valor, onChange, label }) {
  const [ver, setVer] = useState(false);
  return (
    <label className="mej-campo">
      <span>{label}</span>
      <div className="contrasena-fila">
        <input type={ver ? 'text' : 'password'} value={valor} onChange={e => onChange(e.target.value)} autoComplete="new-password" />
        <button type="button" className="icon-btn" onClick={() => setVer(v => !v)}>{ver ? 'Ocultar' : 'Ver'}</button>
        <button type="button" className="icon-btn" onClick={() => { onChange(generarContrasena()); setVer(true); }}>Generar</button>
      </div>
      <small>Mínimo 10 caracteres, con letras y números. Pasásela a la persona por un medio privado: después la puede cambiar desde su menú.</small>
    </label>
  );
}

function FormNuevo({ onListo }) {
  const [f, setF] = useState({ nombre: '', usuario: '', rol: 'secretaria', password: '' });
  const [estado, setEstado] = useState({ ocupado: false, msg: '', err: false });
  async function guardar(e) {
    e.preventDefault();
    setEstado({ ocupado: true, msg: '', err: false });
    try {
      const res = await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el usuario.');
      onListo();
    } catch (err) { setEstado({ ocupado: false, msg: err.message, err: true }); }
  }
  return (
    <form className="mej-form" onSubmit={guardar}>
      <label className="mej-campo"><span>Nombre y apellido</span>
        <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} autoComplete="off" />
      </label>
      <label className="mej-campo"><span>Usuario para entrar</span>
        <input type="email" value={f.usuario} onChange={e => setF({ ...f, usuario: e.target.value })} placeholder="mail de la persona" autoComplete="off" />
        <small>Conviene usar el mail de la persona. Es lo que va a escribir en "Usuario" al iniciar sesión.</small>
      </label>
      <SelectorRol valor={f.rol} onChange={rol => setF({ ...f, rol })} />
      <CampoContrasena label="Contraseña inicial" valor={f.password} onChange={password => setF({ ...f, password })} />
      <div className="mej-acciones">
        {estado.msg && <span className={'status-msg' + (estado.err ? ' err' : '')} role="status">{estado.msg}</span>}
        <button type="submit" className="icon-btn primary" disabled={estado.ocupado}>{estado.ocupado ? 'Creando…' : 'Crear usuario'}</button>
      </div>
    </form>
  );
}

function FormEditar({ usuario, esYo, onListo }) {
  const [rol, setRol] = useState(usuario.role);
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState({ ocupado: false, msg: '', err: false });

  async function patch(body, okMsg) {
    setEstado({ ocupado: true, msg: '', err: false });
    try {
      const res = await fetch('/api/admin/usuarios/' + usuario.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
      setEstado({ ocupado: false, msg: okMsg, err: false });
      onListo();
      return true;
    } catch (err) { setEstado({ ocupado: false, msg: err.message, err: true }); return false; }
  }

  return (
    <div className="mej-form">
      <SelectorRol valor={rol} onChange={setRol} deshabilitado={esYo} />
      {esYo && <p className="mej-nota">No podés cambiar tu propio rol.</p>}
      {!esYo && rol !== usuario.role && (
        <div className="mej-acciones">
          <button className="icon-btn primary" disabled={estado.ocupado} onClick={() => patch({ rol }, 'Rol actualizado.')}>Guardar rol</button>
        </div>
      )}

      <CampoContrasena label="Restablecer contraseña" valor={password} onChange={setPassword} />
      <div className="mej-acciones">
        <button className="icon-btn" disabled={estado.ocupado || !password}
          onClick={async () => { if (await patch({ password }, 'Contraseña restablecida.')) setPassword(''); }}>Restablecer contraseña</button>
      </div>

      {!esYo && (
        <div className="usuario-baja">
          <b>{usuario.activo ? 'Dar de baja' : 'Reactivar'}</b>
          <span className="mej-nota">{usuario.activo
            ? 'No va a poder iniciar sesión. Sus turnos, cobros y cierres siguen registrados con su nombre.'
            : 'Va a poder volver a iniciar sesión con su usuario y contraseña.'}</span>
          <div className="mej-acciones">
            <button className={'icon-btn' + (usuario.activo ? ' destructivo' : '')} disabled={estado.ocupado}
              onClick={() => patch({ activo: !usuario.activo }, usuario.activo ? 'Usuario dado de baja.' : 'Usuario reactivado.')}>
              {usuario.activo ? 'Dar de baja' : 'Reactivar'}
            </button>
          </div>
        </div>
      )}

      {estado.msg && <p className={'status-msg' + (estado.err ? ' err' : '')} role="status">{estado.msg}</p>}
    </div>
  );
}
