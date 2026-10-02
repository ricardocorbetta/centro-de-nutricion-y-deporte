import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET: historial de mediciones (peso/medidas) de un paciente, más antiguo primero (para graficar).
export async function GET(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('mediciones_pacientes').select('*')
      .eq('paciente_id', id).eq('empresa_id', session.empresaId)
      .order('fecha', { ascending: true }).order('id', { ascending: true });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ mediciones: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: carga una nueva medición (control de peso/antropometría) para el paciente.
export async function POST(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const row = {
      empresa_id: session.empresaId,
      paciente_id: Number(id),
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      peso: num(body.peso),
      altura: num(body.altura),
      perimetro_cintura: num(body.perimetroCintura),
      perimetro_cadera: num(body.perimetroCadera),
      pct_grasa: num(body.pctGrasa),
      pct_musculo: num(body.pctMusculo),
      notas: body.notas || null,
      registrado_por: session.name || session.username || null
    };
    if (row.peso === null && row.altura === null && row.perimetro_cintura === null &&
        row.perimetro_cadera === null && row.pct_grasa === null && row.pct_musculo === null) {
      return NextResponse.json({ error: 'Cargá al menos un dato (peso, altura o alguna medida).' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data: paciente } = await sb.from('pacientes').select('id').eq('id', id).eq('empresa_id', session.empresaId).single();
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    const { data, error: dbErr } = await sb.from('mediciones_pacientes').insert(row).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, medicion: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
