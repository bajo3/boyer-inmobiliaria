/**
 * Aplica las migraciones de drizzle/ a la base de DATABASE_URL.
 *
 *   npm run db:migrate
 *
 * Se usa esto y no `drizzle-kit push` porque las migraciones quedan versionadas
 * en el repo: se sabe qué cambió, cuándo, y se puede repetir igual en producción.
 */

import { loadEnv } from "../src/db/env";
loadEnv({ override: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL.");

// Se muestra el destino a propósito: si hay un DATABASE_URL viejo exportado en
// la terminal, sin esto se migra la base equivocada sin enterarse.
console.log(`Base: ${url.replace(/:[^:@/]+@/, ":***@")}`);

if (url.startsWith("pglite:")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const cliente = new PGlite(url.replace(/^pglite:\/\//, "") || "./.pglite");
  await migrate(drizzle(cliente), { migrationsFolder: "./drizzle" });
  await cliente.close();
} else {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const local = url.includes("localhost") || url.includes("127.0.0.1");
  const cliente = postgres(url, {
    max: 1,
    ssl: local ? false : "require",
    // El pooler de Supabase no soporta prepared statements.
    prepare: url.includes("pooler.supabase.com") ? false : undefined,
    // Los NOTICE de "ya existe, se omite" no son errores y asustan al leerlos.
    onnotice: () => {},
  });

  await migrate(drizzle(cliente), { migrationsFolder: "./drizzle" });
  await cliente.end();
}

console.log("Migraciones aplicadas.");
