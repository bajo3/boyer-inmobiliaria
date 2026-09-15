/**
 * Fuerza la contraseña de demo (SEED_PASSWORD) en todos los usuarios ya
 * sembrados. El seed normal no los toca (onConflictDoNothing): esto es para
 * cuando se quiere que TODAS las cuentas usen la misma clave fácil de mostrar.
 *
 *   node scripts/reset-passwords-demo.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import bcrypt from "bcryptjs";
import postgres from "postgres";

function leerEnv() {
  const vars = {};
  for (const archivo of [".env", ".env.local"]) {
    if (!existsSync(archivo)) continue;
    for (const linea of readFileSync(archivo, "utf8").split("\n")) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;
      const corte = limpia.indexOf("=");
      if (corte === -1) continue;
      const clave = limpia.slice(0, corte).trim();
      let valor = limpia.slice(corte + 1).trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }
      vars[clave] = valor;
    }
  }
  return vars;
}

const env = { ...process.env, ...leerEnv() };
const url = env.DATABASE_URL;
const password = env.SEED_PASSWORD ?? "12345678";

if (!url) throw new Error("Falta DATABASE_URL.");

console.log(`Base: ${url.replace(/:[^:@/]+@/, ":***@")}`);
console.log(`Contraseña nueva para todos: ${password}\n`);

const sql = postgres(url, {
  max: 1,
  ssl: url.includes("localhost") ? false : "require",
  prepare: url.includes("pooler.supabase.com") ? false : undefined,
});

const hash = await bcrypt.hash(password, 10);

const filas = await sql`
  update usuarios
  set password_hash = ${hash}, password_cambiado = false
  returning email, nombre, rol
`;

for (const f of filas) console.log(`  ${f.rol.padEnd(14)} ${f.email}`);
console.log(`\n${filas.length} cuentas actualizadas.`);

await sql.end();
