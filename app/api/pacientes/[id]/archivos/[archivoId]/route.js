import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'paciente-archivos';

// DELETE: quita un archivo de la ficha del paciente (y del storage).
export async function DELETE(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id, archivoId } = params;
    const sb = supabaseAdmin();
    const { data: archivo } = await sb.from('paciente_archivos').select('storage_path')
      .eq('id', archivoId).eq('paciente_id', id).eq('empresa_id', session.empresaId).single();
    if (!archivo) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });

    await sb.storage.from(BUCKET).remove([archivo.storage_path]);
    const { error: dbErr } = await sb.from('paciente_archivos').delete()
      .eq('id', archivoId).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
