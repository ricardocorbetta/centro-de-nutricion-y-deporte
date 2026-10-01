import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

const BUCKET = 'paciente-archivos';

// GET: lista los archivos (planes, bioimpedancia, antropometría) cargados para este paciente.
export async function GET(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('paciente_archivos').select('*')
      .eq('empresa_id', session.empresaId).eq('paciente_id', id)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ archivos: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: sube un archivo nuevo (multipart/form-data). Campos: file, tipo (plan|bioimpedancia|antropometria),
// categoria (ej: "Plan base", "Plan de viaje"...), nombre (etiqueta visible), fecha (opcional, default hoy).
export async function POST(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const form = await request.formData();
    const file = form.get('file');
    const tipo = form.get('tipo');
    const categoria = form.get('categoria') || null;
    const nombre = form.get('nombre') || (file && file.name) || 'Archivo';
    const fecha = form.get('fecha') || new Date().toISOString().slice(0, 10);

    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    if (!['plan', 'bioimpedancia', 'antropometria'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de archivo inválido.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: paciente } = await sb.from('pacientes').select('id').eq('id', id).eq('empresa_id', session.empresaId).single();
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });

    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const path = `${session.empresaId}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || 'application/pdf', upsert: false
    });
    if (upErr) return NextResponse.json({ error: 'No se pudo subir el archivo: ' + upErr.message }, { status: 500 });

    const { data: row, error: dbErr } = await sb.from('paciente_archivos').insert({
      empresa_id: session.empresaId, paciente_id: Number(id), tipo, categoria, nombre, fecha,
      storage_path: path, subido_por: session.name || session.username
    }).select().single();
    if (dbErr) {
      await sb.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, archivo: row });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
