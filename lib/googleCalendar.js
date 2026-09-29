// Integración con Google Calendar vía Service Account (sin flujo de login de Google).
// Un único Service Account de la plataforma (credenciales en variables de entorno)
// escribe en el calendario de cada clínica — la clínica solo tiene que compartir
// su Google Calendar con el email del Service Account (ver README).
//
// Todo acá es "best effort": si falla o no está configurado, no debe romper la
// creación/edición de turnos — solo se loguea el error y se sigue.

import jwt from 'jsonwebtoken';

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEZONE = 'America/Argentina/Buenos_Aires';

export function serviceAccountConfigurado() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

export function serviceAccountEmail() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;
}

function timeToMinutes(t) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); }
function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    privateKey,
    { algorithm: 'RS256' }
  );
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error de autenticación con Google.');
  return data.access_token;
}

function eventoDesdeTurno(turno, empresaNombre) {
  const endMinutes = timeToMinutes(turno.time) + (turno.duration || 30);
  return {
    summary: `${turno.paciente_nombre || 'Paciente'} — ${turno.resource}`,
    description: [
      `Servicio: ${turno.service || '-'}`,
      `Modalidad: ${turno.modalidad === 'videollamada' ? 'Videollamada' : 'Presencial'}`,
      turno.paciente_telefono ? `Teléfono: ${turno.paciente_telefono}` : null,
      empresaNombre ? `Cargado desde el panel de ${empresaNombre}` : null
    ].filter(Boolean).join('\n'),
    start: { dateTime: `${turno.day}T${turno.time}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${turno.day}T${minutesToTime(endMinutes)}:00`, timeZone: TIMEZONE }
  };
}

// Crea el evento en el Google Calendar de la clínica. Devuelve el eventId o null (si no está
// configurado, o si falla — nunca tira excepción hacia el que llama).
export async function crearEventoCalendario({ calendarId, turno, empresaNombre }) {
  if (!serviceAccountConfigurado() || !calendarId) return null;
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventoDesdeTurno(turno, empresaNombre))
    });
    const data = await res.json();
    if (!res.ok) { console.error('Google Calendar (crear evento):', data); return null; }
    return data.id || null;
  } catch (err) {
    console.error('Google Calendar (crear evento):', err.message);
    return null;
  }
}

// Borra el evento (se usa al cancelar un turno). No rompe nada si falla.
export async function eliminarEventoCalendario({ calendarId, eventId }) {
  if (!serviceAccountConfigurado() || !calendarId || !eventId) return false;
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    // 410/404 = ya no existe, lo tratamos como éxito igual.
    return res.ok || res.status === 410 || res.status === 404;
  } catch (err) {
    console.error('Google Calendar (borrar evento):', err.message);
    return false;
  }
}

// Prueba de conexión: intenta pedir metadata del calendario para validar credenciales + permisos.
export async function probarCalendario(calendarId) {
  if (!serviceAccountConfigurado()) {
    return { ok: false, error: 'El Service Account de Google todavía no está configurado en el servidor.' };
  }
  if (!calendarId) return { ok: false, error: 'Falta el ID del calendario.' };
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error?.message || 'No se pudo acceder a ese calendario.' };
    return { ok: true, summary: data.summary };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
