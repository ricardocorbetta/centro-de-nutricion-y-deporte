import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { resolverEmpresaPorSlug } from '../../../../../lib/empresas';

export const dynamic = 'force-dynamic';

// Guarda una respuesta a un cuestionario público. Si el cuestionario está marcado como
// "vincula_paciente", busca (por teléfono o email) o crea la ficha del paciente a partir de
// los campos de tipo nombre_paciente / email / telefono — igual que hacía antes la entrevista
// de prefiltro hardcodeada.
export async function POST(request) {
  try {
    const body = await request.json();
    const { empresa: empresaSlug, cuestionario: cuestionarioSlug, respuestas } = body;
    if (!empresaSlug || !cuestionarioSlug || !respuestas) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });

    const { data: cuestionario } = await sb.from('cuestionarios').select('*')
      .eq('empresa_id', empresa.id).eq('slug', cuestionarioSlug).eq('activo', true).maybeSingle();
    if (!cuestionario) return NextResponse.json({ error: 'No encontramos este cuestionario.' }, { status: 404 });

    const campos = cuestionario.campos || [];
    for (const c of campos) {
      if (c.requerido && !String(respuestas[c.id] ?? '').trim()) {
        return NextResponse.json({ error: `Falta completar "${c.etiqueta}".` }, { status: 400 });
      }
    }

    let pacienteId = null;
    if (cuestionario.vincula_paciente) {
      const campoNombre = campos.find(c => c.tipo === 'nombre_paciente');
      const campoEmail = campos.find(c => c.tipo === 'email');
      const campoTelefono = campos.find(c => c.tipo === 'telefono');
      const nombre = campoNombre ? respuestas[campoNombre.id] : null;
      const email = campoEmail ? respuestas[campoEmail.id] : null;
      const telefono = campoTelefono ? respuestas[campoTelefono.id] : null;

      try {
        let existente = null;
        if (telefono) {
          ({ data: existente } = await sb.from('pacientes').select('id').eq('empresa_id', empresa.id).eq('telefono', telefono).limit(1).maybeSingle());
        }
        if (!existente && email) {
          ({ data: existente } = await sb.from('pacientes').select('id').eq('empresa_id', empresa.id).eq('email', email).limit(1).maybeSingle());
        }
        if (existente) {
          pacienteId = existente.id;
        } else if (nombre) {
          const campoNacimiento = campos.find(c => /nacimiento/i.test(c.id));
          const { data: nuevo } = await sb.from('pacientes').insert({
            empresa_id: empresa.id, nombre, telefono: telefono || null, email: email || null,
            fecha_nacimiento: campoNacimiento ? (respuestas[campoNacimiento.id] || null) : null
          }).select('id').single();
          if (nuevo) pacienteId = nuevo.id;
        }
      } catch (e) { /* no bloquea el guardado de la respuesta */ }
    }

    const { error: dbErr } = await sb.from('cuestionario_respuestas').insert({
      empresa_id: empresa.id, cuestionario_id: cuestionario.id, paciente_id: pacienteId, respuestas
    });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
