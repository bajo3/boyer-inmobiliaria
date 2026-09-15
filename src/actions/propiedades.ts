"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { propiedades, autorizaciones, contactos } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { siguienteCodigo } from "@/lib/codigo";
import { normalizarTelefono } from "@/lib/telefono";

export type Estado = { error?: string; ok?: boolean };

const TIPOS = [
  "casa",
  "departamento",
  "ph",
  "lote",
  "campo",
  "local",
  "galpon",
  "cochera",
  "quinta",
] as const;

const opcionalEntero = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().nonnegative().optional(),
);

const opcionalNumero = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative().optional(),
);

const esquema = z.object({
  tipo: z.enum(TIPOS),
  operacion: z.enum(["venta", "alquiler"]),
  direccion: z.string().trim().min(3, "Falta la dirección."),
  barrio: z.string().trim().optional(),
  precio: opcionalNumero,
  moneda: z.enum(["USD", "ARS"]),
  m2Totales: opcionalEntero,
  m2Cubiertos: opcionalEntero,
  ambientes: opcionalEntero,
  dormitorios: opcionalEntero,
  banos: opcionalEntero,
  cocheras: opcionalEntero,
  descripcion: z.string().trim().optional(),
  estado: z.enum(["borrador", "publicada", "reservada", "vendida", "suspendida"]),
  // Propietario y autorización: opcionales al crear, pero el panel los reclama.
  propietarioNombre: z.string().trim().optional(),
  propietarioTelefono: z.string().trim().optional(),
  autorizacionHasta: z.string().trim().optional(),
  comisionPct: opcionalNumero,
  precioPiso: opcionalNumero,
  notasInternas: z.string().trim().optional(),
});

function leer(formData: FormData) {
  return esquema.safeParse(Object.fromEntries(formData.entries()));
}

export async function crearPropiedad(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  await requerirSesion();

  const parsed = leer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const d = parsed.data;
  const codigo = await siguienteCodigo();

  const propietarioId = await asegurarPropietario(
    d.propietarioNombre,
    d.propietarioTelefono,
  );

  const [nueva] = await db
    .insert(propiedades)
    .values({
      codigo,
      tipo: d.tipo,
      operacion: d.operacion,
      direccion: d.direccion,
      barrio: d.barrio || null,
      precio: d.precio?.toString() ?? null,
      moneda: d.moneda,
      m2Totales: d.m2Totales ?? null,
      m2Cubiertos: d.m2Cubiertos ?? null,
      ambientes: d.ambientes ?? null,
      dormitorios: d.dormitorios ?? null,
      banos: d.banos ?? null,
      cocheras: d.cocheras ?? null,
      descripcion: d.descripcion || null,
      estado: d.estado,
      propietarioId,
    })
    .returning({ id: propiedades.id });

  if (d.autorizacionHasta) {
    await db.insert(autorizaciones).values({
      propiedadId: nueva.id,
      propietarioId,
      desde: new Date().toISOString().slice(0, 10),
      hasta: d.autorizacionHasta,
      comisionPct: d.comisionPct?.toString() ?? null,
      precioAutorizado: d.precio?.toString() ?? null,
      precioPiso: d.precioPiso?.toString() ?? null,
      notasInternas: d.notasInternas || null,
    });
  }

  revalidatePath("/propiedades");
  redirect(`/propiedades/${nueva.id}`);
}

export async function editarPropiedad(
  id: number,
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  await requerirSesion();

  const parsed = leer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const d = parsed.data;

  await db
    .update(propiedades)
    .set({
      tipo: d.tipo,
      operacion: d.operacion,
      direccion: d.direccion,
      barrio: d.barrio || null,
      precio: d.precio?.toString() ?? null,
      moneda: d.moneda,
      m2Totales: d.m2Totales ?? null,
      m2Cubiertos: d.m2Cubiertos ?? null,
      ambientes: d.ambientes ?? null,
      dormitorios: d.dormitorios ?? null,
      banos: d.banos ?? null,
      cocheras: d.cocheras ?? null,
      descripcion: d.descripcion || null,
      estado: d.estado,
    })
    .where(eq(propiedades.id, id));

  revalidatePath("/propiedades");
  revalidatePath(`/propiedades/${id}`);
  return { ok: true };
}

export async function cambiarEstadoPropiedad(
  id: number,
  estado: "borrador" | "publicada" | "reservada" | "vendida" | "suspendida",
) {
  await requerirSesion();

  await db.update(propiedades).set({ estado }).where(eq(propiedades.id, id));

  revalidatePath("/propiedades");
  revalidatePath(`/propiedades/${id}`);
}

/** Crea el propietario si hace falta, o reusa el que coincide por teléfono. */
async function asegurarPropietario(
  nombre?: string,
  telefono?: string,
): Promise<number | null> {
  if (!nombre) return null;

  const tel = normalizarTelefono(telefono);

  if (tel) {
    const [existente] = await db
      .select({ id: contactos.id })
      .from(contactos)
      .where(eq(contactos.telefono, tel))
      .limit(1);

    if (existente) {
      await db
        .update(contactos)
        .set({ tipo: "ambos" })
        .where(eq(contactos.id, existente.id));
      return existente.id;
    }
  }

  const [nuevo] = await db
    .insert(contactos)
    .values({ nombre, telefono: tel, tipo: "propietario", origen: "mostrador" })
    .returning({ id: contactos.id });

  return nuevo.id;
}
