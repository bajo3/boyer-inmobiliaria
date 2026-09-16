import "server-only";

/**
 * Regla 4 del plan: el aviso de la mañana.
 *
 * Es el único punto del sistema pensado para alguien que NO va a abrir la app.
 * Junta en un solo mensaje lo que hay que hacer hoy: quién espera respuesta,
 * qué se venció, qué visitas hay, qué alquiler no entró y qué autorización
 * está por caer. Si solo se lee esto, el día ya está cubierto.
 */

import { and, asc, desc, eq, gte, inArray, lte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  consultas,
  visitas,
  contratos,
  pagos,
  autorizaciones,
  busquedas,
  propiedades,
} from "@/db/schema";
import { evaluarConsulta } from "./sla";
import { periodoDe, estadoPago } from "./alquileres";
import { compradoresPara } from "./matching";
import { precio as fmtPrecio, fecha as fmtFecha } from "./formato";

const OFFSET_MIN = -180;

/** Los dos extremos del día de hoy en hora argentina, como instantes reales. */
function hoyArgentina(ahora: Date = new Date()): { desde: Date; hasta: Date } {
  const l = new Date(ahora.getTime() + OFFSET_MIN * 60_000);
  const a = l.getUTCFullYear();
  const m = l.getUTCMonth();
  const d = l.getUTCDate();

  return {
    desde: new Date(Date.UTC(a, m, d, 3, 0, 0)),
    hasta: new Date(Date.UTC(a, m, d + 1, 2, 59, 59)),
  };
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

const HORA = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const ABIERTAS = ["no_atendido", "contactado", "recontactar"] as const;

async function recolectar(ahora: Date) {
  const { desde, hasta } = hoyArgentina(ahora);
  const periodo = periodoDe(ahora);

  const [abiertas, visitasHoy, vivos, autos, activas, publicadas] =
    await Promise.all([
      db.query.consultas.findMany({
        where: inArray(consultas.estado, [...ABIERTAS]),
        with: { contacto: true, propiedad: true, vendedor: true },
        orderBy: [desc(consultas.creadaAt)],
        limit: 500,
      }),
      db.query.visitas.findMany({
        where: and(
          gte(visitas.fechaHora, desde),
          lte(visitas.fechaHora, hasta),
          eq(visitas.estado, "agendada"),
        ),
        with: { contacto: true, propiedad: true, vendedor: true },
        orderBy: [asc(visitas.fechaHora)],
      }),
      db.query.contratos.findMany({
        where: eq(contratos.estado, "activo"),
        with: { inquilino: true, propiedad: true },
      }),
      db.query.autorizaciones.findMany({
        where: lte(
          autorizaciones.hasta,
          new Date(ahora.getTime() + 30 * 86_400_000).toISOString().slice(0, 10),
        ),
        with: { propiedad: true },
        orderBy: [asc(autorizaciones.hasta)],
        limit: 20,
      }),
      db.query.busquedas.findMany({
        where: eq(busquedas.activa, true),
        with: { contacto: true },
        limit: 300,
      }),
      db.query.propiedades.findMany({
        where: notInArray(propiedades.estado, ["vendida", "borrador"]),
        limit: 300,
      }),
    ]);

  /* ── consultas ── */
  const evaluadas = abiertas.map((c) => ({ c, s: evaluarConsulta(c, ahora) }));

  const sinResponder = evaluadas
    .filter((x) => !x.c.primeraRespuestaAt && x.s.nivel !== "ok")
    .sort((a, b) => b.s.orden - a.s.orden);

  const vencidas = evaluadas
    .filter(
      (x) =>
        x.c.primeraRespuestaAt &&
        (!x.c.proximaAccionAt || x.c.proximaAccionAt.getTime() < ahora.getTime()),
    )
    .sort((a, b) => b.s.orden - a.s.orden);

  /* ── alquileres ── */
  const ids = vivos.map((c) => c.id);
  const pagosDelMes = ids.length
    ? (await db.select().from(pagos).where(inArray(pagos.contratoId, ids))).filter(
        (p) => p.periodo === periodo,
      )
    : [];

  const pagoDe = new Map(pagosDelMes.map((p) => [p.contratoId, p]));

  const alquileres = vivos
    .map((c) => ({ c, e: estadoPago(c, pagoDe.get(c.id), periodo, ahora) }))
    .filter((x) => !x.e.pagado && x.e.dias <= 3)
    .sort((a, b) => b.e.orden - a.e.orden);

  /* ── matching ── */
  // Solo las que tienen a alguien esperando: una lista de "0 coincidencias"
  // no es información, es ruido.
  const matches = publicadas
    .map((p) => ({ propiedad: p, gente: compradoresPara(p, activas) }))
    .filter((m) => m.gente.length > 0)
    .sort((a, b) => b.gente.length - a.gente.length)
    .slice(0, 5);

  return {
    titulo: capitalizar(FECHA_LARGA.format(ahora).replace(",", "")),
    periodo,
    sinResponder,
    vencidas,
    visitasHoy,
    alquileres,
    autorizaciones: autos,
    matches,
  };
}

export type Datos = Awaited<ReturnType<typeof recolectar>>;
export type Resumen = Datos & { texto: string };

export async function armarResumen(ahora: Date = new Date()): Promise<Resumen> {
  const datos = await recolectar(ahora);
  return { ...datos, texto: textoDe(datos) };
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── El mensaje ─────────────────────────────────────────────────── */


/**
 * El mensaje que se manda por WhatsApp.
 *
 * Nombres y montos, no cantidades: "3 personas esperando" obliga a abrir la
 * app para saber quiénes son, y entonces el mensaje no sirvió de nada.
 */
function textoDe(r: Datos): string {
  const lineas: string[] = [`*${r.titulo}*`];

  if (r.sinResponder.length) {
    lineas.push("", `*Esperando respuesta (${r.sinResponder.length})*`);
    for (const { c, s } of r.sinResponder.slice(0, 5)) {
      const quien = c.vendedor ? ` — ${c.vendedor.nombre.split(" ")[0]}` : " — sin asignar";
      lineas.push(`• ${c.contacto.nombre}: ${s.etiqueta.toLowerCase()}${quien}`);
    }
    if (r.sinResponder.length > 5) {
      lineas.push(`• y ${r.sinResponder.length - 5} más`);
    }
  }

  if (r.vencidas.length) {
    lineas.push("", `*Sin próximo paso o vencidas (${r.vencidas.length})*`);
    for (const { c, s } of r.vencidas.slice(0, 5)) {
      lineas.push(`• ${c.contacto.nombre}: ${s.etiqueta.toLowerCase()}`);
    }
  }

  if (r.visitasHoy.length) {
    lineas.push("", `*Visitas de hoy (${r.visitasHoy.length})*`);
    for (const v of r.visitasHoy) {
      lineas.push(
        `• ${HORA.format(v.fechaHora)} ${v.contacto.nombre} — ${v.propiedad.direccion}`,
      );
    }
  }

  if (r.alquileres.length) {
    lineas.push("", `*Alquileres (${r.alquileres.length})*`);
    for (const { c, e } of r.alquileres) {
      lineas.push(
        `• ${c.inquilino.nombre}: ${e.etiqueta.toLowerCase()} — ${fmtPrecio(c.monto, c.moneda)}`,
      );
    }
  }

  if (r.matches.length) {
    lineas.push("", "*Gente esperando algo que ya tenemos*");
    for (const m of r.matches) {
      lineas.push(
        `• ${m.propiedad.codigo} ${m.propiedad.direccion}: ${m.gente.length} ` +
          `${m.gente.length === 1 ? "comprador" : "compradores"}`,
      );
    }
  }

  if (r.autorizaciones.length) {
    lineas.push("", "*Autorizaciones por vencer*");
    for (const a of r.autorizaciones.slice(0, 3)) {
      lineas.push(`• ${a.propiedad.direccion}: vence ${fmtFecha(a.hasta)}`);
    }
  }

  if (lineas.length === 1) {
    lineas.push("", "Todo al día. Nadie esperando, nada vencido.");
  }

  return lineas.join("\n");
}

/** Cuántas cosas reclaman atención hoy. Cero significa que no hace falta abrir nada. */
export function pendientes(r: Datos): number {
  return (
    r.sinResponder.length +
    r.vencidas.length +
    r.visitasHoy.length +
    r.alquileres.length
  );
}

