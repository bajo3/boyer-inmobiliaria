import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios, type Usuario } from "@/db/schema";

const COOKIE = "boyer_sesion";
const DIAS = 30;

function clave(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "Falta AUTH_SECRET (mínimo 16 caracteres). Ver .env.example.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function crearSesion(usuarioId: number) {
  const token = await new SignJWT({ uid: usuarioId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(clave());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS * 24 * 60 * 60,
  });
}

export async function cerrarSesion() {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * Usuario de la sesión actual, o null. No redirige.
 *
 * Va envuelto en cache() porque en cada navegación lo piden el layout y la
 * página: sin esto son dos consultas idénticas, una atrás de la otra, antes
 * de que la pantalla empiece siquiera a cargar sus propios datos.
 */
export const sesionActual = cache(async function sesionActual(): Promise<Usuario | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, clave());
    const uid = payload.uid;
    if (typeof uid !== "number") return null;

    const [u] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, uid))
      .limit(1);

    return u?.activo ? u : null;
  } catch {
    return null;
  }
});

/** Para páginas privadas: devuelve el usuario o manda al login. */
export async function requerirSesion(): Promise<Usuario> {
  const u = await sesionActual();
  if (!u) redirect("/login");
  return u;
}

/**
 * Quién puede corregir y borrar consultas, y repartirlas entre vendedores.
 * Un vendedor no: si pudiera borrar, se borraría la trazabilidad con ella.
 */
export function puedeAdministrar(u: Usuario): boolean {
  return u.rol === "titular" || u.rol === "administrativa";
}

/** El panel de control es solo para el perfil titular. */
export async function requerirTitular(): Promise<Usuario> {
  const u = await requerirSesion();
  if (u.rol !== "titular") redirect("/");
  return u;
}
