"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { editarContacto, type Estado } from "@/actions/contactos";
import type { Contacto } from "@/db/schema";
import { mostrarTelefono } from "@/lib/telefono";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

export function FormContacto({ contacto }: { contacto: Contacto }) {
  const [estado, accion] = useActionState<Estado, FormData>(editarContacto, {});

  return (
    <section className="tarjeta p-4">
      <h2 className="mb-3 rotulo">
        Datos del contacto
      </h2>

      <form action={accion} className="space-y-3">
        <input type="hidden" name="id" value={contacto.id} />

        <div>
          <label className="etiqueta" htmlFor="c-nombre">
            Nombre *
          </label>
          <input
            id="c-nombre"
            name="nombre"
            required
            defaultValue={contacto.nombre}
            className="campo"
          />
        </div>

        <div>
          <label className="etiqueta" htmlFor="c-tel">
            Teléfono
          </label>
          <input
            id="c-tel"
            name="telefono"
            inputMode="tel"
            defaultValue={mostrarTelefono(contacto.telefono) === "—" ? "" : contacto.telefono ?? ""}
            className="campo"
            placeholder="249 15 412-3456"
          />
        </div>

        <div>
          <label className="etiqueta" htmlFor="c-email">
            Email
          </label>
          <input
            id="c-email"
            name="email"
            type="email"
            defaultValue={contacto.email ?? ""}
            className="campo"
          />
        </div>

        <div>
          <label className="etiqueta" htmlFor="c-tipo">
            Tipo
          </label>
          <select
            id="c-tipo"
            name="tipo"
            defaultValue={contacto.tipo}
            className="campo"
          >
            <option value="comprador">Comprador</option>
            <option value="propietario">Propietario</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>

        <div>
          <label className="etiqueta" htmlFor="c-notas">
            Notas
          </label>
          <textarea
            id="c-notas"
            name="notas"
            rows={3}
            defaultValue={contacto.notas ?? ""}
            className="campo resize-y"
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
