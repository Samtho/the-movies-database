// Formato de fechas y números para la UI (es-ES).

// "2026-06-14" -> "14/06/2026". Si la fecha no tiene esa forma, se devuelve tal cual:
// mejor mostrar el dato crudo que una fecha inventada.
export function formatoFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Siempre con separador de miles (1.436), también en cifras de 4 dígitos, para que
// todas las cifras de la app se lean igual.
export function formatoNumero(n: number, decimales = 0): string {
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: true });
}

const PALABRAS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];

// Número en palabras para titulares ("Nueve modelos"); fuera de 0..12 usa cifras.
export function numeroEnPalabras(n: number, { mayuscula = false } = {}): string {
  const texto = Number.isInteger(n) && n >= 0 && n < PALABRAS.length ? PALABRAS[n] : formatoNumero(n);
  return mayuscula ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}
