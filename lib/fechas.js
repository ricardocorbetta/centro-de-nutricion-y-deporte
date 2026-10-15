// Fecha y hora "de la clínica". new Date().toISOString() da la fecha en UTC: en Argentina (UTC-3),
// desde las 21:00 eso ya es "mañana", y en Vercel el servidor corre en UTC. Usar siempre estos helpers
// para "hoy" y "ahora".

export const TZ_CLINICA = 'America/Argentina/Buenos_Aires';

// 'YYYY-MM-DD' de hoy en hora argentina.
export function hoyAR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_CLINICA, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

// 'HH:MM' de ahora en hora argentina.
export function horaAR() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_CLINICA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date());
}

// Pasa un instante (ISO con zona, ej. date_approved de MercadoPago) a 'YYYY-MM-DD' en hora argentina.
export function fechaARDe(instante) {
  const d = new Date(instante);
  if (isNaN(d)) return hoyAR();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_CLINICA, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

export function esFechaISO(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
}

export function esHoraHHMM(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
