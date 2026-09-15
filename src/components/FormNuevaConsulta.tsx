"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { crearConsulta, type Estado } from "@/actions/consultas";

type PropiedadItem = {
  id: number;
  codigo: string;
  direccion: string;
  barrio: string | null;
};

type VendedorItem = { id: number; nombre: string };

const CANALES = [
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["zonaprop", "Zonaprop"],
  ["llamada", "Llamada"],
  ["mostrador", "Mostrador"],
  ["web", "Web"],
] as const;

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario flex-[1.4]" disabled={pending}>
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

/**
 * Alta en tres campos. Todo lo demás se completa después: un formulario largo
 * acá es la forma más rápida de que el vendedor vuelva al cuaderno.
 *
 * En el celular entra como hoja desde abajo; en escritorio, como diálogo.
 */
export function FormNuevaConsulta({
  propiedades,
  vendedores,
}: {
  propiedades: PropiedadItem[];
  vendedores: VendedorItem[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState<Estado, FormData>(crearConsulta, {});
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
        className="btn btn-primario w-full text-[15.5px]"
        onClick={() => setAbierto(true)}
      >
        + Nueva consulta
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(20,19,43,.42)] sm:items-center sm:p-6"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nueva consulta"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[460px] flex-col gap-3.5 rounded-t-[26px] bg-surface px-5 pb-7 pt-5 sm:rounded-[22px] sm:pb-6"
          >
            <span
              aria-hidden
              className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden"
            />
            <h2 className="font-display text-[21px] font-extrabold">Nueva consulta</h2>

            <form ref={form} action={accion} className="flex flex-col gap-3.5">
              <label className="block">
                <span className="etiqueta">Nombre de la persona</span>
                <input
                  name="nombre"
                  required
                  autoFocus
                  className="campo"
                  placeholder="Ej: Gustavo Peralta"
                />
              </label>

              <label className="block">
                <span className="etiqueta">Teléfono</span>
                <input
                  name="telefono"
                  inputMode="tel"
                  className="campo tnum"
                  placeholder="249 15 412-3456"
                />
              </label>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="etiqueta">Canal</span>
                  <select name="canal" required defaultValue="whatsapp" className="campo">
                    {CANALES.map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="etiqueta">Propiedad</span>
                  <select name="propiedadId" defaultValue="" className="campo">
                    <option value="">— Consulta general —</option>
                    {propiedades.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} · {p.direccion}
                        {p.barrio ? ` (${p.barrio})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* El paso que hace que el lead llegue a alguien. Si queda sin
                  asignar, aparece en "Sin asignar" para que la agarre quien pueda. */}
              <label className="block">
                <span className="etiqueta">Pasársela a</span>
                <select name="asignadaA" defaultValue="" className="campo">
                  <option value="">— Sin asignar, la toma quien pueda —</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="etiqueta">Qué preguntó</span>
                <textarea
                  name="mensaje"
                  rows={2}
                  className="campo resize-y"
                  placeholder="Pegá el mensaje o anotá qué consultó"
                />
              </label>

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
                Si el teléfono ya existe, la consulta se suma a ese contacto.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
