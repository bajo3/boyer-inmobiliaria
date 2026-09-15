import Link from "next/link";
import { sql, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { propiedades, consultas } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { precio as fmtPrecio, ETIQUETAS, numero } from "@/lib/formato";
import { AGENCIA } from "@/lib/agencia";

const ESTILO_ESTADO: Record<string, string> = {
  publicada: "bg-ok-bg text-ok",
  reservada: "bg-warn-bg text-warn",
  vendida: "bg-accent-soft text-[var(--accent-hover)]",
  suspendida: "bg-sunken text-muted",
  borrador: "bg-sunken text-muted",
};

export default async function Propiedades({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  await requerirSesion();
  const { q, estado } = await searchParams;

  const hace30 = new Date(Date.now() - 30 * 86_400_000);

  // Dos consultas y cruce en memoria: drizzle no califica las columnas dentro
  // de `sql` en la lista de select, así que una subconsulta correlacionada acá
  // devuelve cualquier cosa.
  const [lista, conteos, ultimas] = await Promise.all([
    db.select().from(propiedades).orderBy(asc(propiedades.codigo)).limit(1000),
    db
      .select({ propiedadId: consultas.propiedadId, n: sql<number>`count(*)::int` })
      .from(consultas)
      .where(gte(consultas.creadaAt, hace30))
      .groupBy(consultas.propiedadId),
    db
      .select({
        propiedadId: consultas.propiedadId,
        ultima: sql<string>`max(${consultas.creadaAt})`,
      })
      .from(consultas)
      .groupBy(consultas.propiedadId),
  ]);

  const porPropiedad = new Map(
    conteos.filter((c) => c.propiedadId !== null).map((c) => [c.propiedadId!, c.n]),
  );
  const ultimaPorPropiedad = new Map(
    ultimas.filter((u) => u.propiedadId !== null).map((u) => [u.propiedadId!, u.ultima]),
  );

  const filas = lista.map((p) => {
    const ultima = ultimaPorPropiedad.get(p.id);
    return {
      p,
      consultas30: porPropiedad.get(p.id) ?? 0,
      // Días desde que alguien preguntó por última vez. Si nunca preguntaron,
      // se cuenta desde que se cargó: es el mismo silencio.
      diasQuieta: Math.max(
        0,
        Math.round(
          (Date.now() - new Date(ultima ?? p.creadoAt).getTime()) / 86_400_000,
        ),
      ),
      nunca: !ultima,
    };
  });

  const termino = q?.trim().toLowerCase() ?? "";

  const visibles = filas.filter(({ p }) => {
    if (estado && estado !== "todas" && p.estado !== estado) return false;
    if (!termino) return true;
    return [p.codigo, p.direccion, p.barrio, ETIQUETAS.tipoPropiedad[p.tipo]]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(termino));
  });

  const quietas = filas.filter(
    ({ p, consultas30 }) => p.estado === "publicada" && consultas30 === 0,
  ).length;

  const valorCartera = filas
    .filter(({ p }) => p.estado === "publicada" && p.moneda === "USD")
    .reduce((a, { p }) => a + Number(p.precio ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-extrabold">Propiedades</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {filas.length} en cartera ·{" "}
            <span className="tnum">{fmtPrecio(valorCartera, "USD")}</span> publicados ·
            consultas de los últimos 30 días
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {quietas > 0 && (
            <span className="flex items-center gap-2 rounded-[12px] border border-[var(--warn-border)] bg-warn-bg px-3.5 py-2.5 text-[13px] text-warn">
              <span className="size-2 flex-none rounded-full bg-[var(--warn-solid)]" />
              {quietas} sin consultas
            </span>
          )}
          <Link href="/propiedades/nueva" className="btn btn-primario">
            + Nueva propiedad
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          className="campo max-w-xs"
          placeholder="Buscar por código, calle o barrio"
          aria-label="Buscar propiedades"
        />
        <select
          name="estado"
          defaultValue={estado ?? "todas"}
          className="campo w-auto"
          aria-label="Filtrar por estado"
        >
          <option value="todas">Todos los estados</option>
          {Object.entries(ETIQUETAS.estadoPropiedad).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-neutro">
          Filtrar
        </button>
      </form>

      {visibles.length === 0 ? (
        <p className="tarjeta px-5 py-12 text-center text-[13.5px] text-muted">
          No hay propiedades que coincidan.
        </p>
      ) : (
        <>
          {/* Escritorio: tabla. Con 37 filas y 9 columnas, es lo que mejor usa
              el ancho y lo más rápido de comparar. */}
          <div className="tarjeta hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  {[
                    ["Código", "left"],
                    ["Estado", "left"],
                    ["Dirección", "left"],
                    ["Barrio", "left"],
                    ["Dorm.", "right"],
                    ["m²", "right"],
                    ["Precio", "right"],
                    ["Consultas 30 d", "right"],
                    ["Sin movimiento", "right"],
                  ].map(([t, al]) => (
                    <th
                      key={t}
                      className={`rotulo px-3 py-3.5 first:pl-5 last:pr-5 ${
                        al === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ p, consultas30, diasQuieta, nunca }) => (
                  <tr
                    key={p.id}
                    className="border-t border-line-soft transition-colors hover:bg-surface-2"
                  >
                    <td className="tnum whitespace-nowrap py-3.5 pl-5 pr-3 text-[13.5px] font-semibold text-accent">
                      <Link href={`/propiedades/${p.id}`}>{p.codigo}</Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-[3px] text-[11.5px] font-bold ${
                          ESTILO_ESTADO[p.estado] ?? "bg-sunken text-muted"
                        }`}
                      >
                        {ETIQUETAS.estadoPropiedad[p.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <Link
                        href={`/propiedades/${p.id}`}
                        className="text-[14px] font-medium hover:text-accent"
                      >
                        {p.direccion}
                      </Link>
                      <span className="block text-[12px] text-faint">
                        {ETIQUETAS.tipoPropiedad[p.tipo]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-[13.5px] text-ink-2">
                      {p.barrio ?? "—"}
                    </td>
                    <td className="tnum px-3 py-3.5 text-right text-[13.5px] text-ink-2">
                      {p.dormitorios ?? "—"}
                    </td>
                    <td className="tnum px-3 py-3.5 text-right text-[13.5px] text-ink-2">
                      {numero(p.m2Totales)}
                    </td>
                    <td className="tnum whitespace-nowrap px-3 py-3.5 text-right text-[14px] font-semibold">
                      {fmtPrecio(p.precio, p.moneda)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span
                        className={`tnum inline-flex min-w-7 justify-center rounded-full px-2 py-[3px] text-[12.5px] font-bold ${
                          consultas30 === 0
                            ? "bg-sunken text-faint"
                            : "bg-accent-soft text-[var(--accent-hover)]"
                        }`}
                      >
                        {consultas30}
                      </span>
                    </td>
                    <td
                      className={`tnum whitespace-nowrap py-3.5 pl-3 pr-5 text-right text-[13px] ${
                        diasQuieta >= 60
                          ? "font-semibold text-warn"
                          : "text-faint"
                      }`}
                    >
                      {nunca ? `nunca · ${diasQuieta} d` : `${diasQuieta} d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: tarjetas. */}
          <ul className="flex flex-col gap-2 lg:hidden">
            {visibles.map(({ p, consultas30, diasQuieta }) => (
              <li key={p.id}>
                <Link href={`/propiedades/${p.id}`} className="tarjeta block p-4">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-[12px] font-semibold text-accent">
                      {p.codigo}
                    </span>
                    <span
                      className={`rounded-full px-2 py-[2px] text-[11px] font-bold ${
                        ESTILO_ESTADO[p.estado] ?? "bg-sunken text-muted"
                      }`}
                    >
                      {ETIQUETAS.estadoPropiedad[p.estado]}
                    </span>
                    <span
                      className={`tnum ml-auto rounded-full px-2 py-[2px] text-[11.5px] font-bold ${
                        consultas30 === 0
                          ? "bg-sunken text-faint"
                          : "bg-accent-soft text-[var(--accent-hover)]"
                      }`}
                    >
                      {consultas30} / 30 d
                    </span>
                  </span>

                  <span className="mt-1.5 block text-[15px] font-semibold">
                    {p.direccion}
                  </span>
                  <span className="tnum block text-[12.5px] text-muted">
                    {ETIQUETAS.tipoPropiedad[p.tipo]}
                    {p.barrio ? ` · ${p.barrio}` : ""}
                    {p.dormitorios ? ` · ${p.dormitorios} dorm` : ""}
                    {p.m2Totales ? ` · ${numero(p.m2Totales)} m²` : ""}
                  </span>

                  <span className="mt-2 flex items-baseline justify-between gap-3">
                    <span className="tnum font-display text-[19px] font-extrabold text-accent-deep">
                      {fmtPrecio(p.precio, p.moneda)}
                    </span>
                    <span
                      className={`tnum text-[12px] ${
                        diasQuieta >= 60 ? "font-semibold text-warn" : "text-faint"
                      }`}
                    >
                      {diasQuieta} d sin movimiento
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="px-1 text-[11.5px] text-faint">
        Inventario relevado de la publicación en Zonaprop de {AGENCIA.nombre}.
      </p>
    </div>
  );
}
