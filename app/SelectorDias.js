'use client';

import { DIAS_CORTOS } from '../lib/disponibilidad';

// Tira de días con lugar libre (reserva pública y "Nuevo turno").
// dias: [{ fecha, atiende, libres }] — de /api/public/disponibilidad-rango
export default function SelectorDias({ dias, seleccionada, onElegir, cargando }) {
  if (cargando) {
    return <div className="dias-tira" aria-busy="true">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="dia-chip esqueleto" />)}</div>;
  }
  return (
    <div className="dias-tira" role="listbox" aria-label="Elegí un día">
      {dias.map(d => {
        const fecha = new Date(d.fecha + 'T12:00:00Z');
        const disponible = d.atiende && d.libres > 0;
        const estado = !d.atiende ? 'No atiende' : d.libres === 0 ? 'Completo' : `${d.libres} ${d.libres === 1 ? 'libre' : 'libres'}`;
        return (
          <button key={d.fecha} type="button" role="option" aria-selected={seleccionada === d.fecha}
            disabled={!disponible}
            className={'dia-chip' + (seleccionada === d.fecha ? ' activo' : '') + (!d.atiende ? ' no-atiende' : '') + (d.atiende && !d.libres ? ' completo' : '')}
            onClick={() => onElegir(d.fecha)}
            aria-label={`${DIAS_CORTOS[fecha.getUTCDay()]} ${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}: ${estado}`}>
            <span className="dia-chip-semana">{DIAS_CORTOS[fecha.getUTCDay()]}</span>
            <span className="dia-chip-numero">{Number(d.fecha.slice(8, 10))}</span>
            <span className="dia-chip-estado">{estado}</span>
          </button>
        );
      })}
    </div>
  );
}

// Horarios de un día agrupados en mañana y tarde.
export function GrillaHorarios({ horarios, seleccionado, onElegir }) {
  const manana = horarios.filter(h => h < '13:00');
  const tarde = horarios.filter(h => h >= '13:00');
  return (
    <div className="horarios-grupos">
      {[['Mañana', manana], ['Tarde', tarde]].filter(([, l]) => l.length).map(([titulo, lista]) => (
        <div key={titulo} className="horarios-grupo">
          <span className="horarios-grupo-titulo">{titulo}</span>
          <div className="timeslot-grid">
            {lista.map(h => (
              <button key={h} type="button" className={'icon-btn' + (seleccionado === h ? ' primary' : '')}
                aria-pressed={seleccionado === h} onClick={() => onElegir(h)}>{h}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
