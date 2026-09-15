import { asc, inArray, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { propiedades, usuarios } from "@/db/schema";
import { FormNuevaConsulta } from "./FormNuevaConsulta";

/**
 * Carga los dos selectores en el servidor para que el formulario abra
 * instantáneo: la administrativa lo usa con el cliente al teléfono.
 */
export async function NuevaConsulta() {
  const [lista, vendedores] = await Promise.all([
    db
      .select({
        id: propiedades.id,
        codigo: propiedades.codigo,
        direccion: propiedades.direccion,
        barrio: propiedades.barrio,
      })
      .from(propiedades)
      .where(inArray(propiedades.estado, ["publicada", "reservada"]))
      .orderBy(asc(propiedades.codigo))
      .limit(500),
    db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(and(eq(usuarios.rol, "vendedor"), eq(usuarios.activo, true)))
      .orderBy(asc(usuarios.nombre)),
  ]);

  return <FormNuevaConsulta propiedades={lista} vendedores={vendedores} />;
}
