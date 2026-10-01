import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET ?q=<búsqueda> — busca pacientes por nombre o teléfono (para el buscador/autocompletar y el listado).
// Sin q, devuelve los últimos pacientes cargados.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const sb = supabaseAdmin();
    let query = sb.from('pacientes').select('*').eq('empresa_id', session.empresaId);
    if (q) {
      query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`);
    }
    query = query.order('created_at', { ascending: false }).limit(50);
    const { data, error: dbErr } = await query;
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ pacientes: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: crea un paciente nuevo. Body: { nombre, telefono?, email?, dni?, fechaNacimiento?, financiador?, notas? }
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const { nombre, telefono, email, dni, fechaNacimiento, financiador, notas } = body;
    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'Falta el nombre del paciente.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('pacientes').insert({
      empresa_id: session.empresaId,
      nombre: nombre.trim(),
      telefono: telefono || null,
      email: email || null,
      dni: dni || null,
      fecha_nacimiento: fechaNacimiento || null,
      financiador: financiador || null,
      notas: notas || null
    }).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, paciente: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
