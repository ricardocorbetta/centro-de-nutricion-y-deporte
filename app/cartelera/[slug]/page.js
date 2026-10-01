'use client';

import { useEffect, useState } from 'react';
import { LOGO_DATA_URI } from '../../../lib/logo';
import LoadingSkeleton from '../../LoadingSkeleton';

const TIPO_LABEL = { taller: 'Taller', efemeride: 'Fecha especial', receta: 'Receta', flyer: 'Novedad', comunidad: 'Comunidad', otro: 'Novedad' };

function fmtFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function CarteleraPage({ params }) {
  const slug = params.slug;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/public/cartelera?empresa=' + encodeURIComponent(slug))
      .then(r => r.json())
      .then(d => { if (d.error) { setErrorMsg(d.error); return; } setData(d); })
      .catch(e => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const empresa = data?.empresa;
  const colorPrimario = empresa?.colorPrimario || 'var(--primary)';
  const telWhatsapp = (empresa?.whatsappAdmin || '').replace(/\D/g, '');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #F4F7F6)', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 18px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <img src={empresa?.logoUrl || LOGO_DATA_URI} alt="" style={{ height: 36 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{empresa?.nombreCorto || empresa?.nombre || 'Comunidad'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Novedades y comunidad</div>
          </div>
        </div>

        {telWhatsapp && (
          <a href={`https://wa.me/${telWhatsapp}`} target="_blank" rel="noreferrer"
            className="icon-btn primary" style={{ display: 'inline-block', margin: '14px 0 20px' }}>
            Sumate a la comunidad — escribinos por WhatsApp
          </a>
        )}

        {loading ? (
          <LoadingSkeleton lines={5} />
        ) : errorMsg ? (
          <div className="empty-state">
            <span className="icon">🔍</span>
            <span className="title">No encontramos esta página</span>
            <span className="hint">{errorMsg}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(data.cartelera || []).map(c => (
              <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {c.imagenUrl && <img src={c.imagenUrl} alt={c.titulo} style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }} />}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: colorPrimario, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                      {TIPO_LABEL[c.tipo] || c.tipo}
                    </span>
                    {c.destacar && <span style={{ fontSize: 12 }}>⭐</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{c.titulo}</div>
                  {c.descripcion && <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>{c.descripcion}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{fmtFecha(c.fecha)}</div>
                </div>
              </div>
            ))}
            {!data.cartelera?.length && (
              <div className="empty-state">
                <span className="icon">📣</span>
                <span className="title">Todavía no hay novedades publicadas</span>
                <span className="hint">Volvé a pasar pronto.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
