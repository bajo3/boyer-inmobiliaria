import Link from "next/link";
import { sql, gte, lte, eq, inArray, isNotNull, and } from "drizzle-orm";
import { db } from "@/db";
import { consultas, propiedades, autorizaciones, visitas } from "@/db/schema";
import { requerirTitular } from "@/lib/auth";
import { evaluarConsulta, horasHabilesEntre } from "@/lib/sla";
import { precio as fmtPrecio, fecha as fmtFecha, ETIQUETAS } from "@/lib/formato";
import { COMISION_PCT, TELEFONOS_PUBLICADOS } from "@/lib/agencia";
import { Punto } from "@/components/Semaforo";

const ABIERTAS: ("no_atendido" | "contactado" | "recontactar")[] = [
  "no_atendido",
  "contactado",
  "recontactar",
];

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

function Barra({
  etiqueta,
  valor,
  max,
  tono = "accent",
}: {
  etiqueta: string;
  valor: number;
  max: number;
  tono?: "accent" | "crit" | "ok";
}) {
  const pct = max > 0 ? Math.max(2, (valor / max) * 100) : 0;
  const color =
    tono === "crit"
      ? "bg-[var(--crit-solid)]"
      : tono === "ok"
        ? "bg-[var(--ok-solid)]"
        : "bg-accent";

  return (
    <div className="flex items-center gap-3">
      <span className="w-[84px] flex-none text-[13px] text-ink-2">{etiqueta}</span>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-sunken">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tnum w-7 flex-none text-right text-[13px] font-semibold">
        {valor}
      </span>
    </div>
  );
}

function Tarjeta({
  pregunta,
  nota,
  children,
  tono = "normal",
  ancha = false,
}: {
  pregunta: string;
  nota?: string;
  children: React.ReactNode;
  tono?: "normal" | "warn";
  ancha?: boolean;
}) {
  return (
    <section
      className={`tarjeta p-5 ${ancha ? "sm:col-span-2 xl:col-span-3" : ""} ${
        tono === "warn" ? "border-[var(--warn-border)]! bg-[#fffdf7]!" : ""
      }`}
    >
      <h2 className="font-display text-[17.5px] font-bold">{pregunta}</h2>
      {nota && <p className="mt-1 text-[12.5px] text-muted">{nota}</p>}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export default async function Panel() {
  await requerirTitular();

  const desde30 = new Date(Date.now() - 30 * 86_400_000);
  const desde90 = new Date(Date.now() - 90 * 86_400_000);
  const en30Dias = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const en7Dias = new Date(Date.now() + 7 * 86_400_000);

  /* 1 — atención ahora mismo */
  const abiertas = await db.query.consultas.findMany({
    where: inArray(consultas.estado, ABIERTAS),
    with: { contacto: true, vendedor: true },
    limit: 500,
  });

  const enRojo = abiertas
    .map((c) => ({ c, s: evaluarConsulta(c) }))
    .filter((x) => x.s.nivel === "crit");
  const sinResponder = abiertas.filter((c) => !c.primeraRespuestaAt);
  const venceHoy = abiertas
    .map((c) => evaluarConsulta(c))
    .filter((s) => s.nivel === "warn").length;

  const respondidas = await db
    .select({
      creadaAt: consultas.creadaAt,
      primeraRespuestaAt: consultas.primeraRespuestaAt,
    })
    .from(consultas)
    .where(
      and(gte(consultas.creadaAt, desde30), isNotNull(consultas.primeraRespuestaAt)),
    );

  const mediaRespuesta = respondidas.length
    ? respondidas.reduce(
        (acc, c) => acc + horasHabilesEntre(c.creadaAt, c.primeraRespuestaAt!),
        0,
      ) / respondidas.length
    : null;

  /* 2 — de dónde vienen */
  const porCanal = await db
    .select({ canal: consultas.canal, n: sql<number>`count(*)::int` })
    .from(consultas)
    .where(gte(consultas.creadaAt, desde30))
    .groupBy(consultas.canal)
    .orderBy(sql`count(*) desc`);

  /* 3 — propiedades que no mueve nadie */
  const [publicadasIds, conConsultas, masQuietas] = await Promise.all([
    db
      .select({ id: propiedades.id })
      .from(propiedades)
      .where(eq(propiedades.estado, "publicada")),
    db
      .selectDistinct({ propiedadId: consultas.propiedadId })
      .from(consultas)
      .where(gte(consultas.creadaAt, desde30)),
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
      .orderBy(sql`max(${consultas.creadaAt}) asc nulls first`)
      .limit(3),
  ]);

  const conMovimiento = new Set(conConsultas.map((c) => c.propiedadId));
  const publicadas = publicadasIds.length;
  const muertas = publicadasIds.filter((p) => !conMovimiento.has(p.id)).length;

  /* 4 — embudo */
  const [embudo] = await db
    .select({
      consultas: sql<number>`count(*)::int`,
      contactadas: sql<number>`count(*) filter (where ${consultas.primeraRespuestaAt} is not null)::int`,
      enSeguimiento: sql<number>`count(*) filter (where ${consultas.estado} in ('recontactar','ganado'))::int`,
      ganadas: sql<number>`count(*) filter (where ${consultas.estado} = 'ganado')::int`,
    })
    .from(consultas)
    .where(gte(consultas.creadaAt, desde90));

  /* 5 — por qué se pierden */
  const porMotivo = await db
    .select({ motivo: consultas.motivoRechazo, n: sql<number>`count(*)::int` })
    .from(consultas)
    .where(and(isNotNull(consultas.motivoRechazo), gte(consultas.creadaAt, desde90)))
    .groupBy(consultas.motivoRechazo)
    .orderBy(sql`count(*) desc`);

  /* 6 — vencimientos y pipeline */
  const [porVencer, pipelineRows, visitasSemanaRows] = await Promise.all([
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
      .where(lte(autorizaciones.hasta, en30Dias))
      .orderBy(autorizaciones.hasta)
      .limit(8),
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
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(visitas)
      .where(and(gte(visitas.fechaHora, new Date()), lte(visitas.fechaHora, en7Dias))),
  ]);

  const pipeline = pipelineRows.reduce((a, r) => a + Number(r.precio ?? 0), 0);
  const comision = (pipeline * COMISION_PCT) / 100;
  const visitasSemana = visitasSemanaRows[0]?.n ?? 0;

  const maxCanal = Math.max(1, ...porCanal.map((c) => c.n));
  const maxMotivo = Math.max(1, ...porMotivo.map((m) => m.n));

  const dias = (d: Date | string) =>
    Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86_400_000));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[30px] font-extrabold">Panel de María Paz</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          {(() => {
            const s = FECHA_LARGA.format(new Date()).replace(",", "");
            return s.charAt(0).toUpperCase() + s.slice(1);
          })()}{" "}
          · últimos 30 días
        </p>
      </div>

      {/* Lo urgente, solo y arriba. */}
      <section
        className={`tarjeta flex flex-wrap items-center gap-6 border-l-[6px]! p-6 ${
          enRojo.length > 0
            ? "border-[var(--crit-border)]! border-l-[var(--crit-solid)]!"
            : "border-[var(--ok-border)]! border-l-[var(--ok-solid)]!"
        }`}
      >
        <div className="min-w-[250px] flex-1">
          <p
            className={`flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[.06em] ${
              enRojo.length > 0 ? "text-crit" : "text-ok"
            }`}
          >
            <span
              className={`size-[9px] rounded-full ${
                enRojo.length > 0
                  ? "latido bg-[var(--crit-solid)]"
                  : "bg-[var(--ok-solid)]"
              }`}
            />
            En vivo
          </p>
          <h2 className="mt-1.5 font-display text-[23px] font-extrabold">
            ¿Hay alguien esperando respuesta ahora mismo?
          </h2>
          <p className="mt-1.5 text-[14px] text-ink-2">
            {enRojo.length === 0 ? (
              <>
                Nadie. Media de primera respuesta:{" "}
                {mediaRespuesta !== null
                  ? mediaRespuesta < 1
                    ? `${Math.round(mediaRespuesta * 60)} min`
                    : `${mediaRespuesta.toFixed(1)} h hábiles`
                  : "sin datos todavía"}
                . {visitasSemana} visita{visitasSemana === 1 ? "" : "s"} esta semana.
              </>
            ) : (
              <>
                {enRojo
                  .slice(0, 3)
                  .map((x) => `${x.c.contacto.nombre} (${x.s.etiqueta.toLowerCase()})`)
                  .join(", ")}
                {enRojo.length > 3 ? ` y ${enRojo.length - 3} más` : ""}.
              </>
            )}
          </p>
        </div>

        <div className="flex items-end gap-7">
          <div>
            <p className="tnum font-display text-[54px] font-extrabold leading-none text-crit">
              {sinResponder.length}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">sin primera respuesta</p>
          </div>
          <div>
            <p className="tnum font-display text-[54px] font-extrabold leading-none text-warn">
              {venceHoy}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">por vencer hoy</p>
          </div>
        </div>

        {enRojo.length > 0 && (
          <Link href="/?f=todas" className="btn btn-primario">
            Ver la bandeja
          </Link>
        )}
      </section>

      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tarjeta
          pregunta="¿De dónde vienen las consultas?"
          nota={`${porCanal.reduce((a, c) => a + c.n, 0)} consultas en 30 días`}
        >
          {porCanal.length === 0 ? (
            <p className="text-[13.5px] text-muted">Sin consultas en 30 días.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {porCanal.map((c) => (
                <Barra
                  key={c.canal}
                  etiqueta={ETIQUETAS.canal[c.canal] ?? c.canal}
                  valor={c.n}
                  max={maxCanal}
                />
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta pregunta="¿Qué propiedades no mueve nadie?" tono="warn">
          <div className="flex items-baseline gap-2.5">
            <span className="tnum font-display text-[50px] font-extrabold leading-none text-warn">
              {muertas}
            </span>
            <span className="text-[14px] text-ink-2">
              de {publicadas} sin una sola consulta en 30 días
            </span>
          </div>
          <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-[#f3ebd8]">
            <div
              className="h-full bg-[var(--warn-solid)]"
              style={{ width: `${publicadas ? (muertas / publicadas) * 100 : 0}%` }}
            />
          </div>
          <ul className="mt-3.5 flex flex-col gap-1.5 text-[13px]">
            {masQuietas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/propiedades/${p.id}`}
                  className="flex items-center justify-between gap-3 text-ink-2 hover:text-accent"
                >
                  <span className="recorte">
                    <span className="tnum font-semibold text-accent">{p.codigo}</span>{" "}
                    {p.direccion}
                  </span>
                  <span className="tnum flex-none text-faint">
                    {dias(p.ultima ?? p.creadoAt)} días
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta pregunta="¿Dónde se cae el embudo?" nota="Últimos 90 días">
          {embudo && embudo.consultas > 0 ? (
            <div className="flex flex-col gap-2.5">
              <Barra etiqueta="Consultas" valor={embudo.consultas} max={embudo.consultas} />
              <Barra
                etiqueta="Contactadas"
                valor={embudo.contactadas}
                max={embudo.consultas}
              />
              <Barra
                etiqueta="En seguimiento"
                valor={embudo.enSeguimiento}
                max={embudo.consultas}
              />
              <Barra
                etiqueta="Cerraron"
                valor={embudo.ganadas}
                max={embudo.consultas}
                tono="ok"
              />
              <p className="mt-1 text-[12.5px] text-muted">
                Muchas consultas y pocas visitas: el problema es la atención. Muchas
                visitas sin ofertas: son los precios.
              </p>
            </div>
          ) : (
            <p className="text-[13.5px] text-muted">Sin consultas en 90 días.</p>
          )}
        </Tarjeta>

        <Tarjeta
          pregunta="¿Por qué se pierden los clientes?"
          nota={`${porMotivo.reduce((a, m) => a + m.n, 0)} consultas cerradas`}
        >
          {porMotivo.length === 0 ? (
            <p className="text-[13.5px] text-muted">
              Todavía no se cerró ninguna consulta con motivo.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {porMotivo.map((m) => (
                <Barra
                  key={m.motivo}
                  etiqueta={ETIQUETAS.motivoRechazo[m.motivo!] ?? m.motivo!}
                  valor={m.n}
                  max={maxMotivo}
                  tono="crit"
                />
              ))}
              <p className="mt-1 text-[12.5px] text-muted">
                Si "Precio" encabeza la lista, el problema son las autorizaciones, no
                los vendedores.
              </p>
            </div>
          )}
        </Tarjeta>

        <Tarjeta pregunta="¿Hay un solo teléfono publicado?" tono="warn">
          <p className="text-[13.5px] text-ink-2">
            No: hoy hay <strong>tres números distintos</strong> según dónde mire el
            cliente. Hasta unificarlos no se sabe cuántas consultas llega a perder
            cada canal.
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
        </Tarjeta>

        <section className="tarjeta border-accent-border! bg-accent-soft! p-5">
          <p className="rotulo text-accent-deep!">En la cancha</p>
          <p className="tnum mt-2 font-display text-[34px] font-extrabold tracking-[-.03em] text-accent-deep">
            {fmtPrecio(pipeline, "USD")}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-2">
            {pipelineRows.length}{" "}
            {pipelineRows.length === 1 ? "consulta activa" : "consultas activas"} en seguimiento. Comisión estimada al {COMISION_PCT} %:{" "}
            <strong className="tnum">{fmtPrecio(comision, "USD")}</strong>.
          </p>
        </section>

        <Tarjeta pregunta="¿Qué vence pronto?" ancha>
          {porVencer.length === 0 ? (
            <p className="text-[13.5px] text-muted">
              Ninguna autorización vence en los próximos 30 días.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {porVencer.map((a) => {
                const d = Math.ceil(
                  (new Date(a.hasta).getTime() - Date.now()) / 86_400_000,
                );
                return (
                  <li key={a.id}>
                    <Link
                      href={`/propiedades/${a.propiedadId}`}
                      className={`flex items-center gap-2.5 rounded-[13px] px-3.5 py-3 ${
                        d < 0 ? "bg-crit-bg" : d <= 15 ? "bg-warn-bg" : "bg-sunken"
                      }`}
                    >
                      <Punto nivel={d < 0 ? "crit" : d <= 15 ? "warn" : "neutral"} />
                      <span className="recorte flex-1 text-[13.5px] text-ink-2">
                        {a.codigo} · {a.direccion}
                      </span>
                      <span
                        className={`tnum flex-none text-[13px] font-bold ${
                          d < 0 ? "text-crit" : d <= 15 ? "text-warn" : "text-ink-2"
                        }`}
                      >
                        {d < 0 ? `venció ${fmtFecha(a.hasta)}` : `en ${d} d`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
