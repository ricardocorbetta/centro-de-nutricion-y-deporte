'use client';

// Pie de página chico y discreto para las páginas públicas (portal de pacientes, reserva de
// turnos, prefiltro, cartelera): cada una ya muestra el logo y los colores propios del centro
// (es una plataforma multi-tenant, la marca del cliente va primero), pero conviene dejar una
// referencia sutil de que corren sobre NUTRIO — para que de cara al paciente también se sienta
// como una plataforma, no como una página suelta hecha a medida.
export default function PlataformaFooter() {
  return (
    <div style={{ textAlign: 'center', marginTop: 36, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--ink-faint)', letterSpacing: '.02em' }}>
        Plataforma NUTRIO
      </span>
    </div>
  );
}
