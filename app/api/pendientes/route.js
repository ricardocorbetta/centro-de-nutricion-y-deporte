import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';
import { hoyAR } from '../../../lib/fechas';

export const dynamic = 'force-dynamic';

const ABIERTOS = ['booked', 'esperando', 'en_consulta'];

function sumarDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function ddmm(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function fmtPesos(n) { return '$' + Math.round(n || 0).toLocaleString('es-AR'); }

// GET: "Mis pendientes" de la clínica, armados desde varias tablas en una lista uniforme
// { id, tipo, titulo, detalle, fecha (YYYY-MM-DD, vencimiento), seccion, accion }.
// El cliente los agrupa en Vencido / Hoy / Próximos 7 días / Más adelante. La secretaria solo ve
// los que puede resolver desde su pantalla (agenda y caja).
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const emp = session.empresaId;
    const hoy = hoyAR();
    const manana = sumarDias(hoy, 1);
    const hace60 = sumarDias(hoy, -60);
    const hace14 = sumarDias(hoy, -14);
    const esDirector = session.role === 'director';

    const [turnosR, cobrosR, cierresR, respuestasR, mejorasR] = await Promise.all([
      sb.from('turnos_propios')
        .select('id, day, time, resource, service, status, paciente_nombre, precio_total, mp_payment_status, recordatorio_enviado_at')
        .eq('empresa_id', emp).gte('day', hace60).lte('day', sumarDias(hoy, 30)),
      sb.from('cobros').select('fecha, monto, turno_id').eq('empresa_id', emp).gte('fecha', hace60),
      sb.from('cierres_caja').select('fecha').eq('empresa_id', emp).gte('fecha', hace14),
      esDirector
        ? sb.from('cuestionario_respuestas').select('created_at').eq('empresa_id', emp).is('revisado_at', null)
        : Promise.resolve({ data: [] }),
      esDirector
        ? sb.from('mejoras').select('id, titulo, cerrado_en').eq('empresa_id', emp).eq('estado', 'hecho').is('confirmacion', null)
        : Promise.resolve({ data: [] })
    ]);
    for (const r of [turnosR, cobrosR, cierresR, respuestasR, mejorasR]) if (r.error) throw r.error;

    const turnos = turnosR.data || [];
    const cobros = cobrosR.data || [];
    const items = [];

    // 1. Turnos que ya pasaron y siguen sin cerrar (no se marcó si vino, faltó o se canceló).
    turnos.filter(t => t.day < hoy && ABIERTOS.includes(t.status)).forEach(t => items.push({
      id: 'sin-cerrar-' + t.id, tipo: 'turno', fecha: t.day, seccion: 'agenda',
      titulo: `Marcar si vino ${t.paciente_nombre || 'el paciente'}`,
      detalle: `Turno del ${ddmm(t.day)} a las ${t.time} con ${t.resource}`,
      accion: 'Ir a la agenda'
    }));

    // 2. Atendidos con saldo sin cobrar.
    const cobradoPorTurno = {};
    cobros.forEach(c => { if (c.turno_id) cobradoPorTurno[c.turno_id] = (cobradoPorTurno[c.turno_id] || 0) + Number(c.monto || 0); });
    turnos.filter(t => t.status === 'cumplido' && Number(t.precio_total) > 0).forEach(t => {
      const saldo = Number(t.precio_total) - (cobradoPorTurno[t.id] || 0);
      if (saldo > 0) items.push({
        id: 'saldo-' + t.id, tipo: 'cobro', fecha: t.day, seccion: 'agenda',
        titulo: `Cobrar ${fmtPesos(saldo)} a ${t.paciente_nombre || 'un paciente'}`,
        detalle: `Atendido el ${ddmm(t.day)} · ${t.service || ''}`.trim(),
        accion: 'Cobrar desde la agenda'
      });
    });

    // 3. Señas de MercadoPago sin pagar en turnos que todavía no pasaron.
    turnos.filter(t => t.mp_payment_status === 'pendiente' && t.day >= hoy && ABIERTOS.includes(t.status)).forEach(t => items.push({
      id: 'senia-' + t.id, tipo: 'cobro', fecha: t.day, seccion: 'agenda',
      titulo: `Seña sin pagar: ${t.paciente_nombre || 'paciente'}`,
      detalle: `Turno del ${ddmm(t.day)} a las ${t.time}. Si no paga, el horario sigue bloqueado.`,
      accion: 'Ver el turno'
    }));

    // 4. Recordatorios de los turnos de mañana sin mandar (vencen hoy).
    const sinRecordar = turnos.filter(t => t.day === manana && t.status === 'booked' && !t.recordatorio_enviado_at);
    if (sinRecordar.length && esDirector) items.push({
      id: 'recordatorios-' + manana, tipo: 'recordatorio', fecha: hoy, seccion: 'recordatorios',
      titulo: `Mandar ${sinRecordar.length} ${sinRecordar.length === 1 ? 'recordatorio' : 'recordatorios'} para mañana`,
      detalle: sinRecordar.slice(0, 3).map(t => `${t.time} ${t.paciente_nombre || ''}`.trim()).join(' · ') + (sinRecordar.length > 3 ? ' …' : ''),
      accion: 'Ir a recordatorios'
    });

    // 5. Días con cobros y la caja sin cerrar (últimos 14 días, incluido hoy).
    const cerrados = new Set((cierresR.data || []).map(c => c.fecha));
    const diasConCobros = [...new Set(cobros.map(c => c.fecha).filter(f => f >= hace14 && f <= hoy))];
    diasConCobros.filter(f => !cerrados.has(f)).sort().forEach(f => items.push({
      id: 'caja-' + f, tipo: 'caja', fecha: f, seccion: 'caja',
      titulo: f === hoy ? 'Cerrar la caja de hoy' : `Cerrar la caja del ${ddmm(f)}`,
      detalle: 'Hubo cobros ese día y la caja no se cerró.',
      accion: 'Ir a la caja'
    }));

    // 6. Respuestas de cuestionarios sin revisar (una sola tarjeta).
    const resp = respuestasR.data || [];
    if (resp.length) {
      const masVieja = resp.map(r => r.created_at).sort()[0];
      items.push({
        id: 'cuestionarios', tipo: 'cuestionario', fecha: masVieja.slice(0, 10) < hoy ? masVieja.slice(0, 10) : hoy,
        seccion: 'pacientes',
        titulo: `${resp.length} ${resp.length === 1 ? 'respuesta de cuestionario' : 'respuestas de cuestionarios'} sin revisar`,
        detalle: 'Entrevistas de prefiltro y otros formularios que mandaron los pacientes.',
        accion: 'Ir a pacientes'
      });
    }

    // 7. Sugerencias marcadas "Hecho" por EULALIA que esperan confirmación.
    (mejorasR.data || []).forEach(m => items.push({
      id: 'mejora-' + m.id, tipo: 'sugerencia', fecha: hoy, seccion: 'sugerencias',
      titulo: `Confirmá si quedó resuelto: ${m.titulo}`,
      detalle: 'El equipo de EULALIA lo marcó como hecho.',
      accion: 'Abrir Sugerencias'
    }));

    const visibles = esDirector ? items : items.filter(i => i.seccion === 'agenda' || i.seccion === 'caja');
    visibles.sort((a, b) => a.fecha.localeCompare(b.fecha));

    const turnosHoy = turnos.filter(t => t.day === hoy && t.status !== 'cancelled').length;
    const cobradoHoy = cobros.filter(c => c.fecha === hoy).reduce((s, c) => s + Number(c.monto || 0), 0);

    return NextResponse.json({ hoy, items: visibles, resumen: { turnosHoy, cobradoHoy } });
  } catch (err) {
    console.error('GET /api/pendientes', err);
    return NextResponse.json({ error: 'No se pudieron cargar los pendientes.' }, { status: 500 });
  }
}
