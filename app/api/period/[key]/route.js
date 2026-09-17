import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('periods').select('events, is_manual, manual_summary').eq('month_key', params.key).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({
      events: data?.events || [],
      isManual: !!data?.is_manual,
      manualSummary: data?.is_manual ? data.manual_summary : null
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
