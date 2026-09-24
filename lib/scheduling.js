export function timeToMinutes(t) {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
}
export function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Genera horarios candidatos entre horaInicio y horaFin (inclusive del último que entre completo),
// en pasos de `duracion` minutos (así los turnos quedan uno atrás del otro, sin huecos).
export function generateSlots(horaInicio, horaFin, duracion) {
  const start = timeToMinutes(horaInicio);
  const end = timeToMinutes(horaFin);
  const slots = [];
  for (let t = start; t + duracion <= end; t += duracion) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

// existentes: [{ time, duration }]. Devuelve true si el candidato (candidateStart, candidateDuration)
// se superpone con algún turno ya existente.
export function overlapsAny(existentes, candidateStart, candidateDuration) {
  const cStart = timeToMinutes(candidateStart);
  const cEnd = cStart + candidateDuration;
  return existentes.some(ev => {
    const eStart = timeToMinutes(ev.time);
    const eEnd = eStart + (ev.duration || 0);
    return cStart < eEnd && eStart < cEnd;
  });
}
