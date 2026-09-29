import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('goals').select('*').eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    const byMonth = {};
    (data || []).forEach(g => { byMonth[g.month_key] = g; });
    return NextResponse.json({ goals: byMonth });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const sb = supabaseAdmin();
    const payload = {
      empresa_id: session.empresaId,
      month_key: body.monthKey,
      updated_at: new Date().toISOString()
    };
    if (body.revenueTarget !== undefined) payload.revenue_target = body.revenueTarget;
    if (body.occupancyTarget !== undefined) payload.occupancy_target = body.occupancyTarget;
    if (body.professionalTargets !== undefined) payload.professional_targets = body.professionalTargets;
    if (body.serviceMixTarget !== undefined) payload.service_mix_target = body.serviceMixTarget;
    if (body.newPatientsTarget !== undefined) payload.new_patients_target = body.newPatientsTarget;
    if (body.noshowRateTarget !== undefined) payload.noshow_rate_target = body.noshowRateTarget;

    const { error: dbErr } = await sb.from('goals').upsert(payload, { onConflict: 'empresa_id,month_key' });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
