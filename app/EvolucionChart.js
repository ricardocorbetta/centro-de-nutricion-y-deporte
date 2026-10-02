'use client';

// Gráfico de línea liviano (SVG puro, sin dependencias) para mostrar la evolución de una
// métrica (peso, % grasa, etc.) a lo largo de las consultas. points: [{x: 'fecha', y: number}]
export default function EvolucionChart({ points, unidad = '', color = 'var(--primary)', height = 120 }) {
  const validos = points.filter(p => p.y !== null && p.y !== undefined && !Number.isNaN(p.y));
  if (validos.length < 2) {
    return (
      <div className="empty-state" style={{ padding: '16px 10px' }}>
        <span className="icon">📈</span>
        <span className="hint">Con 2 o más controles cargados vas a ver acá el gráfico de evolución.</span>
      </div>
    );
  }
  const w = 560, h = height, padX = 36, padY = 18;
  const ys = validos.map(p => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const stepX = validos.length > 1 ? (w - padX * 2) / (validos.length - 1) : 0;
  const coords = validos.map((p, i) => {
    const x = padX + i * stepX;
    const y = padY + (h - padY * 2) * (1 - (p.y - min) / span);
    return { x, y, ...p };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const primero = validos[0].y, ultimo = validos[validos.length - 1].y;
  const diff = ultimo - primero;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 560, height, display: 'block' }}>
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="var(--border)" strokeWidth="1" />
        <text x={padX} y={padY - 4} fontSize="10" fill="var(--ink-faint)">{max}{unidad}</text>
        <text x={padX} y={h - padY + 12} fontSize="10" fill="var(--ink-faint)">{min}{unidad}</text>
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="3.5" fill={color} />
            <title>{c.fecha}: {c.y}{unidad}</title>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-faint)', maxWidth: 560 }}>
        <span>{validos[0].fecha}</span>
        <span style={{ fontWeight: 700, color: diff === 0 ? 'var(--ink-soft)' : diff < 0 ? 'var(--sage)' : 'var(--rust)' }}>
          {diff > 0 ? '+' : ''}{Math.round(diff * 10) / 10}{unidad} desde el inicio
        </span>
        <span>{validos[validos.length - 1].fecha}</span>
      </div>
    </div>
  );
}
