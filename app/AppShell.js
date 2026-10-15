'use client';

import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Icono from './Icono';
import SidePanel from './SidePanel';
import { LOGO_DATA_URI } from '../lib/logo';

// Armazón de las pantallas internas (dirección y secretaría), con el patrón de Balenzano:
// - Computadora: barra superior con marca, los destinos principales en una fila y el menú del avatar.
// - Celular (≤ 900px): barra superior mínima y barra inferior con hasta 4 destinos + "Más".
// Props:
//   destinos: [{ id, label, icono }]  — destinos principales (el primero suele ser Inicio)
//   activo: id del destino activo
//   onIr(id): navegar a un destino
//   menu: [{ id, label, icono, onClick }] — opciones del menú del avatar (Configuración, Salir…)
export default function AppShell({ empresa, nombre, rol, destinos, activo, onIr, menu = [], children }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuAbierto) return;
    function fuera(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false); }
    function esc(e) { if (e.key === 'Escape') setMenuAbierto(false); }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [menuAbierto]);

  const enBarraInferior = destinos.slice(0, destinos.length > 5 ? 4 : 5);
  const enMas = destinos.slice(enBarraInferior.length);
  const hayMas = enMas.length > 0 || menu.length > 0;
  const activoEnMas = enMas.some(d => d.id === activo) || menu.some(m => m.id === activo);

  function ir(id) { setMasAbierto(false); setMenuAbierto(false); onIr(id); window.scrollTo({ top: 0 }); }

  return (
    <div className="shell">
      <header className="shell-top">
        <div className="shell-top-inner">
          <button type="button" className="shell-marca" onClick={() => ir(destinos[0].id)} aria-label="Ir al inicio">
            {/* El logo de la clínica ya trae su nombre: no se repite al lado. */}
            <img src={empresa?.logoUrl || LOGO_DATA_URI} alt={empresa?.nombre || 'Inicio'} />
          </button>

          <nav className="shell-nav" aria-label="Secciones">
            {destinos.map(d => (
              <button key={d.id} type="button" className={'shell-nav-item' + (activo === d.id ? ' activo' : '')}
                aria-current={activo === d.id ? 'page' : undefined} onClick={() => ir(d.id)}>
                <Icono nombre={d.icono} size={18} />
                <span>{d.label}</span>
              </button>
            ))}
          </nav>

          <div className="shell-usuario" ref={menuRef}>
            <button type="button" className="shell-usuario-btn" aria-haspopup="menu" aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto(v => !v)}>
              <Avatar nombre={nombre} size={30} />
              <span className="shell-usuario-nombre">{nombre}</span>
              <Icono nombre="abajo" size={16} />
            </button>
            {menuAbierto && (
              <div className="shell-menu" role="menu">
                <div className="shell-menu-cabecera">
                  <b>{nombre}</b>
                  <span>{rol === 'secretaria' ? 'Secretaría' : 'Dirección'} · {empresa?.nombre || ''}</span>
                </div>
                {menu.map(m => (
                  <button key={m.id} type="button" role="menuitem" className={'shell-menu-item' + (activo === m.id ? ' activo' : '')}
                    onClick={() => { setMenuAbierto(false); m.onClick ? m.onClick() : ir(m.id); }}>
                    <Icono nombre={m.icono} size={18} />{m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="shell-main">{children}</main>

      <nav className="shell-bottom" aria-label="Secciones">
        {enBarraInferior.map(d => (
          <button key={d.id} type="button" className={activo === d.id ? 'activo' : ''}
            aria-current={activo === d.id ? 'page' : undefined} onClick={() => ir(d.id)}>
            <Icono nombre={d.icono} size={22} /><span>{d.label}</span>
          </button>
        ))}
        {hayMas && (
          <button type="button" className={activoEnMas ? 'activo' : ''} onClick={() => setMasAbierto(true)}>
            <Icono nombre="mas" size={22} /><span>Más</span>
          </button>
        )}
      </nav>

      <SidePanel open={masAbierto} onClose={() => setMasAbierto(false)} title="Más opciones" width={360}>
        <div className="shell-mas">
          {enMas.map(d => (
            <button key={d.id} type="button" className={'shell-menu-item' + (activo === d.id ? ' activo' : '')} onClick={() => ir(d.id)}>
              <Icono nombre={d.icono} size={20} />{d.label}
            </button>
          ))}
          {menu.map(m => (
            <button key={m.id} type="button" className={'shell-menu-item' + (activo === m.id ? ' activo' : '')}
              onClick={() => { setMasAbierto(false); m.onClick ? m.onClick() : ir(m.id); }}>
              <Icono nombre={m.icono} size={20} />{m.label}
            </button>
          ))}
        </div>
      </SidePanel>
    </div>
  );
}

// Pestañas dentro de una sección con varias pantallas (Comunicación, Reportes, Configuración).
export function SubNav({ items, activo, onIr, extra }) {
  return (
    <div className="subnav">
      <div className="subnav-tabs" role="tablist">
        {items.map(i => (
          <button key={i.id} role="tab" type="button" aria-selected={activo === i.id}
            className={activo === i.id ? 'activo' : ''} onClick={() => onIr(i.id)}>{i.label}</button>
        ))}
      </div>
      {extra && <div className="subnav-extra">{extra}</div>}
    </div>
  );
}
