"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { iniciarSesion, type EstadoLogin } from "@/actions/auth";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormLogin() {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});

  return (
    <form action={accion} className="tarjeta flex flex-col gap-4 p-5">
      <label className="block">
        <span className="etiqueta">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="campo"
          placeholder="vos@inmobiliaria.com"
        />
      </label>

      <label className="block">
        <span className="etiqueta">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
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

      <Boton />
    </form>
  );
}
