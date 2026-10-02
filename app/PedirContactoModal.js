'use client';

import { useState } from 'react';
import SidePanel from './SidePanel';

// Reemplaza los window.prompt() nativos (no se pueden estilar, bloquean el hilo del navegador)
// que se usaban para pedir nombre/teléfono cuando un turno no los tiene cargados, antes de
// mandar un recordatorio por WhatsApp. Uso:
//   const [pidiendo, setPidiendo] = useState(null); // null | { onConfirm: (nombre, telefono) => void }
//   setPidiendo({ onConfirm: (nombre, telefono) => enviar(nombre, telefono) });
//   <PedirContactoModal data={pidiendo} onClose={() => setPidiendo(null)} />
export default function PedirContactoModal({ data, onClose }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  function confirmar() {
    if (!nombre.trim() && !telefono.trim()) return;
    data.onConfirm(nombre.trim(), telefono.trim());
    setNombre(''); setTelefono('');
    onClose();
  }

  return (
    <SidePanel open={!!data} onClose={onClose} title="Datos de contacto" width={380}>
      {data && (
        <>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
            Este turno no tiene nombre o teléfono cargado. Completalo para armar el recordatorio.
          </p>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Nombre del paciente</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Teléfono (con código de país, ej: 5492995551234)</label>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="icon-btn" onClick={onClose}>Cancelar</button>
            <button className="icon-btn primary" onClick={confirmar}>Continuar</button>
          </div>
        </>
      )}
    </SidePanel>
  );
}
