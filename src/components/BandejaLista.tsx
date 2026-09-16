import Link from "next/link";
import { desc, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { consultas } from "@/db/schema";
import type { Usuario } from "@/db/schema";
import { evaluarConsulta, ordenarPorUrgencia } from "@/lib/sla";
import { Semaforo, Riel, Punto } from "@/components/Semaforo";
import { NuevaConsulta } from "@/components/NuevaConsulta";
import { precio as fmtPrecio, ETIQUETAS, fechaHora } from "@/lib/formato";

/** Las tres que siguen vivas. Ganado y rechazado son el archivo. */
export const ABIERTAS: ("no_atendido" | "contactado" | "recontactar")[] = [
  "no_atendido",
  "contactado",
  "recontactar",
];

export type Filtro = "mias" | "sin_asignar" | "todas" | "cerradas";

/**
 * El vendedor abre en "Mías" —es su lista de trabajo—; la administrativa y la
 * titular abren en "Todas", porque su trabajo es mirar el conjunto y repartir.
 */
export function leerFiltro(f: string | undefined, rol?: string): Filtro {
  if ((["mias", "sin_asignar", "todas", "cerradas"] as const).includes(f as Filtro)) {
    return f as Filtro;
  }
  return rol === "vendedor" ? "mias" : "todas";
}

const SALUDO = () => {
  const h = Number(
    new Intl.DateTimeFormat("es-AR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date()),
  );
  return h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
};

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** "domingo, 13 de septiembre" → "Domingo 13 de septiembre". */
function fechaTitulo(d: Date): string {
  const s = FECHA_LARGA.format(d).replace(",", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Carga las consultas abiertas + la vista pedida. Lo usan la bandeja y la ficha. */
export async function cargarBandeja(
  usuario: Usuario,
  filtro: Filtro,
  q?: string,
) {
  const abiertas = await db.query.consultas.findMany({
    where: inArray(consultas.estado, ABIERTAS),
    with: { contacto: true, propiedad: true, vendedor: true },
    orderBy: [desc(consultas.creadaAt)],
    limit: 500,
  });

  const conteos = {
    mias: abiertas.filter((c) => c.asignadaA === usuario.id).length,
    sin_asignar: abiertas.filter((c) => c.asignadaA === null).length,
    todas: abiertas.length,
  };

  const visibles =
    filtro === "cerradas"
      ? await db.query.consultas.findMany({
          where: notInArray(consultas.estado, ABIERTAS),
          with: { contacto: true, propiedad: true, vendedor: true },
          orderBy: [desc(consultas.cerradaAt)],
          limit: 100,
        })
      : filtro === "mias"
        ? abiertas.filter((c) => c.asignadaA === usuario.id)
        : filtro === "sin_asignar"
          ? abiertas.filter((c) => c.asignadaA === null)
          : abiertas;

  // El filtro de texto va en memoria: con unos cientos de consultas abiertas
  // es instantáneo y evita un índice de texto completo que todavía no hace falta.
  const termino = q?.trim().toLowerCase() ?? "";

  const filtradas = termino
    ? visibles.filter((c) =>
        [
          c.contacto.nombre,
          c.contacto.telefono,
          c.contacto.email,
          c.propiedad?.codigo,
          c.propiedad?.direccion,
          c.propiedad?.barrio,
          c.proximaAccion,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termino)),
      )
    : visibles;

  return {
    abiertas,
    conteos,
    ordenadas: ordenarPorUrgencia(filtradas),
    termino,
    totalSinFiltrar: visibles.length,
  };
}

type Datos = Awaited<ReturnType<typeof cargarBandeja>>;

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Quién la tiene. Sin asignar va en amarillo: es lo que falta repartir. */
function Responsable({ nombre }: { nombre: string | null }) {
  if (!nombre) {
    return (
      <span className="flex-none rounded-full bg-warn-bg px-2 py-[2px] text-[11px] font-bold text-warn">
        Sin asignar
      </span>
    );
  }
  return (
    <span
      title={`La tiene ${nombre}`}
      className="grid size-[24px] flex-none place-items-center rounded-full bg-accent-soft text-[10.5px] font-bold text-accent"
    >
      {iniciales(nombre)}
    </span>
  );
}

export async function BandejaLista({
  usuario,
  filtro,
  datos,
  activaId,
  compacta = false,
}: {
  usuario: Usuario;
  filtro: Filtro;
  datos: Datos;
  activaId?: number;
  /** En la ficha la lista va al costado: sin saludo ni alerta, solo las filas. */
  compacta?: boolean;
}) {
  const { conteos, ordenadas, abiertas } = datos;

  const enRojo = abiertas
    .map((c) => ({ c, s: evaluarConsulta(c) }))
    .filter((x) => x.s.nivel === "crit");

  const base = (f: Filtro) => (activaId ? `/consultas/${activaId}?f=${f}` : `/?f=${f}`);

  return (
    <div className="tarjeta flex flex-col overflow-hidden">
      {compacta ? (
        <div className="px-4 pt-3.5 sm:px-5">
          <NuevaConsulta chico />
        </div>
      ) : (
        <div className="px-4 pb-1 pt-4 sm:px-5">
          {/* El botón va arriba: es lo primero que se hace al abrir la bandeja,
              y al pie quedaba debajo de toda la lista. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="text-[12px] text-muted">{fechaTitulo(new Date())}</p>
              <h1 className="mt-0.5 font-display text-[26px] font-extrabold leading-tight">
                {SALUDO()}, {usuario.nombre.split(" ")[0]}
              </h1>
            </div>
            <div className="w-full sm:w-[230px]">
              <NuevaConsulta />
            </div>
          </div>

          {enRojo.length > 0 ? (
            <div className="mt-3.5 flex items-center gap-3 rounded-[16px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-3">
              <span className="latido size-[9px] flex-none rounded-full bg-[var(--crit-solid)]" />
              <p className="text-[13.5px] leading-[1.35]">
                <strong className="text-crit">
                  {enRojo.length}{" "}
                  {enRojo.length === 1 ? "persona esperando" : "personas esperando"}.
                </strong>{" "}
                <span className="text-[#7a2020]">
                  {enRojo
                    .slice(0, 2)
                    .map((x) => `${x.c.contacto.nombre} ${x.s.etiqueta.toLowerCase()}`)
                    .join(" · ")}
                  {enRojo.length > 2 ? ` y ${enRojo.length - 2} más.` : "."}
                </span>
              </p>
            </div>
          ) : (
            <div className="mt-3.5 flex items-center gap-3 rounded-[16px] border border-[var(--ok-border)] bg-ok-bg px-3.5 py-3">
              <span className="size-[9px] flex-none rounded-full bg-[var(--ok-solid)]" />
              <p className="text-[13.5px] text-ok">
                Nadie esperando respuesta. Todo con próximo paso definido.
              </p>
            </div>
          )}
        </div>
      )}

      <div
        className={`flex flex-col gap-2.5 px-4 pb-3 pt-3 sm:px-5 ${
          compacta ? "" : "lg:flex-row lg:items-center"
        }`}
      >
        <form className={compacta ? "" : "lg:w-[320px] lg:flex-none"}>
          <input
            type="search"
            name="q"
            defaultValue={datos.termino}
            className="campo"
            placeholder="Buscar nombre, teléfono, código o calle"
            aria-label="Buscar consultas"
          />
          <input type="hidden" name="f" value={filtro} />
        </form>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["mias", "Mías", conteos.mias],
              ["sin_asignar", "Sin asignar", conteos.sin_asignar],
              ["todas", "Todas", conteos.todas],
              ["cerradas", "Cerradas", null],
            ] as const
          ).map(([clave, label, n]) => (
            <Link
              key={clave}
              href={base(clave)}
              data-activa={filtro === clave}
              aria-current={filtro === clave ? "page" : undefined}
              className="solapa"
            >
              {label}
              {n !== null && <span className="cuenta">{n}</span>}
            </Link>
          ))}
        </div>
      </div>

      <ul className="border-t border-line-soft">
        {ordenadas.length === 0 ? (
          <li className="px-5 py-10 text-center text-[13.5px] text-muted">
            {datos.termino
              ? datos.totalSinFiltrar === 1
                ? `La única consulta de esta solapa no coincide con "${datos.termino}".`
                : `Ninguna de las ${datos.totalSinFiltrar} coincide con "${datos.termino}".`
              : "No hay consultas en esta solapa."}
          </li>
        ) : (
          ordenadas.map((c) => {
            const s = evaluarConsulta(c);
            const vencida = c.proximaAccionAt
              ? c.proximaAccionAt.getTime() < Date.now()
              : false;

            return (
              <li key={c.id}>
                <Link
                  href={`/consultas/${c.id}?f=${filtro}`}
                  data-activa={c.id === activaId}
                  className="fila"
                >
                  <Riel nivel={s.nivel} />

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    {/* Quién consulta, quién la tiene y cómo está. */}
                    <span className="flex items-center gap-2">
                      <span className="recorte text-[15.5px] font-bold tracking-[-.01em]">
                        {c.contacto.nombre}
                      </span>
                      <Responsable nombre={c.vendedor?.nombre ?? null} />
                      <Semaforo nivel={s.nivel} className="ml-auto">
                        {s.etiqueta}
                      </Semaforo>
                    </span>

                    {/* Por dónde llegó y por qué propiedad. */}
                    <span className="flex min-w-0 items-baseline gap-2 text-[13px] text-ink-2">
                      <span className="flex-none text-muted">
                        {ETIQUETAS.canal[c.canal] ?? c.canal}
                      </span>
                      <span aria-hidden className="text-faint">
                        ·
                      </span>
                      {c.propiedad ? (
                        <>
                          <span className="tnum flex-none font-semibold text-accent">
                            {c.propiedad.codigo}
                          </span>
                          <span className="recorte min-w-0 flex-1">
                            {c.propiedad.direccion}
                          </span>
                          <span className="tnum flex-none font-semibold">
                            {fmtPrecio(c.propiedad.precio, c.propiedad.moneda)}
                          </span>
                        </>
                      ) : (
                        <span className="recorte min-w-0 flex-1">Consulta general</span>
                      )}
                    </span>

                    {/* Qué sigue. Si todavía no hay próximo paso, lo que
                        preguntó: es lo que hace falta para contestar. */}
                    {c.proximaAccion ? (
                      <span className="flex items-center gap-2 text-[12.5px]">
                        <Punto
                          nivel={vencida ? "crit" : s.nivel === "warn" ? "warn" : "neutral"}
                        />
                        <span className="recorte text-ink-2">{c.proximaAccion}</span>
                        {c.proximaAccionAt && (
                          <span
                            className={`tnum ml-auto flex-none text-[12px] font-semibold ${
                              vencida ? "text-crit" : "text-faint"
                            }`}
                          >
                            {fechaHora(c.proximaAccionAt)}
                          </span>
                        )}
                      </span>
                    ) : c.mensajeOriginal ? (
                      <span className="recorte text-[12.5px] italic text-muted">
                        “{c.mensajeOriginal}”
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
