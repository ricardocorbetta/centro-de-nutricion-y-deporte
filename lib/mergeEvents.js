// Combina los eventos importados de drManager (tabla periods) con los turnos
// reservados por el link público (tabla turnos_propios) para un mes dado, dentro de una empresa.
export async function fetchMonthEventsMerged(sb, empresaId, monthKey) {
  const [{ data: periodo, error: e1 }, { data: propios, error: e2 }] = await Promise.all([
    sb.from('periods').select('events, is_manual, manual_summary').eq('empresa_id', empresaId).eq('month_key', monthKey).single(),
    sb.from('turnos_propios').select('*').eq('empresa_id', empresaId).gte('day', monthKey + '-01').lte('day', monthKey + '-31')
  ]);
  const importados = periodo?.events || [];
  const propiosMapeados = (propios || []).map(t => ({
    day: t.day, time: t.time, resource: t.resource, service: t.service, duration: t.duration,
    status: t.status, financier: t.financier
  }));
  return {
    events: [...importados, ...propiosMapeados],
    isManual: !!periodo?.is_manual,
    manualSummary: periodo?.is_manual ? periodo.manual_summary : null,
    found: !e1 || !!periodo
  };
}
