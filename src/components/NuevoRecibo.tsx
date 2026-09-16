"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { crearRecibo, type EstadoRecibo } from "@/actions/alquileres";
import { precio as fmtPrecio } from "@/lib/formato";

export type ContratoRecibo = {
  id: number;
  inquilino: string;
  direccion: string;
  monto: string;
  expensas: string | null;
  moneda: "ARS" | "USD";
};

/** Fecha y mes locales. toISOString() da UTC: después de las 21 h ya es mañana. */
function hoy(): { fecha: string; mes: string } {
  const d = new Date();
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { fecha: `${mes}-${String(d.getDate()).padStart(2, "0")}`, mes };
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario flex-[1.4]" disabled={pending}>
      {pending ? "Generando…" : "Generar recibo"}
    </button>
  );
}

/**
 * Cobrar y sacar el recibo en un solo paso.
 *
 * El monto viene del contrato pero se puede cambiar: los pagos parciales
 * existen, y si el formulario no los deja anotar, se anotan en un cuaderno.
 */
export function NuevoRecibo({ contratos }: { contratos: ContratoRecibo[] }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState<EstadoRecibo, FormData>(crearRecibo, {});
  const [contratoId, setContratoId] = useState("");
  const [monto, setMonto] = useState("");
  const [fechas, setFechas] = useState(hoy);

  const contrato = contratos.find((c) => String(c.id) === contratoId);

  useEffect(() => {
    if (!abierto) return;
    const alEscape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alEscape);
    return () => window.removeEventListener("keydown", alEscape);
  }, [abierto]);

  function abrir() {
    // Si quedó abierto de un día para el otro, que no proponga la fecha de ayer.
    setFechas(hoy());
    setAbierto(true);
  }

  function elegir(id: string) {
    setContratoId(id);
    const c = contratos.find((x) => String(x.id) === id);
    setMonto(c ? String(Math.round(Number(c.monto))) : "");
  }

  if (contratos.length === 0) {
    return (
      <button
        type="button"
        disabled
        title="Primero hay que cargar un contrato de alquiler"
        className="btn btn-neutro w-full"
      >
        + Nuevo recibo de pago
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-primario w-full" onClick={abrir}>
        + Nuevo recibo de pago
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-[rgba(20,19,43,.42)] sm:items-center sm:p-6"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo recibo de pago"
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex w-full max-w-[460px] flex-col gap-3.5 rounded-t-[26px] bg-surface px-5 pb-7 pt-5 sm:rounded-[22px] sm:pb-6"
          >
            <span
              aria-hidden
              className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden"
            />
            <h2 className="font-display text-[21px] font-extrabold">
              Nuevo recibo de pago
            </h2>

            <form action={accion} className="flex flex-col gap-3.5">
              <label className="block">
                <span className="etiqueta">Contrato</span>
                <select
                  name="contratoId"
                  required
                  autoFocus
                  value={contratoId}
                  onChange={(e) => elegir(e.target.value)}
                  className="campo"
                >
                  <option value="" disabled>
                    — Elegí el inquilino —
                  </option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.inquilino} · {c.direccion}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="etiqueta">Mes que paga</span>
                  <input
                    name="periodo"
                    type="month"
                    required
                    defaultValue={fechas.mes}
                    className="campo tnum"
                  />
                </label>

                <label className="block">
                  <span className="etiqueta">Fecha de cobro</span>
                  <input
                    name="fecha"
                    type="date"
                    required
                    defaultValue={fechas.fecha}
                    className="campo tnum"
                  />
                </label>
              </div>

              <label className="block">
                <span className="etiqueta">
                  Monto del alquiler{contrato ? ` (${contrato.moneda})` : ""}
                </span>
                <input
                  name="monto"
                  required
                  inputMode="numeric"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="campo tnum"
                  placeholder="Elegí un contrato"
                />
              </label>

              {contrato?.expensas && Number(contrato.expensas) > 0 && (
                <p className="-mt-1.5 text-[12.5px] text-muted">
                  Las expensas ({fmtPrecio(contrato.expensas, contrato.moneda)}) se
                  suman solas en el recibo.
                </p>
              )}

              <label className="block">
                <span className="etiqueta">Observaciones (opcional)</span>
                <input
                  name="notas"
                  className="campo"
                  placeholder="Ej: pago parcial, transferencia"
                />
              </label>

              {estado.error && (
                <p
                  role="alert"
                  className="rounded-[12px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-2.5 text-[13.5px] text-crit"
                >
                  {estado.error}
                  {estado.pagoId && (
                    <>
                      {" "}
                      <Link
                        href={`/imprimir/recibo/${estado.pagoId}`}
                        className="font-semibold underline"
                      >
                        Ver el recibo de ese mes
                      </Link>
                    </>
                  )}
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
                Queda registrado como cobrado y se abre el recibo para imprimir.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
