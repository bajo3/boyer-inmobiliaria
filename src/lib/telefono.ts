/**
 * Normalización de teléfonos argentinos a E.164.
 *
 * Existe porque el relevamiento encontró el mismo contacto escrito de cinco
 * formas distintas. Si el teléfono no está normalizado, el CRM duplica personas
 * y el historial se parte en dos.
 */

const CODIGO_PAIS = "54";
/** Tandil. Se usa cuando el número viene sin característica. */
const AREA_DEFECTO = "249";

/**
 * Convierte cualquier forma común a +549XXXXXXXXXX.
 * Devuelve null si no parece un teléfono válido.
 *
 *   "0249 15 4123456"  → +5492494123456
 *   "(249) 412-3456"   → +5492494123456
 *   "+54 9 249 4123456"→ +5492494123456
 *   "4123456"          → +5492494123456  (asume Tandil)
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (!entrada) return null;

  let n = entrada.replace(/[^\d+]/g, "");
  if (!n) return null;

  n = n.replace(/^\+/, "");

  // Sacar prefijo de discado internacional y el 0 de larga distancia.
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith(CODIGO_PAIS)) n = n.slice(2);
  if (n.startsWith("0")) n = n.slice(1);

  // El 9 de móvil y el 15 son la misma cosa escrita distinto: se normaliza a 9.
  let movil = false;
  if (n.startsWith("9")) {
    movil = true;
    n = n.slice(1);
  }

  // El 15 puede venir pegado después de la característica: 249 15 4123456
  const con15 = n.match(/^(\d{2,4})15(\d{6,8})$/);
  if (con15) {
    movil = true;
    n = con15[1] + con15[2];
  } else if (n.startsWith("15")) {
    movil = true;
    n = AREA_DEFECTO + n.slice(2);
  }

  // Número local sin característica.
  if (n.length >= 6 && n.length <= 8) {
    n = AREA_DEFECTO + n;
    movil = true;
  }

  if (n.length < 9 || n.length > 11) return null;

  return `+${CODIGO_PAIS}${movil || n.length === 10 ? "9" : ""}${n}`;
}

/** Formato legible para pantalla: +54 9 249 412-3456 */
export function mostrarTelefono(e164: string | null | undefined): string {
  if (!e164) return "—";

  const m = e164.match(/^\+549(\d{2,4})(\d{3,4})(\d{4})$/);
  if (m) return `+54 9 ${m[1]} ${m[2]}-${m[3]}`;

  return e164;
}

/** wa.me quiere el número sin "+" ni separadores. */
export function paraWhatsApp(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const solo = e164.replace(/\D/g, "");
  return solo.length >= 10 ? solo : null;
}
