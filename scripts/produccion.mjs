/**
 * Compila y levanta la app en modo producción, localmente.
 *
 *   npm run prod
 *
 * Para revisar el sistema conviene esto y no `npm run dev`: en desarrollo, los
 * IDs de las Server Actions se regeneran cada vez que arranca el servidor, así
 * que cualquier pestaña que quedó abierta desde antes falla con
 * "Server Action was not found". En producción son estables.
 *
 * Existe este script y no un `NODE_ENV=production next build` en package.json
 * porque esa sintaxis no funciona en PowerShell, y porque si la terminal ya
 * tiene NODE_ENV=development exportado, el build de Next se rompe.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

/**
 * El .env del proyecto manda sobre lo que haya exportado en la terminal.
 *
 * Con NODE_ENV=production, la app ya no aplica esa prioridad por su cuenta
 * (allá mandan las variables reales del entorno, como debe ser). Pero esto es
 * producción corriendo en tu máquina: si hay un DATABASE_URL viejo de otro
 * proyecto en la shell, la app arranca contra la base equivocada.
 */
function leerEnvDelProyecto() {
  const vars = {};

  for (const archivo of [".env", ".env.local"]) {
    const ruta = resolve(process.cwd(), archivo);
    if (!existsSync(ruta)) continue;

    for (const linea of readFileSync(ruta, "utf8").split("\n")) {
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

const propias = leerEnvDelProyecto();
const entorno = { ...process.env, ...propias, NODE_ENV: "production" };

if (propias.DATABASE_URL) {
  console.log(`Base: ${propias.DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}\n`);
}

// Se invoca el binario de Next con el mismo Node, no `npx`: en Windows, hacer
// spawn de un .cmd sin shell falla con EINVAL desde Node 20.
const next = require.resolve("next/dist/bin/next");

function correr(comando) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [next, comando], {
      stdio: "inherit",
      env: entorno,
    });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`next ${comando} salió con ${code}`)),
    );
  });
}

await correr("build");
console.log("\nBuild listo. Levantando en http://localhost:3000\n");
await correr("start");
