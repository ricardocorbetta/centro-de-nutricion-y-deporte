import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function requireDirector(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return { error };
  if (session.role !== 'director') return { error: NextResponse.json({ error: 'Solo la dirección puede editar esto.' }, { status: 403 }) };
  return { session };
}

// GET: listado completo (incluye inactivos) con servicios y horarios anidados — solo director, de su empresa.
export async function GET(request) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const empresaId = session.empresaId;
    const [{ data: profs, error: e1 }, { data: servicios, error: e2 }, { data: horarios, error: e3 }] = await Promise.all([
      sb.from('profesionales_config').select('*').eq('empresa_id', empresaId).order('nombre'),
      sb.from('servicios_config').select('*').eq('empresa_id', empresaId).order('nombre'),
      sb.from('profesional_horarios').select('*').eq('empresa_id', empresaId).order('dia_semana').order('fecha')
    ]);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

    const result = (profs || []).map(p => ({
      nombre: p.nombre,
      activo: p.activo,
      servicios: (servicios || []).filter(s => s.profesional === p.nombre),
      horarios: (horarios || []).filter(h => h.profesional === p.nombre && h.dia_semana !== null),
      excepciones: (horarios || []).filter(h => h.profesional === p.nombre && h.fecha !== null)
    }));
    return NextResponse.json({ profesionales: result });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: crea un profesional nuevo, dentro de la empresa de la sesión. Body: { nombre }
export async function POST(request) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const { nombre } = await request.json();
    if (!nombre || !nombre.trim()) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('profesionales_config').insert({
      empresa_id: session.empresaId,
      nombre: nombre.trim(), dias_semana: [], hora_inicio: '09:00', hora_fin: '18:00', activo: true
    }).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, profesional: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
