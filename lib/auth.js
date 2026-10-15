import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME, PACIENTE_SESSION_COOKIE_NAME } from './session';

// Para usar en Server Components (ej. app/page.js)
export function getServerSession() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(token);
  return session && !esTokenDePaciente(session) ? session : null;
}

// Para usar dentro de API routes (Route Handlers)
export function getSessionFromRequest(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

// Exige una sesión de un usuario de empresa (director o secretaria) con empresaId.
// Un admin de plataforma (empresaId null) NO pasa este chequeo — usa las rutas /api/xenom/*.
// Devuelve { session } o { error: NextResponse } listo para retornar tal cual desde el route handler.
// Los tokens de staff y de paciente se firman con el mismo secreto: hay que rechazar explícitamente
// un token de paciente (tiene pacienteId / typ 'paciente') pegado en la cookie de staff.
function esTokenDePaciente(session) {
  return session.typ === 'paciente' || session.pacienteId !== undefined;
}

export function requireEmpresaSession(request) {
  const session = getSessionFromRequest(request);
  if (!session || esTokenDePaciente(session)) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  if (!session.empresaId) return { error: NextResponse.json({ error: 'Esta cuenta no pertenece a una empresa.' }, { status: 403 }) };
  return { session };
}

// Como requireEmpresaSession, pero solo para dirección (precios, objetivos, cuestionarios,
// borrar cobros, reabrir caja, etc.). La UI ya lo esconde a la secretaria; esto lo hace cumplir.
export function requireDirectorSession(request) {
  const r = requireEmpresaSession(request);
  if (r.error) return r;
  if (r.session.role !== 'director') {
    return { error: NextResponse.json({ error: 'Solo dirección puede hacer esto.' }, { status: 403 }) };
  }
  return r;
}

// Exige un admin de plataforma (EULALIA).
export function requireAdminPlataforma(request) {
  const session = getSessionFromRequest(request);
  if (!session) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  if (esTokenDePaciente(session) || !session.esAdminPlataforma) return { error: NextResponse.json({ error: 'Solo administración de la plataforma.' }, { status: 403 }) };
  return { session };
}

// Sesión del portal de pacientes (cookie separada de la de empresa/staff).
export function getPacienteSessionFromRequest(request) {
  const token = request.cookies.get(PACIENTE_SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

export function requirePacienteSession(request) {
  const session = getPacienteSessionFromRequest(request);
  if (!session || !session.pacienteId || session.typ === 'staff') return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  return { session };
}
