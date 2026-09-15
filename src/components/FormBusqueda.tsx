"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { guardarBusqueda, type Estado } from "@/actions/contactos";
import type { Busqueda } from "@/db/schema";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar búsqueda"}
    </button>
  );
}

/**
 * El perfil de búsqueda es lo que alimenta el matching de la Fase 2:
 * cuando entra una propiedad nueva, el sistema sabrá a quién avisarle.
 */
export function FormBusqueda({
  contactoId,
  busqueda,
}: {
  contactoId: number;
  busqueda: Busqueda | null;
}) {
  const [estado, accion] = useActionState<Estado, FormData>(guardarBusqueda, {});

  return (
    <section className="tarjeta p-4">
      <h2 className="rotulo">
        Qué está buscando
      </h2>
      <p className="mt-1 mb-3 text-xs text-muted">
        Con esto cargado, el sistema le avisa cuando entra algo que encaja.
      </p>

      <form action={accion} className="space-y-3">
        <input type="hidden" name="contactoId" value={contactoId} />

        <div>
          <label className="etiqueta" htmlFor="b-operacion">
            Operación
          </label>
          <select
            id="b-operacion"
            name="operacion"
            defaultValue={busqueda?.operacion ?? "venta"}
            className="campo"
          >
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
          </select>
        </div>

        <div>
          <label className="etiqueta" htmlFor="b-tipos">
            Tipos (separados por coma)
          </label>
          <input
            id="b-tipos"
            name="tipos"
            defaultValue={busqueda?.tipos?.join(", ") ?? ""}
            className="campo"
            placeholder="casa, ph"
          />
        </div>

        <div>
          <label className="etiqueta" htmlFor="b-barrios">
            Barrios
          </label>
          <input
            id="b-barrios"
            name="barrios"
            defaultValue={busqueda?.barrios?.join(", ") ?? ""}
            className="campo"
            placeholder="centro, villa italia"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="etiqueta" htmlFor="b-min">
              Desde USD
            </label>
            <input
              id="b-min"
              name="precioMin"
              type="number"
              inputMode="numeric"
              defaultValue={busqueda?.precioMin ?? ""}
              className="campo"
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="b-max">
              Hasta USD
            </label>
            <input
              id="b-max"
              name="precioMax"
              type="number"
              inputMode="numeric"
              defaultValue={busqueda?.precioMax ?? ""}
              className="campo"
            />
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="b-dorm">
            Dormitorios mínimo
          </label>
          <input
            id="b-dorm"
            name="dormitoriosMin"
            type="number"
            inputMode="numeric"
            defaultValue={busqueda?.dormitoriosMin ?? ""}
            className="campo"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="cochera"
              value="true"
              defaultChecked={busqueda?.cochera ?? false}
            />
            Necesita cochera
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="aptoCredito"
              value="true"
              defaultChecked={busqueda?.aptoCredito ?? false}
            />
            Apto crédito
          </label>
        </div>

        <div>
          <label className="etiqueta" htmlFor="b-notas">
            Notas
          </label>
          <textarea
            id="b-notas"
            name="notas"
            rows={2}
            defaultValue={busqueda?.notas ?? ""}
            className="campo resize-y"
            placeholder="Quiere patio para el perro. No le importa la antigüedad."
          />
        </div>

        {estado.error && (
          <p
            role="alert"
            className="rounded border border-[var(--crit-border)] bg-crit-bg px-3 py-2 text-sm text-crit"
          >
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p className="rounded border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">
            Guardado.
          </p>
        )}

        <Boton />
      </form>
    </section>
  );
}
