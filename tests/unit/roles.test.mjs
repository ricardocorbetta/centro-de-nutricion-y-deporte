// Pruebas de lib/roles.js y lib/pacientesColumnas.js: roles, contraseñas, usuarios y qué datos de
// pacientes ve cada rol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLES_VALIDOS, etiquetaRol, validarContrasena, normalizarUsuario, usuarioValido } from '../../lib/roles.js';
import { columnasPacientePara } from '../../lib/pacientesColumnas.js';

test('hay exactamente dos roles de clínica: dirección y secretaría', () => {
  assert.deepEqual(ROLES_VALIDOS.sort(), ['director', 'secretaria']);
  assert.equal(etiquetaRol('secretaria'), 'Secretaría');
  assert.ok(ROLES.secretaria.puede.some(p => /turnos/i.test(p)));
  assert.ok(ROLES.secretaria.puede.some(p => /cobr/i.test(p)));
  assert.ok(ROLES.secretaria.puede.some(p => /caja/i.test(p)));
});

test('las contraseñas débiles se rechazan', () => {
  assert.ok(validarContrasena('corta1'));
  assert.ok(validarContrasena('sololetrasmuchas'));
  assert.ok(validarContrasena('1234567890123'));
  assert.equal(validarContrasena('Valentina2026x'), null);
});

test('el usuario puede ser un mail y se guarda en minúsculas', () => {
  const u = normalizarUsuario('  Admi@CentroNutricionDeporte.com ');
  assert.equal(u, 'admi@centronutriciondeporte.com');
  assert.ok(usuarioValido(u));
  assert.ok(!usuarioValido('con espacios'));
  assert.ok(!usuarioValido('ab'));
});

test('la secretaría no recibe notas clínicas y nadie recibe el hash del portal', () => {
  const sec = columnasPacientePara({ role: 'secretaria' });
  const dir = columnasPacientePara({ role: 'director' });
  assert.doesNotMatch(sec, /notas/);
  assert.match(dir, /notas/);
  assert.doesNotMatch(sec + dir, /password/);
});
