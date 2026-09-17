import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('goals').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const byMonth = {};
    (data || []).forEach(g => { byMonth[g.month_key] = g; });
    return NextResponse.json({ goals: byMonth });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json(); // { monthKey, revenueTarget, occupancyTarget }
    const sb = supabaseAdmin();
    const { error } = await sb.from('goals').upsert({
      month_key: body.monthKey,
      revenue_target: body.revenueTarget,
      occupancy_target: body.occupancyTarget,
      updated_at: new Date().toISOString()
    }, { onConflict: 'month_key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
