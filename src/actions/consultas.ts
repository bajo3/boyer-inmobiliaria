"use server";

import { eq, and, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { consultas, actividades, contactos, visitas } from "@/db/schema";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";
import { normalizarTelefono } from "@/lib/telefono";
import { leerConfiguracion, cargaDelEquipo, aQuienLeToca } from "@/lib/reparto";

/** Actividades que cuentan como "ya hablamos con la persona" (Regla 1). */
const ES_CONTACTO = new Set(["whatsapp", "llamada", "email", "visita"]);

const CANALES = [
  "whatsapp",
  "instagram",
  "facebook",
  "zonaprop",
  "llamada",
  "mostrador",
  "web",
] as const;

const MOTIVOS = [
  "compro_en_otra",
  "no_calificaba",
  "nunca_respondio",
  "fuera_de_zona",
  "precio",
] as const;

export type Estado = { error?: string; ok?: boolean };

/* ────────────────────────── alta de consulta ────────────────────────── */

const esquemaAlta = z.object({
  nombre: z.string().trim().min(2, "Poné al menos el nombre."),
  telefono: z.string().trim().optional(),
  canal: z.enum(CANALES),
  propiedadId: z.coerce.number().int().positive().optional(),
  mensaje: z.string().trim().optional(),
});

/**
 * La carga del día a día: la administrativa la hace decenas de veces.
 *
 * Nombre, canal y a quién se la pasa. Nada más es obligatorio. Si el teléfono
 * ya existe, reusa el contacto en vez de duplicar la persona.
 */
export async function crearConsulta(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();

  const parsed = esquemaAlta.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono") || undefined,
    canal: formData.get("canal"),
    propiedadId: formData.get("propiedadId") || undefined,
    mensaje: formData.get("mensaje") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { nombre, canal, propiedadId, mensaje } = parsed.data;

  // "Pasársela a": un vendedor elegido, "ninguno" para dejarla sin asignar a
  // propósito, o vacío. Vacío con el reparto automático prendido significa que
  // la decide el sistema; con el reparto apagado, queda sin asignar como antes.
  const eleccion = String(formData.get("asignadaA") ?? "");
  let asignadaA: number | null = null;
  let automatica: { nombre: string; abiertas: number } | null = null;

  if (eleccion && eleccion !== "ninguno") {
    const id = Number(eleccion);
    if (!Number.isInteger(id) || id <= 0) return { error: "Vendedor inválido." };
    asignadaA = id;
  } else if (!eleccion && (await leerConfiguracion()).asignacionAutomatica) {
    const elegido = aQuienLeToca(await cargaDelEquipo());
    if (elegido) {
      asignadaA = elegido.id;
      automatica = elegido;
    }
  }
  const tel = normalizarTelefono(parsed.data.telefono);

  let contactoId: number | undefined;
  if (tel) {
    const [existente] = await db
      .select({ id: contactos.id })
      .from(contactos)
      .where(eq(contactos.telefono, tel))
      .limit(1);
    contactoId = existente?.id;
  }

  if (!contactoId) {
    const [nuevo] = await db
      .insert(contactos)
      .values({ nombre, telefono: tel, origen: canal, vendedorId: asignadaA ?? null })
      .returning({ id: contactos.id });
    contactoId = nuevo.id;
  }

  const [nueva] = await db
    .insert(consultas)
    .values({
      contactoId,
      propiedadId: propiedadId ?? null,
      canal,
      mensajeOriginal: mensaje ?? null,
      estado: "no_atendido",
      asignadaA,
      cargadaPor: usuario.id,
    })
    .returning({ id: consultas.id });

  // Queda escrito por qué le tocó a quién: sin esto, el reparto automático se
  // discute ("¿por qué siempre a él?") en vez de confiarse.
  if (automatica) {
    await db.insert(actividades).values({
      consultaId: nueva.id,
      usuarioId: usuario.id,
      tipo: "cambio_estado",
      contenido: `Asignada automáticamente a ${automatica.nombre}: era quien menos consultas abiertas tenía (${automatica.abiertas}).`,
    });
  }

  revalidatePath("/");
  return { ok: true };
}

/* ────────────────────────── asignación ────────────────────────── */

/** La administrativa (o el titular) se la pasa a un vendedor. */
export async function asignarConsulta(consultaId: number, vendedorId: number) {
  const usuario = await requerirSesion();

  await db
    .update(consultas)
    .set({ asignadaA: vendedorId })
    .where(eq(consultas.id, consultaId));

  await db.insert(actividades).values({
    consultaId,
    usuarioId: usuario.id,
    tipo: "cambio_estado",
    contenido: "Asignada a un vendedor",
  });

  revalidatePath("/");
  revalidatePath(`/consultas/${consultaId}`);
}

/** Un vendedor agarra una que estaba sin asignar. */
export async function tomarConsulta(consultaId: number) {
  const usuario = await requerirSesion();

  await db
    .update(consultas)
    .set({ asignadaA: usuario.id })
    .where(
      and(
        eq(consultas.id, consultaId),
        or(isNull(consultas.asignadaA), eq(consultas.asignadaA, usuario.id)),
      ),
    );

  revalidatePath("/");
  revalidatePath(`/consultas/${consultaId}`);
}

/* ────────────────────────── corregir y borrar ────────────────────────── */

const esquemaEdicion = z.object({
  consultaId: z.coerce.number().int().positive(),
  canal: z.enum(CANALES),
  propiedadId: z.coerce.number().int().positive().optional(),
  mensaje: z.string().trim().optional(),
});

/**
 * Corregir una consulta mal cargada: canal equivocado, propiedad equivocada,
 * el mensaje pegado a medias. Pasa todos los días y hasta ahora no había forma.
 *
 * El nombre y el teléfono no se tocan acá: viven en el contacto, que puede
 * tener varias consultas, y se editan desde su ficha.
 */
export async function editarConsulta(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();

  const parsed = esquemaEdicion.safeParse({
    consultaId: formData.get("consultaId"),
    canal: formData.get("canal"),
    propiedadId: formData.get("propiedadId") || undefined,
    mensaje: formData.get("mensaje") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { consultaId, canal, propiedadId, mensaje } = parsed.data;

  await db
    .update(consultas)
    .set({
      canal,
      propiedadId: propiedadId ?? null,
      mensajeOriginal: mensaje ?? null,
    })
    .where(eq(consultas.id, consultaId));

  await db.insert(actividades).values({
    consultaId,
    usuarioId: usuario.id,
    tipo: "cambio_estado",
    contenido: "Se corrigieron los datos de la consulta",
  });

  revalidatePath("/");
  revalidatePath(`/consultas/${consultaId}`);
  return { ok: true };
}

/**
 * Borrado definitivo, solo para administrativa y titular.
 *
 * Un vendedor no puede borrar: si pudiera, la consulta que no atendió
 * desaparecería del panel y con ella toda la trazabilidad. Para eso está
 * rechazar con motivo.
 */
export async function eliminarConsulta(consultaId: number) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) {
    throw new Error("Solo la administrativa o la titular pueden borrar consultas.");
  }

  await db.delete(consultas).where(eq(consultas.id, consultaId));

  revalidatePath("/");
  redirect("/");
}

/* ────────────────────────── registrar actividad ────────────────────────── */

const esquemaActividad = z.object({
  consultaId: z.coerce.number().int().positive(),
  tipo: z.enum(["nota", "llamada", "whatsapp", "email", "visita", "oferta"]),
  contenido: z.string().trim().min(1, "Escribí qué pasó."),
  proximaAccion: z.string().trim().optional(),
  proximaAccionAt: z.string().trim().optional(),
});

/**
 * El único gesto que el vendedor repite todo el día, y el que mueve el estado
 * solo: registrar un contacto pasa la consulta a "Contactado", y si además
 * deja una fecha, la deja en "Re-contactar". No hay que tocar el estado a mano.
 */
export async function registrarActividad(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();

  const parsed = esquemaActividad.safeParse({
    consultaId: formData.get("consultaId"),
    tipo: formData.get("tipo"),
    contenido: formData.get("contenido"),
    proximaAccion: formData.get("proximaAccion") || undefined,
    proximaAccionAt: formData.get("proximaAccionAt") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { consultaId, tipo, contenido, proximaAccion, proximaAccionAt } =
    parsed.data;

  const [consulta] = await db
    .select()
    .from(consultas)
    .where(eq(consultas.id, consultaId))
    .limit(1);

  if (!consulta) return { error: "La consulta no existe." };

  await db.insert(actividades).values({
    consultaId,
    usuarioId: usuario.id,
    tipo,
    contenido,
  });

  const cambios: Partial<typeof consultas.$inferInsert> = {};

  // Regla 1: el primer contacto real frena el semáforo.
  if (!consulta.primeraRespuestaAt && ES_CONTACTO.has(tipo)) {
    cambios.primeraRespuestaAt = new Date();
  }

  // Quien atiende, se queda la consulta.
  if (!consulta.asignadaA) cambios.asignadaA = usuario.id;

  // Regla 2: si dejó fecha, queda para recontactar; si no, "Contactado" a secas
  // y el semáforo la marca en rojo hasta que alguien defina el próximo paso.
  const fecha = proximaAccionAt ? new Date(proximaAccionAt) : null;
  const tieneFecha = Boolean(
    proximaAccion && fecha && !Number.isNaN(fecha.getTime()),
  );

  if (tieneFecha && fecha) {
    cambios.proximaAccion = proximaAccion;
    cambios.proximaAccionAt = fecha;
  }

  // El estado se mueve solo. El vendedor nunca lo toca a mano.
  if (consulta.estado === "no_atendido" || consulta.estado === "contactado") {
    cambios.estado = tieneFecha ? "recontactar" : "contactado";
  }

  if (Object.keys(cambios).length) {
    await db.update(consultas).set(cambios).where(eq(consultas.id, consultaId));
  }

  revalidatePath("/");
  revalidatePath(`/consultas/${consultaId}`);
  return { ok: true };
}

/* ────────────────────────── cierre ────────────────────────── */

const esquemaRechazo = z.object({
  consultaId: z.coerce.number().int().positive(),
  motivo: z.enum(MOTIVOS, { message: "Elegí un motivo." }),
  nota: z.string().trim().optional(),
});

/**
 * Regla 3: no se rechaza sin motivo.
 *
 * No es burocracia: agregado en el panel es el dato más accionable del sistema.
 * Si la mitad dice "precio", el problema son las autorizaciones, no los vendedores.
 */
export async function rechazarConsulta(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();

  const parsed = esquemaRechazo.safeParse({
    consultaId: formData.get("consultaId"),
    motivo: formData.get("motivo"),
    nota: formData.get("nota") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Elegí un motivo." };
  }

  const { consultaId, motivo, nota } = parsed.data;

  await db
    .update(consultas)
    .set({
      estado: "rechazado",
      motivoRechazo: motivo,
      cerradaAt: new Date(),
      proximaAccion: null,
      proximaAccionAt: null,
    })
    .where(eq(consultas.id, consultaId));

  await db.insert(actividades).values({
    consultaId,
    usuarioId: usuario.id,
    tipo: "cambio_estado",
    contenido: `Rechazada — ${motivo.replace(/_/g, " ")}${nota ? `. ${nota}` : ""}`,
  });

  revalidatePath("/");
  revalidatePath(`/consultas/${consultaId}`);
  return { ok: true };
}

/** Cerró la operación. */
export async function marcarGanada(consultaId: number) {
  const usuario = await requerirSesion();

  await db
    .update(consultas)
    .set({
      estado: "ganado",
      motivoRechazo: null,
      cerradaAt: new Date(),
      proximaAccion: null,
      proximaAccionAt: null,
    })
    .where(eq(consultas.id, consultaId));

  await db.insert(actividades).values({
    consultaId,
    usuarioId: usuario.id,
    tipo: "cambio_estado",
    contenido: "Ganada — cerró la operación",
  });

  revalidatePath("/");
  revalidatePath(`/consultas/${consultaId}`);
}

export async function reabrirConsulta(consultaId: number) {
  const usuario = await requerirSesion();

  await db
    .update(consultas)
    .set({ estado: "contactado", motivoRechazo: null, cerradaAt: null })
    .where(eq(consultas.id, consultaId));

  await db.insert(actividades).values({
    consultaId,
    usuarioId: usuario.id,
    tipo: "cambio_estado",
    contenido: "Reabierta",
  });

  revalidatePath("/");
  revalidatePath(`/consultas/${consultaId}`);
}

/* ────────────────────────── visitas ────────────────────────── */

const esquemaVisita = z.object({
  consultaId: z.coerce.number().int().positive(),
  fechaHora: z.string().trim().min(1, "Poné fecha y hora."),
});

export async function agendarVisita(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();

  const parsed = esquemaVisita.safeParse({
    consultaId: formData.get("consultaId"),
    fechaHora: formData.get("fechaHora"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const [consulta] = await db
    .select()
    .from(consultas)
    .where(eq(consultas.id, parsed.data.consultaId))
    .limit(1);

  if (!consulta) return { error: "La consulta no existe." };
  if (!consulta.propiedadId) {
    return { error: "Asociá una propiedad antes de agendar la visita." };
  }

  const fecha = new Date(parsed.data.fechaHora);
  if (Number.isNaN(fecha.getTime())) return { error: "Fecha inválida." };

  await db.insert(visitas).values({
    propiedadId: consulta.propiedadId,
    contactoId: consulta.contactoId,
    consultaId: consulta.id,
    usuarioId: usuario.id,
    fechaHora: fecha,
    estado: "agendada",
  });

  await db
    .update(consultas)
    .set({
      estado: "recontactar",
      primeraRespuestaAt: consulta.primeraRespuestaAt ?? new Date(),
      proximaAccion: "Confirmar visita",
      proximaAccionAt: fecha,
    })
    .where(eq(consultas.id, consulta.id));

  await db.insert(actividades).values({
    consultaId: consulta.id,
    usuarioId: usuario.id,
    tipo: "visita",
    contenido: `Visita agendada para ${fecha.toLocaleString("es-AR")}`,
  });

  revalidatePath("/");
  revalidatePath(`/consultas/${consulta.id}`);
  revalidatePath("/agenda");
  return { ok: true };
}
