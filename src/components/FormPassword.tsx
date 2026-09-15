"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { cambiarPassword, type Estado } from "@/actions/cuenta";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Cambiando…" : "Cambiar contraseña"}
    </button>
  );
}

export function FormPassword() {
  const [estado, accion] = useActionState<Estado, FormData>(cambiarPassword, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={accion} className="tarjeta flex flex-col gap-4 p-5">
      <h2 className="font-display text-[17.5px] font-bold">Cambiar contraseña</h2>

      <label className="block">
        <span className="etiqueta">Contraseña actual</span>
        <input
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
        />
      </label>

      <label className="block">
        <span className="etiqueta">Contraseña nueva</span>
        <input
          name="nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="campo"
          placeholder="Mínimo 10 caracteres"
        />
      </label>

      <label className="block">
        <span className="etiqueta">Repetir la nueva</span>
        <input
          name="repetir"
          type="password"
          autoComplete="new-password"
          required
          className="campo"
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

      {estado.ok && (
        <p className="rounded-[12px] border border-[var(--ok-border)] bg-ok-bg px-3.5 py-2.5 text-[13.5px] text-ok">
          Listo, la contraseña quedó cambiada.
        </p>
      )}

      <Boton />
    </form>
  );
}
