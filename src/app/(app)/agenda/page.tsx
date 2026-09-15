import Link from "next/link";
import { asc, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { visitas } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { fechaHora, ETIQUETAS, precio as fmtPrecio } from "@/lib/formato";
import { mostrarTelefono } from "@/lib/telefono";
import { Pastilla } from "@/components/Semaforo";

export default async function Agenda() {
  await requerirSesion();

  const proximas = await db.query.visitas.findMany({
    where: gte(visitas.fechaHora, sql`now() - interval '1 day'`),
    with: { propiedad: true, contacto: true, vendedor: true },
    orderBy: [asc(visitas.fechaHora)],
    limit: 100,
  });

  // Agrupadas por día para que se lea como una agenda y no como una lista.
  const porDia = new Map<string, typeof proximas>();
  const fmtDia = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  for (const v of proximas) {
    const clave = fmtDia.format(v.fechaHora);
    porDia.set(clave, [...(porDia.get(clave) ?? []), v]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Agenda</h1>
        <p className="mt-0.5 text-sm text-muted">
          {proximas.length} visita{proximas.length === 1 ? "" : "s"} de acá en
          adelante.
        </p>
      </div>

      {porDia.size === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          No hay visitas agendadas. Se agendan desde la ficha de cada consulta.
        </p>
      ) : (
        <div className="space-y-5">
          {[...porDia.entries()].map(([dia, lista]) => (
            <section key={dia}>
              <h2 className="mb-2 rotulo">
                {dia}
              </h2>
              <ul className="space-y-1.5">
                {lista.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 tarjeta px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {fechaHora(v.fechaHora).split(",").pop()?.trim()} ·{" "}
                        {v.contacto.nombre}
                      </p>
                      <p className="truncate tnum text-[12px] text-muted">
                        {v.propiedad.codigo} · {v.propiedad.direccion}
                        {" · "}
                        {fmtPrecio(v.propiedad.precio, v.propiedad.moneda)}
                        {" · "}
                        {mostrarTelefono(v.contacto.telefono)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pastilla>{v.estado}</Pastilla>
                      {v.vendedor && (
                        <Pastilla>{v.vendedor.nombre.split(" ")[0]}</Pastilla>
                      )}
                      <Link
                        href={`/propiedades/${v.propiedad.id}`}
                        className="text-[12.5px] font-semibold text-accent hover:underline"
                      >
                        Ver
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
