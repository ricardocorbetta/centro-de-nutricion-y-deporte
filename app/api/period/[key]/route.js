import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { fetchMonthEventsMerged } from '../../../../lib/mergeEvents';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const sb = supabaseAdmin();
    const merged = await fetchMonthEventsMerged(sb, params.key);
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
