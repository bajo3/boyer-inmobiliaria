"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { configuracion, usuarios } from "@/db/schema";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";

export async function cambiarAsignacionAutomatica(activa: boolean) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) return;

  await db
    .insert(configuracion)
    .values({ id: 1, asignacionAutomatica: activa, actualizadoPor: usuario.id })
    .onConflictDoUpdate({
      target: configuracion.id,
      set: {
        asignacionAutomatica: activa,
        actualizadoAt: new Date(),
        actualizadoPor: usuario.id,
      },
    });

  revalidatePath("/configuracion");
  revalidatePath("/");
}

/** Sacar a alguien del reparto sin desactivarlo: vacaciones, licencia, agenda llena. */
export async function cambiarRecibeLeads(vendedorId: number, recibe: boolean) {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) return;

  await db
    .update(usuarios)
    .set({ recibeLeads: recibe })
    .where(and(eq(usuarios.id, vendedorId), eq(usuarios.rol, "vendedor")));

  revalidatePath("/configuracion");
  revalidatePath("/");
}
