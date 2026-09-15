/**
 * Carga inicial.
 *
 *   npm run db:seed            → usuarios + las 37 propiedades del relevamiento
 *   npm run db:seed -- --demo  → además, consultas de ejemplo para ver el sistema vivo
 *
 * El --demo es solo para mostrar. NUNCA correrlo sobre la base real de la
 * inmobiliaria: mezcla contactos inventados con los de verdad.
 */

import { loadEnv } from "./env";
loadEnv({ override: true });

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import type { DB } from "./index";
import { normalizarTelefono } from "../lib/telefono";

const aqui = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL.");

// Ver a qué base se escribe antes de escribirla: un DATABASE_URL exportado en
// la terminal le gana al .env, y sembrar la base equivocada no tiene vuelta atrás.
console.log(`Base: ${url.replace(/:[^:@/]+@/, ":***@")}\n`);

let db: DB;
let cerrar: () => Promise<void>;

if (url.startsWith("pglite:")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  const cliente = new PGlite(url.replace(/^pglite:\/\//, "") || "./.pglite");
  db = drizzle(cliente, { schema }) as unknown as DB;
  cerrar = () => cliente.close();
} else {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const local = url.includes("localhost") || url.includes("127.0.0.1");
  const cliente = postgres(url, {
    max: 1,
    ssl: local ? false : "require",
    // El pooler de Supabase no soporta prepared statements.
    prepare: url.includes("pooler.supabase.com") ? false : undefined,
    // Los NOTICE de "ya existe, se omite" no son errores y asustan al leerlos.
    onnotice: () => {},
  });
  db = drizzle(cliente, { schema }) as unknown as DB;
  cerrar = () => cliente.end();
}

const demo = process.argv.includes("--demo");

/* ── tipos del relevamiento → enum del sistema ────────────────────── */

type Fila = {
  precio: number | null;
  tipoRaw: string;
  direccion: string;
  barrio: string;
  m2: number | null;
  amb: number | null;
  dorm: number | null;
  banos: number | null;
  coch: number | null;
  destaque: string;
};

function mapearTipo(raw: string): (typeof schema.tipoPropiedadEnum.enumValues)[number] {
  const t = raw.toLowerCase();
  if (t.startsWith("lote")) return "lote";
  if (t.includes("quinta")) return "quinta";
  if (t.startsWith("depto") || t.startsWith("complejo") || t.startsWith("deptos"))
    return "departamento";
  if (t.startsWith("casa")) return "casa";
  if (t.includes("local")) return "local";
  if (t.includes("galpón") || t.includes("galpon")) return "galpon";
  return "casa";
}

/* ── seed ─────────────────────────────────────────────────────────── */

async function main() {
  const password = process.env.SEED_PASSWORD ?? "boyer2026";
  const hash = await bcrypt.hash(password, 10);

  console.log("→ Usuarios");

  // Los nombres y mails de los vendedores son provisorios: es una de las dos
  // decisiones que el plan marca como bloqueantes. Cambiar antes de producción.
  const usuarios = await db
    .insert(schema.usuarios)
    .values([
      {
        nombre: "María Paz Boyer",
        email: "mariapaz@boyerinmobiliaria.com.ar",
        passwordHash: hash,
        rol: "titular",
      },
      {
        nombre: "Administración",
        email: "admin@boyerinmobiliaria.com.ar",
        passwordHash: hash,
        rol: "administrativa",
      },
      {
        nombre: "Vendedor Uno",
        email: "vendedor1@boyerinmobiliaria.com.ar",
        passwordHash: hash,
        rol: "vendedor",
      },
      {
        nombre: "Vendedor Dos",
        email: "vendedor2@boyerinmobiliaria.com.ar",
        passwordHash: hash,
        rol: "vendedor",
      },
    ])
    .onConflictDoNothing()
    .returning();

  const titular =
    usuarios.find((u) => u.rol === "titular") ??
    (await db.query.usuarios.findFirst({ where: sql`rol = 'titular'` }))!;
  const admin =
    usuarios.find((u) => u.rol === "administrativa") ?? titular;
  const vendedores = usuarios.filter((u) => u.rol === "vendedor");

  console.log(`  ${usuarios.length} usuarios (password: ${password})`);

  /* propiedades */
  console.log("→ Propiedades del relevamiento");

  const filas: Fila[] = JSON.parse(
    readFileSync(join(aqui, "propiedades-relevadas.json"), "utf8"),
  );

  const [{ ya }] = await db
    .select({ ya: sql<number>`count(*)::int` })
    .from(schema.propiedades);

  if (ya > 0) {
    console.log(`  ya hay ${ya} propiedades cargadas, se omite`);
  } else {
    await db.insert(schema.propiedades).values(
      filas.map((f, i) => ({
        codigo: `BOY-${String(i + 1).padStart(4, "0")}`,
        operacion: "venta" as const,
        tipo: mapearTipo(f.tipoRaw),
        direccion: f.direccion,
        barrio: f.barrio || null,
        precio: f.precio?.toString() ?? null,
        moneda: "USD" as const,
        m2Totales: f.m2,
        ambientes: f.amb,
        dormitorios: f.dorm,
        banos: f.banos,
        cocheras: f.coch,
        estado: "publicada" as const,
        // El texto original del portal: no se pierde nada del relevamiento.
        descripcion: f.tipoRaw,
        destacada: f.destaque === "Super",
        publicadaEn: ["zonaprop"],
      })),
    );
    console.log(`  ${filas.length} propiedades`);
  }

  /* demo */
  if (!demo) {
    console.log("\nListo. Para ver el sistema con consultas de ejemplo:");
    console.log("  npm run db:seed -- --demo");
    await cerrar();
    return;
  }

  console.log("→ Consultas de ejemplo (--demo)");

  const props = await db.query.propiedades.findMany({ limit: 6 });
  const hace = (h: number) => new Date(Date.now() - h * 3_600_000);

  // nombre, teléfono, canal, índice de propiedad, horas desde que entró, estado
  const gente = [
    ["Gustavo Peralta", "249 15 4123456", "whatsapp", 0, 30, "no_atendido"],
    ["Lorena Sánchez", "249 15 4998877", "zonaprop", 1, 4, "no_atendido"],
    ["Familia Cabrera", "249 15 4551234", "instagram", 2, 26, "recontactar"],
    ["Diego Ferrari", "2494 667788", "mostrador", 3, 50, "contactado"],
    ["Silvina Rossi", "249 15 4223344", "facebook", 4, 1, "no_atendido"],
  ] as const;

  for (const [i, fila] of gente.entries()) {
    const [nombre, tel, canal, idx, horas, estado] = fila;

    // Los vendedores se reparten las consultas por turno, como en la oficina.
    const vendedor = vendedores[i % Math.max(1, vendedores.length)] ?? titular;
    const atendida = estado !== "no_atendido";

    const [c] = await db
      .insert(schema.contactos)
      .values({
        nombre,
        telefono: normalizarTelefono(tel),
        origen: canal,
        vendedorId: vendedor.id,
      })
      .returning();

    const [consulta] = await db
      .insert(schema.consultas)
      .values({
        contactoId: c.id,
        propiedadId: props[idx]?.id ?? null,
        canal,
        mensajeOriginal:
          "Hola, quería consultar por esta propiedad. ¿Sigue disponible?",
        estado,
        // La administrativa la carga y se la pasa a un vendedor.
        cargadaPor: admin.id,
        asignadaA: vendedor.id,
        creadaAt: hace(horas),
        primeraRespuestaAt: atendida ? hace(horas - 1) : null,
        proximaAccion:
          estado === "recontactar" ? "Llamarlo para coordinar la visita" : null,
        proximaAccionAt:
          estado === "recontactar" ? new Date(Date.now() + 26 * 3_600_000) : null,
      })
      .returning();

    if (atendida) {
      await db.insert(schema.actividades).values({
        consultaId: consulta.id,
        usuarioId: vendedor.id,
        tipo: "whatsapp",
        contenido:
          "Le mandé la ficha por WhatsApp. Quedó en confirmarme el horario.",
        fecha: hace(horas - 1),
      });
    }
  }

  console.log(`  ${gente.length} consultas de ejemplo`);
  console.log("\nListo.");
  await cerrar();
}

main().catch(async (e) => {
  console.error(e);
  await cerrar();
  process.exit(1);
});
