import "server-only";

/**
 * Reparto automático de consultas.
 *
 * La regla es una sola y se puede explicar en una frase: la consulta nueva va
 * a quien menos consultas abiertas tiene. Si empatan, a quien hace más tiempo
 * que no recibe una. Nada de puntajes ni pesos: si el equipo no entiende por
 * qué le tocó a quién, el reparto se discute en vez de usarse.
 */

import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { consultas, configuracion, usuarios } from "@/db/schema";

const ABIERTAS: ("no_atendido" | "contactado" | "recontactar")[] = [
  "no_atendido",
  "contactado",
  "recontactar",
];

export async function leerConfiguracion() {
  const [c] = await db
    .select()
    .from(configuracion)
    .where(eq(configuracion.id, 1))
    .limit(1);

  return { asignacionAutomatica: c?.asignacionAutomatica ?? false };
}

export type CargaVendedor = {
  id: number;
  nombre: string;
  recibeLeads: boolean;
  abiertas: number;
  ultimaAsignacion: Date | null;
};

/** Cuántas consultas abiertas tiene cada vendedor activo, y cuándo recibió la última. */
export async function cargaDelEquipo(): Promise<CargaVendedor[]> {
  // Tres consultas agrupadas y cruce en memoria: drizzle no califica bien las
  // columnas de una subconsulta correlacionada dentro del select.
  const [vendedores, abiertas, ultimas] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        recibeLeads: usuarios.recibeLeads,
      })
      .from(usuarios)
      .where(and(eq(usuarios.rol, "vendedor"), eq(usuarios.activo, true)))
      .orderBy(asc(usuarios.nombre)),
    db
      .select({ id: consultas.asignadaA, n: sql<number>`count(*)::int` })
      .from(consultas)
      .where(and(inArray(consultas.estado, ABIERTAS), isNotNull(consultas.asignadaA)))
      .groupBy(consultas.asignadaA),
    db
      .select({ id: consultas.asignadaA, ultima: sql<string>`max(${consultas.creadaAt})` })
      .from(consultas)
      .where(isNotNull(consultas.asignadaA))
      .groupBy(consultas.asignadaA),
  ]);

  const nAbiertas = new Map(abiertas.map((a) => [a.id, a.n]));
  const nUltima = new Map(ultimas.map((u) => [u.id, u.ultima]));

  return vendedores.map((v) => {
    const ultima = nUltima.get(v.id);
    return {
      ...v,
      abiertas: nAbiertas.get(v.id) ?? 0,
      ultimaAsignacion: ultima ? new Date(ultima) : null,
    };
  });
}

/** A quién le toca la próxima. Null si nadie está recibiendo consultas. */
export function aQuienLeToca(carga: CargaVendedor[]): CargaVendedor | null {
  const candidatos = carga.filter((v) => v.recibeLeads);
  if (candidatos.length === 0) return null;

  return [...candidatos].sort(
    (a, b) =>
      a.abiertas - b.abiertas ||
      (a.ultimaAsignacion?.getTime() ?? 0) - (b.ultimaAsignacion?.getTime() ?? 0),
  )[0];
}
