import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from './session';

// Para usar en Server Components (ej. app/page.js)
export function getServerSession() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

// Para usar dentro de API routes (Route Handlers)
export function getSessionFromRequest(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

// Exige una sesión de un usuario de empresa (director o secretaria) con empresaId.
// Un admin de plataforma (empresaId null) NO pasa este chequeo — usa las rutas /api/xenom/*.
// Devuelve { session } o { error: NextResponse } listo para retornar tal cual desde el route handler.
export function requireEmpresaSession(request) {
  const session = getSessionFromRequest(request);
  if (!session) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  if (!session.empresaId) return { error: NextResponse.json({ error: 'Esta cuenta no pertenece a una empresa.' }, { status: 403 }) };
  return { session };
}

// Exige un admin de plataforma (Xenom).
export function requireAdminPlataforma(request) {
  const session = getSessionFromRequest(request);
  if (!session) return { error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  if (!session.esAdminPlataforma) return { error: NextResponse.json({ error: 'Solo administración de la plataforma.' }, { status: 403 }) };
  return { session };
}
