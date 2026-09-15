"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";

export type Estado = { error?: string; ok?: boolean };

const esquema = z
  .object({
    actual: z.string().min(1, "Poné tu contraseña actual."),
    nueva: z.string().min(10, "La nueva tiene que tener al menos 10 caracteres."),
    repetir: z.string().min(1, "Repetí la contraseña nueva."),
  })
  .refine((d) => d.nueva === d.repetir, {
    message: "Las dos contraseñas nuevas no coinciden.",
    path: ["repetir"],
  })
  .refine((d) => d.nueva !== d.actual, {
    message: "La nueva tiene que ser distinta a la actual.",
    path: ["nueva"],
  });

/**
 * Cambio de contraseña.
 *
 * Pide la actual a propósito: sin eso, cualquiera que agarre un celular
 * desbloqueado con la sesión abierta se queda con la cuenta.
 */
export async function cambiarPassword(
  _prev: Estado,
  formData: FormData,
): Promise<Estado> {
  const usuario = await requerirSesion();

  const parsed = esquema.safeParse({
    actual: formData.get("actual"),
    nueva: formData.get("nueva"),
    repetir: formData.get("repetir"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const ok = await bcrypt.compare(parsed.data.actual, usuario.passwordHash);
  if (!ok) return { error: "La contraseña actual no es correcta." };

  await db
    .update(usuarios)
    .set({
      passwordHash: await bcrypt.hash(parsed.data.nueva, 10),
      passwordCambiado: true,
    })
    .where(eq(usuarios.id, usuario.id));

  revalidatePath("/", "layout");
  return { ok: true };
}
