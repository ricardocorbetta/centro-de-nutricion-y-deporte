// Integración con Mercado Pago vía Checkout Pro (preferencias de pago), al estilo marketplace:
// cada empresa pega su propio Access Token (de su propia cuenta de Mercado Pago, sacado de
// https://www.mercadopago.com.ar/developers/panel) — la plata entra directo a la cuenta de la
// clínica, Xenom nunca toca el dinero. Mismo patrón "mejor esfuerzo" que lib/googleCalendar.js:
// si algo falla, no bloquea la reserva ni el cobro, y la función que llama decide qué mostrar.

const MP_API = 'https://api.mercadopago.com';

export function mercadoPagoConfigurado(empresa) {
  return !!empresa?.mercadopago_access_token;
}

// Valida un Access Token pegado en el panel, pidiendo los datos de la cuenta dueña del token.
export async function validarAccessToken(accessToken) {
  try {
    const res = await fetch(`${MP_API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data.email || null, siteId: data.site_id || null };
  } catch (e) {
    return null;
  }
}

// Crea una preferencia de pago (Checkout Pro) y devuelve el link para pagar (init_point).
// externalReference identifica qué se está cobrando (turno/seña) para reconciliar en el webhook.
export async function crearPreferencia({ accessToken, titulo, monto, externalReference, backUrl, notificationUrl }) {
  try {
    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ title: titulo, quantity: 1, unit_price: Math.round(monto * 100) / 100, currency_id: 'ARS' }],
        external_reference: externalReference,
        notification_url: notificationUrl,
        back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
        auto_return: 'approved'
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, initPoint: data.init_point };
  } catch (e) {
    return null;
  }
}

// Consulta el estado real de un pago en la API de Mercado Pago (se usa desde el webhook,
// nunca hay que confiar ciegamente en el contenido de la notificación).
export async function obtenerPago({ accessToken, paymentId }) {
  try {
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
