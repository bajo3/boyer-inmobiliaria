import { sql } from "drizzle-orm";
import { db } from "@/db";
import { propiedades } from "@/db/schema";

export const PREFIJO = "BOY";

/**
 * Siguiente código correlativo: BOY-0001, BOY-0002…
 * Se calcula sobre el máximo existente, así que tolera códigos cargados a mano.
 */
export async function siguienteCodigo(): Promise<string> {
  const [fila] = await db
    .select({
      max: sql<number>`coalesce(max(nullif(regexp_replace(${propiedades.codigo}, '\\D', '', 'g'), '')::int), 0)`,
    })
    .from(propiedades);

  const n = (fila?.max ?? 0) + 1;
  return `${PREFIJO}-${String(n).padStart(4, "0")}`;
}
