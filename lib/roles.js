// Roles de los usuarios de una clínica y qué puede hacer cada uno. Es la referencia para la pantalla
// Configuración → Usuarios y para revisar permisos; los permisos se hacen cumplir en las API routes
// (requireEmpresaSession = cualquier rol de la clínica, requireDirectorSession = solo dirección).
// El administrador de la plataforma (EULALIA) no pertenece a ninguna clínica: usa el Panel EULALIA.

export const ROLES = {
  director: {
    label: 'Dirección',
    descripcion: 'Acceso completo a la clínica.',
    puede: [
      'Todo lo de Secretaría',
      'Fichas clínicas: historia, mediciones, planes, archivos y cuestionarios',
      'Reportes, objetivos y comisiones',
      'Reabrir cajas cerradas y anular cobros',
      'Configuración: profesionales, horarios, precios, integraciones y usuarios'
    ]
  },
  secretaria: {
    label: 'Secretaría',
    descripcion: 'Agenda de turnos, cobros y caja diaria.',
    puede: [
      'Dar, mover y cancelar turnos, y marcar llegadas y ausencias',
      'Mandar recordatorios por WhatsApp',
      'Buscar y dar de alta pacientes (solo datos de contacto)',
      'Cobrar turnos y registrar cobros sueltos',
      'Ver la caja del día y cerrarla'
    ],
    noPuede: [
      'Ver fichas clínicas ni datos de salud',
      'Ver reportes, comisiones ni cambiar precios',
      'Reabrir una caja cerrada o borrar cobros',
      'Cambiar la configuración o los usuarios'
    ]
  }
};

export const ROLES_VALIDOS = Object.keys(ROLES);

export function etiquetaRol(rol) {
  return ROLES[rol]?.label || rol;
}

// Contraseñas: mínimo razonable para un sistema con datos de salud.
export function validarContrasena(p) {
  const s = String(p || '');
  if (s.length < 10) return 'La contraseña tiene que tener al menos 10 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(s) || !/\d/.test(s)) return 'La contraseña tiene que combinar letras y números.';
  return null;
}

// El usuario para entrar: el mail de la persona o un nombre corto, sin espacios.
export function normalizarUsuario(u) {
  return String(u || '').trim().toLowerCase();
}
export function usuarioValido(u) {
  return /^[a-z0-9._@+-]{3,80}$/.test(u);
}
