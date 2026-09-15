"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { iniciarSesion, type EstadoLogin } from "@/actions/auth";

/** Comparten esta clave a propósito: es la demo, no la inmobiliaria real. */
const PASSWORD_DEMO = "12345678";

const ETIQUETAS_ROL: Record<string, string> = {
  titular: "Titular",
  administrativa: "Administrativa",
  vendedor: "Vendedor",
};

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormLogin({
  cuentas,
}: {
  cuentas: { nombre: string; email: string; rol: string }[];
}) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function elegir(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = PASSWORD_DEMO;
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={accion} className="tarjeta flex flex-col gap-4 p-5">
        <label className="block">
          <span className="etiqueta">Email</span>
          <input
            ref={emailRef}
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
            ref={passwordRef}
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

      {cuentas.length > 0 && (
        <div className="tarjeta-i p-4">
          <p className="etiqueta">Cuentas de prueba</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {cuentas.map((c) => (
              <li key={c.email}>
                <button
                  type="button"
                  onClick={() => elegir(c.email)}
                  className="flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-sunken"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="recorte font-semibold">{c.nombre}</span>
                    <span className="recorte text-faint">{c.email}</span>
                  </span>
                  <span className="flex-none rounded-full bg-sunken px-2 py-[2px] text-[11px] text-muted">
                    {ETIQUETAS_ROL[c.rol] ?? c.rol}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[12px] text-faint">
            Contraseña para todas: <span className="tnum font-semibold">{PASSWORD_DEMO}</span> — un
            clic completa el formulario.
          </p>
        </div>
      )}
    </div>
  );
}
