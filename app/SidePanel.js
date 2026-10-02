'use client';

import { useEffect } from 'react';

// Panel lateral compartido: reemplaza los modales centrados (que tapaban toda la pantalla)
// en toda la app — formularios de creación/edición, confirmaciones, y cualquier acción que
// antes abría un popup. Se desliza desde la derecha y deja ver el resto de la pantalla atrás.
// Uso:
//   <SidePanel open={!!algo} onClose={() => setAlgo(null)} title="Nuevo turno">
//     ...contenido...
//   </SidePanel>
// El footer (botones de acción) va como children también — no hay slot separado, para que
// cada caso controle su propio layout (ej: error + botones juntos).
export default function SidePanel({ open, onClose, title, subtitle, width = 440, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sidepanel-backdrop" onClick={onClose} />
      <aside className="sidepanel" style={{ '--sp-width': width + 'px' }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sidepanel-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="sidepanel-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="sidepanel-body">{children}</div>
      </aside>
    </>
  );
}
