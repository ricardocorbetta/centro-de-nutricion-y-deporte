'use client';

import SidePanel from './SidePanel';

// Confirmación de una acción (reemplaza los window.confirm() nativos del navegador, que no se
// pueden estilar). Se muestra como panel lateral, igual que el resto de la app. Uso:
//   const [confirmando, setConfirmando] = useState(null); // null | { mensaje, onConfirm }
//   setConfirmando({ mensaje: '¿Cancelar este turno?', onConfirm: () => cambiarEstado(turno, 'cancelled') });
//   ...
//   <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
export default function ConfirmModal({ data, onClose }) {
  return (
    <SidePanel open={!!data} onClose={onClose} title="Confirmar" width={360}>
      {data && (
        <>
          <p style={{ fontSize: 14, color: 'var(--ink)', margin: '0 0 20px' }}>{data.mensaje}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="icon-btn" onClick={onClose}>Cancelar</button>
            <button className={'icon-btn' + (data.destructivo ? '' : ' primary')}
              style={data.destructivo ? { background: 'var(--rust)', color: '#fff', borderColor: 'var(--rust)' } : undefined}
              onClick={() => { data.onConfirm(); onClose(); }}>
              {data.textoConfirmar || 'Confirmar'}
            </button>
          </div>
        </>
      )}
    </SidePanel>
  );
}
