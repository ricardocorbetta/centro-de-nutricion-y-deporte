import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { monthKeyFromEvents, aggregateConsumersWeekly } from '../../../lib/stats';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    // body puede traer:
    //  - { events: [...], consumers?: [...] }              -> carga normal desde CSV
    //  - { manual: true, monthKey, manualSummary }          -> carga manual (mes viejo sin CSV)
    const sb = supabaseAdmin();

    if (body.manual) {
      const monthKey = body.monthKey;
      if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
        return NextResponse.json({ error: 'Período inválido (formato esperado AAAA-MM).' }, { status: 400 });
      }
      const summary = { ...body.manualSummary, monthKey };
      const { error } = await sb.from('periods').upsert({
        month_key: monthKey,
        events: [],
        event_count: summary.booked || 0,
        is_manual: true,
        manual_summary: summary,
        uploaded_at: new Date().toISOString()
      }, { onConflict: 'month_key' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, monthKey, manual: true });
    }

    const events = body.events || [];
    const consumers = body.consumers || null;

    const monthKey = monthKeyFromEvents(events);
    if (!monthKey) {
      return NextResponse.json({ error: 'No se pudo determinar el período (mes) a partir de los turnos.' }, { status: 400 });
    }

    const { error: periodErr } = await sb.from('periods').upsert({
      month_key: monthKey,
      events,
      event_count: events.length,
      is_manual: false,
      manual_summary: null,
      uploaded_at: new Date().toISOString()
    }, { onConflict: 'month_key' });

    if (periodErr) return NextResponse.json({ error: periodErr.message }, { status: 500 });

    if (consumers && consumers.length) {
      const agg = aggregateConsumersWeekly(consumers);
      const { error: consErr } = await sb.from('consumers').update({
        data: { weekly: agg.weekly, financiadores: agg.financiadores },
        total_count: agg.total_count,
        updated_at: new Date().toISOString()
      }).eq('id', 1);
      if (consErr) return NextResponse.json({ error: consErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, monthKey, eventCount: events.length });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
