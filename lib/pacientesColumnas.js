// Columnas de "pacientes" que pueden llegar al navegador. Nunca incluir portal_password_hash.
// Dirección ve la ficha; secretaría solo los datos de contacto que necesita para dar turnos y cobrar.
export const COLUMNAS_PACIENTE_CONTACTO = 'id, nombre, telefono, email, dni, fecha_nacimiento, financiador, created_at';
export const COLUMNAS_PACIENTE_FICHA = COLUMNAS_PACIENTE_CONTACTO + ', notas, portal_username, portal_generado_en';

export function columnasPacientePara(session) {
  return session?.role === 'director' ? COLUMNAS_PACIENTE_FICHA : COLUMNAS_PACIENTE_CONTACTO;
}
