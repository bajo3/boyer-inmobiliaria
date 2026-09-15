import Link from "next/link";
import { and, asc, desc, eq, gte, lte, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { visitas, propiedades, consultas, autorizaciones } from "@/db/schema";
import { precio as fmtPrecio, fechaHora, fecha as fmtFecha } from "@/lib/formato";
import { mostrarTelefono } from "@/lib/telefono";
import { AGENCIA, TELEFONOS_PUBLICADOS, COMISION_PCT } from "@/lib/agencia";
import { Punto } from "@/components/Semaforo";

const HOY_FIN = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * La columna derecha de la bandeja en escritorio.
 *
 * No es relleno: son las tres cosas que en una inmobiliaria chica se pierden
 * si nadie las mira —la agenda del día, la cartera que dejó de moverse y las
 * autorizaciones que vencen— más el problema de datos que hoy tiene la
 * inmobiliaria de verdad.
 */
export async function ResumenDia() {
  const ahora = new Date();
  const hace30 = new Date(Date.now() - 30 * 86_400_000);
  const en30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [hoy, publicadas, conConsultas, ultimas, porVencer, pipelineRows] =
    await Promise.all([
      db.query.visitas.findMany({
        where: and(gte(visitas.fechaHora, ahora), lte(visitas.fechaHora, HOY_FIN())),
        with: { contacto: true, propiedad: true },
        orderBy: [asc(visitas.fechaHora)],
      }),
      db
        .select({ id: propiedades.id })
        .from(propiedades)
        .where(eq(propiedades.estado, "publicada")),
      db
        .selectDistinct({ propiedadId: consultas.propiedadId })
        .from(consultas)
        .where(gte(consultas.creadaAt, hace30)),
      // Las que más tiempo llevan sin que nadie pregunte.
      db
        .select({
          id: propiedades.id,
          codigo: propiedades.codigo,
          direccion: propiedades.direccion,
          creadoAt: propiedades.creadoAt,
          ultima: sql<string | null>`max(${consultas.creadaAt})`,
        })
        .from(propiedades)
        .leftJoin(consultas, eq(consultas.propiedadId, propiedades.id))
        .where(eq(propiedades.estado, "publicada"))
        .groupBy(propiedades.id)
        // Las que nunca tuvieron consulta primero: son el silencio más largo.
        .orderBy(sql`max(${consultas.creadaAt}) asc nulls first`)
        .limit(3),
      db
        .select({
          id: autorizaciones.id,
          hasta: autorizaciones.hasta,
          codigo: propiedades.codigo,
          direccion: propiedades.direccion,
          propiedadId: propiedades.id,
        })
        .from(autorizaciones)
        .innerJoin(propiedades, eq(propiedades.id, autorizaciones.propiedadId))
        .where(lte(autorizaciones.hasta, en30))
        .orderBy(asc(autorizaciones.hasta))
        .limit(3),
      db
        .select({ precio: propiedades.precio })
        .from(consultas)
        .innerJoin(propiedades, eq(propiedades.id, consultas.propiedadId))
        .where(
          and(
            inArray(consultas.estado, ["contactado", "recontactar"]),
            eq(propiedades.moneda, "USD"),
          ),
        ),
    ]);

  const conMovimiento = new Set(conConsultas.map((c) => c.propiedadId));
  const quietas = publicadas.filter((p) => !conMovimiento.has(p.id)).length;

  const pipeline = pipelineRows.reduce((a, r) => a + Number(r.precio ?? 0), 0);
  const comision = (pipeline * COMISION_PCT) / 100;

  const dias = (desde: Date | string) =>
    Math.max(
      0,
      Math.round((Date.now() - new Date(desde).getTime()) / 86_400_000),
    );

  return (
    <aside className="flex flex-col gap-4">
      {/* En la cancha */}
      <section className="tarjeta bg-accent-soft! border-accent-border! p-5">
        <p className="rotulo text-accent-deep!">En la cancha</p>
        <p className="tnum mt-2 font-display text-[34px] font-extrabold tracking-[-.03em] text-accent-deep">
          {fmtPrecio(pipeline, "USD")}
        </p>
        <p className="mt-1.5 text-[13px] text-ink-2">
          {pipelineRows.length}{" "}
          {pipelineRows.length === 1 ? "consulta activa" : "consultas activas"} en
          seguimiento. Comisión estimada al {COMISION_PCT} %:{" "}
          <strong className="tnum">{fmtPrecio(comision, "USD")}</strong>.
        </p>
      </section>

      {/* Agenda de hoy */}
      <section className="tarjeta p-5">
        <h2 className="font-display text-[17.5px] font-bold">Hoy</h2>
        {hoy.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-muted">
            No hay visitas agendadas para hoy. La oficina atiende{" "}
            {AGENCIA.horario.toLowerCase()}.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {hoy.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/propiedades/${v.propiedad.id}`}
                  className="flex items-center gap-2.5 rounded-[13px] bg-surface-2 px-3.5 py-2.5 hover:bg-accent-soft"
                >
                  <span className="tnum flex-none text-[13px] font-bold text-accent">
                    {fechaHora(v.fechaHora).split(",").pop()?.trim()}
                  </span>
                  <span className="recorte flex-1 text-[13.5px]">
                    {v.contacto.nombre} · {v.propiedad.direccion}
                  </span>
                  <span className="tnum flex-none text-[12px] text-muted">
                    {mostrarTelefono(v.contacto.telefono)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cartera quieta */}
      <section className="tarjeta border-[var(--warn-border)]! bg-[#fffdf7]! p-5">
        <h2 className="font-display text-[17.5px] font-bold">
          Cartera que no mueve nadie
        </h2>
        <div className="mt-2.5 flex items-baseline gap-2.5">
          <span className="tnum font-display text-[44px] font-extrabold leading-none text-warn">
            {quietas}
          </span>
          <span className="text-[14px] text-ink-2">
            de {publicadas.length} publicadas, sin una sola consulta en 30 días
          </span>
        </div>

        {ultimas.length > 0 && (
          <ul className="mt-3.5 flex flex-col gap-1.5 text-[13px]">
            {ultimas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/propiedades/${p.id}`}
                  className="flex items-center justify-between gap-3 hover:text-accent"
                >
                  <span className="recorte text-ink-2">
                    <span className="tnum font-semibold text-accent">{p.codigo}</span>{" "}
                    {p.direccion}
                  </span>
                  <span className="tnum flex-none text-faint">
                    {p.ultima
                      ? `hace ${dias(p.ultima)} d`
                      : `nunca · ${dias(p.creadoAt)} d`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Autorizaciones */}
      {porVencer.length > 0 && (
        <section className="tarjeta p-5">
          <h2 className="font-display text-[17.5px] font-bold">Vencen pronto</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {porVencer.map((a) => {
              const d = Math.ceil(
                (new Date(a.hasta).getTime() - Date.now()) / 86_400_000,
              );
              return (
                <li key={a.id}>
                  <Link
                    href={`/propiedades/${a.propiedadId}`}
                    className={`flex items-center gap-2.5 rounded-[13px] px-3.5 py-2.5 ${
                      d < 0 ? "bg-crit-bg" : d <= 15 ? "bg-warn-bg" : "bg-sunken"
                    }`}
                  >
                    <Punto nivel={d < 0 ? "crit" : d <= 15 ? "warn" : "neutral"} />
                    <span className="recorte flex-1 text-[13.5px] text-ink-2">
                      Autorización {a.codigo} · {a.direccion}
                    </span>
                    <span
                      className={`tnum flex-none text-[13px] font-bold ${
                        d < 0 ? "text-crit" : d <= 15 ? "text-warn" : "text-ink-2"
                      }`}
                    >
                      {d < 0 ? `venció ${fmtFecha(a.hasta)}` : `en ${d} días`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Problema de datos real, del relevamiento de septiembre 2026. */}
      <section className="tarjeta border-[var(--warn-border)]! p-5">
        <h2 className="font-display text-[17.5px] font-bold">
          Hay tres teléfonos publicados
        </h2>
        <p className="mt-1.5 text-[13px] text-muted">
          Según dónde mire el cliente, escribe a un número distinto. Hasta definir
          cuál es el oficial, no se sabe cuántas consultas llegan a cada uno.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {TELEFONOS_PUBLICADOS.map((t) => (
            <li
              key={t.numero}
              className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]"
            >
              <span className="tnum font-semibold">{t.numero}</span>
              <span className="text-faint">{t.fuente}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
