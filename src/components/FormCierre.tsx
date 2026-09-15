"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { rechazarConsulta, marcarGanada, type Estado } from "@/actions/consultas";

/** Regla 3: cinco opciones, un toque. Ninguna es "otro". */
const MOTIVOS = [
  ["compro_en_otra", "Compró en otra inmobiliaria"],
  ["precio", "Precio"],
  ["no_calificaba", "No calificaba"],
  ["nunca_respondio", "Nunca respondió"],
  ["fuera_de_zona", "Fuera de zona"],
] as const;

function BotonRechazar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Cerrando…" : "Rechazar consulta"}
    </button>
  );
}

/**
 * Las dos únicas salidas del circuito.
 *
 * Ganado es un botón y listo — si cerró, cerró. Rechazado pide motivo, porque
 * agregado en el panel es el dato que dice si el problema son los precios o
 * la atención.
 */
export function FormCierre({ consultaId }: { consultaId: number }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState<Estado, FormData>(rechazarConsulta, {});
  const [ganando, iniciarGanar] = useTransition();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        disabled={ganando}
        onClick={() => iniciarGanar(() => void marcarGanada(consultaId))}
        className="btn w-full border-[var(--ok-border)] bg-ok-bg text-ok hover:bg-[#e2f4ec]"
      >
        {ganando ? "Guardando…" : "Marcar como ganado"}
      </button>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="btn btn-neutro w-full"
        >
          Rechazar
        </button>
      ) : (
        <section className="tarjeta-i p-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-[12.5px] font-semibold text-muted">
              ¿Por qué se rechaza?
            </p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-[12.5px] font-semibold text-muted hover:text-ink"
            >
              Cancelar
            </button>
          </div>

          <form action={accion} className="flex flex-col gap-2.5">
            <input type="hidden" name="consultaId" value={consultaId} />

            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">Elegí el motivo</legend>
              {MOTIVOS.map(([v, t]) => (
                <label key={v} className="cursor-pointer">
                  <input
                    type="radio"
                    name="motivo"
                    value={v}
                    required
                    className="peer sr-only"
                  />
                  <span className="block rounded-[12px] border border-[#edebf8] bg-ground px-3.5 py-3 text-[14px] transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:font-semibold peer-checked:text-[var(--accent-hover)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                    {t}
                  </span>
                </label>
              ))}
            </fieldset>

            <input name="nota" className="campo" placeholder="Aclaración (opcional)" />

            {estado.error && (
              <p
                role="alert"
                className="rounded-[12px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-2.5 text-[13.5px] text-crit"
              >
                {estado.error}
              </p>
            )}

            <BotonRechazar />
          </form>
        </section>
      )}
    </div>
  );
}
