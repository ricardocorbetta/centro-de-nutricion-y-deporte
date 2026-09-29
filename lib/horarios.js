// Resuelve el horario de atención de un profesional para una fecha puntual, dentro de una empresa,
// contemplando excepciones (fecha exacta) por sobre el horario recurrente (día de semana).
// Devuelve { atiende: boolean, horaInicio, horaFin } — horaInicio/horaFin son null si no atiende.
export async function resolverHorarioDia(sb, empresaId, profesional, fechaISO) {
  const diaSemana = new Date(fechaISO + 'T00:00:00').getDay();

  const [{ data: excepcion }, { data: recurrentes }] = await Promise.all([
    sb.from('profesional_horarios').select('*').eq('empresa_id', empresaId).eq('profesional', profesional).eq('fecha', fechaISO).maybeSingle(),
    sb.from('profesional_horarios').select('*').eq('empresa_id', empresaId).eq('profesional', profesional).eq('dia_semana', diaSemana)
  ]);

  if (excepcion) {
    if (!excepcion.activo) return { atiende: false, horaInicio: null, horaFin: null };
    return { atiende: true, horaInicio: excepcion.hora_inicio, horaFin: excepcion.hora_fin };
  }
  const rec = (recurrentes || []).find(r => r.activo);
  if (!rec) return { atiende: false, horaInicio: null, horaFin: null };
  return { atiende: true, horaInicio: rec.hora_inicio, horaFin: rec.hora_fin };
}
