/**
 * Cruce entre lo que la gente busca y lo que la inmobiliaria tiene.
 *
 * Es la parte del sistema que genera operaciones en vez de solo registrarlas:
 * cuando entra una propiedad, alguien de la cartera ya la estaba buscando y
 * nadie se acuerda. Los criterios que el comprador no completó no filtran
 * nada — media búsqueda cargada no puede significar cero resultados.
 */

import type { Propiedad, Busqueda, Contacto } from "@/db/schema";

export type Coincidencia = {
  busqueda: Busqueda & { contacto: Contacto };
  /** Cuántos criterios explícitos dieron. Ordena de más a menos ajustado. */
  puntos: number;
  motivos: string[];
};

function num(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ¿Esta propiedad sirve para esta búsqueda?
 *
 * Devuelve null si algo la descarta. Un criterio vacío no descarta ni suma.
 */
export function evaluar(
  p: Propiedad,
  b: Busqueda,
): { puntos: number; motivos: string[] } | null {
  if (b.operacion !== p.operacion) return null;

  let puntos = 0;
  const motivos: string[] = [];

  if (b.tipos.length > 0) {
    if (!b.tipos.includes(p.tipo)) return null;
    puntos++;
    motivos.push(p.tipo);
  }

  if (b.barrios.length > 0) {
    if (!p.barrio || !b.barrios.includes(p.barrio)) return null;
    puntos++;
    motivos.push(p.barrio);
  }

  // El precio solo se compara cuando las dos puntas hablan la misma moneda:
  // comparar 120.000 dólares contra 500.000 pesos no significa nada.
  const precio = num(p.precio);
  const min = num(b.precioMin);
  const max = num(b.precioMax);

  if (precio !== null && b.moneda === p.moneda) {
    if (max !== null && precio > max) return null;
    if (min !== null && precio < min) return null;
    if (max !== null || min !== null) {
      puntos++;
      motivos.push("precio");
    }
  }

  if (b.dormitoriosMin !== null) {
    if ((p.dormitorios ?? 0) < b.dormitoriosMin) return null;
    puntos++;
    motivos.push(`${b.dormitoriosMin}+ dorm`);
  }

  if (b.cochera) {
    if (!p.cocheras) return null;
    puntos++;
    motivos.push("cochera");
  }

  return { puntos, motivos };
}

/** Las búsquedas activas que le calzan a una propiedad, de la más ajustada a la menos. */
export function compradoresPara(
  p: Propiedad,
  busquedas: (Busqueda & { contacto: Contacto })[],
): Coincidencia[] {
  const salida: Coincidencia[] = [];

  for (const b of busquedas) {
    if (!b.activa) continue;
    const r = evaluar(p, b);
    if (r) salida.push({ busqueda: b, ...r });
  }

  return salida.sort((a, b) => b.puntos - a.puntos);
}

/** Las propiedades que le calzan a una búsqueda. El mismo cruce, al revés. */
export function propiedadesPara(
  b: Busqueda,
  lista: Propiedad[],
): { propiedad: Propiedad; puntos: number; motivos: string[] }[] {
  const salida: { propiedad: Propiedad; puntos: number; motivos: string[] }[] = [];

  for (const p of lista) {
    const r = evaluar(p, b);
    if (r) salida.push({ propiedad: p, ...r });
  }

  return salida.sort((a, b) => b.puntos - a.puntos);
}

/** "Casa en Villa Italia, 3+ dorm" — lo que el comprador pidió, en una línea. */
export function describirBusqueda(b: Busqueda): string {
  const partes: string[] = [];

  if (b.tipos.length) partes.push(b.tipos.join(" o "));
  if (b.barrios.length) partes.push(`en ${b.barrios.join(", ")}`);
  if (b.dormitoriosMin) partes.push(`${b.dormitoriosMin}+ dorm`);
  if (b.cochera) partes.push("con cochera");

  const max = num(b.precioMax);
  if (max) {
    const fmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
    partes.push(`hasta ${b.moneda === "USD" ? "USD" : "$"} ${fmt.format(max)}`);
  }

  return partes.length ? partes.join(" · ") : "Sin criterios cargados";
}
