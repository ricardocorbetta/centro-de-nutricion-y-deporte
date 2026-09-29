// Resuelve una empresa activa a partir de su slug público (usado en /reservar/[slug] y sus API routes).
// Devuelve la fila de empresas o null si no existe / está inactiva.
export async function resolverEmpresaPorSlug(sb, slug) {
  if (!slug) return null;
  const { data } = await sb.from('empresas').select('*').eq('slug', slug).eq('activo', true).single();
  return data || null;
}
