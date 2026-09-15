"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { contactos, busquedas } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { normalizarTelefono } from "@/lib/telefono";

export type Estado = { error?: string; ok?: boolean };

const esquemaContacto = z.object({
  id: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(2, "Falta el nombre."),
  telefono: z.string().trim().optional(),
  email: z.union([z.string().trim().email("Email inválido."), z.literal("")]).optional(),
  tipo: z.enum(["comprador", "propietario", "ambos"]),
  notas: z.string().trim().optional(),
});

export async function editarContacto(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  await requerirSesion();

  const parsed = esquemaContacto.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const d = parsed.data;

  await db
    .update(contactos)
    .set({
      nombre: d.nombre,
      telefono: normalizarTelefono(d.telefono),
      email: d.email || null,
      tipo: d.tipo,
      notas: d.notas || null,
    })
    .where(eq(contactos.id, d.id));

  revalidatePath("/contactos");
  revalidatePath(`/contactos/${d.id}`);
  return { ok: true };
}

/* ── Perfil de búsqueda: lo que alimenta el matching de la Fase 2 ── */

const opcionalNumero = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative().optional(),
);

const esquemaBusqueda = z.object({
  contactoId: z.coerce.number().int().positive(),
  operacion: z.enum(["venta", "alquiler"]),
  tipos: z.string().optional(),
  barrios: z.string().optional(),
  precioMin: opcionalNumero,
  precioMax: opcionalNumero,
  dormitoriosMin: opcionalNumero,
  cochera: z.coerce.boolean().optional(),
  aptoCredito: z.coerce.boolean().optional(),
  notas: z.string().trim().optional(),
});

function listar(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export async function guardarBusqueda(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  await requerirSesion();

  const parsed = esquemaBusqueda.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const d = parsed.data;

  const [existente] = await db
    .select({ id: busquedas.id })
    .from(busquedas)
    .where(eq(busquedas.contactoId, d.contactoId))
    .limit(1);

  const valores = {
    contactoId: d.contactoId,
    operacion: d.operacion,
    tipos: listar(d.tipos),
    barrios: listar(d.barrios),
    precioMin: d.precioMin?.toString() ?? null,
    precioMax: d.precioMax?.toString() ?? null,
    dormitoriosMin: d.dormitoriosMin ?? null,
    cochera: Boolean(d.cochera),
    aptoCredito: Boolean(d.aptoCredito),
    notas: d.notas || null,
    activa: true,
  };

  if (existente) {
    await db.update(busquedas).set(valores).where(eq(busquedas.id, existente.id));
  } else {
    await db.insert(busquedas).values(valores);
  }

  revalidatePath(`/contactos/${d.contactoId}`);
  return { ok: true };
}
