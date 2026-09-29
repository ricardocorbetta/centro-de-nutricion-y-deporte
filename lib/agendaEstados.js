// Estados de turno, alineados a los 6 que usa drApp (antes teníamos solo 4).
// Se centralizan acá para que la agenda (lista/grilla/semana), la API y las
// estadísticas usen siempre la misma definición.

export const ESTADOS_VALIDOS = ['booked', 'esperando', 'en_consulta', 'cumplido', 'cancelled', 'noshow'];

export const ESTADO_LABEL = {
  booked: 'Reservado',
  esperando: 'Esperando',
  en_consulta: 'En consulta',
  cumplido: 'Atendido',
  cancelled: 'Cancelado',
  noshow: 'Ausente'
};

// clase CSS de "tag" para cada estado (ver globals.css: .tag, .tag.gold, .tag.rust)
export const ESTADO_CLASS = {
  booked: '',
  esperando: 'gold',
  en_consulta: 'gold',
  cumplido: '',
  cancelled: 'rust',
  noshow: 'rust'
};

// Estados que cuentan como "turno en pie" a efectos de facturación/ocupación
// (todo lo que no sea cancelado o ausente). Antes solo se contaba 'booked',
// así que marcar un turno como Atendido le hacía perder su facturación —
// esto lo corrige.
export const ESTADOS_FACTURABLES = new Set(['booked', 'esperando', 'en_consulta', 'cumplido']);

// Tabs de la vista de lista, en el mismo orden que usa drApp.
export const ESTADO_TABS = [
  { id: 'todos', label: 'Todos' },
  { id: 'booked', label: 'Reservados' },
  { id: 'esperando', label: 'En espera' },
  { id: 'en_consulta', label: 'En consulta' },
  { id: 'cumplido', label: 'Atendidos' },
  { id: 'noshow', label: 'Ausentes' },
  { id: 'cancelled', label: 'Cancelados' }
];

export const MODALIDADES = [
  { id: 'presencial', label: 'Presencial' },
  { id: 'videollamada', label: 'Videollamada' }
];
