import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('cobros').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
