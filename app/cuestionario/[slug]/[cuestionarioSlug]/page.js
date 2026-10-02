'use client';

import CuestionarioPublico from '../../../CuestionarioPublico';

// Link público genérico para cualquier cuestionario armado en el panel (seguimiento,
// satisfacción, anamnesis, etc.) — no hace falta una página nueva por cada uno.
export default function CuestionarioPage({ params }) {
  return <CuestionarioPublico empresaSlug={params.slug} cuestionarioSlug={params.cuestionarioSlug} />;
}
