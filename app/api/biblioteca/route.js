import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'biblioteca-cnd';

// GET: lista todo el contenido de la biblioteca de la empresa (visión interna, sin filtrar por paciente).
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('contenido_biblioteca')
      .select('*, contenido_biblioteca_pacientes(paciente_id)')
      .eq('empresa_id', session.empresaId)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    const contenido = (data || []).map(c => ({
      ...c, pacientesIds: (c.contenido_biblioteca_pacientes || []).map(p => p.paciente_id), contenido_biblioteca_pacientes: undefined
    }));
    return NextResponse.json({ contenido });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: publica contenido nuevo (multipart/form-data). Campos: profesional, tipo, titulo, descripcion,
// visibilidad (propios|todos_cnd|especificos), pacientesIds (JSON array, solo si visibilidad=especificos),
// fecha, file (opcional: PDF o imagen).
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const form = await request.formData();
    const profesional = form.get('profesional');
    const tipo = form.get('tipo');
    const titulo = form.get('titulo');
    const descripcion = form.get('descripcion') || null;
    const visibilidad = form.get('visibilidad') || 'propios';
    const fecha = form.get('fecha') || new Date().toISOString().slice(0, 10);
    const pacientesIds = JSON.parse(form.get('pacientesIds') || '[]');
    const file = form.get('file');

    if (!profesional || !titulo || !['receta', 'material_educativo', 'pauta_general', 'tip'].includes(tipo)) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    let storagePath = null;
    if (file && typeof file !== 'string') {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      storagePath = `${session.empresaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream' });
      if (upErr) return NextResponse.json({ error: 'No se pudo subir el archivo: ' + upErr.message }, { status: 500 });
    }

    const { data: row, error: dbErr } = await sb.from('contenido_biblioteca').insert({
      empresa_id: session.empresaId, profesional, tipo, titulo, descripcion, visibilidad, fecha, storage_path: storagePath
    }).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    if (visibilidad === 'especificos' && pacientesIds.length) {
      await sb.from('contenido_biblioteca_pacientes').insert(
        pacientesIds.map(pid => ({ contenido_id: row.id, paciente_id: pid }))
      );
    }

    return NextResponse.json({ ok: true, contenido: row });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
