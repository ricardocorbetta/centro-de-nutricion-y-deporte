'use client';

import { useState } from 'react';

// Reemplaza los window.prompt() nativos (no se pueden estilar, bloquean el hilo del navegador)
// que se usaban para pedir nombre/teléfono cuando un turno no los tiene cargados, antes de
// mandar un recordatorio por WhatsApp. Uso:
//   const [pidiendo, setPidiendo] = useState(null); // null | { onConfirm: (nombre, telefono) => void }
//   setPidiendo({ onConfirm: (nombre, telefono) => enviar(nombre, telefono) });
//   <PedirContactoModal data={pidiendo} onClose={() => setPidiendo(null)} />
export default function PedirContactoModal({ data, onClose }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  if (!data) return null;

  function confirmar() {
    if (!nombre.trim() && !telefono.trim()) return;
    data.onConfirm(nombre.trim(), telefono.trim());
    setNombre(''); setTelefono('');
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 60
    }} onClick={onClose}>
      <div className="card" style={{ width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: '0 0 14px', fontWeight: 600 }}>
          Este turno no tiene nombre o teléfono cargado. Completalo para armar el recordatorio.
        </p>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Nombre del paciente</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Teléfono (con código de país, ej: 5492995551234)</label>
          <input value={telefono} onChange={e => setTelefono(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="icon-btn" onClick={onClose}>Cancelar</button>
          <button className="icon-btn primary" onClick={confirmar}>Continuar</button>
        </div>
      </div>
    </div>
  );
}
