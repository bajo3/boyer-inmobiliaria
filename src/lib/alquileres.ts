/**
 * Alquileres: vencimientos, estado de cobranza y los mensajes al inquilino.
 *
 * El alquiler no se pierde por falta de ganas de cobrar sino porque nadie
 * lleva la cuenta de quién ya pagó. Toda esta lógica existe para responder
 * una sola pregunta bien: hoy, ¿a quién hay que escribirle?
 */

import type { Contrato, Pago, Contacto, Propiedad } from "@/db/schema";
import type { Nivel } from "./sla";
import { precio as fmtPrecio, fecha as fmtFecha } from "./formato";

/** Argentina es UTC−3 fijo: no aplica horario de verano desde 2009. */
const OFFSET_MIN = -180;

function aLocal(d: Date): Date {
  return new Date(d.getTime() + OFFSET_MIN * 60_000);
}

/* ── Períodos ───────────────────────────────────────────────────── */

/** El mes de un instante, en hora argentina: "2026-09". */
export function periodoDe(d: Date = new Date()): string {
  const l = aLocal(d);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-09" → "septiembre" */
export function nombreMes(periodo: string): string {
  const m = Number(periodo.split("-")[1]);
  return MESES[m - 1] ?? periodo;
}

/** "2026-09" → "septiembre 2026" */
export function nombrePeriodo(periodo: string): string {
  const [a] = periodo.split("-");
  return `${nombreMes(periodo)} ${a}`;
}

/**
 * Cuándo vence el alquiler de ese período.
 *
 * Si el contrato vence los 31 y el mes tiene 30, vence el 30: nadie paga el
 * 31 de un mes que no lo tiene, y correrlo al 1 del siguiente sería cobrar tarde.
 */
export function vencimientoDe(
  contrato: Pick<Contrato, "diaVencimiento">,
  periodo: string,
): Date {
  const [a, m] = periodo.split("-").map(Number);
  const ultimoDiaDelMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const dia = Math.min(Math.max(contrato.diaVencimiento, 1), ultimoDiaDelMes);

  // 00:00 hora argentina es 03:00 UTC del mismo día.
  return new Date(Date.UTC(a, m - 1, dia, 3, 0, 0));
}

/** Días de calendario entre dos instantes, en hora argentina. */
function diasEntre(desde: Date, hasta: Date): number {
  const dia = (d: Date) => {
    const l = aLocal(d);
    return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  };
  return Math.round((dia(hasta) - dia(desde)) / 86_400_000);
}

/* ── Estado de cobranza ─────────────────────────────────────────── */

export type EstadoPago = {
  nivel: Nivel;
  etiqueta: string;
  pagado: boolean;
  vence: Date;
  /** Negativo = atrasado. */
  dias: number;
  /** Mayor = más urgente. La lista ordena por esto. */
  orden: number;
};

/**
 * Semáforo de un contrato para un período: verde si ya pagó, amarillo cuando
 * está por vencer, rojo cuando se pasó la fecha.
 */
export function estadoPago(
  contrato: Pick<Contrato, "diaVencimiento">,
  pago: Pago | undefined,
  periodo: string,
  ahora: Date = new Date(),
): EstadoPago {
  const vence = vencimientoDe(contrato, periodo);

  if (pago) {
    return {
      nivel: "ok",
      etiqueta: `Pagó el ${fmtFecha(pago.pagadoAt)}`,
      pagado: true,
      vence,
      dias: 0,
      orden: 0,
    };
  }

  const dias = diasEntre(ahora, vence);

  if (dias < 0) {
    const n = Math.abs(dias);
    return {
      nivel: "crit",
      etiqueta: `Atrasado ${n} ${n === 1 ? "día" : "días"}`,
      pagado: false,
      vence,
      dias,
      orden: 1000 + n,
    };
  }

  if (dias === 0) {
    return {
      nivel: "warn",
      etiqueta: "Vence hoy",
      pagado: false,
      vence,
      dias,
      orden: 900,
    };
  }

  if (dias <= 3) {
    return {
      nivel: "warn",
      etiqueta: `Vence en ${dias} ${dias === 1 ? "día" : "días"}`,
      pagado: false,
      vence,
      dias,
      orden: 800 - dias,
    };
  }

  return {
    nivel: "neutral",
    etiqueta: `Vence el ${fmtFecha(vence)}`,
    pagado: false,
    vence,
    dias,
    orden: 100 - dias,
  };
}

/** ¿Ya se le avisó a esta persona por este mes? */
export function yaRecordado(
  contrato: Pick<Contrato, "recordatorioPeriodo">,
  periodo: string,
): boolean {
  return contrato.recordatorioPeriodo === periodo;
}

/* ── Totales ────────────────────────────────────────────────────── */

export type Totales = Record<
  string,
  { aCobrar: number; cobrado: number; pendiente: number }
>;

/**
 * Totales del mes separados por moneda: sumar pesos con dólares da un número
 * que no significa nada.
 */
export function totalesDelMes(
  filas: { contrato: Pick<Contrato, "monto" | "moneda">; pago: Pago | undefined }[],
): Totales {
  const t: Totales = {};

  for (const { contrato, pago } of filas) {
    const m = contrato.moneda;
    t[m] ??= { aCobrar: 0, cobrado: 0, pendiente: 0 };

    const monto = Number(contrato.monto) || 0;
    t[m].aCobrar += monto;

    if (pago) t[m].cobrado += Number(pago.monto) || 0;
    else t[m].pendiente += monto;
  }

  return t;
}

/* ── Mensajes al inquilino ──────────────────────────────────────── */

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

export const NOMBRE_AGENCIA = "María Paz Boyer Negocios Inmobiliarios";

export type PlantillaAlquiler = {
  id: string;
  etiqueta: string;
  texto: (ctx: {
    contrato: Contrato;
    inquilino: Contacto;
    propiedad: Propiedad;
    periodo: string;
  }) => string;
};

/**
 * Tres mensajes y ninguno más. El monto y la fecha van siempre escritos: el
 * recordatorio que obliga a preguntar "¿cuánto era?" no sirve de nada.
 */
export const PLANTILLAS_ALQUILER: PlantillaAlquiler[] = [
  {
    id: "recordatorio",
    etiqueta: "Recordar vencimiento",
    texto: ({ contrato, inquilino, propiedad, periodo }) => {
      const vence = vencimientoDe(contrato, periodo);
      const total =
        Number(contrato.monto) + (Number(contrato.expensas) || 0);

      return (
        `Hola ${primerNombre(inquilino.nombre)}, ¿cómo estás?\n\n` +
        `Te recuerdo que el alquiler de ${propiedad.direccion} correspondiente a ` +
        `${nombrePeriodo(periodo)} vence el ${fmtFecha(vence)}.\n\n` +
        `Monto: ${fmtPrecio(contrato.monto, contrato.moneda)}` +
        (contrato.expensas
          ? `\nExpensas: ${fmtPrecio(contrato.expensas, contrato.moneda)}` +
            `\nTotal: ${fmtPrecio(total, contrato.moneda)}`
          : "") +
        `\n\nCualquier duda escribime por acá.\n\n${NOMBRE_AGENCIA}`
      );
    },
  },
  {
    id: "atrasado",
    etiqueta: "Avisar atraso",
    texto: ({ contrato, inquilino, propiedad, periodo }) => {
      const vence = vencimientoDe(contrato, periodo);

      return (
        `Hola ${primerNombre(inquilino.nombre)}, ¿cómo estás?\n\n` +
        `Te escribo porque el alquiler de ${propiedad.direccion} de ` +
        `${nombrePeriodo(periodo)} venció el ${fmtFecha(vence)} y todavía no ` +
        `nos figura registrado.\n\n` +
        `Monto: ${fmtPrecio(contrato.monto, contrato.moneda)}\n\n` +
        `Si ya lo pagaste, avisame y lo verificamos. Gracias.\n\n${NOMBRE_AGENCIA}`
      );
    },
  },
  {
    id: "recibido",
    etiqueta: "Confirmar pago",
    texto: ({ inquilino, propiedad, periodo }) =>
      `Hola ${primerNombre(inquilino.nombre)}, te confirmo que recibimos el pago ` +
      `del alquiler de ${propiedad.direccion} correspondiente a ` +
      `${nombrePeriodo(periodo)}.\n\n¡Gracias!\n\n${NOMBRE_AGENCIA}`,
  },
];

/** La plantilla que corresponde según el estado: no hay que elegirla a mano. */
export function plantillaSugerida(estado: EstadoPago): PlantillaAlquiler {
  const id = estado.pagado ? "recibido" : estado.dias < 0 ? "atrasado" : "recordatorio";
  return PLANTILLAS_ALQUILER.find((p) => p.id === id) ?? PLANTILLAS_ALQUILER[0];
}
