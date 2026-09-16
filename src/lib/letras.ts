/**
 * Importes en letras para los recibos.
 *
 * Un recibo sin el monto escrito en palabras se discute: el número se puede
 * retocar con una lapicera, la frase no.
 */

const UNIDADES = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
];

const DECENAS = [
  "",
  "",
  "veinti",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];

const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function hasta999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";

  const c = Math.floor(n / 100);
  const resto = n % 100;

  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);

  if (resto <= 20) {
    if (resto > 0) partes.push(UNIDADES[resto]);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;

    if (d === 2) {
      partes.push(u === 0 ? "veinte" : `veinti${UNIDADES[u]}`);
    } else {
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`);
    }
  }

  return partes.join(" ");
}

/** 420000 → "cuatrocientos veinte mil" */
export function enLetras(monto: number): string {
  const n = Math.floor(Math.abs(monto));
  if (n === 0) return "cero";

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];

  if (millones === 1) partes.push("un millón");
  else if (millones > 1) partes.push(`${hasta999(millones)} millones`);

  if (miles === 1) partes.push("mil");
  else if (miles > 1) partes.push(`${hasta999(miles)} mil`);

  if (resto > 0) partes.push(hasta999(resto));

  return partes.join(" ").replace(/\s+/g, " ").trim();
}

/** "SON PESOS CUATROCIENTOS VEINTE MIL CON 00/100" */
export function importeEnLetras(monto: number, moneda: "ARS" | "USD"): string {
  const entero = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - entero) * 100);
  const nombre = moneda === "USD" ? "DÓLARES" : "PESOS";

  return `SON ${nombre} ${enLetras(entero).toUpperCase()} CON ${String(centavos).padStart(2, "0")}/100`;
}
