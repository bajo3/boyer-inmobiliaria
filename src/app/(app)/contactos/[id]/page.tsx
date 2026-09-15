import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactos, consultas, busquedas } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { mostrarTelefono } from "@/lib/telefono";
import { fechaHora, ETIQUETAS, precio as fmtPrecio } from "@/lib/formato";
import { evaluarConsulta } from "@/lib/sla";
import { Semaforo, Pastilla } from "@/components/Semaforo";
import { FormContacto } from "@/components/FormContacto";
import { FormBusqueda } from "@/components/FormBusqueda";

export default async function FichaContacto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirSesion();
  const { id } = await params;
  const contactoId = Number(id);
  if (!Number.isInteger(contactoId)) notFound();

  const contacto = await db.query.contactos.findFirst({
    where: eq(contactos.id, contactoId),
    with: { vendedor: true },
  });

  if (!contacto) notFound();

  const historial = await db.query.consultas.findMany({
    where: eq(consultas.contactoId, contactoId),
    with: { propiedad: true },
    orderBy: [desc(consultas.creadaAt)],
  });

  const [busqueda] = await db
    .select()
    .from(busquedas)
    .where(eq(busquedas.contactoId, contactoId))
    .limit(1);

  return (
    <div className="space-y-5">
      <Link
        href="/contactos"
        className="text-[13px] font-semibold text-muted hover:text-accent"
      >
        ← Volver a contactos
      </Link>

      <header className="tarjeta p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{contacto.nombre}</h1>
            <p className="mt-1 tnum text-[12.5px] text-muted">
              {mostrarTelefono(contacto.telefono)}
              {contacto.email ? ` · ${contacto.email}` : ""}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Pastilla>{contacto.tipo}</Pastilla>
            <Pastilla>llegó por {ETIQUETAS.canal[contacto.origen]}</Pastilla>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="tarjeta p-4">
          <h2 className="mb-3 rotulo">
            Historial · {historial.length} consulta{historial.length === 1 ? "" : "s"}
          </h2>

          {historial.length === 0 ? (
            <p className="text-sm text-muted">Sin consultas registradas.</p>
          ) : (
            <ul className="space-y-1">
              {historial.map((c) => {
                const s = evaluarConsulta(c);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/consultas/${c.id}`}
                      className="flex items-center justify-between gap-3 tarjeta-i px-3.5 py-2.5 hover:border-accent-border"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {c.propiedad
                            ? `${c.propiedad.codigo} · ${c.propiedad.direccion}`
                            : "Consulta general"}
                        </span>
                        <span className="block tnum text-[12px] text-faint">
                          {ETIQUETAS.canal[c.canal]} · {fechaHora(c.creadaAt)}
                          {c.propiedad
                            ? ` · ${fmtPrecio(c.propiedad.precio, c.propiedad.moneda)}`
                            : ""}
                        </span>
                      </span>
                      <Semaforo nivel={s.nivel}>{s.etiqueta}</Semaforo>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <FormBusqueda contactoId={contacto.id} busqueda={busqueda ?? null} />
          <FormContacto contacto={contacto} />
        </aside>
      </div>
    </div>
  );
}
