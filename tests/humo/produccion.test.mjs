// Pruebas de humo contra la app publicada. NO escriben datos: solo leen, o mandan datos inválidos
// que el servidor tiene que rechazar antes de guardar nada.
// Correr con: npm run test:humo   (otra URL: BASE_URL=https://... npm run test:humo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = (process.env.BASE_URL || 'https://centro-de-nutricion-y-deporte-vt6l.vercel.app').replace(/\/$/, '');
const EMPRESA = process.env.EMPRESA_SLUG || 'cnd';

async function pedir(ruta, init = {}) {
  const res = await fetch(BASE + ruta, { redirect: 'manual', ...init });
  let cuerpo = null;
  const tipo = res.headers.get('content-type') || '';
  if (tipo.includes('application/json')) cuerpo = await res.json().catch(() => null);
  else cuerpo = await res.text();
  return { status: res.status, cuerpo, headers: res.headers };
}
const postJson = (ruta, body) => pedir(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('el latido responde y la base está viva', async () => {
  const r = await pedir('/api/latido');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.ok, true);
});

test('el login carga con la marca EULALIA y en español de Argentina', async () => {
  const r = await pedir('/login');
  assert.equal(r.status, 200);
  assert.match(r.cuerpo, /<title>EULALIA/);
  assert.match(r.cuerpo, /lang="es-AR"/);
  assert.doesNotMatch(r.cuerpo, /NUTRIO/);
  assert.doesNotMatch(r.cuerpo, /fonts\.googleapis\.com/, 'las fuentes se sirven desde la app');
});

test('sin sesión, la página principal manda al login', async () => {
  const r = await pedir('/');
  assert.ok([302, 307, 308].includes(r.status), 'status ' + r.status);
  assert.match(r.headers.get('location') || '', /\/login$/);
});

test('todas las rutas internas rechazan a quien no inició sesión', async () => {
  const rutas = ['/api/pendientes', '/api/pacientes', '/api/agenda?fecha=2026-10-15', '/api/mejoras',
    '/api/bootstrap', '/api/goals', '/api/cobros', '/api/caja-resumen?desde=2026-10-01&hasta=2026-10-15',
    '/api/xenom/empresas', '/api/xenom/mejoras', '/api/admin/cuestionarios', '/api/biblioteca',
    '/api/portal/me', '/api/portal/plan', '/api/admin/usuarios'];
  for (const ruta of rutas) {
    const r = await pedir(ruta);
    assert.equal(r.status, 401, ruta + ' devolvió ' + r.status);
  }
  for (const ruta of ['/api/config', '/api/mejoras', '/api/turnos', '/api/cobros', '/api/admin/usuarios', '/api/auth/password']) {
    const r = await postJson(ruta, {});
    assert.equal(r.status, 401, 'POST ' + ruta + ' devolvió ' + r.status);
  }
});

test('los logins funcionan: un usuario inexistente recibe "incorrectos", no un error', async () => {
  // Prueba que el servidor sigue pudiendo ejecutar verify_login / verify_login_paciente.
  const staff = await postJson('/api/auth/login', { username: 'prueba-automatica-inexistente', password: 'x' });
  assert.equal(staff.status, 401, 'login de personal devolvió ' + staff.status + ' ' + JSON.stringify(staff.cuerpo));
  assert.match(staff.cuerpo.error, /incorrectos/);
  const pac = await postJson('/api/portal/login', { empresaSlug: EMPRESA, usuario: 'prueba-automatica-inexistente', password: 'x' });
  assert.ok([401, 403].includes(pac.status), 'login del portal devolvió ' + pac.status + ' ' + JSON.stringify(pac.cuerpo));
});

test('una cookie adulterada da 401, no un error del servidor', async () => {
  for (const cookie of ['cnd_session=abc.def', 'cnd_session=eyJ0eXAiOiJwYWNpZW50ZSJ9.firmafalsa', 'cnd_session=sinpunto']) {
    const r = await pedir('/api/pacientes', { headers: { Cookie: cookie } });
    assert.equal(r.status, 401, cookie + ' devolvió ' + r.status);
  }
});

test('los datos públicos del centro no exponen credenciales', async () => {
  const p = await pedir('/api/public/profesionales?empresa=' + EMPRESA);
  assert.equal(p.status, 200);
  assert.ok(Array.isArray(p.cuerpo.profesionales) && p.cuerpo.profesionales.length > 0, 'hay profesionales activos');
  const e = await pedir('/api/public/empresa?empresa=' + EMPRESA);
  assert.equal(e.status, 200);
  for (const texto of [JSON.stringify(p.cuerpo), JSON.stringify(e.cuerpo)]) {
    assert.doesNotMatch(texto, /access_token|APP_USR-|password|secret/i);
  }
});

test('la disponibilidad pública no ofrece días pasados ni duraciones absurdas', async () => {
  const prof = (await pedir('/api/public/profesionales?empresa=' + EMPRESA)).cuerpo.profesionales[0].nombre;
  const q = `/api/public/disponibilidad?empresa=${EMPRESA}&profesional=${encodeURIComponent(prof)}`;
  const pasado = await pedir(q + '&fecha=2020-01-06&duracion=40');
  assert.equal(pasado.status, 200);
  assert.deepEqual(pasado.cuerpo.horarios, []);
  assert.equal((await pedir(q + '&fecha=2030-01-07&duracion=1')).status, 400);
  assert.equal((await pedir(q + '&fecha=2030-01-07&duracion=600')).status, 400);
  assert.equal((await pedir(`/api/public/disponibilidad?empresa=${EMPRESA}&profesional=NoExiste&fecha=2030-01-07&duracion=40`)).status, 404);
});

test('la disponibilidad por rango devuelve días futuros con sus turnos libres', async () => {
  const prof = (await pedir('/api/public/profesionales?empresa=' + EMPRESA)).cuerpo.profesionales[0];
  const dur = prof.servicios[0]?.duracion || 40;
  const q = `/api/public/disponibilidad-rango?empresa=${EMPRESA}&profesional=${encodeURIComponent(prof.nombre)}&duracion=${dur}`;
  const r = await pedir(q + '&desde=2020-01-01&dias=10');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.dias.length, 10);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  assert.ok(r.cuerpo.dias[0].fecha >= hoy, 'al público no le muestra días pasados');
  for (const d of r.cuerpo.dias) {
    assert.equal(d.libres, d.horarios.length);
    if (!d.atiende) assert.equal(d.libres, 0);
  }
  assert.equal((await pedir(q + '&dias=500')).cuerpo.dias.length, 31, 'tope de 31 días');
  assert.equal((await pedir(`/api/public/disponibilidad-rango?empresa=${EMPRESA}&profesional=NoExiste&duracion=40`)).status, 404);
});

test('la reserva pública rechaza datos inválidos antes de guardar nada', async () => {
  const prof = (await pedir('/api/public/profesionales?empresa=' + EMPRESA)).cuerpo.profesionales[0];
  const base = { empresa: EMPRESA, profesional: prof.nombre, servicio: prof.servicios[0]?.nombre || 'x', hora: '10:00', pacienteNombre: 'Prueba automática' };
  const casos = [
    [{ ...base, fecha: '2020-01-06', pacienteTelefono: '299 555 1234' }, /pasó/],
    [{ ...base, fecha: '2030-01-07', pacienteTelefono: '123' }, /teléfono/i],
    [{ ...base, fecha: '07/01/2030', pacienteTelefono: '299 555 1234' }, /inválida/],
    [{ ...base, fecha: '2030-01-07', pacienteTelefono: '299 555 1234', servicio: 'Servicio inventado' }, /no está disponible/],
    [{ empresa: EMPRESA }, /Faltan datos/]
  ];
  for (const [body, msg] of casos) {
    const r = await postJson('/api/public/reservar', body);
    assert.ok(r.status >= 400 && r.status < 500, JSON.stringify(body) + ' devolvió ' + r.status);
    assert.match(r.cuerpo.error, msg);
  }
});

test('el webhook de MercadoPago ignora avisos con datos inválidos', async () => {
  const r = await pedir('/api/public/mercadopago/webhook?empresaId=00000000-0000-0000-0000-000000000000&type=payment&data.id=abc', { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.ok, true);
});

test('las páginas públicas cargan', async () => {
  for (const ruta of [`/reservar/${EMPRESA}`, `/prefiltro/${EMPRESA}`, `/portal/${EMPRESA}`, `/cartelera/${EMPRESA}`]) {
    const r = await pedir(ruta);
    assert.equal(r.status, 200, ruta + ' devolvió ' + r.status);
  }
});

function clavePublica() {
  const env = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
  return { url: env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1], anon: env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(\S+)/)[1] };
}

test('con la clave pública no se pueden ejecutar las funciones de usuarios y contraseñas', async () => {
  // Se llama con datos falsos: si la función estuviera abierta respondería 200 (lista vacía);
  // cerrada, la base responde 401/403/404 sin ejecutar nada.
  const { url, anon } = clavePublica();
  const llamadas = {
    verify_login: { p_username: 'prueba-inexistente', p_password: 'x' },
    verify_login_paciente: { p_empresa_slug: 'no-existe', p_usuario: 'x', p_password: 'x' }
  };
  for (const [fn, args] of Object.entries(llamadas)) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    assert.notEqual(res.status, 200, `la función ${fn} se puede ejecutar con la clave pública`);
  }
});

test('con la clave pública no se pueden leer tablas sensibles de la base', async () => {
  const { url, anon } = clavePublica();
  for (const tabla of ['pacientes', 'cobros', 'app_users', 'empresas', 'cuestionario_respuestas', 'mejoras', 'turnos_propios']) {
    const res = await fetch(`${url}/rest/v1/${tabla}?select=*&limit=1`, { headers: { apikey: anon, Authorization: 'Bearer ' + anon } });
    const cuerpo = await res.json().catch(() => null);
    const filtraDatos = res.status === 200 && Array.isArray(cuerpo) && cuerpo.length > 0;
    assert.ok(!filtraDatos, `la tabla ${tabla} devuelve datos con la clave pública`);
  }
});
