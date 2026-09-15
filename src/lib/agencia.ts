/**
 * Datos reales de la inmobiliaria, tal como salieron del relevamiento de
 * septiembre de 2026 (ver ../../datos-crm-boyer.pdf).
 *
 * Están acá y no hardcodeados en las pantallas porque varios son justamente
 * los que hay que corregir: el teléfono oficial todavía no está decidido.
 */

export const AGENCIA = {
  nombre: "María Paz Boyer",
  rubro: "Negocios Inmobiliarios",
  titular: "María de la Paz Boyer",
  matricula: "Mat. 1669 · F.º 260 · T.º VI",
  cuit: "27-33189233-0",
  direccion: "San Martín 406 esq. Chacabuco",
  ciudad: "Tandil",
  provincia: "Buenos Aires",
  horario: "Lunes a viernes, 9 a 13",
  zonaprop: "https://www.zonaprop.com.ar/inmobiliarias/maria-paz-boyer-negocios-inmobiliarios_51837499-inmuebles.html",
  instagram: "@mariapazboyer.inmobiliaria",
} as const;

/**
 * Los tres teléfonos que aparecen publicados hoy, cada uno en un canal
 * distinto. Cuál es el oficial es una de las dos decisiones que el plan marca
 * como bloqueantes: hasta que se defina, el panel lo muestra como un problema
 * de datos, porque lo es.
 */
export const TELEFONOS_PUBLICADOS = [
  { numero: "+54 9 249 431-4444", fuente: "Sitio propio (archivado)" },
  { numero: "+54 249 442-2020", fuente: "Google Business" },
  { numero: "+54 9 249 465-9000", fuente: "Zonaprop / Facebook" },
] as const;

/** Comisión de referencia en Tandil. Se usa para estimar el pipeline. */
export const COMISION_PCT = 3;
