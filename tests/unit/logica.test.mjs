// Pruebas de la lógica pura de lib/: teléfonos, fechas, turnos, precios y meses.
// Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelAR, telWhatsApp, mismoTelefono } from '../../lib/telefono.js';
import { hoyAR, horaAR, fechaARDe, esFechaISO, esHoraHHMM } from '../../lib/fechas.js';
import { generateSlots, overlapsAny, timeToMinutes } from '../../lib/scheduling.js';
import { priceFor, DEFAULT_PRECIOS, monthKeyFromEvents } from '../../lib/stats.js';
import { inicioMesSiguiente } from '../../lib/mergeEvents.js';

test('normalizarTelAR reconoce las formas habituales de escribir un celular argentino', () => {
  for (const t of ['0299 15 555-1234', '+54 9 299 555 1234', '2995551234', '299-155551234', '+5492995551234', '00 54 9 299 555 1234']) {
    assert.equal(normalizarTelAR(t), '2995551234', t);
  }
  assert.equal(normalizarTelAR('011 15 4444-5555'), '1144445555');
  assert.equal(normalizarTelAR('0294 15 444 5555'), '2944445555');
});

test('normalizarTelAR rechaza números incompletos o vacíos', () => {
  for (const t of ['', null, undefined, '15 555 1234', '1234', 'abc']) assert.equal(normalizarTelAR(t), null, String(t));
});

test('telWhatsApp arma el número con 549 y mismoTelefono compara normalizado', () => {
  assert.equal(telWhatsApp('0299 15 555-1234'), '5492995551234');
  assert.ok(mismoTelefono('0299 15 555-1234', '+54 9 299 555 1234'));
  assert.ok(!mismoTelefono('2995551234', '2995551235'));
  assert.ok(!mismoTelefono('', ''));
});

test('hoyAR y horaAR devuelven formatos válidos en hora argentina', () => {
  assert.match(hoyAR(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(horaAR(), /^([01]\d|2[0-3]):[0-5]\d$/);
});

test('fechaARDe pasa un instante UTC al día argentino (UTC-3)', () => {
  // 01:30 UTC del 16 = 22:30 del 15 en Argentina: el cobro va a la caja del 15.
  assert.equal(fechaARDe('2026-10-16T01:30:00Z'), '2026-10-15');
  assert.equal(fechaARDe('2026-10-16T03:30:00Z'), '2026-10-16');
  assert.equal(fechaARDe('2026-10-15T22:00:00.000-03:00'), '2026-10-15');
});

test('esFechaISO y esHoraHHMM validan entradas del público', () => {
  assert.ok(esFechaISO('2026-10-15'));
  assert.ok(!esFechaISO('15/10/2026'));
  assert.ok(!esFechaISO('2026-13-01'));
  assert.ok(esHoraHHMM('09:40'));
  assert.ok(!esHoraHHMM('9:40'));
  assert.ok(!esHoraHHMM('24:00'));
});

test('generateSlots arma turnos consecutivos que entran completos en el horario', () => {
  assert.deepEqual(generateSlots('09:00', '11:00', 40), ['09:00', '09:40', '10:20']);
  assert.deepEqual(generateSlots('09:00:00', '10:00:00', 60), ['09:00']);
  assert.deepEqual(generateSlots('09:00', '09:30', 40), []);
});

test('overlapsAny detecta superposición y permite turnos pegados', () => {
  const existentes = [{ time: '10:00', duration: 40 }];
  assert.ok(overlapsAny(existentes, '10:20', 40));
  assert.ok(overlapsAny(existentes, '09:30', 40));
  assert.ok(!overlapsAny(existentes, '10:40', 40));
  assert.ok(!overlapsAny(existentes, '09:20', 40));
  assert.equal(timeToMinutes('10:40'), 640);
});

test('priceFor usa la lista de precios y prorratea duraciones sin precio', () => {
  assert.equal(priceFor(40, DEFAULT_PRECIOS), 60000);
  assert.equal(priceFor(60, DEFAULT_PRECIOS), 80000);
  assert.equal(priceFor(90, DEFAULT_PRECIOS), 135000);
  assert.equal(priceFor(40, { 40: 70000 }), 70000);
});

test('inicioMesSiguiente no inventa días que no existen (bug de "31 de septiembre")', () => {
  assert.equal(inicioMesSiguiente('2026-09'), '2026-10-01');
  assert.equal(inicioMesSiguiente('2026-02'), '2026-03-01');
  assert.equal(inicioMesSiguiente('2026-12'), '2027-01-01');
});

test('monthKeyFromEvents toma el mes de los turnos cargados', () => {
  const eventos = [{ day: '2026-09-03' }, { day: '2026-09-20' }, { day: '2026-09-28' }];
  assert.equal(monthKeyFromEvents(eventos), '2026-09');
});
