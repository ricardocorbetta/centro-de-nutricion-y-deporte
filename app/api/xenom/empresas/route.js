import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminPlataforma } from '../../../../lib/auth';
import { DEFAULT_PRECIOS } from '../../../../lib/stats';

export const dynamic = 'force-dynamic';

function slugify(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca acentos
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// GET: lista todas las empresas (tenants) de la plataforma, con cantidad de usuarios.
export async function GET(request) {
  const { error } = requireAdminPlataforma(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const [{ data: empresas, error: e1 }, { data: usuarios, error: e2 }] = await Promise.all([
      sb.from('empresas').select('*').order('created_at', { ascending: false }),
      sb.from('app_users').select('empresa_id, username, role, name').not('empresa_id', 'is', null)
    ]);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    const result = (empresas || []).map(emp => ({
      ...emp,
      usuarios: (usuarios || []).filter(u => u.empresa_id === emp.id)
    }));
    return NextResponse.json({ empresas: result });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: crea una empresa nueva (tenant) + su primer usuario director, y le siembra config/consumers/comisión default.
// Body: { nombre, nombreCorto?, ciudad?, slug?, directorUsername, directorPassword, directorNombre }
export async function POST(request) {
  const { error } = requireAdminPlataforma(request);
  if (error) return error;
  try {
    const body = await request.json();
    const { nombre, nombreCorto, ciudad, directorUsername, directorPassword, directorNombre } = body;
    if (!nombre || !directorUsername || !directorPassword || !directorNombre) {
      return NextResponse.json({ error: 'Faltan datos (nombre del centro, usuario/contraseña/nombre del director).' }, { status: 400 });
    }
    const slug = slugify(body.slug || nombreCorto || nombre);
    if (!slug) return NextResponse.json({ error: 'No se pudo generar un slug válido para el link de reserva.' }, { status: 400 });

    const sb = supabaseAdmin();

    const { data: empresa, error: empErr } = await sb.from('empresas').insert({
      slug, nombre, nombre_corto: nombreCorto || null, ciudad: ciudad || null
    }).select().single();
    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

    // Seed: config, consumers, comisión por defecto
    await Promise.all([
      sb.from('config').insert({ empresa_id: empresa.id, consultorios: 2, horas_consultorio: 24, precios: DEFAULT_PRECIOS }),
      sb.from('consumers').insert({ empresa_id: empresa.id, data: { weekly: {}, financiadores: {} }, total_count: 0 }),
      sb.from('comisiones_config').insert({ empresa_id: empresa.id, profesional: '__default__', pct_profesional: 60 })
    ]);

    // Primer usuario director
    const { data: userData, error: userErr } = await sb.rpc('crear_app_user', {
      p_username: directorUsername, p_password: directorPassword, p_role: 'director', p_name: directorNombre, p_empresa_id: empresa.id
    });
    if (userErr) return NextResponse.json({ error: 'Empresa creada, pero falló crear el usuario: ' + userErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, empresa, director: userData?.[0] || null });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
