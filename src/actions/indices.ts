"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { indices, contratos } from "@/db/schema";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";

export type Estado = { error?: string; ok?: boolean };

const esquema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "El mes va como 2026-09."),
  valor: z.coerce.number().min(-50).max(200),
  tipo: z.enum(["ipc", "icl"]).default("ipc"),
});

/** Carga o corrige la variación de un mes. */
export async function guardarIndice(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) {
    return { error: "Solo administración y titular cargan los índices." };
  }

  const parsed = esquema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { mes, valor, tipo } = parsed.data;

  await db
    .insert(indices)
    .values({ tipo, mes, valor: valor.toString() })
    .onConflictDoUpdate({
      target: [indices.tipo, indices.mes],
      set: { valor: valor.toString() },
    });

  revalidatePath("/documentos");
  return { ok: true };
}

export async function borrarIndice(tipo: string, mes: string) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) return;

  await db
    .delete(indices)
    .where(and(eq(indices.tipo, tipo), eq(indices.mes, mes)));

  revalidatePath("/documentos");
}

/**
 * Deja aplicado el ajuste: cambia el monto del contrato y corre la fecha del
 * próximo. Queda anotado en las notas para que después se pueda reconstruir
 * de dónde salió el número.
 */
export async function aplicarAjuste(
  contratoId: number,
  montoNuevo: number,
  detalle: string,
) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) return;

  const contrato = await db.query.contratos.findFirst({
    where: eq(contratos.id, contratoId),
  });
  if (!contrato) return;

  const meses: Record<string, number> = {
    trimestral: 3,
    cuatrimestral: 4,
    semestral: 6,
    anual: 12,
  };

  const salto = meses[contrato.ajuste];
  const base = contrato.proximoAjuste ? new Date(contrato.proximoAjuste) : new Date();
  const siguiente = salto
    ? new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + salto, base.getUTCDate()),
      )
    : null;

  const fecha = new Date().toISOString().slice(0, 10);
  const historial = `${fecha}: ${contrato.monto} → ${montoNuevo} (${detalle})`;

  await db
    .update(contratos)
    .set({
      monto: montoNuevo.toString(),
      proximoAjuste: siguiente ? siguiente.toISOString().slice(0, 10) : null,
      notas: contrato.notas ? `${contrato.notas}\n${historial}` : historial,
    })
    .where(eq(contratos.id, contratoId));

  revalidatePath("/alquileres");
  revalidatePath("/documentos");
}
