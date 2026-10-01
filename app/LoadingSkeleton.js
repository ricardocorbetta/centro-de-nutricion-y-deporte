'use client';

// Placeholder de carga reutilizable (reemplaza los "Cargando…" sueltos en texto plano
// por líneas tipo "skeleton", el patrón estándar en dashboards SaaS actuales).
export default function LoadingSkeleton({ lines = 3, widths }) {
  const ws = widths || Array.from({ length: lines }, (_, i) => Math.max(35, 75 - i * 15) + '%');
  return (
    <div style={{ padding: '2px 0' }}>
      {ws.map((w, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ width: w }} />
      ))}
    </div>
  );
}
