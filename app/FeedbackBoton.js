'use client';

import { useEffect, useRef, useState } from 'react';
import SidePanel from './SidePanel';
import { TIPOS, EstadoTag, Historial, Capturas, fmtFechaHora, leerJson } from './mejorasUi';

// Caja de feedback de la clínica: botón fijo "Sugerencias" en todas las pantallas internas. Abre un
// panel lateral para mandar un pedido (algo no funciona / mejora / idea / consulta) y ver cómo van
// los pedidos ya enviados. Los gestiona el equipo de EULALIA desde su panel.
// Uso: <FeedbackBoton pantalla="Agenda" />  (pantalla = dónde está el usuario, se adjunta al pedido)
export default function FeedbackBoton({ pantalla }) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState('enviar'); // 'enviar' | 'mis-pedidos'

  return (
    <>
      <button type="button" className="mej-fab" onClick={() => setAbierto(true)}>
        Sugerencias
      </button>
      <SidePanel open={abierto} onClose={() => setAbierto(false)} title="Sugerencias y problemas"
        subtitle="Contale al equipo de EULALIA qué mejorar" width={460}>
        <div className="mej-seg" role="tablist">
          <button role="tab" aria-selected={vista === 'enviar'} className={vista === 'enviar' ? 'active' : ''} onClick={() => setVista('enviar')}>Nuevo pedido</button>
          <button role="tab" aria-selected={vista === 'mis-pedidos'} className={vista === 'mis-pedidos' ? 'active' : ''} onClick={() => setVista('mis-pedidos')}>Mis pedidos</button>
        </div>
        {vista === 'enviar'
          ? <NuevoPedido pantalla={pantalla} onEnviado={() => setVista('mis-pedidos')} />
          : <MisPedidos />}
      </SidePanel>
    </>
  );
}

function NuevoPedido({ pantalla, onEnviado }) {
  const [tipo, setTipo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [capturas, setCapturas] = useState([]);
  const [estado, setEstado] = useState({ enviando: false, msg: '', err: false });
  const inputFile = useRef(null);

  function elegirCapturas(e) {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setCapturas(files);
  }

  async function enviar(e) {
    e.preventDefault();
    if (!tipo) return setEstado({ enviando: false, msg: 'Elegí qué tipo de pedido es.', err: true });
    if (titulo.trim().length < 3) return setEstado({ enviando: false, msg: 'Poné un título corto (mínimo 3 letras).', err: true });
    setEstado({ enviando: true, msg: '', err: false });
    const form = new FormData();
    form.append('tipo', tipo);
    form.append('titulo', titulo.trim());
    form.append('detalle', detalle.trim());
    form.append('pantalla', pantalla || (typeof window !== 'undefined' ? window.location.pathname : ''));
    capturas.forEach(f => form.append('capturas', f));
    try {
      const res = await fetch('/api/mejoras', { method: 'POST', body: form });
      const data = await leerJson(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el pedido.');
      setTipo(''); setTitulo(''); setDetalle(''); setCapturas([]);
      if (inputFile.current) inputFile.current.value = '';
      setEstado({ enviando: false, msg: `Recibido. Es el pedido #${data.id}.`, err: false });
      setTimeout(onEnviado, 900);
    } catch (err) {
      setEstado({ enviando: false, msg: err.message, err: true });
    }
  }

  return (
    <form onSubmit={enviar} className="mej-form">
      <fieldset className="mej-tipos">
        <legend>¿Qué querés contarnos?</legend>
        {TIPOS.map(t => (
          <label key={t.id} className={'mej-tipo' + (tipo === t.id ? ' active' : '')}>
            <input type="radio" name="tipo" value={t.id} checked={tipo === t.id} onChange={() => setTipo(t.id)} />
            <span className="mej-tipo-label">{t.label}</span>
            <span className="mej-tipo-hint">{t.hint}</span>
          </label>
        ))}
      </fieldset>

      <label className="mej-campo">
        <span>Título</span>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={160}
          placeholder="Ej: No me deja cobrar un turno con seña" />
      </label>

      <label className="mej-campo">
        <span>Detalle <em>(opcional)</em></span>
        <textarea rows={5} value={detalle} onChange={e => setDetalle(e.target.value)} maxLength={4000}
          placeholder="Qué estabas haciendo, qué esperabas que pasara y qué pasó." />
      </label>

      <label className="mej-campo">
        <span>Capturas de pantalla <em>(opcional, hasta 3)</em></span>
        <input ref={inputFile} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={elegirCapturas} />
        {capturas.length > 0 && <small>{capturas.map(f => f.name).join(', ')}</small>}
      </label>

      {pantalla && <p className="mej-nota">Se adjunta que lo mandaste desde <b>{pantalla}</b>.</p>}

      <div className="mej-acciones">
        {estado.msg && <span className={'status-msg' + (estado.err ? ' err' : '')} role="status">{estado.msg}</span>}
        <button type="submit" className="icon-btn primary" disabled={estado.enviando}>
          {estado.enviando ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </div>
    </form>
  );
}

function MisPedidos() {
  const [mejoras, setMejoras] = useState(null);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);

  async function cargar() {
    setError('');
    try {
      const res = await fetch('/api/mejoras');
      const data = await leerJson(res);
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los pedidos.');
      setMejoras(data.mejoras || []);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { cargar(); }, []);

  if (error) return (
    <div className="empty-state"><div className="title">{error}</div>
      <button className="icon-btn" onClick={cargar}>Reintentar</button></div>
  );
  if (!mejoras) return <p className="mej-vacio">Cargando…</p>;
  if (!mejoras.length) return (
    <div className="empty-state"><div className="title">Todavía no mandaste pedidos</div>
      <div className="hint">Cuando algo no funcione o se te ocurra una mejora, contanos desde "Nuevo pedido".</div></div>
  );

  return (
    <ul className="mej-lista">
      {mejoras.map(m => (
        <li key={m.id} className="mej-item">
          <button type="button" className="mej-item-head" aria-expanded={abierta === m.id}
            onClick={() => setAbierta(abierta === m.id ? null : m.id)}>
            <span className="mej-item-titulo">#{m.id} · {m.titulo}</span>
            <span className="mej-item-meta"><EstadoTag estado={m.estado} /> {fmtFechaHora(m.created_at)}</span>
          </button>
          {abierta === m.id && <DetalleClinica mejora={m} onCambio={cargar} />}
        </li>
      ))}
    </ul>
  );
}

function DetalleClinica({ mejora, onCambio }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState({ ocupado: false, msg: '', err: false });
  const pideConfirmacion = mejora.estado === 'hecho' && !mejora.confirmacion;

  async function post(url, body, okMsg) {
    setEstado({ ocupado: true, msg: '', err: false });
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await leerJson(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.');
      setTexto('');
      setEstado({ ocupado: false, msg: okMsg, err: false });
      onCambio();
    } catch (err) { setEstado({ ocupado: false, msg: err.message, err: true }); }
  }

  return (
    <div className="mej-detalle">
      {mejora.detalle && <p className="mej-detalle-texto">{mejora.detalle}</p>}
      <Capturas urls={mejora.adjuntosUrls} />
      <Historial mejora={mejora} mostrarInternos={false} />

      {pideConfirmacion && (
        <div className="mej-confirmar">
          <b>El equipo lo marcó como hecho. ¿Quedó resuelto?</b>
          <div className="mej-acciones">
            <button className="icon-btn primary" disabled={estado.ocupado}
              onClick={() => post(`/api/mejoras/${mejora.id}/confirmar`, { resuelto: true, comentario: texto }, '¡Gracias por confirmar!')}>
              Sí, quedó resuelto
            </button>
            <button className="icon-btn" disabled={estado.ocupado || !texto.trim()}
              title={!texto.trim() ? 'Escribí abajo qué sigue fallando' : ''}
              onClick={() => post(`/api/mejoras/${mejora.id}/confirmar`, { resuelto: false, comentario: texto }, 'Lo reabrimos para revisarlo.')}>
              No, sigue igual
            </button>
          </div>
        </div>
      )}

      <label className="mej-campo">
        <span>{pideConfirmacion ? 'Comentario (si sigue fallando, contanos qué pasa)' : 'Agregar un comentario'}</span>
        <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} maxLength={4000} />
      </label>
      <div className="mej-acciones">
        {estado.msg && <span className={'status-msg' + (estado.err ? ' err' : '')} role="status">{estado.msg}</span>}
        {!pideConfirmacion && (
          <button className="icon-btn" disabled={estado.ocupado || !texto.trim()}
            onClick={() => post(`/api/mejoras/${mejora.id}/comentarios`, { texto }, 'Comentario enviado.')}>
            Comentar
          </button>
        )}
      </div>
    </div>
  );
}
