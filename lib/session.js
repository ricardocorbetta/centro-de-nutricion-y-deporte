import crypto from 'crypto';

const COOKIE_NAME = 'cnd_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno SESSION_SECRET.');
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signSession(payload) {
  const secret = getSecret();
  const data = base64url(JSON.stringify({ ...payload, exp: Date.now() + MAX_AGE_SECONDS * 1000 }));
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySession(token) {
  if (!token) return null;
  const secret = getSecret();
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
