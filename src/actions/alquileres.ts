"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { contratos, pagos, contactos, propiedades } from "@/db/schema";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";
import { normalizarTelefono } from "@/lib/telefono";
import { periodoDe } from "@/lib/alquileres";

export type Estado = { error?: string; ok?: boolean };

/**
 * Registra el pago del mes.
 *
 * El monto por defecto es el del contrato, pero se puede corregir: los pagos
 * parciales y los ajustes fuera de término existen, y forzar el monto exacto
 * haría que la administrativa anote el pago en un papel en vez de acá.
 */
export async function registrarPago(
  contratoId: number,
  periodo: string,
  monto?: number,
) {
  const usuario = await requerirSesion();

  const contrato = await db.query.contratos.findFirst({
    where: eq(contratos.id, contratoId),
  });
  if (!contrato) return;

  await db
    .insert(pagos)
    .values({
      contratoId,
      periodo,
      monto: (monto ?? Number(contrato.monto)).toString(),
      registradoPor: usuario.id,
    })
    .onConflictDoNothing();

  revalidatePath("/alquileres");
}

export type EstadoRecibo = { error?: string; pagoId?: number };

const esquemaRecibo = z.object({
  contratoId: z.coerce.number().int().positive("Elegí el contrato."),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Elegí el mes que se cobra."),
  monto: z.coerce.number().positive("Poné el monto cobrado."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  notas: z.string().trim().optional(),
});

/**
 * Registra el cobro y lleva directo al recibo para imprimirlo.
 *
 * Si ese mes ya estaba cobrado no se crea otro: dos recibos por el mismo
 * período es exactamente el papel que después termina en una discusión.
 */
export async function crearRecibo(
  _prev: EstadoRecibo,
  formData: FormData,
): Promise<EstadoRecibo> {
  const usuario = await requerirSesion();

  const parsed = esquemaRecibo.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const d = parsed.data;

  // Mediodía en Argentina: guardar la medianoche corre la fecha un día según
  // desde qué huso se la mire.
  const [nuevo] = await db
    .insert(pagos)
    .values({
      contratoId: d.contratoId,
      periodo: d.periodo,
      monto: d.monto.toString(),
      pagadoAt: new Date(`${d.fecha}T12:00:00-03:00`),
      registradoPor: usuario.id,
      notas: d.notas || null,
    })
    .onConflictDoNothing()
    .returning({ id: pagos.id });

  if (!nuevo) {
    const [existente] = await db
      .select({ id: pagos.id })
      .from(pagos)
      .where(and(eq(pagos.contratoId, d.contratoId), eq(pagos.periodo, d.periodo)))
      .limit(1);

    return {
      error: "Ese mes ya está cobrado para este contrato.",
      pagoId: existente?.id,
    };
  }

  revalidatePath("/alquileres");
  revalidatePath("/documentos");
  redirect(`/imprimir/recibo/${nuevo.id}`);
}

/** Deshace un pago mal cargado. */
export async function anularPago(contratoId: number, periodo: string) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) return;

  await db
    .delete(pagos)
    .where(and(eq(pagos.contratoId, contratoId), eq(pagos.periodo, periodo)));

  revalidatePath("/alquileres");
}

/**
 * Deja registrado que ya se le avisó por este mes.
 *
 * Se llama cuando se abre el WhatsApp, no cuando el inquilino contesta: lo que
 * se quiere evitar es mandarle el mismo recordatorio dos veces.
 */
export async function marcarRecordado(contratoId: number, periodo: string) {
  await requerirSesion();

  await db
    .update(contratos)
    .set({ recordatorioAt: new Date(), recordatorioPeriodo: periodo })
    .where(eq(contratos.id, contratoId));

  revalidatePath("/alquileres");
}

/* ── Alta de contrato ───────────────────────────────────────────── */

const opcionalNumero = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative().optional(),
);

const esquema = z.object({
  propiedadId: z.coerce.number().int().positive("Elegí la propiedad."),
  inquilinoNombre: z.string().trim().min(2, "Falta el nombre del inquilino."),
  inquilinoTelefono: z.string().trim().min(6, "Falta el teléfono del inquilino."),
  inquilinoEmail: z.string().trim().optional(),
  monto: z.coerce.number().positive("Poné el monto del alquiler."),
  moneda: z.enum(["ARS", "USD"]),
  expensas: opcionalNumero,
  diaVencimiento: z.coerce.number().int().min(1).max(31),
  inicio: z.string().trim().min(8, "Falta la fecha de inicio."),
  fin: z.string().trim().min(8, "Falta la fecha de fin."),
  ajuste: z.enum([
    "trimestral",
    "cuatrimestral",
    "semestral",
    "anual",
    "sin_ajuste",
  ]),
  comisionPct: opcionalNumero,
  notas: z.string().trim().optional(),
});

export async function crearContrato(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) {
    return { error: "Solo administración y titular cargan contratos." };
  }

  const parsed = esquema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const d = parsed.data;

  if (d.fin <= d.inicio) {
    return { error: "La fecha de fin tiene que ser posterior a la de inicio." };
  }

  const inquilinoId = await asegurarInquilino(
    d.inquilinoNombre,
    d.inquilinoTelefono,
    d.inquilinoEmail,
  );

  const propiedad = await db.query.propiedades.findFirst({
    where: eq(propiedades.id, d.propiedadId),
  });
  if (!propiedad) return { error: "No existe esa propiedad." };

  const [nuevo] = await db
    .insert(contratos)
    .values({
      propiedadId: d.propiedadId,
      inquilinoId,
      propietarioId: propiedad.propietarioId,
      monto: d.monto.toString(),
      moneda: d.moneda,
      expensas: d.expensas?.toString() ?? null,
      diaVencimiento: d.diaVencimiento,
      inicio: d.inicio,
      fin: d.fin,
      ajuste: d.ajuste,
      proximoAjuste: proximoAjusteDesde(d.inicio, d.ajuste),
      comisionPct: d.comisionPct?.toString() ?? null,
      notas: d.notas || null,
    })
    .returning({ id: contratos.id });

  // Alquilada: deja de ofrecerse y no vuelve a aparecer como disponible.
  await db
    .update(propiedades)
    .set({ estado: "reservada", operacion: "alquiler" })
    .where(eq(propiedades.id, d.propiedadId));

  revalidatePath("/alquileres");
  revalidatePath("/propiedades");
  revalidatePath("/documentos");

  // Desde Documentos lo que se quiere es el papel para firmar, no volver a la lista.
  if (formData.get("imprimir") === "1") redirect(`/imprimir/contrato/${nuevo.id}`);

  return { ok: true };
}

/** Cierra el contrato y devuelve la propiedad al circuito. */
export async function finalizarContrato(id: number) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) return;

  const contrato = await db.query.contratos.findFirst({
    where: eq(contratos.id, id),
  });
  if (!contrato) return;

  await db.update(contratos).set({ estado: "finalizado" }).where(eq(contratos.id, id));

  await db
    .update(propiedades)
    .set({ estado: "publicada" })
    .where(eq(propiedades.id, contrato.propiedadId));

  revalidatePath("/alquileres");
  revalidatePath("/propiedades");
}

/* ── auxiliares ─────────────────────────────────────────────────── */

const MESES_DE_AJUSTE: Record<string, number> = {
  trimestral: 3,
  cuatrimestral: 4,
  semestral: 6,
  anual: 12,
};

/** La fecha del primer ajuste, contada desde el inicio del contrato. */
function proximoAjusteDesde(inicio: string, ajuste: string): string | null {
  const meses = MESES_DE_AJUSTE[ajuste];
  if (!meses) return null;

  const [a, m, d] = inicio.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1 + meses, d));
  return fecha.toISOString().slice(0, 10);
}

/** Reusa el contacto si ya existe por teléfono; si no, lo crea. */
async function asegurarInquilino(
  nombre: string,
  telefono: string,
  email?: string,
): Promise<number> {
  const tel = normalizarTelefono(telefono);

  if (tel) {
    const [existente] = await db
      .select({ id: contactos.id, tipo: contactos.tipo })
      .from(contactos)
      .where(eq(contactos.telefono, tel))
      .limit(1);

    if (existente) {
      // Si ya estaba como comprador o propietario, ahora es las dos cosas.
      if (existente.tipo !== "inquilino") {
        await db
          .update(contactos)
          .set({ tipo: "ambos" })
          .where(eq(contactos.id, existente.id));
      }
      return existente.id;
    }
  }

  const [nuevo] = await db
    .insert(contactos)
    .values({
      nombre,
      telefono: tel,
      email: email || null,
      tipo: "inquilino",
      origen: "mostrador",
    })
    .returning({ id: contactos.id });

  return nuevo.id;
}

/** El período en curso, para que las pantallas no lo calculen cada una. */
export async function periodoActual(): Promise<string> {
  return periodoDe();
}
