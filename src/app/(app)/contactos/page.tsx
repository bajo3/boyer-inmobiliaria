import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactos, consultas } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { mostrarTelefono } from "@/lib/telefono";
import { fecha as fmtFecha, ETIQUETAS } from "@/lib/formato";
import { Pastilla } from "@/components/Semaforo";

export default async function Contactos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requerirSesion();
  const { q } = await searchParams;

  // Dos consultas y cruce en memoria: drizzle no califica las columnas dentro
  // de `sql` en la lista de select, así que una subconsulta correlacionada acá
  // devuelve cualquier cosa. Ver la nota en /propiedades.
  const [lista, conteos] = await Promise.all([
    db.select().from(contactos).orderBy(desc(contactos.creadoAt)).limit(1000),
    db
      .select({ contactoId: consultas.contactoId, n: sql<number>`count(*)::int` })
      .from(consultas)
      .groupBy(consultas.contactoId),
  ]);

  const porContacto = new Map(conteos.map((c) => [c.contactoId, c.n]));

  const filas = lista.map((c) => ({ c, total: porContacto.get(c.id) ?? 0 }));

  const termino = q?.trim().toLowerCase() ?? "";

  const visibles = termino
    ? filas.filter(({ c }) =>
        [c.nombre, c.telefono, c.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termino)),
      )
    : filas;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Contactos</h1>
        <p className="mt-0.5 text-sm text-muted">
          {filas.length} personas. Se crean solos al cargar una consulta.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          className="campo max-w-xs"
          placeholder="Buscar por nombre, teléfono o email"
          aria-label="Buscar contactos"
        />
        <button type="submit" className="btn btn-neutro">
          Buscar
        </button>
      </form>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          No hay contactos que coincidan.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {visibles.map(({ c, total }) => (
            <li key={c.id}>
              <Link
                href={`/contactos/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 tarjeta px-3.5 py-3 hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.nombre}</p>
                  <p className="truncate tnum text-[12px] text-muted">
                    {mostrarTelefono(c.telefono)}
                    {c.email ? ` · ${c.email}` : ""}
                    {" · alta "}
                    {fmtFecha(c.creadoAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pastilla>{c.tipo}</Pastilla>
                  <Pastilla>
                    {ETIQUETAS.canal[c.origen] ?? c.origen}
                  </Pastilla>
                  <Pastilla>
                    {total} consulta{total === 1 ? "" : "s"}
                  </Pastilla>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
