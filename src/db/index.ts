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
    max: local ? 1 : 5,
    ssl: local ? false : "require",
    prepare: pooler ? false : undefined,
  });

  return drizzle(sql, { schema }) as unknown as DB;
}

/**
 * En dev Next recarga los módulos en cada cambio; sin este cache se abriría
 * una base nueva por recarga (y con PGlite, un bloqueo sobre el directorio).
 */
const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

const promesa = globalForDb.__db ?? conectar();
if (process.env.NODE_ENV !== "production") globalForDb.__db = promesa;

export const db = await promesa;
export { schema };
