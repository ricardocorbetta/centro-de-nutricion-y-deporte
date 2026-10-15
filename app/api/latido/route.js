import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Latido: consulta mínima a la base para que Supabase registre actividad todos los días.
// En el plan gratis, un proyecto sin actividad por 7 días se pausa y la app deja de andar.
// - Vercel Cron la llama una vez por día (ver vercel.json).
// - Un monitor externo (UptimeRobot o similar) puede llamarla para avisar si la base está caída.
// Es pública a propósito: no recibe parámetros ni devuelve datos, solo "ok" (200) o "caída" (503).
export async function GET() {
  const inicio = Date.now();
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('empresas').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, ms: Date.now() - inicio }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('latido: la base no respondió', err);
    return NextResponse.json({ ok: false, error: 'La base de datos no responde.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
