// Caja de feedback ("Mejoras"): constantes y helpers compartidos entre las rutas de la clínica
// (/api/mejoras) y las del Panel EULALIA (/api/xenom/mejoras). Las tablas están en
// supabase/migrations/20261015_02_mejoras.sql.

export const BUCKET_MEJORAS = 'mejoras';

export const TIPOS_MEJORA = {
  error: 'Algo no funciona',
  mejora: 'Mejora',
  idea: 'Idea',
  consulta: 'Consulta'
};

export const ESTADOS_MEJORA = {
  nuevo: 'Nuevo',
  en_analisis: 'En análisis',
  planificado: 'Planificado',
  en_curso: 'En curso',
  hecho: 'Hecho',
  descartado: 'Descartado'
};

export const PRIORIDADES_MEJORA = { baja: 'Baja', media: 'Media', alta: 'Alta' };

export const MAX_ADJUNTOS = 3;
export const MAX_BYTES_ADJUNTO = 8 * 1024 * 1024;
const MIME_PERMITIDOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Valida y sube las capturas de un formulario. Devuelve { paths } o { error }.
export async function subirCapturas(sb, empresaId, files) {
  const validos = files.filter(f => f && typeof f !== 'string' && f.size > 0);
  if (validos.length > MAX_ADJUNTOS) return { error: `Podés adjuntar hasta ${MAX_ADJUNTOS} capturas.` };
  const paths = [];
  for (const f of validos) {
    const ext = MIME_PERMITIDOS[f.type];
    if (!ext) return { error: 'Las capturas tienen que ser imágenes PNG, JPG o WEBP.', paths };
    if (f.size > MAX_BYTES_ADJUNTO) return { error: 'Cada captura puede pesar hasta 8 MB.', paths };
    const path = `${empresaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(BUCKET_MEJORAS).upload(path, Buffer.from(await f.arrayBuffer()), {
      contentType: f.type, upsert: false
    });
    if (error) return { error: 'No se pudo subir una captura.', paths };
    paths.push(path);
  }
  return { paths };
}

// Agrega a cada pedido sus comentarios (filtrando los internos si no es la plataforma) y links
// temporales (1 hora) para ver las capturas.
export async function completarMejoras(sb, mejoras, { incluirInternos }) {
  if (!mejoras.length) return [];
  const ids = mejoras.map(m => m.id);
  let q = sb.from('mejoras_comentarios').select('*').in('mejora_id', ids).order('created_at', { ascending: true });
  if (!incluirInternos) q = q.eq('interno', false);
  const { data: comentarios } = await q;

  const todosLosPaths = mejoras.flatMap(m => m.adjuntos || []);
  const urls = {};
  if (todosLosPaths.length) {
    const { data: firmadas } = await sb.storage.from(BUCKET_MEJORAS).createSignedUrls(todosLosPaths, 3600);
    (firmadas || []).forEach(f => { if (f.signedUrl) urls[f.path] = f.signedUrl; });
  }

  return mejoras.map(m => ({
    ...m,
    adjuntosUrls: (m.adjuntos || []).map(p => urls[p]).filter(Boolean),
    comentarios: (comentarios || []).filter(c => c.mejora_id === m.id)
  }));
}
