import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const sb = supabaseAdmin();
    const { error } = await sb.from('config').update({
      consultorios: body.consultorios,
      horas_consultorio: body.horasConsultorio,
      precios: body.precios,
      updated_at: new Date().toISOString()
    }).eq('id', 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
