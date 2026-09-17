import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { DEFAULT_PRECIOS } from '../../../lib/stats';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = supabaseAdmin();

    const [{ data: configRow }, { data: periodRows }, { data: consumerRow }] = await Promise.all([
      sb.from('config').select('*').eq('id', 1).single(),
      sb.from('periods').select('month_key, event_count, uploaded_at, is_manual').order('month_key', { ascending: false }),
      sb.from('consumers').select('*').eq('id', 1).single()
    ]);

    const config = configRow
      ? { consultorios: configRow.consultorios, horasConsultorio: configRow.horas_consultorio, precios: configRow.precios }
      : { consultorios: 2, horasConsultorio: 24, precios: DEFAULT_PRECIOS };

    const latestKey = periodRows && periodRows.length ? periodRows[0].month_key : null;
    let latestEvents = [];
    let latestManualSummary = null;
    if (latestKey) {
      const { data: latest } = await sb.from('periods').select('events, is_manual, manual_summary').eq('month_key', latestKey).single();
      latestEvents = latest?.events || [];
      latestManualSummary = latest?.is_manual ? latest.manual_summary : null;
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
