/**
 * Las 4 reglas del plan, en código.
 *
 * Regla 1 — semáforo de primera respuesta (verde <1h hábil, amarillo <4h, rojo después).
 * Regla 2 — una consulta abierta sin próxima acción con fecha está en rojo.
 * Regla 3 — no se cierra sin motivo (se aplica en actions/consultas.ts).
 * Regla 4 — el resumen diario usa estas mismas funciones (lib/resumen.ts).
 */

import type { Consulta } from "@/db/schema";

/* ── Configuración ──────────────────────────────────────────────── */

/**
 * Ventana en la que corre el reloj del SLA.
 * La oficina atiende 9–13, pero el WhatsApp se contesta desde el celular,
 * así que el compromiso de respuesta se mide sobre una ventana más larga.
 * Si la inmobiliaria prefiere medir solo 9–13, cambiar HORA_FIN a 13.
 */
export const HORA_INICIO = 9;
export const HORA_FIN = 18;
export const DIAS_HABILES = [1, 2, 3, 4, 5]; // lunes a viernes

export const UMBRAL_VERDE_H = 1;
export const UMBRAL_AMARILLO_H = 4;

/** Argentina es UTC−3 fijo: no aplica horario de verano desde 2009. */
const OFFSET_MIN = -180;

/* ── Horas hábiles ──────────────────────────────────────────────── */

/** Convierte un instante real al "reloj de pared" argentino. */
function aLocal(d: Date): Date {
  return new Date(d.getTime() + OFFSET_MIN * 60_000);
}

function esHabil(diaSemanaUTC: number): boolean {
  return DIAS_HABILES.includes(diaSemanaUTC);
}

/**
 * Horas hábiles transcurridas entre dos instantes, contando solo
 * los días laborables dentro de la ventana horaria configurada.
 */
export function horasHabilesEntre(desde: Date, hasta: Date): number {
  if (hasta <= desde) return 0;

  const a = aLocal(desde);
  const b = aLocal(hasta);

  let minutos = 0;
  const cursor = new Date(
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()),
  );
  const finDia = new Date(
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()),
  );

  // Tope de seguridad: 2 años. Una consulta más vieja ya está en rojo igual.
  let guarda = 0;

  while (cursor <= finDia && guarda++ < 750) {
    if (esHabil(cursor.getUTCDay())) {
      const inicioVentana = new Date(cursor);
      inicioVentana.setUTCHours(HORA_INICIO, 0, 0, 0);
      const finVentana = new Date(cursor);
      finVentana.setUTCHours(HORA_FIN, 0, 0, 0);

      const inicio = a > inicioVentana ? a : inicioVentana;
      const fin = b < finVentana ? b : finVentana;

      if (fin > inicio) minutos += (fin.getTime() - inicio.getTime()) / 60_000;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return minutos / 60;
}

/* ── Semáforo ───────────────────────────────────────────────────── */

/** Días de calendario que separan dos instantes, en hora argentina. */
function diasDeCalendarioEntre(desde: Date, hasta: Date): number {
  const dia = (d: Date) => {
    const l = aLocal(d);
    return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  };
  return Math.round((dia(hasta) - dia(desde)) / 86_400_000);
}

export type Nivel = "ok" | "warn" | "crit" | "neutral";

export type Semaforo = {
  nivel: Nivel;
  etiqueta: string;
  /** Mayor = más urgente. La bandeja ordena por esto, nunca por fecha. */
  orden: number;
};

const CERRADAS = new Set(["ganado", "rechazado"]);

/**
 * Tiempo de reloj de pared, no horas hábiles.
 *
 * El color del semáforo sí se calcula en horas hábiles —no tiene sentido
 * marcar en rojo a alguien por no contestar un domingo a las 3 de la mañana—
 * pero el texto tiene que decir la verdad: si el cliente espera desde hace dos
 * días, el vendedor necesita verlo, aunque el reloj del SLA esté pausado.
 */
function textoReal(desde: Date, hasta: Date): string {
  const min = Math.round((hasta.getTime() - desde.getTime()) / 60_000);

  if (min < 1) return "recién";
  if (min < 60) return `${min} min`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h`;

  const dias = Math.round(min / 1440);
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

type ConsultaSLA = Pick<
  Consulta,
  "estado" | "creadaAt" | "primeraRespuestaAt" | "proximaAccion" | "proximaAccionAt"
>;

/**
 * Estado de una consulta según las reglas 1 y 2.
 * Devuelve el color, el texto que va en la bandeja y la prioridad de orden.
 */
export function evaluarConsulta(c: ConsultaSLA, ahora: Date = new Date()): Semaforo {
  if (CERRADAS.has(c.estado)) {
    return {
      nivel: "neutral",
      etiqueta: c.estado === "ganado" ? "Ganado" : "Rechazado",
      orden: 0,
    };
  }

  // ── Regla 1: todavía no se respondió.
  if (!c.primeraRespuestaAt) {
    const h = horasHabilesEntre(c.creadaAt, ahora);
    const espera_txt = textoReal(c.creadaAt, ahora);
    const txt = espera_txt === "recién" ? "Recién entró" : `${espera_txt} sin responder`;

    // El orden usa horas reales, no hábiles: entre dos consultas sin responder,
    // primero va la que más viene esperando aunque las dos estén en verde.
    const espera = (ahora.getTime() - c.creadaAt.getTime()) / 3_600_000;

    if (h < UMBRAL_VERDE_H) return { nivel: "ok", etiqueta: txt, orden: 500 + espera };
    if (h < UMBRAL_AMARILLO_H)
      return { nivel: "warn", etiqueta: txt, orden: 700 + espera };
    return { nivel: "crit", etiqueta: txt, orden: 1000 + espera };
  }

  // ── Regla 2: ya lo contactaron, pero no quedó nada agendado.
  // Así es como mueren los leads: nadie los rechazó, simplemente se olvidaron.
  if (!c.proximaAccionAt) {
    return { nivel: "crit", etiqueta: "Sin próximo paso", orden: 900 };
  }

  const diffH = (c.proximaAccionAt.getTime() - ahora.getTime()) / 3_600_000;

  if (diffH < 0) {
    return {
      nivel: "crit",
      etiqueta: `Vencida hace ${textoReal(c.proximaAccionAt, ahora)}`,
      orden: 800 - diffH,
    };
  }

  // Por día de calendario, no por "faltan menos de 24 h": algo que vence mañana
  // a las 10 está a 23 h, y decir "vence hoy" es sencillamente falso.
  const dias = diasDeCalendarioEntre(ahora, c.proximaAccionAt);

  if (dias === 0) return { nivel: "warn", etiqueta: "Recontactar hoy", orden: 600 };
  if (dias === 1) return { nivel: "ok", etiqueta: "Recontactar mañana", orden: 200 };

  return {
    nivel: "ok",
    etiqueta: `Recontactar en ${dias} días`,
    orden: 100 - dias,
  };
}

/** Orden de la bandeja: lo más urgente primero. */
export function ordenarPorUrgencia<T extends ConsultaSLA>(
  lista: T[],
  ahora: Date = new Date(),
): T[] {
  return [...lista].sort(
    (a, b) => evaluarConsulta(b, ahora).orden - evaluarConsulta(a, ahora).orden,
  );
}
