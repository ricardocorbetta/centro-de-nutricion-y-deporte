// Pruebas de lib/disponibilidad.js: texto de horarios de atención y turnos libres por día.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenHorarios, horarioDelDia, libresDelDia, sumarDias, fechaCorta } from '../../lib/disponibilidad.js';

test('resumenHorarios agrupa los días con el mismo horario, con el lunes primero', () => {
  const horarios = [
    { diaSemana: 5, horaInicio: '09:00:00', horaFin: '13:00:00' },
    { diaSemana: 1, horaInicio: '09:00:00', horaFin: '13:00:00' },
    { diaSemana: 3, horaInicio: '09:00:00', horaFin: '13:00:00' },
    { diaSemana: 4, horaInicio: '15:30:00', horaFin: '19:00:00' }
  ];
  assert.equal(resumenHorarios(horarios), 'Lun, Mié y Vie de 9 a 13 h · Jue de 15:30 a 19 h');
  assert.equal(resumenHorarios([{ diaSemana: 6, horaInicio: '10:00', horaFin: '12:00' }]), 'Sáb de 10 a 12 h');
  assert.equal(resumenHorarios([]), '');
  assert.equal(resumenHorarios(undefined), '');
});

test('horarioDelDia usa el horario semanal y la excepción de una fecha manda', () => {
  const recurrentes = [{ dia_semana: 4, hora_inicio: '09:00:00', hora_fin: '13:00:00', activo: true }];
  // 2026-10-15 es jueves
  assert.deepEqual(horarioDelDia('2026-10-15', recurrentes, []), { atiende: true, horaInicio: '09:00:00', horaFin: '13:00:00' });
  assert.equal(horarioDelDia('2026-10-16', recurrentes, []).atiende, false, 'viernes no atiende');
  const libre = [{ fecha: '2026-10-15', activo: false }];
  assert.equal(horarioDelDia('2026-10-15', recurrentes, libre).atiende, false, 'día bloqueado por excepción');
  const extra = [{ fecha: '2026-10-17', activo: true, hora_inicio: '10:00:00', hora_fin: '12:00:00' }];
  assert.equal(horarioDelDia('2026-10-17', recurrentes, extra).horaInicio, '10:00:00', 'sábado especial');
  assert.equal(horarioDelDia('2026-10-22', [{ ...recurrentes[0], activo: false }], []).atiende, false, 'horario desactivado');
});

test('libresDelDia descuenta turnos ocupados y horarios que ya pasaron', () => {
  const horario = { atiende: true, horaInicio: '09:00:00', horaFin: '11:00:00' };
  assert.deepEqual(libresDelDia(horario, [], 40), ['09:00', '09:40', '10:20']);
  assert.deepEqual(libresDelDia(horario, [{ time: '09:40', duration: 40 }], 40), ['09:00', '10:20']);
  assert.deepEqual(libresDelDia(horario, [], 40, '09:30'), ['09:40', '10:20']);
  assert.deepEqual(libresDelDia({ atiende: false }, [], 40), []);
});

test('sumarDias y fechaCorta manejan cambios de mes y año', () => {
  assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(fechaCorta('2026-10-15'), 'jue 15/10');
});
