import { cookies } from 'next/headers';
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
