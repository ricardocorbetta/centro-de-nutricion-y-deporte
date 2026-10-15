'use client';

import { useEffect, useMemo, useState } from 'react';

// Pantalla "Inicio": lo que la clínica tiene que hacer, agrupado por urgencia (patrón de Balenzano).
// Los datos salen de /api/pendientes. onIr(seccion) lleva a la pantalla donde se resuelve cada cosa;
// la sección 'sugerencias' abre la caja de feedback.

const GRUPOS = [
  { id: 'vencido', label: 'Vencido', vacio: 'Nada vencido.' },
  { id: 'hoy', label: 'Hoy', vacio: 'Nada para hoy.' },
  { id: 'semana', label: 'Próximos 7 días', vacio: 'Nada para esta semana.' },
  { id: 'despues', label: 'Más adelante', vacio: '' }
];

function diasEntre(desde, hasta) {
  return Math.round((new Date(hasta + 'T12:00:00Z') - new Date(desde + 'T12:00:00Z')) / 86400000);
}

function grupoDe(fecha, hoy) {
  const d = diasEntre(hoy, fecha);
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoy';
  if (d <= 7) return 'semana';
  return 'despues';
}

function cuandoHumano(fecha, hoy) {
  const d = diasEntre(hoy, fecha);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Venció ayer';
  if (d < 0) return `Venció hace ${-d} días`;
  return `En ${d} días`;
}

function saludo() {
  const h = Number(new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

export default function InicioPendientes({ nombre, onIr }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');

  async function cargar() {
    setError('');
    try {
      const res = await fetch('/api/pendientes');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los pendientes.');
      setDatos(data);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { cargar(); }, []);

  const porGrupo = useMemo(() => {
    const g = { vencido: [], hoy: [], semana: [], despues: [] };
    (datos?.items || []).forEach(i => g[grupoDe(i.fecha, datos.hoy)].push(i));
    return g;
  }, [datos]);

  function ir(seccion) {
    if (seccion === 'sugerencias') window.dispatchEvent(new CustomEvent('abrir-sugerencias'));
    else onIr?.(seccion);
  }

  const primerNombre = (nombre || '').split(' ')[0];
  const fechaLarga = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const total = datos?.items?.length || 0;
  const grupos = filtro === 'todos' ? GRUPOS : GRUPOS.filter(g => g.id === filtro);

  return (
    <section className="inicio">
      <header className="inicio-head">
        <div>
          <h1>{saludo()}{primerNombre ? `, ${primerNombre}` : ''}</h1>
          <p className="inicio-fecha">{fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}</p>
        </div>
        {datos && (
          <div className="inicio-resumen">
            <div><span className="inicio-num">{datos.resumen.turnosHoy}</span><span>{datos.resumen.turnosHoy === 1 ? 'turno hoy' : 'turnos hoy'}</span></div>
            <div><span className="inicio-num">{'$' + Math.round(datos.resumen.cobradoHoy).toLocaleString('es-AR')}</span><span>cobrado hoy</span></div>
          </div>
        )}
      </header>

      {error ? (
        <div className="card empty-state">
          <div className="title">{error}</div>
          <button className="icon-btn" onClick={cargar}>Reintentar</button>
        </div>
      ) : !datos ? (
        <div className="inicio-cargando" aria-busy="true" aria-label="Cargando pendientes">
          {[0, 1, 2].map(i => <div key={i} className="inicio-skel" />)}
        </div>
      ) : !total ? (
        <div className="card empty-state inicio-aldia">
          <div className="title">Estás al día</div>
          <div className="hint">No hay turnos sin cerrar, cobros pendientes ni cajas abiertas.</div>
        </div>
      ) : (
        <>
          <div className="inicio-filtros" role="tablist" aria-label="Filtrar pendientes">
            <button role="tab" aria-selected={filtro === 'todos'} className={filtro === 'todos' ? 'active' : ''} onClick={() => setFiltro('todos')}>
              Todos <span>{total}</span>
            </button>
            {GRUPOS.filter(g => porGrupo[g.id].length).map(g => (
              <button key={g.id} role="tab" aria-selected={filtro === g.id} className={(filtro === g.id ? 'active ' : '') + 'f-' + g.id} onClick={() => setFiltro(g.id)}>
                {g.label} <span>{porGrupo[g.id].length}</span>
              </button>
            ))}
          </div>

          {grupos.filter(g => porGrupo[g.id].length).map(g => (
            <div key={g.id} className="inicio-grupo">
              <h2 className="inicio-grupo-titulo">{g.label}</h2>
              <ul className="inicio-lista">
                {porGrupo[g.id].map(item => (
                  <li key={item.id} className={'inicio-item u-' + g.id}>
                    <div className="inicio-item-texto">
                      <span className="inicio-item-titulo">{item.titulo}</span>
                      {item.detalle && <span className="inicio-item-detalle">{item.detalle}</span>}
                    </div>
                    <span className="inicio-item-cuando">{cuandoHumano(item.fecha, datos.hoy)}</span>
                    <button className="icon-btn" onClick={() => ir(item.seccion)}>{item.accion}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
