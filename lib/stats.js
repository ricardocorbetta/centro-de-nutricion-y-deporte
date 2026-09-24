// Lógica de negocio compartida: capacidad, facturación, ocupación, mezcla de servicios.
// Se usa tanto en el navegador (para recalcular al vuelo cuando cambian precios/capacidad)
// como, si hiciera falta, del lado servidor.

export const DOW_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const DOW_ORDER = [1,2,3,4,5,6]; // Lunes..Sabado (cerrado domingo)
export const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19];

export const DEFAULT_PRECIOS = { "20": 30000, "30": 45000, "40": 60000, "60": 80000 };
export const PRECIO_CONFIRMADO = { "40": true, "60": true, "20": false, "30": false };

export function fmtMoney(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-AR');
}
export function fmtHoras(min) {
  return (min / 60).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'h';
}

export function priceFor(duration, precios) {
  const key = String(duration);
  if (precios[key] !== undefined) return precios[key];
  const base = precios["40"] || 60000;
  return Math.round((base / 40) * duration);
}
export function isPriceConfirmed(duration) {
  return PRECIO_CONFIRMADO[String(duration)] === true;
}

export function computeStats(events, consumersSummary, config) {
  const precios = config.precios || DEFAULT_PRECIOS;
  const booked = events.filter(e => e.status === 'booked');
  const cancelled = events.filter(e => e.status === 'cancelled');
  const noshow = events.filter(e => e.status === 'noshow');

  const totalMin = booked.reduce((s, e) => s + e.duration, 0);
  let revenue = 0, revenuePlaceholder = 0;
  booked.forEach(e => {
    const p = priceFor(e.duration, precios);
    revenue += p;
    if (!isPriceConfirmed(e.duration)) revenuePlaceholder += p;
  });

  const days = events.map(e => e.day).filter(Boolean).sort();
  const dayMin = days[0], dayMax = days[days.length - 1];
  let weeks = 1;
  if (dayMin && dayMax) {
    const d0 = new Date(dayMin + 'T00:00:00'), d1 = new Date(dayMax + 'T00:00:00');
    weeks = Math.max(1, ((d1 - d0) / 86400000 + 1) / 7);
  }

  const capacidadSemanal = (config.consultorios || 2) * (config.horasConsultorio || 24);
  const capacidadTotalHoras = capacidadSemanal * weeks;
  const horasOcupadas = totalMin / 60;
  const ocupacionPct = Math.min(100, (horasOcupadas / capacidadTotalHoras) * 100);

  const revenuePorHora = horasOcupadas > 0 ? revenue / horasOcupadas : 0;
  const revenuePotencial = revenuePorHora * capacidadTotalHoras;

  const porProfesional = {};
  booked.forEach(e => {
    if (!porProfesional[e.resource]) porProfesional[e.resource] = { min: 0, count: 0, revenue: 0 };
    porProfesional[e.resource].min += e.duration;
    porProfesional[e.resource].count += 1;
    porProfesional[e.resource].revenue += priceFor(e.duration, precios);
  });

  const porServicio = {};
  booked.forEach(e => {
    if (!porServicio[e.service]) porServicio[e.service] = { min: 0, count: 0, revenue: 0, duration: e.duration };
    porServicio[e.service].min += e.duration;
    porServicio[e.service].count += 1;
    porServicio[e.service].revenue += priceFor(e.duration, precios);
  });

  const heat = {};
  DOW_ORDER.forEach(d => { heat[d] = {}; HOURS.forEach(h => heat[d][h] = 0); });
  booked.forEach(e => {
    const d = new Date(e.day + 'T00:00:00');
    const dow = d.getDay();
    const hour = parseInt((e.time || '0:0').split(':')[0], 10);
    if (heat[dow] && heat[dow][hour] !== undefined) heat[dow][hour] += 1;
  });

  const porDia = {};
  DOW_ORDER.forEach(d => porDia[d] = { count: 0, min: 0 });
  booked.forEach(e => {
    const dow = new Date(e.day + 'T00:00:00').getDay();
    if (porDia[dow]) { porDia[dow].count += 1; porDia[dow].min += e.duration; }
  });

  const porFinanciador = {};
  booked.forEach(e => {
    const f = e.financier || 'Particular';
    porFinanciador[f] = (porFinanciador[f] || 0) + 1;
  });

  return {
    dayMin, dayMax, weeks,
    totalEvents: events.length, booked: booked.length, cancelled: cancelled.length, noshow: noshow.length,
    totalMin, horasOcupadas, revenue, revenuePlaceholder,
    capacidadSemanal, capacidadTotalHoras, ocupacionPct,
    revenuePorHora, revenuePotencial,
    porProfesional, porServicio, heat, porDia, porFinanciador,
    pacientesTotal: consumersSummary?.total_count || 0,
    pacientesWeekly: consumersSummary?.data?.weekly || {},
    financiadoresPacientes: consumersSummary?.data?.financiadores || {}
  };
}

export function topBottom(s) {
  const diaArr = DOW_ORDER.map(d => ({ d, min: s.porDia[d].min }));
  diaArr.sort((a, b) => b.min - a.min);
  const top = diaArr[0], bottom = diaArr[diaArr.length - 1];
  let hourTotals = HOURS.map(h => ({ h, total: DOW_ORDER.reduce((sum, d) => sum + s.heat[d][h], 0) }));
  hourTotals.sort((a, b) => a.total - b.total);
  return { top, bottom, idleHour: hourTotals[0] };
}

/* ============ CSV parsing (soporta comillas y comas embebidas) ============ */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length === 1 && rows[r][0] === '') continue;
    const obj = {};
    header.forEach((h, idx) => obj[h] = rows[r][idx] !== undefined ? rows[r][idx] : '');
    out.push(obj);
  }
  return out;
}

export function eventsFromCSV(text) {
  const raw = parseCSV(text);
  return raw.map(row => ({
    day: row['day'] || '',
    time: row['time'] || '',
    resource: row['resource.label'] || 'Sin asignar',
    service: row['service.label'] || 'Sin especificar',
    duration: parseInt(row['service.duration'] || '0', 10) || 0,
    status: row['status'] || 'booked',
    financier: row['financier.label'] || 'Particular'
  })).filter(e => e.day);
}

export function consumersFromCSV(text) {
  const raw = parseCSV(text);
  return raw.map(row => ({
    createdAt: (row['createdAt'] || '').slice(0, 10),
    financier: row['financiers'] || 'Particular'
  })).filter(c => c.createdAt);
}

export function monthKeyFromEvents(events) {
  const counts = {};
  events.forEach(e => {
    const k = e.day.slice(0, 7);
    if (k) counts[k] = (counts[k] || 0) + 1;
  });
  let best = null, bestN = -1;
  Object.entries(counts).forEach(([k, n]) => { if (n > bestN) { best = k; bestN = n; } });
  return best;
}

export function aggregateConsumersWeekly(consumers) {
  const weekly = {};
  const financiadores = {};
  consumers.forEach(c => {
    if (!c.createdAt) return;
    const d = new Date(c.createdAt + 'T00:00:00');
    const day = d.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const key = monday.toISOString().slice(0, 10);
    weekly[key] = (weekly[key] || 0) + 1;
    const f = c.financier || 'Particular';
    financiadores[f] = (financiadores[f] || 0) + 1;
  });
  return { weekly, financiadores, total_count: consumers.length };
}

/* ============ Períodos cargados manualmente (sin CSV) ============ */
// Cuando no hay export de drManager para un mes viejo, se puede cargar un
// resumen a mano. No tiene desglose por profesional/servicio/horario,
// pero sí entra en los totales, la facturación y la tendencia mes a mes.
export function computeStatsManual(manualSummary, consumersSummary, config) {
  const revenue = manualSummary.revenue || 0;
  const horasOcupadas = manualSummary.horasOcupadas || 0;
  const weeks = manualSummary.weeks || 4;
  const capacidadSemanal = (config.consultorios || 2) * (config.horasConsultorio || 24);
  const capacidadTotalHoras = capacidadSemanal * weeks;
  const ocupacionPct = Math.min(100, (horasOcupadas / capacidadTotalHoras) * 100);
  const revenuePorHora = horasOcupadas > 0 ? revenue / horasOcupadas : 0;

  return {
    isManual: true,
    dayMin: manualSummary.monthKey + '-01', dayMax: manualSummary.monthKey + '-fin', weeks,
    totalEvents: (manualSummary.booked || 0) + (manualSummary.cancelled || 0) + (manualSummary.noshow || 0),
    booked: manualSummary.booked || 0, cancelled: manualSummary.cancelled || 0, noshow: manualSummary.noshow || 0,
    totalMin: horasOcupadas * 60, horasOcupadas, revenue, revenuePlaceholder: 0,
    capacidadSemanal, capacidadTotalHoras, ocupacionPct,
    revenuePorHora, revenuePotencial: revenuePorHora * capacidadTotalHoras,
    porProfesional: {}, porServicio: {}, heat: null, porDia: null, porFinanciador: {},
    pacientesTotal: consumersSummary?.total_count || 0,
    pacientesWeekly: consumersSummary?.data?.weekly || {},
    financiadoresPacientes: consumersSummary?.data?.financiadores || {}
  };
}

/* ============ Simulador de escenarios ============ */
// A partir de la ocupación actual (stats reales) proyecta facturación bajo
// supuestos ajustables: % de ocupación objetivo, consultorios, horas por
// semana, y un multiplicador de precio general (para simular subas de tarifa).
export function simulateScenario(baseStats, params) {
  const { ocupacionObjetivoPct, consultorios, horasConsultorio, multiplicadorPrecio, weeks } = params;
  const capacidadSemanal = consultorios * horasConsultorio;
  const capacidadTotalHoras = capacidadSemanal * weeks;
  const horasProyectadas = capacidadTotalHoras * (ocupacionObjetivoPct / 100);
  const revenuePorHoraBase = baseStats.revenuePorHora || 0;
  const revenueProyectado = horasProyectadas * revenuePorHoraBase * multiplicadorPrecio;
  return {
    capacidadTotalHoras,
    horasProyectadas,
    revenueProyectado,
    revenuePorHoraProyectado: revenuePorHoraBase * multiplicadorPrecio
  };
}

export function goalProgress(stats, goal) {
  if (!goal) return null;
  const revenueTarget = goal.revenue_target || 0;
  const occupancyTarget = goal.occupancy_target || 0;
  return {
    revenueTarget,
    occupancyTarget,
    revenuePct: revenueTarget > 0 ? Math.min(999, (stats.revenue / revenueTarget) * 100) : null,
    occupancyPct: occupancyTarget > 0 ? Math.min(999, (stats.ocupacionPct / occupancyTarget) * 100) : null,
    revenueGap: revenueTarget - stats.revenue,
    occupancyGap: occupancyTarget - stats.ocupacionPct
  };
}

/* ============ Clasificación de servicios (para mix y pacientes nuevos) ============ */
export function classifyService(serviceLabel) {
  const s = (serviceLabel || '').toLowerCase();
  if (s.includes('primera vez')) return 'primera_vez';
  if (s.includes('control') || s.includes('seguimiento') || s.includes('tratamiento')) return 'control';
  return 'otros';
}

export function computeServiceMixActual(stats) {
  const counts = { primera_vez: 0, control: 0, otros: 0 };
  Object.entries(stats.porServicio || {}).forEach(([label, d]) => {
    counts[classifyService(label)] += d.count;
  });
  const total = counts.primera_vez + counts.control + counts.otros || 1;
  return {
    counts,
    pct: {
      primera_vez: (counts.primera_vez / total) * 100,
      control: (counts.control / total) * 100,
      otros: (counts.otros / total) * 100
    },
    total
  };
}

export function computeExtendedActuals(stats) {
  const mix = computeServiceMixActual(stats);
  const noshowRate = stats.totalEvents ? (stats.noshow / stats.totalEvents) * 100 : 0;
  const professionalCounts = {};
  Object.entries(stats.porProfesional || {}).forEach(([name, d]) => { professionalCounts[name] = d.count; });
  return {
    mix,
    noshowRate,
    newPatients: mix.counts.primera_vez,
    professionalCounts
  };
}
