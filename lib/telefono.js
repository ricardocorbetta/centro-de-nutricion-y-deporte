// Teléfonos argentinos. La gente los escribe de mil formas ("0299 15 555-1234", "+54 9 299 555 1234",
// "2995551234"); para comparar fichas y armar links de WhatsApp hay que llevarlos a una forma única.

// Devuelve los 10 dígitos nacionales (código de área sin 0 + número sin 15), o null si no parece un
// teléfono argentino. Ej: "0299 15 555-1234" -> "2995551234".
export function normalizarTelAR(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  // Quitar el "15" que va entre el código de área (2 a 4 dígitos) y el número.
  if (d.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === '15') { d = d.slice(0, largoArea) + d.slice(largoArea + 2); break; }
    }
  }
  return d.length === 10 ? d : null;
}

// Número para wa.me (549 + 10 dígitos). Si no se puede normalizar, devuelve solo los dígitos
// (por si es un número del exterior).
export function telWhatsApp(tel) {
  const n = normalizarTelAR(tel);
  if (n) return '549' + n;
  const d = String(tel || '').replace(/\D/g, '');
  return d || null;
}

export function mismoTelefono(a, b) {
  const na = normalizarTelAR(a), nb = normalizarTelAR(b);
  return !!na && na === nb;
}
