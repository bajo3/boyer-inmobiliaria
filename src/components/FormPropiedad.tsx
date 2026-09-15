"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Propiedad } from "@/db/schema";
import type { Estado } from "@/actions/propiedades";

const TIPOS = [
  ["casa", "Casa"],
  ["departamento", "Departamento"],
  ["ph", "PH"],
  ["lote", "Lote"],
  ["campo", "Campo"],
  ["quinta", "Quinta"],
  ["local", "Local"],
  ["galpon", "Galpón"],
  ["cochera", "Cochera"],
] as const;

const ESTADOS = [
  ["publicada", "Publicada"],
  ["borrador", "Borrador"],
  ["reservada", "Reservada"],
  ["vendida", "Vendida"],
  ["suspendida", "Suspendida"],
] as const;

function Boton({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario" disabled={pending}>
      {pending ? "Guardando…" : texto}
    </button>
  );
}

function Campo({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="etiqueta" htmlFor={`p-${name}`}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={`p-${name}`}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="campo"
        inputMode={type === "number" ? "numeric" : undefined}
      />
    </div>
  );
}

export function FormPropiedad({
  accion,
  propiedad,
  textoBoton,
}: {
  accion: (prev: Estado, fd: FormData) => Promise<Estado>;
  propiedad?: Propiedad;
  textoBoton: string;
}) {
  const [estado, enviar] = useActionState<Estado, FormData>(accion, {});
  const esNueva = !propiedad;

  return (
    <form action={enviar} className="space-y-5">
      <section className="tarjeta p-4 space-y-3">
        <h2 className="rotulo">
          Datos principales
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="etiqueta" htmlFor="p-tipo">
              Tipo *
            </label>
            <select
              id="p-tipo"
              name="tipo"
              required
              defaultValue={propiedad?.tipo ?? "casa"}
              className="campo"
            >
              {TIPOS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiqueta" htmlFor="p-operacion">
              Operación *
            </label>
            <select
              id="p-operacion"
              name="operacion"
              required
              defaultValue={propiedad?.operacion ?? "venta"}
              className="campo"
            >
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </select>
          </div>

          <div>
            <label className="etiqueta" htmlFor="p-estado">
              Estado *
            </label>
            <select
              id="p-estado"
              name="estado"
              required
              defaultValue={propiedad?.estado ?? "publicada"}
              className="campo"
            >
              {ESTADOS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            name="direccion"
            label="Dirección"
            required
            defaultValue={propiedad?.direccion}
            placeholder="San Martín 406"
          />
          <Campo
            name="barrio"
            label="Barrio"
            defaultValue={propiedad?.barrio}
            placeholder="Centro"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
          <Campo
            name="precio"
            label="Precio"
            type="number"
            defaultValue={propiedad?.precio}
            placeholder="148000"
          />
          <div>
            <label className="etiqueta" htmlFor="p-moneda">
              Moneda
            </label>
            <select
              id="p-moneda"
              name="moneda"
              defaultValue={propiedad?.moneda ?? "USD"}
              className="campo"
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>
      </section>

      <section className="tarjeta p-4 space-y-3">
        <h2 className="rotulo">
          Medidas
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campo name="m2Totales" label="m² tot." type="number" defaultValue={propiedad?.m2Totales} />
          <Campo name="m2Cubiertos" label="m² cub." type="number" defaultValue={propiedad?.m2Cubiertos} />
          <Campo name="ambientes" label="Amb." type="number" defaultValue={propiedad?.ambientes} />
          <Campo name="dormitorios" label="Dorm." type="number" defaultValue={propiedad?.dormitorios} />
          <Campo name="banos" label="Baños" type="number" defaultValue={propiedad?.banos} />
          <Campo name="cocheras" label="Coch." type="number" defaultValue={propiedad?.cocheras} />
        </div>

        <div>
          <label className="etiqueta" htmlFor="p-descripcion">
            Descripción
          </label>
          <textarea
            id="p-descripcion"
            name="descripcion"
            rows={3}
            defaultValue={propiedad?.descripcion ?? ""}
            className="campo resize-y"
            placeholder="Lo que se publica en los portales"
          />
        </div>
      </section>

      {esNueva && (
        <section className="rounded-lg border border-warn bg-surface p-4 space-y-3">
          <div>
            <h2 className="rotulo text-warn!">
              Propietario y autorización
            </h2>
            <p className="mt-1 text-xs text-muted">
              Es la parte que nadie carga y después duele. Con la fecha de
              vencimiento, el panel avisa 30 días antes.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo name="propietarioNombre" label="Propietario" placeholder="Nombre y apellido" />
            <Campo name="propietarioTelefono" label="Teléfono" placeholder="249 15 412-3456" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo name="autorizacionHasta" label="Autorización hasta" type="date" />
            <Campo name="comisionPct" label="Comisión %" type="number" placeholder="3" />
            <Campo name="precioPiso" label="Precio piso (interno)" type="number" />
          </div>

          <div>
            <label className="etiqueta" htmlFor="p-notasInternas">
              Notas internas — nunca se muestran al cliente
            </label>
            <textarea
              id="p-notasInternas"
              name="notasInternas"
              rows={2}
              className="campo resize-y"
              placeholder="Acepta hasta 140.000. Tiene apuro por mudarse."
            />
          </div>
        </section>
      )}

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

      <Boton texto={textoBoton} />
    </form>
  );
}
