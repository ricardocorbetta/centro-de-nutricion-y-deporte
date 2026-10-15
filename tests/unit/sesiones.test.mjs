// Pruebas de sesiones y permisos (lib/session.js y lib/auth.js): firma de cookies, cookies
// adulteradas, separación entre sesión de paciente y de personal, y rol de dirección.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let signSession, verifySession, auth;
before(async () => {
  process.env.SESSION_SECRET = 'secreto-de-prueba-solo-para-tests';
  ({ signSession, verifySession } = await import('../../lib/session.js'));
  auth = await import('../../lib/auth.js');
});

// Request mínimo con la interfaz que usan los helpers de lib/auth.js.
function requestCon(cookies) {
  return { cookies: { get: nombre => (cookies[nombre] ? { value: cookies[nombre] } : undefined) } };
}

test('una sesión firmada se verifica y una adulterada no', () => {
  const token = signSession({ typ: 'staff', userId: 'u1', empresaId: 'e1', role: 'director' });
  assert.equal(verifySession(token).userId, 'u1');
  const [data, sig] = token.split('.');
  assert.equal(verifySession(data + '.' + sig.slice(0, -2) + 'xx'), null);
  assert.equal(verifySession('abc.def'), null, 'firma de otro largo: no debe tirar error');
  assert.equal(verifySession(''), null);
});

test('el personal de la clínica pasa requireEmpresaSession', () => {
  const token = signSession({ typ: 'staff', userId: 'u1', empresaId: 'e1', role: 'secretaria' });
  const r = auth.requireEmpresaSession(requestCon({ cnd_session: token }));
  assert.equal(r.error, undefined);
  assert.equal(r.session.empresaId, 'e1');
});

test('las sesiones viejas sin "typ" siguen funcionando para el personal', () => {
  const token = signSession({ userId: 'u1', empresaId: 'e1', role: 'director' });
  assert.equal(auth.requireEmpresaSession(requestCon({ cnd_session: token })).error, undefined);
});

test('una sesión de paciente pegada en la cookie del personal es rechazada', async () => {
  for (const payload of [
    { typ: 'paciente', pacienteId: 7, empresaId: 'e1' },
    { pacienteId: 7, empresaId: 'e1' } // tokens de paciente emitidos antes del campo typ
  ]) {
    const token = signSession(payload);
    const r = auth.requireEmpresaSession(requestCon({ cnd_session: token }));
    assert.ok(r.error, JSON.stringify(payload));
    assert.equal(r.error.status, 401);
  }
});

test('la secretaria no pasa requireDirectorSession y la directora sí', () => {
  const sec = signSession({ typ: 'staff', empresaId: 'e1', role: 'secretaria' });
  const dir = signSession({ typ: 'staff', empresaId: 'e1', role: 'director' });
  assert.equal(auth.requireDirectorSession(requestCon({ cnd_session: sec })).error.status, 403);
  assert.equal(auth.requireDirectorSession(requestCon({ cnd_session: dir })).error, undefined);
});

test('el portal de pacientes no acepta sesiones del personal', () => {
  const staff = signSession({ typ: 'staff', empresaId: 'e1', role: 'director', pacienteId: 3 });
  assert.ok(auth.requirePacienteSession(requestCon({ cnd_paciente_session: staff })).error);
  const pac = signSession({ typ: 'paciente', pacienteId: 3, empresaId: 'e1' });
  assert.equal(auth.requirePacienteSession(requestCon({ cnd_paciente_session: pac })).error, undefined);
});

test('el panel de plataforma exige admin y rechaza tokens de paciente', () => {
  const admin = signSession({ typ: 'staff', esAdminPlataforma: true, empresaId: null });
  const dir = signSession({ typ: 'staff', empresaId: 'e1', role: 'director' });
  assert.equal(auth.requireAdminPlataforma(requestCon({ cnd_session: admin })).error, undefined);
  assert.equal(auth.requireAdminPlataforma(requestCon({ cnd_session: dir })).error.status, 403);
  assert.equal(auth.requireEmpresaSession(requestCon({ cnd_session: admin })).error.status, 403);
});

test('sin cookie no hay sesión', () => {
  assert.equal(auth.requireEmpresaSession(requestCon({})).error.status, 401);
  assert.equal(auth.requirePacienteSession(requestCon({})).error.status, 401);
});
