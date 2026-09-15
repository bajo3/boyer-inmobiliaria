"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { crearSesion, cerrarSesion } from "@/lib/auth";

export type EstadoLogin = { error?: string };

export async function iniciarSesion(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Completá email y contraseña." };

  const [u] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  // Mismo mensaje para usuario inexistente y contraseña errada:
  // no le decimos a nadie qué emails existen.
  const generico = { error: "Email o contraseña incorrectos." };

  if (!u || !u.activo) return generico;

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return generico;

  await crearSesion(u.id);
  redirect("/");
}

export async function salir() {
  await cerrarSesion();
  redirect("/login");
}
