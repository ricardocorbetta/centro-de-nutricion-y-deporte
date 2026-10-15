// Primer día del mes siguiente a 'YYYY-MM' (para filtrar un mes con day >= inicio AND day < siguiente:
// usar "<= YYYY-MM-31" rompe en meses de 30 días, porque '2026-09-31' no es una fecha válida).
export function inicioMesSiguiente(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

// Combina los eventos importados de drManager (tabla periods) con los turnos
// reservados por el link público (tabla turnos_propios) para un mes dado, dentro de una empresa.
export async function fetchMonthEventsMerged(sb, empresaId, monthKey) {
  const [{ data: periodo }, { data: propios, error: e2 }] = await Promise.all([
    sb.from('periods').select('events, is_manual, manual_summary').eq('empresa_id', empresaId).eq('month_key', monthKey).maybeSingle(),
    sb.from('turnos_propios').select('*').eq('empresa_id', empresaId).gte('day', monthKey + '-01').lt('day', inicioMesSiguiente(monthKey))
  ]);
  if (e2) throw new Error('No se pudieron leer los turnos del mes: ' + e2.message);
  const importados = periodo?.events || [];
  const propiosMapeados = (propios || []).map(t => ({
    day: t.day, time: t.time, resource: t.resource, service: t.service, duration: t.duration,
    status: t.status, financier: t.financier
  }));
  return {
    events: [...importados, ...propiosMapeados],
    isManual: !!periodo?.is_manual,
    manualSummary: periodo?.is_manual ? periodo.manual_summary : null,
    found: !!periodo || propiosMapeados.length > 0
  };
}
