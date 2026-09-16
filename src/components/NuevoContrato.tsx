"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { crearContrato, type Estado } from "@/actions/alquileres";

type PropiedadItem = {
  id: number;
  codigo: string;
  direccion: string;
  barrio: string | null;
};

const AJUSTES = [
  ["cuatrimestral", "Cada 4 meses"],
  ["trimestral", "Cada 3 meses"],
  ["semestral", "Cada 6 meses"],
  ["anual", "Anual"],
  ["sin_ajuste", "Sin ajuste"],
] as const;

/**
 * Fecha local como "2026-09-16". No toISOString(): eso da la fecha en UTC, y
 * después de las 21 h en Argentina ya es mañana.
 */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Un contrato típico arranca hoy y dura dos años. */
function hoy(): string {
  return iso(new Date());
}

function enDosAnios(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return iso(d);
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario flex-[1.4]" disabled={pending}>
      {pending ? "Guardando…" : "Guardar contrato"}
    </button>
  );
}

export function NuevoContrato({
  propiedades,
  imprimirAlCrear = false,
}: {
  propiedades: PropiedadItem[];
  /** Al guardar, ir directo al contrato listo para imprimir. */
  imprimirAlCrear?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState<Estado, FormData>(crearContrato, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      form.current?.reset();
      setAbierto(false);
    }
  }, [estado]);

  useEffect(() => {
    if (!abierto) return;
    const alEscape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alEscape);
    return () => window.removeEventListener("keydown", alEscape);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        className="btn btn-primario w-full"
        onClick={() => setAbierto(true)}
      >
        + Nuevo contrato
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-[rgba(20,19,43,.42)] sm:items-center sm:p-6"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo contrato de alquiler"
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex w-full max-w-[520px] flex-col gap-3.5 rounded-t-[26px] bg-surface px-5 pb-7 pt-5 sm:rounded-[22px] sm:pb-6"
          >
            <span
              aria-hidden
              className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden"
            />
            <h2 className="font-display text-[21px] font-extrabold">
              Nuevo contrato de alquiler
            </h2>

            <form ref={form} action={accion} className="flex flex-col gap-3.5">
              {imprimirAlCrear && <input type="hidden" name="imprimir" value="1" />}

              <label className="block">
                <span className="etiqueta">Propiedad</span>
                <select name="propiedadId" required defaultValue="" className="campo">
                  <option value="" disabled>
                    — Elegí la propiedad —
                  </option>
                  {propiedades.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} · {p.direccion}
                      {p.barrio ? ` (${p.barrio})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="etiqueta">Inquilino</span>
                  <input
                    name="inquilinoNombre"
                    required
                    className="campo"
                    placeholder="Ej: Carla Domínguez"
                  />
                </label>

                <label className="block">
                  <span className="etiqueta">Teléfono</span>
                  <input
                    name="inquilinoTelefono"
                    required
                    inputMode="tel"
                    className="campo tnum"
                    placeholder="249 15 412-3456"
                  />
                </label>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-[1fr_110px]">
                <label className="block">
                  <span className="etiqueta">Monto mensual</span>
                  <input
                    name="monto"
                    required
                    inputMode="numeric"
                    className="campo tnum"
                    placeholder="450000"
                  />
                </label>

                <label className="block">
                  <span className="etiqueta">Moneda</span>
                  <select name="moneda" defaultValue="ARS" className="campo">
                    <option value="ARS">$ ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="etiqueta">Expensas (opcional)</span>
                  <input
                    name="expensas"
                    inputMode="numeric"
                    className="campo tnum"
                    placeholder="0"
                  />
                </label>

                <label className="block">
                  <span className="etiqueta">Vence todos los</span>
                  <input
                    name="diaVencimiento"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={10}
                    required
                    className="campo tnum"
                  />
                </label>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="etiqueta">Inicio</span>
                  <input
                    name="inicio"
                    type="date"
                    required
                    defaultValue={hoy()}
                    className="campo tnum"
                  />
                </label>

                <label className="block">
                  <span className="etiqueta">Fin</span>
                  <input
                    name="fin"
                    type="date"
                    required
                    defaultValue={enDosAnios()}
                    className="campo tnum"
                  />
                </label>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="etiqueta">Ajuste</span>
                  <select name="ajuste" defaultValue="cuatrimestral" className="campo">
                    {AJUSTES.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="etiqueta">Comisión %</span>
                  <input
                    name="comisionPct"
                    inputMode="decimal"
                    className="campo tnum"
                    placeholder="5"
                  />
                </label>
              </div>

              {estado.error && (
                <p
                  role="alert"
                  className="rounded-[12px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-2.5 text-[13.5px] text-crit"
                >
                  {estado.error}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="btn btn-neutro flex-1"
                >
                  Cancelar
                </button>
                <Guardar />
              </div>

              <p className="text-[12px] text-muted">
                La propiedad queda marcada como alquilada y deja de ofrecerse.
                {imprimirAlCrear && " Al guardar se abre el contrato para imprimir."}
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
