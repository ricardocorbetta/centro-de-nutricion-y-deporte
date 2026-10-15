'use client';

import { useEffect, useRef, useState } from 'react';

// Avisos de guardado para toda la app (patrón tomado de Balenzano). Envuelve window.fetch una sola
// vez: toda llamada que modifica datos (POST/PUT/PATCH/DELETE) a /api/ muestra "Cambios guardados"
// si sale bien, o el error que devolvió el servidor si falla. Así cada pantalla tiene feedback sin
// código propio.
// - No avisa en login, portal de pacientes, páginas públicas ni el latido.
// - Una pantalla que ya muestra su propio mensaje puede evitarlo mandando el header 'x-sin-aviso'.
// - Agrupa avisos iguales en menos de 2 s (ej. guardar mientras se escribe) y muestra hasta 3.
// - También se puede disparar a mano: window.dispatchEvent(new CustomEvent('aviso', { detail: { texto, tipo } })).

const EXCLUIDAS = ['/api/auth/', '/api/portal/', '/api/public/', '/api/latido'];
const DURACION = { ok: 2600, error: 7000, info: 4000 };

function rutaDe(input) {
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin ? u.pathname : null;
  } catch (e) { return null; }
}

function tieneSinAviso(init) {
  const h = init?.headers;
  if (!h) return false;
  if (typeof h.has === 'function') return h.has('x-sin-aviso');
  return Object.keys(h).some(k => k.toLowerCase() === 'x-sin-aviso');
}

export default function AvisosGlobales() {
  const [avisos, setAvisos] = useState([]);
  const ultimo = useRef({ texto: '', en: 0 });

  useEffect(() => {
    function mostrar(texto, tipo = 'ok') {
      const ahora = Date.now();
      if (ultimo.current.texto === texto && ahora - ultimo.current.en < 2000) return;
      ultimo.current = { texto, en: ahora };
      const id = ahora + Math.random();
      setAvisos(a => [...a.slice(-2), { id, texto, tipo }]);
      setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), DURACION[tipo] || 3000);
    }

    function onAviso(e) { if (e.detail?.texto) mostrar(e.detail.texto, e.detail.tipo || 'info'); }
    window.addEventListener('aviso', onAviso);

    if (window.__avisosFetch) return () => window.removeEventListener('aviso', onAviso);
    const original = window.fetch.bind(window);
    window.__avisosFetch = true;
    window.fetch = async (input, init) => {
      const metodo = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const ruta = rutaDe(input);
      const avisar = metodo !== 'GET' && ruta && ruta.startsWith('/api/')
        && !EXCLUIDAS.some(p => ruta.startsWith(p)) && !tieneSinAviso(init);
      if (!avisar) return original(input, init);
      try {
        const res = await original(input, init);
        if (res.ok) {
          mostrar(metodo === 'DELETE' ? 'Se eliminó correctamente' : 'Cambios guardados', 'ok');
        } else {
          let msg = '';
          try { msg = (await res.clone().json())?.error || ''; } catch (e) { /* sin JSON */ }
          mostrar(msg || (res.status >= 500 ? 'No se pudo guardar. Probá de nuevo en un minuto.' : 'No se pudo guardar.'), 'error');
        }
        return res;
      } catch (err) {
        mostrar('No hay conexión con el servidor. Revisá internet y probá de nuevo.', 'error');
        throw err;
      }
    };
    return () => window.removeEventListener('aviso', onAviso);
  }, []);

  return (
    <div className="avisos" aria-live="polite" role="status">
      {avisos.map(a => (
        <div key={a.id} className={'aviso aviso-' + a.tipo}>
          <span className="aviso-marca" aria-hidden="true">{a.tipo === 'ok' ? '✓' : a.tipo === 'error' ? '!' : 'i'}</span>
          <span>{a.texto}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setAvisos(x => x.filter(y => y.id !== a.id))}>✕</button>
        </div>
      ))}
    </div>
  );
}
