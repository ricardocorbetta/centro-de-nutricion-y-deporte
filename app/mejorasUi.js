'use client';

// Piezas de interfaz compartidas por la caja de feedback de la clínica (FeedbackBoton) y la
// bandeja del Panel EULALIA (MejorasBandeja).

export const TIPOS = [
  { id: 'error', label: 'Algo no funciona', hint: 'Un error o algo que se comporta raro' },
  { id: 'mejora', label: 'Mejora', hint: 'Algo que existe y podría funcionar mejor' },
  { id: 'idea', label: 'Idea', hint: 'Algo nuevo que te gustaría tener' },
  { id: 'consulta', label: 'Consulta', hint: 'Una duda sobre cómo usar algo' }
];
export const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.id, t.label]));

export const ESTADO_LABEL = {
  nuevo: 'Nuevo', en_analisis: 'En análisis', planificado: 'Planificado',
  en_curso: 'En curso', hecho: 'Hecho', descartado: 'Descartado'
};
const ESTADO_TONO = {
  nuevo: 'gold', en_analisis: 'gold', planificado: 'gold', en_curso: 'gold', hecho: 'sage', descartado: ''
};

export function EstadoTag({ estado }) {
  return <span className={'tag ' + (ESTADO_TONO[estado] || '')}>{ESTADO_LABEL[estado] || estado}</span>;
}

export function fmtFechaHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

// Historial de un pedido: comentarios y cambios de estado, en orden.
export function Historial({ mejora, mostrarInternos }) {
  const items = (mejora.comentarios || []).filter(c => mostrarInternos || !c.interno);
  if (!items.length) return <p className="mej-vacio">Todavía no hay respuestas.</p>;
  return (
    <ol className="mej-historial">
      {items.map(c => (
        <li key={c.id} className={(c.tipo === 'estado' ? 'es-estado ' : '') + (c.interno ? 'es-interno ' : '') + (c.de_plataforma ? 'de-plataforma' : '')}>
          <div className="mej-historial-meta">
            <b>{c.autor_nombre}</b> · {fmtFechaHora(c.created_at)}{c.interno && ' · nota interna'}
          </div>
          <div className="mej-historial-texto">{c.texto}</div>
        </li>
      ))}
    </ol>
  );
}

export function Capturas({ urls }) {
  if (!urls?.length) return null;
  return (
    <div className="mej-capturas">
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Captura ${i + 1}`} /></a>
      ))}
    </div>
  );
}

export async function leerJson(res) {
  try { return await res.json(); } catch (e) { return {}; }
}
