"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { registrarActividad, type Estado } from "@/actions/consultas";

const TIPOS = [
  ["whatsapp", "WhatsApp"],
  ["llamada", "Llamada"],
  ["visita", "Visita"],
  ["oferta", "Oferta"],
  ["nota", "Nota"],
] as const;

function conFormato(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function enDias(dias: number, hora = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return conFormato(d);
}

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario mt-3 w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar y actualizar semáforo"}
    </button>
  );
}

/**
 * El gesto central del vendedor: qué pasó + qué sigue.
 *
 * La próxima acción va en el mismo formulario a propósito. Separarla en otra
 * pantalla es garantía de que nadie la complete, y sin ella la consulta queda
 * en rojo por la regla 2.
 */
export function FormActividad({
  consultaId,
  tieneProximaAccion,
}: {
  consultaId: number;
  tieneProximaAccion: boolean;
}) {
  const [estado, accion] = useActionState<Estado, FormData>(registrarActividad, {});
  const [cuando, setCuando] = useState(() => enDias(1));
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      form.current?.reset();
      setCuando(enDias(1));
    }
  }, [estado]);

  return (
    <section className="border-b border-line-soft px-4 py-5 sm:px-6">
      <h2 className="mb-3 font-display text-[18px] font-bold">Registrar qué pasó</h2>

      <form ref={form} action={accion}>
        <input type="hidden" name="consultaId" value={consultaId} />

        <fieldset className="mb-3">
          <legend className="sr-only">Tipo de contacto</legend>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map(([v, t], i) => (
              <label key={v} className="cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value={v}
                  defaultChecked={i === 0}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-[44px] items-center rounded-[12px] border border-line bg-surface px-3.5 text-[13.5px] font-semibold text-ink-2 transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-[var(--accent-hover)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  {t}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <textarea
          name="contenido"
          required
          rows={3}
          className="campo resize-y"
          placeholder="Qué pasó…"
          aria-label="Qué pasó"
        />

        {/* Regla 2: sin próximo paso con fecha, la consulta queda en rojo. */}
        <div
          className={`mt-3.5 rounded-[16px] p-3.5 ${
            tieneProximaAccion
              ? "border border-line bg-surface-2"
              : "border-[1.5px] border-accent bg-accent-soft"
          }`}
        >
          <p
            className={`text-[12.5px] font-bold uppercase tracking-[.02em] ${
              tieneProximaAccion ? "text-muted" : "text-[var(--accent-hover)]"
            }`}
          >
            {tieneProximaAccion
              ? "Actualizar próxima acción"
              : "Próxima acción · obligatoria"}
          </p>

          <input
            name="proximaAccion"
            className="campo mt-2.5 border-accent-border"
            placeholder="Ej: Llamar y ofrecer sábado 10 h"
            aria-label="Próxima acción"
          />

          <div className="mt-2.5 flex flex-wrap gap-2">
            <input
              type="datetime-local"
              name="proximaAccionAt"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              className="campo tnum min-w-[200px] flex-1 border-accent-border"
              aria-label="Cuándo"
            />
            {(
              [
                ["Mañana", 1],
                ["En 3 días", 3],
                ["En 1 semana", 7],
              ] as const
            ).map(([t, d]) => (
              <button
                key={t}
                type="button"
                onClick={() => setCuando(enDias(d))}
                className="btn btn-neutro btn-chico flex-none border-accent-border text-[var(--accent-hover)]"
              >
                {t}
              </button>
            ))}
          </div>

          {!tieneProximaAccion && (
            <p className="mt-2.5 text-[12.5px] text-[var(--accent-hover)]">
              Sin próximo paso con fecha, esta consulta queda en rojo en tu bandeja.
            </p>
          )}
        </div>

        {estado.error && (
          <p
            role="alert"
            className="mt-3 rounded-[12px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-2.5 text-[13.5px] text-crit"
          >
            {estado.error}
          </p>
        )}

        <Boton />
      </form>
    </section>
  );
}
