import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { DEFAULT_PRECIOS } from '../../../lib/stats';
import { fetchMonthEventsMerged } from '../../../lib/mergeEvents';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const empresaId = session.empresaId;

    const [{ data: configRow }, { data: periodRows }, { data: consumerRow }] = await Promise.all([
      sb.from('config').select('*').eq('empresa_id', empresaId).single(),
      sb.from('periods').select('month_key, event_count, uploaded_at, is_manual').eq('empresa_id', empresaId).order('month_key', { ascending: false }),
      sb.from('consumers').select('*').eq('empresa_id', empresaId).single()
    ]);

    const config = configRow
      ? { consultorios: configRow.consultorios, horasConsultorio: configRow.horas_consultorio, precios: configRow.precios }
      : { consultorios: 2, horasConsultorio: 24, precios: DEFAULT_PRECIOS };

    const latestKey = periodRows && periodRows.length ? periodRows[0].month_key : null;
    let latestEvents = [];
    let latestManualSummary = null;
    if (latestKey) {
      const merged = await fetchMonthEventsMerged(sb, empresaId, latestKey);
      latestEvents = merged.events;
      latestManualSummary = merged.manualSummary;
    }

    return NextResponse.json({
      config,
      periods: periodRows || [],
      consumers: consumerRow || { total_count: 0, data: { weekly: {}, financiadores: {} } },
      latestKey,
      latestEvents,
      latestManualSummary
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
