import { asc, inArray, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { propiedades, usuarios, type Consulta, type Usuario } from "@/db/schema";
import { puedeAdministrar } from "@/lib/auth";
import { PanelCorreccion } from "./PanelCorreccion";

/**
 * Corregir, reasignar y borrar. Solo para administrativa y titular: el vendedor
 * trabaja la consulta, no la administra.
 */
export async function ControlesConsulta({
  consulta,
  usuario,
}: {
  consulta: Consulta;
  usuario: Usuario;
}) {
  if (!puedeAdministrar(usuario)) return null;

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

  return (
    <PanelCorreccion
      consultaId={consulta.id}
      canal={consulta.canal}
      propiedadId={consulta.propiedadId}
      mensaje={consulta.mensajeOriginal}
      asignadaA={consulta.asignadaA}
      propiedades={lista}
      vendedores={vendedores}
    />
  );
}
