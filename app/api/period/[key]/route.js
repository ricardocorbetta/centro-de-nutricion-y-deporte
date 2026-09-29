import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { fetchMonthEventsMerged } from '../../../../lib/mergeEvents';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const merged = await fetchMonthEventsMerged(sb, session.empresaId, params.key);
    if (!merged.found) return NextResponse.json({ error: 'Período no encontrado.' }, { status: 404 });
    return NextResponse.json({
      events: merged.events,
      isManual: merged.isManual,
      manualSummary: merged.manualSummary
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
