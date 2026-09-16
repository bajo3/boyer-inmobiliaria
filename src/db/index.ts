import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { loadEnv } from "./env";

// En desarrollo el .env del proyecto manda: evita arrancar contra la base de
// otro proyecto si quedó un DATABASE_URL exportado en la terminal.
if (process.env.NODE_ENV !== "production") loadEnv({ override: true });

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Falta DATABASE_URL. Copiá .env.example a .env y completá la conexión a Postgres.",
  );
}

/** El tipo común a los dos drivers: expone db.query, select, insert, etc. */
export type DB = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Dos modos, mismo SQL:
 *
 *   pglite://./.pglite   → Postgres embebido en el propio proceso. Sin instalar
 *                          ni levantar nada. Para desarrollo.
 *   postgresql://…       → Postgres de verdad (Supabase, Railway, Neon). Producción.
 */
export const esEmbebido = url.startsWith("pglite:");

async function conectar(): Promise<DB> {
  if (esEmbebido) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");

    const dir = url!.replace(/^pglite:\/\//, "") || "./.pglite";
    return drizzle(new PGlite(dir), { schema }) as unknown as DB;
  }

  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const local = url!.includes("localhost") || url!.includes("127.0.0.1");

  // El pooler de transacciones de Supabase (6543) no soporta prepared
  // statements: con prepare activado, la segunda query de cada conexión falla.
  const pooler = url!.includes("pooler.supabase.com");

  const sql = postgres(url!, {
    // Pocas conexiones por instancia: en serverless hay muchas instancias vivas
    // a la vez y el pooler de Supabase tiene un tope de clientes. Pasarse no da
    // un error claro, da conexiones nuevas cada vez más lentas.
    max: local ? 1 : 3,
    ssl: local ? false : "require",
    prepare: pooler ? false : undefined,
    // Abrir una conexión cuesta un handshake TLS entero (segundos si la base
    // está lejos). Sostenerlas evita pagarlo en cada navegación; soltarlas
    // después de un rato evita quedarse con slots del pooler sin usar.
    idle_timeout: 60,
    connect_timeout: 15,
  });

  return drizzle(sql, { schema }) as unknown as DB;
}

/**
 * Una sola conexión para todo el proceso, guardada en globalThis.
 *
 * En desarrollo, porque Next recarga los módulos en cada cambio y sin esto se
 * abriría una base nueva por recarga (con PGlite, además, un bloqueo sobre el
 * directorio). En producción, porque Next arma un bundle por ruta y este
 * módulo se instancia en cada uno: sin el cache, cada pantalla termina con su
 * propio pool y paga de nuevo el handshake TLS, que contra una base lejana son
 * segundos por pantalla.
 */
const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

const promesa = globalForDb.__db ?? conectar();
globalForDb.__db = promesa;

export const db = await promesa;
export { schema };
