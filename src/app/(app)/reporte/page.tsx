import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { consultas, usuarios, visitas } from "@/db/schema";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";
import { evaluarConsulta, horasHabilesEntre, UMBRAL_VERDE_H } from "@/lib/sla";

const PERIODOS = [
  [7, "7 días"],
  [30, "30 días"],
  [90, "90 días"],
] as const;

const ABIERTAS: ("no_atendido" | "contactado" | "recontactar")[] = [
  "no_atendido",
  "contactado",
  "recontactar",
];

type Fila = {
  id: number;
  nombre: string;
  recibidas: number;
  atendidas: number;
  rapidas: number;
  tiempos: number[];
  ganadas: number;
  rechazadas: number;
  visitas: number;
  enRojo: number;
};

function mediana(v: number[]): number | null {
  if (v.length === 0) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** 0.4 → "24 min"; 3.25 → "3,3 h" (siempre horas hábiles). */
function duracion(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return `${h.toLocaleString("es-AR", { maximumFractionDigits: 1 })} h`;
}

function pct(a: number, b: number): string {
  return b === 0 ? "—" : `${Math.round((a / b) * 100)} %`;
}

export default async function Reporte({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) redirect("/");

  const { p } = await searchParams;
  const dias = PERIODOS.some(([d]) => String(d) === p) ? Number(p) : 30;
  const desde = new Date(Date.now() - dias * 86_400_000);

  const [equipo, delPeriodo, abiertasHoy, visitasHechas] = await Promise.all([
    db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(and(eq(usuarios.rol, "vendedor"), eq(usuarios.activo, true)))
      .orderBy(asc(usuarios.nombre)),
    db
      .select({
        asignadaA: consultas.asignadaA,
        estado: consultas.estado,
        creadaAt: consultas.creadaAt,
        primeraRespuestaAt: consultas.primeraRespuestaAt,
      })
      .from(consultas)
      .where(and(gte(consultas.creadaAt, desde), isNotNull(consultas.asignadaA))),
    db
      .select({
        asignadaA: consultas.asignadaA,
        estado: consultas.estado,
        creadaAt: consultas.creadaAt,
        primeraRespuestaAt: consultas.primeraRespuestaAt,
        proximaAccion: consultas.proximaAccion,
        proximaAccionAt: consultas.proximaAccionAt,
      })
      .from(consultas)
      .where(and(inArray(consultas.estado, ABIERTAS), isNotNull(consultas.asignadaA))),
    db
      .select({ usuarioId: visitas.usuarioId })
      .from(visitas)
      .where(and(gte(visitas.fechaHora, desde), eq(visitas.estado, "realizada"))),
  ]);

  const filas = new Map<number, Fila>();
  const fila = (id: number, nombre = "—") => {
    let f = filas.get(id);
    if (!f) {
      f = { id, nombre, recibidas: 0, atendidas: 0, rapidas: 0, tiempos: [], ganadas: 0, rechazadas: 0, visitas: 0, enRojo: 0 };
      filas.set(id, f);
    }
    return f;
  };

  for (const u of equipo) fila(u.id, u.nombre);
  const nombres = new Map(equipo.map((u) => [u.id, u.nombre]));

  for (const c of delPeriodo) {
    // Si la tiene alguien que no es vendedor (la titular, por ejemplo), también cuenta.
    const f = fila(c.asignadaA!, nombres.get(c.asignadaA!));
    f.recibidas++;
    if (c.estado === "ganado") f.ganadas++;
    if (c.estado === "rechazado") f.rechazadas++;
    if (c.primeraRespuestaAt) {
      const h = horasHabilesEntre(c.creadaAt, c.primeraRespuestaAt);
      f.atendidas++;
      f.tiempos.push(h);
      if (h < UMBRAL_VERDE_H) f.rapidas++;
    }
  }

  for (const c of abiertasHoy) {
    if (evaluarConsulta(c).nivel === "crit") fila(c.asignadaA!, nombres.get(c.asignadaA!)).enRojo++;
  }

  for (const v of visitasHechas) {
    if (v.usuarioId && filas.has(v.usuarioId)) filas.get(v.usuarioId)!.visitas++;
  }

  // Nombres de quienes no son vendedores pero tuvieron consultas asignadas.
  const sinNombre = [...filas.values()].filter((f) => f.nombre === "—").map((f) => f.id);
  if (sinNombre.length) {
    const extra = await db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(inArray(usuarios.id, sinNombre));
    for (const e of extra) filas.get(e.id)!.nombre = e.nombre;
  }

  // "Mejor" en orden explícito: primero quién cerró, después quién contestó a
  // tiempo, después quién atendió más. Un puntaje combinado sería más prolijo
  // y nadie entendería por qué quedó primero.
  const tabla = [...filas.values()].sort(
    (a, b) =>
      b.ganadas - a.ganadas ||
      (b.atendidas ? b.rapidas / b.atendidas : 0) - (a.atendidas ? a.rapidas / a.atendidas : 0) ||
      b.atendidas - a.atendidas,
  );

  const conDatos = tabla.filter((f) => f.recibidas > 0);
  const masAtendio = [...conDatos].sort((a, b) => b.atendidas - a.atendidas)[0];
  const masRapido = [...conDatos]
    .filter((f) => f.tiempos.length > 0)
    .sort((a, b) => mediana(a.tiempos)! - mediana(b.tiempos)!)[0];
  const masCierres = [...conDatos].sort((a, b) => b.ganadas - a.ganadas)[0];

  const destacados = [
    {
      titulo: "Atendió más",
      quien: masAtendio?.atendidas ? masAtendio.nombre : null,
      dato: masAtendio?.atendidas ? `${masAtendio.atendidas} consultas respondidas` : "",
    },
    {
      titulo: "Responde más rápido",
      quien: masRapido?.nombre ?? null,
      dato: masRapido ? `${duracion(mediana(masRapido.tiempos))} hábiles en promedio` : "",
    },
    {
      titulo: "Más operaciones cerradas",
      quien: masCierres?.ganadas ? masCierres.nombre : null,
      dato: masCierres?.ganadas ? `${masCierres.ganadas} ganadas` : "",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="tarjeta px-4 pb-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[26px] font-extrabold">Reporte del equipo</h1>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Quién atendió, qué tan rápido y cuánto cerró. Consultas que entraron en
              los últimos {dias} días.
            </p>
          </div>
          <nav aria-label="Período" className="flex gap-1.5">
            {PERIODOS.map(([d, t]) => (
              <Link
                key={d}
                href={`/reporte?p=${d}`}
                data-activa={d === dias}
                aria-current={d === dias ? "page" : undefined}
                className="solapa"
              >
                {t}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {destacados.map((d) => (
          <section key={d.titulo} className="tarjeta p-4">
            <p className="rotulo">{d.titulo}</p>
            {d.quien ? (
              <>
                <p className="mt-1.5 font-display text-[21px] font-extrabold leading-tight">
                  {d.quien}
                </p>
                <p className="mt-0.5 text-[13px] text-muted">{d.dato}</p>
              </>
            ) : (
              <p className="mt-1.5 text-[13.5px] text-muted">Todavía sin datos en el período.</p>
            )}
          </section>
        ))}
      </div>

      <section className="tarjeta overflow-hidden">
        <div className="px-4 pb-2 pt-3.5 sm:px-5">
          <h2 className="rotulo">Vendedor por vendedor</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Ordenados por operaciones cerradas, después por respuestas a tiempo (menos
            de {UMBRAL_VERDE_H} h hábil) y después por consultas atendidas.
          </p>
        </div>

        <div className="overflow-x-auto border-t border-line-soft">
          <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-[.05em] text-muted">
                <th className="px-5 py-2.5 font-semibold">Vendedor</th>
                <th className="px-3 py-2.5 text-right font-semibold">Recibidas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Atendidas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Respuesta</th>
                <th className="px-3 py-2.5 text-right font-semibold">A tiempo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Visitas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ganadas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Conversión</th>
                <th className="px-5 py-2.5 text-right font-semibold">En rojo hoy</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((f, i) => (
                <tr key={f.id} className="border-t border-line-soft">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="tnum grid size-[24px] flex-none place-items-center rounded-full bg-accent-soft text-[11.5px] font-bold text-accent">
                        {i + 1}
                      </span>
                      <span className="font-semibold">{f.nombre}</span>
                    </span>
                  </td>
                  <td className="tnum px-3 py-3 text-right">{f.recibidas}</td>
                  <td className="tnum px-3 py-3 text-right">
                    {f.atendidas}{" "}
                    <span className="text-[12px] text-muted">({pct(f.atendidas, f.recibidas)})</span>
                  </td>
                  <td className="tnum px-3 py-3 text-right">{duracion(mediana(f.tiempos))}</td>
                  <td className="tnum px-3 py-3 text-right">{pct(f.rapidas, f.atendidas)}</td>
                  <td className="tnum px-3 py-3 text-right">{f.visitas}</td>
                  <td className="tnum px-3 py-3 text-right font-semibold">{f.ganadas}</td>
                  <td className="tnum px-3 py-3 text-right">{pct(f.ganadas, f.recibidas)}</td>
                  <td className="tnum px-5 py-3 text-right">
                    {f.enRojo > 0 ? (
                      <span className="font-bold text-crit">{f.enRojo}</span>
                    ) : (
                      <span className="text-ok">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="border-t border-line-soft px-5 py-3 text-[12px] text-muted">
          "Respuesta" es el tiempo típico hasta el primer contacto, en horas hábiles:
          una consulta del domingo a la noche no cuenta en contra. "En rojo hoy" son
          las abiertas que ahora mismo esperan respuesta o no tienen próximo paso.
        </p>
      </section>
    </div>
  );
}
