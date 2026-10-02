'use client';

import CuestionarioPublico from '../../CuestionarioPublico';

// La entrevista de prefiltro es, desde adentro, el primer cuestionario del apartado de
// Cuestionarios (ver panel > Cuestionarios). Esta URL se mantiene igual porque ya se comparte
// con pacientes por WhatsApp — por dentro ahora renderiza el cuestionario "prefiltro" configurable.
export default function PrefiltroPage({ params }) {
  return <CuestionarioPublico empresaSlug={params.slug} cuestionarioSlug="prefiltro" />;
}
