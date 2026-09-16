"use client";

import { useTransition } from "react";
import { registrarPago, anularPago, marcarRecordado } from "@/actions/alquileres";

/**
 * Las dos acciones de la fila: avisarle al inquilino y anotar que pagó.
 *
 * El recordatorio se marca como enviado al abrir WhatsApp, no al volver: nadie
 * vuelve. Con eso alcanza para no mandarle dos veces el mismo mensaje.
 */
export function AccionesAlquiler({
  contratoId,
  periodo,
  linkWa,
  etiquetaWa,
  pagado,
  puedeAnular,
}: {
  contratoId: number;
  periodo: string;
  linkWa: string | null;
  etiquetaWa: string;
  pagado: boolean;
  puedeAnular: boolean;
}) {
  const [, iniciarRecordar] = useTransition();
  const [guardando, iniciarPago] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {linkWa ? (
        <a
          href={linkWa}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            iniciarRecordar(() => void marcarRecordado(contratoId, periodo))
          }
          className="btn btn-wa btn-chico"
        >
          {etiquetaWa}
        </a>
      ) : (
        <span className="text-[12px] text-faint">Sin teléfono cargado</span>
      )}

      {!pagado ? (
        <button
          type="button"
          disabled={guardando}
          onClick={() => iniciarPago(() => void registrarPago(contratoId, periodo))}
          className="btn btn-neutro btn-chico"
        >
          {guardando ? "Guardando…" : "Marcar pagado"}
        </button>
      ) : (
        puedeAnular && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => iniciarPago(() => void anularPago(contratoId, periodo))}
            className="btn btn-chico text-muted hover:text-crit"
          >
            Anular
          </button>
        )
      )}
    </div>
  );
}
