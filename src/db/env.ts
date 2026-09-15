import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carga .env / .env.local sin depender de dotenv.
 *
 * `override: true` hace que el archivo del proyecto le gane a lo que ya esté
 * exportado en la terminal. Se usa solo en desarrollo, y existe por un motivo
 * concreto: un DATABASE_URL de otro proyecto olvidado en el shell hace que la
 * app arranque contra la base equivocada sin dar ningún error. En producción
 * no hay archivo .env y mandan las variables reales del entorno.
 */
export function loadEnv({ override = false }: { override?: boolean } = {}) {
  const vistas = new Set<string>();

  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const linea of readFileSync(path, "utf8").split("\n")) {
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

      // .env.local se lee primero, así que nunca lo pisa el .env de atrás.
      if (override || !(clave in process.env)) {
        if (override && vistas.has(clave)) continue;
        process.env[clave] = valor;
        vistas.add(clave);
      }
    }
  }
}
