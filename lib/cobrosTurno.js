// Estado de pago de un turno puntual: precio total (snapshot tomado al crear el turno, puede
// venir editado a mano si es un precio distinto por financiador/convenio), lo ya cobrado
// (sumando todos los cobros vinculados a ese turno, vengan de Mercado Pago o cargados a mano)
// y lo que falta.
export async function estadoPagoTurno(sb, empresaId, turnoId) {
  const [{ data: turno }, { data: cobros }] = await Promise.all([
    sb.from('turnos_propios').select('precio_total').eq('id', turnoId).eq('empresa_id', empresaId).single(),
    sb.from('cobros').select('*').eq('turno_id', turnoId).eq('empresa_id', empresaId).order('created_at', { ascending: true })
  ]);
  const precioTotal = turno?.precio_total ?? null;
  const totalCobrado = (cobros || []).reduce((acc, c) => acc + Number(c.monto || 0), 0);
  const saldoPendiente = precioTotal !== null ? Math.max(0, precioTotal - totalCobrado) : null;
  return { precioTotal, totalCobrado, saldoPendiente, cobros: cobros || [] };
}

// Determina la comisión del profesional (mismo patrón que ya se usaba en /api/cobros y en el webhook de MP).
export async function comisionDe(sb, empresaId, profesional) {
  const { data: cfgRow } = await sb.from('comisiones_config').select('pct_profesional').eq('empresa_id', empresaId).eq('profesional', profesional).single();
  let pct = cfgRow?.pct_profesional;
  if (pct === undefined || pct === null) {
    const { data: def } = await sb.from('comisiones_config').select('pct_profesional').eq('empresa_id', empresaId).eq('profesional', '__default__').single();
    pct = def?.pct_profesional ?? 60;
  }
  return pct;
}
