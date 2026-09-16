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

  await alquileresDeEjemplo(admin.id);
  await busquedasDeEjemplo();
  await autorizacionesDeEjemplo();

  console.log("\nListo.");
  await cerrar();
}

/* ── alquileres ───────────────────────────────────────────────────── */

/** "2026-09" del mes en curso. */
function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Tres contratos en los tres estados que importan: uno atrasado, uno pagado y
 * uno por vencer. Sin los tres, la pantalla de alquileres no muestra nada.
 */
async function alquileresDeEjemplo(adminId: number) {
  const [{ ya }] = await db
    .select({ ya: sql<number>`count(*)::int` })
    .from(schema.contratos);

  if (ya > 0) {
    console.log(`→ Alquileres: ya hay ${ya} contratos, se omite`);
    return;
  }

  console.log("→ Contratos de alquiler (--demo)");

  const props = await db.query.propiedades.findMany({ limit: 12 });
  const periodo = periodoActual();

  // nombre, teléfono, monto, expensas, día de vencimiento, ¿ya pagó?
  const inquilinos = [
    ["Marcela Ibáñez", "249 15 4771122", 420000, 35000, 5, false],
    ["Hernán Quiroga", "249 15 4883344", 510000, null, 10, true],
    ["Carla Domínguez", "2494 556677", 365000, 28000, 17, false],
  ] as const;

  const hoy = new Date();

  for (const [i, fila] of inquilinos.entries()) {
    const [nombre, tel, monto, expensas, dia, pagado] = fila;
    const propiedad = props[i + 6];
    if (!propiedad) continue;

    const [inquilino] = await db
      .insert(schema.contactos)
      .values({
        nombre,
        telefono: normalizarTelefono(tel),
        tipo: "inquilino",
        origen: "mostrador",
      })
      .returning();

    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 7, 1);
    const fin = new Date(hoy.getFullYear() + 1, hoy.getMonth() + 17, 1);
    const ajuste = new Date(hoy.getFullYear(), hoy.getMonth() + (i === 0 ? 1 : 5), 1);

    const [contrato] = await db
      .insert(schema.contratos)
      .values({
        propiedadId: propiedad.id,
        inquilinoId: inquilino.id,
        propietarioId: propiedad.propietarioId,
        monto: monto.toString(),
        moneda: "ARS",
        expensas: expensas?.toString() ?? null,
        diaVencimiento: dia,
        inicio: inicio.toISOString().slice(0, 10),
        fin: fin.toISOString().slice(0, 10),
        ajuste: "cuatrimestral",
        proximoAjuste: ajuste.toISOString().slice(0, 10),
        comisionPct: "5",
      })
      .returning();

    await db
      .update(schema.propiedades)
      .set({ operacion: "alquiler", estado: "reservada" })
      .where(sql`id = ${propiedad.id}`);

    if (pagado) {
      await db.insert(schema.pagos).values({
        contratoId: contrato.id,
        periodo,
        monto: monto.toString(),
        registradoPor: adminId,
      });
    }
  }

  console.log(`  ${inquilinos.length} contratos`);
}

/* ── búsquedas ────────────────────────────────────────────────────── */

/**
 * Perfiles de búsqueda derivados de propiedades que existen, para que el cruce
 * encuentre algo. Una búsqueda inventada al azar no coincide con nada y la
 * pantalla queda vacía justo donde hay que mostrar que el sistema sirve.
 */
async function busquedasDeEjemplo() {
  const [{ ya }] = await db
    .select({ ya: sql<number>`count(*)::int` })
    .from(schema.busquedas);

  if (ya > 0) {
    console.log(`→ Búsquedas: ya hay ${ya} cargadas, se omite`);
    return;
  }

  console.log("→ Perfiles de búsqueda (--demo)");

  const conPrecio = await db.query.propiedades.findMany({
    where: sql`precio is not null and barrio is not null and operacion = 'venta'`,
    limit: 3,
  });

  const compradores = [
    ["Julieta Moreno", "249 15 4009911"],
    ["Ramiro Vega", "249 15 4118822"],
    ["Ana Lucía Prat", "2494 337755"],
  ] as const;

  let creadas = 0;

  for (const [i, p] of conPrecio.entries()) {
    const datos = compradores[i];
    if (!datos) break;

    const [contacto] = await db
      .insert(schema.contactos)
      .values({
        nombre: datos[0],
        telefono: normalizarTelefono(datos[1]),
        tipo: "comprador",
        origen: "mostrador",
      })
      .returning();

    await db.insert(schema.busquedas).values({
      contactoId: contacto.id,
      operacion: "venta",
      tipos: [p.tipo],
      barrios: p.barrio ? [p.barrio] : [],
      // Un 15 % de margen: busca en esa zona y ese rango, no esa propiedad exacta.
      precioMax: Math.round(Number(p.precio) * 1.15).toString(),
      moneda: p.moneda,
      dormitoriosMin: p.dormitorios,
      activa: true,
    });

    creadas++;
  }

  console.log(`  ${creadas} búsquedas`);
}

main().catch(async (e) => {
  console.error(e);
  await cerrar();
  process.exit(1);
});

/* ── autorizaciones ───────────────────────────────────────────────── */

/**
 * Tres autorizaciones con propietario, una de ellas por vencer.
 *
 * El relevamiento trajo las propiedades del portal, que no dice de quién son:
 * sin propietario y sin fecha de vencimiento, ni el aviso del panel ni el
 * documento de autorización tienen con qué trabajar.
 */
async function autorizacionesDeEjemplo() {
  const [{ ya }] = await db
    .select({ ya: sql<number>`count(*)::int` })
    .from(schema.autorizaciones);

  if (ya > 0) {
    console.log(`→ Autorizaciones: ya hay ${ya} cargadas, se omite`);
    return;
  }

  console.log("→ Autorizaciones (--demo)");

  const props = await db.query.propiedades.findMany({
    where: sql`operacion = 'venta' and precio is not null`,
    limit: 3,
  });

  // nombre del propietario, teléfono, exclusiva, meses hasta el vencimiento
  const duenos = [
    ["Roberto Sanguinetti", "249 15 4662211", true, 1],
    ["Estela Márquez", "2494 448899", false, 7],
    ["Sucesión Iriarte", "249 15 4337766", true, 4],
  ] as const;

  const hoy = new Date();
  let creadas = 0;

  for (const [i, p] of props.entries()) {
    const datos = duenos[i];
    if (!datos) break;

    const [nombre, tel, exclusiva, meses] = datos;

    const [propietario] = await db
      .insert(schema.contactos)
      .values({
        nombre,
        telefono: normalizarTelefono(tel),
        tipo: "propietario",
        origen: "mostrador",
      })
      .returning();

    await db
      .update(schema.propiedades)
      .set({ propietarioId: propietario.id })
      .where(sql`id = ${p.id}`);

    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + meses, 1);

    await db.insert(schema.autorizaciones).values({
      propiedadId: p.id,
      propietarioId: propietario.id,
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta.toISOString().slice(0, 10),
      exclusiva,
      comisionPct: "3",
      precioAutorizado: p.precio,
      // El piso solo lo ve la titular: es lo que el dueño aceptaría de verdad.
      precioPiso: Math.round(Number(p.precio) * 0.92).toString(),
      notasInternas:
        i === 0 ? "Acepta financiación en dos pagos. No quiere visitas los domingos." : null,
    });

    creadas++;
  }

  console.log(`  ${creadas} autorizaciones`);
}
