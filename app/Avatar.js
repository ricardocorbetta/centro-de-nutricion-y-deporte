'use client';

// Círculo de iniciales para identificar pacientes/profesionales de un vistazo en listas y
// tablas, en vez de solo texto plano — mismo patrón en Pacientes, Agenda y Recordatorios.
// El color de fondo es estable por nombre (mismo paciente = mismo color siempre).
const PALETA = ['#1F7A68', '#B08A54', '#2F8F72', '#5C6E70', '#8A6A34', '#C0562F'];

function colorPara(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  return PALETA[hash % PALETA.length];
}

function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function Avatar({ nombre, size = 28 }) {
  const n = nombre && nombre.trim() ? nombre.trim() : '';
  const bg = n ? colorPara(n) : 'var(--ink-faint)';
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: n ? bg + '22' : 'var(--surface-alt)', color: n ? bg : 'var(--ink-faint)' }}
    >
      {n ? iniciales(n) : '—'}
    </span>
  );
}
