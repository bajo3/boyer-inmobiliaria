"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { guardarIndice, type Estado } from "@/actions/indices";
import { mesCorto } from "@/lib/ipc";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-neutro btn-chico" disabled={pending}>
      {pending ? "…" : "Cargar"}
    </button>
  );
}

/**
 * La tabla del IPC mes a mes.
 *
 * Es una pantalla de dos campos a propósito: se usa una vez por mes, cuando
 * sale el dato del INDEC, y tiene que llevar menos tiempo que buscarlo.
 */
export function TablaIndices({
  indices,
  puedeEditar,
}: {
  indices: { mes: string; valor: string }[];
  puedeEditar: boolean;
}) {
  const [estado, accion] = useActionState<Estado, FormData>(guardarIndice, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <section className="tarjeta p-4">
      <h2 className="rotulo">IPC mensual</h2>

      {indices.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">
          No hay meses cargados. Los publica el INDEC a mediados de cada mes.
        </p>
      ) : (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {indices.map((i) => (
            <li
              key={i.mes}
              className="tnum rounded-full bg-sunken px-2.5 py-[3px] text-[12px]"
            >
              <span className="text-muted">{mesCorto(i.mes)}</span>{" "}
              <span className="font-bold">{Number(i.valor)} %</span>
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && (
        <form ref={form} action={accion} className="mt-3 flex items-end gap-2">
          <label className="block flex-1">
            <span className="etiqueta">Mes</span>
            <input
              name="mes"
              required
              className="campo tnum"
              placeholder="2026-09"
              pattern="\d{4}-\d{2}"
            />
          </label>
          <label className="block w-[92px]">
            <span className="etiqueta">Var. %</span>
            <input
              name="valor"
              required
              inputMode="decimal"
              className="campo tnum"
              placeholder="2.1"
            />
          </label>
          <Guardar />
        </form>
      )}

      {estado.error && (
        <p role="alert" className="mt-2 text-[12.5px] text-crit">
          {estado.error}
        </p>
      )}
    </section>
  );
}
