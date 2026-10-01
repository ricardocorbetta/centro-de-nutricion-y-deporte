'use client';

// Modal de confirmación simple, para reemplazar los window.confirm() nativos del navegador
// (que no se pueden estilar y desentonan con el resto de la app). Uso:
//   const [confirmando, setConfirmando] = useState(null); // null | { mensaje, onConfirm }
//   setConfirmando({ mensaje: '¿Cancelar este turno?', onConfirm: () => cambiarEstado(turno, 'cancelled') });
//   ...
//   <ConfirmModal data={confirmando} onClose={() => setConfirmando(null)} />
export default function ConfirmModal({ data, onClose }) {
  if (!data) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 60
    }} onClick={onClose}>
      <div className="card" style={{ width: 340, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 14, color: 'var(--ink)', margin: '0 0 18px' }}>{data.mensaje}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
          <button className={'icon-btn' + (data.destructivo ? '' : ' primary')}
            style={data.destructivo ? { background: 'var(--rust)', color: '#fff', borderColor: 'var(--rust)' } : undefined}
            onClick={() => { data.onConfirm(); onClose(); }}>
            {data.textoConfirmar || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
