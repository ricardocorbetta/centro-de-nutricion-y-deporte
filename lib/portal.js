// Reglas del portal de pacientes (Sector A). Ver condiciones generales acordadas:
// a los 18 meses de la última consulta, el paciente deja de tener acceso a sus archivos.
export const VIGENCIA_MESES = 18;

// A partir de la fecha (ISO, "YYYY-MM-DD") de la última consulta completada, dice si el
// acceso al portal sigue vigente (dentro de los VIGENCIA_MESES) y hasta cuándo.
export function calcularVigencia(ultimaConsultaISO) {
  if (!ultimaConsultaISO) return { vigente: false, venceEl: null };
  const ultima = new Date(ultimaConsultaISO + 'T00:00:00');
  const vence = new Date(ultima);
  vence.setMonth(vence.getMonth() + VIGENCIA_MESES);
  const hoy = new Date();
  return { vigente: hoy <= vence, venceEl: vence.toISOString().slice(0, 10) };
}

// Busca la fecha del último turno "cumplido" de un paciente y devuelve la vigencia resultante.
export async function obtenerVigenciaPaciente(sb, empresaId, pacienteId) {
  const { data } = await sb.from('turnos_propios')
    .select('day')
    .eq('empresa_id', empresaId).eq('paciente_id', pacienteId).eq('status', 'cumplido')
    .order('day', { ascending: false }).limit(1);
  const ultimaConsulta = data && data[0] ? data[0].day : null;
  return { ultimaConsulta, ...calcularVigencia(ultimaConsulta) };
}

// Genera una contraseña simple de 6 dígitos para comunicar por WhatsApp.
export function generarClavePortal() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Genera un nombre de usuario a partir del teléfono o DNI (solo dígitos) del paciente.
export function generarUsuarioPortal(paciente) {
  const base = (paciente.telefono || paciente.dni || '').replace(/\D/g, '');
  return base || `paciente${paciente.id}`;
}
