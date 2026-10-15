'use client';

import { useEffect, useState } from 'react';
import SidePanel from './SidePanel';
import { TIPO_LABEL, ESTADO_LABEL, EstadoTag, Historial, Capturas, fmtFechaHora, leerJson } from './mejorasUi';

const FILTROS = [
  { id: 'abiertos', label: 'Abiertos' },
  { id: 'nuevo', label: 'Nuevos' },
  { id: 'hecho', label: 'Hechos' },
  { id: 'descartado', label: 'Descartados' },
  { id: 'todos', label: 'Todos' }
];
const ABIERTOS = ['nuevo', 'en_analisis', 'planificado', 'en_curso'];

// Bandeja de feedback del Panel EULALIA: los pedidos de todas las clínicas, con filtros por
// estado, y un panel lateral para cambiar estado/prioridad, responder y dejar notas internas.
export default function MejorasBandeja() {
  const [filtro, setFiltro] = useState('abiertos');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [seleccionadaId, setSeleccionadaId] = useState(null);

  async function cargar(f = filtro) {
    setError('');
    try {
      const res = await fetch('/api/xenom/mejoras?estado=' + f);
      const data = await leerJson(res);
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los pedidos.');
      setDatos(data);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { cargar(filtro); }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = datos?.contadores || {};
  const cuenta = id => id === 'abiertos' ? ABIERTOS.reduce((s, e) => s + (c[e] || 0), 0)
    : id === 'todos' ? Object.entries(c).filter(([k]) => k !== 'sin_confirmar').reduce((s, [, v]) => s + v, 0)
    : (c[id] || 0);
  const seleccionada = datos?.mejoras?.find(m => m.id === seleccionadaId) || null;

  return (
    <section className="card mej-bandeja">
      <div className="section-head">
        <h2>Sugerencias de las clínicas</h2>
        {(c.nuevo || 0) > 0 && <span className="tag rust">{c.nuevo} {c.nuevo === 1 ? 'nuevo' : 'nuevos'}</span>}
      </div>

      <div className="mej-seg mej-filtros" role="tablist">
        {FILTROS.map(f => (
          <button key={f.id} role="tab" aria-selected={filtro === f.id} className={filtro === f.id ? 'active' : ''} onClick={() => setFiltro(f.id)}>
            {f.label} <span className="mej-cuenta">{cuenta(f.id)}</span>
          </button>
        ))}
      </div>
      {(c.sin_confirmar || 0) > 0 && (
        <p className="mej-nota">{c.sin_confirmar} {c.sin_confirmar === 1 ? 'pedido hecho espera' : 'pedidos hechos esperan'} la confirmación de la clínica.</p>
      )}

      {error ? (
        <div className="empty-state"><div className="title">{error}</div><button className="icon-btn" onClick={() => cargar()}>Reintentar</button></div>
      ) : !datos ? (
        <p className="mej-vacio">Cargando…</p>
      ) : !datos.mejoras.length ? (
        <div className="empty-state"><div className="title">No hay pedidos en esta vista</div></div>
      ) : (
        <ul className="mej-lista">
          {datos.mejoras.map(m => (
            <li key={m.id} className="mej-item">
              <button type="button" className="mej-item-head" onClick={() => setSeleccionadaId(m.id)}>
                <span className="mej-item-titulo">#{m.id} · {m.titulo}</span>
                <span className="mej-item-meta">
                  <EstadoTag estado={m.estado} />
                  {m.prioridad === 'alta' && <span className="tag rust">Prioridad alta</span>}
                  {m.confirmacion === 'no_resuelto' && <span className="tag rust">Reabierto</span>}
                  <span>{m.empresa_nombre} · {TIPO_LABEL[m.tipo]} · {fmtFechaHora(m.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <SidePanel open={!!seleccionada} onClose={() => setSeleccionadaId(null)} width={520}
        title={seleccionada ? `#${seleccionada.id} · ${seleccionada.titulo}` : ''}
        subtitle={seleccionada ? `${seleccionada.empresa_nombre} · ${seleccionada.autor_nombre} · ${fmtFechaHora(seleccionada.created_at)}` : ''}>
        {seleccionada && <DetallePlataforma mejora={seleccionada} onCambio={() => cargar()} />}
      </SidePanel>
    </section>
  );
}

function DetallePlataforma({ mejora, onCambio }) {
  const [texto, setTexto] = useState('');
  const [interno, setInterno] = useState(false);
  const [estado, setEstado] = useState({ ocupado: false, msg: '', err: false });

  async function enviar(url, method, body, okMsg) {
    setEstado({ ocupado: true, msg: '', err: false });
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'x-sin-aviso': '1' }, body: JSON.stringify(body) });
      const data = await leerJson(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
      setEstado({ ocupado: false, msg: okMsg, err: false });
      onCambio();
      return true;
    } catch (err) { setEstado({ ocupado: false, msg: err.message, err: true }); return false; }
  }

  return (
    <div className="mej-detalle">
      <dl className="mej-datos">
        <dt>Tipo</dt><dd>{TIPO_LABEL[mejora.tipo]}</dd>
        {mejora.pantalla && <><dt>Desde</dt><dd>{mejora.pantalla}</dd></>}
        {mejora.reaperturas > 0 && <><dt>Reaperturas</dt><dd>{mejora.reaperturas}</dd></>}
        {mejora.confirmacion && <><dt>La clínica dijo</dt><dd>{mejora.confirmacion === 'resuelto' ? 'Quedó resuelto' : 'No quedó resuelto'}</dd></>}
      </dl>

      <div className="mej-gestion">
        <label className="mej-campo">
          <span>Estado</span>
          <select value={mejora.estado} disabled={estado.ocupado}
            onChange={e => enviar(`/api/xenom/mejoras/${mejora.id}`, 'PATCH', { estado: e.target.value }, 'Estado actualizado.')}>
            {Object.entries(ESTADO_LABEL).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <label className="mej-campo">
          <span>Prioridad</span>
          <select value={mejora.prioridad || ''} disabled={estado.ocupado}
            onChange={e => enviar(`/api/xenom/mejoras/${mejora.id}`, 'PATCH', { prioridad: e.target.value || null }, 'Prioridad actualizada.')}>
            <option value="">Sin definir</option>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </label>
      </div>

      {mejora.detalle && <p className="mej-detalle-texto">{mejora.detalle}</p>}
      <Capturas urls={mejora.adjuntosUrls} />
      {mejora.navegador && <p className="mej-nota">Navegador: {mejora.navegador}</p>}

      <h3 className="mej-subtitulo">Historial</h3>
      <Historial mejora={mejora} mostrarInternos />

      <label className="mej-campo">
        <span>Responder</span>
        <textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} maxLength={4000} />
      </label>
      <label className="mej-check">
        <input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} />
        Nota interna (la clínica no la ve)
      </label>
      <div className="mej-acciones">
        {estado.msg && <span className={'status-msg' + (estado.err ? ' err' : '')} role="status">{estado.msg}</span>}
        <button className="icon-btn primary" disabled={estado.ocupado || !texto.trim()}
          onClick={async () => { if (await enviar(`/api/mejoras/${mejora.id}/comentarios`, 'POST', { texto, interno }, interno ? 'Nota guardada.' : 'Respuesta enviada.')) { setTexto(''); setInterno(false); } }}>
          {interno ? 'Guardar nota' : 'Responder'}
        </button>
      </div>
    </div>
  );
}
