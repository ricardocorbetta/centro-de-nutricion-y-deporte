import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';

export const dynamic = 'force-dynamic';

// Entrevista de prefiltro para pacientes nuevos, previa a la primera consulta.
// Pública (sin login) — se comparte por WhatsApp junto con (o en vez de) el link de reserva.
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      empresa: empresaSlug, fechaPrimeraConsulta, nombre, fechaNacimiento, edad,
      email, whatsapp, comoConocio, deporte, gimnasio, motivoConsulta
    } = body;
    if (!empresaSlug || !nombre) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (nombre).' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });
    const empresaId = empresa.id;

    // Busca o crea la ficha del paciente (por email o whatsapp), igual que en la reserva pública.
    // Mejor esfuerzo: si falla, la entrevista igual se guarda sin ficha vinculada.
    let pacienteId = null;
    try {
      let existente = null;
      if (whatsapp) {
        ({ data: existente } = await sb.from('pacientes').select('id').eq('empresa_id', empresaId).eq('telefono', whatsapp).limit(1).maybeSingle());
      }
      if (!existente && email) {
        ({ data: existente } = await sb.from('pacientes').select('id').eq('empresa_id', empresaId).eq('email', email).limit(1).maybeSingle());
      }
      if (existente) {
        pacienteId = existente.id;
      } else {
        const { data: nuevo } = await sb.from('pacientes').insert({
          empresa_id: empresaId, nombre, telefono: whatsapp || null, email: email || null, fecha_nacimiento: fechaNacimiento || null
        }).select('id').single();
        if (nuevo) pacienteId = nuevo.id;
      }
    } catch (e) { /* no bloquea el guardado de la entrevista */ }

    const { error } = await sb.from('entrevistas_prefiltro').insert({
      empresa_id: empresaId,
      paciente_id: pacienteId,
      fecha_primera_consulta: fechaPrimeraConsulta || null,
      nombre, fecha_nacimiento: fechaNacimiento || null, edad: edad ? parseInt(edad, 10) : null,
      email: email || null, whatsapp: whatsapp || null,
      como_conocio: comoConocio || null, deporte: deporte || null, gimnasio: gimnasio || null,
      motivo_consulta: motivoConsulta || null
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
