/**
 * Ajuste de alquileres por índice.
 *
 * El error clásico es sumar los porcentajes mensuales: cuatro meses al 2 % no
 * dan 8 % sino 8,24 %, porque cada mes se aplica sobre el anterior. Con montos
 * de alquiler la diferencia es plata real todos los meses hasta el ajuste
 * siguiente, así que acá se multiplica, no se suma.
 */

/** "2026-09" → índice absoluto de mes, para poder restar. */
function aIndice(periodo: string): number {
  const [a, m] = periodo.split("-").map(Number);
  return a * 12 + (m - 1);
}

function aPeriodo(indice: number): string {
  const a = Math.floor(indice / 12);
  const m = (indice % 12) + 1;
  return `${a}-${String(m).padStart(2, "0")}`;
}

/**
 * Los meses cuya variación entra en el ajuste.
 *
 * Van desde el mes siguiente al último ajuste hasta el mes anterior al nuevo:
 * el IPC de un mes se publica a mediados del siguiente, así que el mes en curso
 * todavía no existe como dato.
 */
export function mesesDelAjuste(desde: string, hasta: string): string[] {
  const a = aIndice(desde) + 1;
  const b = aIndice(hasta);

  const salida: string[] = [];
  for (let i = a; i <= b; i++) salida.push(aPeriodo(i));
  return salida;
}

export type Calculo = {
  /** 1.0824 = subió 8,24 %. */
  coeficiente: number;
  porcentaje: number;
  montoNuevo: number;
  diferencia: number;
  meses: string[];
  /** Meses del rango que no tienen índice cargado. Sin esto el número miente. */
  faltantes: string[];
};

/**
 * Aplica las variaciones mensuales a un monto.
 *
 * Si falta algún mes, se informa: un ajuste calculado con datos incompletos da
 * un número más bajo que el real y nadie se da cuenta mirando el resultado.
 */
export function calcularAjuste(
  monto: number,
  meses: string[],
  valores: Map<string, number>,
): Calculo {
  const faltantes = meses.filter((m) => !valores.has(m));

  let coeficiente = 1;
  for (const m of meses) {
    const v = valores.get(m);
    if (v !== undefined) coeficiente *= 1 + v / 100;
  }

  const montoNuevo = Math.round(monto * coeficiente);

  return {
    coeficiente,
    porcentaje: (coeficiente - 1) * 100,
    montoNuevo,
    diferencia: montoNuevo - monto,
    meses,
    faltantes,
  };
}

/** El mismo cálculo pero con el porcentaje acumulado escrito a mano. */
export function calcularPorPorcentaje(monto: number, porcentaje: number): Calculo {
  const coeficiente = 1 + porcentaje / 100;
  const montoNuevo = Math.round(monto * coeficiente);

  return {
    coeficiente,
    porcentaje,
    montoNuevo,
    diferencia: montoNuevo - monto,
    meses: [],
    faltantes: [],
  };
}

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "2026-09" → "sep 2026" */
export function mesCorto(periodo: string): string {
  const [a, m] = periodo.split("-");
  return `${MESES_CORTOS[Number(m) - 1] ?? m} ${a}`;
}
