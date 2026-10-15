// Horarios de atención y turnos libres. Lo usan la reserva pública, "Nuevo turno" de la agenda y
// las rutas /api/public/disponibilidad*. Sin dependencias de servidor: se puede importar en el cliente.
import { generateSlots, overlapsAny } from './scheduling';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // lunes primero

// '09:00:00' -> '9', '13:30' -> '13:30'
function horaCorta(h) {
  const [hh, mm] = String(h || '').split(':');
  const n = Number(hh);
  return mm && mm !== '00' ? `${n}:${mm}` : String(n);
}

function unirDias(dias) {
  const nombres = dias.map(d => DIAS_CORTOS[d]);
  if (nombres.length <= 1) return nombres.join('');
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

// Texto corto de los días y horas que atiende un profesional, agrupando los días con el mismo horario.
// horarios: [{ diaSemana, horaInicio, horaFin }] -> "Lun, Mié y Vie de 9 a 13 h · Jue de 15 a 19 h"
export function resumenHorarios(horarios) {
  const grupos = new Map();
  (horarios || []).forEach(h => {
    if (h.diaSemana === null || h.diaSemana === undefined) return;
    const clave = `${horaCorta(h.horaInicio)}–${horaCorta(h.horaFin)}`;
    if (!grupos.has(clave)) grupos.set(clave, { desde: horaCorta(h.horaInicio), hasta: horaCorta(h.horaFin), dias: [] });
    const g = grupos.get(clave);
    if (!g.dias.includes(h.diaSemana)) g.dias.push(h.diaSemana);
  });
  if (!grupos.size) return '';
  return [...grupos.values()]
    .map(g => ({ ...g, dias: g.dias.sort((a, b) => ORDEN_SEMANA.indexOf(a) - ORDEN_SEMANA.indexOf(b)) }))
    .sort((a, b) => ORDEN_SEMANA.indexOf(a.dias[0]) - ORDEN_SEMANA.indexOf(b.dias[0]))
    .map(g => `${unirDias(g.dias)} de ${g.desde} a ${g.hasta} h`)
    .join(' · ');
}

// Horario de un día concreto: la excepción de esa fecha manda sobre el horario semanal.
// recurrentes: filas de profesional_horarios con dia_semana; excepciones: filas con fecha.
export function horarioDelDia(fechaISO, recurrentes, excepciones) {
  const exc = (excepciones || []).find(e => e.fecha === fechaISO);
  if (exc) return exc.activo ? { atiende: true, horaInicio: exc.hora_inicio, horaFin: exc.hora_fin } : { atiende: false };
  const dia = new Date(fechaISO + 'T12:00:00Z').getUTCDay();
  const rec = (recurrentes || []).find(r => r.dia_semana === dia && r.activo !== false);
  return rec ? { atiende: true, horaInicio: rec.hora_inicio, horaFin: rec.hora_fin } : { atiende: false };
}

// Horarios libres de un día. existentes: [{ time, duration }] ya ocupados (sin cancelados).
// ahora ('HH:MM'): si se pasa, descarta los horarios que ya pasaron (para el día de hoy).
export function libresDelDia(horario, existentes, duracion, ahora = null) {
  if (!horario?.atiende) return [];
  return generateSlots(horario.horaInicio, horario.horaFin, duracion)
    .filter(h => (!ahora || h > ahora) && !overlapsAny(existentes, h, duracion));
}

export function sumarDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "jue 16/10"
export function fechaCorta(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return `${DIAS_CORTOS[d.getUTCDay()].toLowerCase()} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export { DIAS_CORTOS };
