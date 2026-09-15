import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { crearPropiedad } from "@/actions/propiedades";
import { FormPropiedad } from "@/components/FormPropiedad";

export default async function NuevaPropiedad() {
  await requerirSesion();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/propiedades"
        className="text-[13px] font-semibold text-muted hover:text-accent"
      >
        ← Volver a propiedades
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight">Nueva propiedad</h1>
        <p className="mt-0.5 text-sm text-muted">
          El código se asigna solo. Solo tipo, operación y dirección son
          obligatorios.
        </p>
      </div>

      <FormPropiedad accion={crearPropiedad} textoBoton="Crear propiedad" />
    </div>
  );
}
