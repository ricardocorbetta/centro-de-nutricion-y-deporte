'use client';

import { useEffect, useState } from 'react';
import SidePanel from './SidePanel';

// Panel "Cambiar contraseña" del menú del avatar (dirección y secretaría).
// Se abre con window.dispatchEvent(new CustomEvent('cambiar-contrasena')).
export default function CambiarContrasena() {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [estado, setEstado] = useState({ ocupado: false, msg: '', err: false });

  useEffect(() => {
    function abrir() { setF({ actual: '', nueva: '', repetir: '' }); setEstado({ ocupado: false, msg: '', err: false }); setAbierto(true); }
    window.addEventListener('cambiar-contrasena', abrir);
    return () => window.removeEventListener('cambiar-contrasena', abrir);
  }, []);

  async function guardar(e) {
    e.preventDefault();
    if (f.nueva !== f.repetir) return setEstado({ ocupado: false, msg: 'La contraseña nueva no coincide en los dos campos.', err: true });
    setEstado({ ocupado: true, msg: '', err: false });
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sin-aviso': '1' },
        body: JSON.stringify({ actual: f.actual, nueva: f.nueva })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña.');
      setF({ actual: '', nueva: '', repetir: '' });
      setEstado({ ocupado: false, msg: 'Listo, tu contraseña quedó cambiada.', err: false });
    } catch (err) { setEstado({ ocupado: false, msg: err.message, err: true }); }
  }

  return (
    <SidePanel open={abierto} onClose={() => setAbierto(false)} title="Cambiar contraseña" width={420}>
      <form className="mej-form" onSubmit={guardar}>
        <label className="mej-campo"><span>Contraseña actual</span>
          <input type="password" autoComplete="current-password" value={f.actual} onChange={e => setF({ ...f, actual: e.target.value })} />
        </label>
        <label className="mej-campo"><span>Contraseña nueva</span>
          <input type="password" autoComplete="new-password" value={f.nueva} onChange={e => setF({ ...f, nueva: e.target.value })} />
          <small>Mínimo 10 caracteres, con letras y números.</small>
        </label>
        <label className="mej-campo"><span>Repetí la contraseña nueva</span>
          <input type="password" autoComplete="new-password" value={f.repetir} onChange={e => setF({ ...f, repetir: e.target.value })} />
        </label>
        <div className="mej-acciones">
          {estado.msg && <span className={'status-msg' + (estado.err ? ' err' : '')} role="status">{estado.msg}</span>}
          <button type="submit" className="icon-btn primary" disabled={estado.ocupado || !f.actual || !f.nueva}>
            {estado.ocupado ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}
